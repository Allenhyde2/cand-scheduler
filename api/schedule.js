import { Client } from "@upstash/qstash";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const LOG_TABLE_NAME = "VakeSchedulerLogs";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-can-community-id, x-can-profile-id');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const qstashToken = process.env.QSTASH_TOKEN?.trim();
        const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
        const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
        const awsRegion = process.env.AWS_REGION?.trim() || "ap-northeast-2";

        const qstash = new Client({ token: qstashToken, baseUrl: "https://qstash-eu-central-1.upstash.io" });
        const dbClient = new DynamoDBClient({ region: awsRegion, credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretKey } });
        const docClient = DynamoDBDocumentClient.from(dbClient);

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { action, taskId, productId, productName, newStatus, newIsDisplayed, executeAt, oldExecuteAt, messageId, token, communityId, currentStatus, currentIsDisplayed, sellerId } = body;

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
                currentStatus: item.currentStatus,
                currentIsDisplayed: item.currentIsDisplayed,
                executeAt: item.executedAt,
                sellerId: item.sellerId,
                status: 'cloud_scheduled',
                logs: [`☁️ [QStash 대기중] ${new Date(item.executedAt).toLocaleString()} 실행 예정`]
            }));
            return res.status(200).json({ tasks });
        }

        // 3️⃣ DELETE
        if (action === 'DELETE') {
            if (messageId) try { await qstash.messages.delete(messageId); } catch (e) { }
            if (executeAt) await docClient.send(new DeleteCommand({ TableName: LOG_TABLE_NAME, Key: { communityId, executedAt: Number(executeAt) } }));
            return res.status(200).json({ message: "예약이 취소되었습니다." });
        }

        // 4️⃣ CREATE / UPDATE
        if (action === 'CREATE' || action === 'UPDATE') {
            if (action === 'UPDATE' && messageId && oldExecuteAt) {
                try { await qstash.messages.delete(messageId); } catch (e) { }
                try { await docClient.send(new DeleteCommand({ TableName: LOG_TABLE_NAME, Key: { communityId, executedAt: Number(oldExecuteAt) } })); } catch (e) { }
            }

            const targetTimeMs = new Date(executeAt).getTime();

            // ⭐️ [해결] 밀리초 시간에 소수점 난수를 더해 무조건 고유한 숫자로 만듭니다. (예: 173839... .1234)
            const uniqueExecuteAt = targetTimeMs + Math.random();

            const protocol = req.headers['x-forwarded-proto'] || 'https';
            const host = req.headers['x-forwarded-host'] || req.headers.host;
            const workerUrl = `${protocol}://${host}/api/qstash-worker`;

            const qstashResponse = await qstash.publishJSON({
                url: workerUrl,
                body: { taskId, productId, productName, newStatus, newIsDisplayed, token, communityId, exactExecuteAt: uniqueExecuteAt, currentStatus, currentIsDisplayed, sellerId: sellerId || '' },
                notBefore: Math.floor(targetTimeMs / 1000),
            });

            await docClient.send(new PutCommand({
                TableName: LOG_TABLE_NAME,
                Item: {
                    communityId,
                    executedAt: uniqueExecuteAt, // ⭐️ 완전한 고유 숫자(Number)로 저장됩니다!
                    taskId,
                    messageId: qstashResponse.messageId,
                    productId,
                    productName: productName || '이름 없음',
                    newStatus,
                    newIsDisplayed: newIsDisplayed === true,
                    currentStatus,
                    currentIsDisplayed,
                    sellerId: sellerId || '',
                    status: 'PENDING'
                }
            }));

            return res.status(200).json({ message: "예약 완료", taskId, messageId: qstashResponse.messageId });
        }
        return res.status(400).json({ error: "유효하지 않은 Action입니다." });
    } catch (error) {
        return res.status(500).json({ message: "서버 처리 실패", error: error.message });
    }
}
