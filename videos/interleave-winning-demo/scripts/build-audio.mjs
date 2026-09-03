import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const project = join(dirname(fileURLToPath(import.meta.url)), "..");
const node = process.env.HYPERFRAMES_NODE || process.execPath;
const cli = process.env.HYPERFRAMES_CLI;
const python = process.env.HYPERFRAMES_PYTHON || join(project, ".venv/bin/python3");
const sfxSource = process.env.HYPERFRAMES_SFX_DIR;
const planned = new Map([[1,10],[2,9],[3,11],[4,17],[5,11],[6,11],[7,16],[8,8]]);
const voiceDir = join(project, "assets/voice");
const sfxDir = join(project, "assets/sfx");
mkdirSync(voiceDir, { recursive: true });
mkdirSync(sfxDir, { recursive: true });

const rawScript = readFileSync(join(project, "SCRIPT.md"), "utf8");
const lines = [];
let current = null;
for (const line of rawScript.split(/\r?\n/)) {
  const heading = line.match(/^#{2,3}\s+.*?\(Frame\s+(\d+)\)/i);
  if (heading) {
    if (current?.text.trim()) lines.push(current);
    current = { frame: Number(heading[1]), text: "" };
    continue;
  }
  if (!current || /^\s*\*\*/.test(line)) continue;
  const spoken = line.match(/^(?: {4,}|\t)(.+)$/);
  if (spoken) current.text += `${current.text ? " " : ""}${spoken[1].trim()}`;
}
if (current?.text.trim()) lines.push(current);

const probe = (path) => {
  const result = spawnSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","csv=p=0","--",path], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`ffprobe failed for ${path}`);
  return Number(result.stdout.trim());
};

const wordTimes = (text, spokenDuration) => {
  const tokens = text.match(/\S+/g) ?? [];
  const weights = tokens.map((token) => {
    const letters = token.replace(/[^\p{L}\p{N}]/gu, "").length;
    const pause = /[.!?]$/.test(token) ? 3.3 : /[,;:]$/.test(token) ? 1.7 : /—$/.test(token) ? 1.4 : 0;
    return Math.max(1.3, letters * 0.62) + pause;
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  let cursor = 0.06;
  return tokens.map((text, index) => {
    const slice = Math.max(0.12, (spokenDuration - 0.12) * weights[index] / totalWeight);
    const start = Number(cursor.toFixed(3));
    cursor += slice;
    return { id: `w${index}`, text, start, end: Number(Math.min(spokenDuration, cursor).toFixed(3)) };
  });
};

const voices = [];
for (const line of lines) {
  const id = String(line.frame).padStart(2, "0");
  const raw = join(voiceDir, `${id}.raw.wav`);
  const output = join(voiceDir, `${id}.wav`);
  const env = { ...process.env, HYPERFRAMES_SKIP_SKILLS: "1", HYPERFRAMES_PYTHON: python };
  const command = cli ? node : process.platform === "win32" ? "npx.cmd" : "npx";
  const args = cli
    ? [cli, "tts", line.text, "--voice", "am_michael", "--speed", "0.9", "--output", raw]
    : ["--yes", "hyperframes@0.8.27", "tts", line.text, "--voice", "am_michael", "--speed", "0.9", "--output", raw];
  const result = spawnSync(command, args, { cwd: project, env, stdio: "inherit" });
  if (result.status !== 0 || !existsSync(raw)) throw new Error(`TTS failed for frame ${line.frame}`);
  const spokenDuration = probe(raw);
  const target = Number(Math.max(planned.get(line.frame) ?? 0, Math.ceil((spokenDuration + 0.6) * 10) / 10).toFixed(3));
  const pad = Math.max(0, target - spokenDuration);
  const ffmpeg = spawnSync("ffmpeg", ["-y","-loglevel","error","-i",raw,"-af",`apad=pad_dur=${pad}`,"-t",String(target),"-ar","44100","-ac","1",output]);
  if (ffmpeg.status !== 0 || !existsSync(output)) throw new Error(`audio padding failed for frame ${line.frame}`);
  rmSync(raw, { force: true });
  voices.push({ frame: line.frame, path: `assets/voice/${id}.wav`, duration_s: target, words: wordTimes(line.text, spokenDuration) });
  console.log(`frame ${id}: ${spokenDuration.toFixed(3)}s spoken → ${target.toFixed(3)}s scene`);
}

const sfxPlan = [
  { frame: 1, name: "click-soft", offset_s: 0.35, volume: 0.12 },
  { frame: 1, name: "error", offset_s: 6.7, volume: 0.16 },
  { frame: 2, name: "whoosh-cinematic", offset_s: 2.4, volume: 0.13 },
  { frame: 4, name: "click-soft", offset_s: 5.3, volume: 0.12 },
  { frame: 6, name: "whoosh-short", offset_s: 3.15, volume: 0.12 },
  { frame: 7, name: "chime", offset_s: 4.45, volume: 0.14 },
  { frame: 8, name: "impact-bass-1", offset_s: 1.15, volume: 0.14 },
];
const sfx = sfxPlan.map((cue) => {
  const dest = join(sfxDir, `${cue.name}.mp3`);
  if (!existsSync(dest)) {
    if (!sfxSource) throw new Error(`Missing ${dest}; set HYPERFRAMES_SFX_DIR to restage sound effects`);
    copyFileSync(join(sfxSource, `${cue.name}.mp3`), dest);
  }
  return { frame: cue.frame, file: `assets/sfx/${cue.name}.mp3`, offset_s: cue.offset_s, duration_s: Number(probe(dest).toFixed(3)), volume: cue.volume };
});

const meta = { bgm: null, bgm_pending: false, voices, sfx };
writeFileSync(join(project, "audio_meta.json"), JSON.stringify(meta, null, 2));
writeFileSync(join(project, "audio_engine_meta.json"), JSON.stringify({
  tts_provider: "kokoro",
  voice_id: "am_michael",
  speed: 0.9,
  bgm: null,
  bgm_pending: false,
  voices: voices.map(({ frame, path, duration_s }) => ({ frame, path, duration_s })),
  sfx,
  total_duration_s: Number(voices.reduce((sum, voice) => sum + voice.duration_s, 0).toFixed(3)),
}, null, 2));
console.log(`wrote ${voices.length} narration clips and ${sfx.length} sound cues`);
