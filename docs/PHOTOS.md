# 景點照片怎麼管

## 原則
- **只放合法、而且是這個地方本身的照片**。不拿別處的照片代替，也不放 AI 生成的風景冒充真實景點。
- 沒有照片的景點，畫面用原創的類型插圖，並標「示意圖・還沒有照片」，不會讓人誤會是實景。
- 每張照片都會在畫面上標出作者和授權；景點詳細資料裡有「看原始照片與授權」連結。

## 可以用的照片
| 來源 | 授權欄位寫法 |
|---|---|
| 自己拍的 | `自己拍的` |
| 官方明確允許使用（要留下允許的證明） | `官方授權使用` |
| Wikimedia Commons 上 CC BY、CC BY-SA、CC0、公有領域的照片 | 照 Commons 標示，例如 `CC BY-SA 4.0` |

不能用：Google 地圖、部落格、Facebook／IG、訂房網站的照片，以及 CC 授權裡有 NC（禁止商業）或 ND（禁止改作）的照片。

## 資料格式
`data/spots.json` 每筆景點可以加 `image`（住宿、餐廳也可以）：

```json
"image": {
  "url": "photos/spot-017.jpg",
  "credit": "作者名／Wikimedia Commons",
  "license": "CC BY-SA 4.0",
  "source_url": "https://commons.wikimedia.org/wiki/File:..."
}
```

- `url`：放在 `public/photos/` 的相對路徑（會自動加上網站子路徑），或完整網址。
- `npm run validate:data` 會檢查授權能不能用、照片檔是不是真的存在。

## 從 Commons 加一張
1. 在 commons.wikimedia.org 搜尋景點名稱，打開照片頁，確認說明、拍攝地點真的是這個景點（例如同名的舊館、別的分館都不行）。
2. 執行：

```bash
NODE_USE_ENV_PROXY=1 node scripts/photos.ts spot-017 "File:Interior of Xpark- 05.2024-06-11.jpg"
```

腳本會檢查授權、縮成最長邊 960px、去掉 EXIF，存到 `public/photos/`，並寫進 `data/spots.json`。

3. 用 `node scripts/photos.ts --list` 看哪些景點已經有照片。

## 自己拍的
把照片縮到最長邊約 1000px，存成 `public/photos/<景點 id>.jpg`，在 JSON 加上 `image`，`credit` 寫「我們家」，`license` 寫「自己拍的」。上傳前記得去掉手機照片裡的 GPS 資訊。
