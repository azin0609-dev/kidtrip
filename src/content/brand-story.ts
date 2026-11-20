/**
 * 放電研究所的品牌故事和標語：文案都集中在這裡，改字只要改這個檔案。
 *
 * 故事是以「一個爸爸」為敘事者的生活情境，不放作者姓名、職業、孩子名字、住址或照片，
 * 也不寫不存在的使用人數、媒體報導或得獎紀錄。
 */

/** 主標語：故事頁開頭、故事入口用。 */
export const BRAND_TAGLINE = '十分鐘做決定，剩下的時間，留給孩子。';
/** 輔助標語：故事頁結尾的署名用（兩行）。 */
export const BRAND_SUBLINE = ['孩子負責放電，爸爸媽媽負責陪伴。', '規劃的事，交給放電研究所。'] as const;

/** 首頁的小型故事入口（放在推薦卡片下方）。 */
export const STORY_TEASER = {
  title: '週末臨時想出門，不用再花一小時找地方。',
  body: '十分鐘選好行程，把時間留給孩子。',
  note: '一個爸爸，為了讓全家週末更輕鬆，而做的小工具。',
  button: '看看我們的故事',
} as const;

/**
 * 故事內文，一段一段排。
 * - p：一般段落
 * - say：孩子或家人說的話（引號那一行）
 * - list：一連串的動作，一行一個
 * - quote：重點金句，放大置中
 * - emph：段落中要強調的一句
 * - break：換一個段落群組（畫面上是小小的分隔）
 */
export type StoryBlock =
  | { kind: 'p'; text: string }
  | { kind: 'say'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'emph'; text: string }
  | { kind: 'break' };

export const STORY = {
  eyebrow: '關於放電研究所',
  title: '放電研究所，是怎麼誕生的？',
  lead: '一個爸爸的週末早晨，催生了這個小工具。',
  blocks: [
    { kind: 'p', text: '星期六早上，七點半。' },
    { kind: 'p', text: '難得不用上班，原本還想在床上多躺一下。' },
    { kind: 'p', text: '結果孩子已經精神百倍，跑過來問：' },
    { kind: 'say', text: '「爸爸，我們今天要去哪裡玩？」' },
    { kind: 'p', text: '我看了一眼窗外，天氣好像不錯。' },
    { kind: 'p', text: '再看了一眼老婆。' },
    { kind: 'p', text: '她的眼神彷彿在說：「所以，你有安排嗎？」' },
    { kind: 'p', text: '沒有。' },
    { kind: 'p', text: '但我突然很想帶孩子出去走走。' },
    { kind: 'break' },
    { kind: 'p', text: '於是，我開始了每個爸媽都很熟悉的週末儀式。' },
    { kind: 'list', items: ['打開 Google 地圖，搜尋親子景點。', '滑 IG，看別人帶小孩去哪玩。', '翻部落格、查營業時間、研究停車場。'] },
    { kind: 'p', text: '好不容易找到一個地方，才發現單程要開一個半小時。' },
    { kind: 'p', text: '換下一個，小孩年紀還不適合。' },
    { kind: 'p', text: '再換一個，推車不好推。' },
    { kind: 'p', text: '終於找到看起來不錯的，老婆提醒：' },
    { kind: 'say', text: '「那弟弟下午要睡覺怎麼辦？」' },
    { kind: 'p', text: '就這樣，原本只是想帶孩子出去玩，卻花了快一個小時在決定去哪裡。' },
    { kind: 'p', text: '等到真的準備出門，孩子已經開始吵了，爸爸也快沒電了。' },
    { kind: 'break' },
    { kind: 'p', text: '那時候我突然想到：' },
    { kind: 'quote', text: '為什麼帶小孩出去放電，最先沒電的總是爸爸媽媽？' },
    { kind: 'p', text: '我想要的其實很簡單。' },
    { kind: 'p', text: '星期六、星期日一早醒來，臨時起意也沒關係。' },
    { kind: 'p', text: '打開手機，告訴它孩子幾歲、從哪裡出發、願意開多久的車。' },
    { kind: 'p', text: '它就幫我找出幾個適合的地方。' },
    { kind: 'p', text: '不用再開十幾個網頁，不用夫妻兩個人各查各的，也不用在出門前開一場家庭會議。' },
    { kind: 'emph', text: '十分鐘，選好地方、排好行程，帶著孩子出門。' },
    { kind: 'break' },
    { kind: 'p', text: '於是，我開始利用下班後的時間，一點一點把這個想法做出來。' },
    { kind: 'p', text: '它沒有什麼偉大的起點。' },
    { kind: 'p', text: '只是一個爸爸，希望自己能少花一點時間查資料，多花一點時間陪孩子。' },
    { kind: 'p', text: '這就是「放電研究所」誕生的原因。' },
    { kind: 'break' },
    { kind: 'p', text: '希望有一天，當你家的孩子也在週末早晨問：' },
    { kind: 'say', text: '「爸爸、媽媽，今天要去哪裡？」' },
    { kind: 'p', text: '你可以不用再苦惱。' },
    { kind: 'p', text: '打開放電研究所。' },
    { kind: 'quote', text: BRAND_TAGLINE },
  ] satisfies readonly StoryBlock[],
  signature: '放電研究所',
  /** 誠實說明：故事是生活情境改寫，不是逐字紀錄。 */
  note: '這篇故事依一家人的週末日常寫成，對話是情境描述，不是逐字紀錄。',
  cta: '開始規劃這週末',
} as const;
