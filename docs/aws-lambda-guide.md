# AWS Lambda 스케줄러 설정 가이드

canD Scheduler의 백엔드 인프라를 AWS에 구축하기 위한 단계별 가이드입니다.

---

## 아키텍처 개요

```
[프론트엔드] → [API Gateway] → [Lambda 함수] → [DynamoDB]
                                      ↑
                              [EventBridge Rule] (예약 시간에 트리거)
```

---

## 1. 사전 준비

- AWS 계정
- AWS CLI 설치 및 구성 (`aws configure`)
- Node.js 20.x 이상
- 리전: `ap-southeast-2` (Sydney) 또는 원하는 리전

---

## 2. DynamoDB 테이블 생성

### 2-1. Tasks 테이블

```bash
aws dynamodb create-table \
  --table-name cand-scheduler-tasks \
  --attribute-definitions \
    AttributeName=communityId,AttributeType=S \
    AttributeName=taskId,AttributeType=S \
  --key-schema \
    AttributeName=communityId,KeyType=HASH \
    AttributeName=taskId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-2
```

### 2-2. History 테이블

```bash
aws dynamodb create-table \
  --table-name cand-scheduler-history \
  --attribute-definitions \
    AttributeName=communityId,AttributeType=S \
    AttributeName=sortKey,AttributeType=S \
  --key-schema \
    AttributeName=communityId,KeyType=HASH \
    AttributeName=sortKey,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-2
```

---

## 3. IAM 역할 생성

### 3-1. 신뢰 정책 파일 생성 (`trust-policy.json`)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": ["lambda.amazonaws.com", "events.amazonaws.com"]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### 3-2. 역할 생성

```bash
aws iam create-role \
  --role-name cand-scheduler-lambda-role \
  --assume-role-policy-document file://trust-policy.json
```

### 3-3. 정책 연결

```bash
# CloudWatch Logs (Lambda 로깅)
aws iam attach-role-policy \
  --role-name cand-scheduler-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# DynamoDB 접근
aws iam attach-role-policy \
  --role-name cand-scheduler-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# EventBridge 접근
aws iam attach-role-policy \
  --role-name cand-scheduler-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEventBridgeFullAccess
```

> **보안 권장:** 프로덕션에서는 FullAccess 대신 테이블/규칙별로 스코프된 커스텀 정책을 사용하세요.

---

## 4. Lambda 함수 생성

### 4-1. 패키지 준비

```bash
cd lambda/
npm init -y
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-eventbridge
zip -r scheduler.zip scheduler.js node_modules/ package.json
```

### 4-2. 함수 생성

```bash
aws lambda create-function \
  --function-name cand-scheduler \
  --runtime nodejs20.x \
  --handler scheduler.handler \
  --role arn:aws:iam::{ACCOUNT_ID}:role/cand-scheduler-lambda-role \
  --zip-file fileb://scheduler.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{TASKS_TABLE=cand-scheduler-tasks,HISTORY_TABLE=cand-scheduler-history,LAMBDA_ARN=arn:aws:lambda:ap-southeast-2:{ACCOUNT_ID}:function:cand-scheduler}" \
  --region ap-southeast-2
```

> `{ACCOUNT_ID}`를 실제 AWS 계정 ID로 교체하세요.

### 4-3. EventBridge → Lambda 권한 부여

```bash
aws lambda add-permission \
  --function-name cand-scheduler \
  --statement-id EventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --region ap-southeast-2
```

---

## 5. API Gateway 설정

### 5-1. HTTP API 생성

```bash
aws apigatewayv2 create-api \
  --name cand-scheduler-api \
  --protocol-type HTTP \
  --cors-configuration AllowOrigins='*',AllowMethods='POST,OPTIONS',AllowHeaders='Content-Type,Authorization,x-can-community-id,x-can-profile-id' \
  --region ap-southeast-2
```

### 5-2. Lambda 통합 생성

```bash
aws apigatewayv2 create-integration \
  --api-id {API_ID} \
  --integration-type AWS_PROXY \
  --integration-uri arn:aws:lambda:ap-southeast-2:{ACCOUNT_ID}:function:cand-scheduler \
  --payload-format-version 2.0 \
  --region ap-southeast-2
```

### 5-3. 라우트 생성

```bash
aws apigatewayv2 create-route \
  --api-id {API_ID} \
  --route-key "POST /schedule" \
  --target integrations/{INTEGRATION_ID} \
  --region ap-southeast-2
```

### 5-4. 스테이지 생성 및 배포

```bash
aws apigatewayv2 create-stage \
  --api-id {API_ID} \
  --stage-name '$default' \
  --auto-deploy \
  --region ap-southeast-2
```

---

## 6. 함수 업데이트

코드 변경 시:

```bash
cd lambda/
zip -r scheduler.zip scheduler.js node_modules/ package.json

aws lambda update-function-code \
  --function-name cand-scheduler \
  --zip-file fileb://scheduler.zip \
  --region ap-southeast-2
```

---

## 7. 테스트

### CREATE

```bash
curl -X POST "https://{API_ID}.execute-api.ap-southeast-2.amazonaws.com/schedule" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "CREATE",
    "communityId": "G0IZUDWCL",
    "taskId": "test123",
    "productId": "CP:4IJLUA8N03CHF",
    "productName": "테스트 상품",
    "newStatus": "onSale",
    "newIsDisplayed": true,
    "executeAt": "2026-03-25T15:00:00.000Z",
    "token": "{access_token}"
  }'
```

### LIST

```bash
curl -X POST "https://{API_ID}.execute-api.ap-southeast-2.amazonaws.com/schedule" \
  -H "Content-Type: application/json" \
  -d '{"action": "LIST", "communityId": "G0IZUDWCL", "token": "{access_token}"}'
```

### HISTORY

```bash
curl -X POST "https://{API_ID}.execute-api.ap-southeast-2.amazonaws.com/schedule" \
  -H "Content-Type: application/json" \
  -d '{"action": "HISTORY", "communityId": "G0IZUDWCL", "token": "{access_token}"}'
```

### DELETE

```bash
curl -X POST "https://{API_ID}.execute-api.ap-southeast-2.amazonaws.com/schedule" \
  -H "Content-Type: application/json" \
  -d '{"action": "DELETE", "communityId": "G0IZUDWCL", "taskId": "test123", "token": "{access_token}"}'
```

---

## 8. 주의사항

### 토큰 만료
예약 실행 시 저장된 CANpass OAuth 토큰이 만료되었을 수 있습니다.
- CANpass 토큰 만료: 약 30일 (`expires_in: 2591999`)
- 30일 이상 미래의 예약은 토큰 갱신이 필요합니다
- `refresh_token`을 함께 저장하고 EXECUTE 시 토큰 갱신 로직 추가를 고려하세요

### EventBridge 정밀도
- EventBridge cron은 **분 단위** 정밀도입니다
- 14:37:45에 예약하면 14:37:00에 실행됩니다
- 실제 실행은 cron 시간 + 0~60초 지연이 있을 수 있습니다

### 비용
- Lambda: 월 100만 건 무료 (Free Tier)
- DynamoDB: 온디맨드 요금, 25GB 무료
- EventBridge: 커스텀 규칙 무료
- API Gateway: 월 100만 건 무료 (첫 12개월)

---

## 9. 환경변수 요약

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `TASKS_TABLE` | `cand-scheduler-tasks` | 예약 태스크 테이블 |
| `HISTORY_TABLE` | `cand-scheduler-history` | 실행 히스토리 테이블 |
| `LAMBDA_ARN` | `arn:aws:lambda:...` | EventBridge 타겟용 Lambda ARN |
