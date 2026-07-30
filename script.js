let quizConfig = null;
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxaADhnMJQRW3narMXeIA7K8zPOcGtqOWQbChvJLNCx-MANNKJqh4rig1Tb15DvL-43/exec"; // 在此填入部署後的 Google Apps Script 網頁應用程式網址
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
let dmGender = "M"; // 預設游泉為男 DM

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

const bgm = new Audio("assets/bgm.mp3");
bgm.loop = true;

const introQuestions = [
    {
        id: "lineNickname",
        label: "LINE 暱稱",
        text: "請輸入你的 LINE 暱稱",
        placeholder: "例如：小光",
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

init();

async function init() {
    try {
        const response = await fetch("quiz.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`quiz.json ${response.status}`);
        quizConfig = await response.json();
    } catch (error) {
        quizConfig = FALLBACK_QUIZ_CONFIG;
        console.info("使用內建題目資料。若要讀取 quiz.json，請用本地伺服器開啟。", error);
    }
    els.start.addEventListener("click", startQuiz);
    els.restart.addEventListener("click", restartQuiz);
    els.copy.addEventListener("click", copyResult);
    els.prev.addEventListener("click", prevQuestion);
    els.next.addEventListener("click", nextQuestion);
    els.audio.addEventListener("click", toggleAudio);

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

    // 首頁標題「向生而死」連點 3 下直接切換 DM 模式並跳出提示
    let clickCount = 0;
    let clickTimer = null;
    const titleEl = document.getElementById("main-title");
    if (titleEl) {
        titleEl.addEventListener("click", () => {
            clickCount++;
            clearTimeout(clickTimer);
            if (clickCount >= 3) {
                const nextDm = dmGender === "M" ? "F" : "M";
                setDmGender(nextDm);
                if (nextDm === "F") {
                    showToast("✨ 已切換為：女 DM 模式 ♀（女玩家自動避開「畔」）");
                } else {
                    showToast("✨ 已切換為：男 DM 模式 ♂（男玩家自動避開「畔」）");
                }
                clickCount = 0;
            } else {
                clickTimer = setTimeout(() => { clickCount = 0; }, 700);
            }
        });
    }
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
    startBgm();
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

function showScreen(name) {
    els.home.classList.toggle("hidden", name !== "home");
    els.quiz.classList.toggle("hidden", name !== "quiz");
    els.result.classList.toggle("hidden", name !== "result");
}

function startBgm() {
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
    question.options.forEach(option => {
        if (option.femaleOnly && gender === "M") return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-button";
        button.textContent = option.text;
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
    if (id === "lineNickname") return value.length > 0;
    if (id === "playDate") {
        value = formatDateInput(value);
        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split("/").map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    }
    return true;
}

function formatDateInput(value) {
    const digits = String(value).replace(/\D/g, "").slice(0, 8);
    const parts = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean);
    return parts.join("/");
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
            nickname: lineNickname,
            playDate: playDate,
            gender: gender === "M" ? "男" : "女",
            q1: getAnswerText(1, userAnswers[1]),
            q2: getAnswerText(2, userAnswers[2]),
            q3_q4: gender === "M" ? getAnswerText(3, userAnswers[3]) : getAnswerText(4, userAnswers[4]),
            q5: getAnswerText(5, userAnswers[5]),
            q6: getAnswerText(6, userAnswers[6]),
            q7_q8: gender === "M" ? getAnswerText(8, userAnswers[8]) : getAnswerText(7, userAnswers[7]),
            character: character.name,
            matchPercent: matchPercent + "%",
            other1: other1,
            other2: other2,
            other3: other3,
            otherScores: otherScoresStr
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
    bgm.pause();
    bgm.currentTime = 0;
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
    let x = e.clientX;
    let y = e.clientY;
    if (x === undefined && e.touches && e.touches[0]) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    }
    if (x === undefined || y === undefined || x === null || y === null) return;

    // 1. 白色光子圓環
    const ring = document.createElement("div");
    ring.className = "photon-ring";
    ring.style.left = x + "px";
    ring.style.top = y + "px";
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 600);

    // 2. 零停頓直接勻速向下掉落的閃耀白色光子微粒 (12 顆)
    const photonCount = 12;
    for (let i = 0; i < photonCount; i++) {
        const photon = document.createElement("div");
        photon.className = "falling-photon";

        const pdx = (Math.random() - 0.5) * 50 + "px";
        const pdy = (75 + Math.random() * 85) + "px";
        const psize = (1.5 + Math.random() * 2.2) + "px";

        photon.style.left = x + "px";
        photon.style.top = y + "px";
        photon.style.setProperty("--p-dx", pdx);
        photon.style.setProperty("--p-dy", pdy);
        photon.style.setProperty("--p-size", psize);

        document.body.appendChild(photon);
        setTimeout(() => photon.remove(), 1200);
    }

    // 3. 零停頓直接勻速向下掉落的羽毛 (6 款內嵌 0 延遲 Base64 羽毛素材)
    const featherImages = [
    "data:image/png;base64,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",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIwAAAC0CAYAAABG6cT+AAAExklEQVR42u3Zb0hrdRzH8bldt7U/zHm9ypas7dpMZ+q9ptdNZF29gg5nNAkFUYgIDbF8IIj2wCAywgdaJhKp4BMxKiECMYXEECUy9EGRKNgDJdHKoEwpNcyvOVqijiAIt/cLDjv7/c7vPPidD9/zO+coFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACuifHx8fcmJyc/cLlct5mNKKVSqRRarfb09yoJCQnG47/sxsTE/KMvNjb2tD85OfmW/Go0GiY2EiUlJcX19va+Pjo6+q7X6713Pgih+vr63pC0DA4OvhnanpWVldrT0/Pa/Pz8J2tra4tzc3MT/f39XR6P565SqWSSI0VeXl7mxsbG12dV47i1tbXpssBIBVpZWflCjjObzbpge1pamv3o6OjH47/9FLK/m56e7mCmI0Bpaan35IL+Kld1a2trJVxg6urqnpFjNjc3vwltP2n6XdpXV1e/TElJedhgMKhtNlvi7OzseDA1zPY1J6Ho6up6RS5mc3Pz84FAoOyqwMhtpbu7+1U5JrRiqNVqCczuwcHB9+crSWNj47PBwHBbioDA+P3+BxUVFSVyMcMFRirGzs7OtyeH/CIL2mC7TqdTlZWVPVlUVOQ+PyY0MFeti3BNSFCCFzJcYNxu9x3p7+zsfDnck5RwOp225eXlz4PnZLYjTLjAzMzMfCz9NTU1T192joaGhrqTQ34OrmlES0vLC3LbQhQFRp6OpG9hYeFTk8mkvewcTU1Nz50c9kfIE9L+yMjIO7zgi7LAdHR0tEjfwMBA91XnMBqNGofDYZXbkc/nux+sSvv7+5t6vf4GsxwlgQmWC3nf8m/OKQvl7e3tVRlbW1tbySxHQWDkCUjaDw8Pf7hoXH19fe3ExMT7Q0NDb1209llaWvpMxg8PD7/NLEd4YOR3cXFxRtolOBeNk0fzYAWSzwDBBa48SZ317UuffHJgliM8MPIibm9v77ur3tRKMGQxfJaZ32Sd097e/pJ8m5KqJI3r6+tf8eIuCgIj+9Imi96rxsrX6bGxseHjC0xNTX2Ympr6CDMcYeRWYrFY4uURWsgbXPl6LRddAhFuvIyz2+2Wqqoqf1tb24uyyJXvSnIeZjcKyLsTucVMT09/xCMxwpIvzvIuxWq13mQ2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8D+KiYlhEnAxpVKp0Gg0itjY2NOgJCUlxVkslnidTqfS6/U3pF2tVivi4uIeMhqNGvmv1WoVKpWKyYumChLcTCaT1m63WxISEowSiIKCgpz8/Pwsj8dzNycnx5WRkfGobDabLdHlct2Oj483ZGdnP5acnHxLNoPBoGZGIzgkUhnMZrPOarXelMohQZF9qSxOp9PmdrvvyFZcXOyRwJSUlBTm5uY+Lm2ZmZnOxMREk9frvedwOKzSJ+MlTMxwBAZGKohUCJ/Pd1+qhFSM9PR0h1xw2QoLC5+QcEgQpNJUV1c/JdVG9v1+/4PKykpfeXl5sfyX0OTl5WUGAoEyOV5ubfhv/AkraUXINIHKZwAAAABJRU5ErkJggg==",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIwAAAC0CAYAAABG6cT+AAAEKElEQVR42u3ZbWjVZRgH4OlyW3M2XW20NZzDtZSxaQ2zjWXoli5Qm0IiQgjrg30Qi/altlyQs80RGjrMwGAmSQg2EtYiV0K+MCYDCcIMCQRjWBiByGpWa7d4aJgFvVEergsO/72c8z/wnB/3fT/PSUkBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOCWNnny5JSKiorSnJycrEmTJlkQ/tjatWsfHxsbGzly5Mi7ixcvfsiK8LuiogwMDHw49qvv29raXsjKykqzOtzUrl272i9duvTleFhGE6k5f/78p6WlpUX/xvtNnz79dqt+i1eZNWvWLO/v7+8ZGRkZnlBtvo12lZGR8bfvnzBt2rT0kpKSQqueBKGJitLR0fFiVJcJoRnbs2fPq8XFxQX/xHssXLiwYubMmXlWPElEBVi0aNGDx44d6x3PyuVEaM6cOTNQXV39wF+9b+zAqqqq7l+6dOnDUbHsxpJMYWFh7t69e18bHR39ejwvP13PzXd1dXU1f7aqRHXatGnTUxs3bmxctmzZooKCgjutcBKaMmVKSktLy7PDw8Ofj4fl50S1iXln6tSpt93sNXGmE0NtUVHR3cuXL6+NHdehQ4e6t2zZ8vzu3bs7a2pqKv/uTMT/XG1tbfXJkyc/GM/Kj4nQ7Nixoy03N/eOic+LEJWVlZWsXr36sTjTOXjw4Jtbt25tjtBt27atNapLVK6JYYsKFMHUopJsII4gHDhw4I04p0mEZv/+/a/n5eVlx3PS09NT5s+fPyd2VadPn/4kAtPZ2fnS5s2bn2ttbW2KA8E5c+bMSk1N/U1FmjVrVn5cSbLQzJgxIzOqxoSZZuzw4cNvx//iQ9+wYcOTFy9e/OLChQuf9fX1HWxvb2/Zvn37ywsWLChvaGhYGq0qAhOPCFh+fn5ODNIRpLlz5xZH9YkDw/hdxUmS0CxZsqQqKkcMwInQHD169L3169c/0dvb+07ib2fPnh2MnVZPT89bcY0Wtm7duob6+vpHYnCurKwsi4oUs06EJzMzMzVmm7S0tGstiiQJTFSSqBjRjiaGJobiq1evfnP958vnzp0bOn78+Psx6MZJ8s6dO1/p7u7eFRWnubn5mdg1NTU1PR3zTrSrefPm3Rf3jhbna4kkCEriEZUhPtTGxsa1p06d+uiG0FwTFSUCs2/fvq5oYUNDQx+fOHGiLypQhCZa16pVq+qjHcX94sCwvLz83tmzZ98z7q6YZ7SkWzwwsbOJa3Z2dkYcvq1cufLRFStW1A0ODvaPZ+SHG0MTXzHEGc6VK1e+6urq6ohwxAwTZzJRVSJwcU0MzRGSmG2iLcUs818Nwb8A6Djp6kTNFzkAAAAASUVORK5CYII=",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIcAAAC0CAYAAAC+CT8JAAAveUlEQVR42u3dB5Bd1X0GcNmEEgwBE4hDGUoMBEPABHAoQ4mBYAiYAA7goQSMMYQSwKEMJQZCMcWUCBiKDQRDEJgSyoCwgVACyAIsoVExkqxiFSRhSTu7EtKuhISyv9X9yPXOChtpV/sknzNzeW/vu+/p8c53v//3L+d/+vT5FGPNNddcZfPNN99wp5122nafffbZ9ZRTTjnutNNO+6frr7/+shdffPGJKVOm/HLRokUftB8fLVrxRlsjf7kPP/xw+gknnHCkOejTqOMzn/lMn1VXXbXPWmuttdqmm276Z1/72tf2vuCCC868++67/+OVV155euLEicPa2tqmrWjIGDFixM8b9buNGTNm0K677rrDaqut1meFGsDiS++yyy5/demll5779NNPPzh37twpLS0tE1YUYLz77rsDG/W79evX764+K8MAlNVXX73P+uuvv/a+++67O7NzxRVXXHD77bdf/+Mf//i2p5566r9eeumlJ996660XR40a9daECROGTp8+/VfA1P47NLcf83pjAgYOHPh8o4Fi1qxZE88555xTPve5z/2R33WlG/6nPulYZZVV+qy33nprbbnllptgngMOOGCvU0899fibbrrpiieffPKByZMnj1gO87Cg0bTPnXfeecMOO+yw9UoJiu4A1dprr736Vlttteluu+224xlnnPEtembRSj4eeOCBO/baa69dVjht0QgMtO666/7xRRdddNakSZOGr0ygoCs+//nPr1mYopuAsu222/4FRuFCz5kz570VDRC01o9+9KObvvzlL/9l/p/K6AGw0CziLY8//vh906ZNG9XAmGghyn3XrbfeerPPfvazBRTLa9ApfvSDDjrob/v27Xt1+2TMbwREvPDCC/8tgCV4uM4666xRZqqX2cTYeeedt/vZz372aG8AgoA+6qijDlljjTV+6zuV0WD6hPrfYIMN/gSr0CmPPPLIPSK5CxYsmNENof4F8+fP/43YjTSC+E5iEwUQK+hA73vsscdO7u5rrrnmkvvvv//2559//rFhw4a9DjgzZswYM3PmzHHvv//+aM8F7N55551XXSNVcMstt3z/9NNPP/HAAw/c54tf/OLGBQgr8RDZ5SpvsskmGxC422yzzeZf+tKXtvDoEHORSxK0w0TE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",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACqCAYAAABPubY0AAAlNklEQVR42u3dCbSu030G8Ju0IRFKFKlhGRpuhRJFaliGBhVqKFLDMjSqQokiMSxDDTWUKFLDMjSoUKJIDcvQoEKJIjWsokGFEkWKs8499+ZMufee3t+xn+v1Oefce869Vs453/6v9a7znW/+3v28z//Zz/7vvadMadP42Mc+NmXNNddcdU4s73biE5/4xJRFF110So0ao4qPf/zjU5ZYYolFl1pqqU81AVWjxgIDCyNVUNWoUaNGjRo1atSoUaNGjRo1atSoUaNGjRo1atSoUaNGjRo1atSoUaNGjRo1atSoUaNGjRo1atSoUaNGjRo1atSoUaNGjRo1atSoUaNGjRo1atSoUaNGjRo1atSoUaNGjRo1atSoUaNGjRo12i/s3FB3baix0GOzzTbb4MADD9x7lVVW+S0Aa4JskUUWqaCrMbZYccUVl/n+979/9S233HLNTjvttM3UqVNXCZiWX375pddYY42Vl1xyyU/WM1VjVAFE22233Za/+MUv/vfnP//5i9/73vf+3v+LLbbYr82JKWuvvfbq++2335987nOfW7GerRqjimWXXfY3sNbAe9Hx0ksvPXHuueeeusIKK/wmDfbFL35xnZtuuumqDTbYYO2aGmvMd9gM8tvf/vYZ06dPf72Aq7Onp+fN559//rGtt956Uylxn3322bWrq+u1Qw455E/t/1fPWo35ih122GGrBx544HagmnP0+tvb2/vWG2+88V/S4wEHHLDXGWeccfwrr7zy9GWXXXbuyiuvvFw9azXmGVjo9ddff+6JJ564fw6oeuYc0+cc04CL/nrmmWcevu222/7xvvvuuwW4br311mvprpoaa4wYtNSZZ555wtNPP/1vgPPOO++8BFhhLmmwu7v7jbfeeuuFe++995/ffvvt/6bF1llnnTUquGqMGCuttNKywPPjH//4XwFq1qxZ7/b39//fzJkz3wGuzs7O//E4LXbNNddc4jkvvPDC49tvv/0ffPKT1ZGoMYL18KMf/eju55577t8BBju9+eabzwMSYPnrADYMdsUVV/yd23TY0UcffUjdDb7GsLH33nvvAjyPPvroPUA1bdq0V1988cX/8BeI9Bbd9heg6C7MxgO78MIL/2bppZdevJ7FGh+KjTfeeD36CWjuuOOO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",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJEAAAC0CAYAAACUuc6mAABJiElEQVR42u3dB5RX5Z03cI2JupbV5DXJazmWVbMqa1k1azmWjboqr2XFvKJHdEWjsCALGMqhhLIIobyUpRyEUEIJJZRQDjChhLIUGQjlABNKYAgwmYEAc5gZmKE67/3ce5/sP7Mkm2xRwPtw7rnDv97/fb7P9/f9/Z7f83vOO+9z3s4///zzrr766q/Ur1+/bl5e3qTq6urj1Z9iy8/Pn9+qVavGV1111eWuJRxZO8vbdddd99VnnnnmscaNG9fv2rVr23nz5k1Zt27dksLCwnWlpaU7T506dTDq/6roOBQdR6Pjk+g4lv7tKEv/X1peXr47ahu3bNmSP3fu3Mndu3dv/84777x255133nrxxReflwucDETnOFt94QtfOO/SSy/94je+8Y0bAOzFF1/8u1deeeW5119//aW33nrrlffee6/em2+++X8dr7322t+/9NJLTz/11FOPAMsVV1xx8QUXXJABJGtZy1rWspa1rGUta1nLWtaylrWsZS1rWcta1rKWtaxlLWtZy1rWspa1rGUta1nLWtaylrWsZS1rWcta1rKWtaxlLWtZy1rWspa1rGUta1nLWtaylrXPc6tVq9Ytt9566/XZncjaf7rNnDlzXElx8ZZ77rr7tv+Oz8uqYXwO25VXXvlnWzZvyd+8qWDl3Xfd9Zd/zHuUXvl97cILLzwtiDJgnePtrrvu+samTZtWrFuzdsmtt9xy/X8EIEDJ/b/joosuOk9dnq9+9at/XhMwXu+5rJ3DTacr0LR3796tWwoK8r/+ta9d+YdABDDhfZdffvlFAAIonvvyl798SQCRs6JPqoR96Utfiv8fCkBl7RxtaglWV1dXLFqwcMbll11+0eleAwTqHvpbNbG77777Lz0GKEDk78suu+xCQMFKAAdgDoDzulwmy9o56q1VHjlS3L9f/26XXXrpv+ttjKIMXWAW5eiAAnAAyPH1r3/9SkALgLnpppuuAagbb7zxasDLmOgcbzpdEcxDpaW/atywUf3TdTjGuuaaa/6X5+6///6/uu2222689tprr3J4/0MPPfTXgPSVr3zlsm9+85t33nPPPbcJIwBa5tGdo3ooFLsMjY756KOP/h9GeuThh++r+Z5LLrnkAlVXAYYov/fee+/IBQoTh4m+9a1v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"
];

    const featherCount = 3;
    for (let f = 0; f < featherCount; f++) {
        const feather = document.createElement("img");
        feather.className = "floating-feather";
        feather.src = featherImages[Math.floor(Math.random() * featherImages.length)];
        feather.alt = "feather";

        const fdx = (Math.random() - 0.5) * 40 + "px";
        const rotVal = (f % 2 === 0 ? 1 : -1) * (30 + Math.random() * 30) + "deg";

        feather.style.left = x + "px";
        feather.style.top = y + "px";
        feather.style.setProperty("--f-dx", fdx);
        feather.style.setProperty("--rot", rotVal);
        document.body.appendChild(feather);

        setTimeout(() => feather.remove(), 1200);
    }
}

window.addEventListener("pointerdown", createFeatherPhotonEffect);
