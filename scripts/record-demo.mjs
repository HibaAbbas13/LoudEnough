
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const { chromium } = await import("playwright").catch(() => {
  console.error("Re-recording needs playwright: npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
});

const URL = process.env.DEMO_URL ?? "http://localhost:3001";
const RAW = ".demo-raw";
mkdirSync(RAW, { recursive: true });
mkdirSync("public/demo", { recursive: true });

const marks = {};
const mark = (name) => {
  marks[name] = Date.now();
  console.log("MARK", name, marks[name] - marks.video);
};

const browser = await chromium.launch({
  headless: false,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

marks.video = Date.now();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  recordVideo: { dir: RAW, size: { width: 1440, height: 900 } },
});

await context.addInitScript(() => {
  const chunks = [];
  let recorder = null;
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const result = orig.call(this, dest, ...rest);
    try {
      const ctx = this.context;
      if (dest === ctx.destination && !ctx.__tapped) {
        ctx.__tapped = true;
        const tap = ctx.createMediaStreamDestination();
        orig.call(this, tap);
        recorder = new MediaRecorder(tap.stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.start(250);
        window.__audioStartedAt = Date.now();
      }
    } catch {}
    return result;
  };

  window.__stopAudio = () =>
    new Promise((resolve) => {
      if (!recorder) return resolve(null);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = "";
        for (let i = 0; i < buf.length; i += 0x8000) {
          s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        }
        resolve({ b64: btoa(s), startedAt: window.__audioStartedAt ?? null });
      };
      recorder.stop();
    });
});

const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("PAGE", msg.text());
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.addStyleTag({
  content: "nextjs-portal,[data-nextjs-dev-tools-button],[data-next-badge-root]{display:none!important}",
});
await page.waitForTimeout(1600);
mark("hero");

const point = page.getByRole("heading", { name: "A messy explanation in" });
await point.scrollIntoViewIfNeeded();
await page.waitForTimeout(2200);
mark("point");

await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await page.waitForTimeout(1200);

const demo = page.getByRole("button", { name: /Try a demo/ });
await demo.scrollIntoViewIfNeeded();
const box = await demo.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  await page.waitForTimeout(280);
}
await demo.click();
mark("click");

await page.getByText("Listening", { exact: false }).waitFor({ timeout: 30000 });
mark("listening");

const heard = page.getByRole("heading", { name: "I heard you." });
await heard.waitFor({ timeout: 120000 });
mark("brief");
await heard.scrollIntoViewIfNeeded();
await page.waitForTimeout(3500);

const formal = page.getByRole("button", { name: "Prepare a formal message" });
const done = page.getByRole("button", { name: "I'm done talking" });
const formalShown = await formal.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
if (!formalShown && (await done.isVisible().catch(() => false))) {
  await done.click();
  mark("finish-turn");
  await formal.waitFor({ timeout: 60000 });
}
await formal.scrollIntoViewIfNeeded();
const fbox = await formal.boundingBox();
if (fbox) {
  await page.mouse.move(fbox.x + fbox.width / 2, fbox.y + 24, { steps: 16 });
  await page.waitForTimeout(250);
}
await formal.click();
mark("draft-click");

const ready = page.getByRole("heading", { name: "Ready to send" });
await ready.waitFor({ timeout: 60000 });
mark("message");
await ready.scrollIntoViewIfNeeded();
await page.waitForTimeout(7000);

const audio = await page.evaluate(() => window.__stopAudio());
if (audio?.b64) {
  writeFileSync(`${RAW}/agent.webm`, Buffer.from(audio.b64, "base64"));
  marks.agentAudio = audio.startedAt;
}
mark("end");
writeFileSync(`${RAW}/marks.json`, JSON.stringify(marks, null, 2));

const video = page.video();
await context.close();
await video.saveAs(`${RAW}/capture.webm`);
await browser.close();
console.log("saved", `${RAW}/capture.webm`);

const v0 = marks.video;
const userDelay = Math.max(0, marks.listening - v0);
const agentDelay = Math.max(0, (marks.agentAudio ?? marks.click) - v0);

const ff = spawn("ffmpeg", [
  "-y",
  "-i", `${RAW}/capture.webm`,
  "-i", `${RAW}/agent.webm`,
  "-i", "public/demo/landlord.mp3",
  "-filter_complex",
  [
    `[1:a]adelay=${agentDelay}|${agentDelay},volume=1.15[agent]`,
    `[2:a]adelay=${userDelay}|${userDelay},volume=0.9[user]`,
    `[agent][user]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]`,
  ].join(";"),
  "-map", "0:v:0",
  "-map", "[a]",
  "-c:v", "libx264",
  "-preset", "slow",
  "-crf", "18",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  "-c:a", "aac",
  "-b:a", "192k",
  "-shortest",
  "public/demo/walkthrough.mp4",
], { stdio: "inherit" });

const code = await new Promise((resolve) => ff.on("close", resolve));
if (code !== 0) process.exit(code);
console.log("wrote public/demo/walkthrough.mp4");
