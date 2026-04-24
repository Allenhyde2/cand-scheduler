import { Client } from "@upstash/qstash";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const qstash = new Client({ token: process.env.QSTASH_TOKEN });
const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dbClient);
const LOG_TABLE_NAME = "VakeSchedulerLogs";

export default async function handler(req, res) {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-can-community-id, x-can-profile-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { action, taskId, productId, productName, newStatus, newIsDisplayed, executeAt, oldExecuteAt, messageId, token, communityId } = body;

    // 1️⃣ HISTORY (실행 완료된 로그 조회)
    if (action === 'HISTORY') {
      const command = new QueryCommand({
        TableName: LOG_TABLE_NAME,
        KeyConditionExpression: "communityId = :cid",
        ExpressionAttributeValues: { ":cid": communityId },
        ScanIndexForward: false, // 최신순 정렬
        Limit: 100
      });
      const response = await docClient.send(command);
      // PENDING이 아닌 완료된 로그만 반환
      const logs = response.Items.filter(item => item.status !== 'PENDING');
      return res.status(200).json({ success: true, logs });
    }

    // 2️⃣ LIST (현재 대기 중인 스케줄 조회)
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
        messageId: item.messageId, // 삭제/수정용 QStash 고유 ID
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

    // 3️⃣ DELETE (스케줄 취소/삭제)
    if (action === 'DELETE') {
      if (messageId) {
        try { await qstash.messages.delete(messageId); } catch(e) { console.error("QStash 삭제 실패:", e); }
      }
      if (executeAt) {
         await docClient.send(new DeleteCommand({
           TableName: LOG_TABLE_NAME,
           Key: { communityId, executedAt: Number(executeAt) }
         }));
      }
      return res.status(200).json({ message: "예약이 삭제되었습니다." });
    }

    // 4️⃣ CREATE / UPDATE (스케줄 등록 및 수정)
    if (action === 'CREATE' || action === 'UPDATE') {
      // 수정일 경우 기존 스케줄 먼저 삭제
      if (action === 'UPDATE' && messageId && oldExecuteAt) {
        try { await qstash.messages.delete(messageId); } catch(e) {}
        try { await docClient.send(new DeleteCommand({ TableName: LOG_TABLE_NAME, Key: { communityId, executedAt: Number(oldExecuteAt) } })); } catch(e) {}
      }

      const targetTimeMs = new Date(executeAt).getTime();
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const workerUrl = `${protocol}://${host}/api/qstash-worker`; // 깨어날 워커 주소 조립

      // ⭐️ QStash 초정밀 스케줄링 등록
      const qstashResponse = await qstash.publishJSON({
        url: workerUrl,
        body: { taskId, productId, productName, newStatus, newIsDisplayed, token, communityId, exactExecuteAt: targetTimeMs },
        notBefore: Math.floor(targetTimeMs / 1000), // 초(Second) 단위로 정확히 설정
      });

      // DynamoDB에 대기열(PENDING) 기록
      await docClient.send(new PutCommand({
        TableName: LOG_TABLE_NAME,
        Item: {
          communityId: communityId,
          executedAt: targetTimeMs,
          taskId: taskId,
          messageId: qstashResponse.messageId, // QStash 메시지 ID
          productId: productId,
          productName: productName || '이름 없음',
          newStatus: newStatus,
          newIsDisplayed: newIsDisplayed,
          status: 'PENDING'
        }
      }));

      return res.status(200).json({ message: "예약 완료", taskId, messageId: qstashResponse.messageId });
    }

    return res.status(400).json({ message: "유효하지 않은 Action입니다." });
  } catch (error) {
    console.error("Schedule API Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
}
