# CLAUDE.md — cand-scheduler

## 프로젝트 개요

VAKE Commerce Workspace의 상품 관리 및 스케줄링 대시보드.
OAuth2(CANpass) 인증 기반으로 상품 상태 예약 변경, 실시간 모니터링을 제공합니다.

- **스택**: React 19 + Vite 7 + Tailwind CSS v4
- **배포**: Vercel (프론트엔드 + 서버리스 프록시)
- **스케줄러**: AWS Lambda + EventBridge

## API 참조

- **canD API 공식 문서**: https://api.cand.xyz/docs
- **프로젝트 API 문서**: [API_DOCS.md](./API_DOCS.md) — 전체 엔드포인트, 파라미터, 스키마 정리
- **Swagger JSON**: https://api.cand.xyz/docs/swagger.json

### API 개발 시 주의사항

1. 모든 API 요청에 `Authorization: Bearer {token}` + `x-can-community-id` 헤더 필수
2. 상품 수정(PUT) 시 `x-can-profile-id` 헤더 추가 필요 (403 방지)
3. 상품 수정 시 `sellerId`, `type` 등 보호된 필드를 전송하면 400 에러 발생
4. CORS 우회를 위해 Vercel 서버리스 프록시(`api/proxy.js`) 경유
5. 이미지 필드는 요청 시 `{ mobile: string[], web: string[] }`, 응답 시 `{ mobile: ImageItemDto[], web: ImageItemDto[] }` 형식 차이 주의

## 프로젝트 구조

```
src/
├── App.jsx              # 오케스트레이터 (hooks 호출 + 레이아웃 조합)
├── constants/           # 설정값 (API URL, 스타일 상수)
├── utils/               # 유틸리티 (PKCE, 날짜, 상태 번역)
├── api/                 # API 호출 레이어 (scheduler, products, auth)
├── hooks/               # 커스텀 훅 (useAuth, useProducts, useTasks 등)
├── components/          # 공용 UI (GlassSelect, Sidebar, Header 등)
├── pages/               # 화면별 페이지 (Login, ProductList, Schedule, History, Settings)
└── modals/              # 모달 (ProductEdit, ScheduleConfirm, TaskEdit)
api/
├── proxy.js             # Vercel 서버리스 CORS 프록시
└── token.js             # OAuth 토큰 교환 프록시
```

## 개발 명령어

```bash
npm run dev      # 개발 서버 (localhost:5173)
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기 (localhost:4173)
npm run lint     # ESLint 검사
```

## 핵심 설정

- **Community ID**: `G0IZUDWCL`
- **OAuth Client ID**: `4582f19ca0325304d27abbd18a36b21b`
- **Scheduler API**: AWS Lambda (`https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule`)
- **Backend Proxy**: Vercel (`https://cand-scheduler.vercel.app`)
