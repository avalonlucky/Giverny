# Giverny

<p align="center">
  <img src="./public/giverny-logo.png" alt="Giverny logo" width="96" />
</p>

<p align="center">
  <strong>フリーランスデザイナーと小規模デザインチーム向けの、タスク・工数・ファイル・検収・月次決済プラットフォーム。</strong>
</p>

<p align="center">
  <a href="./README.md">简体中文</a>
  ·
  <a href="./README.zh-TW.md">繁體中文</a>
  ·
  <a href="./README.en.md">English</a>
  ·
  日本語
  ·
  <a href="./README.ko.md">한국어</a>
</p>

> 一言で：チャットにある要件、Excel の工数、クラウド上のファイル、月末の手作業決済を、受注から検収・決済まで追跡できる一本の流れにまとめます。

![Giverny dashboard screenshot](./docs/assets/readme/screenshots/dashboard.png)

## これは何か？

Giverny はフリーランスデザイン業務の運用ワークベンチです。タスク要件、進捗、実工数、過程ファイル、検収添付、月次決済、クライアント向け読み取り専用リンクを一つのシステムにまとめます。

本番サイト [mayeai.com](https://mayeai.com) で運用され、Cloudflare D1 に業務データ、Cloudflare R2 にアップロードファイルを保存します。

Giverny は汎用プロジェクト管理ツールではありません。デザイン納品、検収、決済、照合に特化したデザインサービス決済ワークベンチです。

```text
要件 -> 進捗 -> 工数記録 -> ファイル保管 -> 検収 -> 月次決済 -> クライアント読み取り専用照合
```

## なぜ Notion / Feishu / Excel ではないのか？

これらのツールは情報を保存できますが、進捗、実工数、添付、検収、決済、クライアントリンクを監査可能な一本の流れとして安定して繋ぐことは難しいです。

月末には、チャットから要件を探し、表計算で工数を計算し、クラウドから最終稿を探し、請求金額を手作業で説明することになりがちです。Giverny はこの流れを追跡可能にするためのツールです。

## コアワークフロー

1. タスク名、デザイン種別、要件、予定開始、予定納品、担当者、決済月を入力してタスクを作成。
2. タスク詳細で進捗を記録し、過程添付をアップロードし、分割工数を追加。
3. すべての分析、収入、決済は実工数を基準にする。予定開始と予定納品はスケジュール参考のみ。
4. 納品時に基本情報、進捗、分割工数、検収添付、備考を確認。
5. 検収後、ステータスは検収済み、進捗は 100% にロックされ、実工数が決済に入る。
6. 月次決済とクライアント向け読み取り専用リンクを生成。

## 実際のプロダクトスクリーンショット

### ダッシュボード

![Giverny dashboard screenshot](./docs/assets/readme/screenshots/dashboard.png)

### タスク

![Giverny tasks screenshot](./docs/assets/readme/screenshots/tasks.png)

### 収入

![Giverny income screenshot](./docs/assets/readme/screenshots/income.png)

## 主要ルール

- 月の帰属は `settlement_month` のみで決まる。
- 実工数が分析、収入、決済の唯一の根拠。
- 予定開始と予定納品はスケジュール参考のみ。
- 補錄はクライアントにも見える公開説明タグ。
- 管理者専用情報は茶色の `admin-only-data` で表示し、クライアントページには表示しない。
- タスクは直接削除しない。工数、収入、月報、過去の照合に影響するため。

## 技術スタック

- Frontend: React 19 + TypeScript + Vite
- Styles: single-file `src/App.css`
- Backend: Cloudflare Worker
- Database: Cloudflare D1
- Files: Cloudflare R2
- Deploy: Wrangler, production domain `mayeai.com`

## ローカル開発

```bash
npm install
npm run dev
npm run lint
npm run build
```

## リリースルール

本番更新では必ず以下を行います。

1. `src/config/appConfig.ts` と `package.json` のバージョン更新。
2. `CHANGELOG.md` と関連ドキュメントの更新。
3. `npm run lint` と `npm run build`。
4. 本番デプロイとオンライン検証。
5. コミット、tag の push、GitHub Release 作成。
6. UI 変更がある場合は Release にスクリーンショットを添付。

