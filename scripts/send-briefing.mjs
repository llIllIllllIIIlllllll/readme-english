/**
 * Email today's briefing to SMTP_TO (default: alias0223@naver.com).
 *
 * Required env:
 *   SMTP_USER  — e.g. you@naver.com
 *   SMTP_PASS  — Naver 앱 비밀번호 (일반 비밀번호 X)
 *
 * Optional:
 *   SMTP_HOST (default smtp.naver.com)
 *   SMTP_PORT (default 465)
 *   SMTP_TO   (default alias0223@naver.com)
 *   SMTP_FROM (default SMTP_USER)
 */
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createTransport } from "nodemailer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
}).format(new Date());

async function loadBriefingMd() {
  const preferred = join(root, "briefings", `${today}.md`);
  try {
    return await readFile(preferred, "utf8");
  } catch {
    const files = (await readdir(join(root, "briefings")))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (!files.length) throw new Error("No briefing markdown found. Run: node scripts/fetch-trending.mjs");
    return readFile(join(root, "briefings", files[0]), "utf8");
  }
}

async function main() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.error(`
Cannot send mail: set SMTP_USER and SMTP_PASS.

Naver example (PowerShell):
  $env:SMTP_USER = "your-id@naver.com"
  $env:SMTP_PASS = "your-app-password"
  $env:SMTP_HOST = "smtp.naver.com"
  $env:SMTP_PORT = "465"
  node scripts/send-briefing.mjs
`);
    process.exit(2);
  }

  const to = process.env.SMTP_TO || "alias0223@naver.com";
  const host = process.env.SMTP_HOST || "smtp.naver.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const body = await loadBriefingMd();

  const transporter = createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || user,
    to,
    subject: `오픈소스 일일 브리핑 ${today} · README English`,
    text: body,
  });

  console.log("Sent:", info.messageId, "→", to);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
