#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 资产生成脚本为 CLI 工具,需 console 输出诊断信息 */
// 桌面端 NSIS 安装器品牌视觉资产生成器。
//
// 产出(scale ∈ {1, 1.25, 1.5, 1.75, 2},对应 Windows 标准缩放 100%/125%/150%/175%/200%):
//   installer-assets/assets-100|125|150|175|200/
//     splash.bmp + splash1..7.bmp   开屏动画帧(AdvSplash 多帧序列,640x360 逻辑尺寸)
//     welcome.bmp / dir.bmp / instfiles.bmp / finish.bmp   四个向导页满幅背景(880x600 逻辑)
//     btn-*.bmp                     扁平位图按钮(主 CTA / 幽灵按钮 / 快捷方式开关)
//   windows/ihui-assets-path.nsh    资产根目录 define(ihui-ui.nsi 编译期 File 嵌入用)
//   供 ihui-ui.nsi 在运行时按窗口 DPI 挑选对应档位从 $PLUGINSDIR 加载。
//
// 设计系统(2026-09-19 用户定稿:黑色主调 · 极简黑白杂志风,与 web 端 design-tokens 暗色模式统一):
//   所有取值直接映射 @ihui/design-tokens tokens.css 暗色块(.dark),禁止自造色值:
//   bg #242424(.dark --color-background hsl(0 0% 14%)) · card #1A1A1A(.dark --color-card)
//   主文字 #FAFAFA(--color-foreground) · 正文 #D4D4D4(--color-text-medium)
//   次级 #737373(--color-text-tertiary) · 描边 #525252(.dark --color-border-medium)
//   CTA 纯白底黑字(.dark --color-primary/--color-primary-foreground,2026-07-24 用户定稿)
//   唯一圆角 token:--global-border-radius = 8px(按钮/容器/窗口四角统一 8px)
//   按钮高度唯一档位(web <Button> size 表):CTA lg = h-10 40px · 输入框 sm = h-8 32px
//   开关 Switch = h-7 28px(与 web <Switch size="lg"> 逐像素对齐,见 switchScene)
// 渲染管线:SVG(内嵌 icon.png 抠底 logo,系统字体微软雅黑) → sharp → RGB raw → 24bit BMP
//
// 用法:
//   node scripts/desktop-installer-assets.mjs            # 生成资产(输出 BMP + %TEMP% PNG 预览)
//   node scripts/desktop-installer-assets.mjs --previews # 仅输出 PNG 预览到 %TEMP%,便于人工审阅

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ASSETS = join(ROOT, 'apps/desktop/src-tauri/windows/installer-assets');
const PREVIEWS = join(tmpdir(), 'ihui-installer-preview');

const require = createRequire(join(ROOT, 'apps/desktop/package.json'));
const sharp = require('sharp');

const VERSION = JSON.parse(readFileSync(join(ROOT, 'apps/desktop/package.json'), 'utf8')).version;

// ---- 设计令牌(全部映射 @ihui/design-tokens tokens.css 暗色块,勿自造值) ----

const C = {
  bg: '#242424', // 页面底(.dark --color-background hsl(0 0% 14%))
  card: '#1A1A1A', // 容器/面板(.dark --color-card hsl(0 0% 10%))
  ink: '#FAFAFA', // 主文字(.dark --color-foreground)
  inkSoft: '#D4D4D4', // 正文(.dark --color-text-medium)
  muted: '#737373', // 次级文字(.dark --color-text-tertiary)
  hairline: '#3D3D3D', // 细分隔线(white-10 于 bg 上合成)
  ghost: '#2E2E2E', // 巨号页码水印
  primary: '#FFFFFF', // CTA 底(.dark --color-primary 纯白)
  primaryInk: '#000000', // CTA 文字(.dark --color-primary-foreground 纯黑)
  btnStroke: '#525252', // 幽灵按钮/容器描边(.dark --color-border-medium)
  toggleOffTrack: '#2E2E2E', // 开关 off 轨道(旧胶囊方案遗留,已废弃)
  toggleOffKnob: '#737373', // 开关 off 圆钮(旧胶囊方案遗留,已废弃)
  accent: '#a3c4d6', // 高级灰蓝(.dark --color-brand-accent,Switch ON 填充)
};
// 唯一圆角 token:web --global-border-radius = 8px(AGENTS.md 圆角梯度 rounded-lg)
const RADIUS = 8;
const FONT = 'Microsoft YaHei UI, Microsoft YaHei, PingFang SC, sans-serif';

// ---- logo:icon.png 黑底 → 以亮度生成 alpha,输出透明底 PNG dataURI ----------

async function loadLogoDataUri() {
  const src = join(ROOT, 'apps/desktop/src-tauri/icons/icon.png');
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // 黑底抠图:alpha 取通道最大值并略作增益,颜色保持原渐变
    const lum = Math.max(r, g, b);
    const a = Math.min(255, Math.round(lum * 1.6));
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = a;
  }
  const png = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

// ---- SVG 骨架 ---------------------------------------------------------------

function esc(s) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function svgDoc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 880 600">
${body}
</svg>`;
}

// 巨号页码水印(杂志页码,超浅灰,置于版面右上)
function ghostNumeral(n) {
  return `<text x="816" y="268" font-family="${FONT}" font-size="200" font-weight="700" fill="${C.ghost}" text-anchor="end">${n}</text>`;
}

// 小节引导标签(字距拉开,杂志 kicker)
function kicker(x, y, text) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="11" fill="${C.muted}" letter-spacing="3">${esc(text)}</text>`;
}

// 页面公共骨架:黑底 + 顶部品牌行 + 上下 hairline + 页脚
function pageChrome(logo) {
  return `
<rect width="880" height="600" fill="${C.bg}"/>
<image href="${logo}" x="64" y="40" width="36" height="36"/>
<text x="112" y="58" font-family="${FONT}" font-size="15" font-weight="700" fill="${C.ink}">智汇AI</text>
<text x="112" y="76" font-family="${FONT}" font-size="9" fill="${C.muted}" letter-spacing="2.5">IHUI AI DESKTOP</text>
<text x="760" y="58" font-family="${FONT}" font-size="10" fill="${C.muted}" letter-spacing="3" text-anchor="end">安装向导 / SETUP</text>
<rect x="64" y="96" width="752" height="1" fill="${C.hairline}"/>
<rect x="64" y="548" width="752" height="1" fill="${C.hairline}"/>
<text x="64" y="572" font-family="${FONT}" font-size="11" fill="${C.muted}">© 2026 IHUI AI (智汇AI) · 李春川 · aizhs.top</text>
<text x="816" y="572" font-family="${FONT}" font-size="11" fill="${C.muted}" text-anchor="end">v${VERSION}</text>`;
}

// ---- 四个向导页场景 ---------------------------------------------------------

function sceneWelcome(logo) {
  const features = [
    ['01', '云端智能体 · 桌面与网页无缝切换'],
    ['02', '账号云同步 · 换机不丢任何数据'],
    ['03', '自动保持最新 · 无需手动升级'],
  ];
  return svgDoc(880, 600, `
${pageChrome(logo)}
${ghostNumeral('01')}
${kicker(64, 176, 'INSTALLATION GUIDE — 桌面版安装向导')}
<text x="64" y="252" font-family="${FONT}" font-size="54" font-weight="700" fill="${C.ink}">智汇AI 桌面版</text>
<text x="64" y="294" font-family="${FONT}" font-size="17" fill="${C.muted}">连接你与 AI 智能体的专属工作台</text>
${features.map(([no, t], i) => `
<text x="64" y="${366 + i * 46}" font-family="${FONT}" font-size="11" fill="${C.muted}" letter-spacing="1">${no}</text>
<text x="104" y="${367 + i * 46}" font-family="${FONT}" font-size="15" fill="${C.inkSoft}">${esc(t)}</text>
<rect x="64" y="${380 + i * 46}" width="392" height="1" fill="${C.hairline}"/>`).join('')}
<image href="${logo}" x="580" y="176" width="208" height="208"/>
`);
}

function sceneDir(logo) {
  return svgDoc(880, 600, `
${pageChrome(logo)}
${ghostNumeral('02')}
${kicker(64, 176, 'STEP 01 — 安装位置')}
<text x="64" y="240" font-family="${FONT}" font-size="38" font-weight="700" fill="${C.ink}">选择安装位置</text>
<text x="64" y="276" font-family="${FONT}" font-size="15" fill="${C.muted}">默认安装到 D:\\智汇AI,你也可以更改为其他目录。</text>
<rect x="64" y="312" width="752" height="40" rx="${RADIUS}" fill="${C.card}" stroke="${C.btnStroke}" stroke-width="1.5"/>
<text x="64" y="416" font-family="${FONT}" font-size="12" fill="${C.muted}">体积轻巧 · 数据云端存储 · 卸载不留残余</text>
`);
}

function sceneInstfiles(logo) {
  return svgDoc(880, 600, `
${pageChrome(logo)}
${ghostNumeral('03')}
${kicker(64, 176, 'STEP 02 — 正在安装')}
<text x="64" y="240" font-family="${FONT}" font-size="38" font-weight="700" fill="${C.ink}">正在安装</text>
<text x="64" y="276" font-family="${FONT}" font-size="15" fill="${C.muted}">智汇AI 正在写入你的电脑,请稍候…</text>
<text x="64" y="408" font-family="${FONT}" font-size="9" fill="${C.muted}" letter-spacing="3">INSTALL PROGRESS</text>
; 进度条无 BMP 外框: 原生进度条运行时以 SetWindowRgn 胶囊圆角化(轨道即 BMP 底色留白区 y=425 h=8)
<text x="64" y="480" font-family="${FONT}" font-size="12" fill="${C.muted}">安装完成后可直接启动,你的数据始终保存在云端</text>
`);
}

// 完成页:三个开关行(完成后打开 / 开机自启 / 桌面快捷方式),开关控件为运行时叠加的位图按钮,
// 标签烧入位图。行坐标与 ihui-ui.nsi IHUIFinishPage 的开关控件坐标一一对应,改动必须同步。
function sceneFinish(logo) {
  const rows = [
    [396, '完成后立即打开智汇AI'],
    [440, '开机自动启动'],
    [484, '创建桌面快捷方式'],
  ];
  return svgDoc(880, 600, `
${pageChrome(logo)}
${ghostNumeral('04')}
<image href="${logo}" x="392" y="140" width="96" height="96"/>
<text x="440" y="312" font-family="${FONT}" font-size="42" font-weight="700" fill="${C.ink}" text-anchor="middle">安装完成</text>
<text x="440" y="348" font-family="${FONT}" font-size="15" fill="${C.muted}" text-anchor="middle">欢迎来到智汇AI · aizhs.top</text>
<rect x="340" y="384" width="200" height="1" fill="${C.hairline}"/>
${rows
  .map(
    ([y, label]) => `
<text x="136" y="${y + 20}" font-family="${FONT}" font-size="15" fill="${C.inkSoft}">${esc(label)}</text>`,
  )
  .join('')}
`);
}

// ---- 开屏动画帧(640x360,坐标系按 640x360 设计) ----------------------------

function splashScene(frame, logo) {
  // frame 0..7:logo 渐显 → 字标渐显 → 标语 → 底部白色细线延展(黑底杂志风开屏)
  const markOp = frame === 0 ? 0.5 : 1;
  const markSize = frame === 0 ? 78 : frame === 1 ? 86 : 92;
  const wordOp = frame < 2 ? 0 : frame === 2 ? 0.45 : frame === 3 ? 0.75 : 1;
  const tagOp = frame < 4 ? 0 : frame === 4 ? 0.55 : 1;
  const lineW = frame < 5 ? 0 : frame === 5 ? 140 : frame === 6 ? 320 : 420;
  const cy = 168;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
<rect width="640" height="360" fill="${C.bg}"/>
<image href="${logo}" x="${320 - markSize / 2}" y="${cy - markSize / 2}" width="${markSize}" height="${markSize}" opacity="${markOp}"/>
<text x="320" y="268" font-family="${FONT}" font-size="38" font-weight="700" fill="${C.ink}" text-anchor="middle" opacity="${wordOp}">智汇AI</text>
<text x="320" y="300" font-family="${FONT}" font-size="14" fill="${C.muted}" text-anchor="middle" opacity="${tagOp}">你的 AI 智能体工作台</text>
<text x="320" y="322" font-family="${FONT}" font-size="10" fill="${C.muted}" text-anchor="middle" opacity="${tagOp}" letter-spacing="4">AIZHS.TOP</text>
<rect x="${320 - lineW / 2}" y="338" width="${lineW}" height="2" fill="${C.primary}" opacity="0.9"/>
</svg>`;
}

// ---- Switch(与 web @ihui/ui-react <Switch size="lg"> 逐像素对齐) ---------------
// 唯一权威: packages/ui-react/src/components/switch.tsx(Neo-Brutalist 粗野方块)
//   轨道 rounded-md 6px · 拇指 rounded-sm 3px · 1.5px foreground 描边
//   投影 3px 3px 0 foreground(硬阴影,非柔光)
//   lg 档: 轨道 52×28 · 拇指 20×20 · ON 位移 23px(= 52 - 2×1.5 描边 - 2×3 内边距 - 20)
//   OFF = background 底 + foreground 拇指 · ON = brand-accent 底 + background 拇指
//   取值一律走 tokens.css 暗色块(安装器底色即 .dark --color-background #242424)
// 画布 55×31 = 52×28 + 3px 投影外扩(web 侧阴影落在元素框外,位图必须为它留位)
// ⚠️ 2026-09-20 用户明令「不允许出现额外的样式」: 旧胶囊+圆钮方案已删除,
//    任何胶囊/圆钮/自造配色回退一律视为回归。
function switchScene(on) {
  const W = 52;
  const H = 28;
  const R = 6; // rounded-md
  const B = 1.5; // border-foreground
  const T = 20; // thumb h-5 w-5
  const TR = 3; // rounded-sm
  const SH = 3; // shadow offset
  const CW = W + SH;
  const CH = H + SH;
  const track = on ? C.accent : C.bg;
  const thumb = on ? C.bg : C.ink;
  const tx = on ? 4 + 23 : 4; // 1.5 描边 + 3 内边距 ≈ 4
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
<rect x="${SH}" y="${SH}" width="${W}" height="${H}" rx="${R}" fill="${C.ink}"/>
<rect x="${B / 2}" y="${B / 2}" width="${W - B}" height="${H - B}" rx="${R - B / 2}" fill="${track}" stroke="${C.ink}" stroke-width="${B}"/>
<rect x="${tx}" y="4" width="${T}" height="${T}" rx="${TR}" fill="${thumb}"/>
</svg>`;
}

// ---- 按钮(独立小画布) -------------------------------------------------------
// 圆角唯一 token RADIUS=8;高度唯一档位:CTA/浏览 lg h-10=40,开关 h-7=28(见 switchScene)

function buttonScene(kind, text, w, h, labelSize) {
  const r = RADIUS;
  const common = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  switch (kind) {
    case 'primary':
      // 暗色 primary:纯白底黑字(.dark --color-primary / --color-primary-foreground)
      return `${common}
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r}" fill="${C.primary}"/>
<text x="${w / 2}" y="${h / 2 + labelSize * 0.36}" font-family="${FONT}" font-size="${labelSize}" font-weight="600" fill="${C.primaryInk}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'ghost':
      return `${common}
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r}" fill="${C.bg}" stroke="${C.btnStroke}" stroke-width="1.5"/>
<text x="${w / 2}" y="${h / 2 + labelSize * 0.36}" font-family="${FONT}" font-size="${labelSize}" fill="${C.ink}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'browse':
      // 裸文字按钮:无描边;底填容器同色(BMP 无透明通道,须与容器色一致才能视觉隐形)
      return `${common}
<rect width="${w}" height="${h}" fill="${C.card}"/><text x="${w / 2}" y="${h / 2 + labelSize * 0.36}" font-family="${FONT}" font-size="${labelSize}" fill="${C.ink}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'close':
      // 窗口关闭钮: 圆形幽灵底(背景色底+细描边),悬停语义由系统 X 字形承担;
      // BMP 无透明通道 → 底填页面背景色 C.bg 融入页头。
      return `${common}
<circle cx="${w / 2}" cy="${h / 2}" r="${w / 2 - 1}" fill="${C.bg}" stroke="${C.btnStroke}" stroke-width="1.2"/>
<text x="${w / 2}" y="${h / 2 + labelSize * 0.36}" font-family="${FONT}" font-size="${labelSize}" fill="${C.muted}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'min':
      // 窗口最小化钮: 与 btn-close 完全同款(同圆同描边同字形档位),仅字形不同。
      // 用户 2026-09-20 明令「最小化按钮没显示」→ 补齐,样式不得自成一套。
      return `${common}
<circle cx="${w / 2}" cy="${h / 2}" r="${w / 2 - 1}" fill="${C.bg}" stroke="${C.btnStroke}" stroke-width="1.2"/>
<text x="${w / 2}" y="${h / 2 + labelSize * 0.36}" font-family="${FONT}" font-size="${labelSize}" fill="${C.muted}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'toggle-on':
      return switchScene(true);
    case 'toggle-off':
      return switchScene(false);
    default:
      throw new Error(`未知按钮类型:${kind}`);
  }
}

// ---- BMP 编码(24bit BGR 自底向上) ------------------------------------------

function bmpFromRaw(raw /* RGB */, w, h) {
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const imgSize = rowSize * h;
  const buf = Buffer.alloc(54 + imgSize);
  buf.write('BM', 0, 'latin1');
  buf.writeUInt32LE(54 + imgSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(imgSize, 34);
  for (let y = 0; y < h; y++) {
    const src = y * w * 3;
    const dst = 54 + (h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) {
      const s = src + x * 3;
      const d = dst + x * 3;
      buf[d] = raw[s + 2];
      buf[d + 1] = raw[s + 1];
      buf[d + 2] = raw[s];
    }
  }
  return buf;
}

// G: 卷写入偶发 UNKNOWN(ERRNO -4094,杀软/索引器/并发 IO 瞬时占用;2026-09-20 实测
// 每次运行失败文件不同)→ 原子写 + 退避重试,禁止单文件瞬时占用打断整脚本。
function writeWithRetry(absPath, buf, tries = 15) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const tmp = `${absPath}.tmp-${process.pid}`;
      writeFileSync(tmp, buf);
      renameSync(tmp, absPath);
      return;
    } catch (err) {
      last = err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150 * (i + 1));
    }
  }
  throw last;
}

async function render(svg, w, h, bmpPath, pngPath) {
  const img = sharp(Buffer.from(svg)).resize(w, h, { fit: 'fill' });
  if (bmpPath) {
    const raw = await img.clone().flatten({ background: C.bg }).removeAlpha().raw().toBuffer();
    writeWithRetry(bmpPath, bmpFromRaw(raw, w, h));
  }
  if (pngPath) await img.clone().flatten({ background: C.bg }).png().toFile(pngPath);
}

// ---- 主流程 -----------------------------------------------------------------

const SPLASH_FRAMES = 8;
// 高度档位对齐 web <Button> size 表:CTA/浏览 lg h-10=40px,开关 h-7=28px(唯一档位,禁 48px 自造值)
const BUTTONS = [
  ['btn-start', 'primary', '开始安装', 144, 40, 15],
  // btn-continue 统一 144×40:与 CTA 槽(672,500,144,40)同宽,
  // 消除 140 宽位图居中留 2px 缝(重装页/完成态曾因此漏系统蓝底)
  ['btn-continue', 'primary', '继续 ›', 144, 40, 15],
  ['btn-finish', 'primary', '完成', 120, 40, 15],
  ['btn-cancel', 'ghost', '取消', 96, 40, 14],
  ['btn-browse', 'browse', '浏览…', 112, 40, 14],
  ['btn-toggle-on', 'toggle-on', '', 55, 31, 12],
  ['btn-toggle-off', 'toggle-off', '', 55, 31, 12],
  ['btn-close', 'close', '✕', 36, 36, 12],
  ['btn-min', 'min', '−', 36, 36, 12],
];

// 5 档 DPI 对应 Windows 标准系统缩放(100%/125%/150%/175%/200%);
// 运行时 ihui-ui.nsi 按窗口 DPI 选档,位图原生尺寸恰等于 880x600 窗口 client。
const SCALES = [1, 1.25, 1.5, 1.75, 2];

const mode = process.argv.includes('--previews') ? 'previews' : 'write';

const logo = await loadLogoDataUri();
mkdirSync(ASSETS, { recursive: true });
mkdirSync(PREVIEWS, { recursive: true });

let count = 0;
for (const scale of SCALES) {
  const tag = Math.round(scale * 100);
  const dir = join(ASSETS, `assets-${tag}`);
  const pngDir = join(PREVIEWS, `assets-${tag}`);
  if (mode === 'write') mkdirSync(dir, { recursive: true });
  mkdirSync(pngDir, { recursive: true });
  const w = Math.round(880 * scale);
  const h = Math.round(600 * scale);
  const sw = Math.round(640 * scale);
  const sh = Math.round(360 * scale);

  // 向导页
  await render(sceneWelcome(logo), w, h, mode === 'write' ? join(dir, 'welcome.bmp') : null, join(pngDir, 'welcome.png'));
  await render(sceneDir(logo), w, h, mode === 'write' ? join(dir, 'dir.bmp') : null, join(pngDir, 'dir.png'));
  await render(sceneInstfiles(logo), w, h, mode === 'write' ? join(dir, 'instfiles.bmp') : null, join(pngDir, 'instfiles.png'));
  await render(sceneFinish(logo), w, h, mode === 'write' ? join(dir, 'finish.bmp') : null, join(pngDir, 'finish.png'));
  count += 4;

  // 开屏帧
  for (let i = 0; i < SPLASH_FRAMES; i++) {
    const name = i === 0 ? 'splash' : `splash${i}`;
    await render(splashScene(i, logo), sw, sh, mode === 'write' ? join(dir, `${name}.bmp`) : null, join(pngDir, `${name}.png`));
    count++;
  }

  // 按钮
  for (const [name, kind, text, bw, bh, ls] of BUTTONS) {
    await render(buttonScene(kind, text, Math.round(bw * scale), Math.round(bh * scale), Math.round(ls * scale)),
      Math.round(bw * scale), Math.round(bh * scale),
      mode === 'write' ? join(dir, `${name}.bmp`) : null, join(pngDir, `${name}.png`));
    count++;
  }
}

// 生成 ihui-assets-path.nsh:仅保留兼容占位与防御断言。
// 2026-09-20 起真实路径由 hooks.nsi 以 ${__FILEDIR__} 编译期派生(构建机无关,CI 实证修复:
// 此前烧死本机 G:\ 绝对路径导致 CI makensis !include 失败),本文件不再包含任何绝对路径。
if (mode === 'write') {
  const nsh = `; 由 scripts/desktop-installer-assets.mjs 自动生成,勿手工编辑。\r\n; IHUI_ASSETROOT 由 hooks.nsi 以 ${'$'}{__FILEDIR__} 派生(构建机无关),本文件仅保留\r\n; 兼容占位 —— 若绕过 hooks.nsi 直接 include 本文件也能得到明确错误而非静默失败。\r\n!ifndef IHUI_ASSETROOT\r\n  !error "IHUI_ASSETROOT 未定义:请经 hooks.nsi(先定义 IHUI_WIN_DIR/IHUI_ASSETROOT)include 本文件"\r\n!endif\r\n`;
  writeFileSync(join(ROOT, 'apps/desktop/src-tauri/windows/ihui-assets-path.nsh'), nsh, 'utf8');
}

const perScale = count / SCALES.length;
console.log(`[desktop-installer-assets] 完成:${count} 个资产(${SCALES.length} 档 DPI × ${perScale}/档),版本 v${VERSION}`);
if (mode === 'write') console.log(`[desktop-installer-assets] 已生成 windows/ihui-assets-path.nsh → ${ASSETS}`);
if (mode === 'previews') console.log(`[desktop-installer-assets] PNG 预览已输出到 ${PREVIEWS}`);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
