# 這週去哪玩（kidtrip）

幫有 0–6 歲小孩的家庭，每週五分鐘內決定週末去哪玩。規格見 [`docs/PRD.md`](docs/PRD.md)，開發規則見 [`AGENTS.md`](AGENTS.md)。

## 需求

- Node.js 22.18 以上（`validate:data` 直接用 Node 執行 TypeScript）

## 常用指令

```bash
npm install          # 安裝套件
npm run dev          # 開發伺服器，預設 http://localhost:5173
npm run lint         # ESLint
npm run typecheck    # TypeScript 型別檢查
npm test             # Vitest 單元測試
npm run validate:data  # 用 zod 檢查 data/spots.json、data/hotels.json
npm run build        # 正式建置到 dist/
```

## 資料

- `data/spots.json`、`data/hotels.json` 是景點、飯店的唯一資料來源，格式定義在 `src/data/schema.ts`（依 PRD 第 7 節）。
- 改完資料先跑 `npm run validate:data`，有錯會列出 id、欄位與原因，結束碼非 0。
