// Renders public/og-image.jpg (1200×630) and public/apple-touch-icon.png
// (180×180) from the room art, favicon and self-hosted fonts.
// Run with `npm run images` after changing any of those.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const dataUri = (path, type) =>
  `data:${type};base64,${readFileSync(path).toString("base64")}`;
const font = (pkg, file) =>
  dataUri(`node_modules/@fontsource/${pkg}/files/${file}`, "font/woff2");

const room = dataUri("public/art/studio-room.png", "image/png");
const player = dataUri("public/art/character-standing.png", "image/png");
const icon = dataUri("public/favicon.svg", "image/svg+xml");

const og = `<!doctype html><style>
@font-face{font-family:Spectral;font-weight:300;src:url(${font("spectral", "spectral-latin-300-normal.woff2")})}
@font-face{font-family:"Archivo Narrow";font-weight:600;src:url(${font("archivo-narrow", "archivo-narrow-latin-600-normal.woff2")})}
body{margin:0;width:1200px;height:630px;background:#160e13;overflow:hidden;position:relative;font-family:"Archivo Narrow"}
.room{position:absolute;right:-60px;top:-10px;width:960px}
.room img{display:block;width:100%;filter:brightness(.42) saturate(.7)}
.room .p{position:absolute;width:16%;left:53%;top:79%;transform:translate(-50%,-100%)}
.room .p img{image-rendering:pixelated}
.room::before{content:"";position:absolute;inset:0;z-index:2;mix-blend-mode:screen;
  background:radial-gradient(circle at 37.6% 36%,#ffb34788 0,#ffb34730 11%,transparent 30%)}
.room::after{content:"";position:absolute;inset:0;z-index:3;
  background:radial-gradient(ellipse 64% 62% at 55% 48%,transparent 62%,#160e13 100%)}
.fade{position:absolute;inset:0;z-index:4;background:linear-gradient(90deg,#160e13 30%,#160e13cc 40%,transparent 54%)}
.copy{position:absolute;z-index:5;left:72px;bottom:84px;width:530px;color:#efe6d8}
.brand{display:flex;align-items:center;gap:14px;font-size:30px;color:#fff5e6;margin-bottom:34px}
.brand img{width:44px;height:44px;image-rendering:pixelated}
h1{font-family:Spectral;font-weight:300;font-size:68px;line-height:1.04;margin:0 0 22px;color:#fff5e6}
p{margin:0;font-size:24px;color:#ffb347}
</style>
<div class="room"><img src="${room}"><div class="p"><img src="${player}"></div></div>
<div class="fade"></div>
<div class="copy"><div class="brand"><img src="${icon}">Side Quest Studio</div>
<h1>A studio for your side quests.</h1><p>Write the book, build the app, make the content.</p></div>`;

const touch = `<!doctype html><style>body{margin:0}img{display:block;width:180px;height:180px;image-rendering:pixelated}</style><img src="${icon}">`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(og);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: "public/og-image.jpg",
  type: "jpeg",
  quality: 88,
});
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(touch);
await page.screenshot({ path: "public/apple-touch-icon.png" });
await browser.close();
