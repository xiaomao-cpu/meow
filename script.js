let quizConfig = null;
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyCM1vKdEGcZlfjyNrWBNRRIY8N-Lzia0uTOhjDKl1-zaQifwTAdh1stfDMnTaF9l7N/exec"; // 在此填入部署後的 Google Apps Script 網頁應用程式網址
let currentPath = [];
let currentStep = 0;
let gender = null;
let userAnswers = {};
let userMeta = {
    lineNickname: "",
    playDate: ""
};
let historyStack = [];
let multiSelectState = [];
let isBgmOn = false;
let isIntroActive = false;
let currentIntroStep = 0;
let dmGender = "F"; // 預設游泉為女 DM

const els = {
    home: document.getElementById("home-screen"),
    quiz: document.getElementById("quiz-screen"),
    result: document.getElementById("result-screen"),
    start: document.getElementById("start-button"),
    restart: document.getElementById("restart-button"),
    prev: document.getElementById("prev-button"),
    next: document.getElementById("next-button"),
    audio: document.getElementById("audio-toggle"),
    copy: document.getElementById("copy-button"),
    copyStatus: document.getElementById("copy-status"),
    progress: document.getElementById("progress-bar"),
    questionCount: document.getElementById("question-count"),
    questionText: document.getElementById("question-text"),
    options: document.getElementById("options"),
    resultContent: document.getElementById("result-content")
};

let bgm = null;
try {
    bgm = new Audio("assets/bgm.mp3");
    if (bgm) bgm.loop = true;
} catch (e) {
    console.warn("BGM 初始化跳過 (相容性保護):", e);
}

let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

function playPaperSFX() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(420, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
}

function playUnlockSFX() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i * 0.06);
            gain.gain.linearRampToValueAtTime(0.15, now + i * 0.06 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.35);
        });
    } catch (e) {}
}

function fadeBGM(targetVolume, duration = 800) {
    if (!bgm) return;
    const startVol = bgm.volume;
    const startTime = performance.now();
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        bgm.volume = startVol + (targetVolume - startVol) * progress;
        if (progress < 1) {
            requestAnimationFrame(step);
        } else if (targetVolume === 0) {
            bgm.pause();
        }
    }
    if (targetVolume > 0 && bgm.paused) {
        bgm.play().catch(() => {});
    }
    requestAnimationFrame(step);
}

const introQuestions = [
    {
        id: "lineNickname",
        label: "LINE 暱稱",
        text: "請輸入你的 LINE 暱稱",
        placeholder: "例如：小貓",
        hint: "這會顯示在你的測驗結果裡。",
        error: "請輸入 LINE 暱稱。"
    },
    {
        id: "playDate",
        label: "遊玩時間",
        text: "請輸入你的遊玩時間",
        placeholder: "2026/07/08",
        hint: "只要輸入 8 位數字，系統會自動補上 /，例如 20260708。",
        error: "請使用 xxxx/xx/xx 格式，例如 2026/07/08。"
    }
];

const FALLBACK_QUIZ_CONFIG = {
  "characters": {
    "1": { "name": "畔（男生版）", "image": "assets/畔（男）.jpg", "resultText": "「我們都一樣，心甘情願的被困在以愛為名的囚牢中」" },
    "2": { "name": "默", "image": "assets/默.jpg", "resultText": "「她在，我便在；她走，我跟上。」" },
    "3": { "name": "伽涅", "image": "assets/伽.jpg", "resultText": "「於是我打開鏡子，與你相擁，與我相擁。 」" },
    "4": { "name": "畔（女生版）", "image": "assets/畔（女）.jpg", "resultText": "「我們都一樣，心甘情願的被困在以愛為名的囚牢中」" },
    "5": { "name": "明昔", "image": "assets/明.jpg", "resultText": "「她明知是虛妄，依舊奔赴。」" },
    "6": { "name": "艾蕾", "image": "assets/艾.jpg", "resultText": "「你比我，更像我。 」" },
    "7": { "name": "芙羅拉", "image": "assets/芙.jpg", "resultText": "「你別坐高台，你要掉下來；你這麼好的人，就該和我一樣壞。」" }
  },
  "targetCharacters": { "M": ["1","2","3"], "F": ["4","5","6","7"] },
  "paths": { "M": [0,1,2,3,5,6,8], "F": [0,1,2,4,5,6,7] },
  "mutuallyExclusive": { "3": "I", "4": "K" },
  "maxScores": { "1": 7, "2": 7, "3": 7, "4": 7, "5": 6, "6": 6, "7": 6 },
  "questions": [
    { "id": 0, "type": "single", "text": "請選擇您的性別", "options": [{ "val": "M", "text": "我是男生" }, { "val": "F", "text": "我是女生" }] },
    { "id": 1, "type": "single", "text": "您遇到一個可以為之付出一切的愛人，您希望他是什麼樣的人？", "options": [
      { "val": "A", "text": "A 我希望對方為我付出得更多，但一切的前提都是我們足夠相愛。" },
      { "val": "B", "text": "B 我從不覺得愛情是在付出，我為你做的一切，也是因為你曾是我生命中無可替代的光。" },
      { "val": "C", "text": "C 我不會遇到一個愛人，因為在這個世界上我最愛的永遠是我自己，哪怕這個人真的出現了，我愛他的原因，也是因為對方與我是極其相似的人。" },
      { "val": "D", "text": "D 我從不會真正的愛上某個人，而是我要成為感情中的上位者，成為感情中的獵手。甚至偽裝成楚楚可憐的獵物，這反而會讓我更加興奮。", "femaleOnly": true }
    ]},
    { "id": 2, "type": "single", "text": "您更想體驗哪種愛情？", "options": [
      { "val": "A", "text": "A 我們之間，總是在錯過。我們彼此互為對方的白月光、我們「深愛」著彼此，可卻沒有時間和機會去「相愛」過，這是我們一生的遺憾，我們都會去盡力彌補，不讓我們留有遺憾。" },
      { "val": "B", "text": "B 我們之間，說愛情太過庸俗。我們都深知最愛的人只有我們自己，但我們是彼此的倒影，是這個世界上最瞭解對方的人。我瘋狂地愛著自己，所以我同樣瘋狂地愛著你。" },
      { "val": "C", "text": "C 我們之間，互為彼此的鐐銬。我們或許都是一個沒有安全感的個體，所以我們用極端的方式將對方留在身邊。即便肉體會被烙印痛苦，但如果這樣我們可以永遠相愛，那也是一件幸福的事。" },
      { "val": "D", "text": "D 我們之間，不談真心，只談擁有。你曾在我心裡是一個太過於美好的存在，可我就是想要把你拉下神壇，成為跟我一樣壞的人，成為屬於我的存在。", "femaleOnly": true }
    ]},
    { "id": 3, "type": "multi", "text": "您絕對不能接受的雷點是？（多選題）", "options": [
      { "val": "A", "text": "A 我無法接受我的 cp 擁有一條姐妹線，占比程度大過於我。即使我與我的 cp 在故事中都沒有把愛情線放在第一位，即便我忙得不可開交有其他的事情要做，我也無法接受。" },
      { "val": "B", "text": "B 我無法接受偽替身文學。（您在故事中是知情，且甘願的情況下。）" },
      { "val": "C", "text": "C 我無法接受外顯女 A 男 O 的感覺。（女 A 男 O 的粗略解釋：在一段感情中，女生是看起來更強勢的那一方。）" },
      { "val": "D", "text": "D 我無法接受游離主線。" },
      { "val": "E", "text": "E 我無法接受與 NPC 談戀愛。" },
      { "val": "F", "text": "F 我無法接受自身道德底線過低。" },
      { "val": "G", "text": "G 我無法接受自己與 cp 以外的玩家有大輸出互動。" },
      { "val": "H", "text": "H 我無法接受 cp 與自己以外的玩家有大輸出互動。" },
      { "val": "I", "text": "I 以上我都可以接受。" }
    ]},
    { "id": 4, "type": "multi", "text": "您絕對不能接受的雷點是？（多選題）", "options": [
      { "val": "A", "text": "A 我無法接受我擁有一條「超越友情」的，邪門的姐妹線。" },
      { "val": "B", "text": "B 我無法接受視角低，哪怕低視角會讓我看到更多的反轉，會讓我「擁有」更多的反轉。" },
      { "val": "C", "text": "C 我無法接受在一段感情中，外顯女 A 男 O 的感覺。（女 A 男 O 的粗略解釋：在一段感情中，女生是看起來強勢的那一方。）" },
      { "val": "D", "text": "D 我實在無法接受成為小丑，哪怕是會得到很好的體驗，我也絕對不想成為小丑。" },
      { "val": "E", "text": "E 我無法接受被背刺。" },
      { "val": "F", "text": "F 我無法接受與 NPC 互動。" },
      { "val": "G", "text": "G 我無法接受自身道德底線過低。" },
      { "val": "H", "text": "H 我無法接受類女同線。" },
      { "val": "I", "text": "I 我無法接受自己與 cp 以外的玩家有大輸出互動。" },
      { "val": "J", "text": "J 我無法接受 cp 與自己以外的玩家有大輸出互動。" },
      { "val": "K", "text": "K 以上都可接受。" }
    ]},
    { "id": 5, "type": "single", "text": "您是否能扛壓？", "options": [
      { "val": "A", "text": "A 我是脆弱的小花花，我無法抗壓。" },
      { "val": "B", "text": "B 一般般，可以接受抗壓。" },
      { "val": "C", "text": "C 我能扛著十公斤壓力跑二十公里！" }
    ]},
    { "id": 6, "type": "single", "text": "在劇本體驗過程中，您是否喜歡互動輸出？", "options": [
      { "val": "A", "text": "A 我只想在角落縮著看大家表演。" },
      { "val": "B", "text": "B 一般般，給我大卡還是能演得起來。" },
      { "val": "C", "text": "C 全體目光朝我看齊！" }
    ]},
    { "id": 7, "type": "multi", "text": "您更喜歡以下哪些情感體驗呢？（多選）", "options": [
      { "val": "A", "text": "A NPC 沉浸式戀愛，又戀又陪。" },
      { "val": "B", "text": "B 偏愛。" },
      { "val": "C", "text": "C 強制愛。" },
      { "val": "D", "text": "D 主動出擊，把高嶺之花拉下神壇。" },
      { "val": "E", "text": "E 純愛。" },
      { "val": "F", "text": "F 背刺。" },
      { "val": "G", "text": "G 被背刺。" },
      { "val": "H", "text": "H 權謀。" }
    ]},
    { "id": 8, "type": "multi", "text": "您更喜歡以下哪些情感體驗呢？（多選）", "options": [
      { "val": "A", "text": "A NPC 沉浸式戀愛，又戀又陪。" },
      { "val": "B", "text": "B 偏愛。" },
      { "val": "C", "text": "C 強制愛。" },
      { "val": "D", "text": "D 隱忍。" },
      { "val": "E", "text": "E 純愛。" },
      { "val": "F", "text": "F 背刺。" },
      { "val": "G", "text": "G 復仇。" },
      { "val": "H", "text": "H 權謀。" },
      { "val": "I", "text": "I 偏執。" }
    ]}
  ],
  "scoring": {
    "M": [
      { "questionId": 1, "value": "A", "scores": { "1": 1 } },
      { "questionId": 1, "value": "B", "scores": { "2": 1 } },
      { "questionId": 1, "value": "C", "scores": { "3": 1 } },
      { "questionId": 2, "value": "A", "scores": { "2": 1 } },
      { "questionId": 2, "value": "B", "scores": { "3": 1 } },
      { "questionId": 2, "value": "C", "scores": { "1": 1 } },
      { "questionId": 3, "value": "C", "scores": { "1": -1 } },
      { "questionId": 3, "value": "D", "scores": { "1": -1 } },
      { "questionId": 3, "value": "E", "scores": { "1": -1 } },
      { "questionId": 3, "value": "B", "scores": { "2": -1 } },
      { "questionId": 3, "value": "A", "scores": { "3": -1 } },
      { "questionId": 3, "value": "F", "scores": { "3": -1 } },
      { "questionId": 3, "value": "G", "scores": { "3": -1 } },
      { "questionId": 3, "value": "H", "scores": { "3": -1 } },
      { "questionId": 5, "value": "B", "scores": { "1": 1 } },
      { "questionId": 5, "value": "C", "scores": { "1": 1, "2": 1, "3": 1 } },
      { "questionId": 6, "value": "B", "scores": { "1": 1 } },
      { "questionId": 6, "value": "C", "scores": { "1": 1, "2": 1, "3": 1 } },
      { "questionId": 8, "value": "A", "scores": { "1": 1 } },
      { "questionId": 8, "value": "B", "scores": { "1": 1, "2": 1 } },
      { "questionId": 8, "value": "C", "scores": { "1": 1, "3": 1 } },
      { "questionId": 8, "value": "D", "scores": { "2": 1 } },
      { "questionId": 8, "value": "E", "scores": { "2": 1 } },
      { "questionId": 8, "value": "F", "scores": { "3": 1 } },
      { "questionId": 8, "value": "G", "scores": { "2": 1, "3": 1 } },
      { "questionId": 8, "value": "H", "scores": { "3": 1 } },
      { "questionId": 8, "value": "I", "scores": { "3": 1 } }
    ],
    "F": [
      { "questionId": 1, "value": "A", "scores": { "4": 1 } },
      { "questionId": 1, "value": "B", "scores": { "5": 1 } },
      { "questionId": 1, "value": "C", "scores": { "6": 1 } },
      { "questionId": 1, "value": "D", "scores": { "7": 1 } },
      { "questionId": 2, "value": "A", "scores": { "5": 1 } },
      { "questionId": 2, "value": "B", "scores": { "6": 1 } },
      { "questionId": 2, "value": "C", "scores": { "4": 1 } },
      { "questionId": 2, "value": "D", "scores": { "7": 1 } },
      { "questionId": 4, "value": "C", "scores": { "4": -1 } },
      { "questionId": 4, "value": "F", "scores": { "4": -1 } },
      { "questionId": 4, "value": "A", "scores": { "5": -1, "6": -1 } },
      { "questionId": 4, "value": "B", "scores": { "5": -1 } },
      { "questionId": 4, "value": "E", "scores": { "5": -1 } },
      { "questionId": 4, "value": "G", "scores": { "6": -1 } },
      { "questionId": 4, "value": "H", "scores": { "6": -1 } },
      { "questionId": 4, "value": "I", "scores": { "6": -1, "7": -1 } },
      { "questionId": 4, "value": "J", "scores": { "6": -1 } },
      { "questionId": 4, "value": "D", "scores": { "7": -1 } },
      { "questionId": 5, "value": "B", "scores": { "4": 1, "7": 1 } },
      { "questionId": 5, "value": "C", "scores": { "4": 1, "5": 1, "6": 1, "7": 1 } },
      { "questionId": 6, "value": "A", "scores": { "5": 1 } },
      { "questionId": 6, "value": "B", "scores": { "4": 1 } },
      { "questionId": 6, "value": "C", "scores": { "5": 1, "6": 1, "7": 1 } },
      { "questionId": 7, "value": "A", "scores": { "4": 1, "7": 1 } },
      { "questionId": 7, "value": "B", "scores": { "4": 1, "5": 1, "7": 1 } },
      { "questionId": 7, "value": "C", "scores": { "4": 1, "7": 1 } },
      { "questionId": 7, "value": "D", "scores": { "7": 1 } },
      { "questionId": 7, "value": "E", "scores": { "4": 1, "5": 1, "7": 1 } },
      { "questionId": 7, "value": "F", "scores": { "6": 1 } },
      { "questionId": 7, "value": "G", "scores": { "5": 1 } },
      { "questionId": 7, "value": "H", "scores": { "6": 1 } }
    ]
  }
};

quizConfig = FALLBACK_QUIZ_CONFIG;

// 核心按鈕同步綁定（同時支援 onclick 與 addEventListener，重疊保護）
function bindCoreEvents() {
    try {
        const startBtn = document.getElementById("start-button");
        const restartBtn = document.getElementById("restart-button");
        const copyBtn = document.getElementById("copy-button");
        const prevBtn = document.getElementById("prev-button");
        const nextBtn = document.getElementById("next-button");
        const audioBtn = document.getElementById("audio-toggle");

        if (startBtn) {
            startBtn.onclick = startQuiz;
        }
        if (restartBtn) {
            restartBtn.onclick = restartQuiz;
        }
        if (copyBtn) {
            copyBtn.onclick = copyResult;
        }
        if (prevBtn) {
            prevBtn.onclick = prevQuestion;
        }
        if (nextBtn) {
            nextBtn.onclick = nextQuestion;
        }
        if (audioBtn) {
            audioBtn.onclick = toggleAudio;
        }
    } catch (e) {
        console.warn("bindCoreEvents 綁定失敗:", e);
    }
}

bindCoreEvents();
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindCoreEvents);
}
window.addEventListener("load", bindCoreEvents);

init();

async function init() {
    try {
        const response = await fetch("quiz.json", { cache: "no-store" });
        if (response.ok) {
            const data = await response.json();
            if (data && data.questions) quizConfig = data;
        }
    } catch (error) {
        console.info("使用內建題目資料。", error);
    }

    // 跨裝置同步解析
    checkUrlSyncMemories();
    syncMemoriesFromCloud();

    // 1. 優先讀取網址參數 (例如 ?dm=F 或 ?dm=M)
    const urlParams = new URLSearchParams(window.location.search);
    const dmParam = urlParams.get("dm");
    if (dmParam && (dmParam.toUpperCase() === "F" || dmParam.toUpperCase() === "FEMALE")) {
        setDmGender("F");
    } else if (dmParam && (dmParam.toUpperCase() === "M" || dmParam.toUpperCase() === "MALE")) {
        setDmGender("M");
    } else {
        // 2. 若無網址參數，讀取裝置記憶體 (localStorage)
        try {
            const savedDm = localStorage.getItem("youquan_dm_gender");
            if (savedDm === "F" || savedDm === "M") {
                setDmGender(savedDm);
            }
        } catch (e) {}
    }

    // 首頁標題切換 DM 模式功能已移除，改由後台切換
}

let toastTimer = null;
function showToast(message) {
    let toastEl = document.getElementById("toast-notice");
    if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.id = "toast-notice";
        toastEl.className = "toast-notice";
        document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.classList.remove("show");
    }, 2800);
}

function setDmGender(g) {
    dmGender = g;
    try {
        localStorage.setItem("youquan_dm_gender", g);
    } catch (e) {}
}

function startQuiz() {
    try { if (bgm) startBgm(); } catch (e) {}
    currentPath = [];
    currentStep = 0;
    gender = null;
    userAnswers = {};
    userMeta = { lineNickname: "", playDate: "" };
    historyStack = [];
    multiSelectState = [];
    isIntroActive = true;
    currentIntroStep = 0;
    showScreen("quiz");
    renderIntroQuestion();
}

window.startQuiz = startQuiz;
window.showScreen = showScreen;
window.restartQuiz = restartQuiz;
window.nextQuestion = nextQuestion;
window.prevQuestion = prevQuestion;

function showScreen(name) {
    const homeEl = document.getElementById("home-screen");
    const quizEl = document.getElementById("quiz-screen");
    const resultEl = document.getElementById("result-screen");
    const secretPanScreen = document.getElementById("secret-pan-screen");

    if (homeEl) {
        if (name === "home") homeEl.classList.remove("hidden");
        else homeEl.classList.add("hidden");
    }
    if (quizEl) {
        if (name === "quiz") quizEl.classList.remove("hidden");
        else quizEl.classList.add("hidden");
    }
    if (resultEl) {
        if (name === "result") resultEl.classList.remove("hidden");
        else resultEl.classList.add("hidden");
    }
    if (secretPanScreen) {
        if (name === "secret-pan") secretPanScreen.classList.remove("hidden");
        else secretPanScreen.classList.add("hidden");
    }
}

function startBgm() {
    if (!bgm) return;
    bgm.currentTime = 0;
    isBgmOn = true;
    updateAudioButton();
    bgm.play().catch(error => {
        isBgmOn = false;
        updateAudioButton();
        console.error(error);
    });
}

function toggleAudio() {
    if (!bgm) return;
    if (isBgmOn) {
        bgm.pause();
        isBgmOn = false;
        updateAudioButton();
        return;
    }
    isBgmOn = true;
    updateAudioButton();
    bgm.play().catch(error => {
        isBgmOn = false;
        updateAudioButton();
        console.error(error);
    });
}

function updateAudioButton() {
    els.audio.textContent = isBgmOn ? "關閉 BGM" : "開啟 BGM";
    els.audio.setAttribute("aria-pressed", isBgmOn ? "true" : "false");
}

function renderQuestion() {
    const question = currentPath[currentStep];
    const isMulti = question.type === "multi";
    if (isMulti) {
        multiSelectState = userAnswers[question.id] ? [...userAnswers[question.id]] : [];
    }
    els.questionText.textContent = question.text;
    els.questionCount.textContent = `第 ${currentStep + 1} 題 / 共 ${currentPath.length} 題`;
    els.progress.style.width = `${(currentStep / Math.max(1, currentPath.length - 1)) * 100}%`;
    els.prev.classList.toggle("hidden", currentStep === 0 && historyStack.length === 0);
    els.next.classList.toggle("hidden", !isMulti);
    els.next.textContent = "下一題";
    els.options.innerHTML = "";

    // 先過濾出要顯示的選項，再重新依序編號，不讓玩家看出缺口
    const visibleOptions = question.options.filter(option => {
        if (option.femaleOnly && gender === "M") return false;
        // 若 GM（游泉）性別與玩家相同，隱藏「畔」的唯一綁定選項：Q1-A / Q2-C
        if (gender === dmGender) {
            if ((question.id === 1 && option.val === "A") ||
                (question.id === 2 && option.val === "C")) return false;
        }
        return true;
    });

    visibleOptions.forEach((option, index) => {
        const newLabel = String.fromCharCode(65 + index); // A, B, C, D...
        // 取代選項文字開頭的字母（格式如 "A 內文" 或 "B 內文"）
        const displayText = option.text.replace(/^[A-Z]\s/, newLabel + " ");

        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-button";
        button.textContent = displayText;
        button.dataset.value = option.val;
        if (isMulti && multiSelectState.includes(option.val)) {
            button.classList.add("selected");
        }
        button.addEventListener("click", () => {
            if (isMulti) {
                handleMultiChoice(button, option.val, question.id);
            } else {
                handleSingleChoice(question.id, option.val);
            }
        });
        els.options.appendChild(button);
    });
}

function renderIntroQuestion() {
    const question = introQuestions[currentIntroStep];
    const value = userMeta[question.id] || "";
    els.questionText.textContent = question.text;
    els.questionCount.textContent = `接入資料 ${String(currentIntroStep + 1).padStart(2, "0")} / 02`;
    els.progress.style.width = `${(currentIntroStep / introQuestions.length) * 100}%`;
    els.prev.classList.toggle("hidden", currentIntroStep === 0 && historyStack.length === 0);
    els.next.classList.remove("hidden");
    els.next.textContent = currentIntroStep === introQuestions.length - 1 ? "下一步" : "下一題";
    els.options.innerHTML = `
        <label class="input-card" for="intro-${question.id}">
            <span class="input-label">${question.label}</span>
            <input
                id="intro-${question.id}"
                class="text-input"
                type="text"
                value="${escapeHtml(value)}"
                placeholder="${question.placeholder}"
                autocomplete="off"
                ${question.id === "playDate" ? 'inputmode="numeric" maxlength="10"' : 'maxlength="40"'}
            >
            <p class="input-hint">${question.hint}</p>
            <p id="intro-error" class="input-error" aria-live="polite"></p>
        </label>
    `;
    const input = els.options.querySelector(".text-input");
    const error = els.options.querySelector("#intro-error");
    input.addEventListener("input", () => {
        if (question.id === "playDate") {
            input.value = formatDateInput(input.value);
        }
        userMeta[question.id] = input.value;
        error.textContent = "";
    });
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            nextQuestion();
        }
    });
}

function saveState() {
    historyStack.push({
        currentStep,
        gender,
        userAnswers: JSON.parse(JSON.stringify(userAnswers)),
        userMeta: { ...userMeta },
        currentPath: currentPath.map(question => question.id),
        isIntroActive,
        currentIntroStep
    });
}

function handleSingleChoice(questionId, value) {
    saveState();
    userAnswers[questionId] = value;
    if (questionId === 0) {
        gender = value;
        currentPath = quizConfig.paths[gender].map(getQuestion);
    }
    advance();
}

function handleMultiChoice(button, value, questionId) {
    const mutexValue = quizConfig.mutuallyExclusive[String(questionId)];
    const isSelected = multiSelectState.includes(value);
    if (mutexValue) {
        if (value === mutexValue) {
            multiSelectState = isSelected ? [] : [mutexValue];
            els.options.querySelectorAll(".option-button").forEach(item => item.classList.remove("selected"));
            button.classList.toggle("selected", !isSelected);
            return;
        }
        if (multiSelectState.includes(mutexValue)) {
            multiSelectState = [];
            const mutexButton = els.options.querySelector(`[data-value="${mutexValue}"]`);
            if (mutexButton) mutexButton.classList.remove("selected");
        }
    }
    if (isSelected) {
        multiSelectState = multiSelectState.filter(item => item !== value);
        button.classList.remove("selected");
    } else {
        multiSelectState.push(value);
        button.classList.add("selected");
    }
}

function nextQuestion() {
    if (isIntroActive) {
        nextIntroQuestion();
        return;
    }
    const question = currentPath[currentStep];
    if (question.type === "multi") {
        if (multiSelectState.length === 0) {
            els.next.classList.add("shake");
            setTimeout(() => els.next.classList.remove("shake"), 400);
            return;
        }
        userAnswers[question.id] = [...multiSelectState];
    }
    saveState();
    advance();
}

function nextIntroQuestion() {
    const question = introQuestions[currentIntroStep];
    const input = els.options.querySelector(".text-input");
    const error = els.options.querySelector("#intro-error");
    let value = input ? input.value.trim() : "";

    if (question.id === "lineNickname") {
        if (value.includes("畔")) {
            userMeta.lineNickname = value;
            const urlParams = new URLSearchParams(window.location.search);
            const urlKey = urlParams.get("key") || urlParams.get("pan");
            if (urlKey) {
                openSecretPanScreen(urlKey);
            } else {
                const keyModal = document.getElementById("secret-key-modal");
                if (keyModal) keyModal.classList.remove("hidden");
            }
            return;
        }

        if (value.includes("游泉") || value.toLowerCase() === "admin") {
            userMeta.lineNickname = value;
            checkAdminAuthAndOpen();
            return;
        }
    }

    if (question.id === "playDate") {
        value = formatDateInput(value);
        if (input) input.value = value;
    }
    if (!validateIntroValue(question.id, value)) {
        error.textContent = question.error;
        return;
    }
    userMeta[question.id] = value;
    saveState();
    if (currentIntroStep < introQuestions.length - 1) {
        currentIntroStep += 1;
        renderIntroQuestion();
        return;
    }
    isIntroActive = false;
    currentPath = [getQuestion(0)];
    currentStep = 0;
    renderQuestion();
}

function advance() {
    if (currentStep < currentPath.length - 1) {
        currentStep += 1;
        renderQuestion();
        return;
    }
    calculateAndShowResult();
}

function prevQuestion() {
    const previousState = historyStack.pop();
    if (!previousState) return;
    currentStep = previousState.currentStep;
    gender = previousState.gender;
    userAnswers = previousState.userAnswers;
    userMeta = previousState.userMeta || { lineNickname: "", playDate: "" };
    currentPath = previousState.currentPath.map(getQuestion);
    isIntroActive = Boolean(previousState.isIntroActive);
    currentIntroStep = previousState.currentIntroStep || 0;
    if (isIntroActive) {
        renderIntroQuestion();
        return;
    }
    renderQuestion();
}

// ── 修正後的判定邏輯 ────────────────────────────────────────────
// 使用「標準化百分比」（原始分 ÷ 滿分）來比較，確保公平判定。
// 允許負分（如：-14%）與超過 100%（如：114%）的真實數據表現。
function calculateAndShowResult() {
    const scores = Object.fromEntries(
        Object.keys(quizConfig.characters).map(id => [id, 0])
    );
    const answers = normalizeAnswers(userAnswers);
    const rules = quizConfig.scoring[gender];

    rules.forEach(rule => {
        const answer = answers[rule.questionId];
        const matched = Array.isArray(answer)
            ? answer.includes(rule.value)
            : answer === rule.value;
        if (!matched) return;
        Object.entries(rule.scores).forEach(([characterId, delta]) => {
            scores[characterId] += delta;
        });
    });

    let targetIds = [...quizConfig.targetCharacters[gender]];
    // 避開同性 DM 戀愛線 (BL / GL)：
    // 女 DM 模式下，女玩家避開 畔（女生版） (id: "4")
    // 男 DM 模式下，男玩家避開 畔（男生版） (id: "1")
    if (gender === "F" && dmGender === "F") {
        targetIds = targetIds.filter(id => id !== "4");
    } else if (gender === "M" && dmGender === "M") {
        targetIds = targetIds.filter(id => id !== "1");
    }

    const highestId = targetIds.reduce((bestId, characterId) => {
        const pctBest = scores[bestId] / quizConfig.maxScores[bestId];
        const pctCurr = scores[characterId] / quizConfig.maxScores[characterId];
        return pctCurr > pctBest ? characterId : bestId;
    }, targetIds[0]);

    renderResult(highestId, scores, targetIds);
}
// ───────────────────────────────────────────────────────────────

function validateIntroValue(id, value) {
    if (id === "lineNickname") return String(value || "").trim().length > 0;
    if (id === "playDate") {
        const formatted = formatDateInput(value);
        // 允許包含 0000/00/00 在內的任何 8 位數字日期排版格式
        return /^\d{4}\/\d{2}\/\d{2}$/.test(formatted);
    }
    return true;
}

function formatDateInput(value) {
    let str = String(value || "").trim();
    if (!str) return "";

    // 若含分隔符 /, -, .，例如 2026/7/8、2026-07-08、2026.7.8
    if (/[/\-.]/.test(str)) {
        const parts = str.split(/[/\-.]/).map(p => p.trim()).filter(Boolean);
        if (parts.length === 3) {
            let [y, m, d] = parts;
            if (y.length === 2) y = "20" + y;
            m = m.padStart(2, "0");
            d = d.padStart(2, "0");
            return `${y}/${m}/${d}`;
        }
    }

    // 若為純數字（如 20260708 或 202678）
    const digits = str.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}/${digits.slice(4)}`;
    return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6, 8)}`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function sanitizeUrl(url) {
    const str = String(url);
    if (/['"\\()]/.test(str)) return "";
    return str;
}

function renderResult(highestId, scores, targetIds) {
    const character = quizConfig.characters[highestId];
    const maxScore = quizConfig.maxScores[highestId];
    const matchPercent = Math.round((scores[highestId] / maxScore) * 100);

    const rankedIds = [...targetIds].sort((a, b) => {
        const pctA = scores[a] / quizConfig.maxScores[a];
        const pctB = scores[b] / quizConfig.maxScores[b];
        return pctB - pctA;
    });

    const scoreRows = rankedIds.map(id => {
        const pct = Math.round((scores[id] / quizConfig.maxScores[id]) * 100);
        const barWidth = Math.min(50, Math.abs(pct) / 2);
        const direction = pct < 0 ? "negative" : "positive";
        return `
            <div class="score-row">
                <div class="score-head-wrap">
                    <img class="score-avatar" src="${sanitizeUrl(quizConfig.characters[id].image)}" alt="" loading="lazy">
                    <div class="score-info">
                        <div class="score-head">
                            <span>${escapeHtml(quizConfig.characters[id].name)}</span>
                            <span>${pct}%</span>
                        </div>
                        <div class="score-track">
                            <div class="score-fill ${direction}" style="width: ${barWidth}%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    // 整理其他角色的分數資訊
    const otherRanked = rankedIds.slice(1);
    const formatScore = (id) => {
        if (!id) return "";
        const charName = quizConfig.characters[id].name;
        const pct = Math.round((scores[id] / quizConfig.maxScores[id]) * 100);
        return `${charName} ${pct}%`;
    };

    const other1 = formatScore(otherRanked[0]);
    const other2 = formatScore(otherRanked[1]);
    const other3 = formatScore(otherRanked[2]);
    const otherScoresStr = [other1, other2, other3].filter(Boolean).join("、");

    const lineNickname = userMeta.lineNickname || "未填";
    const playDate = userMeta.playDate || "未填";
    const copyText = `LINE 暱稱：${lineNickname}\n遊玩時間：${playDate}\n\n我在《向生而死》心測中測到了「${character.name}」\n匹配度：${matchPercent}%\n其他角色：${otherScoresStr}\n\n${character.resultText}\n\n你會走向哪一個角色？`;
    els.copy.dataset.copyText = copyText;

    // 取得選項完整中文內容的輔助函數
    function getAnswerText(questionId, val) {
        const question = getQuestion(questionId);
        if (!question || val === undefined || val === null) return "";
        if (Array.isArray(val)) {
            return val.map(v => {
                const opt = question.options.find(o => o.val === v);
                return opt ? opt.text : v;
            }).join(" ｜ ");
        } else {
            const opt = question.options.find(o => o.val === val);
            return opt ? opt.text : val;
        }
    }

    // 發送結果至 Google 試算表後台
    if (GOOGLE_SHEETS_WEB_APP_URL) {
        const payload = {
            "LINE 暱稱": lineNickname,
            "遊玩時間": playDate,
            "性別": gender === "M" ? "男" : "女",
            "愛人特質 (Q1)": getAnswerText(1, userAnswers[1]),
            "體驗愛情 (Q2)": getAnswerText(2, userAnswers[2]),
            "不能接受的雷點 (Q3/Q4)": gender === "M" ? getAnswerText(3, userAnswers[3]) : getAnswerText(4, userAnswers[4]),
            "是否扛壓 (Q5)": getAnswerText(5, userAnswers[5]),
            "互動輸出 (Q6)": getAnswerText(6, userAnswers[6]),
            "情感體驗 (Q7/Q8)": gender === "M" ? getAnswerText(8, userAnswers[8]) : getAnswerText(7, userAnswers[7]),
            "測出角色": character.name,
            "匹配度": matchPercent + "%",
            "其他角色分數": otherScoresStr
        };

        fetch(GOOGLE_SHEETS_WEB_APP_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        }).catch(err => console.error("後台傳送失敗:", err));
    }

    // Secret Pan & Youquan Logic
els.resultContent.innerHTML = `
        <article class="story-card" style="--result-image: url('${sanitizeUrl(character.image)}');">
            <div class="story-content">
                <div class="story-label">最契合角色</div>
                <h2 class="story-name">${escapeHtml(character.name)}</h2>
                <div class="story-match">匹配度 ${matchPercent}%</div>
            </div>
        </article>
        <section class="result-panel">
            <div class="player-meta">
                <span>LINE 暱稱｜${escapeHtml(lineNickname)}</span>
                <span>遊玩時間｜${escapeHtml(playDate)}</span>
            </div>
            <p class="result-analysis">${escapeHtml(character.resultText)}</p>
            <h3 class="panel-title">角色相性排行</h3>
            <div class="score-list">${scoreRows}</div>
        </section>
    `;

    currentResultData = {
        characterName: character.name,
        characterImage: character.image,
        resultText: character.resultText,
        matchPercent: matchPercent,
        lineNickname: lineNickname,
        playDate: playDate
    };

    showScreen("result");
}

async function copyResult() {
    const text = els.copy.dataset.copyText;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        els.copyStatus.textContent = "結果已複製";
    } catch (error) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        els.copyStatus.textContent = "結果已複製";
    }
}

function restartQuiz() {
    if (bgm) {
        bgm.pause();
        bgm.currentTime = 0;
    }
    isBgmOn = false;
    updateAudioButton();
    els.copyStatus.textContent = "";
    showScreen("home");
}

function getQuestion(id) {
    return quizConfig.questions.find(question => question.id === id);
}

function normalizeAnswers(answers) {
    return Object.fromEntries(
        Object.entries(answers).map(([key, value]) => [Number(key), value])
    );
}

// ── 羽毛與白色光子點擊特效 ─────────────────────────
function createFeatherPhotonEffect(e) {
    try {
        let x, y;
        if (e.touches && e.touches[0]) {
            x = e.touches[0].clientX;
            y = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches[0]) {
            x = e.changedTouches[0].clientX;
            y = e.changedTouches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        if (x === undefined || y === undefined || x === null || y === null) return;
        if (isNaN(x) || isNaN(y)) return;

        const ring = document.createElement("div");
        ring.className = "photon-ring";
        ring.style.left = x + "px";
        ring.style.top = y + "px";
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 600);

        const photonCount = 12;
        for (let i = 0; i < photonCount; i++) {
            const photon = document.createElement("div");
            photon.className = "falling-photon";

            const pxOffset = (Math.random() - 0.5) * 40;
            const pyOffset = (Math.random() - 0.5) * 20;
            const psize = (1.5 + Math.random() * 2.2) + "px";

            photon.style.left = (x + pxOffset) + "px";
            photon.style.top = (y + pyOffset) + "px";
            photon.style.setProperty("--p-size", psize);

            document.body.appendChild(photon);
            setTimeout(() => photon.remove(), 2300);
        }

        const SVG_FEATHERS = [
            `<svg viewBox="0 0 100 100" fill="none"><path d="M15 85 Q 40 55 85 15" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><path d="M85 15 C 70 20 50 30 38 48 C 30 60 25 72 20 80 C 26 77 34 68 44 57 C 56 43 72 28 85 15 Z" fill="#ffffff" opacity="0.95"/><path d="M85 15 C 75 12 58 18 42 32 C 28 45 20 58 15 72 C 20 68 30 62 43 50 C 58 36 74 22 85 15 Z" fill="#ffffff" opacity="0.95"/><path d="M72 24 L 62 20 M 60 34 L 50 28 M 48 45 L 38 38 M 36 56 L 28 48" stroke="rgba(255,255,255,0.75)" stroke-width="1.5"/></svg>`,
            `<svg viewBox="0 0 100 100" fill="none"><path d="M50 90 L 50 10" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><path d="M50 10 Q 25 30 25 60 Q 35 75 50 90 Q 65 75 75 60 Q 75 30 50 10 Z" fill="#ffffff" opacity="0.92"/><path d="M40 30 L 50 25 M 60 30 L 50 25 M 35 45 L 50 40 M 65 45 L 50 40" stroke="rgba(255,255,255,0.75)" stroke-width="1.5"/></svg>`,
            `<svg viewBox="0 0 100 100" fill="none"><path d="M10 50 Q 50 10 90 40" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><path d="M90 40 Q 50 20 10 50 Q 40 60 90 40 Z" fill="#ffffff" opacity="0.95"/><path d="M75 28 L 65 33 M 55 24 L 45 31 M 35 25 L 25 35" stroke="rgba(255,255,255,0.75)" stroke-width="1.5"/></svg>`,
            `<svg viewBox="0 0 100 100" fill="none"><path d="M50 85 Q 50 40 20 15 M 50 85 Q 50 40 80 15" stroke="#ffffff" stroke-width="3.5"/><path d="M50 85 C 30 60 10 40 20 15 C 35 30 45 60 50 85 Z" fill="#ffffff" opacity="0.9"/><path d="M50 85 C 70 60 90 40 80 15 C 65 30 55 60 50 85 Z" fill="#ffffff" opacity="0.9"/></svg>`,
            `<svg viewBox="0 0 100 100" fill="none"><path d="M30 85 Q 60 50 85 20" stroke="#ffffff" stroke-width="3.5"/><path d="M85 20 Q 40 30 20 60 Q 30 75 85 20 Z" fill="#ffffff" opacity="0.95"/></svg>`,
            `<svg viewBox="0 0 100 100" fill="none"><path d="M20 80 Q 50 50 80 20" stroke="#ffffff" stroke-width="3"/><path d="M80 20 C 65 25 45 35 30 55 C 22 65 18 75 15 80 C 22 75 30 65 42 52 C 55 38 70 25 80 20 Z" fill="#ffffff" opacity="0.95"/></svg>`
        ];

        const featherCount = 3;
        for (let f = 0; f < featherCount; f++) {
            const feather = document.createElement("div");
            feather.className = "floating-feather";
            feather.innerHTML = SVG_FEATHERS[Math.floor(Math.random() * SVG_FEATHERS.length)];

            const fxOffset = (Math.random() - 0.5) * 36;
            const fyOffset = (Math.random() - 0.5) * 16;
            const rotVal = (f % 2 === 0 ? 1 : -1) * (20 + Math.random() * 20) + "deg";

            feather.style.left = (x + fxOffset) + "px";
            feather.style.top = (y + pyOffset) + "px";
            feather.style.setProperty("--rot", rotVal);
            document.body.appendChild(feather);

            setTimeout(() => feather.remove(), 2300);
        }
    } catch (_) {}
}

window.addEventListener("pointerdown", createFeatherPhotonEffect);


// ── 隱藏彩蛋：游泉與畔 宿命記憶牆與管理後台 ──────────────────
const MEMORY_STORAGE_KEY = "youquan_pan_memories";

const DEFAULT_PAN_MEMORIES = [
    {
        img: "assets/畔（男）.jpg",
        text: "「向生而死，為你而活。\n無論身處何種輪迴，我都將在此等你。」"
    },
    {
        img: "assets/畔（女）.jpg",
        text: "「微光散盡之處，便是我們的重逢之地。\n別害怕，牽緊我的手。」"
    },
    {
        img: "assets/劇本封面.JPG",
        text: "「如果罪孽是宿命，\n那麼陪伴你是我唯一不悔的誓言。」"
    }
];

function compressImage(dataUrl, maxSide = 600, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxSide || height > maxSide) {
                if (width > height) {
                    height = Math.round((height * maxSide) / width);
                    width = maxSide;
                } else {
                    width = Math.round((width * maxSide) / height);
                    height = maxSide;
                }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

function getMemoriesData() {
    try {
        const data = localStorage.getItem(MEMORY_STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        return {};
    }
}

// 雲端同步終點：使用現有的 Google Apps Script（穩定、免費、永不消失）
// 同一個 GAS URL 完成测驗結果記錄 + 照片記憶牆同步雙功能
const CLOUD_SYNC_ENDPOINT = GOOGLE_SHEETS_WEB_APP_URL;

const DELETED_KEYS_STORAGE_KEY = "youquan_deleted_room_keys";

function getDeletedKeys() {
    try {
        const raw = localStorage.getItem(DELETED_KEYS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch(e) {
        return [];
    }
}

function addDeletedKey(key) {
    if (!key) return;
    const list = getDeletedKeys();
    if (!list.includes(key)) {
        list.push(key);
        try {
            localStorage.setItem(DELETED_KEYS_STORAGE_KEY, JSON.stringify(list));
        } catch(e) {}
    }
}

function removeDeletedKey(key) {
    if (!key) return;
    let list = getDeletedKeys();
    list = list.filter(k => k !== key);
    try {
        localStorage.setItem(DELETED_KEYS_STORAGE_KEY, JSON.stringify(list));
    } catch(e) {}
}

// 判斷是否為系統預設範例卡片
function isDefaultSampleCard(item) {
    if (!item || !item.img) return true;
    const imgStr = String(item.img);
    const txtStr = String(item.text || "");

    if (imgStr.includes("dummy_photo_url") || txtStr === "手機測試照片") return true;
    if (imgStr.includes("畔（男）") || imgStr.includes("畔（女）") || imgStr.includes("游泉") || imgStr.includes("劇本封面")) return true;
    if (txtStr.includes("向生而死，為你而活") || txtStr.includes("微光散盡之處") || txtStr.includes("如果罪孽是宿命")) return true;
    return false;
}

// 深度合併兩份記憶資料：相同 key 的陣列合併，以 img 去重，並自動剔除已被刪除的房號
function mergeMemoriesDeep(base, incoming) {
    const result = { ...base };
    const deletedKeys = getDeletedKeys();

    // 先過濾掉已被記錄刪除的房號
    deletedKeys.forEach(dk => {
        delete result[dk];
    });

    Object.keys(incoming).forEach(key => {
        // 如果這個房號在刪除名單中，跳過不合併！
        if (deletedKeys.includes(key)) return;

        const cleanIncoming = (incoming[key] || []).filter(item => !isDefaultSampleCard(item));
        if (!result[key]) {
            result[key] = cleanIncoming;
        } else {
            result[key] = result[key].filter(item => !isDefaultSampleCard(item));
            const existingImgs = new Set(result[key].map(item => item.img));
            const toAdd = cleanIncoming.filter(item => !existingImgs.has(item.img));
            result[key] = [...result[key], ...toAdd];
        }
    });
    return result;
}

// 雲端同步輔助：保留所有照片資料（包含網址與上傳圖檔）
function stripBase64ForCloud(data) {
    // 不再強制過濾，保留所有已設定的房號照片
    return data || {};
}

// 防抖計時器（一秒內多次儲存只推一次）
let _cloudPushTimer = null;

function saveMemoriesData(data, shouldPushToCloud = true, isOverride = false) {
    try {
        localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("記憶牆儲存失敗", e);
        alert("⚠️ 儲存空間已滿！瀏覽器本地容量上限約 5MB。\n請刪除部分過期房號照片，或改貼圖片網址 (Image URL)！");
        return false;
    }

    if (shouldPushToCloud && CLOUD_SYNC_ENDPOINT) {
        // 防抖 800ms：避免同一秒內發送多次請求
        clearTimeout(_cloudPushTimer);
        _cloudPushTimer = setTimeout(() => {
            const cloudPayload = stripBase64ForCloud(data);
            const action = isOverride ? "override_memories" : "save_memories";
            fetch(CLOUD_SYNC_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ _action: action, data: cloudPayload })
            }).then(res => {
                if (!res.ok) console.warn("雲端推送回應異常:", res.status);
                else console.info("雲端同步成功 (" + action + ")");
            }).catch(err => console.error("雲端自動推播失敗:", err));
        }, 800);
    }
    return true;
}

// 雲端拉取同步：收到 429/503 時退遯 5 分鐘
let _syncBackoffUntil = 0;

async function syncMemoriesFromCloud(isManual = false) {
    if (!CLOUD_SYNC_ENDPOINT) return;
    // 退遯期間靜默跳過（手動同步不受影響）
    if (!isManual && Date.now() < _syncBackoffUntil) return;

    try {
        const res = await fetch(CLOUD_SYNC_ENDPOINT + "?t=" + Date.now(), { cache: "no-store" });

        if (res.status === 429 || res.status === 503) {
            _syncBackoffUntil = Date.now() + 5 * 60 * 1000;
            console.warn("雲端被限流 (" + res.status + ")，5 分鐘後重試");
            if (isManual) showToast("⚠️ 雲端暫時限流，請稍後再試");
            return;
        }
        // GAS 用 GET 則回傳 HTML error page，這裡處理不存在的情況
        if (res.status === 404 || res.status === 400) {
            _syncBackoffUntil = Date.now() + 60 * 60 * 1000;
            console.warn("雲端端點異常 (" + res.status + ")，請檢查 GAS 部署狀態");
            if (isManual) showToast("⚠️ 雲端連線異常，請檢查 GAS 是否已重新部署");
            return;
        }

        if (res.ok) {
            const cloudData = await res.json();
            if (cloudData && typeof cloudData === "object" && Object.keys(cloudData).length > 0) {
                const localData = getMemoriesData();
                // 逐 key 合併，雲端的 URL 照片補充進本地
                const merged = mergeMemoriesDeep(localData, cloudData);
                // 只有真的有新資料才寫入，避免無意義 IO
                if (JSON.stringify(merged) !== JSON.stringify(localData)) {
                    saveMemoriesData(merged, false);
                    if (typeof renderAdminSavedList === "function") renderAdminSavedList();
                }
                if (isManual) {
                    renderAdminSavedList();
                    showToast("✨ 已成功與雲端照片同步！");
                }
            } else if (isManual) {
                showToast("雲端目前尚無備份照片");
            }
        }
    } catch (e) {
        console.info("雲端記憶同步跳過", e);
        if (isManual) showToast("雲端同步連線失敗，請檢查網路");
    }
}

// 頁面載入時拉一次，之後每 10 秒自動同步最新照片
syncMemoriesFromCloud(false);
setInterval(() => syncMemoriesFromCloud(false), 10000);

function checkUrlSyncMemories() {
    const urlParams = new URLSearchParams(window.location.search);
    const syncParam = urlParams.get("sync_memories");
    if (syncParam) {
        try {
            const jsonStr = decodeURIComponent(atob(syncParam));
            const syncedData = JSON.parse(jsonStr);
            if (syncedData && typeof syncedData === "object") {
                const localData = getMemoriesData();
                // 逐 key 合併陣列，不互相覆蓋
                const merged = mergeMemoriesDeep(localData, syncedData);
                saveMemoriesData(merged);
                showToast("✨ 已成功與電腦照片同步！");
            }
        } catch (e) {
            console.error("同步連結解析失敗:", e);
        }
    }
}

let activeSecretKey = "";
let maxPolaroidZIndex = 100;

function initPolaroidDrag(card, cardIndex) {
    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    function onPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        playPaperSFX();
        
        isDragging = true;
        hasMoved = false;
        card.classList.add("dragging");
        maxPolaroidZIndex++;
        card.style.zIndex = maxPolaroidZIndex;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startX = clientX;
        startY = clientY;

        initialLeft = card.offsetLeft;
        initialTop = card.offsetTop;

        const onPointerMove = (evt) => {
            if (!isDragging) return;

            const curX = evt.touches ? evt.touches[0].clientX : evt.clientX;
            const curY = evt.touches ? evt.touches[0].clientY : evt.clientY;
            const deltaX = curX - startX;
            const deltaY = curY - startY;

            if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
                hasMoved = true;
            }

            if (evt.cancelable) evt.preventDefault();

            card.style.left = (initialLeft + deltaX) + "px";
            card.style.top = (initialTop + deltaY) + "px";
        };

        const onPointerUp = () => {
            if (!isDragging) return;
            isDragging = false;
            card.classList.remove("dragging");

            // 若位移距離極小，判定為點擊 -> 觸發照片放大 Modal
            if (!hasMoved) {
                bringPolaroidToFront(card);
            } else {
                // 儲存手動調整後的位置與層級
                if (activeSecretKey && cardIndex !== undefined) {
                    const allData = getMemoriesData();
                    if (!allData[activeSecretKey]) {
                        allData[activeSecretKey] = DEFAULT_PAN_MEMORIES.map(m => ({ ...m }));
                    }
                    if (allData[activeSecretKey][cardIndex]) {
                        allData[activeSecretKey][cardIndex].left = card.style.left;
                        allData[activeSecretKey][cardIndex].top = card.style.top;
                        allData[activeSecretKey][cardIndex].zIndex = card.style.zIndex;
                        saveMemoriesData(allData, true);
                    }
                }
            }

            window.removeEventListener("mousemove", onPointerMove);
            window.removeEventListener("mouseup", onPointerUp);
            window.removeEventListener("touchmove", onPointerMove);
            window.removeEventListener("touchend", onPointerUp);
        };

        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mouseup", onPointerUp);
        window.addEventListener("touchmove", onPointerMove, { passive: false });
        window.addEventListener("touchend", onPointerUp);
    }

    card.addEventListener("mousedown", onPointerDown);
    card.addEventListener("touchstart", onPointerDown, { passive: true });
}

let isYouquanAdminMode = false;

async function openSecretPanScreen(key, fromAdmin = false) {
    if (fromAdmin) {
        isYouquanAdminMode = true;
    }
    activeSecretKey = (key || "").trim().toLowerCase();
    
    // 進入時自動先從雲端拉取最新照片
    await syncMemoriesFromCloud();

    const allData = getMemoriesData();
    let memories = allData[activeSecretKey];

    // 過濾非預設卡片的真正自訂照片
    memories = (memories || []).filter(item => !isDefaultSampleCard(item));

    if (memories.length === 0) {
        if (!fromAdmin) {
            // 普通玩家輸入未創建或錯誤的密碼，彈出提示並攔截
            alert("噠噠❌！密碼錯啦！小笨蛋！");
            return;
        } else {
            // 管理員後台預覽未設定的房間時，暫時展示範例
            memories = DEFAULT_PAN_MEMORIES.map(m => ({ ...m }));
        }
    }

    const wallEl = document.getElementById("polaroid-wall");
    if (wallEl) {
        const n = memories.length;

        const CARD_H = 260;
        const MIN_PEEK = 65;
        const ROW_H_MAX = CARD_H - 60;

        let rowH;
        if (n <= 5) {
            rowH = ROW_H_MAX;
        } else {
            rowH = Math.max(MIN_PEEK, ROW_H_MAX - (n - 5) * 30);
        }

        const rand = (seed) => (((seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff);

        const positions = memories.map((_, i) => {
            const isLeft = i % 2 === 0;
            const r = rand(i * 13 + 7);
            const leftPct = isLeft
                ? 2 + r * 20
                : 50 + r * 16;
            const topPx = i * rowH + rand(i * 31 + 17) * 20;
            return { left: leftPct, top: Math.round(topPx) };
        });

        const totalH = (positions[n - 1]?.top ?? 0) + CARD_H + 80;
        wallEl.style.minHeight = totalH + "px";

        wallEl.innerHTML = memories.map((item, index) => {
            const rotSeed = rand(index * 17 + 5);
            const rot = Math.round((rotSeed * 28 - 14) * 10) / 10;
            const { left, top } = positions[index];

            const cardLeft = item.left !== undefined ? item.left : (typeof left === "number" ? `${left}%` : `${left}px`);
            const cardTop = item.top !== undefined ? item.top : `${top}px`;
            const cardZIndex = item.zIndex !== undefined ? item.zIndex : (index + 1);

            return `
                <div class="polaroid-card"
                     style="--rot: ${rot}deg; left: ${cardLeft}; top: ${cardTop}; z-index: ${cardZIndex};">
                    <div class="polaroid-tape"></div>
                    <div class="polaroid-img-wrap">
                        <img src="${sanitizeUrl(item.img)}" alt="memory" loading="lazy" />
                    </div>
                    ${item.text ? `<div class="polaroid-note">${escapeHtml(item.text)}</div>` : ""}
                </div>
            `;
        }).join("");

        wallEl.querySelectorAll(".polaroid-card").forEach((card, idx) => initPolaroidDrag(card, idx));
    }

    playUnlockSFX();
    
    // 只有從「游泉後台」進入預覽時，才顯示「返回游泉後台」按鈕；普通玩家「畔」看不到
    const toAdminBtn = document.getElementById("secret-to-admin-button");
    if (toAdminBtn) {
        toAdminBtn.style.display = isYouquanAdminMode ? "" : "none";
    }

    showScreen("secret-pan");

    // 歡迎問候彈窗：點空白處或 5 秒後自動關閉
    const greetingModal = document.getElementById("greeting-modal");
    if (greetingModal) {
        greetingModal.classList.remove("hidden");

        let greetingClosed = false;
        function closeGreeting() {
            if (greetingClosed) return;
            greetingClosed = true;
            greetingModal.classList.add("hidden");
        }

        // 5 秒自動關閉
        const timer = setTimeout(closeGreeting, 5000);

        // 點擊遮罩（空白處）關閉
        function onOverlayClick(e) {
            if (e.target === greetingModal) {
                clearTimeout(timer);
                closeGreeting();
                greetingModal.removeEventListener("click", onOverlayClick);
            }
        }
        greetingModal.addEventListener("click", onOverlayClick);

        // 按鈕也能關閉
        const btn = document.getElementById("greeting-close");
        if (btn) btn.onclick = () => { clearTimeout(timer); closeGreeting(); };
    }
}

// 點擊拍立得卡片：移至最上層並開啟放大瀏覽
window.bringPolaroidToFront = function(card) {
    const allCards = document.querySelectorAll(".polaroid-card");
    let maxZ = 0;
    allCards.forEach(c => {
        const z = parseInt(c.style.zIndex) || 0;
        if (z > maxZ) maxZ = z;
        c.classList.remove("on-top");
    });
    card.classList.add("on-top");
    card.style.zIndex = maxZ + 1;

    // 擷取相片與留言，開啟放大檢視 Modal
    const imgEl = card.querySelector("img");
    const noteEl = card.querySelector(".polaroid-note");
    const imgSrc = imgEl ? imgEl.src : "";
    const noteText = noteEl ? noteEl.textContent.trim() : "";

    if (imgSrc) {
        openPhotoLightbox(imgSrc, noteText);
    }
};

function openPhotoLightbox(imgSrc, noteText) {
    const modal = document.getElementById("photo-lightbox-modal");
    const imgEl = document.getElementById("lightbox-img");
    const noteEl = document.getElementById("lightbox-note");
    if (!modal || !imgEl || !noteEl) return;

    imgEl.src = imgSrc;
    if (noteText) {
        noteEl.textContent = noteText;
        noteEl.style.display = "block";
    } else {
        noteEl.textContent = "";
        noteEl.style.display = "none";
    }
    modal.classList.remove("hidden");
}

function closePhotoLightbox() {
    const modal = document.getElementById("photo-lightbox-modal");
    if (modal) modal.classList.add("hidden");
}

const ADMIN_PASSWORD = "124120";
const ADMIN_AUTH_KEY = "youquan_admin_authenticated";

function checkAdminAuthAndOpen() {
    // 1. 支援 URL 參數直接驗證 (如 ?admin_pwd=124120 或 ?pwd=124120 或 ?admin=124120)
    const urlParams = new URLSearchParams(window.location.search);
    const pwdParam = urlParams.get("admin_pwd") || urlParams.get("pwd") || urlParams.get("admin");
    if (pwdParam === ADMIN_PASSWORD) {
        openYouquanAdminModal();
        return;
    }

    // 2. 若先前已登入/免密碼驗證通過，直接開啟後台 Modal
    try {
        if (localStorage.getItem(ADMIN_AUTH_KEY) === "true") {
            openYouquanAdminModal();
            return;
        }
    } catch (e) {}

    // 3. 否則彈出密碼驗證 Modal
    showAdminAuthModal();
}

function showAdminAuthModal() {
    const modal = document.getElementById("youquan-admin-auth-modal");
    const pwdInput = document.getElementById("admin-password-input");
    const errorEl = document.getElementById("admin-password-error");
    
    if (pwdInput) {
        pwdInput.value = "";
    }

    if (errorEl) {
        errorEl.textContent = "";
        errorEl.style.display = "none";
    }
    if (modal) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            if (pwdInput) pwdInput.focus();
        }, 100);
    }
}

function closeAdminAuthModal() {
    const modal = document.getElementById("youquan-admin-auth-modal");
    if (modal) modal.classList.add("hidden");
}

function submitAdminAuth(forcedPassword) {
    const pwdInput = document.getElementById("admin-password-input");
    const errorEl = document.getElementById("admin-password-error");
    const rememberCheckbox = document.getElementById("admin-remember-pwd");
    const modalCard = document.querySelector("#youquan-admin-auth-modal .modal-card");

    const inputPwd = forcedPassword !== undefined ? forcedPassword : (pwdInput ? pwdInput.value.trim() : "");

    if (inputPwd === ADMIN_PASSWORD) {
        if (rememberCheckbox && rememberCheckbox.checked) {
            try {
                localStorage.setItem(ADMIN_AUTH_KEY, "true");
            } catch (e) {}
        }
        closeAdminAuthModal();
        openYouquanAdminModal();
    } else {
        if (errorEl) {
            errorEl.textContent = "❌ 密碼錯誤，請重新輸入！";
            errorEl.style.display = "block";
        }
        if (modalCard) {
            modalCard.classList.remove("shake");
            void modalCard.offsetWidth;
            modalCard.classList.add("shake");
        }
    }
}

function openYouquanAdminModal() {
    const modal = document.getElementById("youquan-admin-modal");
    if (modal) modal.classList.remove("hidden");
    
    // 如果從密語小黑屋進入，自動帶入該密語/房號
    if (typeof activeSecretKey !== "undefined" && activeSecretKey) {
        const keyInput = document.getElementById("admin-key-input");
        if (keyInput) keyInput.value = activeSecretKey;
    }

    renderAdminSavedList();
}

function closeYouquanAdminModal() {
    const modal = document.getElementById("youquan-admin-modal");
    if (modal) modal.classList.add("hidden");
}

function renderAdminSavedList(filterQuery = "") {
    const listEl = document.getElementById("admin-saved-list");
    if (!listEl) return;
    const allData = getMemoriesData();

    // 自動清理舊有的預設範例卡片
    let hasCleaned = false;
    Object.keys(allData).forEach(k => {
        const origLen = allData[k] ? allData[k].length : 0;
        allData[k] = (allData[k] || []).filter(item => !isDefaultSampleCard(item));
        if (allData[k].length !== origLen) hasCleaned = true;
        if (allData[k].length === 0) delete allData[k];
    });

    if (hasCleaned) {
        saveMemoriesData(allData, true, true);
    }

    let keys = Object.keys(allData);

    const query = String(filterQuery || "").trim().toLowerCase();
    if (query) {
        keys = keys.filter(k => {
            if (k.toLowerCase().includes(query)) return true;
            const cards = allData[k] || [];
            return cards.some(c => (c.text || "").toLowerCase().includes(query));
        });
    }

    if (keys.length === 0) {
        listEl.innerHTML = query
            ? `<p style="font-size:14px;color:var(--muted);text-align:center;">無符合「${escapeHtml(query)}」的房號或留言卡片</p>`
            : `<p style="font-size:14px;color:var(--muted);text-align:center;">尚未設定任何專屬密語卡片</p>`;
        return;
    }

    const totalCardsCount = keys.reduce((sum, k) => sum + (allData[k] ? allData[k].length : 0), 0);

    const listControlsHtml = `
        <div class="admin-list-actions">
            <span>共 <strong>${keys.length}</strong> 個房號 / <strong>${totalCardsCount}</strong> 張照片</span>
            <div style="display:flex; gap:6px;">
                <button type="button" class="btn-sm" onclick="toggleAllRoomDetails(true)">📂 全部展開</button>
                <button type="button" class="btn-sm" onclick="toggleAllRoomDetails(false)">📁 全部折疊</button>
            </div>
        </div>
    `;

    listEl.innerHTML = listControlsHtml +
        keys.map(k => {
            const cards = allData[k];
            const cardItems = cards.map((card, idx) => {
                const imgSrc = card.img && card.img.startsWith("data:")
                    ? card.img
                    : sanitizeUrl(card.img);
                const safeTxt = (card.text || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
                return `
                    <div class="edit-card-item">
                        <img src="${imgSrc}" alt="card ${idx + 1}" />
                        <div class="edit-card-controls">
                            <textarea
                                id="ecm-${k}-${idx}"
                                class="modal-textarea"
                                rows="2"
                                placeholder="悄悄話（可留空）"
                                style="font-size:13px;margin:0;"
                            >${safeTxt}</textarea>
                            <div class="edit-card-actions">
                                <button type="button" class="btn-sm" onclick="moveCardItem('${k}',${idx},-1)" ${idx === 0 ? 'disabled' : ''} title="向上排序">⬆️</button>
                                <button type="button" class="btn-sm" onclick="moveCardItem('${k}',${idx},1)" ${idx === cards.length - 1 ? 'disabled' : ''} title="向下排序">⬇️</button>
                                <button type="button" class="btn-sm btn-sm-danger" onclick="deleteCardItem('${k}',${idx})" title="刪除此照片">🗑</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");

            return `
                <details class="edit-key-section" open>
                    <summary class="edit-key-title">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span class="collapse-icon">▼</span>
                            <span>🔑 房號：<strong>${escapeHtml(k)}</strong></span>
                            <span style="font-size:12px;font-weight:400;color:var(--muted);">(${cards.length}張)</span>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" class="btn-sm" onclick="event.stopPropagation(); previewAdminKey('${escapeHtml(k)}')">👁️ 預覽</button>
                            <button type="button" class="btn-sm btn-sm-danger" onclick="event.stopPropagation(); deleteAdminKey('${escapeHtml(k)}')">清空</button>
                        </div>
                    </summary>
                    <div class="edit-key-content" style="margin-top:10px;">
                        ${cardItems}
                        
                        <!-- 在特定房號底下追加上傳 -->
                        <div style="margin-top:10px; padding:8px 10px; background:rgba(182,139,74,0.06); border:1px dashed var(--line); border-radius:6px; display:flex; align-items:center; justify-content:space-between; font-size:12px;">
                            <span>➕ 追加照片至「${escapeHtml(k)}」：</span>
                            <input type="file" accept="image/*" multiple onchange="addPhotosToRoomKey('${escapeHtml(k)}', this)" style="font-size:11px; max-width:180px;" />
                        </div>

                        <div style="margin-top:10px; text-align:center;">
                            <button type="button" class="primary-button" style="width:100%; padding:8px; font-size:13px; background:var(--accent); border-color:var(--accent); color:#fff;" onclick="saveAllCardsForKey('${escapeHtml(k)}')">💾 儲存「${escapeHtml(k)}」所有變更</button>
                        </div>
                    </div>
                </details>
            `;
        }).join("");
}

window.addPhotosToRoomKey = async function(key, inputEl) {
    const files = Array.from(inputEl.files);
    if (!files.length) return;

    const progressEl = document.getElementById(`room-upload-progress-${key}`);
    if (progressEl) {
        progressEl.style.display = "block";
        progressEl.textContent = `⏳ 正在上傳與處理 ${files.length} 張照片...`;
    }

    const allData = getMemoriesData();
    if (!allData[key]) allData[key] = [];

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const img = await compressImage(e.target.result, 600, 0.65);
                resolve(img);
            };
            reader.readAsDataURL(file);
        });

        let photoUrl = compressed;
        if (CLOUD_SYNC_ENDPOINT) {
            try {
                const res = await fetch(CLOUD_SYNC_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ _action: "upload_image", data: compressed, filename: file.name || "photo.jpg" })
                });
                let result = null;
                try { result = await res.json(); } catch(e) {}
                if (result && result.ok && result.url) {
                    photoUrl = result.url;
                }
            } catch(e) {}
        }

        allData[key].push({ img: photoUrl, text: "" });
        successCount++;
    }

    saveMemoriesData(allData);
    showToast(`✨ 成功新增 ${successCount} 張照片至「${key}」並同步至雲端！`);
    renderAdminSavedList();
};

window.saveAllCardsForKey = function(key) {
    const allData = getMemoriesData();
    if (!allData[key]) return;
    
    let updatedCount = 0;
    allData[key].forEach((card, idx) => {
        const textarea = document.getElementById(`ecm-${key}-${idx}`);
        if (textarea) {
            card.text = textarea.value.trim();
            updatedCount++;
        }
    });

    saveMemoriesData(allData);
    alert(`✨ 已成功儲存「${key}」房號的所有照片與悄悄話！已自動同步至雲端 ☁️`);
    showToast(`✨ 成功儲存「${key}」房號的所有照片與悄悄話！`);
    renderAdminSavedList();
};

window.previewAdminKey = function(key) {
    closeYouquanAdminModal();
    openSecretPanScreen(key, true);
};

window.moveCardItem = function(key, index, direction) {
    const allData = getMemoriesData();
    if (!allData[key]) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= allData[key].length) return;
    const temp = allData[key][index];
    allData[key][index] = allData[key][targetIdx];
    allData[key][targetIdx] = temp;
    saveMemoriesData(allData);
    renderAdminSavedList();
};

window.toggleAllRoomDetails = function(openState) {
    const details = document.querySelectorAll("#admin-saved-list details.edit-key-section");
    details.forEach(d => d.open = openState);
};

window.saveCardEdit = function(key, index) {
    const allData = getMemoriesData();
    if (!allData[key] || !allData[key][index]) return;
    const textarea = document.getElementById(`ecm-${key}-${index}`);
    if (!textarea) return;
    allData[key][index].text = textarea.value.trim();
    saveMemoriesData(allData);
    // 短暫顯示已儲存提示
    const btn = textarea.closest(".edit-card-controls").querySelector(".btn-sm");
    const orig = btn.textContent;
    btn.textContent = "✓ 已儲存";
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
};

window.deleteCardItem = function(key, index) {
    if (!confirm(`確定刪除第 ${index + 1} 張照片？`)) return;
    const allData = getMemoriesData();
    if (!allData[key]) return;
    allData[key].splice(index, 1);
    if (allData[key].length === 0) delete allData[key];
    saveMemoriesData(allData, true, true);
    renderAdminSavedList();
};

window.deleteAdminKey = function(key) {
    if (!confirm(`確定清空「${key}」的所有照片嗎？`)) return;
    addDeletedKey(key);
    const allData = getMemoriesData();
    delete allData[key];
    saveMemoriesData(allData, true, true);
    renderAdminSavedList();
};

window.recoverAllHistoryPhotos = function() {
    let recoveredPhotos = [];
    try {
        // 掃描本地所有 localStorage key
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            const val = localStorage.getItem(k);
            if (!val) continue;

            // 尋找 Base64 圖片或 JSON 物件
            if (val.includes("data:image") || val.includes("http")) {
                try {
                    const parsed = JSON.parse(val);
                    if (typeof parsed === "object") {
                        Object.keys(parsed).forEach(rk => {
                            if (Array.isArray(parsed[rk])) {
                                parsed[rk].forEach(item => {
                                    if (item && item.img && !isDefaultSampleCard(item)) {
                                        recoveredPhotos.push(item);
                                    }
                                });
                            }
                        });
                    }
                } catch(e) {}
            }
        }
    } catch(e) {}

    if (recoveredPhotos.length === 0) {
        alert("未在此裝置的瀏覽器快取中找到其他歷史照片。請重新在手機點選「選擇照片」一次上傳即可！");
        return;
    }

    // 去重
    const uniqueImgs = new Set();
    const cleanList = [];
    recoveredPhotos.forEach(p => {
        if (!uniqueImgs.has(p.img)) {
            uniqueImgs.add(p.img);
            cleanList.push(p);
        }
    });

    const targetKey = "0318";
    removeDeletedKey(targetKey);

    const allData = getMemoriesData();
    if (!allData[targetKey]) allData[targetKey] = [];
    
    // 合併救援到的照片
    const existingImgs = new Set(allData[targetKey].map(i => i.img));
    let addedCount = 0;
    cleanList.forEach(p => {
        if (!existingImgs.has(p.img)) {
            allData[targetKey].push(p);
            addedCount++;
        }
    });

    saveMemoriesData(allData, true, true);
    alert(`🚑 成功救援並復原 ${addedCount} 張歷史照片至房號「${targetKey}」！已同步至雲端 ☁️`);
    renderAdminSavedList();
};

let uploadedBase64Images = [];

function handleAdminPhotoUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    uploadedBase64Images = new Array(files.length).fill(null);
    const preview = document.getElementById("admin-photo-preview");

    // 隱藏 URL 留言欄（文件上傳模式用獨立留言）
    const urlMsgLabel = document.getElementById("admin-url-msg-label");
    const urlMsgInput = document.getElementById("admin-message-input");
    if (urlMsgLabel) urlMsgLabel.style.display = "none";
    if (urlMsgInput) urlMsgInput.style.display = "none";

    // 立刻顯示佔位預覽（每張都有進度提示）
    if (preview) {
        preview.innerHTML = files.map((file, i) => `
            <div class="admin-photo-item" data-idx="${i}" id="photo-item-${i}">
                <div style="position:relative;flex-shrink:0;">
                    <div id="photo-thumb-${i}" style="width:80px;height:80px;border-radius:4px;border:1.5px solid var(--line);background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:20px;">⏳</div>
                    <span id="photo-badge-${i}" style="position:absolute;top:2px;right:2px;background:rgba(100,80,0,0.85);color:white;font-size:9px;padding:1px 4px;border-radius:3px;">壓縮中</span>
                </div>
                <textarea
                    class="admin-per-photo-msg modal-textarea"
                    data-idx="${i}"
                    rows="2"
                    placeholder="第 ${i+1} 張照片的悴悴話（可留空）..."
                    style="flex:1;min-width:0;margin:0;font-size:15px;"
                ></textarea>
            </div>
        `).join("");
    }

    // 並行處理每張圖：極致壓縮 → 上傳 Drive / 雲端同步
    files.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = async function(evt) {
            const thumbEl = document.getElementById(`photo-thumb-${idx}`);
            const badgeEl = document.getElementById(`photo-badge-${idx}`);

            // 1. 高效壓縮 (限制最大邊長 600px，品質 0.65)
            const compressed = await compressImage(evt.target.result, 600, 0.65);
            if (thumbEl) thumbEl.innerHTML = `<img src="${compressed}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;" />`;

            // 2. 上傳至 Google Drive (透過 GAS)
            if (CLOUD_SYNC_ENDPOINT) {
                if (badgeEl) { badgeEl.textContent = "☁️ 上傳中"; badgeEl.style.background = "rgba(30,100,200,0.85)"; }
                try {
                    const res = await fetch(CLOUD_SYNC_ENDPOINT, {
                        method: "POST",
                        headers: { "Content-Type": "text/plain;charset=utf-8" },
                        body: JSON.stringify({ _action: "upload_image", data: compressed, filename: file.name || "photo.jpg" })
                    });
                    
                    let result = null;
                    try {
                        result = await res.json();
                    } catch (e) {
                        // 若手機瀏覽器攔截 JSON 解析，嘗試文字解析
                        const text = await res.text();
                        if (text && text.includes("http")) {
                            const match = text.match(/https?:\/\/[^\s"']+/);
                            if (match) result = { ok: true, url: match[0] };
                        }
                    }

                    if (result && result.ok && result.url) {
                        // 成功！使用 Drive 網址
                        uploadedBase64Images[idx] = result.url;
                        if (thumbEl) thumbEl.innerHTML = `<img src="${result.url}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;" />`;
                        if (badgeEl) { badgeEl.textContent = "✅ 已同步"; badgeEl.style.background = "rgba(20,140,60,0.85)"; }
                    } else {
                        // 使用壓縮後的輕量小圖儲存，同樣能寫入雲端
                        uploadedBase64Images[idx] = compressed;
                        if (badgeEl) { badgeEl.textContent = "☁️ 已輕量備援"; badgeEl.style.background = "rgba(180,100,0,0.85)"; }
                    }
                } catch (err) {
                    console.warn("上傳至 Drive 發生網路異常，啟用輕量雲端備援:", err);
                    uploadedBase64Images[idx] = compressed;
                    if (badgeEl) { badgeEl.textContent = "☁️ 已輕量備援"; badgeEl.style.background = "rgba(180,100,0,0.85)"; }
                }
            } else {
                uploadedBase64Images[idx] = compressed;
                if (badgeEl) { badgeEl.textContent = "💾 本機"; badgeEl.style.background = "rgba(100,100,100,0.7)"; }
            }
        };
        reader.readAsDataURL(file);
    });
}

function saveAdminMemory() {
    const keyInput = document.getElementById("admin-key-input");
    const urlInput = document.getElementById("admin-photo-url");
    const msgInput = document.getElementById("admin-message-input");

    const key = (keyInput ? keyInput.value : "").trim().toLowerCase();
    const url = (urlInput ? urlInput.value : "").trim();
    const urlMsg = (msgInput ? msgInput.value : "").trim();

    if (!key) {
        alert("請輸入玩家專屬密語或房號！");
        return;
    }

    removeDeletedKey(key);

    const allData = getMemoriesData();
    if (!allData[key]) allData[key] = [];

    if (uploadedBase64Images.length > 0) {
        // 文件上傳模式：讀取每張照片配獨立的留言輸入框
        const perPhotoItems = document.querySelectorAll(".admin-per-photo-msg");
        uploadedBase64Images.forEach((img, i) => {
            const msgEl = perPhotoItems[i];
            const msg = msgEl ? msgEl.value.trim() : "";
            allData[key].push({ img, text: msg });
        });
        saveMemoriesData(allData);

        document.getElementById("admin-photo-file").value = "";
        uploadedBase64Images = [];
        document.getElementById("admin-photo-preview").innerHTML = "";

        alert(`✨ 成功儲存照片與留言給「${key}」！已自動同步至雲端 ☁️`);
        showToast(`✨ 已成功儲存「${key}」房號的照片並同步至雲端！`);
    } else if (url) {
        // URL 模式：單張照片 + 留言
        allData[key].push({ img: url, text: urlMsg });
        saveMemoriesData(allData);

        if (urlInput) urlInput.value = "";
        if (msgInput) msgInput.value = "";
        const urlMsgLabel = document.getElementById("admin-url-msg-label");
        const urlMsgInputEl = document.getElementById("admin-message-input");
        if (urlMsgLabel) urlMsgLabel.style.display = "none";
        if (urlMsgInputEl) urlMsgInputEl.style.display = "none";

        alert(`✨ 成功儲存 1 張照片給「${key}」！已自動同步至雲端 ☁️`);
        showToast(`✨ 已成功儲存「${key}」房號的照片並同步至雲端！`);
    } else {
        alert("請上傳至少一張圖片，或貼上圖片網址！");
        return;
    }

    renderAdminSavedList();
}

function clearAdminKeyData() {
    const keyInput = document.getElementById("admin-key-input");
    const key = (keyInput ? keyInput.value : "").trim().toLowerCase();
    if (!key) {
        alert("請輸入要清空的密語/房號！");
        return;
    }
    if (confirm(`確定要清空密語「${key}」的所有照片嗎？`)) {
        window.deleteAdminKey(key);
        alert(`已清空「${key}」的資料！`);
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // Secret & Admin Event Listeners
    const secretBack = document.getElementById("secret-back-button");
    if (secretBack) secretBack.addEventListener("click", () => showScreen("home"));

    const secretToAdmin = document.getElementById("secret-to-admin-button");
    if (secretToAdmin) secretToAdmin.addEventListener("click", checkAdminAuthAndOpen);

    const secretAdminTrigger = document.getElementById("secret-admin-trigger");
    if (secretAdminTrigger) secretAdminTrigger.addEventListener("click", checkAdminAuthAndOpen);

    const adminAuthSubmit = document.getElementById("admin-auth-submit");
    if (adminAuthSubmit) {
        adminAuthSubmit.addEventListener("click", () => submitAdminAuth());
    }

    const adminAuthCancel = document.getElementById("admin-auth-cancel");
    if (adminAuthCancel) {
        adminAuthCancel.addEventListener("click", closeAdminAuthModal);
    }

    const adminPwdInput = document.getElementById("admin-password-input");
    if (adminPwdInput) {
        adminPwdInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitAdminAuth();
            }
        });
    }

    const adminToggleDmGenderBtn = document.getElementById("admin-toggle-dm-gender");
    if (adminToggleDmGenderBtn) {
        // 初始狀態顯示
        adminToggleDmGenderBtn.textContent = dmGender === "M" ? "切換為 女 GM 模式" : "切換為 男 GM 模式";
        adminToggleDmGenderBtn.addEventListener("click", () => {
            const nextDm = dmGender === "M" ? "F" : "M";
            setDmGender(nextDm);
            if (nextDm === "F") {
                showToast("✨ 已切換為：女 DM 模式 ♀（女玩家自動避開「畔」）");
                adminToggleDmGenderBtn.textContent = "切換為 男 GM 模式";
            } else {
                showToast("✨ 已切換為：男 DM 模式 ♂（男玩家自動避開「畔」）");
                adminToggleDmGenderBtn.textContent = "切換為 女 GM 模式";
            }
        });
    }

    const adminLockButton = document.getElementById("admin-lock-button");
    if (adminLockButton) {
        adminLockButton.addEventListener("click", () => {
            try {
                localStorage.removeItem(ADMIN_AUTH_KEY);
            } catch (e) {}
            showToast("🔒 已鎖定後台，下次需重新輸入密碼");
        });
    }

    // 跨裝置同步全自動，相關按鈕已移除

    // 後台搜尋輸入監聽
    const adminSearchInput = document.getElementById("admin-search-input");
    if (adminSearchInput) {
        adminSearchInput.addEventListener("input", (e) => {
            renderAdminSavedList(e.target.value.trim());
        });
    }

    // 結果海報按鈕監聽
    const posterBtn = document.getElementById("poster-button");
    if (posterBtn) {
        posterBtn.addEventListener("click", generateResultPoster);
    }

    const posterCloseBtn = document.getElementById("poster-close-btn");
    if (posterCloseBtn) {
        posterCloseBtn.addEventListener("click", () => {
            const modal = document.getElementById("poster-modal");
            if (modal) modal.classList.add("hidden");
        });
    }

    const posterDownloadBtn = document.getElementById("poster-download-btn");
    if (posterDownloadBtn) {
        posterDownloadBtn.addEventListener("click", () => {
            const canvas = document.getElementById("poster-canvas");
            if (!canvas) return;
            const a = document.createElement("a");
            a.href = canvas.toDataURL("image/png");
            a.download = `向生而死_測驗結果海報_${new Date().toISOString().slice(0,10)}.png`;
            a.click();
        });
    }

    // 按鈕通用紙張音效
    document.querySelectorAll(".primary-button, .secondary-button").forEach(btn => {
        btn.addEventListener("click", () => playPaperSFX());
    });

    const secretKeySubmit = document.getElementById("secret-key-submit");
    const secretKeyInput = document.getElementById("secret-key-input");
    
    const handleSecretKeySubmit = () => {
        const key = secretKeyInput ? secretKeyInput.value.trim() : "";
        const modal = document.getElementById("secret-key-modal");
        if (modal) modal.classList.add("hidden");
        
        if (key.includes("游泉") || key.toLowerCase() === "admin") {
            checkAdminAuthAndOpen();
        } else {
            openSecretPanScreen(key);
        }
    };

    if (secretKeySubmit) secretKeySubmit.addEventListener("click", handleSecretKeySubmit);
    if (secretKeyInput) {
        secretKeyInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSecretKeySubmit();
            }
        });
    }

    const secretKeyCancel = document.getElementById("secret-key-cancel");
    if (secretKeyCancel) secretKeyCancel.addEventListener("click", () => {
        const modal = document.getElementById("secret-key-modal");
        if (modal) modal.classList.add("hidden");
    });

    const adminClose = document.getElementById("admin-close-button");
    if (adminClose) adminClose.addEventListener("click", closeYouquanAdminModal);

    const adminSave = document.getElementById("admin-save-button");
    if (adminSave) adminSave.addEventListener("click", saveAdminMemory);

    const adminClear = document.getElementById("admin-clear-button");
    if (adminClear) adminClear.addEventListener("click", clearAdminKeyData);

    const adminPhotoFile = document.getElementById("admin-photo-file");
    if (adminPhotoFile) adminPhotoFile.addEventListener("change", handleAdminPhotoUpload);

    // 問候彈窗關閉
    const greetingClose = document.getElementById("greeting-close");
    if (greetingClose) greetingClose.addEventListener("click", () => {
        const modal = document.getElementById("greeting-modal");
        if (modal) modal.classList.add("hidden");
    });

    // URL 輸入時顯示留言欄
    const adminPhotoUrl = document.getElementById("admin-photo-url");
    if (adminPhotoUrl) adminPhotoUrl.addEventListener("input", () => {
        const hasUrl = adminPhotoUrl.value.trim().length > 0;
        const urlMsgLabel = document.getElementById("admin-url-msg-label");
        const urlMsgInput = document.getElementById("admin-message-input");
        if (urlMsgLabel) urlMsgLabel.style.display = hasUrl ? "" : "none";
        if (urlMsgInput) urlMsgInput.style.display = hasUrl ? "" : "none";
    });

    // 照片放大瀏覽 Lightbox 關閉監聽
    const lightboxModal = document.getElementById("photo-lightbox-modal");
    if (lightboxModal) {
        lightboxModal.addEventListener("click", (e) => {
            if (e.target === lightboxModal) closePhotoLightbox();
        });
    }
    const lightboxClose = document.getElementById("lightbox-close");
    if (lightboxClose) {
        lightboxClose.addEventListener("click", closePhotoLightbox);
    }

});

let currentResultData = null;

function drawCoverImage(ctx, img, x, y, w, h, r = 12) {
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.clip();

    if (img && img.complete && img.naturalWidth !== 0) {
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const targetAspect = w / h;
        let renderW, renderH, offsetX, offsetY;

        if (imgAspect > targetAspect) {
            renderH = h;
            renderW = h * imgAspect;
            offsetX = x - (renderW - w) / 2;
            offsetY = y;
        } else {
            renderW = w;
            renderH = w / imgAspect;
            offsetX = x;
            offsetY = y - (renderH - h) / 2;
        }
        ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
    } else {
        ctx.fillStyle = "#261618";
        ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
}

async function generateResultPoster() {
    if (!currentResultData) {
        alert("尚未取得測驗結果！");
        return;
    }

    const canvas = document.getElementById("poster-canvas");
    const imgEl = document.getElementById("poster-img");
    const modal = document.getElementById("poster-modal");
    if (!canvas || !imgEl || !modal) return;

    showToast("✨ 正在繪製您的專屬測驗海報…");

    const ctx = canvas.getContext("2d");
    const W = 1000;
    const H = 1500;
    canvas.width = W;
    canvas.height = H;

    // 1. Rich Atmospheric Background Gradient
    const bgGrad = ctx.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H / 2, W * 0.8);
    bgGrad.addColorStop(0, "#32161b");
    bgGrad.addColorStop(0.5, "#200d10");
    bgGrad.addColorStop(1, "#0f0507");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle Gold Border Lines
    ctx.strokeStyle = "rgba(197, 160, 89, 0.45)";
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    ctx.strokeStyle = "rgba(197, 160, 89, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(46, 46, W - 92, H - 92);

    // Corner Ornaments
    ctx.fillStyle = "rgba(197, 160, 89, 0.7)";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("⚜", 54, 76);
    ctx.textAlign = "right";
    ctx.fillText("⚜", W - 54, 76);
    ctx.fillText("⚜", W - 54, H - 54);
    ctx.textAlign = "left";
    ctx.fillText("⚜", 54, H - 54);

    // Header Title
    ctx.textAlign = "center";
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 38px 'LXGW WenKai TC', 'Noto Serif TC', serif";
    ctx.fillText("「 向 生 而 死 」 劇 本 心 理 測 驗", W / 2, 105);

    ctx.fillStyle = "rgba(255, 248, 238, 0.65)";
    ctx.font = "20px 'LXGW WenKai TC', sans-serif";
    ctx.fillText(`LINE 暱稱：${currentResultData.lineNickname}   ｜   遊玩時間：${currentResultData.playDate}`, W / 2, 148);

    // Main Card Frame (Dark Vintage Parchment Card)
    const cardY = 185;
    const cardW = 840;
    const cardH = 1180;
    const cardX = (W - cardW) / 2;

    // Card Shadow
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;

    ctx.fillStyle = "#fffbf5";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 20);
    else ctx.rect(cardX, cardY, cardW, cardH);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(182, 139, 74, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Load Character Avatar
    const avatarImg = new Image();
    avatarImg.crossOrigin = "anonymous";
    avatarImg.src = currentResultData.characterImage;
    await new Promise((resolve) => {
        avatarImg.onload = resolve;
        avatarImg.onerror = resolve;
    });

    // Character Image Frame inside Card
    const imgW = 760;
    const imgH = 520;
    const imgX = (W - imgW) / 2;
    const imgY = cardY + 40;

    // Draw Image Border & Frame
    ctx.fillStyle = "#15090b";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(imgX - 4, imgY - 4, imgW + 8, imgH + 8, 14);
    else ctx.rect(imgX - 4, imgY - 4, imgW + 8, imgH + 8);
    ctx.fill();

    drawCoverImage(ctx, avatarImg, imgX, imgY, imgW, imgH, 12);

    // Character Name & Label
    const textCenterY = imgY + imgH + 45;
    ctx.textAlign = "center";
    ctx.fillStyle = "#8c2838";
    ctx.font = "bold 20px 'LXGW WenKai TC', sans-serif";
    ctx.fillText("✦ 最 契 合 角 色 ✦", W / 2, textCenterY);

    ctx.fillStyle = "#1c1113";
    ctx.font = "bold 58px 'LXGW WenKai TC', 'Noto Serif TC', serif";
    ctx.fillText(currentResultData.characterName, W / 2, textCenterY + 65);

    // Match Badge Pill
    const badgeW = 260;
    const badgeH = 46;
    const badgeX = (W - badgeW) / 2;
    const badgeY = textCenterY + 88;

    const badgeGrad = ctx.createLinearGradient(badgeX, 0, badgeX + badgeW, 0);
    badgeGrad.addColorStop(0, "#8c2838");
    badgeGrad.addColorStop(1, "#5c1522");
    ctx.fillStyle = badgeGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 23);
    else ctx.rect(badgeX, badgeY, badgeW, badgeH);
    ctx.fill();

    ctx.fillStyle = "#fdfbf7";
    ctx.font = "bold 22px 'LXGW WenKai TC', sans-serif";
    ctx.fillText(`相 性 匹 配 度  ${currentResultData.matchPercent}%`, W / 2, badgeY + 31);

    // Decorative Divider Line
    ctx.fillStyle = "rgba(140, 40, 56, 0.25)";
    ctx.fillRect(cardX + 60, badgeY + 68, cardW - 120, 1.5);

    // Quote Box
    ctx.fillStyle = "#2c1c1e";
    ctx.font = "26px 'LXGW WenKai TC', 'Klee One', serif";
    const quoteLines = (currentResultData.resultText || "").split("\n");
    const quoteStartY = badgeY + 115;
    quoteLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, quoteStartY + i * 42);
    });

    // Branding Footer
    ctx.fillStyle = "rgba(255, 248, 238, 0.7)";
    ctx.font = "20px 'LXGW WenKai TC', sans-serif";
    ctx.fillText("游 泉 與 畔 · 宿 命 記 憶 牆 獨 家 呈 獻", W / 2, H - 65);

    imgEl.src = canvas.toDataURL("image/png");
    modal.classList.remove("hidden");
}
