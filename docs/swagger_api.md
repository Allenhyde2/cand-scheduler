# canD API (Swagger) Reference

> Source: https://api.moim.mobi/swagger# (= https://api.cand.xyz)

## Base URL
```
https://api.cand.xyz
```

## Authentication
| Method | Header | Description |
|--------|--------|-------------|
| CANpass OAuth2 | `Authorization: Bearer {token}` | Authorization Code flow |
| Internal API Key | `x-can-internal-api-key: {key}` | 내부 전용 엔드포인트 |
| Community ID | `x-can-community-id: {communityId}` | **대부분의 엔드포인트에 필수** |

## Response Format (Paginated)
```json
{
  "paging": { "after": "string", "total": "number" },
  "data": [ /* items */ ]
}
```

---

## Endpoints

### Internal
> `x-can-internal-api-key` 헤더 필요

| Method | Endpoint | Operation | Parameters |
|--------|----------|-----------|------------|
| GET | `/internal/communities` | Fetch Community | `userId` (query, required) |
| GET | `/internal/community` | Get Community | `communityId` (query, required) |
| POST | `/internal/validateAdmin` | Validate Admin | Body: `ValidateAdminRequestDto` |
| POST | `/internal/token` | Token | Body: `TokenRequestDto` |

---

### Communities

| Method | Endpoint | Operation | Parameters | Auth |
|--------|----------|-----------|------------|------|
| GET | `/communities/{communityId}` | Get Community | `communityId` (path) | None |
| GET | `/communities/{communityId}/child_communities` | Get Child Communities | `communityId` (path), pagination | None |
| POST | `/communities/{communityId}/child_communities/search` | Search Child Communities | Body: `SearchCommunityRequestDto` | None |

---

### Users

| Method | Endpoint | Operation | Key Parameters | Scopes |
|--------|----------|-----------|----------------|--------|
| GET | `/users` | Get Users | pagination | `member:MOIM:members:read` |
| GET | `/users/{userId}` | Get User | `userId` (path) | `member:MOIM:members:read` |
| POST | `/users/bulk` | Get Users Bulk | Body: `BulkGetRequest` | `member:MOIM:members:read` |
| GET | `/users/{userId}/form_response` | Get User Form Response | pagination | `member:MOIM:members:read` |
| GET | `/users/contents` | Get User Contents | pagination | `member:MOIM:content:read` |
| GET | `/users/replies` | Get User Replies | pagination | `member:MOIM:content:read` |
| GET | `/users/reviews` | Get User Reviews | pagination | `member:MOIM:content:read` |
| GET | `/me` | Get Me | None | CANpass |
| GET | `/me/payment` | Get Me Payment | None | CANpass |
| GET | `/me/communities` | Get My Communities | None | CANpass |
| POST | `/batch_requests/users` | Create Users Batch | Body: `CreateUserBatchRequestDto` | `member:MOIM:members:write` |
| GET | `/batch_requests/users/{id}` | Get Batch Request | `id` (path) | `member:MOIM:members:read` |

---

### Channels (Contents)

| Method | Endpoint | Operation | Key Parameters | Scopes |
|--------|----------|-----------|----------------|--------|
| POST | `/channels/{channelId}/contents` | Create Content | Body: `CreateContentDto` | `member:MOIM:content:write` |
| GET | `/channels/{channelId}/contents` | Get Contents | pagination | `member:MOIM:content:read` |
| GET | `/channels/{channelId}/contents/{contentId}` | Get Content | paths | `member:MOIM:content:read` |
| PUT | `/channels/{channelId}/contents/{contentId}` | Update Content | Body: `UpdateContentDto` | `member:MOIM:content:write` |
| DELETE | `/channels/{channelId}/contents/{contentId}` | Delete Content | paths | `member:MOIM:content:write` |
| POST | `/channels/{channelId}/contents/search` | Search Contents | Body: `ContentListQueryParams` | `member:MOIM:content:read` |
| POST | `/channels/{channelId}/contents/{contentId}/replies` | Create Reply | Body: `CreateReplyDto` | `member:MOIM:content:write` |
| GET | `/channels/{channelId}/contents/{contentId}/replies` | Get Replies | pagination, `parentReplyId` | `member:MOIM:content:read` |

---

### Products (상품 관리) ⭐

| Method | Endpoint | Operation | Key Parameters | Scopes |
|--------|----------|-----------|----------------|--------|
| POST | `/products` | Create Product | Body: `CreateProductDto` | `member:MOIM:product:write` |
| GET | `/products` | Get Products | `sellerId`, pagination | `member:MOIM:product:read` |
| GET | `/products/{productId}` | Get Product | `productId` (path) | `member:MOIM:product:read` |
| **PUT** | **`/products/{productId}`** | **Update Product** | Body: `UpdateProductDto` | `member:MOIM:product:write` |
| PUT | `/products/{productId}/product_variants` | Update Product Variants | Array of variant IDs | `member:MOIM:product:write` |
| DELETE | `/products/{productId}/product_variants` | Delete Product Variants | Array of variant IDs | `member:MOIM:product:write` |

#### PUT /products/{productId} - Request Headers
```
Authorization: Bearer {token}
x-can-community-id: {communityId}    ← 필수!
Content-Type: application/json
```

#### PUT /products/{productId} - Request Body (UpdateProductDto)
```json
{
  "name": "string",
  "price": 0,
  "stockCount": 0,
  "status": "scheduled | onSale | soldOut | completed",
  "isDisplayed": true,
  "description": "string",
  "images": {
    "mobile": ["url1", "url2"],
    "web": ["url1"]
  }
}
```

---

### Sellers

| Method | Endpoint | Operation | Parameters | Scopes |
|--------|----------|-----------|------------|--------|
| GET | `/sellers/{sellerId}` | Get Seller | `sellerId` (path) | `member:MOIM:product:read` |

---

### Payments & Subscriptions

| Method | Endpoint | Operation | Parameters | Scopes |
|--------|----------|-----------|------------|--------|
| GET | `/payments/{paymentId}` | Get Payment | `paymentId` (path) | `member:MOIM:payment:read` |
| GET | `/subscriptions/{subscriptionId}` | Get Subscription | `subscriptionId` (path) | `member:MOIM:payment:read` |

---

### Coupons

| Method | Endpoint | Operation | Body | Scopes |
|--------|----------|-----------|------|--------|
| POST | `/coupons/{couponId}/user_coupons` | Create User Coupon | `CreateUserCouponDto` | `member:MOIM:user-coupon:write` |

---

### Files

| Method | Endpoint | Operation | Content-Type | Scopes |
|--------|----------|-----------|--------------|--------|
| POST | `/files/private` | Create File Upload | `multipart/form-data` | `member:MOIM:file-private:write` |

---

### Positions (역할 관리)

| Method | Endpoint | Operation | Key Parameters | Scopes |
|--------|----------|-----------|----------------|--------|
| GET | `/positions` | Get Positions | pagination | `member:MOIM:position:read` |
| POST | `/positions` | Create Position | Body: `CreatePositionDto` | `member:MOIM:position:write` |
| GET | `/positions/{positionId}` | Get Position | path | `member:MOIM:position:read` |
| PUT | `/positions/{positionId}` | Update Position | Body: `UpdatePositionDto` | `member:MOIM:position:write` |
| DELETE | `/positions/{positionId}` | Delete Position | path | `member:MOIM:position:write` |
| GET | `/positions/{positionId}/members` | Get Position Members | pagination | `member:MOIM:position:read` |
| POST | `/positions/{positionId}/appoint` | Appoint Position | Body: `UserIdsDto` | `member:MOIM:position:write` |
| POST | `/positions/{positionId}/dismiss` | Dismiss Position | Body: `UserIdsDto` | `member:MOIM:position:write` |

---

### CanD (캔디/리워드)

| Method | Endpoint | Operation | Parameters | Scopes |
|--------|----------|-----------|------------|--------|
| GET | `/candies` | Get Community Candies | pagination | `member:MOIM:cand:read` |
| GET | `/candies/{candId}` | Get Cand | path | `member:MOIM:cand:read` |
| GET | `/candies/{candId}/balance` | Get Cand Balance | `userId`, `profileId` | `member:MOIM:cand:read` |
| POST | `/candies/{candId}/grant` | Grant Cand | Body: `CandGrantRequestDto` | `member:MOIM:cand:write` |
| POST | `/candies/{candId}/use` | Use Cand | Body: `CandUseRequestDto` | `member:MOIM:cand:write` |

---

### Conversations (DM)

| Method | Endpoint | Operation | Body | Scopes |
|--------|----------|-----------|------|--------|
| POST | `/direct_messages` | Create Direct Message | `CreateDirectMessageDto` | `member:MOIM:conversation:write` |
| GET | `/conversations/{conversationId}/messages` | Get Messages | pagination | `member:MOIM:conversation:read` |
| POST | `/conversations/{conversationId}/messages` | Post Message | `CreateMessageDto` | `member:MOIM:conversation:read` |
| GET | `/conversations/{conversationId}/messages/{messageId}` | Get Message | paths | `member:MOIM:conversation:read` |

---

### Embedding Templates

| Method | Endpoint | Operation | Parameters | Scopes |
|--------|----------|-----------|------------|--------|
| POST | `/embedding_templates` | Create Template | Body: `CreateEmbeddingTemplateDto` | `member:MOIM:content:write` |
| GET | `/embedding_templates/{id}` | Get Template | path | `member:MOIM:content:read` |
| PUT | `/embedding_templates/{id}` | Update Template | Body: `UpdateEmbeddingTemplateDto` | `member:MOIM:content:write` |

---

### Dashboard

| Method | Endpoint | Operation | Body | Scopes |
|--------|----------|-----------|------|--------|
| POST | `/dashboard/executions` | Run Query | `DashboardQueryRequestDto` | `member:MOIM:dashboard:read` |
| GET | `/dashboard/executions/{executionId}` | Get Execution | `next` token (query) | `member:MOIM:dashboard:read` |

---

### Webhook

| Method | Endpoint | Operation | Parameters |
|--------|----------|-----------|------------|
| POST | `/webhook/event` | Event | Header: `x-can-module-key`, Body: `WebhookRequestDto` |

---

## 핵심 헤더 요약

| Header | 용도 | 비고 |
|--------|------|------|
| `Authorization` | Bearer 토큰 인증 | CANpass OAuth2 토큰 |
| `x-can-community-id` | 대상 커뮤니티 식별 | **유효한 communityId 필수** - 잘못된 값 시 400 에러 |
| `x-can-profile-id` | 사용자 프로필 식별 | 셀러/관리자 프로필 ID |
| `x-can-internal-api-key` | 내부 API 인증 | 내부 전용 엔드포인트 |
| `x-can-module-key` | 모듈 인증 | Webhook 전용 |
| `Content-Type` | 콘텐츠 타입 | `application/json` (기본) |
