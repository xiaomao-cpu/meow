let quizConfig = null;
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
      { "questionId": 5, "value": "C", "scores": { "2": 1, "3": 1 } },
      { "questionId": 6, "value": "B", "scores": { "1": 1 } },
      { "questionId": 6, "value": "C", "scores": { "2": 1, "3": 1 } },
      { "questionId": 8, "value": "A", "scores": { "1": 1 } },
      { "questionId": 8, "value": "B", "scores": { "1": 1 } },
      { "questionId": 8, "value": "C", "scores": { "1": 1 } },
      { "questionId": 8, "value": "D", "scores": { "2": 1 } },
      { "questionId": 8, "value": "E", "scores": { "2": 1 } },
      { "questionId": 8, "value": "F", "scores": { "3": 1 } },
      { "questionId": 8, "value": "G", "scores": { "2": 1 } },
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
      { "questionId": 4, "value": "F", "scores": { "4": -1, "7": -1 } },
      { "questionId": 4, "value": "A", "scores": { "5": -1, "6": -1 } },
      { "questionId": 4, "value": "B", "scores": { "5": -1 } },
      { "questionId": 4, "value": "E", "scores": { "5": -1 } },
      { "questionId": 4, "value": "G", "scores": { "6": -1 } },
      { "questionId": 4, "value": "H", "scores": { "6": -1 } },
      { "questionId": 4, "value": "I", "scores": { "6": -1, "7": -1 } },
      { "questionId": 4, "value": "J", "scores": { "6": -1 } },
      { "questionId": 4, "value": "D", "scores": { "7": -1 } },
      { "questionId": 5, "value": "B", "scores": { "4": 1, "7": 1 } },
      { "questionId": 5, "value": "C", "scores": { "5": 1, "6": 1 } },
      { "questionId": 6, "value": "A", "scores": { "5": 1 } },
      { "questionId": 6, "value": "B", "scores": { "4": 1 } },
      { "questionId": 6, "value": "C", "scores": { "6": 1, "7": 1 } },
      { "questionId": 7, "value": "A", "scores": { "4": 1, "7": 1 } },
      { "questionId": 7, "value": "B", "scores": { "4": 1 } },
      { "questionId": 7, "value": "C", "scores": { "4": 1 } },
      { "questionId": 7, "value": "D", "scores": { "7": 1 } },
      { "questionId": 7, "value": "E", "scores": { "5": 1 } },
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
    els.audio.classList.remove("hidden");
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
    els.audio.textContent = isBgmOn ? "關閉音樂" : "開啟音樂";
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
    els.next.textContent = currentIntroStep === introQuestions.length - 1 ? "接入頻道" : "下一題";
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
// 原版直接比原始分數，各角色滿分不同（7 或 6），會造成判定偏差。
// 改用「標準化百分比」（原始分 ÷ 滿分）來比較，確保公平判定。
// 負分時視為 0 參與比較，避免負分干擾結果，但結果頁仍顯示實際數值。
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

    const targetIds = quizConfig.targetCharacters[gender];

    const highestId = targetIds.reduce((bestId, characterId) => {
        const pctBest = Math.max(0, scores[bestId] / quizConfig.maxScores[bestId]);
        const pctCurr = Math.max(0, scores[characterId] / quizConfig.maxScores[characterId]);
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
    if (/^[\w./\- %()\u4e00-\u9fff\u3000-\u303f]+$/u.test(str)) return str;
    return "";
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
                <div class="score-head">
                    <span>${escapeHtml(quizConfig.characters[id].name)}</span>
                    <span>${pct}%</span>
                </div>
                <div class="score-track">
                    <div class="score-fill ${direction}" style="width: ${barWidth}%;"></div>
                </div>
            </div>
        `;
    }).join("");

    const lineNickname = userMeta.lineNickname || "未填";
    const playDate = userMeta.playDate || "未填";
    const copyText = `LINE 暱稱：${lineNickname}\n遊玩時間：${playDate}\n\n我在《向生而死》心測中測到了「${character.name}」\n匹配度：${matchPercent}%\n\n${character.resultText}\n\n你會走向哪一個角色？`;
    els.copy.dataset.copyText = copyText;

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
    els.audio.classList.add("hidden");
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
