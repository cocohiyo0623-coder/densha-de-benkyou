// ============================================
// data.js — 問題・定数データ
// ============================================

const QUESTIONS_PER_GAME = 10;
const CORRECT_DELAY = 1500;
const WRONG_DELAY = 1500;
const CONFETTI_COUNT = 30;
const LEVEL_UNIT = 20; // 20問正解で1レベルアップ

// 電車の進化データ
const TRAIN_DEFS = [
    { minLevel: 1, emoji: '🚃', label: 'ふつうの電車' },
    { minLevel: 2, emoji: '🚋', label: '路面電車' },
    { minLevel: 3, emoji: '🚈', label: 'モノレール' },
    { minLevel: 4, emoji: '🚇', label: '地下鉄' },
    { minLevel: 5, emoji: '🚆', label: '特急列車' },
    { minLevel: 6, emoji: '🚅', label: '新幹線' },
    { minLevel: 7, emoji: '🚄', label: 'はやぶさ風' },
    { minLevel: 8, emoji: '🚢', label: '青函トンネル風' },
    { minLevel: 9, emoji: '🛸', label: '未来の電車？' },
    { minLevel: 10, emoji: '🟡', label: 'ドクターイエロー' }
];

// 褒め言葉リスト
const PRAISES = [
    { t: "すごい！", e: "💮" },
    { t: "てんさい！", e: "✨" },
    { t: "やったね！", e: "🎉" },
    { t: "そのちょうし！", e: "👍" },
    { t: "ばっちり！", e: "🎯" }
];

// 1年生の漢字
const KANJI_G1 = [
    { q: "一", a: "いち", hint: "☝️", hintText: "ゆび 1ぽん" },
    { q: "二", a: "に", hint: "✌️", hintText: "ゆび 2ほん" },
    { q: "三", a: "さん", hint: "🤟", hintText: "ゆび 3ぼん" },
    { q: "口", a: "くち", hint: "👄", hintText: "からだの どこかな？" },
    { q: "手", a: "て", hint: "👋", hintText: "バイバイする ときにつかうよ" },
    { q: "山", a: "やま", hint: "⛰️", hintText: "たかーい ところ" },
    { q: "木", a: "き", hint: "🌳", hintText: "はっぱが しげってるよ" },
    { q: "日", a: "ひ", hint: "☀️", hintText: "おてんとうさま" },
    { q: "月", a: "つき", hint: "🌙", hintText: "よるに ひかるよ" },
    { q: "火", a: "ひ", hint: "🔥", hintText: "あついあつい" },
    { q: "水", a: "みず", hint: "💧", hintText: "のんだり あらったり" }
];

// 2年生の漢字
const KANJI_G2 = [
    { q: "心", a: "こころ", hint: "❤️", hintText: "どきどき するよ" },
    { q: "風", a: "かぜ", hint: "🍃", hintText: "びゅーびゅー ふくよ" },
    { q: "雪", a: "ゆき", hint: "❄️", hintText: "ふゆに ふるよ" },
    { q: "電", a: "でん", hint: "⚡", hintText: "ピカッと ひかる" },
    { q: "書", a: "かく", hint: "✏️", hintText: "えんぴつで..." },
    { q: "食", a: "たべる", hint: "🍛", hintText: "ごはんを..." }
];

// なぞりがき対象漢字
const TRACE_KANJI_G1 = ["一", "二", "三", "口", "日", "山", "木", "天"];
const TRACE_KANJI_G2 = ["心", "風", "電", "書", "道", "強"];

// 算数文章題（1年生レベル）
const WORD_PROBLEMS = [
    {
        id: "wp1",
        text: ["でんしゃに 3にん のっています。", "えきで 2にん のってきました。", "ぜんぶで なんにん？"],
        emojis: ["🚃", "🚶‍♂️", "❓"],
        f: "3＋2", fc: ["3＋2", "3－2", "2＋2"],
        a: "5", ac: ["4", "5", "6"]
    },
    {
        id: "wp2",
        text: ["りんごが 5こ あります。", "3こ たべました。", "のこりは いくつ？"],
        emojis: ["🍎", "😋", "❓"],
        f: "5－3", fc: ["5＋3", "5－3", "3＋3"],
        a: "2", ac: ["1", "2", "3"]
    }
];

// メダル定義
const MEDAL_DEFS = [
    { id: 'first', emoji: '🥉', label: 'はじめてのクリア', check: (s) => s.totalCorrect >= 10 },
    { id: 'level5', emoji: '🥈', label: 'レベル5 到達', check: (s) => s.totalLevel >= 5 },
    { id: 'level10', emoji: '🥇', label: 'レベル10 到達', check: (s) => s.totalLevel >= 10 },
    { id: 'days3', emoji: '📅', label: '3にち 連続', check: (s) => s.stamps.length >= 3 }
];
