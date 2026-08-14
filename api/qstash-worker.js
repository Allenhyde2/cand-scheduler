import { Receiver } from "@upstash/qstash";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const LOG_TABLE_NAME = "VakeSchedulerLogs";
const CLIENT_ID = '4582f19ca0325304d27abbd18a36b21b';

// 프론트엔드 출력을 위한 상태값 한국어 변환기
const translate = (s) => ({ onSale: '판매중', soldOut: '품절', scheduled: '판매예정', completed: '판매종료' }[s] || s);

async function refreshToken(refreshTokenValue) {
    const CLIENT_SECRET = process.env.CAND_CLIENT_SECRET?.trim();
    if (!refreshTokenValue || !CLIENT_SECRET) return null;

    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        params.append('refresh_token', refreshTokenValue);

        const res = await fetch('https://canpass.me/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        if (res.ok) {
            const data = await res.json();
            return data.access_token || null;
        }
        console.error('토큰 갱신 응답 에러:', res.status);
        return null;
    } catch (e) {
        console.error('토큰 갱신 실패:', e.message);
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const signingKeys = {
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY?.trim(),
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY?.trim(),
    };

    if (signingKeys.currentSigningKey && signingKeys.nextSigningKey) {
        const receiver = new Receiver(signingKeys);
        const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const signature = req.headers['upstash-signature'];
        try {
            await receiver.verify({ signature, body: rawBody });
        } catch (e) {
            console.error('QStash 서명 검증 실패:', e.message);
            return res.status(401).json({ error: '서명 검증 실패 — 요청이 거부되었습니다.' });
        }
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { taskId, productId, productName, newStatus, newIsDisplayed, token, refreshToken: refreshTokenValue, communityId, exactExecuteAt, currentStatus, currentIsDisplayed, sellerId } = body;

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

    // ⭐️ 딜레이 타임 체크 (소수점을 무시하고 실제 밀리초 차이만 계산)
    const startTime = Date.now();
    const delayMs = exactExecuteAt ? Math.max(0, startTime - Math.floor(exactExecuteAt)) : 0;

    try {
        // ⭐️ 토큰 갱신 시도 — 예약 생성 시점 이후 만료되었을 수 있으므로 먼저 갱신합니다
        let activeToken = token;
        if (refreshTokenValue) {
            const newToken = await refreshToken(refreshTokenValue);
            if (newToken) {
                activeToken = newToken;
                console.log('토큰 갱신 성공 — 새 access_token으로 API 호출합니다.');
            } else {
                console.log('토큰 갱신 실패 — 기존 토큰으로 시도합니다.');
            }
        }

        const apiUrl = `https://api.cand.xyz/products/${encodeURIComponent(productId)}`;
        const partialUpdatePayload = { status: newStatus, isDisplayed: newIsDisplayed };

        const headers = {
            'content-type': 'application/json',
            'authorization': `Bearer ${activeToken}`,
            'x-can-community-id': communityId,
        };

        if (sellerId) {
            headers['x-can-profile-id'] = sellerId;
        }

        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(partialUpdatePayload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`API 에러 (${response.status}): ${JSON.stringify(errData)}`);
        }

        isSuccess = true;

        // 상세 텍스트 조합
        resultMessage = `상태 변경이 정상적으로 완료되었습니다.`;

    } catch (error) {
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
                executedAt: exactExecuteAt, // ⭐️ 백엔드에서 전달받은 소수점 숫자 그대로 덮어씁니다!
                taskId: taskId,
                productId: productId,
                productName: productName || '이름 없음',
                currentStatus, currentIsDisplayed,
                newStatus, newIsDisplayed,
                success: isSuccess,
                message: resultMessage,
                status: isSuccess ? 'SUCCESS' : 'FAILED',
                delayMs: delayMs,
                sellerId: sellerId || ''
            }
        }));
    } catch (dbError) {
        console.error("DynamoDB 기록 에러:", dbError);
    }

    if (!isSuccess) {
        return res.status(500).json({ error: resultMessage, delayMs });
    }

    return res.status(200).json({ success: true, delayMs });
}
