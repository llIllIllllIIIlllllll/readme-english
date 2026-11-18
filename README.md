# README English

GitHub README를 **소리 내어** 자연스럽게 읽을 수 있을 때까지 — **Comprehensible Input (CI, i+1)** 아침 루틴 + 공통 단어 + 오픈소스 일일 브리핑.

Whether you’re learning your first English words, building speaking confidence, or improving your business English, this app creates a personalized daily plan for YOU.

## 💡 Comprehensible Input (CI) 학습 원리

영어를 습득하는 황금률은 **충분한 양의 이해 가능한 입력(Comprehensible Input, i+1)**입니다. 무작정 외우거나 말하기를 강요하지 않고, 소리를 먼저 충분히 듣고 문맥으로 의미를 잡은 뒤 편안하게 입 밖으로 소리 냅니다.

```
[Step 1: Input]      1.0x / 0.8x / 0.65x 속도로 듣기
       ↓
[Step 2: Context]    밑줄 친 단어 탭으로 힌트 확인 (한국어 번역은 필요할 때만) → 1-Tap 이해 확인
       ↓
[Step 3: Output]     (선택) 따라 말하기 (Shadowing) → 녹음으로 내 발음 비교
```

### 1. 단계별 난이도 (i+1 Graded Input)
- **🌱 Easy (i)**: 기본 문형과 필수 동사/명사(`build`, `agent`, `support`, `runtime`)로 시작해 이해 가능한 입력을 확보합니다.
- **🚀 Mid (i+1)**: 오늘 트렌딩 오픈소스의 실제 README 문장으로 자연스럽게 어휘력과 독해력을 확장합니다.

### 2. 문맥 중심 어휘 습득 (Recycled Vocabulary)
- 고립된 단어 카드가 아닌, **오늘의 핵심 개발 단어가 여러 문장에 걸쳐 반복 등장**합니다.
- 상단 "오늘 반복 어휘" 칩을 누르면 해당 단어가 쓰인 문장들을 바로 찾아볼 수 있습니다.
- 단어 섹션(`Common words`)에서도 오늘 아침에 등장한 단어 배지가 표시되어 연계 학습이 가능합니다.

### 3. 문맥으로 뜻 잡기 (Meaning from Context)
- 한국어 전문 번역은 **기본으로 숨겨져** 있습니다.
- 문맥 속에서 단어의 뜻을 추론해보고, 모르는 단어만 가볍게 탭(Gloss)하여 힌트를 확인합니다.
- 필요할 때만 `👁️ 한국어 전문 번역 보기`를 눌러 확인합니다.

### 4. 5분 미니 패시지 (Cohesive Reading & Listening)
- 오늘 트렌딩 레포지토리들의 맥락을 엮은 짧은 영어 스토리를 연속으로 들으며 5~10분의 충분한 인풋 볼륨을 채울 수 있습니다.

---

## Quick start

브라우저에서 `index.html`을 바로 열거나 로컬 서버로 실행합니다:

```bash
npx serve .
```

## Daily briefing + email

**GitHub Actions**가 매일 07:00 KST에 트렌딩 오픈소스를 모아 `briefings/`·`data/`를 갱신하고, Comprehensible Input 문장 블록을 생성해 메일을 보낸 뒤 `main`에 커밋합니다.  
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

- `index.html` / `app.js` / `styles.css` — Comprehensible Input (CI) 아침 학습 UI
- `data/` — 오늘 트렌딩 브리핑 JSON (`briefing-today.json`) + 스타터 단어장
- `briefings/` — 한국어 일일 브리핑 및 CI 학습 문장 마크다운
- `scripts/` — 트렌딩 수집 + CI 블록 생성 (`fetch-trending.mjs`) & 이메일 발송 (`send-briefing.mjs`)
