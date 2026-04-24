import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const LOG_TABLE_NAME = "VakeSchedulerLogs";

// 프론트엔드 출력을 위한 상태값 한국어 변환기
const translate = (s) => ({ onSale: '판매중', soldOut: '품절', scheduled: '판매예정', completed: '판매종료' }[s] || s);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { taskId, productId, productName, newStatus, newIsDisplayed, token, communityId, exactExecuteAt, currentStatus, currentIsDisplayed } = body;

  const dbClient = new DynamoDBClient({ 
    region: process.env.AWS_REGION?.trim() || "ap-northeast-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim()
    }
  });
  const docClient = DynamoDBDocumentClient.from(dbClient);

  let isSuccess = false;
  let resultMessage = "";
  
  // ⭐️ [기능 추가] 실제 처리 시간과 딜레이 타임 체크
  const startTime = Date.now();
  const delayMs = exactExecuteAt ? Math.max(0, startTime - exactExecuteAt) : 0;

  try {
    const apiUrl = `https://api.cand.xyz/products/${encodeURIComponent(productId)}`;
    const partialUpdatePayload = { status: newStatus, isDisplayed: newIsDisplayed };

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
        'x-can-community-id': communityId,
      },
      body: JSON.stringify(partialUpdatePayload)
    });

    if (!response.ok) {
       const errData = await response.json().catch(()=>({}));
       throw new Error(`API 에러 (${response.status}): ${JSON.stringify(errData)}`);
    }

    isSuccess = true;
    
    // ⭐️ [기록 복구] "기존 상태 → 변경 상태" 상세 텍스트 조합
    const oldDesc = currentStatus ? `${translate(currentStatus)} (${currentIsDisplayed ? '진열' : '숨김'})` : '상태';
    const newDesc = `${translate(newStatus)} (${newIsDisplayed ? '진열' : '숨김'})`;
    resultMessage = `[성공] ${oldDesc} → ${newDesc}로 변경 완료 (무지연 처리)`;

  } catch (error) {
    // ⭐️ [기능 체크] 실패 원인값을 에러 메시지로 정확히 파싱합니다.
    isSuccess = false;
    resultMessage = `[실패] 상태 변경 실패: ${error.message}`;
    console.error("Worker Execution Error:", error);
  }

  // DynamoDB 로그 덮어쓰기
  try {
    await docClient.send(new PutCommand({
      TableName: LOG_TABLE_NAME,
      Item: {
        communityId: communityId,
        // ⭐️ [버그 해결] 타임스탬프와 고유 ID를 조합하여 정확히 자기 자신의 PENDING 로그만 덮어씁니다.
        executedAt: `${exactExecuteAt}_${taskId}`, 
        taskId: taskId,
        productId: productId,
        productName: productName || '이름 없음',
        currentStatus, currentIsDisplayed,
        newStatus, newIsDisplayed,
        success: isSuccess,
        message: resultMessage,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        delayMs: delayMs // ⭐️ 딜레이 타임 DB에 기록 (App.jsx의 UI와 연동)
      }
    }));
  } catch (dbError) {
    console.error("DynamoDB 기록 에러:", dbError);
  }

  // ⭐️ [안전 장치] 실패 시 HTTP 500 에러와 함께 원인을 반환하여 QStash 대시보드에 로깅하고 재시도를 유도합니다.
  if (!isSuccess) {
      return res.status(500).json({ error: resultMessage, delayMs });
  }
  
  return res.status(200).json({ success: true, delayMs });
}