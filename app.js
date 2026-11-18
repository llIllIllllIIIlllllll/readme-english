const STORAGE_WORDS = "readme-english:known-words";
const STORAGE_STREAK = "readme-english:morning-done";

const els = {
  projectTag: document.getElementById("project-tag"),
  sentenceEn: document.getElementById("sentence-en"),
  sentenceKo: document.getElementById("sentence-ko"),
  sentenceKoWrap: document.getElementById("sentence-ko-wrap"),
  btnToggleKo: document.getElementById("btn-toggle-ko"),
  badgeLevel: document.getElementById("badge-level"),
  stageCounter: document.getElementById("stage-counter"),
  stage: document.getElementById("speak-stage"),
  hint: document.getElementById("speak-hint"),
  playback: document.getElementById("playback"),
  glossBox: document.getElementById("gloss-box"),
  glossContent: document.getElementById("gloss-content"),
  btnCloseGloss: document.getElementById("btn-close-gloss"),
  checkQ: document.getElementById("check-q"),
  checkOptions: document.getElementById("check-options"),
  checkFeedback: document.getElementById("check-feedback"),
  planList: document.getElementById("plan-list"),
  wordGrid: document.getElementById("word-grid"),
  wordProgress: document.getElementById("word-progress"),
  wordFilterAll: document.getElementById("word-filter-all"),
  wordFilterToday: document.getElementById("word-filter-today"),
  briefList: document.getElementById("brief-list"),
  tabEasy: document.getElementById("tab-easy"),
  tabMid: document.getElementById("tab-mid"),
  tabAll: document.getElementById("tab-all"),
  tabPassage: document.getElementById("tab-passage"),
  stripChips: document.getElementById("strip-chips"),
  passageStage: document.getElementById("passage-stage"),
  passageTitle: document.getElementById("passage-title"),
  passageText: document.getElementById("passage-text"),
  passageKoWrap: document.getElementById("passage-ko-wrap"),
  passageKo: document.getElementById("passage-ko"),
  btnPassageListen: document.getElementById("btn-passage-listen"),
  btnPassageToggleKo: document.getElementById("btn-passage-toggle-ko"),
  btnListen: document.getElementById("btn-listen"),
  btnListenSlow: document.getElementById("btn-listen-slow"),
  btnListenSlower: document.getElementById("btn-listen-slower"),
  btnShadow: document.getElementById("btn-shadow"),
  btnRecord: document.getElementById("btn-record"),
  btnPrev: document.getElementById("btn-prev"),
  btnNext: document.getElementById("btn-next"),
};

let allMorning = [];
let activeLevel = "easy"; // Default to Easy (i) for Comprehensible Input
let activeSentences = [];
let morningIndex = 0;
let mediaRecorder = null;
let chunks = [];
let rawWordsData = null;
let currentWordFilter = "all";
let recycledVocabList = [];
let currentPassage = null;

function loadKnown() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_WORDS) || "[]"));
  } catch {
    return new Set();
  }
}

function saveKnown(set) {
  localStorage.setItem(STORAGE_WORDS, JSON.stringify([...set]));
}

function speak(text, rate = 0.88, targetEl = els.stage) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      els.hint.textContent = "이 브라우저는 음성 합성을 지원하지 않습니다.";
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    if (targetEl) targetEl.classList.add("is-listening");
    u.onend = () => {
      if (targetEl) targetEl.classList.remove("is-listening");
      resolve();
    };
    u.onerror = () => {
      if (targetEl) targetEl.classList.remove("is-listening");
      resolve();
    };
    window.speechSynthesis.speak(u);
  });
}

function filterSentences(level) {
  activeLevel = level;
  if (level === "all") {
    activeSentences = [...allMorning];
  } else {
    const filtered = allMorning.filter((item) => item.level === level);
    activeSentences = filtered.length ? filtered : [...allMorning];
  }
  morningIndex = 0;

  // Update tabs UI
  [els.tabEasy, els.tabMid, els.tabAll, els.tabPassage].forEach((t) => {
    if (t) t.classList.remove("active");
  });
  if (level === "easy" && els.tabEasy) els.tabEasy.classList.add("active");
  if (level === "mid" && els.tabMid) els.tabMid.classList.add("active");
  if (level === "all" && els.tabAll) els.tabAll.classList.add("active");

  // Show sentence stage, hide passage stage
  if (els.stage) els.stage.classList.remove("is-hidden");
  if (els.passageStage) els.passageStage.classList.add("is-hidden");

  renderMorning();
}

function showPassageView() {
  [els.tabEasy, els.tabMid, els.tabAll, els.tabPassage].forEach((t) => {
    if (t) t.classList.remove("active");
  });
  if (els.tabPassage) els.tabPassage.classList.add("active");

  if (els.stage) els.stage.classList.add("is-hidden");
  if (els.passageStage) els.passageStage.classList.remove("is-hidden");
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderSentenceText(item) {
  const glossMap = item.gloss || {};
  const recycled = new Set(item.recycledWords || []);
  const keys = Object.keys(glossMap).sort((a, b) => b.length - a.length);

  if (!keys.length) {
    els.sentenceEn.textContent = item.english;
    return;
  }

  // Build regex matching gloss keys
  const pattern = new RegExp(`\\b(${keys.map(escapeRegex).join("|")})\\b`, "gi");
  const html = item.english.replace(pattern, (match) => {
    const key = match.toLowerCase();
    const isRecycled = recycled.has(key);
    return `<span class="gloss-word${isRecycled ? " recycled" : ""}" data-word="${key}" tabindex="0">${match}</span>`;
  });

  els.sentenceEn.innerHTML = html;
}

function renderMorning() {
  const item = activeSentences[morningIndex];
  if (!item) {
    els.projectTag.textContent = "표시할 문장이 없습니다";
    els.sentenceEn.textContent = "";
    els.sentenceKo.textContent = "";
    return;
  }

  // Meta
  els.projectTag.textContent = item.project;
  els.projectTag.href = item.url || `https://github.com/${item.project}`;

  const isMid = item.level === "mid";
  els.badgeLevel.textContent = isMid ? "🚀 Mid (i+1)" : "🌱 Easy (i)";
  els.badgeLevel.className = `badge-level ${isMid ? "mid" : "easy"}`;
  els.stageCounter.textContent = `${morningIndex + 1} / ${activeSentences.length}`;

  // English sentence with interactive gloss
  renderSentenceText(item);

  // Korean translation: HIDDEN by default (Comprehensible Input principle)
  els.sentenceKo.textContent = item.korean;
  els.sentenceKoWrap.classList.add("is-hidden");
  els.btnToggleKo.textContent = "👁️ 한국어 전문 번역 보기";

  // Hide gloss box
  if (els.glossBox) els.glossBox.hidden = true;

  // Lightweight comprehension check
  renderCheck(item);

  els.hint.textContent = `소리 듣기(1.0x / 0.8x) → 문맥 파악 → 이해 확인 → 선택적 따라 말하기`;
}

function renderCheck(item) {
  if (!els.checkQ || !els.checkOptions) return;
  els.checkFeedback.textContent = "";
  els.checkFeedback.className = "check-feedback";

  const qData = item.checkQuestion;
  if (!qData || !qData.options?.length) {
    els.checkQ.textContent = "이 문장의 핵심 의미를 파악하셨나요?";
    els.checkOptions.innerHTML = `<button type="button" class="check-opt" id="btn-quick-check">✅ 네, 뜻을 이해했습니다!</button>`;
    const btn = document.getElementById("btn-quick-check");
    btn.onclick = () => {
      btn.classList.add("correct");
      els.checkFeedback.textContent = "좋습니다! 이제 입으로 소리 내어 말해보세요.";
      els.checkFeedback.className = "check-feedback ok";
    };
    return;
  }

  els.checkQ.textContent = qData.q;
  els.checkOptions.innerHTML = qData.options
    .map(
      (opt, idx) =>
        `<button type="button" class="check-opt" data-idx="${idx}">${opt}</button>`
    )
    .join("");

  const buttons = els.checkOptions.querySelectorAll(".check-opt");
  buttons.forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      if (idx === qData.answer) {
        buttons.forEach((b) => b.classList.remove("correct", "wrong"));
        btn.classList.add("correct");
        els.checkFeedback.textContent = "✅ 맞습니다! 문맥을 정확히 잡았습니다. 이제 편안하게 소리 내어 보세요.";
        els.checkFeedback.className = "check-feedback ok";
        markMorningDone();
      } else {
        btn.classList.add("wrong");
        els.checkFeedback.textContent = "다시 확인해보세요. 밑줄 친 단어 힌트를 누르면 힌트를 얻을 수 있습니다.";
        els.checkFeedback.className = "check-feedback err";
      }
    };
  });
}

function showGloss(word) {
  const item = activeSentences[morningIndex];
  if (!item) return;

  const glossMap = item.gloss || {};
  let def = glossMap[word.toLowerCase()];

  if (!def) {
    const vocab = recycledVocabList.find((v) => v.word.toLowerCase() === word.toLowerCase());
    def = vocab ? vocab.ko : "자주 쓰이는 개발 단어";
  }

  els.glossContent.innerHTML = `<strong>${word}</strong>: ${def}`;
  els.glossBox.hidden = false;
}

function onToggleKo() {
  const isHidden = els.sentenceKoWrap.classList.contains("is-hidden");
  if (isHidden) {
    els.sentenceKoWrap.classList.remove("is-hidden");
    els.btnToggleKo.textContent = "🙈 한국어 번역 가리기";
  } else {
    els.sentenceKoWrap.classList.add("is-hidden");
    els.btnToggleKo.textContent = "👁️ 한국어 전문 번역 보기";
  }
}

function markMorningDone() {
  const day = new Date().toISOString().slice(0, 10);
  localStorage.setItem(STORAGE_STREAK, day);
}

async function onListen(rate = 0.88) {
  const item = activeSentences[morningIndex];
  if (!item) return;
  els.hint.textContent = rate < 0.8 ? "소리를 꼼꼼하게 들으세요…" : "원어민 리듬에 집중하세요…";
  await speak(item.english, rate, els.stage);
  els.hint.textContent = "문맥으로 의미를 파악한 뒤, 원하시면 따라 말해보세요.";
}

async function onShadow() {
  const item = activeSentences[morningIndex];
  if (!item) return;
  els.hint.textContent = "귀로 들으면서 0.5초 뒤에 큰 소리로 따라 말하세요 (Shadowing).";
  await speak(item.english, 0.82, els.stage);
  markMorningDone();
  els.hint.textContent = "잘하셨습니다! 내 발음과 비교하고 싶다면 녹음을 눌러보세요.";
}

async function onRecord() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      els.stage.classList.remove("is-recording");
      els.btnRecord.textContent = "🎙️ 내 발음 녹음";
      const blob = new Blob(chunks, { type: "audio/webm" });
      els.playback.src = URL.createObjectURL(blob);
      els.playback.hidden = false;
      els.playback.play();
      els.hint.textContent = "내 녹음 재생 중 — 원어민 듣기와 억양·속도를 비교해보세요.";
      stream.getTracks().forEach((t) => t.stop());
      markMorningDone();
    };
    mediaRecorder.start();
    els.stage.classList.add("is-recording");
    els.btnRecord.textContent = "⏹️ 녹음 중지";
    els.hint.textContent = "녹음 중… 문장을 소리 내어 말한 뒤 중지를 누르세요.";
  } catch {
    els.hint.textContent = "마이크 권한이 필요합니다. 브라우저 주소창에서 허용해 주세요.";
  }
}

function onNext() {
  if (!activeSentences.length) return;
  morningIndex = (morningIndex + 1) % activeSentences.length;
  renderMorning();
}

function onPrev() {
  if (!activeSentences.length) return;
  morningIndex = (morningIndex - 1 + activeSentences.length) % activeSentences.length;
  renderMorning();
}

function renderPlan(briefing, knownCount, goal) {
  const day = new Date().toISOString().slice(0, 10);
  const done = localStorage.getItem(STORAGE_STREAK) === day;
  const steps = [
    {
      n: "01",
      t: done ? "아침 Comprehensible Input 완료" : "아침 인풋 세션 (Easy i → Mid i+1)",
      d: "듣기(1.0x / 0.8x)로 소리를 먼저 입력하고 문맥 단어 힌트로 뜻 파악",
    },
    {
      n: "02",
      t: "가벼운 쉐도잉 & (선택) 녹음",
      d: "이해한 1–2개 문장을 편안하게 소리 내어 말해보고 발음 비교",
    },
    {
      n: "03",
      t: `오늘 반복된 핵심 어휘 체크 (누적 ${knownCount}/${goal})`,
      d: "오늘 문장에 반복 등장한 README 고빈도 단어를 탭해 기억 강화",
    },
    {
      n: "04",
      t: "오늘의 오픈소스 브리핑 훑기",
      d: "여러 사이트에 동시 트렌딩된 프로젝트 설명으로 배경 지식 확장",
    },
  ];
  els.planList.innerHTML = steps
    .map(
      (s) =>
        `<li><span class="n">${s.n}</span><div><strong>${s.t}</strong><div class="sub">${s.d}</div></div></li>`
    )
    .join("");
}

function renderRecycledStrip(vocabList) {
  if (!els.stripChips) return;
  recycledVocabList = vocabList || [];

  if (!recycledVocabList.length) {
    document.getElementById("recycled-strip")?.remove();
    return;
  }

  els.stripChips.innerHTML = recycledVocabList
    .slice(0, 8)
    .map(
      (v) =>
        `<button type="button" class="chip" data-word="${v.word}">${v.word} (${v.count}회)</button>`
    )
    .join("");

  els.stripChips.onclick = (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const w = chip.dataset.word.toLowerCase();

    // Toggle chip active state
    els.stripChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");

    // Find sentence containing this word
    const foundIdx = activeSentences.findIndex((s) =>
      (s.recycledWords || []).some((rw) => rw.toLowerCase() === w)
    );
    if (foundIdx !== -1) {
      morningIndex = foundIdx;
      renderMorning();
      showGloss(w);
    } else {
      // Look in all sentences
      const anyIdx = allMorning.findIndex((s) =>
        (s.recycledWords || []).some((rw) => rw.toLowerCase() === w)
      );
      if (anyIdx !== -1) {
        filterSentences("all");
        morningIndex = anyIdx;
        renderMorning();
        showGloss(w);
      }
    }
  };
}

function renderPassage(passage) {
  if (!passage || !els.passageStage) return;
  currentPassage = passage;
  els.passageTitle.textContent = passage.title || "Today's OSS Story";
  els.passageText.textContent = passage.text || "";
  els.passageKo.textContent = passage.korean || "";
}

function renderWords(data) {
  rawWordsData = data;
  const known = loadKnown();
  const goal = data.goal3000 || 3000;
  els.wordProgress.textContent = `알고 있는 단어 ${known.size} / 목표 ${goal.toLocaleString()} (다음 목표 ${data.goal10000.toLocaleString()}) · ${data.coverageNote}`;

  const todayWordSet = new Set(recycledVocabList.map((v) => v.word.toLowerCase()));

  const wordsToShow =
    currentWordFilter === "today"
      ? data.words.filter((item) => todayWordSet.has(item.w.toLowerCase()))
      : data.words;

  els.wordGrid.innerHTML = wordsToShow
    .map((item) => {
      const on = known.has(item.w) ? "known" : "";
      const isToday = todayWordSet.has(item.w.toLowerCase());
      const vocabMeta = recycledVocabList.find((v) => v.word.toLowerCase() === item.w.toLowerCase());
      const badge = isToday
        ? `<span class="badge-recycled">오늘 아침 (${vocabMeta ? vocabMeta.count : "1"}회)</span>`
        : "";

      return `<button type="button" class="word-card ${on}" data-word="${item.w}">
        <p class="w">${item.w} ${badge}</p>
        <p class="meta">${item.pos} · ${item.ko}</p>
        <p class="ex">${item.ex}</p>
      </button>`;
    })
    .join("");

  els.wordGrid.onclick = (e) => {
    const card = e.target.closest(".word-card");
    if (!card) return;
    const w = card.dataset.word;
    const set = loadKnown();
    if (set.has(w)) set.delete(w);
    else set.add(w);
    saveKnown(set);
    card.classList.toggle("known", set.has(w));
    els.wordProgress.textContent = `알고 있는 단어 ${set.size} / 목표 ${goal.toLocaleString()} (다음 목표 ${data.goal10000.toLocaleString()}) · ${data.coverageNote}`;
  };

  return known.size;
}

function renderBriefing(briefing) {
  const multi = briefing.multi || [];
  els.briefList.innerHTML = multi
    .map(
      (p) => `<article class="brief-item">
        <div class="sources">${(p.sources || []).join(" · ")}</div>
        <a href="https://github.com/${p.fullName}" target="_blank" rel="noreferrer">${p.fullName}</a>
        <div>${p.descriptionKo || p.description || ""}</div>
      </article>`
    )
    .join("");
}

// Event Listeners
els.btnListen?.addEventListener("click", () => onListen(1.0));
els.btnListenSlow?.addEventListener("click", () => onListen(0.8));
els.btnListenSlower?.addEventListener("click", () => onListen(0.65));
els.btnShadow?.addEventListener("click", onShadow);
els.btnRecord?.addEventListener("click", onRecord);
els.btnNext?.addEventListener("click", onNext);
els.btnPrev?.addEventListener("click", onPrev);
els.btnToggleKo?.addEventListener("click", onToggleKo);

els.sentenceEn?.addEventListener("click", (e) => {
  const glossEl = e.target.closest(".gloss-word");
  if (!glossEl) return;
  const word = glossEl.dataset.word;
  showGloss(word);
});

els.btnCloseGloss?.addEventListener("click", () => {
  if (els.glossBox) els.glossBox.hidden = true;
});

// Level selector tabs
els.tabEasy?.addEventListener("click", () => filterSentences("easy"));
els.tabMid?.addEventListener("click", () => filterSentences("mid"));
els.tabAll?.addEventListener("click", () => filterSentences("all"));
els.tabPassage?.addEventListener("click", showPassageView);

// Passage actions
els.btnPassageListen?.addEventListener("click", async () => {
  if (!currentPassage) return;
  await speak(currentPassage.text, 0.9, els.passageStage);
});

els.btnPassageToggleKo?.addEventListener("click", () => {
  if (!els.passageKoWrap) return;
  const isHidden = els.passageKoWrap.classList.contains("is-hidden");
  if (isHidden) {
    els.passageKoWrap.classList.remove("is-hidden");
    els.btnPassageToggleKo.textContent = "🙈 패시지 해석 가리기";
  } else {
    els.passageKoWrap.classList.add("is-hidden");
    els.btnPassageToggleKo.textContent = "👁️ 패시지 한국어 해석 보기";
  }
});

// Word filter tabs
els.wordFilterAll?.addEventListener("click", () => {
  currentWordFilter = "all";
  els.wordFilterAll.classList.add("active");
  els.wordFilterToday.classList.remove("active");
  if (rawWordsData) renderWords(rawWordsData);
});

els.wordFilterToday?.addEventListener("click", () => {
  currentWordFilter = "today";
  els.wordFilterToday.classList.add("active");
  els.wordFilterAll.classList.remove("active");
  if (rawWordsData) renderWords(rawWordsData);
});

// Keyboard navigation
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === "ArrowRight") onNext();
  if (e.key === "ArrowLeft") onPrev();
});

// Bootstrapping
const [briefing, words] = await Promise.all([
  fetch("./data/briefing-today.json").then((r) => r.json()),
  fetch("./data/words-starter.json").then((r) => r.json()),
]);

allMorning = briefing.morning?.length
  ? briefing.morning
  : [
      {
        id: "m-default",
        project: "readme-english",
        level: "easy",
        english: "I read one README sentence out loud every morning.",
        korean: "나는 매일 아침 README 문장 하나를 소리 내어 읽습니다.",
        recycledWords: ["read"],
        gloss: { read: "읽다" },
      },
    ];

renderRecycledStrip(briefing.recycledVocab);
renderPassage(briefing.passage);
filterSentences("easy");

const knownCount = renderWords(words);
renderPlan(briefing, knownCount, words.goal3000);
renderBriefing(briefing);
