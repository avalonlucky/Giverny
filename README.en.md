# Giverny

<p align="center">
  <img src="./public/giverny-logo.png" alt="Giverny logo" width="96" />
</p>

<p align="center">
  <strong>A task, time-tracking, file, acceptance and monthly settlement platform for freelance designers and small design teams.</strong>
</p>

<p align="center">
  <a href="./README.md">简体中文</a>
  ·
  <a href="./README.zh-TW.md">繁體中文</a>
  ·
  English
  ·
  <a href="./README.ja.md">日本語</a>
  ·
  <a href="./README.ko.md">한국어</a>
</p>

> In short: Giverny turns the scattered freelance design workflow — requirements in chat, hours in Excel, files in cloud drives and manual month-end accounting — into one traceable pipeline from intake to acceptance and settlement.

![Giverny dashboard screenshot](./docs/assets/readme/screenshots/dashboard.png)

## What Is Giverny?

Giverny is a freelance design operations workbench. It connects task requirements, progress, actual hours, process files, acceptance attachments, monthly settlement and client read-only reconciliation links in one system.

It powers the production site [mayeai.com](https://mayeai.com), using Cloudflare D1 for business data and Cloudflare R2 for uploaded files.

Giverny is not a generic project management tool. It is closer to a design-service settlement workbench: it focuses on the full chain from design delivery to acceptance, settlement and reconciliation.

```text
Request -> Progress -> Time log -> File archive -> Acceptance -> Monthly settlement -> Client read-only reconciliation
```

## Why Not Notion / Feishu / Excel?

Those tools can store information, but they do not reliably connect task progress, actual hours, attachments, acceptance, settlement and client links into one auditable chain.

At month-end, freelance design work often still requires digging through chats for requirements, calculating hours in spreadsheets, searching for final files and manually explaining settlement amounts to the client. Giverny is built specifically to make that chain traceable.

## Core Workflow

1. Create a task with name, design type, requirement, planned start, planned delivery, contact person and settlement month.
2. Track progress in the task detail panel, upload process attachments and add segmented time records.
3. Use actual hours as the only source for analytics, income and settlement. Planned start and planned delivery are scheduling references only.
4. Run final acceptance by reviewing basic information, progress, segmented hours, acceptance files and notes.
5. After acceptance, the task becomes accepted, progress is locked to 100%, and actual hours enter settlement.
6. Generate monthly settlement reports and read-only client reconciliation links.

## Product Screenshots

### Dashboard

![Giverny dashboard screenshot](./docs/assets/readme/screenshots/dashboard.png)

### Tasks

![Giverny tasks screenshot](./docs/assets/readme/screenshots/tasks.png)

### Income

![Giverny income screenshot](./docs/assets/readme/screenshots/income.png)

## Key Business Rules

- Month ownership is determined by `settlement_month`.
- Actual hours are the only basis for analytics, income and settlement.
- Planned start and planned delivery are only scheduling references.
- Supplemental tasks are public explanation tags, visible to clients.
- Admin-only information is marked with the brown `admin-only-data` style and is hidden from client read-only views.
- Tasks should not be directly deleted because they affect hours, income, reports and historical reconciliation.

## Tech Stack

- Frontend: React 19 + TypeScript + Vite
- Styles: single-file `src/App.css`
- Backend: Cloudflare Worker
- Database: Cloudflare D1
- Files: Cloudflare R2
- Deployment: Wrangler, production domain `mayeai.com`

## Local Development

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Release Discipline

Every production update must include:

1. Version bump in `src/config/appConfig.ts` and `package.json`.
2. `CHANGELOG.md` and related documentation updates.
3. `npm run lint` and `npm run build`.
4. Production deployment and online verification.
5. Git commit, pushed tag and GitHub Release.
6. Screenshots or assets attached to the Release when UI changes are visible.

