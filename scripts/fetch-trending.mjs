/**
 * Collect today's trending OSS from GitHub, GitTrend, Trendshift, Star History
 * and write a Korean daily briefing (+ JSON for the learning app).
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const UA = {
  "User-Agent": "readme-english-briefing/0.1 (+local learning app)",
  Accept: "text/html,application/json",
};

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
}).format(new Date());

function ko(name, en) {
  // Lightweight Korean one-liners for known patterns; fall back to EN.
  const map = {
    "Claude-BugHunter": "Claude Code용 버그 헌팅·레드팀 스킬 번들",
    "paper-orchestra": "AI 연구 논문 자동 작성 멀티 에이전트",
    "last30days-skill": "소셜·웹에서 주제를 조사해 요약하는 AI 스킬",
    arcane: "모던 Docker 관리 도구",
    ECC: "에이전트 하네스 성능·스킬·보안 최적화",
    "Wireless-Device-Battery-Monitor": "윈도우 작업표시줄 무선 기기 배터리 모니터",
    ARTEX: "AI 자율 침투 테스트(펜테스트) 시스템",
    rea: "에이전트로 앱·바이너리 리버스 엔지니어링",
    "modern-web-guidance": "코딩 에이전트용 최신 웹 모범 사례 가이드",
    t3code: "폰/PC에서 Claude Code·Codex 원격 제어",
    "dsh-Go": "폰에서 DeepSeek Harness + PC 원격 제어",
    univer: "AI 오피스용 Univer Office SDK",
    orca: "코딩 에이전트 플릿 데스크톱·모바일 런타임",
    openmotion: "레퍼런스 영상→모션 그래픽 오픈소스 스튜디오",
    misterdownloadmanager: "Rust 크로스플랫폼 다운로드 매니저",
    LoopForge: "코딩 에이전트 셀프호스트 워크플로 + 승인 게이트",
    ponytail: "게으른 시니어처럼 생각하게 하는 에이전트 스킬",
    uv: "초고속 Python 패키지·프로젝트 매니저",
    nvm: "Node.js 버전 매니저",
    plugins: "Cursor 플러그인 스펙 및 공식 플러그인",
    "CLI-Anything": "모든 소프트웨어를 에이전트 네이티브 CLI로",
    SkillEvaluator: "AI 에이전트 스킬·플러그인 품질 평가",
    svelte: "심플한 반응형 웹 프레임워크",
    appwrite: "에이전트·개발자용 오픈소스 클라우드",
    superpowers: "에이전틱 스킬 프레임워크·개발 방법론",
    n8n: "AI 네이티브 워크플로 자동화 플랫폼",
    "rust-anything": "앱을 단계적으로 Rust로 재작성·검증",
    minimind: "소형 LLM을 빠르게 학습하는 프로젝트",
    "ai-agents-for-beginners": "AI 에이전트 입문 18강",
  };
  const short = name.split("/").pop();
  return map[short] || en || short;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { ...UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function parseGithubTrending(html) {
  const items = [];
  const re =
    /href="\/([^"/]+\/[^"/]+)"[^>]*>\s*[\s\S]*?<\/a>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g;
  // Simpler: h2 links + following p
  const blockRe =
    /<h2[\s\S]*?href="\/([^"]+)"[\s\S]*?<\/h2>[\s\S]*?(?:<p[^>]*>\s*([\s\S]*?)\s*<\/p>)?/g;
  let m;
  while ((m = blockRe.exec(html)) && items.length < 25) {
    const full = m[1].replace(/\s+/g, "");
    if (!full.includes("/")) continue;
    const desc = (m[2] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    items.push({ fullName: full, description: desc, source: "github" });
  }
  return items;
}

async function fromGithub() {
  try {
    const html = await fetchText("https://github.com/trending?since=daily");
    return parseGithubTrending(html);
  } catch (e) {
    console.warn("GitHub trending failed:", e.message);
    return [];
  }
}

async function fromGitTrend() {
  try {
    const json = await fetchJson("https://gittrend.io/api/trending");
    return (json.data || []).slice(0, 25).map((r) => ({
      fullName: r.fullName,
      description: r.description || r.summary || "",
      source: "gittrend",
      starsToday: r.starsToday,
    }));
  } catch (e) {
    console.warn("GitTrend failed:", e.message);
    return [];
  }
}

async function fromTrendshift() {
  try {
    const html = await fetchText("https://trendshift.io/");
    const items = [];
    // Match owner/repo headings followed by description-ish text
    const re = /([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\n\n(?:[\d.k]+\n\n)?(?:Gained today\n\n)?(?:New 2026\n\n)?(?:Mentioned on\n\n)?([^\n]+)/g;
    // HTML version: look for github-like paths in content
    const linkRe = />([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)</g;
    const seen = new Set();
    let m;
    while ((m = linkRe.exec(html)) && items.length < 30) {
      const full = m[1];
      if (seen.has(full) || full.startsWith("http")) continue;
      seen.add(full);
      items.push({ fullName: full, description: "", source: "trendshift" });
    }
    return items;
  } catch (e) {
    console.warn("Trendshift failed:", e.message);
    return [];
  }
}

async function fromStarHistory() {
  // Public weekly list is rendered client-side; use known scrape of homepage meta if available.
  // Fallback: empty — caller merges with previous briefing snapshot if needed.
  try {
    const html = await fetchText("https://star-history.com/");
    const items = [];
    const re = /([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\s*\+\s*[\d,.]+k?/g;
    let m;
    const seen = new Set();
    while ((m = re.exec(html)) && items.length < 25) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      items.push({ fullName: m[1], description: "", source: "star-history" });
    }
    return items;
  } catch (e) {
    console.warn("Star History failed:", e.message);
    return [];
  }
}

function merge(lists) {
  const byName = new Map();
  for (const list of lists) {
    for (const item of list) {
      const key = item.fullName.toLowerCase();
      const cur = byName.get(key) || {
        fullName: item.fullName,
        description: "",
        sources: new Set(),
      };
      if (item.description && item.description.length > cur.description.length) {
        cur.description = item.description;
      }
      cur.sources.add(item.source);
      byName.set(key, cur);
    }
  }
  const all = [...byName.values()].map((p) => ({
    fullName: p.fullName,
    description: p.description,
    descriptionKo: ko(p.fullName, p.description),
    sources: [...p.sources],
  }));
  const multi = all.filter((p) => p.sources.length >= 2).sort((a, b) => b.sources.length - a.sources.length);
  const single = all.filter((p) => p.sources.length === 1);
  return { multi, single, all };
}

const GLOSS_MAP = {
  framework: "프레임워크 (개발 뼈대·기본 구조)",
  agent: "에이전트 (스스로 행동하는 AI 프로그램)",
  agents: "에이전트들 (자율 AI 프로그램들)",
  multiagent: "멀티 에이전트 (여러 AI의 협력)",
  workflow: "워크플로 (작업 순서와 흐름)",
  workflows: "워크플로들 (작업 절차들)",
  runtime: "런타임 (프로그램 실행 환경)",
  runtimes: "런타임 환경들",
  build: "만들다, 구축하다",
  support: "지원하다, 호환되다",
  supports: "지원하다",
  optimize: "최적화하다",
  install: "설치하다",
  feature: "기능, 특징",
  features: "기능들",
  automate: "자동화하다",
  automated: "자동화된",
  autonomous: "자율적인 (스스로 판단·실행하는)",
  lightweight: "가벼운, 경량의",
  opensource: "오픈소스의",
  "open-source": "오픈소스의",
  delivery: "배포·전달",
  orchestrate: "조율하다, 지휘하다",
  monitor: "모니터링하다",
  remote: "원격의",
  security: "보안 (취약점 방어)",
  skill: "스킬 (에이전트 확장 기능)",
  skills: "스킬들",
  bundle: "묶음, 번들",
  vulnerability: "보안 취약점",
  collaboration: "협업, 공동 작업",
  extensible: "확장 가능한",
  fleet: "무리, 여러 대",
};

const SEED_PASSAGES = {
  default: {
    title: "Today's OSS Story: Coding Agents & Autonomous Workflows",
    text: "Today's trending repositories focus on autonomous coding agents and extensible developer workflows. PaperOrchestra provides a multi-agent framework to write research papers, while LoopForge orchestrates agent delivery with human approval gates. With Univer and Orca, developers can build AI office suites and run agent runtimes across desktop and mobile.",
    korean: "오늘의 트렌딩 저장소들은 자율 코딩 에이전트와 확장 가능한 개발자 워크플로에 집중하고 있습니다. PaperOrchestra는 연구 논문을 작성하는 멀티 에이전트 프레임워크를 제공하며, LoopForge는 사람의 승인 게이트와 함께 에이전트 전달을 조율합니다. Univer와 Orca를 통해 개발자는 AI 오피스 스위트를 구축하고 데스크톱과 모바일 전반에서 에이전트 런타임을 실행할 수 있습니다.",
  },
};

function extractKeywords(text) {
  const found = new Set();
  const lower = text.toLowerCase();
  for (const k of Object.keys(GLOSS_MAP)) {
    const re = new RegExp(`\\b${k.replace("-", "[-\\s]?")}\\b`, "i");
    if (re.test(lower)) {
      found.add(k.replace(/\s+/g, "-"));
    }
  }
  return [...found];
}

function buildGloss(words) {
  const out = {};
  for (const w of words) {
    if (GLOSS_MAP[w]) out[w] = GLOSS_MAP[w];
  }
  return out;
}

function buildMorningCIBlock({ multi, all, today }) {
  const pool = (multi.length ? multi : all).slice(0, 12);

  const curated = [
    {
      match: /paper-orchestra/i,
      easy: {
        en: "PaperOrchestra is a multi-agent framework to build and write AI research papers.",
        ko: "PaperOrchestra는 AI 연구 논문을 작성하고 구축하기 위한 멀티 에이전트 프레임워크입니다.",
        q: "PaperOrchestra의 주된 역할은 무엇인가요?",
        opts: ["AI 연구 논문 작성 자동화", "클라우드 서버 인프라 관리"],
        ans: 0,
      },
      mid: {
        en: "PaperOrchestra is a multi-agent framework for automated AI research paper writing.",
        ko: "PaperOrchestra는 AI 연구 논문 작성을 자동화하기 위한 멀티 에이전트 프레임워크입니다.",
        q: "이 프레임워크의 아키텍처 형태는?",
        opts: ["멀티 에이전트 (여러 AI 협업)", "단일 스레드 CLI"],
        ans: 0,
      },
    },
    {
      match: /orca/i,
      easy: {
        en: "Orca lets you run coding agents on desktop and remote runtime.",
        ko: "Orca는 데스크톱과 원격 런타임에서 코딩 에이전트를 실행할 수 있게 해줍니다.",
        q: "Orca로 무엇을 실행할 수 있나요?",
        opts: ["코딩 에이전트", "3D 게임 엔진"],
        ans: 0,
      },
      mid: {
        en: "Orca lets you run a fleet of coding agents with your own subscription across desktop, mobile and remote runtimes.",
        ko: "Orca는 사용자의 구독을 사용해 데스크톱, 모바일, 원격 런타임 전반에서 코딩 에이전트 플릿을 실행할 수 있게 합니다.",
        q: "Orca가 지원하는 런타임 환경은?",
        opts: ["데스크톱, 모바일, 원격 런타임", "오직 리눅스 서버만 지원"],
        ans: 0,
      },
    },
    {
      match: /univer/i,
      easy: {
        en: "Build your own AI office with Univer Office SDK to support editing and collaboration.",
        ko: "Univer Office SDK를 사용해 문서 편집과 협업을 지원하는 나만의 AI 오피스를 구축하세요.",
        q: "Univer SDK가 돕는 핵심 작업은?",
        opts: ["문서 편집 및 협업 기능 구축", "도메인 네임 등록"],
        ans: 0,
      },
      mid: {
        en: "Bring editing, calculation, collaboration, and file processing into your product for people and AI agents.",
        ko: "사람과 AI 에이전트를 위해 편집, 계산, 협업 및 파일 처리 기능을 제품에 도입하세요.",
        q: "이 도구가 지원하는 대상은 누구인가요?",
        opts: ["사람과 AI 에이전트 모두", "데이터베이스 관리자 전용"],
        ans: 0,
      },
    },
    {
      match: /LoopForge/i,
      easy: {
        en: "LoopForge provides self-hosted workflows to orchestrate coding agents with approval gates.",
        ko: "LoopForge는 승인 게이트를 갖춘 코딩 에이전트 조율용 셀프호스트 워크플로를 제공합니다.",
        q: "LoopForge의 핵심 기능은 무엇인가요?",
        opts: ["코딩 에이전트 워크플로 조율", "CSS 스타일 자동 생성"],
        ans: 0,
      },
      mid: {
        en: "Self-hosted workflows for coding-agent delivery orchestrate CodeBuddy, Codex and Claude Code with scripts and human approval gates.",
        ko: "코딩 에이전트 배포를 위한 자체 호스팅 워크플로는 스크립트와 사람의 승인 단계를 통해 Codex와 Claude Code를 조율합니다.",
        q: "에이전트가 코드를 배포할 때 무엇을 거치나요?",
        opts: ["사람의 승인 단계 (human approval gates)", "무조건 즉각 배포"],
        ans: 0,
      },
    },
    {
      match: /Wireless-Device-Battery-Monitor/i,
      easy: {
        en: "This lightweight tray app monitors battery levels of wireless devices without extra software.",
        ko: "이 가벼운 트레이 앱은 추가 소프트웨어 없이 무선 기기의 배터리 잔량을 모니터링합니다.",
        q: "이 앱의 장점은 무엇인가요?",
        opts: ["제조사 소프트웨어 없이 가볍게 작동", "복잡한 서버 설정 필수"],
        ans: 0,
      },
      mid: {
        en: "Lightweight tray app to show battery levels of wireless mice, keyboards and controllers on the taskbar with no vendor software needed.",
        ko: "전용 소프트웨어 없이 작업표시줄에 무선 마우스, 키보드, 컨트롤러의 배터리 잔량을 표시하는 경량 트레이 앱입니다.",
        q: "어떤 기기들의 배터리를 볼 수 있나요?",
        opts: ["무선 마우스, 키보드, 컨트롤러", "스마트 TV 및 냉장고"],
        ans: 0,
      },
    },
    {
      match: /misterdownloadmanager/i,
      easy: {
        en: "This open-source download manager is written from scratch in pure Rust for Windows and Linux.",
        ko: "이 오픈소스 다운로드 매니저는 Windows와 Linux를 위해 순수 Rust로 처음부터 작성되었습니다.",
        q: "이 프로그램의 작성 언어는 무엇인가요?",
        opts: ["Rust", "Python"],
        ans: 0,
      },
      mid: {
        en: "The ultimate open-source, clean-room download manager written from scratch in pure Rust for Windows, Mac, and Linux.",
        ko: "Windows, Mac, Linux를 위해 순수 Rust로 백지상태에서 작성된 최고의 오픈소스 클린룸 다운로드 매니저입니다.",
        q: "clean-room의 의미는?",
        opts: ["기존 독점 코드를 참조하지 않고 백지에서 독립 구현함", "서버실을 청소하는 기능"],
        ans: 0,
      },
    },
    {
      match: /openmotion/i,
      easy: {
        en: "Turn a reference video into editable motion graphics with this open-source agent studio.",
        ko: "이 오픈소스 에이전트 스튜디오로 참고 영상을 편집 가능한 모션 그래픽으로 변환하세요.",
        q: "이 도구가 만드는 결과물은?",
        opts: ["편집 가능한 모션 그래픽", "텍스트 전용 문서"],
        ans: 0,
      },
      mid: {
        en: "A full-stack agentic video studio that turns reference videos into editable motion graphics with support for coding agents.",
        ko: "참고 영상을 편집 가능한 모션 그래픽으로 변환하고 코딩 에이전트를 지원하는 풀스택 에이전틱 비디오 스튜디오입니다.",
        q: "어떤 에이전트들을 지원하나요?",
        opts: ["Claude Code, Codex 등 코딩 에이전트 지원", "지원하지 않음"],
        ans: 0,
      },
    },
    {
      match: /Claude-BugHunter/i,
      easy: {
        en: "BugHunter is a skill bundle for bug hunting and external red-team security work.",
        ko: "BugHunter는 버그 헌팅과 외부 레드팀 보안 작업을 위한 스킬 번들입니다.",
        q: "이 프로젝트의 주요 목적은?",
        opts: ["보안 버그 탐색 및 레드팀 작업", "음악 작곡"],
        ans: 0,
      },
      mid: {
        en: "A Claude Code skill bundle for bug hunting and external red-team work curated across core vulnerability classes.",
        ko: "핵심 취약점 분류 전반에 걸쳐 선별된, 버그 헌팅 및 외부 레드팀 작업을 위한 Claude Code 스킬 번들입니다.",
        q: "vulnerability classes의 뜻은?",
        opts: ["보안 취약점 유형", "프로그래밍 강의"],
        ans: 0,
      },
    },
  ];

  const morning = [];
  const usedEasy = new Set();
  const usedMid = new Set();

  for (const p of pool) {
    const c = curated.find((item) => item.match.test(p.fullName));
    if (c) {
      if (c.easy && !usedEasy.has(p.fullName)) {
        usedEasy.add(p.fullName);
        const words = extractKeywords(c.easy.en);
        morning.push({
          id: `m-${today}-e-${morning.length}`,
          project: p.fullName,
          level: "easy",
          english: c.easy.en,
          korean: c.easy.ko,
          url: `https://github.com/${p.fullName}`,
          recycledWords: words,
          gloss: buildGloss(words),
          checkQuestion: {
            q: c.easy.q,
            options: c.easy.opts,
            answer: c.easy.ans,
          },
        });
      }
      if (c.mid && !usedMid.has(p.fullName)) {
        usedMid.add(p.fullName);
        const words = extractKeywords(c.mid.en);
        morning.push({
          id: `m-${today}-m-${morning.length}`,
          project: p.fullName,
          level: "mid",
          english: c.mid.en,
          korean: c.mid.ko,
          url: `https://github.com/${p.fullName}`,
          recycledWords: words,
          gloss: buildGloss(words),
          checkQuestion: {
            q: c.mid.q,
            options: c.mid.opts,
            answer: c.mid.ans,
          },
        });
      }
    }
  }

  // Fallback generation if pool lacks enough items
  if (morning.length < 6) {
    for (const p of pool) {
      if (usedEasy.has(p.fullName) && usedMid.has(p.fullName)) continue;
      const shortName = p.fullName.split("/").pop();
      const desc = p.description || "";
      const firstSentence = desc.split(/(?<=[.!?])\s+/).filter(Boolean)[0] || "";

      if (!usedEasy.has(p.fullName) && morning.filter((m) => m.level === "easy").length < 4) {
        usedEasy.add(p.fullName);
        const en = `${shortName} is a trending open-source tool that helps developers build better workflows.`;
        const words = extractKeywords(en);
        morning.push({
          id: `m-${today}-e-${morning.length}`,
          project: p.fullName,
          level: "easy",
          english: en,
          korean: p.descriptionKo
            ? `${shortName}은(는) 개발자의 워크플로를 돕는 오픈소스 도구입니다 (${p.descriptionKo}).`
            : `${shortName}은(는) 오늘 주목받는 오픈소스 프로젝트입니다.`,
          url: `https://github.com/${p.fullName}`,
          recycledWords: words,
          gloss: buildGloss(words),
          checkQuestion: {
            q: `${shortName}은(는) 어떤 프로젝트인가요?`,
            options: ["오늘 주목받는 오픈소스 개발 도구", "하드웨어 장비"],
            answer: 0,
          },
        });
      }

      if (firstSentence && !usedMid.has(p.fullName) && morning.filter((m) => m.level === "mid").length < 4) {
        usedMid.add(p.fullName);
        const words = extractKeywords(firstSentence);
        morning.push({
          id: `m-${today}-m-${morning.length}`,
          project: p.fullName,
          level: "mid",
          english: firstSentence,
          korean: p.descriptionKo,
          url: `https://github.com/${p.fullName}`,
          recycledWords: words,
          gloss: buildGloss(words),
          checkQuestion: {
            q: `${shortName}의 설명으로 올바른 것은?`,
            options: [p.descriptionKo || "오픈소스 프로젝트", "전혀 다른 프로젝트"],
            answer: 0,
          },
        });
      }
      if (morning.length >= 8) break;
    }
  }

  // Recycled vocab stats
  const vocabCounts = {};
  for (const m of morning) {
    for (const w of m.recycledWords) {
      vocabCounts[w] = (vocabCounts[w] || 0) + 1;
    }
  }

  const recycledVocab = Object.entries(vocabCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({
      word,
      count,
      ko: GLOSS_MAP[word] || "자주 쓰이는 핵심 개발 단어",
    }));

  const passage = SEED_PASSAGES.default;

  return { morning, recycledVocab, passage };
}

function renderMarkdown({ multi, bySource, morning, passage }) {
  const lines = [
    `# 오픈소스 일일 브리핑 — ${today}`,
    "",
    "수집 출처: GitHub Trending · Star History · GitTrend · Trendshift",
    "",
    "---",
    "",
    "## 🎧 오늘 아침 Comprehensible Input (i+1)",
    "",
    "> **학습 루프**: 소리 듣기(1.0x / 0.8x) → 문맥으로 뜻 파악 → 필요할 때만 번역 확인 → 선택적 따라 말하기(Shadowing)",
    "",
  ];

  if (morning?.length) {
    const easy = morning.filter((m) => m.level === "easy");
    const mid = morning.filter((m) => m.level === "mid");
    if (easy.length) {
      lines.push("### 🌱 Easy (i · 기초 문형 & 핵심 어휘 반복)");
      for (const m of easy) {
        lines.push(`- **${m.project.split("/").pop()}**: ${m.english}`);
        lines.push(`  *한국어*: ${m.korean}`);
      }
      lines.push("");
    }
    if (mid.length) {
      lines.push("### 🚀 Mid (i+1 · 실전 README 문장)");
      for (const m of mid) {
        lines.push(`- **${m.project.split("/").pop()}**: ${m.english}`);
        lines.push(`  *한국어*: ${m.korean}`);
      }
      lines.push("");
    }
  }

  if (passage) {
    lines.push(
      "### 📖 오늘의 5분 미니 리딩 (Cohesive Passage)",
      `> ${passage.text}`,
      "",
      `*해석*: ${passage.korean}`,
      "",
      "---",
      ""
    );
  }

  lines.push(
    "## 🔥 여러 사이트 중복 등장 (주목)",
    "",
    "| 프로젝트 | 등장 사이트 | 한 줄 설명 (한국어) |",
    "|---|---|---|"
  );
  for (const p of multi) {
    lines.push(
      `| **${p.fullName}** | ${p.sources.join(" · ")} | ${p.descriptionKo} |`
    );
  }
  if (!multi.length) lines.push("| (오늘 교집합 없음) | — | — |");

  for (const [label, items] of Object.entries(bySource)) {
    lines.push("", "---", "", `## ${label}`, "", "| 프로젝트 | 한 줄 설명 (한국어) |", "|---|---|");
    for (const p of items) {
      lines.push(`| ${p.fullName} | ${ko(p.fullName, p.description)} |`);
    }
  }
  lines.push("", `*Generated by README English daily briefing · ${today}*`, "");
  return lines.join("\n");
}

async function main() {
  console.log("Fetching trending sources…");
  const [github, gittrend, trendshift, starhistory] = await Promise.all([
    fromGithub(),
    fromGitTrend(),
    fromTrendshift(),
    fromStarHistory(),
  ]);

  const { multi, all } = merge([github, gittrend, trendshift, starhistory]);
  const bySource = {
    "GitHub Trending (Today)": github,
    "Star History": starhistory,
    "GitTrend (Today)": gittrend,
    "Trendshift (Live)": trendshift,
  };

  // Comprehensible Input (CI) morning block:
  const ciBlock = buildMorningCIBlock({ multi, all, today });

  const md = renderMarkdown({ multi, bySource, morning: ciBlock.morning, passage: ciBlock.passage });
  const outDir = join(root, "briefings");
  const dataDir = join(root, "data");
  await mkdir(outDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  const mdPath = join(outDir, `${today}.md`);
  await writeFile(mdPath, md, "utf8");

  const payload = {
    date: today,
    multi,
    morning: ciBlock.morning,
    passage: ciBlock.passage,
    recycledVocab: ciBlock.recycledVocab,
    counts: {
      github: github.length,
      gittrend: gittrend.length,
      trendshift: trendshift.length,
      starhistory: starhistory.length,
      unique: all.length,
      multi: multi.length,
    },
  };
  await writeFile(join(dataDir, "briefing-today.json"), JSON.stringify(payload, null, 2), "utf8");
  await writeFile(join(dataDir, `briefing-${today}.json`), JSON.stringify(payload, null, 2), "utf8");

  console.log(`Wrote ${mdPath}`);
  console.log(`Multi-site hits: ${multi.length}, unique: ${all.length}`);
  console.log(
    `CI Morning sentences: ${ciBlock.morning.length} (Easy: ${
      ciBlock.morning.filter((m) => m.level === "easy").length
    }, Mid: ${ciBlock.morning.filter((m) => m.level === "mid").length})`
  );
  console.log(
    "Recycled keywords:",
    ciBlock.recycledVocab.map((v) => `${v.word} (${v.count})`).join(", ")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
