# canD API Documentation

> Base URL: `https://api.cand.xyz`
> Auth: OAuth2 (CANpass) — Bearer token + `x-can-community-id` header 필수

---

## 인증 (Authentication)

모든 API 요청에 다음 헤더가 필요합니다:

```
Authorization: Bearer {access_token}
x-can-community-id: {community_id}
```

상품 수정 시 추가 헤더:
```
x-can-profile-id: {seller_profile_id}
```

---

## Products (상품)

### POST /products — 상품 생성

- **Scopes**: `member:MOIM:product:write`
- **Request Body**: `CreateProductDto`
- **Response**: `ProductDto` (201)

### GET /products — 상품 목록 조회

- **Scopes**: `member:MOIM:product:read`
- **Query Parameters**:

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `after` | string | - | 페이지네이션 커서 토큰 |
| `limit` | string | - | 최대 결과 수 |
| `sort` | string | - | 정렬 기준 필드 |
| `order` | enum | - | `ASC` \| `DESC` |
| `sellerId` | string | - | 특정 판매자 ID로 필터링 |

- **Response**: `{ paging: { after?: string }, data: ProductDto[] }`

### GET /products/{productId} — 상품 단건 조회

- **Scopes**: `member:MOIM:product:read`
- **Path Parameters**: `productId` (string, required)
- **Response**: `ProductDto`

### PUT /products/{productId} — 상품 수정

- **Scopes**: `member:MOIM:product:write`
- **Path Parameters**: `productId` (string, required)
- **Request Body**: `UpdateProductDto` (모든 필드 선택적)
- **Response**: `ProductDto` (200)

---

## Product Variants (상품 옵션)

### PUT /products/{productId}/product_variants — 옵션 수정

- **Scopes**: `member:MOIM:product:write`
- **Request Body**: `string[]`
- **Response**: `ProductVariantDto` (200)

### DELETE /products/{productId}/product_variants — 옵션 삭제

- **Scopes**: `member:MOIM:product:write`
- **Request Body**: `string[]`
- **Response**: 200 OK

---

## Sellers (판매자)

### GET /sellers/{sellerId} — 판매자 정보 조회

- **Scopes**: `member:MOIM:product:read`
- **Path Parameters**: `sellerId` (string, required)
- **Response**: `SellerDto`

---

## Payments (결제)

### GET /payments/{paymentId} — 결제 조회

- **Scopes**: `member:MOIM:payment:read`
- **Response**: `PaymentDto`

### GET /subscriptions/{subscriptionId} — 구독 조회

- **Scopes**: `member:MOIM:payment:read`
- **Response**: `SubscriptionDto`

---

## Users (사용자)

### GET /me — 내 정보 조회

- **Scopes**: 없음 (공개)
- **Response**: `MeDto`

### GET /me/payment — 내 결제 정보

- **Scopes**: 없음
- **Response**: `MePaymentDto`

### GET /me/communities — 내 커뮤니티 목록

- **Scopes**: 없음
- **Response**: `CommunityDto[]` (페이지네이션)

### GET /users — 사용자 목록 조회

- **Scopes**: `member:MOIM:members:read`
- **Query Parameters**: `after`, `limit`, `sort`, `order`
- **Response**: `UserDto[]` (페이지네이션)

### GET /users/{userId} — 사용자 단건 조회

- **Scopes**: `member:MOIM:members:read`
- **Response**: `UserDto`

### POST /users/bulk — 사용자 일괄 조회

- **Scopes**: `member:MOIM:members:read`
- **Request Body**: `{ ids: string[] }`
- **Response**: `UserDto[]`

### GET /users/{userId}/form_response — 사용자 폼 응답

- **Scopes**: `member:MOIM:members:read`
- **Response**: `UserFormResponseItemDto[]`

### GET /users/contents — 내 콘텐츠 목록

- **Scopes**: `member:MOIM:members:read`, `member:MOIM:content:read`
- **Response**: `ContentDto[]` (페이지네이션)

### GET /users/replies — 내 댓글 목록

- **Scopes**: `member:MOIM:members:read`, `member:MOIM:content:read`
- **Response**: `ReplyDto[]` (페이지네이션)

### GET /users/reviews — 내 리뷰 목록

- **Scopes**: `member:MOIM:members:read`, `member:MOIM:content:read`
- **Response**: `ReviewDto[]` (페이지네이션)

---

## Channels / Content (채널 / 콘텐츠)

### POST /channels/{channelId}/contents — 콘텐츠 생성

- **Scopes**: `member:MOIM:content:write`
- **Request Body**: `CreateContentDto`
- **Response**: `ContentDto`

### GET /channels/{channelId}/contents — 콘텐츠 목록

- **Scopes**: `member:MOIM:content:read`
- **Query Parameters**: `after`, `limit`, `sort`, `order`
- **Response**: `ContentDto[]` (페이지네이션)

### GET /channels/{channelId}/contents/{contentId} — 콘텐츠 단건 조회

- **Scopes**: `member:MOIM:content:read`
- **Response**: `ContentDto`

### PUT /channels/{channelId}/contents/{contentId} — 콘텐츠 수정

- **Scopes**: `member:MOIM:content:write`
- **Request Body**: `UpdateContentDto`
- **Response**: `ContentDto`

### DELETE /channels/{channelId}/contents/{contentId} — 콘텐츠 삭제

- **Scopes**: `member:MOIM:content:write`
- **Response**: 200 OK

### POST /channels/{channelId}/contents/search — 콘텐츠 검색

- **Scopes**: `member:MOIM:content:read`
- **Request Body**: `ContentListQueryParams`
- **Response**: `ContentDto`

---

## Replies (댓글)

### POST /channels/{channelId}/contents/{contentId}/replies — 댓글 생성

- **Scopes**: `member:MOIM:content:write`
- **Request Body**: `CreateReplyDto`
- **Response**: `ReplyDto`

### GET /channels/{channelId}/contents/{contentId}/replies — 댓글 목록

- **Scopes**: `member:MOIM:content:read`
- **Query Parameters**: `after`, `limit`, `sort`, `order`, `parentReplyId`
- **Response**: `ReplyDto[]` (페이지네이션)

---

## Coupons (쿠폰)

### POST /coupons/{couponId}/user_coupons — 사용자 쿠폰 생성

- **Scopes**: `member:MOIM:user-coupon:write`
- **Request Body**: `CreateUserCouponDto`
- **Response**: 200/201

---

## Files (파일)

### POST /files/private — 파일 업로드

- **Scopes**: `member:MOIM:file-private:write`
- **Content-Type**: `multipart/form-data`
- **Request Body**: `file` (binary)
- **Response**: `PrivateFileDto` (201)

---

## Positions (직책)

### GET /positions — 직책 목록

- **Scopes**: `member:MOIM:position:read`
- **Query Parameters**: `after`, `limit`, `sort`, `order`
- **Response**: `PositionDto[]`

### POST /positions — 직책 생성

- **Scopes**: `member:MOIM:position:write`
- **Request Body**: `CreatePositionDto`
- **Response**: `PositionDto` (201)

### GET /positions/{positionId} — 직책 조회

### PUT /positions/{positionId} — 직책 수정

### DELETE /positions/{positionId} — 직책 삭제

### GET /positions/{positionId}/members — 직책 멤버 목록

### POST /positions/{positionId}/appoint — 직책 임명

- **Request Body**: `{ userIds: string[] }`

### POST /positions/{positionId}/dismiss — 직책 해임

- **Request Body**: `{ userIds: string[] }`

---

## CanD (커뮤니티 화폐)

### GET /candies — 화폐 목록

- **Scopes**: `member:MOIM:cand:read`
- **Response**: `CandDto[]`

### GET /candies/{candId} — 화폐 조회

### GET /candies/{candId}/balance — 잔액 조회

- **Query Parameters**: `userId` (required), `profileId` (required)
- **Response**: `CandBalanceDto`

### POST /candies/{candId}/grant — 화폐 지급

- **Scopes**: `member:MOIM:cand:write`
- **Request Body**: `CandGrantRequestDto`

### POST /candies/{candId}/use — 화폐 사용

- **Scopes**: `member:MOIM:cand:write`
- **Request Body**: `CandUseRequestDto`

---

## Conversations (대화)

### POST /direct_messages — DM 생성

- **Scopes**: `member:MOIM:conversation:write`
- **Request Body**: `CreateDirectMessageDto`
- **Response**: `ConversationDto`

### GET /conversations/{conversationId}/messages — 메시지 목록

- **Scopes**: `member:MOIM:conversation:read`
- **Response**: `MessageDto[]`

### POST /conversations/{conversationId}/messages — 메시지 전송

- **Request Body**: `CreateMessageDto`
- **Response**: `MessageDto`

### GET /conversations/{conversationId}/messages/{messageId} — 메시지 조회

---

## Communities (커뮤니티)

### GET /communities/{communityId} — 커뮤니티 조회

- **Scopes**: 없음
- **Response**: `CommunityDto`

### GET /communities/{communityId}/child_communities — 하위 커뮤니티

- **Query Parameters**: `after`, `limit`, `sort`, `order`

### POST /communities/{communityId}/child_communities/search — 하위 커뮤니티 검색

- **Request Body**: `SearchCommunityRequestDto`

---

## Dashboard (대시보드)

### POST /dashboard/executions — 쿼리 실행

- **Scopes**: `member:MOIM:dashboard:read`
- **Request Body**: `DashboardQueryRequestDto`
- **Response**: `DashboardExecutionDto`

### GET /dashboard/executions/{executionId} — 실행 결과

- **Query Parameters**: `next` (pagination token)

---

## Embedding Templates (임베딩 템플릿)

### GET /embedding_templates/{id} — 조회

### POST /embedding_templates — 생성

### PUT /embedding_templates/{id} — 수정

---

## Batch Requests (일괄 요청)

### POST /batch_requests/users — 사용자 일괄 처리

- **Scopes**: `member:MOIM:members:write`
- **Request Body**: `CreateUserBatchRequestDto`
- **Response**: `BatchRequestResultDto`

### GET /batch_requests/users/{id} — 일괄 처리 결과 조회

---

## Data Models (데이터 모델)

### ProductDto

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | O | 상품 고유 ID |
| `type` | enum | O | `normal` \| `subscription` \| `fund` |
| `parentSellerId` | string | O | 허브 판매자 ID |
| `sellerId` | string | O | 서브 판매자 ID |
| `categoryIds` | string[] | O | 카테고리 ID 목록 |
| `accountIds` | string[] | O | PG 계정 ID 목록 |
| `userId` | string | O | 생성자 사용자 ID |
| `name` | string | O | 상품명 |
| `images` | ImageDto | O | 이미지 (mobile/web) |
| `blocks` | Block[] | O | 상세 콘텐츠 블록 |
| `currency` | string | O | 통화 코드 |
| `createdAt` | number | O | 생성 타임스탬프 (ms) |
| `updatedAt` | number | O | 수정 타임스탬프 (ms) |
| `soldCount` | number | O | 판매 수량 |
| `soldAmount` | number | O | 총 판매 금액 |
| `buyersCount` | number | O | 구매자 수 |
| `status` | enum | O | `scheduled` \| `onSale` \| `soldOut` \| `completed` |
| `deliveryType` | enum | O | `online` \| `deliveryOnly` \| `pickUpOnly` \| `all` |
| `isDisplayed` | boolean | O | 진열 여부 |
| `price` | number | O | 판매가 |
| `normalPrice` | number | O | 정상가 |
| `supplyPrice` | string | - | 공급가 |
| `originalPrice` | number | - | 소비자가 |
| `shippingFee` | number | - | 배송비 |
| `description` | string | - | 짧은 설명 |
| `options` | OptionDto[] | - | 상품 옵션 |
| `primaryDetails` | DetailDto[] | - | 원산지, 제조사 등 |
| `details` | DetailDto[] | - | 브랜드, 모델 등 |
| `sku` | string | - | 재고관리코드 |
| `hsCode` | string | - | 관세코드 |
| `returnReplacementPolicy` | string | - | 교환/반품 정책 |
| `deliveryGroupId` | string | - | 배송 그룹 ID |
| `deliveryPolicies` | DeliveryPolicyDto[] | - | 배송비 정책 |
| `weight` | number | - | 무게 (kg) |
| `stockCount` | number | - | 재고 수량 |
| `productVariants` | ProductVariantDto[] | - | 상품 옵션 조합 |

### CreateProductDto / UpdateProductDto

| 필드 | 타입 | 생성 시 필수 | 수정 시 필수 | 설명 |
|------|------|:---:|:---:|------|
| `name` | string | O | - | 상품명 |
| `type` | enum | O | - | `normal` \| `subscription` \| `fund` |
| `isDisplayed` | boolean | O | - | 진열 여부 |
| `blocks` | Block[] | O | - | 상세 콘텐츠 블록 |
| `images` | CreateProductImageDto | O | - | `{ mobile: string[], web?: string[] }` |
| `status` | enum | O | - | `scheduled` \| `onSale` \| `soldOut` \| `completed` |
| `price` | number | O | - | 판매가 |
| `sellerId` | string | - | - | 서브 판매자 ID |
| `normalPrice` | number | - | - | 정상가 |
| `originalPrice` | number | - | - | 소비자가 |
| `supplyPrice` | number | - | - | 공급가 |
| `description` | string | - | - | 짧은 설명 |
| `categoryIds` | string[] | - | - | 카테고리 ID |
| `primaryDetails` | DetailDto[] | - | - | 원산지, 제조사 |
| `details` | DetailDto[] | - | - | 브랜드, 모델 |
| `sku` | string | - | - | 재고관리코드 |
| `options` | CreateProductOptionDto[] | - | - | 옵션 (사이즈, 색상) |
| `stockCount` | number | - | - | 재고 수량 |
| `weight` | number | - | - | 무게 (kg) |
| `hsCode` | string | - | - | 관세코드 |
| `deliveryGroupId` | string | - | - | 배송 그룹 ID |
| `deliveryPolicies` | DeliveryPolicyDto[] | - | - | 배송비 정책 |
| `shippingFee` | number | - | - | 배송비 |
| `returnReplacementPolicy` | string | - | - | 교환/반품 정책 |

### ProductVariantDto

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | O | 옵션 조합 ID |
| `productId` | string | O | 상품 ID |
| `values` | object | O | 옵션 값 (key-value) |
| `soldCount` | number | O | 판매 수량 |
| `price` | number | O | 가격 |
| `originalPrice` | number | O | 소비자가 |
| `normalPrice` | number | O | 정상가 |
| `supplyPrice` | number | - | 공급가 |
| `shippingFee` | number | - | 배송비 |
| `status` | enum | O | `onSale` \| `soldOut` \| `disabled` |
| `weight` | number | - | 무게 |
| `sku` | string | - | 재고관리코드 |
| `hsCode` | string | - | 관세코드 |
| `currency` | string | O | 통화 |
| `createdAt` | number | O | 생성 타임스탬프 |
| `updatedAt` | number | O | 수정 타임스탬프 |

### PaymentDto

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | - | 결제 ID |
| `userId` | string | - | 사용자 ID |
| `profileId` | string | - | 프로필 ID |
| `sellerId` | string | - | 판매자 ID |
| `type` | enum | - | `normal` \| `fund` \| `candy` |
| `status` | enum | - | `created` \| `paid` \| `cancelled` \| `refunded` 등 |
| `purchases` | PurchaseDto[] | - | 구매 목록 |
| `amount` | number | O | 결제 금액 |
| `refundedAmount` | number | O | 환불 금액 |
| `currency` | string | - | 통화 |
| `buyerName` | string | O | 구매자명 |
| `buyerEmail` | string | O | 구매자 이메일 |
| `buyerPhoneNumber` | string | O | 구매자 전화번호 |
| `createdAt` | number | - | 생성 시각 |
| `paidAt` | number | - | 결제 시각 |

### ImageDto / CreateProductImageDto

```json
// ImageDto (응답)
{
  "mobile": [{ "url": "...", "src": "...", "srcXs": "...", ... }],
  "web": [{ "url": "...", "src": "...", "srcXs": "...", ... }]
}

// CreateProductImageDto (요청)
{
  "mobile": ["https://...image1.jpg", "https://...image2.jpg"],
  "web": ["https://...image1.jpg"]
}
```

### DetailDto

```json
{ "key": "원산지", "value": "대한민국" }
```

### DeliveryPolicyDto

```json
{
  "type": "priceList",
  "name": "기본 배송",
  "priceList": [
    { "gte": 0, "lte": 50000, "price": 3000 },
    { "gte": 50000, "price": 0 }
  ]
}
```

---

## 상태 코드

| 코드 | 의미 |
|------|------|
| 200 | 성공 (조회/수정) |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 (`ErrorResponseDto`) |
| 401 | 인증 실패 |
| 403 | 권한 없음 (scope 부족 또는 보호된 필드 수정 시도) |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |
