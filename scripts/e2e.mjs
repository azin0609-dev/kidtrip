// 端對端測試：用真的瀏覽器跑一遍主要流程。
//
// 第一次在新電腦上跑：
//   npm ci                           （會裝 playwright 套件，devDependencies）
//   npx playwright install chromium  （下載測試用的 Chromium，只要一次）
// 之後每次：
//   npm run build
//   npm run e2e
//
// 已經有裝好的 playwright（例如別的專案）也可以用 PLAYWRIGHT_MODULE 指過去。
// 時間固定在 2026-11-18（週三）晚上，天氣 API 一律擋掉，結果才穩定。
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

const PORT = Number(process.env.E2E_PORT ?? 4175);
const BASE = `http://localhost:${PORT}/`;
const NOW = new Date('2026-11-18T20:00:00+08:00');
const WEEK = '2026-W47';

const linkou = { label: '新北市林口區', lat: 25.0775, lng: 121.3916 };
const baseState = {
  fav: ['spot-017'],
  been: ['spot-092'],
  beenAt: { 'spot-092': '2026-08-01' },
  welcomed: true,
  origin: linkou,
  kids: [
    { nickname: '果果', birthYm: '2023-09' },
    { nickname: '核桃', birthYm: '2025-08' },
  ],
  nap: { start: '13:00', end: '15:00' },
  prefs: { maxDrive: 45, stroller: true },
  ratings: { 'spot-092': { stars: 5, tags: [] } },
  memos: { 'spot-017': '記得帶水壺' },
};

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function startServer() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return proc;
    } catch {
      // 還沒起來
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error('vite preview 沒有起來；先跑 npm run build');
}

/** 開新頁面：固定時間、擋天氣、可選擇預先放 localStorage、攔截分享。 */
async function openPage(browser, { width = 390, height = 844, state = baseState, url = BASE } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'Asia/Taipei', locale: 'zh-TW', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.clock.install({ time: NOW });
  await page.route(/open-meteo|nominatim/, (r) => r.abort());
  await page.addInitScript(
    ([s]) => {
      if (s && !sessionStorage.getItem('e2e-seeded')) {
        localStorage.setItem('kidtrip.v1', JSON.stringify(s));
        sessionStorage.setItem('e2e-seeded', '1');
      }
      // 攔下分享內容，給測試讀。
      window.__shared = [];
      Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => void window.__shared.push(d) });
    },
    [state],
  );
  await page.goto(url);
  await page.waitForTimeout(600);
  return { ctx, page };
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidtrip.v1') ?? '{}'));
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** 讀時間軸：每一步的開始、結束（分鐘）和文字。 */
async function readTimeline(scope) {
  return scope.locator('ol[aria-label="時間安排"]').first().evaluate((ol) =>
    [...ol.querySelectorAll('li')].map((li) => {
      // 每一列：裝飾用的連接線（第一列以外）、時間、圓點、文字。
      const spans = [...li.querySelectorAll(':scope > span')];
      const toMin = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      const time = spans.find((sp) => /^\d{1,2}:\d{2}$/.test(sp.textContent.trim()));
      const text = spans[spans.length - 1]?.textContent ?? '';
      const end = /（到 (\d{1,2}:\d{2})）/.exec(text);
      return { start: time ? toMin(time.textContent.trim()) : Number.NaN, end: end ? toMin(end[1]) : null, label: text };
    }),
  );
}
const ordered = (steps) => steps.length > 0 && steps.every((s, i) => Number.isFinite(s.start) && (i === 0 || s.start >= (steps[i - 1].end ?? steps[i - 1].start)));

async function openPlanner(page) {
  await page.getByRole('button', { name: /幫我規劃出遊/ }).first().click();
  const dlg = page.getByRole('dialog', { name: '幫我規劃出遊' });
  await dlg.waitFor();
  return dlg;
}

async function run() {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    // 1. 沒有推薦結果仍能開啟規劃工具（手機和桌面都看）
    const nowhere = { ...baseState, origin: { label: '台東縣蘭嶼鄉', lat: 22.04, lng: 121.55 }, prefs: { maxDrive: 30, stroller: true } };
    for (const width of [390, 1280]) {
      const { ctx, page } = await openPage(browser, { width, height: 900, state: nowhere });
      const empty = await page.getByText('這些條件下還沒找到適合的地方').count();
      const entry = page.getByRole('button', { name: /幫我規劃出遊/ }).first();
      const visible = await entry.isVisible();
      let opened = false;
      if (visible) {
        await entry.click();
        opened = await page.getByRole('dialog', { name: '幫我規劃出遊' }).isVisible();
      }
      check(`沒有推薦結果仍能開啟規劃工具（${width}px）`, empty > 0 && visible && opened, `空狀態 ${empty > 0}、入口 ${visible}、打開 ${opened}`);
      await ctx.close();
    }
    // 有推薦時，手機上入口在推薦卡上面就看得到
    {
      const { ctx, page } = await openPage(browser);
      const entryTop = await page.getByRole('button', { name: /幫我規劃出遊/ }).first().evaluate((el) => el.getBoundingClientRect().top);
      const heroTop = await page.locator('article').first().evaluate((el) => el.getBoundingClientRect().top);
      check('有推薦時，手機上規劃入口在第一張推薦卡前面', entryTop < heroTop, `入口 ${Math.round(entryTop)}px、推薦卡 ${Math.round(heroTop)}px`);
      await ctx.close();
    }

    // 2. 半日遊正常保存
    {
      const { ctx, page } = await openPage(browser);
      const dlg = await openPlanner(page);
      await dlg.getByRole('button', { name: '保存行程' }).first().click();
      const s = await stored(page);
      check('半日遊正常保存', s.plan?.week === WEEK && s.familyPlan?.spotId === s.plan?.spotId && !s.dayPlan, `plan ${s.plan?.spotId}、familyPlan ${s.familyPlan?.spotId}`);
      check('半日遊保存後收藏、去過、評分、備忘都還在', s.fav?.[0] === 'spot-017' && s.been?.[0] === 'spot-092' && s.ratings?.['spot-092']?.stars === 5 && s.memos?.['spot-017'] === '記得帶水壺');
      await ctx.close();
    }

    // 3–5. 全日遊：時間不重疊、保存、雙景點導航順序
    {
      const { ctx, page } = await openPage(browser);
      const dlg = await openPlanner(page);
      await dlg.getByRole('button', { name: '全日遊' }).click();
      await page.waitForTimeout(200);

      // 4. 各種午睡、午餐、單雙景點組合：時間軸每一步都接在前一步後面
      let combos = 0;
      let bad = [];
      let withLunchMove = 0;
      for (const style of ['一個地方輕鬆玩', '兩個地方探索']) {
        await dlg.getByRole('button', { name: style }).click();
        for (const napMode of ['推車上睡', '車上睡', '不睡']) {
          await dlg.getByRole('button', { name: napMode, exact: true }).click();
          for (const lunch of ['景點附近找', '自備']) {
            await dlg.getByRole('button', { name: lunch }).click();
            await page.waitForTimeout(120);
            if ((await dlg.locator('ol[aria-label="時間安排"]').count()) === 0) continue;
            const steps = await readTimeline(dlg);
            combos++;
            if (steps.some((s) => s.label.includes('離場'))) withLunchMove++;
            if (!ordered(steps)) bad.push(`${style}/${napMode}/${lunch}`);
            const backIdx = steps.findIndex((s) => s.label.includes('回到'));
            if (backIdx > 0) {
              const lunchStep = steps.slice(0, backIdx).reverse().find((s) => s.label.includes('午餐'));
              if (lunchStep && steps[backIdx].start < lunchStep.end) bad.push(`回場早於吃完：${style}/${napMode}/${lunch}`);
            }
          }
        }
      }
      check('午餐外出與回場時間不重疊（全部組合）', combos > 0 && bad.length === 0, `排得出 ${combos} 組、含出場吃飯 ${withLunchMove} 組${bad.length ? `、有問題：${bad.join('；')}` : ''}`);

      // 5. 雙景點導航順序
      await dlg.getByRole('button', { name: '兩個地方探索' }).click();
      await dlg.getByRole('button', { name: '車上睡', exact: true }).click();
      await dlg.getByRole('button', { name: '景點附近找' }).click();
      await dlg.getByRole('button', { name: '室內外都可以' }).click();
      await page.waitForTimeout(200);
      const heading = await dlg.locator('article h3').first().innerText();
      const [first, second] = heading.split(' → ').map((x) => x.trim());
      const route = await dlg.getByRole('link', { name: '兩站依序導航（Google 地圖）' }).getAttribute('href');
      const ru = new URL(route);
      check(
        '雙景點導航順序正確（第一站途經、第二站目的地）',
        !!second && ru.searchParams.get('waypoints')?.startsWith(first) && ru.searchParams.get('destination')?.startsWith(second) && !ru.searchParams.has('origin'),
        `${first} → ${second}`,
      );
      const singles = await dlg.getByRole('link', { name: /^導航到/ }).count();
      check('雙景點仍保留單站導航備案', singles === 2, `單站連結 ${singles} 個`);

      // 3. 全日遊保存
      await dlg.getByRole('button', { name: '保存行程' }).click();
      const s = await stored(page);
      check('全日遊正常保存', s.dayPlan?.v === 1 && s.dayPlan.secondId && s.plan?.spotId === s.dayPlan.spotId && !s.familyPlan, `dayPlan ${s.dayPlan?.spotId} → ${s.dayPlan?.secondId}`);
      await dlg.getByRole('button', { name: '關閉' }).click();
      await page.waitForTimeout(300);
      const card = await page.locator('section[aria-labelledby="weekplan-title"]').innerText();
      check('首頁計畫卡片顯示兩站全日遊', card.includes('全日遊') && card.includes('兩站') && card.includes(second));

      // 6. 分享連結可正確開啟（另一支手機、沒有任何資料）
      await page.getByRole('button', { name: '分享給另一半' }).first().click();
      await page.waitForTimeout(200);
      const shared = await page.evaluate(() => window.__shared.at(-1));
      const shareUrl = new URL(shared.url);
      check('全日遊分享連結帶 plan 和 day', shareUrl.searchParams.has('plan') && shareUrl.searchParams.has('day'));
      check('分享內容沒有孩子名字或出發地', !/果果|核桃|林口|2023-09|2025-08/.test(`${shared.text}${atobUrl(shareUrl.searchParams.get('day'))}`));
      await ctx.close();

      const other = await openPage(browser, { state: { welcomed: true, origin: linkou, fav: ['spot-001'] }, url: `${BASE}${shareUrl.search}` });
      const dialog = other.page.getByRole('dialog', { name: '收到這週的全日行程' });
      const shownText = (await dialog.count()) ? await dialog.innerText() : '';
      check('打開分享連結：預覽兩個景點和條件', shownText.includes(first) && shownText.includes(second) && shownText.includes('出門') && shownText.includes('車上睡'));
      check('打開分享連結後網址參數已清掉', !(await other.page.evaluate(() => location.search)).includes('day='));
      check('分享預覽在 390px 不出現橫向捲動', (await overflow(other.page)) === 0);
      await dialog.getByRole('button', { name: '存到這支手機' }).click();
      await other.page.waitForTimeout(300);
      const os = await stored(other.page);
      check('另一支手機存下全日遊，原本的收藏還在', os.dayPlan?.secondId === s.dayPlan.secondId && os.plan?.spotId === s.dayPlan.spotId && os.fav?.[0] === 'spot-001');
      await other.ctx.close();
    }

    // 7. 舊版資料與舊版分享連結
    {
      const oldPlan = b64url(JSON.stringify({ w: WEEK, t: 'sat-am', s: 'spot-017' }));
      const oldState = { ...baseState, plan: { week: WEEK, spotId: 'spot-092', slot: 'sun-pm' }, unknownField: { keep: true } };
      const { ctx, page } = await openPage(browser, { state: oldState, url: `${BASE}?plan=${oldPlan}` });
      const dlg = page.getByRole('dialog', { name: '收到這週的行程' });
      const ok = (await dlg.count()) > 0;
      check('舊版 ?plan= 連結照舊顯示（單站）', ok);
      if (ok) await dlg.getByRole('button', { name: '存到這支手機' }).click();
      await page.waitForTimeout(200);
      const s = await stored(page);
      check('舊版資料保留：收藏、去過、評分、備忘、看不懂的欄位', s.plan?.spotId === 'spot-017' && s.fav?.[0] === 'spot-017' && s.memos?.['spot-017'] && s.unknownField?.keep === true && !s.dayPlan);
      await ctx.close();

      // 上一版存下的全日遊（dayPlan v1）照樣顯示
      const prev = {
        ...baseState,
        plan: { week: WEEK, spotId: 'spot-017', slot: 'sat-am' },
        dayPlan: { v: 1, week: WEEK, slot: 'sat-am', spotId: 'spot-017', style: 'easy', departAt: 540, latestHome: 1080, napMode: 'car', lunch: 'nearby', envMode: 'any', maxDrive: 45, stroller: true },
      };
      const p2 = await openPage(browser, { state: prev });
      const main = await p2.page.locator('main').innerText();
      check('上一版存的全日遊照樣顯示', main.includes('全日遊') && (main.includes('親子輕鬆玩') || main.includes('需要重新安排')));
      await p2.ctx.close();
    }

    // 8. 手機窄螢幕不出現橫向捲動
    for (const width of [320, 390]) {
      const { ctx, page } = await openPage(browser, { width, height: 760 });
      const home = await overflow(page);
      const dlg = await openPlanner(page);
      const half = await overflow(page);
      await dlg.getByRole('button', { name: '全日遊' }).click();
      await dlg.getByRole('button', { name: '兩個地方探索' }).click();
      await page.waitForTimeout(200);
      const full = await overflow(page);
      const inner = await dlg.evaluate((d) => d.scrollWidth - d.clientWidth);
      check(`${width}px 沒有橫向捲動（首頁、半日、全日）`, home === 0 && half === 0 && full === 0 && inner <= 0, `首頁 ${home}、半日 ${half}、全日 ${full}、對話框 ${inner}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 通過`);
  process.exit(failed.length ? 1 : 0);
}

function atobUrl(code) {
  return code ? Buffer.from(code.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : '';
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
