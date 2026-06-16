# Giverny

<p align="center">
  <img src="./public/giverny-logo.png" alt="Giverny logo" width="96" />
</p>

<p align="center">
  <strong>프리랜서 디자이너와 소규모 디자인 팀을 위한 작업, 공수, 파일, 검수 및 월간 정산 플랫폼.</strong>
</p>

<p align="center">
  <a href="./README.md">简体中文</a>
  ·
  <a href="./README.zh-TW.md">繁體中文</a>
  ·
  <a href="./README.en.md">English</a>
  ·
  <a href="./README.ja.md">日本語</a>
  ·
  한국어
</p>

> 한마디로: 채팅에 흩어진 요구사항, Excel의 공수, 클라우드의 파일, 월말 수작업 정산을 요청부터 검수와 정산까지 추적 가능한 하나의 흐름으로 묶습니다.

![Giverny dashboard screenshot](./docs/assets/readme/screenshots/dashboard.png)

## 이것은 무엇인가?

Giverny는 프리랜스 디자인 업무 운영 워크벤치입니다. 작업 요구사항, 진행 상황, 실제 공수, 과정 파일, 검수 첨부, 월간 정산, 클라이언트 읽기 전용 대사 링크를 하나의 시스템에 연결합니다.

프로덕션 사이트 [mayeai.com](https://mayeai.com)에서 운영되며, Cloudflare D1에 업무 데이터를 저장하고 Cloudflare R2에 업로드 파일을 저장합니다.

Giverny는 범용 프로젝트 관리 도구가 아닙니다. 디자인 납품, 검수, 정산, 대사에 특화된 디자인 서비스 정산 워크벤치입니다.

```text
요구사항 -> 진행 -> 시간 기록 -> 파일 보관 -> 검수 -> 월간 정산 -> 클라이언트 읽기 전용 대사
```

## 왜 Notion / Feishu / Excel이 아닌가?

이 도구들은 정보를 저장할 수 있지만, 진행 상황, 실제 공수, 첨부, 검수, 정산, 클라이언트 링크를 하나의 감사 가능한 흐름으로 안정적으로 연결하기 어렵습니다.

월말에는 채팅에서 요구사항을 찾고, 표에서 공수를 계산하고, 클라우드에서 최종 파일을 찾고, 정산 금액을 수작업으로 설명해야 하는 경우가 많습니다. Giverny는 이 흐름을 추적 가능하게 만들기 위한 도구입니다.

## 핵심 워크플로우

1. 작업명, 디자인 유형, 요구사항, 예정 시작, 예정 납품, 담당자, 정산 월을 입력해 작업을 생성합니다.
2. 작업 상세에서 진행을 기록하고, 과정 첨부를 업로드하고, 분할 공수를 추가합니다.
3. 모든 분석, 수입, 정산은 실제 공수를 기준으로 합니다. 예정 시작과 예정 납품은 일정 참고용입니다.
4. 납품 시 기본 정보, 진행률, 분할 공수, 검수 첨부, 비고를 확인합니다.
5. 검수 후 상태는 검수 완료가 되고, 진행률은 100%로 잠기며, 실제 공수가 정산에 포함됩니다.
6. 월간 정산과 클라이언트 읽기 전용 대사 링크를 생성합니다.

## 실제 제품 스크린샷

### 대시보드

![Giverny dashboard screenshot](./docs/assets/readme/screenshots/dashboard.png)

### 작업

![Giverny tasks screenshot](./docs/assets/readme/screenshots/tasks.png)

### 수입

![Giverny income screenshot](./docs/assets/readme/screenshots/income.png)

## 핵심 비즈니스 규칙

- 월 귀속은 `settlement_month`로만 결정됩니다.
- 실제 공수가 분석, 수입, 정산의 유일한 기준입니다.
- 예정 시작과 예정 납품은 일정 참고용입니다.
- 보충 기록은 클라이언트에게도 보이는 공개 설명 태그입니다.
- 관리자 전용 정보는 갈색 `admin-only-data`로 표시하며, 클라이언트 읽기 전용 페이지에는 표시하지 않습니다.
- 작업은 직접 삭제하지 않습니다. 공수, 수입, 월간 보고서, 과거 대사에 영향을 주기 때문입니다.

## 기술 스택

- Frontend: React 19 + TypeScript + Vite
- Styles: single-file `src/App.css`
- Backend: Cloudflare Worker
- Database: Cloudflare D1
- Files: Cloudflare R2
- Deploy: Wrangler, production domain `mayeai.com`

## 로컬 개발

```bash
npm install
npm run dev
npm run lint
npm run build
```

## 릴리스 규칙

프로덕션 업데이트마다 반드시 다음을 완료합니다.

1. `src/config/appConfig.ts`와 `package.json` 버전 업데이트.
2. `CHANGELOG.md`와 관련 문서 업데이트.
3. `npm run lint`와 `npm run build`.
4. 프로덕션 배포와 온라인 검증.
5. 커밋, tag push, GitHub Release 생성.
6. UI 변경이 있으면 Release에 스크린샷 첨부.

