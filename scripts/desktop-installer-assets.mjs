#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。
/* eslint-disable no-console -- 资产生成脚本为 CLI 工具,需 console 输出诊断信息 */
// 桌面端 NSIS 安装器品牌视觉资产生成器。
//
// 产出(scale ∈ {1, 1.25, 1.5, 1.75, 2},对应 Windows 标准缩放 100%/125%/150%/175%/200%):
//   installer-assets/assets-100|125|150|175|200/
//     splash.bmp + splash1..15.bmp  开屏动画帧(AdvSplash 多帧序列,720x450 逻辑尺寸)
//     welcome.bmp / dir.bmp / instfiles.bmp / finish.bmp / reinstall.bmp  五个安装向导页满幅背景(880x600 逻辑)
//     unconfirm.bmp / uninstfiles.bmp / unfinish.bmp  卸载器三页满幅背景(两步导轨,几何与安装页同源)
//     btn-*.bmp                     位图按钮(主 CTA / 幽灵按钮 / 裸文字链接钮 / 快捷方式开关 / 窗口钮)
//   windows/ihui-assets-path.nsh    资产根目录 define(ihui-ui.nsi 编译期 File 嵌入用)
//   供 ihui-ui.nsi 在运行时按窗口 DPI 挑选对应档位从 $PLUGINSDIR 加载。
//
// 设计语言「星澜 · Nebula」(2026-09-27 三版,资产层重设计;取代 2026-09-22「墨光 · Ink Aurora」,
//   后者取代 2026-09-19 纯黑白杂志风。结构骨架 —— 左侧 248px 品牌导轨 + 四步进度指示器 + 满幅品牌位图 ——
//   与运行期控件几何一字未动,本轮只换"画在位图上的东西"):
//   ① 氛围基元:窄幅模糊极光带(品牌渐变 --color-brand-accent-grad-from → -grad-to,
//      feGaussianBlur 已在 sharp/librsvg 探针验证;宽 ≤44 / σ ≤12)+ 确定性星座散点 +
//      小半径径向辉光球(仅英雄区/徽章局部)+ 星轨细线(不模糊)。取代 v2 的大面积空黑,
//      但**不引入任何全幅 2D 平滑场**(无暗角、无全屏托底辉光)。
//   ② 安装/卸载进度页"开口环":v2 的完整双环被百分比 STATIC(实色底 640..840×187..253)拦腰截断
//      (环左右两段消失,实拍确认)。改为上/下两段弧,端点收在控件带外 7px —— 缺口恰是控件带,
//      截断从渲染缺陷变成"数字悬浮在开口仪表环中"的设计语言(见 pctAperture)。
//   ③ 开屏 16 帧分镜重排:星轨入场 → 辉光绽放 + logo 显影 → 双环扩散 → 字标收距 → 标语收束;
//      开屏底 = 垂直渐变(逐行等值,LZMA 免费),不用径向大场。
//   压缩纪律(2026-09-27 沙箱 A/B 实测,同一 sandbox.nsi 只换资产):v2 资产编出 6.9MB,
//      首版「全幅暗角 + 全屏托底辉光 + 宽模糊带」编出 **26.2MB(+19.3MB)** —— 全幅 2D 平滑场
//      是 LZMA 熵源,逐像素缓变让 match 失效。回炉后:模糊带收窄、暗角/托底辉光删除、
//      开屏改垂直渐变。**新增大面积视觉元素前必须先编沙箱量体积**;禁噪声纹理(同理)。
//   导轨 + 步骤条仍是"去原生向导感"的主手段:页面身份、当前进度、版本号常驻同一视觉锚点。
//   **实色底避让清单**(位图不得把艺术画进这些矩形,运行期控件是实色底会盖出平边):
//      PCT 槽 640..840×187..253 · STG 槽 288..832×334..356 · reinstall 说明行 288..832×302..326 ·
//      reinstall 卡片内部 #1A1A1A · dir 输入容器内部 #1A1A1A · 各页按钮槽(按钮位图自带实底角)。
//
//   所有取值直接映射 @ihui/design-tokens tokens.css 暗色块(.dark),禁止自造色值:
//   bg #242424(--color-background) · card #1A1A1A(--color-card) · rail #1e2e36(--color-brand-accent-light)
//   主文字 #FAFAFA · 正文 #D4D4D4 · 次级 #737373 · 描边 #525252 · 轨道 #3D3D3D
//   accent #a3c4d6 / accent 前景 #16262e / 渐变 #b8d4e3→#a3c4d6 / tint 16% · 32%
//   CTA 纯白底黑字(.dark --color-primary / --color-primary-foreground)
//   唯一圆角 token:--global-border-radius = 8px(导轨步骤标记/按钮/输入容器/窗口四角统一 8px)
//   按钮高度唯一档位(web <Button> size 表):CTA/浏览 lg = h-10 40px · 输入框 sm = h-8 32px
//   开关 Switch = h-7 28px(与 web <Switch size="lg"> 逐像素对齐,见 switchScene)
//   渲染管线:SVG(内嵌 icon.png 抠底 logo,系统字体微软雅黑) → sharp → RGB raw → 24bit BMP
//
// ⚠️ 版面几何(W/H/RAIL_W/C_L/C_R/BTN_Y/CTA_X/进度条与百分比槽位)与
//    apps/desktop/src-tauri/windows/ihui-ui.nsi 的运行期控件坐标严格一一对应。
//    改任何一处必须同步另一处,并跑 node scripts/check-installer-assets.mjs 对账。
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
  bg: '#242424', // 内容区底(.dark --color-background hsl(0 0% 14%))
  card: '#1A1A1A', // 容器/输入框(.dark --color-card hsl(0 0% 10%))
  rail: '#1e2e36', // 左侧品牌导轨(.dark --color-brand-accent-light)
  ink: '#FAFAFA', // 主文字(.dark --color-foreground)
  inkSoft: '#D4D4D4', // 正文(.dark --color-text-medium)
  muted: '#737373', // 次级文字(.dark --color-text-tertiary)
  hairline: '#3D3D3D', // 次级线/进度轨道底(white-10 于 bg 上合成)
  primary: '#FFFFFF', // CTA 底(.dark --color-primary 纯白)
  primaryInk: '#000000', // CTA 文字(.dark --color-primary-foreground 纯黑)
  btnStroke: '#525252', // 幽灵按钮/容器描边(.dark --color-border-medium)
  accent: '#a3c4d6', // 品牌灰蓝(.dark --color-brand-accent)
  accentInk: '#16262e', // accent 之上的前景(.dark --color-brand-accent-foreground)
  gradFrom: '#b8d4e3', // 品牌渐变起(.dark --color-brand-accent-grad-from)
  gradTo: '#a3c4d6', // 品牌渐变止(.dark --color-brand-accent-grad-to)
  tint: 'rgba(163, 196, 214, 0.16)', // .dark --color-brand-accent-tint
  tintStrong: 'rgba(163, 196, 214, 0.32)', // .dark --color-brand-accent-tint-strong
};
// 唯一圆角 token:web --global-border-radius = 8px(AGENTS.md 圆角梯度 rounded-lg)
const RADIUS = 8;
const FONT = 'Microsoft YaHei UI, Microsoft YaHei, PingFang SC, sans-serif';

// ---- 版面几何(逻辑像素,100% 档)----
// 这里只保留**本生成器真正用来画图**的常量;运行期控件坐标的真相在
// `apps/desktop/src-tauri/windows/ihui-ui.nsi` 的「版面几何」define 块。
// 两边同值的坐标改动时必须同批改,否则位图留白与控件槽位会错位。
const W = 880;
const H = 600;
const RAIL_W = 248; // 品牌导轨宽
const C_L = 288; // 内容区左界(导轨右缘 + 40 内边距)
const C_R = 832; // 内容区右界
const C_W = C_R - C_L; // 544 内容宽
// 步骤导轨:4 步,首个标记上沿 168,步距 66
const STEP_Y0 = 168;
const STEP_GAP = 66;
const STEPS = [
  ['01', '欢迎', 'WELCOME'],
  ['02', '安装位置', 'LOCATION'],
  ['03', '正在安装', 'PROGRESS'],
  ['04', '完成', 'DONE'],
];
// 卸载导轨:两态进度(与 STEPS 同结构,复用同一 rail() 绘制路径,不另起一份实现)
const UNSTEPS = [
  ['01', '确认卸载', 'CONFIRM'],
  ['02', '正在卸载', 'PROGRESS'],
];
// 安装页进度几何(与 ihui-ui.nsi IHUIInstShow 的进度条槽严格一致)
const PB_X = C_L;
const PB_Y = 306;
const PB_W = C_W;
const PB_H = 10;
// 阶段刻度:与 desktop-nsis-template.mjs 的 P7 安装埋点一一对应(改一边必须改另一边)。
// 烧进轨道,填充条经过时被盖住 → 天然表达"过了几关"。
const PB_TICKS = [12, 34, 52, 64, 72, 80, 88, 93, 97];
// 卸载侧刻度 = U 埋点集合(20/34/46/56/66/76/86/92),见 sceneUninstfiles。
// 百分比数字与 `%` 全部由运行期控件排版,位图侧不再保留任何百分比相关坐标。
//
// 进度页的"表盘":双环把百分比圈成一枚徽章,与页面标题(正在安装/正在卸载)**同一行**。
// 环心必须与 ihui-ui.nsi 的 IHUI_PCT_X/Y/W/H 算出的控件矩形中心严格相等,否则数字不在环心;
// 两处任一改动都要同步改另一处(控件用 SS_CENTER,数字位数变化不会再左右漂)。
const PCT_CX = 740;
const PCT_CY = 220;
const PCT_RING = 56; // auroraRings 画 r 与 r+22 两道 → 内 56 / 外 78

// 重装/升级确认页选项卡片(烧进 reinstall.bmp 的两个卡片框)。
// 与 ihui-ui.nsi 的 IHUI_RCARD_* define 严格一一对应,
// 由 scripts/check-installer-assets.mjs 的 checkReinstallCards 跨文件对账。
const RCARD_X = C_L;
const RCARD_Y1 = 340;
const RCARD_Y2 = 392;
const RCARD_W = C_W;
const RCARD_H = 40;

// 品牌渐变定义(每份 SVG 内联一次)
const GRAD_DEFS = `<defs>
<linearGradient id="ihg" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${C.gradFrom}"/><stop offset="1" stop-color="${C.gradTo}"/>
</linearGradient>
<linearGradient id="ihgv" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${C.gradFrom}"/><stop offset="1" stop-color="${C.gradTo}"/>
</linearGradient>
</defs>`;

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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${GRAD_DEFS}
${body}
</svg>`;
}

// 页面用 880x600 画布(svgDoc 的 viewBox 即逻辑尺寸,再由 sharp 按 DPI 档缩放)
function page(body) {
  return svgDoc(W, H, body);
}

// 小节引导标签(字距拉开,品牌灰蓝)
function kicker(x, y, text) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="11" fill="${C.accent}" letter-spacing="3">${esc(text)}</text>`;
}

// 章节主标题
function title(x, y, text, size = 34) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="${C.ink}">${esc(text)}</text>`;
}

// 说明正文
function body14(x, y, text, fill = C.muted, size = 14) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}">${esc(text)}</text>`;
}

// ---- 星澜 · Nebula 视觉基元 -------------------------------------------------
// 压缩纪律:一律平滑渐变/高斯模糊,禁噪声(见文件头)。所有 id 由调用点显式给定,
// 同一 SVG 文档内不得撞号。

// 确定性伪随机:星座点坐标跨次生成逐字节稳定(git diff 只出现真变化)
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 辉光球:径向渐变中心亮 → 边缘透明(平滑衰减到 0,不会在半径边界留可见接缝)
function glowOrb(cx, cy, r, color, opacity, id) {
  return `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>
<stop offset="0.55" stop-color="${color}" stop-opacity="${opacity * 0.4}"/>
<stop offset="1" stop-color="${color}" stop-opacity="0"/>
</radialGradient>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`;
}

// 模糊滤镜:filterUnits=userSpaceOnUse 全域裁剪。细长路径若用默认 bbox 百分比
// 区域,模糊会被 bbox 裁成硬边 —— 全域声明与路径形状解耦,一次写对处处成立。
const blurFilter = (id, std) =>
  `<filter id="${id}" x="-100" y="-100" width="1120" height="840" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${std}"/></filter>`;

// 极光带:品牌渐变的模糊曲线(stroke 默认横向渐变 ihg)
function auroraBand(d, width, opacity, blur, id, stroke = 'url(#ihg)') {
  return `${blurFilter(id, blur)}
<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" filter="url(#${id})" opacity="${opacity}"/>`;
}

// 星座:确定性散点 + 少量连线(n 个点每 4 个连一条,稀疏星图,不抢内容)
function constellation(x, y, w, h, seed, n = 14) {
  const rnd = mulberry32(seed);
  const pts = Array.from({ length: n }, () => ({
    x: +(x + rnd() * w).toFixed(1),
    y: +(y + rnd() * h).toFixed(1),
    r: +(0.6 + rnd() * 1.1).toFixed(2),
    o: +(0.12 + rnd() * 0.34).toFixed(2),
  }));
  const dots = pts
    .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${C.accent}" opacity="${p.o}"/>`)
    .join('');
  const lines = [];
  for (let i = 0; i + 3 < pts.length; i += 4) {
    const a = pts[i];
    const b = pts[i + 3];
    lines.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${C.accent}" stroke-width="0.7" opacity="0.12"/>`,
    );
  }
  return dots + lines.join('');
}

// 顶部极光(全页共用氛围):两道**全宽星轨细线**(不模糊,长程同值,LZMA 近乎免费)
// + 一段**短**软光带(只在星座附近,长度 360 · 宽 24 · σ7)+ 星座散点。
// 所有安装侧页面统一 rise 100 / seed 11(软光带最大外溢 y ≈ 143,不触进度页 PCT
// 实色槽 y≥187)—— 参数一致 = 顶部氛围带跨页逐字节相同,NSIS 固实 LZMA 跨页去重;
// 卸载侧只用 dim 压情绪,不另开 seed。
// ⚠️ 体积纪律(2026-09-27 沙箱 A/B 实测,v2 资产 6.9MB → 首版 26.2MB):模糊带一旦
// 全宽(≈1000px × 外溢)就是 10 万像素级 2D 平滑场 —— 模糊只允许短幅局部出现。
function atmoTop({ rise = 100, seed = 11, dim = 1 } = {}) {
  return [
    `<path d="M -60 ${rise + 24} C 220 ${rise - 36}, 470 ${rise + 28}, 940 ${rise - 26}" fill="none" stroke="url(#ihg)" stroke-width="2.2" opacity="${(0.34 * dim).toFixed(2)}"/>`,
    `<path d="M -60 ${rise + 40} C 250 ${rise - 12}, 500 ${rise + 42}, 940 ${rise - 2}" fill="none" stroke="url(#ihg)" stroke-width="1.2" opacity="${(0.2 * dim).toFixed(2)}"/>`,
    `<path d="M -60 ${rise + 12} C 260 ${rise - 52}, 520 ${rise + 14}, 940 ${rise - 44}" fill="none" stroke="${C.accent}" stroke-width="0.8" opacity="${(0.16 * dim).toFixed(2)}"/>`,
    auroraBand(`M 500 ${rise + 6} C 620 ${rise - 22}, 760 ${rise + 10}, 908 ${rise - 14}`, 24, 0.2 * dim, 7, 'atmoSoft'),
    constellation(560, 16, 268, 120, seed, 12),
  ].join('\n');
}

// 页脚发丝线:内容区底部一条品牌渐变细线(不模糊、零外溢,页脚文字上方 20px)
function footerLine() {
  return `<rect x="${C_L}" y="550" width="${C_W}" height="1.5" rx="0.75" fill="url(#ihg)" opacity="0.22"/>`;
}

// 百分比"开口环"(2026-09-27 根治截环缺陷,见文件头②):
// bandHalf = 百分比 STATIC 半高(33),gapPad = 弧端点再向外收 7px。
// 端点圆点落位 y = PCT_CY ± 40(180/260),在控件带(187..253)之外。
function pctAperture(bandHalf = 33, gapPad = 7) {
  const seg = (r, width, stroke, op) => {
    const t = Math.asin(Math.min(1, (bandHalf + gapPad) / r));
    const dx = +(r * Math.cos(t)).toFixed(2);
    const dy = +(r * Math.sin(t)).toFixed(2);
    const dots = [1, -1]
      .map(
        (s) =>
          `<circle cx="${PCT_CX + s * dx}" cy="${PCT_CY - s * dy}" r="2.2" fill="${C.accent}" opacity="0.9"/>`,
      )
      .join('');
    const top = `<path d="M ${PCT_CX + dx} ${PCT_CY - dy} A ${r} ${r} 0 0 0 ${PCT_CX - dx} ${PCT_CY - dy}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" opacity="${op}"/>`;
    const bot = `<path d="M ${PCT_CX - dx} ${PCT_CY + dy} A ${r} ${r} 0 0 0 ${PCT_CX + dx} ${PCT_CY + dy}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" opacity="${op}"/>`;
    return top + bot + dots;
  };
  return seg(PCT_RING, 2, C.tintStrong, 0.95) + seg(PCT_RING + 22, 1.4, C.tint, 0.75);
}

// 辉光核心(英雄区):双辉光球 + 环 + 双轨道椭圆 + 卫星点 + logo。
// s = 缩放(目录页 0.62)。纵向包络 ≤ cy + 90·s、横向 ≤ cx + 113·s:
// 所有英雄区底部都不得触碰 y≥500 的按钮槽(按钮位图圆角外的实底角会切出平边)。
function heroCore(cx, cy, logo, s = 1, gid = 'hero') {
  const orbit = (rx, ry, phiDeg, stroke, op, sw) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx * s}" ry="${ry * s}" transform="rotate(${phiDeg} ${cx} ${cy})" fill="none" stroke="${stroke}" stroke-width="${sw}" opacity="${op}"/>`;
  const sat = (rx, ry, phiDeg, aDeg, r) => {
    const phi = (phiDeg * Math.PI) / 180;
    const a = (aDeg * Math.PI) / 180;
    const px = rx * s * Math.cos(a);
    const py = ry * s * Math.sin(a);
    const x = cx + px * Math.cos(phi) - py * Math.sin(phi);
    const y = cy + px * Math.sin(phi) + py * Math.cos(phi);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${C.accent}" opacity="0.9"/>`;
  };
  const L = 120 * s;
  return [
    glowOrb(cx, cy, 88 * s, C.gradTo, 0.17, `${gid}o1`),
    glowOrb(cx, cy, 46 * s, C.gradFrom, 0.2, `${gid}o2`),
    `<circle cx="${cx}" cy="${cy}" r="${74 * s}" fill="none" stroke="${C.tintStrong}" stroke-width="1.5"/>`,
    orbit(118, 40, -18, C.accent, 0.45, 1.2),
    orbit(100, 30, 62, C.tint, 0.8, 1),
    sat(118, 40, -18, 205, 3 * s),
    sat(100, 30, 62, 20, 2.2 * s),
    `<image href="${logo}" x="${cx - L / 2}" y="${cy - L / 2}" width="${L}" height="${L}"/>`,
  ].join('\n');
}

// 成功徽章(完成页/卸载完成页):辉光 + 双环 + 大对勾 + 放射光芒。
// 包络:光芒 ≤ cy+112,环 ≤ cy+84 —— cy 384 时底部 496,不触 y≥500 按钮槽。
function successEmblem(cx, cy) {
  const rays = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.35;
    const r0 = 92;
    const r1 = i % 2 === 0 ? 112 : 104;
    rays.push(
      `<line x1="${(cx + r0 * Math.cos(a)).toFixed(1)}" y1="${(cy + r0 * Math.sin(a)).toFixed(1)}" x2="${(cx + r1 * Math.cos(a)).toFixed(1)}" y2="${(cy + r1 * Math.sin(a)).toFixed(1)}" stroke="${C.accent}" stroke-width="2" stroke-linecap="round" opacity="${i % 2 === 0 ? 0.55 : 0.3}"/>`,
    );
  }
  return [
    glowOrb(cx, cy, 82, C.gradTo, 0.19, 'finO'),
    `<circle cx="${cx}" cy="${cy}" r="62" fill="none" stroke="${C.tintStrong}" stroke-width="1.5"/>`,
    `<circle cx="${cx}" cy="${cy}" r="84" fill="none" stroke="${C.tint}" stroke-width="1.2"/>`,
    `<circle cx="${cx}" cy="${cy}" r="47" fill="${C.tint}"/>`,
    rays.join(''),
    `<text x="${cx}" y="${cy + 12}" font-family="${FONT}" font-size="34" font-weight="700" fill="${C.accent}" text-anchor="middle">&#10003;</text>`,
  ].join('\n');
}

// 循环徽章(重装页):双弧 + 端点圆点的"升级/重装"回环意象。包络 ≤ cy+58。
function cycleEmblem(cx, cy) {
  const arc = (r, from, to, w, op) => {
    const p = (a) => [+(cx + r * Math.cos(a)).toFixed(1), +(cy + r * Math.sin(a)).toFixed(1)];
    const [x1, y1] = p(from);
    const [x2, y2] = p(to);
    const large = to - from > Math.PI ? 1 : 0;
    return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${C.accent}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
  };
  const dot = (a, r, op) =>
    `<circle cx="${(cx + 44 * Math.cos(a)).toFixed(1)}" cy="${(cy + 44 * Math.sin(a)).toFixed(1)}" r="${r}" fill="${C.accent}" opacity="${op}"/>`;
  return [
    glowOrb(cx, cy, 58, C.gradTo, 0.14, 'cyO'),
    arc(44, -0.5, 2.2, 2, 0.8),
    arc(44, 2.64, 5.34, 2, 0.45),
    `<circle cx="${cx}" cy="${cy}" r="5" fill="${C.accent}" opacity="0.9"/>`,
    dot(-0.5, 2.5, 0.9),
    dot(2.64, 2.5, 0.6),
  ].join('\n');
}

// ---- 左侧品牌导轨 -----------------------------------------------------------
// steps = 步骤清单([编号, 中文, 英文] 数组),默认安装四步;卸载页传入 UNSTEPS 走两步。
// active = 当前步索引;小于它的标"已完成",等于它的标"进行中"。
function rail(logo, active, steps = STEPS, doneOnly = false) {
  const items = steps.map(([, zh, en], i) => {
    const my = STEP_Y0 + i * STEP_GAP;
    // doneOnly = 维护/前置页语义:只表达"已完成到 active 之前",不把 active 步
    // 高亮成"进行中"(reinstall 页站在第 01 步已完成的位置,但下一步还不是本页
    // 推进的 02 安装位置 —— 02 以"当前页"样式高亮属语义错位,2026-09-24 修正)。
    const state = i < active ? 'done' : !doneOnly && i === active ? 'active' : 'todo';
    // 进行中标记的辉光垫层(σ7 模糊,外溢 ~21px,与相邻步距 66 无碰撞)
    const glow =
      state === 'active'
        ? `${blurFilter('railglow', 7)}<rect x="30" y="${my - 2}" width="30" height="30" rx="10" fill="${C.accent}" opacity="0.3" filter="url(#railglow)"/>`
        : '';
    const marker =
      state === 'active'
        ? `<rect x="32" y="${my}" width="26" height="26" rx="${RADIUS}" fill="url(#ihgv)"/>
<text x="45" y="${my + 18}" font-family="${FONT}" font-size="12" font-weight="700" fill="${C.accentInk}" text-anchor="middle">${String(i + 1).padStart(2, '0')}</text>`
        : state === 'done'
          ? `<rect x="32" y="${my}" width="26" height="26" rx="${RADIUS}" fill="${C.tint}" stroke="${C.accent}" stroke-width="1.2"/>
<text x="45" y="${my + 19}" font-family="${FONT}" font-size="13" font-weight="700" fill="${C.accent}" text-anchor="middle">&#10003;</text>`
          : `<rect x="32" y="${my}" width="26" height="26" rx="${RADIUS}" fill="none" stroke="${C.btnStroke}" stroke-width="1.2"/>
<text x="45" y="${my + 18}" font-family="${FONT}" font-size="12" fill="${C.muted}" text-anchor="middle">${String(i + 1).padStart(2, '0')}</text>`;
    const labelFill = state === 'active' ? C.ink : state === 'done' ? C.inkSoft : C.muted;
    const subFill = state === 'active' ? C.accent : '#4C5B63';
    // 连接线:仅在有下一步时画,已完成段用 accent,其余用描边色
    const link =
      i < steps.length - 1
        ? `<rect x="44" y="${my + 30}" width="1.5" height="${STEP_GAP - 34}" fill="${i < active ? C.accent : C.btnStroke}"/>`
        : '';
    return `${glow}
${marker}
${link}
<text x="70" y="${my + 18}" font-family="${FONT}" font-size="14" font-weight="${state === 'active' ? 700 : 400}" fill="${labelFill}">${esc(zh)}</text>
<text x="70" y="${my + 33}" font-family="${FONT}" font-size="9" fill="${subFill}" letter-spacing="2">${esc(en)}</text>`;
  }).join('\n');

  return `
<rect x="0" y="0" width="${RAIL_W}" height="${H}" fill="${C.rail}"/>
<linearGradient id="raildeep" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#000000" stop-opacity="0"/>
<stop offset="1" stop-color="#000000" stop-opacity="0.34"/>
</linearGradient>
<rect x="0" y="0" width="${RAIL_W}" height="${H}" fill="url(#raildeep)"/>
<rect x="${RAIL_W - 2}" y="0" width="2" height="${H}" fill="url(#ihgv)" opacity="0.85"/>
<image href="${logo}" x="32" y="32" width="40" height="40"/>
<text x="84" y="51" font-family="${FONT}" font-size="16" font-weight="700" fill="${C.ink}">智汇AI</text>
<text x="84" y="67" font-family="${FONT}" font-size="9" fill="${C.accent}" letter-spacing="2.5">IHUI AI DESKTOP</text>
${items}
${railHorizon()}
<text x="32" y="574" font-family="${FONT}" font-size="10" fill="${C.muted}">v${VERSION}</text>
<text x="216" y="574" font-family="${FONT}" font-size="10" fill="${C.muted}" text-anchor="end">aizhs.top</text>`;
}

// 导轨底部"极光地平线":一道不模糊的品牌渐变细线 + 两道大圆弧上缘(圆心在画布外,
// 自然只剩弧),取代 v2 的低透明 logo 水印 —— 水印像未擦净的底稿,弧线才是刻意的构图。
// 全部细线/弧,零模糊(体积纪律见 atmoTop)。
function railHorizon() {
  return [
    `<path d="M 16 522 C 70 504, 160 534, 240 514" fill="none" stroke="url(#ihg)" stroke-width="1.6" opacity="0.4"/>`,
    `<circle cx="124" cy="668" r="160" fill="none" stroke="${C.tintStrong}" stroke-width="1.2" opacity="0.5"/>`,
    `<circle cx="124" cy="688" r="204" fill="none" stroke="${C.tint}" stroke-width="1" opacity="0.4"/>`,
  ].join('\n');
}

// 页面公共骨架:导轨 + 内容底 + 氛围层(art)+ 页脚 + 步骤计数。
// art 由各场景传入(atmoTop/页脚线/场景专属装饰),绘制次序在导轨之后、
// 页脚文字之前 —— 极光可以从导轨右缘流进内容区(同一片氛围),但永不压页脚文字。
// 不设全幅暗角:2D 平滑场是 LZMA 熵源(见 atmoTop 体积纪律),纵深由导轨渐变与
// 窄幅极光带承担。
// doneOnly: 转发给 rail(维护页"01 已完成、其余未激活"语义,见 rail 注释)
function pageChrome(logo, active, steps = STEPS, curOverride, doneOnly = false, art = '') {
  const cur = curOverride || String(active + 1).padStart(2, '0');
  return `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${rail(logo, active, steps, doneOnly)}
${art}
<text x="${C_L}" y="574" font-family="${FONT}" font-size="10" fill="${C.muted}">© 2026 IHUI AI (智汇AI) · 李春川 · aizhs.top</text>
<text x="${C_R}" y="574" font-family="${FONT}" font-size="10" text-anchor="end"><tspan fill="${C.accent}" font-weight="700">${cur}</tspan><tspan fill="${C.muted}"> / ${String(steps.length).padStart(2, '0')}</tspan></text>`;
}

// ---- 向导页场景 -------------------------------------------------------------
// 实色底避让清单见文件头。所有"英雄区/徽章"包络约束见各基元注释。

function sceneWelcome(logo) {
  const features = [
    '云端智能体 · 桌面与网页无缝切换',
    '账号云同步 · 换机不丢任何数据',
    '自动保持最新 · 无需手动升级',
  ];
  return page(`
${pageChrome(logo, 0, STEPS, undefined, false, atmoTop({ rise: 100, seed: 11 }) + footerLine())}
${kicker(C_L, 176, 'WELCOME')}
${title(C_L, 232, '智汇AI 桌面版', 40)}
${body14(C_L, 268, '连接你与 AI 智能体的专属工作台', C.inkSoft, 15)}
${features
  .map(
    (t, i) => `
<text x="${C_L}" y="${352 + i * 46}" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="1" fill="${C.accent}">0${i + 1}</text>
<text x="${C_L + 30}" y="${352 + i * 46}" font-family="${FONT}" font-size="15" fill="${C.ink}">${esc(t)}</text>`,
  )
  .join('')}
${heroCore(712, 402, logo, 1, 'w')}
`);
}

// 目录页:输入框自带容器;「浏览」为裸文字链接钮(底色 = 页面底,无任何容器/描边)。
// 右侧迷你辉光核心 + 一条虚线路径从输入容器引向核心 —— "把应用放到这个位置"的意象。
function sceneDir(logo) {
  return page(`
${pageChrome(logo, 1, STEPS, undefined, false, atmoTop({ rise: 100, seed: 11 }) + footerLine())}
${kicker(C_L, 176, 'STEP 02')}
${title(C_L, 232, '选择安装位置')}
${body14(C_L, 262, '默认安装到 D:\\智汇AI,也可以更改为其他目录。')}
<rect x="${C_L}" y="302" width="412" height="36" rx="${RADIUS}" fill="${C.card}" stroke="${C.btnStroke}" stroke-width="1.5"/>
${body14(C_L, 380, '体积轻巧 · 数据云端存储 · 卸载不留残余', C.muted, 13)}
${body14(C_L, 404, '提示:直接编辑上方路径,或点击右侧「浏览…」选择目录。', C.muted, 13)}
<path d="M 704 350 C 742 356, 714 382, 724 394" fill="none" stroke="${C.accent}" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="1 6" opacity="0.45"/>
${heroCore(768, 398, logo, 0.62, 'd')}
`);
}

// 计量器:轨道(底 + 描边 + 内高光 + 阶段刻度)。
// ⚠️ 百分比数字与 `%` **都由运行期同一个 STATIC 排版**(见 ihui-ui.nsi IHUI_PROGRESS),
//    位图里不再烧 `%` —— 之前烧在位图里,字号/基线是两套真相(数字 48px GDI、% 20px SVG),
//    实机就是"数字和百分号错位、而且偏小"。让文字引擎去对齐,才是根源解。
function meterTrack(ticks = PB_TICKS) {
  return [
    `<rect x="${PB_X - 1}" y="${PB_Y - 1}" width="${PB_W + 2}" height="${PB_H + 2}" rx="${(PB_H + 2) / 2}" fill="none" stroke="${C.hairline}" stroke-width="1"/>`,
    `<rect x="${PB_X}" y="${PB_Y}" width="${PB_W}" height="${PB_H}" rx="${PB_H / 2}" fill="#1A1A1A"/>`,
    `<rect x="${PB_X + 3}" y="${PB_Y + 1}" width="${PB_W - 6}" height="1" rx="0.5" fill="#FFFFFF" opacity="0.05"/>`,
    ...ticks.map(
      (t) =>
        `<rect x="${Math.round(PB_X + (PB_W * t) / 100)}" y="${PB_Y}" width="2" height="${PB_H}" fill="${C.bg}"/>`,
    ),
  ].join("\n");
}

function sceneInstfiles(logo) {
  return page(`
${pageChrome(logo, 2, STEPS, undefined, false, atmoTop({ rise: 100, seed: 11 }) + footerLine())}
${kicker(C_L, 176, 'STEP 03')}
${title(C_L, 232, '正在安装')}
${body14(C_L, 262, '智汇AI 正在写入你的电脑,请稍候…')}
${meterTrack()}
${body14(C_L, 400, '安装完成后可直接启动,你的数据始终保存在云端', C.muted, 13)}
${pctAperture()}
`);
}

// 完成页:三行开关(位图由运行期叠加),标签烧入位图。
function sceneFinish(logo) {
  const rows = [
    [340, '完成后立即打开智汇AI'],
    [392, '开机自动启动'],
    [444, '创建桌面快捷方式'],
  ];
  return page(`
${pageChrome(logo, 3, STEPS, undefined, false, atmoTop({ rise: 100, seed: 11 }) + footerLine())}
${kicker(C_L, 176, 'STEP 04')}
${title(C_L, 232, '安装完成', 36)}
${body14(C_L, 264, '欢迎来到智汇AI,以下是你的偏好设置。', C.inkSoft, 14)}
${rows
  .map(
    ([y, label]) => `
<text x="${C_L + 70}" y="${y + 20}" font-family="${FONT}" font-size="15" fill="${C.inkSoft}">${esc(label)}</text>`,
  )
  .join('')}
${successEmblem(712, 384)}
`);
}

// 重装/升级确认页:卡片框烧入位图,卡片文字/选中指示器由运行期控件叠加
// (文案随 同版本/升级/降级 三场景动态变化,严禁把这两行文案烧进位图)。
// 卡片样式与目录页输入容器同语言:卡底 + 1.5px 描边 + 唯一圆角 token 8px。
// 轨道步点 = 01 已完成 ✓、02..04 未激活(本页是维护前置页,02 安装位置
// 尚未到达,不得以"当前页"样式高亮 —— doneOnly 转发,见 rail 注释)。
// 右上循环徽章(y ≤ 282)在 RDESC 动态说明行实色槽(y≥302)之上,互不接触。
function sceneReinstall(logo) {
  const card = (y) =>
    `<rect x="${RCARD_X + 0.75}" y="${y + 0.75}" width="${RCARD_W - 1.5}" height="${RCARD_H - 1.5}" rx="${RADIUS - 1}" fill="${C.card}" stroke="${C.btnStroke}" stroke-width="1.5"/>`;
  return page(`
${pageChrome(logo, 1, STEPS, undefined, true, atmoTop({ rise: 100, seed: 11 }) + footerLine())}
${kicker(C_L, 176, 'STEP 02')}
${title(C_L, 232, '检测到已安装版本')}
${body14(C_L, 262, '请选择保留配置升级,或先卸载再全新安装。')}
${cycleEmblem(768, 224)}
${card(RCARD_Y1)}
${card(RCARD_Y2)}
${body14(C_L, 470, '你的账号与云端数据不受此选择影响。', C.muted, 13)}
`);
}

// 卸载确认页:两步导轨,当前步 = 01 确认卸载。
// 内容区**下半部刻意留空** —— 运行期在下方挂开关与按钮,
// 位图不得画容器/面板/背景块去抢位(与 sceneReinstall「留空白带」同一思路)。
// 氛围 dim=0.7:卸载场景刻意比安装冷静,不加星座辉光。
function sceneUnconfirm(logo) {
  return page(`
${pageChrome(logo, 0, UNSTEPS, undefined, false, atmoTop({ rise: 100, seed: 11, dim: 0.7 }) + footerLine())}
${kicker(C_L, 176, 'UNINSTALL')}
${title(C_L, 232, '卸载 智汇AI 桌面版')}
${body14(C_L, 262, '将从本机移除智汇AI 桌面版,并清理其注册信息。')}
${body14(C_L + 70, 360, '删除应用数据(配置、缓存与登录状态)', C.inkSoft, 15)}
`);
}

// 正在卸载页:与 sceneInstfiles 完全同构 —— 百分比大字与阶段文案都是运行期控件,
// 位图只烧轨道底,轨道下方那一行阶段文案槽保持空白。两步导轨:01 已完成打勾,02 进行中高亮。
function sceneUninstfiles(logo) {
  return page(`
${pageChrome(logo, 1, UNSTEPS, undefined, false, atmoTop({ rise: 100, seed: 11 }) + footerLine())}
${kicker(C_L, 176, 'STEP 02')}
${title(C_L, 232, '正在卸载')}
${body14(C_L, 262, '智汇AI 正在从本机移除文件,请稍候…')}
${meterTrack([20, 34, 46, 56, 66, 76, 86, 92])}
${pctAperture()}
`);
}

// 卸载完成页:两步导轨全部打勾(active 传 2 = 越界 → rail 把两步都判 done),
// 页码计数器显式钉回 02/02,不得显示成 03/02。
// 底部 CTA 带保持空白 —— 「完成」由**原生按钮 1** 换皮承载(见 ihui-uninstaller.nsi
// un.IHUIFinishShow 的 IHUI_INST_SLOT 1),位图不得画按钮去抢位。
function sceneUnfinish(logo) {
  return page(`
${pageChrome(logo, 2, UNSTEPS, '02', false, atmoTop({ rise: 100, seed: 11, dim: 0.8 }) + footerLine())}
${kicker(C_L, 176, 'DONE')}
${title(C_L, 232, '卸载完成', 36)}
${body14(C_L, 264, '智汇AI 桌面版已从本机移除,感谢使用。', C.inkSoft, 14)}
${body14(C_L, 292, '如需再次使用,可随时重新安装,账号与云端数据不受影响。', C.muted, 13)}
${successEmblem(712, 384)}
`);
}

// ---- 开屏动画帧(880x600 满幅,10 帧) --------------------------------------
// 运行期:欢迎页内 ${NSD_CreateTimer} 每 150ms 一拍逐帧播放 splash1..9(帧 0 =
// splash.bmp 是空白起始帧,不入播放序列),播完落回 welcome.bmp —— 见 ihui-ui.nsi
// IHUIOnSplashTick。150ms × 9 ≈ 1.35s(与 15×90 等长,帧数砍 6 帧省 ~1.2MB exe;
// 2026-09-27 用户拍板"降帧也做",分镜按更少帧数重排,每帧留驻更久)。
// 时间轴(f = 1..9,分镜全部在 f9 到位):
//   f1-3   三道星轨细线自右上入场(位移 90→0)+ 星点显影
//   f2+    logo + 核心辉光定格入场(位置/尺寸/透明度恒定)
//   f2-6   双环自 logo 盒外扩散消退(两道错拍,招牌动作)
//   f4-9   字标「智汇AI」字距 24→3 收拢显影;标语/渐变线/域名相继收束
// ⚠️ 体积纪律(2026-09-27 分量探针实测):logo/辉光每帧换位置或透明度 = 每帧一份
// 新栅格,solid LZMA 无法跨帧匹配(沙箱 26MB 事故的splash主力)。凡"常驻"元素一律
// 定格:位置/尺寸/透明度逐帧逐字节一致,固实流里只付一份钱。运动交给细线/环/字距。
const SPLASH_W = 880;
const SPLASH_H = 600;
const SPLASH_FRAMES = 10; // 帧 0(splash.bmp,空白起始)+ splash1..9(播放序列)
const SPLASH_HOLD = 9; // 分镜收束帧:f >= SPLASH_HOLD 的帧逐字节相同(防运行期帧数错配的兜底)

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x) => 1 - (1 - x) ** 3;

function splashScene(frame, logo) {
  const f = Math.min(frame, SPLASH_HOLD);
  const in_ = (a, b) => clamp01((f - a) / (b - a));
  const CX = 440;
  const CY = 248;
  // 背景:垂直渐变(BMP 逐行等值 → LZMA 逐行匹配,近乎免费)+ 一条地平弧线。
  const base = `
<linearGradient id="spbg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${C.rail}"/>
<stop offset="0.55" stop-color="${C.bg}"/>
<stop offset="1" stop-color="${C.bg}"/>
</linearGradient>
<rect width="${SPLASH_W}" height="${SPLASH_H}" fill="url(#spbg)"/>
<circle cx="440" cy="1052" r="620" fill="none" stroke="${C.tint}" stroke-width="1.2" opacity="0.45"/>
<circle cx="440" cy="1052" r="760" fill="none" stroke="${C.tintStrong}" stroke-width="1" opacity="0.3"/>`;
  if (f === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="${SPLASH_W}" height="${SPLASH_H}" viewBox="0 0 ${SPLASH_W} ${SPLASH_H}">
${GRAD_DEFS}${base}
</svg>`;
  // 星轨入场:三条不模糊渐变细线 + 星点显影(细线 = 一行内长程同值,LZMA 友好)
  const shift = +((1 - easeOut(in_(1, 4))) * 90).toFixed(1);
  const trails = `<g transform="translate(${shift} -${(shift * 0.4).toFixed(1)})">
<path d="M -60 116 C 220 40, 470 124, 940 52" fill="none" stroke="url(#ihg)" stroke-width="2.5" opacity="0.5"/>
<path d="M -60 132 C 250 62, 500 140, 940 76" fill="none" stroke="url(#ihg)" stroke-width="1.4" opacity="0.3"/>
<path d="M -60 104 C 260 34, 520 104, 940 36" fill="none" stroke="${C.accent}" stroke-width="0.8" opacity="0.2"/>
</g>`;
  const stars = `<g opacity="${in_(1, 4).toFixed(2)}">${constellation(96, 60, 688, 180, 29, 18)}</g>`;
  // 核心辉光 + logo:f>=2 定格(见体积纪律),f<2 不出现
  const core = f < 2 ? '' : glowOrb(CX, CY, 100, C.gradTo, 0.24, 'spCore');
  const L = 150;
  const logoEl = f < 2 ? '' : logoImg(logo, CX, CY, L);
  // 双环扩散:r 108 → 172,透明度 (1-p)。起点 108 = logo 盒(±75,对角 106)之外 ——
  // 环若穿行 logo 盒,盒内底像素逐帧变化,固实 LZMA 的跨帧 logo 去重就失效。
  const ring = (p) =>
    p <= 0
      ? ''
      : `<circle cx="${CX}" cy="${CY}" r="${(108 + 64 * p).toFixed(1)}" fill="none" stroke="${C.tintStrong}" stroke-width="${(2 * (1 - p) + 0.5).toFixed(2)}" opacity="${(0.55 * (1 - p)).toFixed(3)}"/>`;
  // 静止轨道大圆(r150,整圆在 logo 盒外)+ 其上一枚运行卫星点(每帧 +45°,2.6px 的
  // 点,运动成本近零)。不做穿盒的旋转椭圆 —— 同一个去重理由。
  const satA = (f * 45 * Math.PI) / 180;
  const orbit =
    `<circle cx="${CX}" cy="${CY}" r="150" fill="none" stroke="${C.accent}" stroke-width="1.1" opacity="0.5"/>` +
    `<circle cx="${(CX + 150 * Math.cos(satA)).toFixed(1)}" cy="${(CY + 150 * Math.sin(satA)).toFixed(1)}" r="2.6" fill="${C.accent}" opacity="0.9"/>`;
  // 字标收距 + 标语 + 渐变线 + 域名(全部 f9 收束)
  const wordOp = in_(4, 8).toFixed(2);
  const wordSpacing = +(24 - 21 * easeOut(in_(4, 9))).toFixed(1);
  const tagOp = in_(6, 8).toFixed(2);
  const lineW = +(540 * easeOut(in_(5, 9))).toFixed(1);
  const domOp = in_(8, 9).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SPLASH_W}" height="${SPLASH_H}" viewBox="0 0 ${SPLASH_W} ${SPLASH_H}">
${GRAD_DEFS}${base}
${trails}
${stars}
${ring(in_(2, 5))}
${ring(in_(3, 7))}
${core}
${orbit}
${logoEl}
<text x="${CX}" y="392" font-family="${FONT}" font-size="52" font-weight="700" fill="${C.ink}" text-anchor="middle" letter-spacing="${wordSpacing}" opacity="${wordOp}">智汇AI</text>
<text x="${CX}" y="436" font-family="${FONT}" font-size="16" fill="${C.muted}" text-anchor="middle" opacity="${tagOp}">你的 AI 智能体工作台</text>
<rect x="${CX - lineW / 2}" y="492" width="${lineW}" height="2" rx="1" fill="url(#ihg)"/>
<text x="${CX}" y="532" font-family="${FONT}" font-size="11" fill="${C.accent}" text-anchor="middle" letter-spacing="5" opacity="${domOp}">AIZHS.TOP</text>
</svg>`;
}

// logo <image> 固化输出(f>=3 恒定形态;参数与帧无关,保证跨帧逐字节一致)
const logoImg = (logoSvg, cx, cy, size) =>
  logoSvg ? `<image href="${logoSvg}" x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}"/>` : '';

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
  const W2 = 52;
  const H2 = 28;
  const R = 6; // rounded-md
  const B = 1.5; // border-foreground
  const T = 20; // thumb h-5 w-5
  const TR = 3; // rounded-sm
  const SH = 3; // shadow offset
  const CW = W2 + SH;
  const CH = H2 + SH;
  const track = on ? C.accent : C.bg;
  const thumb = on ? C.bg : C.ink;
  const tx = on ? 4 + 23 : 4; // 1.5 描边 + 3 内边距 ≈ 4
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
<rect x="${SH}" y="${SH}" width="${W2}" height="${H2}" rx="${R}" fill="${C.ink}"/>
<rect x="${B / 2}" y="${B / 2}" width="${W2 - B}" height="${H2 - B}" rx="${R - B / 2}" fill="${track}" stroke="${C.ink}" stroke-width="${B}"/>
<rect x="${tx}" y="4" width="${T}" height="${T}" rx="${TR}" fill="${thumb}"/>
</svg>`;
}

// ---- 重装页选中指示器(重装确认页卡片左侧 20x20,两态) -----------------------
// 放在卡片卡底 #1A1A1A 之上:BMP 无透明通道,整画布先铺卡底色再画指示圆。
// ON = 品牌灰蓝描边 + 同色实心内点(accent,与导轨进行中标记同语言);
// OFF = 次级描边空心(muted/btnStroke)—— 两态颜色差异明显。
// 运行期由 ihui-ui.nsi IHUI_RIND_SET 按选中态换图,矩形 20x20 逻辑由
// IHUI_RIND_* define 定位,checkReinstallCards 逐档校验位图尺寸。
function radioScene(on) {
  const S = 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<rect width="${S}" height="${S}" fill="${C.card}"/>
<circle cx="10" cy="10" r="8" fill="none" stroke="${on ? C.accent : C.muted}" stroke-width="1.5"/>${on ? `\n<circle cx="10" cy="10" r="4" fill="${C.accent}"/>` : ''}
</svg>`;
}

// ---- 按钮(独立小画布) -------------------------------------------------------
// 圆角唯一 token RADIUS=8;高度唯一档位:CTA/浏览 lg h-10=40,开关 h-7=28(见 switchScene)

function buttonScene(kind, text, w, h, labelSize) {
  const r = RADIUS;
  const common = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  const baseline = h / 2 + labelSize * 0.36;
  switch (kind) {
    case 'primary':
      // 暗色 primary:纯白底黑字(.dark --color-primary / --color-primary-foreground)
      // 底缘 6% 黑渐变(黑 = primaryInk token 的透明度派生)给一点纵向体积,非第二色
      return `${common}
<defs><linearGradient id="ctaShade" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${C.primaryInk}" stop-opacity="0"/>
<stop offset="1" stop-color="${C.primaryInk}" stop-opacity="0.07"/>
</linearGradient></defs>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r}" fill="${C.primary}"/>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r}" fill="url(#ctaShade)"/>
<text x="${w / 2}" y="${baseline}" font-family="${FONT}" font-size="${labelSize}" font-weight="600" fill="${C.primaryInk}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'ghost':
      return `${common}
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r}" fill="${C.bg}" stroke="${C.btnStroke}" stroke-width="1.5"/>
<text x="${w / 2}" y="${baseline}" font-family="${FONT}" font-size="${labelSize}" fill="${C.ink}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'browse':
      // 次级按钮(2026-09-22 用户反馈"裸文字 + 下划线太难看"):卡底 #1A1A1A + 1.5px 描边
      // + 8px 圆角 + ink 文字,与 CTA 主按钮(渐变实心)构成清晰的主次对。
      // 之前那版"裸文字 + 下划线"是为了响应"去掉背景色容器",但下划线的链接感在桌面
      // 工具里读起来像没做完 —— 用户要的其实是"别用实心色块",不是"别做成按钮"。
      // BMP 无透明通道 → 圆角外那一圈必须铺页面底色 C.bg,否则漏出浅色底,
      // 看起来就像套了第二层边框(正是用户报的"乱七八糟")。
      return `${common}
<rect width="${w}" height="${h}" fill="${C.bg}"/>
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${RADIUS - 1}" fill="${C.card}" stroke="${C.btnStroke}" stroke-width="1.5"/>
<text x="${w / 2}" y="${baseline}" font-family="${FONT}" font-size="${labelSize}" fill="${C.ink}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'close':
    case 'min':
      // 窗口钮:圆角方块幽灵底(唯一圆角 token 8px,禁纯圆),底填页面底色融入内容区。
      return `${common}
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r}" fill="${C.bg}" stroke="${C.btnStroke}" stroke-width="1.2"/>
<text x="${w / 2}" y="${baseline}" font-family="${FONT}" font-size="${labelSize}" fill="${C.inkSoft}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'toggle-on':
      return switchScene(true);
    case 'toggle-off':
      return switchScene(false);
    default:
      throw new Error(`未知按钮类型:${kind}`);
  }
}

// ---- 自绘品牌进度条填充(544×8,左→右品牌渐变,两端半圆胶囊) -----------------
// 运行期由 IHUI_PROGRESS 用 SetWindowRgn 从左侧按百分比裁宽,所以位图必须是
// "满量程"一张(控件尺寸 == 位图尺寸,SS_BITMAP 居中即逐像素贴合)。
// 原生 msctls_progress32 由 NSIS 自行推进,与阶段驱动的百分比数字会打架,故弃用。
function barFillScene() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PB_W}" height="${PB_H}" viewBox="0 0 ${PB_W} ${PB_H}">
${GRAD_DEFS}
<rect x="0" y="0" width="${PB_W}" height="${PB_H}" rx="${PB_H / 2}" fill="url(#ihg)"/>
<rect x="3" y="1" width="${PB_W - 6}" height="1" rx="0.5" fill="#FFFFFF" opacity="0.28"/>
</svg>`;
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

// 高度档位对齐 web <Button> size 表:CTA/浏览 lg h-10=40px,开关 h-7=28px(唯一档位,禁 48px 自造值)
const BUTTONS = [
  ['btn-start', 'primary', '开始安装', 144, 40, 15],
  // btn-continue 统一 144×40:与 CTA 槽(688,500,144,40)同宽,
  // 消除 140 宽位图居中留 2px 缝(重装页/完成态曾因此漏系统蓝底)
  ['btn-continue', 'primary', '继续 ›', 144, 40, 15],
  ['btn-finish', 'primary', '完成', 144, 40, 15],
  ['btn-cancel', 'ghost', '取消', 96, 40, 14],
  // 浏览钮 104×40:裸文字链接样式(无容器),槽位 x 728..832
  ['btn-browse', 'browse', '浏览…', 104, 40, 14],
  ['btn-toggle-on', 'toggle-on', '', 55, 31, 12],
  ['btn-toggle-off', 'toggle-off', '', 55, 31, 12],
  ['btn-close', 'close', '✕', 36, 36, 13],
  ['btn-min', 'min', '−', 36, 36, 13],
];

// 5 档 DPI 对应 Windows 标准系统缩放(100%/125%/150%/175%/200%);
// 运行时 ihui-ui.nsi 按窗口 DPI 选档,位图原生尺寸恰等于 880x600 窗口 client。
const SCALES = [1, 1.25, 1.5, 1.75, 2];

const mode = process.argv.includes('--previews') ? 'previews' : 'write';

const logo = await loadLogoDataUri();
mkdirSync(ASSETS, { recursive: true });
mkdirSync(PREVIEWS, { recursive: true });

const PAGES = [
  ['welcome', sceneWelcome],
  ['dir', sceneDir],
  ['instfiles', sceneInstfiles],
  ['finish', sceneFinish],
  ['reinstall', sceneReinstall],
  ['unconfirm', sceneUnconfirm],
  ['uninstfiles', sceneUninstfiles],
  ['unfinish', sceneUnfinish],
];

let count = 0;
for (const scale of SCALES) {
  const tag = Math.round(scale * 100);
  const dir = join(ASSETS, `assets-${tag}`);
  const pngDir = join(PREVIEWS, `assets-${tag}`);
  if (mode === 'write') mkdirSync(dir, { recursive: true });
  mkdirSync(pngDir, { recursive: true });
  const w = Math.round(W * scale);
  const h = Math.round(H * scale);
  const sw = Math.round(SPLASH_W * scale);
  const sh = Math.round(SPLASH_H * scale);

  // 向导页
  for (const [name, fn] of PAGES) {
    await render(fn(logo), w, h, mode === 'write' ? join(dir, `${name}.bmp`) : null, join(pngDir, `${name}.png`));
    count++;
  }

  // 自绘进度条填充(非满幅页,尺寸 = 轨道几何)
  await render(barFillScene(), Math.round(PB_W * scale), Math.round(PB_H * scale),
    mode === 'write' ? join(dir, 'bar-fill.bmp') : null, join(pngDir, 'bar-fill.png'));
  count++;

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

  // 重装页选中指示器(20x20 逻辑,与 ihui-ui.nsi IHUI_RIND_SIZE 一致)
  for (const [name, on] of [['maint-radio-on', true], ['maint-radio-off', false]]) {
    await render(radioScene(on), Math.round(20 * scale), Math.round(20 * scale),
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

