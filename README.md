# README English

GitHub README를 **소리 내어** 읽을 수 있을 때까지 — 아침 1~2문장 쉐도잉 + 공통 단어 + 오픈소스 일일 브리핑.

Whether you’re learning your first English words, building speaking confidence, or improving your business English, this app creates a personalized daily plan for YOU.

- Learn the **3,000** most common English words (aim ~95% of spoken English), then the **10,000** (aim ~99%).
- Morning habit: speak **one or two sentences** out loud (Volka English–style listen → shadow → compare).
- Daily OSS feed from GitHub Trending, Star History, GitTrend, and Trendshift — multi-site hits on top, Korean one-liners, emailed to you.

## Quick start

Open `index.html` in a browser (or serve the folder):

```bash
npx serve .
```

## Daily briefing + email

**GitHub Actions**가 매일 07:00 KST에 트렌딩을 모아 `briefings/`·`data/`를 갱신하고, 메일을 보낸 뒤 `main`에 커밋합니다.  
Actions → *Daily OSS briefing* → **Run workflow**로 수동 실행도 가능합니다.

필요한 repo secrets:

| Secret | 예시 |
|---|---|
| `SMTP_USER` | `alias0223@naver.com` |
| `SMTP_PASS` | 네이버 앱 비밀번호 |
| `SMTP_HOST` | `smtp.naver.com` |
| `SMTP_PORT` | `465` |
| `SMTP_TO` | `alias0223@naver.com` |
| `SMTP_FROM` | (선택, 기본=SMTP_USER) |

로컬 실행:

```bash
npm install
npm run daily
```

## Repo layout

- `index.html` / `app.js` / `styles.css` — morning speak UI
- `data/` — today’s briefing JSON + starter word list
- `briefings/` — Korean daily markdown
- `scripts/` — fetch + email
