import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const project = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(project, "compositions/frames");
mkdirSync(out, { recursive: true });
const audioMetaPath = join(project, "audio_meta.json");
const audioDurations = new Map();
if (existsSync(audioMetaPath)) {
  const meta = JSON.parse(readFileSync(audioMetaPath, "utf8"));
  for (const voice of meta.voices ?? []) audioDurations.set(Number(voice.frame), Number(voice.duration_s));
}

const fontCss = `
@font-face{font-family:Geist;src:url("assets/fonts/geist-latin.woff2") format("woff2");font-style:normal;font-weight:100 900;font-display:swap}
@font-face{font-family:"Geist Mono";src:url("assets/fonts/geist-mono-latin.woff2") format("woff2");font-style:normal;font-weight:100 900;font-display:swap}`;

function frame({ id, duration, css, body, js }) {
  duration = audioDurations.get(Number(id.slice(0, 2))) || duration;
  return `<template>
  <style>
    ${fontCss}
    *{box-sizing:border-box}
    #root{position:relative;width:1920px;height:1080px;overflow:hidden;container-type:size;color:#E7EDEB;font-family:Geist,sans-serif}
    #root .clip{position:absolute;inset:0;overflow:hidden}
    #root .${id}-bg{background:#191F1C}
    #root .${id}-stage{position:absolute;inset:0 0 180px 0;padding:74px 82px}
    #root .${id}-kicker{font:600 22px/1 "Geist Mono",monospace;letter-spacing:.15em;text-transform:uppercase;color:#A8AFB8}
    #root .${id}-spike{color:#737BEB;margin-right:14px}
    #root .${id}-display{font-size:92px;line-height:.98;letter-spacing:-.045em;font-weight:480}
    #root .${id}-headline{font-size:68px;line-height:1.02;letter-spacing:-.035em;font-weight:470}
    #root .${id}-mono{font-family:"Geist Mono",monospace}
    #root .${id}-surface{background:#07092A;border:1px solid rgba(231,237,235,.18);border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.16);overflow:hidden}
    #root .${id}-chip{display:inline-flex;align-items:center;border:1px solid rgba(231,237,235,.18);border-radius:999px;padding:10px 15px;background:#202723;font:550 18px/1 "Geist Mono",monospace;color:#DADFE1}
    #root .${id}-label{font:600 17px/1 "Geist Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#A8AFB8}
    #root .${id}-muted{color:#A8AFB8}
    #root .${id}-rule{height:1px;background:rgba(231,237,235,.18);transform-origin:left center}
    #root .${id}-violet{color:#9EA5FF}
    #root .${id}-red{color:#F29B8F}
    #root .${id}-green{color:#A6E6BB}
    #root img{display:block}
    ${css}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <div id="root" data-composition-id="${id}" data-start="0" data-duration="${duration}" data-track-index="0" data-width="1920" data-height="1080">
    <div id="${id}-bg" class="clip ${id}-bg" data-start="0" data-duration="${duration}" data-track-index="0"></div>
    <div id="${id}-stage" class="clip ${id}-stage" data-start="0" data-duration="${duration}" data-track-index="1">${body}</div>
  </div>
  <script>
    window.__timelines=window.__timelines||{};
    const tl=gsap.timeline({paused:true,defaults:{ease:"power3.out"}});
    ${js}
    window.__timelines["${id}"]=tl;
  </script>
</template>`;
}

const files = {};

files["01-silent-overwrite.html"] = frame({
  id: "01-silent-overwrite",
  duration: 10,
  css: `
    #root .01-silent-overwrite-copy{position:absolute;left:82px;top:82px;width:790px}
    #root .01-silent-overwrite-typebox{position:absolute;left:82px;top:285px;width:790px;height:230px;border-left:1px solid rgba(231,237,235,.22);padding-left:34px;overflow:hidden}
    #root .01-silent-overwrite-value{position:absolute;left:34px;top:18px;width:730px;font-size:68px;line-height:1.3;letter-spacing:-.04em;font-weight:480;white-space:nowrap;overflow:hidden}
    #root .01-silent-overwrite-caret{display:inline-block;width:8px;height:70px;background:#737BEB;margin-left:8px;vertical-align:-10px}
    #root .01-silent-overwrite-events{position:absolute;left:116px;top:568px;display:flex;gap:12px}
    #root .01-silent-overwrite-event{padding:13px 16px;border:1px solid rgba(231,237,235,.15);border-radius:7px;background:#202723;font:600 17px/1 "Geist Mono",monospace;color:#B4BDB8}
    #root .01-silent-overwrite-proof{position:absolute;right:82px;top:72px;width:860px;height:690px}
    #root .01-silent-overwrite-proof img{width:100%;height:100%;object-fit:cover;object-position:center top}
    #root .01-silent-overwrite-proofveil{position:absolute;inset:0;background:rgba(7,9,42,.18)}
    #root .01-silent-overwrite-verdict{position:absolute;right:126px;bottom:72px;width:760px;padding:22px 25px;border:1px solid rgba(242,155,143,.45);border-radius:8px;background:#2A1F22}
    #root .01-silent-overwrite-verdictrow{display:flex;justify-content:space-between;gap:30px;margin-top:13px;font:500 18px/1.25 "Geist Mono",monospace}
  `,
  body: `
    <div class="01-silent-overwrite-copy"><div class="01-silent-overwrite-kicker"><span class="01-silent-overwrite-spike">✱</span>the race nobody sees</div></div>
    <div class="01-silent-overwrite-typebox">
      <div id="01-silent-overwrite-human" class="01-silent-overwrite-value">Human verified runbook<span class="01-silent-overwrite-caret"></span></div>
      <div id="01-silent-overwrite-worker" class="01-silent-overwrite-value 01-silent-overwrite-red">Plane documentation<span class="01-silent-overwrite-caret"></span></div>
    </div>
    <div class="01-silent-overwrite-events">
      <div id="01-silent-overwrite-e1" class="01-silent-overwrite-event">NATIVE · dispatch</div>
      <div id="01-silent-overwrite-e2" class="01-silent-overwrite-event">MANUAL · save</div>
      <div id="01-silent-overwrite-e3" class="01-silent-overwrite-event">NATIVE · overwrite</div>
    </div>
    <div id="01-silent-overwrite-proof" class="01-silent-overwrite-proof 01-silent-overwrite-surface"><img src="assets/native-failure-verdict.png" alt="Interleave browser-verified Plane failure"/><div class="01-silent-overwrite-proofveil"></div></div>
    <div id="01-silent-overwrite-verdict" class="01-silent-overwrite-verdict"><div class="01-silent-overwrite-label 01-silent-overwrite-red">Rule violated</div><div class="01-silent-overwrite-verdictrow"><span>EXPECTED</span><b>Human verified runbook</b></div><div class="01-silent-overwrite-verdictrow"><span>ACTUAL</span><b class="01-silent-overwrite-red">Plane documentation</b></div></div>
  `,
  js: `
    tl.fromTo("#01-silent-overwrite-human",{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:1.9,ease:"steps(24)"},0.1)
      .set("#01-silent-overwrite-worker",{clipPath:"inset(0 100% 0 0)"},0)
      .fromTo("#01-silent-overwrite-e1",{opacity:0,y:20},{opacity:1,y:0,duration:.45},1.4)
      .fromTo("#01-silent-overwrite-e2",{opacity:0,y:20},{opacity:1,y:0,duration:.45},2.8)
      .to("#01-silent-overwrite-human",{clipPath:"inset(0 100% 0 0)",duration:1.0,ease:"steps(18)"},3.15)
      .fromTo("#01-silent-overwrite-worker",{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:1.35,ease:"steps(19)"},4.1)
      .fromTo("#01-silent-overwrite-e3",{opacity:0,y:20},{opacity:1,y:0,duration:.45},5.25)
      .fromTo("#01-silent-overwrite-proof",{opacity:0,x:70},{opacity:1,x:0,duration:.85},6.55)
      .fromTo("#01-silent-overwrite-verdict",{opacity:0,y:28},{opacity:1,y:0,duration:.65},7.15);
  `
});

files["02-assurance-layer.html"] = frame({
  id: "02-assurance-layer",
  duration: 9,
  css: `
    #root .02-assurance-layer-window{position:absolute;left:82px;top:54px;width:1756px;height:744px;transform-origin:22% 18%}
    #root .02-assurance-layer-window img{width:100%;height:100%;object-fit:cover;object-position:center top;opacity:.92}
    #root .02-assurance-layer-shade{position:absolute;inset:0;background:rgba(25,31,28,.2)}
    #root .02-assurance-layer-title{position:absolute;left:122px;top:86px;font-size:74px;letter-spacing:-.045em;line-height:1;font-weight:500;text-shadow:0 2px 18px rgba(0,0,0,.55)}
    #root .02-assurance-layer-native{position:absolute;right:116px;top:95px;background:#737BEB;color:#F2F3FF;border:0}
    #root .02-assurance-layer-rail{position:absolute;left:122px;right:122px;bottom:82px;display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
    #root .02-assurance-layer-step{height:98px;padding:18px;border:1px solid rgba(231,237,235,.2);background:#111612;border-radius:8px}
    #root .02-assurance-layer-step b{display:block;font-size:24px;font-weight:520;margin-top:12px}
    #root .02-assurance-layer-step span{font:600 14px/1 "Geist Mono",monospace;color:#9EA5FF}
  `,
  body: `
    <div id="02-assurance-layer-window" class="02-assurance-layer-window 02-assurance-layer-surface"><img src="assets/scroll-000.png" alt="Interleave five-stage WebMCP workbench"/><div class="02-assurance-layer-shade"></div><div id="02-assurance-layer-title" class="02-assurance-layer-title">interleave</div><div id="02-assurance-layer-native" class="02-assurance-layer-chip 02-assurance-layer-native">LIVE · 9 native tools</div><div class="02-assurance-layer-rail"><div id="02-assurance-layer-s1" class="02-assurance-layer-step"><span>01</span><b>Record</b></div><div id="02-assurance-layer-s2" class="02-assurance-layer-step"><span>02</span><b>Interrupt</b></div><div id="02-assurance-layer-s3" class="02-assurance-layer-step"><span>03</span><b>Inspect</b></div><div id="02-assurance-layer-s4" class="02-assurance-layer-step"><span>04</span><b>Minimize</b></div><div id="02-assurance-layer-s5" class="02-assurance-layer-step"><span>05</span><b>Export</b></div></div></div>
  `,
  js: `
    tl.fromTo("#02-assurance-layer-window",{scale:2.35,x:-230,y:-75},{scale:1,x:0,y:0,duration:3.9,ease:"power4.out"},.05)
      .fromTo("#02-assurance-layer-title",{opacity:0,y:24},{opacity:1,y:0,duration:.55},2.7)
      .fromTo("#02-assurance-layer-native",{opacity:0,y:-18},{opacity:1,y:0,duration:.5},3.2)
      .fromTo(["#02-assurance-layer-s1","#02-assurance-layer-s2","#02-assurance-layer-s3","#02-assurance-layer-s4","#02-assurance-layer-s5"],{opacity:0,y:28},{opacity:1,y:0,duration:.48,stagger:.42},5.05);
  `
});

files["03-native-source.html"] = frame({
  id: "03-native-source",
  duration: 11,
  css: `
    #root .03-native-source-copy{position:absolute;left:82px;top:82px;width:610px}
    #root .03-native-source-copy h1{margin:38px 0 0;font-size:74px;line-height:1.02;letter-spacing:-.04em;font-weight:470}
    #root .03-native-source-copy p{margin-top:28px;font-size:25px;line-height:1.45;color:#AEB9B3}
    #root .03-native-source-proof{position:absolute;right:82px;top:58px;width:1050px;height:720px}
    #root .03-native-source-proof img{width:100%;height:100%;object-fit:cover;object-position:center top}
    #root .03-native-source-overlay{position:absolute;inset:0;background:rgba(7,9,42,.08)}
    #root .03-native-source-stack{position:absolute;left:765px;top:110px;display:grid;gap:16px;width:490px}
    #root .03-native-source-card{padding:20px 22px;border:1px solid rgba(231,237,235,.22);border-radius:8px;background:rgba(17,22,18,.96)}
    #root .03-native-source-card b{display:block;margin-top:11px;font-size:29px;font-weight:520}
    #root .03-native-source-card code{display:block;margin-top:10px;font:500 17px/1.35 "Geist Mono",monospace;color:#C8D0CB;overflow-wrap:anywhere}
  `,
  body: `
    <div class="03-native-source-copy"><div class="03-native-source-kicker"><span class="03-native-source-spike">✱</span>real source · safe boundary</div><h1>Proof judges can inspect.</h1><p>A public Plane issue. A pinned commit. A deterministic local fixture.</p></div>
    <div id="03-native-source-proof" class="03-native-source-proof 03-native-source-surface"><img src="assets/native-failure-top.png" alt="Source-verified Interleave Plane lab"/><div class="03-native-source-overlay"></div></div>
    <div class="03-native-source-stack"><div id="03-native-source-c1" class="03-native-source-card"><span class="03-native-source-label">PUBLIC SOURCE</span><b>Plane #9674</b><code>da1a7ab85012d16836459a10dd92ec55eb739c69</code></div><div id="03-native-source-c2" class="03-native-source-card"><span class="03-native-source-label">WEBMCP</span><b class="03-native-source-violet">9 native tools</b><code>document.modelContext</code></div><div id="03-native-source-c3" class="03-native-source-card"><span class="03-native-source-label">BOUNDARY</span><b>0 live systems</b><code>fixture · mock · local replay</code></div></div>
  `,
  js: `
    tl.fromTo("#03-native-source-proof",{opacity:0,x:48},{opacity:1,x:0,duration:.75},.05)
      .fromTo(".03-native-source-copy",{opacity:0,y:28},{opacity:1,y:0,duration:.65},.2)
      .fromTo("#03-native-source-c1",{opacity:0,x:35},{opacity:1,x:0,duration:.55},2.7)
      .fromTo("#03-native-source-c2",{opacity:0,x:35},{opacity:1,x:0,duration:.55},5.05)
      .fromTo("#03-native-source-c3",{opacity:0,x:35},{opacity:1,x:0,duration:.55},7.65);
  `
});

files["04-the-race.html"] = frame({
  id: "04-the-race",
  duration: 17,
  css: `
    #root .04-the-race-photo{position:absolute;inset:0;opacity:.22}
    #root .04-the-race-photo img{width:100%;height:100%;object-fit:cover}
    #root .04-the-race-world{position:absolute;left:0;top:0;width:4560px;height:820px;transform-origin:left center}
    #root .04-the-race-line{position:absolute;left:240px;top:415px;width:3900px;height:1px;background:rgba(231,237,235,.24)}
    #root .04-the-race-station{position:absolute;top:132px;width:1050px;height:545px;padding:44px 48px;border:1px solid rgba(231,237,235,.19);border-radius:12px;background:#111612}
    #root .04-the-race-station:after{content:"";position:absolute;left:50%;bottom:-21px;width:40px;height:40px;margin-left:-20px;border-radius:50%;background:#191F1C;border:1px solid rgba(231,237,235,.32)}
    #root .04-the-race-station h2{margin:36px 0 0;font-size:70px;line-height:1.02;letter-spacing:-.04em;font-weight:470}
    #root .04-the-race-station p{font:500 22px/1.55 "Geist Mono",monospace;color:#ABB6B0;margin-top:34px}
    #root .04-the-race-station code{display:inline-block;margin-top:24px;padding:13px 16px;border:1px solid rgba(231,237,235,.16);border-radius:7px;color:#E7EDEB;font:500 18px/1 "Geist Mono",monospace}
    #root .04-the-race-s1{left:220px}.04-the-race-s2{left:1700px}.04-the-race-s3{left:3180px}
    #root .04-the-race-latency{position:absolute;left:330px;top:730px;width:3600px;height:9px;background:#2D3531;border-radius:999px;overflow:hidden}
    #root .04-the-race-latencyfill{width:100%;height:100%;background:#737BEB;transform-origin:left center}
    #root .04-the-race-all{position:absolute;left:614px;top:32px;font-size:62px;letter-spacing:-.04em;opacity:0}
  `,
  body: `
    <div class="04-the-race-photo"><img src="assets/native-failure-verdict.png" alt="Recorded native manual native event order"/></div>
    <div id="04-the-race-world" class="04-the-race-world" data-layout-allow-overflow><div class="04-the-race-line"></div><div id="04-the-race-s1" class="04-the-race-station 04-the-race-s1"><span class="04-the-race-label">NATIVE · 00:25.424</span><h2>Dispatch the crawler.</h2><p>plane_patch_link_slow</p><code>status · pending</code></div><div id="04-the-race-s2" class="04-the-race-station 04-the-race-s2"><span class="04-the-race-label">MANUAL · +2.989s</span><h2>Human verified runbook</h2><p>Save metadata while the worker waits.</p><code class="04-the-race-violet">human intent · committed</code></div><div id="04-the-race-s3" class="04-the-race-station 04-the-race-s3"><span class="04-the-race-label">NATIVE · +8.002s</span><h2 class="04-the-race-red">Plane documentation</h2><p>The fulfilled worker writes its stale result.</p><code>duration · 8.006s</code></div><div class="04-the-race-latency"><div id="04-the-race-latencyfill" class="04-the-race-latencyfill"></div></div><div id="04-the-race-all" class="04-the-race-all">native&nbsp;&nbsp;→&nbsp;&nbsp;<span class="04-the-race-violet">manual</span>&nbsp;&nbsp;→&nbsp;&nbsp;native</div></div>
  `,
  js: `
    tl.set("#04-the-race-world",{x:0,scale:1},0)
      .fromTo("#04-the-race-s1",{opacity:0,y:40},{opacity:1,y:0,duration:.7},.05)
      .fromTo("#04-the-race-latencyfill",{scaleX:0},{scaleX:1,duration:11.6,ease:"none"},.15)
      .to("#04-the-race-world",{x:-1480,duration:1.55,ease:"power3.inOut"},4.75)
      .fromTo("#04-the-race-s2",{opacity:0,y:40},{opacity:1,y:0,duration:.65},5.85)
      .to("#04-the-race-world",{x:-2960,duration:1.55,ease:"power3.inOut"},9.55)
      .fromTo("#04-the-race-s3",{opacity:0,y:40},{opacity:1,y:0,duration:.65},10.7)
      .to("#04-the-race-world",{x:96,y:0,scale:.39,duration:1.25,ease:"power4.out"},14.15)
      .to("#04-the-race-all",{opacity:1,duration:.45},15.0);
  `
});

files["05-rule-violation.html"] = frame({
  id: "05-rule-violation",
  duration: 11,
  css: `
    #root .05-rule-violation-proof{position:absolute;left:82px;top:54px;width:1756px;height:736px;opacity:.24}
    #root .05-rule-violation-proof img{width:100%;height:100%;object-fit:cover;object-position:center top}
    #root .05-rule-violation-rulebox{position:absolute;left:118px;right:118px;top:84px;padding:24px 30px;border:1px solid rgba(231,237,235,.2);border-radius:8px;background:#111612}
    #root .05-rule-violation-rulebox code{display:block;margin-top:12px;font:500 24px/1.35 "Geist Mono",monospace}
    #root .05-rule-violation-events{display:flex;gap:12px;margin-top:18px}
    #root .05-rule-violation-panels{position:absolute;left:118px;right:118px;top:300px;display:grid;grid-template-columns:1fr 1fr;gap:28px;perspective:1300px}
    #root .05-rule-violation-panel{height:372px;padding:34px;border:1px solid rgba(231,237,235,.2);border-radius:10px;background:#202723}
    #root .05-rule-violation-panel h2{margin-top:46px;font-size:55px;line-height:1.05;letter-spacing:-.035em;font-weight:480}
    #root .05-rule-violation-panel p{margin-top:35px;font:500 18px/1.4 "Geist Mono",monospace;color:#A8AFB8}
    #root .05-rule-violation-fail{position:absolute;left:50%;top:650px;width:340px;margin-left:-170px;padding:18px;text-align:center;border-radius:7px;background:#2A1F22;border:1px solid rgba(242,155,143,.5);font:650 20px/1 "Geist Mono",monospace;color:#F29B8F}
  `,
  body: `
    <div class="05-rule-violation-proof 05-rule-violation-surface"><img src="assets/native-failure-verdict.png" alt="Interleave preservation rule verdict"/></div><div id="05-rule-violation-rulebox" class="05-rule-violation-rulebox"><span class="05-rule-violation-label"><span class="05-rule-violation-spike">✱</span>preservation rule</span><code>A later human edit must survive an earlier asynchronous operation.</code><div class="05-rule-violation-events"><span id="05-rule-violation-e1" class="05-rule-violation-chip" data-layout-allow-overlap>NATIVE · dispatch</span><span id="05-rule-violation-e2" class="05-rule-violation-chip">MANUAL · edit</span><span id="05-rule-violation-e3" class="05-rule-violation-chip">NATIVE · overwrite</span></div></div><div class="05-rule-violation-panels"><div id="05-rule-violation-left" class="05-rule-violation-panel"><span class="05-rule-violation-label">EXPECTED</span><h2 class="05-rule-violation-green">Human verified runbook</h2><p>human intent preserved</p></div><div id="05-rule-violation-right" class="05-rule-violation-panel"><span class="05-rule-violation-label">ACTUAL</span><h2 class="05-rule-violation-red">Plane documentation</h2><p>stale worker value applied</p></div></div><div id="05-rule-violation-fail" class="05-rule-violation-fail">RULE VIOLATED</div>
  `,
  js: `
    tl.fromTo("#05-rule-violation-rulebox",{opacity:0,y:-24},{opacity:1,y:0,duration:.6},.05)
      .fromTo("#05-rule-violation-e1",{opacity:0,y:16},{opacity:1,y:0,duration:.38},1.4)
      .fromTo("#05-rule-violation-e2",{opacity:0,y:16},{opacity:1,y:0,duration:.38},2.15)
      .fromTo("#05-rule-violation-e3",{opacity:0,y:16},{opacity:1,y:0,duration:.38},2.9)
      .fromTo("#05-rule-violation-left",{opacity:0,x:-120,rotationY:10},{opacity:1,x:0,rotationY:0,duration:.8},3.45)
      .fromTo("#05-rule-violation-right",{opacity:0,x:120,rotationY:-10},{opacity:1,x:0,rotationY:0,duration:.8},5.65)
      .fromTo("#05-rule-violation-fail",{opacity:0,scale:.92},{opacity:1,scale:1,duration:.5},7.45);
  `
});

files["06-replay-minimize.html"] = frame({
  id: "06-replay-minimize",
  duration: 11,
  css: `
    #root .06-replay-minimize-proof{position:absolute;inset:0;opacity:.2}
    #root .06-replay-minimize-proof img{width:100%;height:100%;object-fit:cover}
    #root .06-replay-minimize-top{position:absolute;left:82px;right:82px;top:70px;display:flex;justify-content:space-between;align-items:flex-start}
    #root .06-replay-minimize-count{font-size:118px;line-height:.85;letter-spacing:-.06em;font-variant-numeric:tabular-nums}
    #root .06-replay-minimize-count span{display:block;margin-top:20px;font:600 18px/1 "Geist Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#A8AFB8}
    #root .06-replay-minimize-title{width:760px;text-align:right;font-size:66px;line-height:1.02;letter-spacing:-.04em}
    #root .06-replay-minimize-grid{position:absolute;left:82px;right:82px;top:340px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
    #root .06-replay-minimize-card{height:306px;padding:30px;border:1px solid rgba(231,237,235,.21);border-radius:10px;background:#111612}
    #root .06-replay-minimize-num{font:600 16px/1 "Geist Mono",monospace;color:#9EA5FF}
    #root .06-replay-minimize-card h2{margin-top:60px;font:550 31px/1.15 "Geist Mono",monospace}
    #root .06-replay-minimize-card p{margin-top:25px;font-size:22px;color:#A8AFB8}
    #root .06-replay-minimize-result{position:absolute;left:82px;right:82px;top:694px;padding:23px 28px;border:1px solid rgba(166,230,187,.38);border-radius:8px;background:#173022;display:flex;justify-content:space-between;align-items:center}
    #root .06-replay-minimize-result b{font-size:28px}.06-replay-minimize-result code{font:600 18px/1 "Geist Mono",monospace;color:#A6E6BB}
  `,
  body: `
    <div class="06-replay-minimize-proof"><img src="assets/native-failure-compare.png" alt="Interleave deterministic replay and reduction"/></div><div class="06-replay-minimize-top"><div id="06-replay-minimize-count" class="06-replay-minimize-count" data-layout-allow-overlap>4<span data-layout-allow-overlap>reduction attempts</span></div><div class="06-replay-minimize-title"><span class="06-replay-minimize-spike">✱</span>One race. Three commands.</div></div><div class="06-replay-minimize-grid"><div id="06-replay-minimize-c1" class="06-replay-minimize-card"><span class="06-replay-minimize-num">01</span><h2>start_crawl</h2><p>queue stale work</p></div><div id="06-replay-minimize-c2" class="06-replay-minimize-card"><span class="06-replay-minimize-num">02</span><h2>edit_metadata</h2><p>save human intent</p></div><div id="06-replay-minimize-c3" class="06-replay-minimize-card"><span class="06-replay-minimize-num">03</span><h2>release</h2><p>finish the worker</p></div></div><div id="06-replay-minimize-result" class="06-replay-minimize-result"><b>Minimum still reproduces</b><code>FAIL · deterministic</code></div>
  `,
  js: `
    const count={v:0};
    tl.fromTo("#06-replay-minimize-count",{opacity:0,y:24},{opacity:1,y:0,duration:.55},.05)
      .to(count,{v:4,duration:1.5,ease:"power2.out",onUpdate:()=>document.querySelector("#06-replay-minimize-count").firstChild.nodeValue=Math.round(count.v)},.15)
      .fromTo("#06-replay-minimize-c1",{opacity:0,y:55,scale:.96},{opacity:1,y:0,scale:1,duration:.6},3.15)
      .fromTo("#06-replay-minimize-c2",{opacity:0,y:55,scale:.96},{opacity:1,y:0,scale:1,duration:.6},4.75)
      .fromTo("#06-replay-minimize-c3",{opacity:0,y:55,scale:.96},{opacity:1,y:0,scale:1,duration:.6},6.35)
      .fromTo("#06-replay-minimize-result",{opacity:0,y:28},{opacity:1,y:0,duration:.55},8.0);
  `
});

files["07-fix-and-contribute.html"] = frame({
  id: "07-fix-and-contribute",
  duration: 16,
  css: `
    #root .07-fix-and-contribute-kick{position:absolute;left:82px;top:62px}
    #root .07-fix-and-contribute-panels{position:absolute;left:82px;right:82px;top:118px;display:grid;grid-template-columns:1fr 1fr;gap:24px;perspective:1400px}
    #root .07-fix-and-contribute-card{height:410px;padding:30px;border:1px solid rgba(231,237,235,.2);border-radius:11px;background:#111612;overflow:hidden}
    #root .07-fix-and-contribute-cardhead{display:flex;justify-content:space-between;align-items:center}
    #root .07-fix-and-contribute-card h2{margin-top:55px;font-size:58px;line-height:1.02;letter-spacing:-.04em}
    #root .07-fix-and-contribute-card p{margin-top:28px;font:500 18px/1.45 "Geist Mono",monospace;color:#A8AFB8}
    #root .07-fix-and-contribute-status{font:650 20px/1 "Geist Mono",monospace;padding:10px 13px;border:1px solid currentColor;border-radius:6px}
    #root .07-fix-and-contribute-proofstrip{position:absolute;left:82px;right:82px;top:570px;height:132px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
    #root .07-fix-and-contribute-receipt{padding:22px 25px;border:1px solid rgba(231,237,235,.18);border-radius:8px;background:#202723;display:flex;align-items:center;gap:22px}
    #root .07-fix-and-contribute-receipt img{width:160px;height:88px;object-fit:cover;border-radius:5px;opacity:.68}
    #root .07-fix-and-contribute-receipt b{display:block;font-size:24px}.07-fix-and-contribute-receipt code{display:block;margin-top:10px;font:500 15px/1 "Geist Mono",monospace;color:#A8AFB8}
    #root .07-fix-and-contribute-stats{position:absolute;left:82px;right:82px;top:728px;display:grid;grid-template-columns:1fr 1.3fr;gap:18px}
    #root .07-fix-and-contribute-stat{height:112px;padding:23px 28px;border-top:1px solid rgba(231,237,235,.21);display:flex;align-items:baseline;gap:17px}
    #root .07-fix-and-contribute-stat b{font-size:64px;line-height:1;font-weight:480;letter-spacing:-.04em}.07-fix-and-contribute-stat span{font:600 17px/1 "Geist Mono",monospace;color:#A8AFB8;text-transform:uppercase;letter-spacing:.08em}
  `,
  body: `
    <div class="07-fix-and-contribute-kick 07-fix-and-contribute-kicker"><span class="07-fix-and-contribute-spike" data-layout-allow-overlap>✱</span>prove the fix · contribute it</div><div class="07-fix-and-contribute-panels"><div id="07-fix-and-contribute-current" class="07-fix-and-contribute-card"><div class="07-fix-and-contribute-cardhead"><span class="07-fix-and-contribute-label">CURRENT PLANE</span><span class="07-fix-and-contribute-status 07-fix-and-contribute-red">FAIL</span></div><h2 class="07-fix-and-contribute-red">Plane documentation</h2><p>stale worker applied · human intent lost</p></div><div id="07-fix-and-contribute-proposed" class="07-fix-and-contribute-card"><div class="07-fix-and-contribute-cardhead"><span class="07-fix-and-contribute-label">PROPOSED GUARD</span><span class="07-fix-and-contribute-status 07-fix-and-contribute-green">PASS</span></div><h2 class="07-fix-and-contribute-green">Human verified runbook</h2><p>compare-and-set blocked stale worker</p></div></div><div class="07-fix-and-contribute-proofstrip"><div id="07-fix-and-contribute-r1" class="07-fix-and-contribute-receipt"><img src="assets/native-failure-compare.png" alt="Interleave replay comparison"/><div><b>Regression exported</b><code>deterministic · runnable</code></div></div><div id="07-fix-and-contribute-r2" class="07-fix-and-contribute-receipt"><img src="assets/native-failure-recorder.png" alt="Interleave patch export receipt"/><div><b>5-file Plane patch</b><code>local review artifact</code></div></div></div><div class="07-fix-and-contribute-stats"><div id="07-fix-and-contribute-stat1" class="07-fix-and-contribute-stat"><b>13</b><span>new cases</span></div><div id="07-fix-and-contribute-stat2" class="07-fix-and-contribute-stat"><b class="07-fix-and-contribute-green">37 / 37</b><span>Plane tests passing</span></div></div>
  `,
  js: `
    tl.fromTo("#07-fix-and-contribute-current",{opacity:0,x:-110,rotationY:9},{opacity:1,x:0,rotationY:0,duration:.8},.05)
      .fromTo("#07-fix-and-contribute-proposed",{opacity:0,x:110,rotationY:-9},{opacity:1,x:0,rotationY:0,duration:.8},4.25)
      .fromTo("#07-fix-and-contribute-r1",{opacity:0,y:32},{opacity:1,y:0,duration:.55},8.7)
      .fromTo("#07-fix-and-contribute-r2",{opacity:0,y:32},{opacity:1,y:0,duration:.55},10.3)
      .fromTo("#07-fix-and-contribute-stat1",{opacity:0,y:24},{opacity:1,y:0,duration:.5},12.25)
      .fromTo("#07-fix-and-contribute-stat2",{opacity:0,y:24},{opacity:1,y:0,duration:.5},13.55);
  `
});

files["08-trust-concurrent-software.html"] = frame({
  id: "08-trust-concurrent-software",
  duration: 8,
  css: `
    #root .08-trust-concurrent-software-photo{position:absolute;inset:0;opacity:.1}
    #root .08-trust-concurrent-software-photo img{width:100%;height:100%;object-fit:cover}
    #root .08-trust-concurrent-software-center{position:absolute;left:50%;top:42%;width:1500px;margin-left:-750px;text-align:center}
    #root .08-trust-concurrent-software-seeds{position:absolute;left:50%;top:198px;width:360px;height:360px;margin-left:-180px}
    #root .08-trust-concurrent-software-seed{position:absolute;left:170px;top:170px;width:20px;height:2px;background:#737BEB;transform-origin:left center}
    #root .08-trust-concurrent-software-mark{display:inline-block;color:#737BEB;font-size:120px;line-height:1}
    #root .08-trust-concurrent-software-word{display:inline-block;margin-left:24px;font-size:116px;line-height:1;letter-spacing:-.055em;font-weight:500}
    #root .08-trust-concurrent-software-sub{margin-top:24px;font:600 21px/1 "Geist Mono",monospace;letter-spacing:.15em;text-transform:uppercase;color:#A8AFB8}
    #root .08-trust-concurrent-software-verbs{margin-top:64px;font-size:38px;letter-spacing:-.025em;color:#CDD5D0}
    #root .08-trust-concurrent-software-verbs span{display:inline-block;margin:0 18px}
    #root .08-trust-concurrent-software-route{display:inline-block;margin-top:42px;padding:15px 22px;border:1px solid rgba(231,237,235,.22);border-radius:999px;background:#202723;font:600 19px/1 "Geist Mono",monospace;color:#E7EDEB}
  `,
  body: `
    <div class="08-trust-concurrent-software-photo"><img src="assets/native-failure-top.png" alt="Interleave native WebMCP lab"/></div><div id="08-trust-concurrent-software-seeds" class="08-trust-concurrent-software-seeds"><i class="08-trust-concurrent-software-seed"></i><i class="08-trust-concurrent-software-seed"></i><i class="08-trust-concurrent-software-seed"></i><i class="08-trust-concurrent-software-seed"></i><i class="08-trust-concurrent-software-seed"></i></div><div class="08-trust-concurrent-software-center"><div><span id="08-trust-concurrent-software-mark" class="08-trust-concurrent-software-mark" data-layout-allow-overlap>✱</span><span id="08-trust-concurrent-software-word" class="08-trust-concurrent-software-word" data-layout-allow-overlap>interleave</span></div><div id="08-trust-concurrent-software-sub" class="08-trust-concurrent-software-sub">webmcp concurrency assurance</div><div class="08-trust-concurrent-software-verbs"><span id="08-trust-concurrent-software-v1">Record the race.</span><span id="08-trust-concurrent-software-v2">Prove the failure.</span><span id="08-trust-concurrent-software-v3">Ship the fix.</span></div><div id="08-trust-concurrent-software-route" class="08-trust-concurrent-software-route">interleave-webmcp-lab.asaborodaniel.chatgpt.site/plane</div></div>
  `,
  js: `
    const seeds=[...document.querySelectorAll(".08-trust-concurrent-software-seed")];
    seeds.forEach((el,i)=>gsap.set(el,{rotation:i*72,scaleX:5.5,x:Math.cos(i*1.256)*230,y:Math.sin(i*1.256)*230}));
    tl.to(seeds,{x:0,y:0,scaleX:1,duration:1.7,stagger:.07,ease:"power4.inOut"},.05)
      .fromTo("#08-trust-concurrent-software-mark",{opacity:0,scale:.7},{opacity:1,scale:1,duration:.6},1.25)
      .fromTo("#08-trust-concurrent-software-word",{opacity:0,x:-70,filter:"blur(14px)"},{opacity:1,x:0,filter:"blur(0px)",duration:.8},1.75)
      .fromTo("#08-trust-concurrent-software-sub",{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:.8},2.45)
      .fromTo("#08-trust-concurrent-software-v1",{opacity:0,y:22},{opacity:1,y:0,duration:.42},4.05)
      .fromTo("#08-trust-concurrent-software-v2",{opacity:0,y:22},{opacity:1,y:0,duration:.42},4.72)
      .fromTo("#08-trust-concurrent-software-v3",{opacity:0,y:22},{opacity:1,y:0,duration:.42},5.4)
      .fromTo("#08-trust-concurrent-software-route",{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:.7},6.2);
  `
});

for (const [name, html] of Object.entries(files)) {
  const n = name.slice(0, 2);
  const safe = html
    .replaceAll(`.${n}-`, `.f${n}-`)
    .replaceAll(`#${n}-`, `#f${n}-`)
    .replaceAll(`id="${n}-`, `id="f${n}-`)
    .replaceAll(`class="${n}-`, `class="f${n}-`)
    .replaceAll(` ${n}-`, ` f${n}-`)
    .replaceAll(`data-composition-id="f${n}-`, `data-composition-id="${n}-`);
  writeFileSync(join(out, name), safe);
}
console.log(`wrote ${Object.keys(files).length} frames to ${out}`);
