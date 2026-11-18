# 放電研究所（kidtrip）

孩子負責放電，我們負責找地方。幫 0–12 歲親子家庭，每週五分鐘內決定週末去哪玩。（品牌名稱暫定，原名「這週去哪玩」；repo、網址路徑和 localStorage key `kidtrip.v1` 都沒改。）規格見 [`docs/PRD.md`](docs/PRD.md)，開發規則見 [`AGENTS.md`](AGENTS.md)，景點照片的授權規則和加法見 [`docs/PHOTOS.md`](docs/PHOTOS.md)。

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

- `data/restaurants.json`（親子餐廳）、`data/trips.json`（出國行程）、`data/origins.json`（出發地選單座標）格式也都定義在 `src/data/schema.ts`。
- **`data/*.json` 是唯一的資料來源，直接改 JSON。** 初版是 `scripts/legacy/seed-data.ts` 產生的，已封存、不要再跑（會蓋掉修改）。
- 每筆資料確認過營業狀態後，更新 `verified`（日期、查過的欄位、來源）；`npm run validate:data` 會列出太久沒確認的資料（餐廳、民宿 90 天，景點、飯店 180 天）。
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
