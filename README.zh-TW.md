# Giverny

<p align="center">
  <img src="./public/giverny-logo.png" alt="Giverny logo" width="96" />
</p>

<p align="center">
  <strong>面向兼職設計師與輕量設計團隊的任務、工時、檔案、驗收與月度結算平台。</strong>
</p>

<p align="center">
  <a href="./README.md">简体中文</a>
  ·
  繁體中文
  ·
  <a href="./README.en.md">English</a>
  ·
  <a href="./README.ja.md">日本語</a>
  ·
  <a href="./README.ko.md">한국어</a>
</p>

> 一句話：把「需求在微信、工時在 Excel、檔案在網盤、月底手工做帳」的兼職設計工作，收斂成一條可追溯的鏈路，從接需求到驗收結算，全在一個系統裡。

![Giverny 工作台真實截圖](./docs/assets/readme/screenshots/dashboard.png)

## 這是什麼？

Giverny 是一個設計兼職營運工作台。它把任務需求、過程進展、實際工時、過程檔案、驗收附件、月度結算和甲方唯讀對帳連結放在同一個系統裡。

它服務於正式站 [mayeai.com](https://mayeai.com)，使用 Cloudflare D1 保存業務資料，使用 Cloudflare R2 保存上傳檔案。

Giverny 不是泛用專案管理工具。它更像是一個設計服務結算工作台，專門處理設計交付、驗收、結算和對帳這條鏈路。

```text
任務需求 -> 過程進展 -> 時間記錄 -> 檔案歸檔 -> 交付驗收 -> 月度結算 -> 甲方唯讀對帳
```

## 為什麼不用 Notion / 飛書 / Excel？

這些工具可以記錄資訊，但很難把任務進展、實際工時、附件、驗收、結算和甲方連結穩定串成一條可稽核鏈路。

到月底時，兼職設計工作往往還需要翻聊天記錄找需求、在表格裡算工時、去網盤找最終稿，再手工向甲方解釋結算金額。Giverny 的目標就是讓這條鏈路可追溯。

## 核心工作流

1. 新建任務，填寫任務名稱、設計類型、需求、預計開始、預計交付、對接人和結算月份。
2. 在任務詳情面板記錄進展，上傳過程附件，追加分段工時。
3. 所有統計以實際工時為準；預計開始和預計交付只作為排期參考。
4. 交付時進行終審驗收，核對基礎資訊、進度、分段工時、驗收附件和備註。
5. 驗收後狀態變為已驗收，進度鎖定 100%，實際工時計入結算。
6. 生成月度結算和甲方唯讀對帳連結。

## 真實產品截圖

### 工作台

![Giverny 工作台真實截圖](./docs/assets/readme/screenshots/dashboard.png)

### 任務導航

![Giverny 任務導航真實截圖](./docs/assets/readme/screenshots/tasks.png)

### 收入

![Giverny 收入頁真實截圖](./docs/assets/readme/screenshots/income.png)

## 關鍵業務規則

- 月份歸屬只看 `settlement_month`。
- 實際工時是分析、收入和結算的唯一依據。
- 預計開始和預計交付只用於排期參考。
- 補錄是公開解釋標記，必須讓甲方可見。
- 管理員專屬資訊使用棕色 `admin-only-data`，甲方唯讀頁不顯示。
- 任務不應直接刪除，因為會影響工時、收入、月報和歷史對帳。

## 技術棧

- 前端：React 19 + TypeScript + Vite
- 樣式：單檔 `src/App.css`
- 後端：Cloudflare Worker
- 資料庫：Cloudflare D1
- 檔案：Cloudflare R2
- 部署：Wrangler，正式域名 `mayeai.com`

## 本地開發

```bash
npm install
npm run dev
npm run lint
npm run build
```

## 發布紀律

每次正式更新都必須完成：

1. 更新 `src/config/appConfig.ts` 和 `package.json` 的版本號。
2. 更新 `CHANGELOG.md` 和相關文件。
3. 執行 `npm run lint` 和 `npm run build`。
4. 部署正式站並驗證線上版本。
5. 提交程式碼、推送 tag、建立 GitHub Release。
6. UI 變化明顯時，在 Release 附上截圖或資產。

