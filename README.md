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

```bash
npm install
node scripts/fetch-trending.mjs   # writes briefings/YYYY-MM-DD.md + data/briefing-today.json
```

Naver SMTP (앱 비밀번호 필요):

```powershell
$env:SMTP_USER = "your-id@naver.com"
$env:SMTP_PASS = "your-app-password"
$env:SMTP_HOST = "smtp.naver.com"
$env:SMTP_PORT = "465"
$env:SMTP_TO = "alias0223@naver.com"
node scripts/send-briefing.mjs
```

Or: `npm run daily`

## Repo layout

- `index.html` / `app.js` / `styles.css` — morning speak UI
- `data/` — today’s briefing JSON + starter word list
- `briefings/` — Korean daily markdown
- `scripts/` — fetch + email
