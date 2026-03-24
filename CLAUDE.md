# canD Scheduler - Project Context

## Project Overview
파도상자(padubox) 상품 관리 스케줄러. canD API를 통해 상품 상태/진열 예약 변경 기능 제공.

## API Documents
- [Swagger API Reference (canD API)](docs/swagger_api.md) - 전체 canD API 엔드포인트 문서
- [canD API Swagger (Live)](https://api.moim.mobi/swagger#/) - Swagger UI 원본

## Architecture
- **Frontend**: React (Vite) - `src/App.jsx`
- **Proxy Server**: Vercel Serverless Function - `api/proxy.js` (CORS 우회용)
- **Scheduler API**: AWS Lambda - 예약 작업 관리
- **Target API**: `https://api.cand.xyz` (canD 본섭)

## Key Config
- Default Community ID: `G0IZUDWCL`
- Scheduler API: `https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule`

## Required Headers (canD API)
```
Authorization: Bearer {token}
x-can-community-id: {communityId}    ← 유효한 ID 필수 (잘못된 값 → 400 에러)
x-can-profile-id: {sellerId}         ← 셀러/관리자 프로필 식별 (선택)
Content-Type: application/json
```

## Known Issues
- 관리자 계정으로 상품 수정 시 `x-can-community-id` 유효성 검증 실패 → 400 에러 발생 가능
- 관리자는 sellerId 없이도 상품 수정이 가능해야 함 (현재 코드에서 sellerId 부재 시 프로필 헤더 미전송)
