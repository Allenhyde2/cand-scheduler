import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const LOG_TABLE_NAME = "VakeSchedulerLogs";

export default async function handler(req, res) {
  // CORS 허용 처리
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-can-community-id, x-can-profile-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const qstashToken = process.env.QSTASH_TOKEN;
    if (!qstashToken) throw new Error("환경 변수에 QSTASH_TOKEN이 누락되었습니다.");
    if (!process.env.AWS_ACCESS_KEY_ID) throw new Error("환경 변수에 AWS_ACCESS_KEY_ID가 누락되었습니다.");

    // AWS DynamoDB 클라이언트 초기화
    const dbClient = new DynamoDBClient({ 
      region: process.env.AWS_REGION || "ap-southeast-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    const docClient = DynamoDBDocumentClient.from(dbClient);

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { action, taskId, productId, productName, newStatus, newIsDisplayed, executeAt, oldExecuteAt, messageId, token, communityId } = body;

    // 1️⃣ HISTORY
    if (action === 'HISTORY') {
      const command = new QueryCommand({
        TableName: LOG_TABLE_NAME,
        KeyConditionExpression: "communityId = :cid",
        ExpressionAttributeValues: { ":cid": communityId },
        ScanIndexForward: false, 
        Limit: 100
      });
      const response = await docClient.send(command);
      const logs = response.Items.filter(item => item.status !== 'PENDING');
      return res.status(200).json({ success: true, logs });
    }

    // 2️⃣ LIST
    if (action === 'LIST') {
      const command = new QueryCommand({
        TableName: LOG_TABLE_NAME,
        KeyConditionExpression: "communityId = :cid",
        ExpressionAttributeValues: { ":cid": communityId },
        ScanIndexForward: false
      });
      const response = await docClient.send(command);
      const tasks = response.Items.filter(item => item.status === 'PENDING').map(item => ({
        id: item.taskId,
        messageId: item.messageId, 
        productId: item.productId,
        productName: item.productName,
        newStatus: item.newStatus,
        newIsDisplayed: item.newIsDisplayed,
        executeAt: item.executedAt,
        status: 'cloud_scheduled',
        logs: [`☁️ [QStash 무지연 대기중] ${new Date(item.executedAt).toLocaleString()} 실행 예약`]
      }));
      return res.status(200).json({ tasks });
    }

    // 3️⃣ DELETE
    if (action === 'DELETE') {
      if (messageId) {
        try {
          // ⭐️ SDK 대신 순수 fetch로 삭제 통신
          await fetch(`https://qstash.upstash.io/v2/messages/${messageId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${qstashToken}` }
          });
        } catch(e) { console.error("QStash 삭제 실패:", e); }
      }
      if (executeAt) {
         await docClient.send(new DeleteCommand({ TableName: LOG_TABLE_NAME, Key: { communityId, executedAt: Number(executeAt) } }));
      }
      return res.status(200).json({ message: "예약이 삭제되었습니다." });
    }

    // 4️⃣ CREATE / UPDATE
    if (action === 'CREATE' || action === 'UPDATE') {
      if (action === 'UPDATE' && messageId && oldExecuteAt) {
        try {
          await fetch(`https://qstash.upstash.io/v2/messages/${messageId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${qstashToken}` }
          });
        } catch(e) {}
        try { await docClient.send(new DeleteCommand({ TableName: LOG_TABLE_NAME, Key: { communityId, executedAt: Number(oldExecuteAt) } })); } catch(e) {}
      }

      const targetTimeMs = new Date(executeAt).getTime();
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const workerUrl = `${protocol}://${host}/api/qstash-worker`; 

      // ⭐️ 핵심 해결: SDK 버그를 피해 순수 fetch로 QStash에 스케줄을 직접 예약합니다.
      const qstashRes = await fetch(`https://qstash.upstash.io/v2/publish/${workerUrl}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${qstashToken}`,
          "Content-Type": "application/json",
          // 1초 단위 예약 시간을 설정 (Unix Timestamp 초 단위)
          "Upstash-Not-Before": Math.floor(targetTimeMs / 1000).toString()
        },
        body: JSON.stringify({ taskId, productId, productName, newStatus, newIsDisplayed, token, communityId, exactExecuteAt: targetTimeMs })
      });

      // QStash 통신 실패 시 원인을 정확하게 프론트로 전달합니다.
      if (!qstashRes.ok) {
        const errText = await qstashRes.text();
        throw new Error(`QStash 서버 거부 (${qstashRes.status}): ${errText}`);
      }
      
      const qstashResponse = await qstashRes.json();

      // 성공했다면 DynamoDB에 대기열(PENDING) 기록
      try {
        await docClient.send(new PutCommand({
          TableName: LOG_TABLE_NAME,
          Item: {
            communityId: communityId,
            executedAt: targetTimeMs,
            taskId: taskId,
            messageId: qstashResponse.messageId, 
            productId: productId,
            productName: productName || '이름 없음',
            newStatus: newStatus,
            newIsDisplayed: newIsDisplayed,
            status: 'PENDING'
          }
        }));
      } catch (dbErr) {
        // DB 저장 실패 시 이미 등록된 QStash 알람도 안전하게 롤백(취소)
        if (qstashResponse?.messageId) {
            await fetch(`https://qstash.upstash.io/v2/messages/${qstashResponse.messageId}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${qstashToken}` }
            }).catch(()=>{});
        }
        throw new Error(`DynamoDB 기록 실패: ${dbErr.message}`);
      }

      return res.status(200).json({ message: "예약 완료", taskId, messageId: qstashResponse.messageId });
    }

    return res.status(400).json({ message: "유효하지 않은 Action입니다." });
  } catch (error) {
    console.error("Schedule API Fatal Error:", error);
    // 화면 우측 상단 토스트 알림으로 에러 원인을 그대로 보여줌
    return res.status(500).json({ message: "서버 처리 실패", error: error.message });
  }
}
