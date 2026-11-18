const STORAGE_WORDS = "readme-english:known-words";
const STORAGE_STREAK = "readme-english:morning-done";

const els = {
  projectTag: document.getElementById("project-tag"),
  sentenceEn: document.getElementById("sentence-en"),
  sentenceKo: document.getElementById("sentence-ko"),
  stage: document.getElementById("speak-stage"),
  hint: document.getElementById("speak-hint"),
  playback: document.getElementById("playback"),
  planList: document.getElementById("plan-list"),
  wordGrid: document.getElementById("word-grid"),
  wordProgress: document.getElementById("word-progress"),
  briefList: document.getElementById("brief-list"),
};

let morning = [];
let morningIndex = 0;
let mediaRecorder = null;
let chunks = [];

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

function speak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      els.hint.textContent = "이 브라우저는 음성 합성을 지원하지 않습니다.";
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.88;
    els.stage.classList.add("is-listening");
    u.onend = () => {
      els.stage.classList.remove("is-listening");
      resolve();
    };
    u.onerror = () => {
      els.stage.classList.remove("is-listening");
      resolve();
    };
    window.speechSynthesis.speak(u);
  });
}

function renderMorning() {
  const item = morning[morningIndex];
  if (!item) {
    els.projectTag.textContent = "문장이 없습니다";
    return;
  }
  els.projectTag.textContent = item.project;
  els.sentenceEn.textContent = item.english;
  els.sentenceKo.textContent = item.korean;
  els.hint.textContent = `${morningIndex + 1} / ${morning.length} · 듣기 → 따라 말하기 → (선택) 녹음`;
}

function markMorningDone() {
  const day = new Date().toISOString().slice(0, 10);
  localStorage.setItem(STORAGE_STREAK, day);
}

async function onListen() {
  const item = morning[morningIndex];
  if (!item) return;
  els.hint.textContent = "리듬에 맞춰 들으세요…";
  await speak(item.english);
  els.hint.textContent = "이제 따라 말하기를 눌러 같은 문장을 입 밖으로 말해보세요.";
}

async function onShadow() {
  const item = morning[morningIndex];
  if (!item) return;
  els.hint.textContent = "당신 차례입니다 — 문장을 크게 말한 뒤, 다시 듣기로 비교하세요.";
  await speak(item.english);
  markMorningDone();
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
      document.getElementById("btn-record").textContent = "녹음";
      const blob = new Blob(chunks, { type: "audio/webm" });
      els.playback.src = URL.createObjectURL(blob);
      els.playback.hidden = false;
      els.playback.play();
      els.hint.textContent = "내 녹음 재생 중 — 원문 듣기와 비교해보세요.";
      stream.getTracks().forEach((t) => t.stop());
      markMorningDone();
    };
    mediaRecorder.start();
    els.stage.classList.add("is-recording");
    document.getElementById("btn-record").textContent = "중지";
    els.hint.textContent = "녹음 중… 문장을 말한 뒤 중지를 누르세요.";
  } catch {
    els.hint.textContent = "마이크 권한이 필요합니다. 브라우저에서 허용해 주세요.";
  }
}

function onNext() {
  if (!morning.length) return;
  morningIndex = (morningIndex + 1) % morning.length;
  renderMorning();
}

function renderPlan(briefing, knownCount, goal) {
  const day = new Date().toISOString().slice(0, 10);
  const done = localStorage.getItem(STORAGE_STREAK) === day;
  const steps = [
    {
      n: "01",
      t: done ? "아침 말하기 완료" : "아침 말하기 1–2문장 (쉐도잉)",
      d: briefing.morning?.[0]?.english || "트렌딩 README 문장 따라 말하기",
    },
    {
      n: "02",
      t: `공통 단어 ${Math.min(5, goal - knownCount)}개 체크`,
      d: "오늘 문장에 나온 단어를 탭해서 ‘알고 있음’으로 표시",
    },
    {
      n: "03",
      t: "중복 트렌딩 프로젝트 README 훑기",
      d: "여러 사이트에 동시에 오른 레포 설명을 영어로 한 번 더 읽기",
    },
  ];
  els.planList.innerHTML = steps
    .map(
      (s) => `<li><span class="n">${s.n}</span><div><strong>${s.t}</strong><div class="sub">${s.d}</div></div></li>`
    )
    .join("");
}

function renderWords(data) {
  const known = loadKnown();
  const goal = data.goal3000 || 3000;
  els.wordProgress.textContent = `알고 있는 단어 ${known.size} / 목표 ${goal.toLocaleString()} (다음 목표 ${data.goal10000.toLocaleString()}) · ${data.coverageNote}`;

  els.wordGrid.innerHTML = data.words
    .map((item) => {
      const on = known.has(item.w) ? "known" : "";
      return `<button type="button" class="word-card ${on}" data-word="${item.w}">
        <p class="w">${item.w}</p>
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

document.getElementById("btn-listen").addEventListener("click", onListen);
document.getElementById("btn-shadow").addEventListener("click", onShadow);
document.getElementById("btn-record").addEventListener("click", onRecord);
document.getElementById("btn-next").addEventListener("click", onNext);

const [briefing, words] = await Promise.all([
  fetch("./data/briefing-today.json").then((r) => r.json()),
  fetch("./data/words-starter.json").then((r) => r.json()),
]);

morning = briefing.morning?.length
  ? briefing.morning
  : [
      {
        project: "readme-english",
        english: "I read one README sentence out loud every morning.",
        korean: "나는 매일 아침 README 문장 하나를 소리 내어 읽습니다.",
      },
    ];

renderMorning();
const knownCount = renderWords(words);
renderPlan(briefing, knownCount, words.goal3000);
renderBriefing(briefing);
