// transcribe.js — downloads the fetched reel's audio and transcribes it locally
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const HERE = __dirname;
const ROOT = path.join(HERE, "..", "..");
// Overridable for CI/Linux (GitHub Actions sets WHISPER_CLI + WHISPER_MODEL)
const WHISPER_EXE = process.env.WHISPER_CLI || path.join(ROOT, "tools", "whisper", "Release", "whisper-cli.exe");
const MODEL = process.env.WHISPER_MODEL || path.join(ROOT, "tools", "whisper", "ggml-base.en.bin");

if (!fs.existsSync(WHISPER_EXE)) { console.error("whisper-cli.exe not found at", WHISPER_EXE); process.exit(1); }
if (!fs.existsSync(MODEL)) { console.error("Model not found at", MODEL); process.exit(1); }

const fetchPath = path.join(HERE, "last_fetch.json");
if (!fs.existsSync(fetchPath)) { console.error("No last_fetch.json - run fetch.js first."); process.exit(1); }
const reel = JSON.parse(fs.readFileSync(fetchPath, "utf8"));

const tmpVideo = path.join(HERE, "temp_reel.mp4");
const tmpWav = path.join(HERE, "temp_audio.wav");
const outBase = path.join(HERE, "last_transcript");

async function main() {
  console.log("Downloading video from @" + reel.handle + "...");
  const res = await fetch(reel.videoUrl);
  if (!res.ok) {
    console.error("Video download failed (" + res.status + "). CDN links expire - re-run fetch.js and try again.");
    process.exit(1);
  }
  fs.writeFileSync(tmpVideo, Buffer.from(await res.arrayBuffer()));
  console.log("Video saved (" + (fs.statSync(tmpVideo).size / 1e6).toFixed(1) + " MB)");

  console.log("Extracting audio with ffmpeg...");
  execFileSync("ffmpeg", ["-y", "-i", tmpVideo, "-ar", "16000", "-ac", "1", "-vn", tmpWav], { stdio: "pipe" });

  console.log("Transcribing with whisper.cpp (base.en)...");
  execFileSync(WHISPER_EXE, ["-m", MODEL, "-f", tmpWav, "-otxt", "-of", outBase], { stdio: "pipe" });

  const transcript = fs.readFileSync(outBase + ".txt", "utf8").trim();
  const result = { ...reel, transcript, transcribedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(HERE, "last_transcript.json"), JSON.stringify(result, null, 2));

  fs.unlinkSync(tmpVideo);
  fs.unlinkSync(tmpWav);

  console.log("\n--- TRANSCRIPT (@" + reel.handle + ") ---\n");
  console.log(transcript);
  console.log("\nSaved to last_transcript.json");
}

main().catch(err => { console.error("Transcription failed:", err.message); process.exit(1); });
