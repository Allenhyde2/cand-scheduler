import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dbClient);
const LOG_TABLE_NAME = "VakeSchedulerLogs";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { taskId, productId, productName, newStatus, newIsDisplayed, token, communityId, exactExecuteAt } = body;

  let isSuccess = false;
  let resultMessage = "";

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
       throw new Error(`API 에러: ${response.status} - ${JSON.stringify(errData)}`);
    }

    isSuccess = true;
    resultMessage = "QStash를 통해 지연 시간(0s) 없이 정상적으로 상태가 변경되었습니다.";

  } catch (error) {
    isSuccess = false;
    resultMessage = `요청 실패: ${error.message}`;
  }

  // DynamoDB 업데이트: PENDING 상태였던 동일한 레코드를 SUCCESS/FAILED 로 덮어씌웁니다.
  try {
    await docClient.send(new PutCommand({
      TableName: LOG_TABLE_NAME,
      Item: {
        communityId: communityId,
        executedAt: exactExecuteAt, // 기존 PENDING과 완벽히 동일한 시간(키)
        taskId: taskId,
        productId: productId,
        productName: productName || '이름 없음',
        success: isSuccess,
        message: resultMessage,
        status: isSuccess ? 'SUCCESS' : 'FAILED'
      }
    }));
  } catch (dbError) {
    console.error("DynamoDB 기록 에러:", dbError);
  }

  // QStash에게 결과를 알립니다. (500 반환 시 QStash가 자동으로 재시도함)
  if (!isSuccess) {
      return res.status(500).json({ error: resultMessage });
  }
  return res.status(200).json({ success: true });
}
