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

const today = new Date().toISOString().slice(0, 10);

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

function renderMarkdown({ multi, bySource }) {
  const lines = [
    `# 오픈소스 일일 브리핑 — ${today}`,
    "",
    "수집 출처: GitHub Trending · Star History · GitTrend · Trendshift",
    "",
    "---",
    "",
    "## 🔥 여러 사이트 중복 등장 (주목)",
    "",
    "| 프로젝트 | 등장 사이트 | 한 줄 설명 (한국어) |",
    "|---|---|---|",
  ];
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

  const md = renderMarkdown({ multi, bySource });
  const outDir = join(root, "briefings");
  const dataDir = join(root, "data");
  await mkdir(outDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  const mdPath = join(outDir, `${today}.md`);
  await writeFile(mdPath, md, "utf8");

  // Morning speaking lines: 1–2 short English sentences from top multi / github
  const speakPool = (multi.length ? multi : all).slice(0, 8);
  const morning = speakPool.slice(0, 2).map((p, i) => ({
    id: `m-${today}-${i}`,
    project: p.fullName,
    english:
      p.description?.split(/(?<=[.!?])\s+/).filter(Boolean)[0] ||
      `${p.fullName.split("/")[1]} is a trending open-source project on GitHub today.`,
    korean: p.descriptionKo,
    url: `https://github.com/${p.fullName}`,
  }));

  const payload = {
    date: today,
    multi,
    morning,
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
  console.log("Morning lines:", morning.map((m) => m.english).join(" | "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
