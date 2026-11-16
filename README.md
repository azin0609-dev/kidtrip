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

## 部署（GitHub Pages）

- push 到 `main` 會由 `.github/workflows/deploy.yml` 自動檢查、建置並部署。
- 網址：`https://<帳號>.github.io/<repo 名稱>/`。base path 由 workflow 以 `BASE_PATH=/<repo 名稱>/` 傳給 Vite，本機開發仍是 `/`。
- 第一次要到 repo 的 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
- 本機預覽正式版：`BASE_PATH=/kidtrip/ npm run build`，再用任何靜態伺服器把 `dist/` 掛在 `/kidtrip/` 底下。

## 座標補齊（geocode，只在開發時跑）

用 OpenStreetMap Nominatim 補 `lat`、`lng`，每秒最多 1 次請求。聯絡方式用環境變數帶，不會寫進 repo。

```bash
# 1. 產生出發地選單用的 data/origins.json（390 筆，約 8 分鐘）
GEOCODE_CONTACT=你的Email npm run geocode -- --origins

# 2. 補景點、飯店座標（只查 lat 為 null 的，已有座標不覆蓋），並產生 data/geocode-report.md
GEOCODE_CONTACT=你的Email npm run geocode

# 3. 看公式準不準、建議的係數
npm run calibrate
```

- 中斷也沒關係，每查完一筆就寫回檔案，再跑一次會接著做。
- 加 `--dry-run` 只列出要查哪些，不連網。
- 跑完請看 `data/geocode-report.md`，人工檢查查不到、離縣市太遠、名稱不像的項目。
