#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/* eslint-disable no-console -- 资产生成脚本为 CLI 工具,需 console 输出诊断信息 */
// 桌面端 NSIS 安装器品牌视觉资产生成器。
//
// 产出(scale ∈ {1, 1.25, 1.5, 1.75, 2},对应 Windows 标准缩放 100%/125%/150%/175%/200%):
//   installer-assets/assets-100|125|150|175|200/
//     splash.bmp + splash1..15.bmp  开屏动画帧(AdvSplash 多帧序列,720x450 逻辑尺寸)
//     welcome.bmp / dir.bmp / instfiles.bmp / finish.bmp / reinstall.bmp  五个向导页满幅背景(880x600 逻辑)
//     btn-*.bmp                     位图按钮(主 CTA / 幽灵按钮 / 裸文字链接钮 / 快捷方式开关 / 窗口钮)
//   windows/ihui-assets-path.nsh    资产根目录 define(ihui-ui.nsi 编译期 File 嵌入用)
//   供 ihui-ui.nsi 在运行时按窗口 DPI 挑选对应档位从 $PLUGINSDIR 加载。
//
// 设计语言「墨光 · Ink Aurora」(2026-09-22 改版,取代 2026-09-19 的纯黑白杂志风):
//   左侧 248px 品牌导轨(导轨底 = .dark --color-brand-accent-light #1e2e36)+ 四步进度指示器,
//   内容区靠品牌灰蓝渐变(--color-brand-accent-grad-from → -grad-to)做唯一点缀色。
//   导轨 + 步骤条是"去原生向导感"的主手段:页面身份、当前进度、版本号常驻同一视觉锚点,
//   不再依赖 NSIS 经典的"上一步/下一步"底栏语义。
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

// ---- 版面几何(逻辑像素,100% 档;与 ihui-ui.nsi 运行期控件坐标一一对应) ----
const W = 880;
const H = 600;
const RAIL_W = 248; // 品牌导轨宽
const C_L = 288; // 内容区左界(导轨右缘 + 40 内边距)
const C_R = 832; // 内容区右界
const C_W = C_R - C_L; // 544 内容宽
const BTN_Y = 500; // 底栏按钮行上沿(h-10=40 → 500..540)
const BTN_H = 40;
const CTA_W = 144;
const CTA_X = C_R - CTA_W; // 688
const CANCEL_W = 96;
const WIN_SIZE = 36; // 窗口钮边长
const WIN_MIN = [776, 20]; // 最小化钮槽位
const WIN_CLOSE = [820, 20]; // 关闭钮槽位
// 步骤导轨:4 步,首个标记上沿 168,步距 66
const STEP_Y0 = 168;
const STEP_GAP = 66;
const STEPS = [
  ['01', '欢迎', 'WELCOME'],
  ['02', '安装位置', 'LOCATION'],
  ['03', '正在安装', 'PROGRESS'],
  ['04', '完成', 'DONE'],
];
// 安装页进度几何(与 ihui-ui.nsi IHUIInstShow 的进度条/百分比/阶段槽严格一致)
const PB_X = C_L;
const PB_Y = 300;
const PB_W = C_W;
const PB_H = 8;
const PCT_SLOT = [632, 186, 200, 64]; // 百分比大字(运行期 STATIC 右对齐)
const STAGE_SLOT = [C_L, 322, C_W, 22]; // 阶段文案(运行期 STATIC)

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

// 品牌装饰:同心"墨光"环(仅描边,非容器,不参与任何点击区)
function auroraRings(cx, cy, r0, opacities) {
  return opacities
    .map((o, i) => {
      const r = r0 + i * 22;
      const stroke = i === 0 ? C.tintStrong : C.tint;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
    })
    .join('\n');
}

// ---- 左侧品牌导轨 -----------------------------------------------------------
// active = 当前步索引(0..3);小于它的标"已完成",等于它的标"进行中"。
function rail(logo, active) {
  const items = STEPS.map(([, zh, en], i) => {
    const my = STEP_Y0 + i * STEP_GAP;
    const state = i < active ? 'done' : i === active ? 'active' : 'todo';
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
      i < STEPS.length - 1
        ? `<rect x="44" y="${my + 30}" width="1.5" height="${STEP_GAP - 34}" fill="${i < active ? C.accent : C.btnStroke}"/>`
        : '';
    return `${marker}
${link}
<text x="70" y="${my + 18}" font-family="${FONT}" font-size="14" font-weight="${state === 'active' ? 700 : 400}" fill="${labelFill}">${esc(zh)}</text>
<text x="70" y="${my + 33}" font-family="${FONT}" font-size="9" fill="${subFill}" letter-spacing="2">${esc(en)}</text>`;
  }).join('\n');

  return `
<rect x="0" y="0" width="${RAIL_W}" height="${H}" fill="${C.rail}"/>
<rect x="${RAIL_W - 2}" y="0" width="2" height="${H}" fill="url(#ihgv)" opacity="0.85"/>
<image href="${logo}" x="32" y="32" width="40" height="40"/>
<text x="84" y="51" font-family="${FONT}" font-size="16" font-weight="700" fill="${C.ink}">智汇AI</text>
<text x="84" y="67" font-family="${FONT}" font-size="9" fill="${C.accent}" letter-spacing="2.5">IHUI AI DESKTOP</text>
${items}
<image href="${logo}" x="54" y="404" width="140" height="140" opacity="0.07"/>
<text x="32" y="574" font-family="${FONT}" font-size="10" fill="${C.muted}">v${VERSION}</text>
<text x="216" y="574" font-family="${FONT}" font-size="10" fill="${C.muted}" text-anchor="end">aizhs.top</text>`;
}

// 页面公共骨架:导轨 + 内容底 + 页脚 + 步骤计数
function pageChrome(logo, active) {
  const cur = String(active + 1).padStart(2, '0');
  return `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${rail(logo, active)}
<text x="${C_L}" y="574" font-family="${FONT}" font-size="10" fill="${C.muted}">© 2026 IHUI AI (智汇AI) · 李春川 · aizhs.top</text>
<text x="${C_R}" y="574" font-family="${FONT}" font-size="10" text-anchor="end"><tspan fill="${C.accent}" font-weight="700">${cur}</tspan><tspan fill="${C.muted}"> / ${String(STEPS.length).padStart(2, '0')}</tspan></text>`;
}

// ---- 向导页场景 -------------------------------------------------------------

function sceneWelcome(logo) {
  const features = [
    '云端智能体 · 桌面与网页无缝切换',
    '账号云同步 · 换机不丢任何数据',
    '自动保持最新 · 无需手动升级',
  ];
  return page(`
${pageChrome(logo, 0)}
${kicker(C_L, 176, 'WELCOME')}
${title(C_L, 232, '智汇AI 桌面版', 40)}
${body14(C_L, 268, '连接你与 AI 智能体的专属工作台', C.inkSoft, 15)}
${features
  .map(
    (t, i) => `
<rect x="${C_L}" y="${338 + i * 44}" width="3" height="18" rx="1.5" fill="url(#ihgv)"/>
<text x="${C_L + 16}" y="${352 + i * 44}" font-family="${FONT}" font-size="15" fill="${C.inkSoft}">${esc(t)}</text>`,
  )
  .join('')}
${auroraRings(712, 424, 74, [1, 1])}
<image href="${logo}" x="652" y="364" width="120" height="120"/>
`);
}

// 目录页:输入框自带容器;「浏览」为裸文字链接钮(底色 = 页面底,无任何容器/描边)。
function sceneDir(logo) {
  return page(`
${pageChrome(logo, 1)}
${kicker(C_L, 176, 'STEP 02')}
${title(C_L, 232, '选择安装位置')}
${body14(C_L, 262, '默认安装到 D:\\智汇AI,也可以更改为其他目录。')}
<rect x="${C_L}" y="300" width="412" height="40" rx="${RADIUS}" fill="${C.card}" stroke="${C.btnStroke}" stroke-width="1.5"/>
${body14(C_L, 380, '体积轻巧 · 数据云端存储 · 卸载不留残余', C.muted, 13)}
${body14(C_L, 404, '提示:直接编辑上方路径,或点击右侧「浏览…」选择目录。', C.muted, 13)}
`);
}

// 安装页:百分比与阶段文案是运行期控件,位图只烧轨道底与静态文案。
function sceneInstfiles(logo) {
  return page(`
${pageChrome(logo, 2)}
${kicker(C_L, 176, 'STEP 03')}
${title(C_L, 232, '正在安装')}
${body14(C_L, 262, '智汇AI 正在写入你的电脑,请稍候…')}
<rect x="${PB_X}" y="${PB_Y}" width="${PB_W}" height="${PB_H}" rx="${PB_H / 2}" fill="${C.hairline}"/>
${body14(C_L, 400, '安装完成后可直接启动,你的数据始终保存在云端', C.muted, 13)}
${auroraRings(712, 456, 58, [1, 1])}
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
${pageChrome(logo, 3)}
${kicker(C_L, 176, 'STEP 04')}
${title(C_L, 232, '安装完成', 36)}
${body14(C_L, 264, '欢迎来到智汇AI,以下是你的偏好设置。', C.inkSoft, 14)}
${rows
  .map(
    ([y, label]) => `
<text x="${C_L + 70}" y="${y + 20}" font-family="${FONT}" font-size="15" fill="${C.inkSoft}">${esc(label)}</text>`,
  )
  .join('')}
${auroraRings(712, 424, 62, [1, 1])}
<text x="712" y="438" font-family="${FONT}" font-size="30" font-weight="700" fill="${C.accent}" text-anchor="middle">&#10003;</text>
`);
}

// 重装/升级确认页:动态标题与两个 radio 由 NSIS 原生控件承载,位图只留空白带。
function sceneReinstall(logo) {
  return page(`
${pageChrome(logo, 1)}
${kicker(C_L, 176, 'STEP 02')}
${title(C_L, 232, '检测到已安装版本')}
${body14(C_L, 262, '请选择保留配置升级,或先卸载再全新安装。')}
${body14(C_L, 440, '你的账号与云端数据不受此选择影响。', C.muted, 13)}
`);
}

// ---- 开屏动画帧(720x450,16 帧) --------------------------------------------
// 时间轴(f = 0..15):
//   f0-4  logo 由 0.86 缩放渐显至 1.0 并上浮
//   f2-8  墨光双环自内向外显影
//   f6-12 字标「智汇AI」字距由 22 收到 3(招牌动作)
//   f9-13 标语显影
//   f7-15 底部品牌渐变进度线自中心延展
//   f12+  域名 kicker
// AdvSplash 以 Delay/帧数 的节奏轮播 splash.bmp, splash1.bmp, …
const SPLASH_W = 880;
const SPLASH_H = 600;
const SPLASH_FRAMES = 16;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x) => 1 - (1 - x) ** 3;

function splashScene(frame, logo) {
  const f = frame;
  const markIn = easeOut(clamp01(f / 5));
  const markSize = Math.round((140 * (0.86 + 0.14 * markIn)) * 10) / 10;
  const markOp = clamp01(f / 4);
  const markY = Math.round((252 - 12 * markIn) * 10) / 10;
  const ringOp = clamp01((f - 2) / 5);
  const wordOp = clamp01((f - 6) / 4);
  const wordSpacing = Math.round((26 - 23 * easeOut(clamp01((f - 6) / 6))) * 10) / 10;
  const tagOp = clamp01((f - 9) / 3);
  const lineW = Math.round(520 * easeOut(clamp01((f - 7) / 8)));
  const domOp = clamp01((f - 12) / 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SPLASH_W}" height="${SPLASH_H}" viewBox="0 0 ${SPLASH_W} ${SPLASH_H}">
${GRAD_DEFS}
<rect width="${SPLASH_W}" height="${SPLASH_H}" fill="${C.bg}"/>
<rect x="0" y="0" width="${SPLASH_W}" height="3" fill="url(#ihg)" opacity="${ringOp}"/>
<g opacity="${ringOp}">
<circle cx="440" cy="252" r="${128 + 12 * ringOp}" fill="none" stroke="${C.tintStrong}" stroke-width="1.5"/>
<circle cx="440" cy="252" r="${162 + 18 * ringOp}" fill="none" stroke="${C.tint}" stroke-width="1.5"/>
</g>
<image href="${logo}" x="${440 - markSize / 2}" y="${markY - markSize / 2}" width="${markSize}" height="${markSize}" opacity="${markOp}"/>
<text x="440" y="392" font-family="${FONT}" font-size="52" font-weight="700" fill="${C.ink}" text-anchor="middle" letter-spacing="${wordSpacing}" opacity="${wordOp}">智汇AI</text>
<text x="440" y="436" font-family="${FONT}" font-size="16" fill="${C.muted}" text-anchor="middle" opacity="${tagOp}">你的 AI 智能体工作台</text>
<rect x="${440 - lineW / 2}" y="492" width="${lineW}" height="2" rx="1" fill="url(#ihg)"/>
<text x="440" y="532" font-family="${FONT}" font-size="11" fill="${C.accent}" text-anchor="middle" letter-spacing="5" opacity="${domOp}">AIZHS.TOP</text>
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

// ---- 按钮(独立小画布) -------------------------------------------------------
// 圆角唯一 token RADIUS=8;高度唯一档位:CTA/浏览 lg h-10=40,开关 h-7=28(见 switchScene)

function buttonScene(kind, text, w, h, labelSize) {
  const r = RADIUS;
  const common = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  const baseline = h / 2 + labelSize * 0.36;
  switch (kind) {
    case 'primary':
      // 暗色 primary:纯白底黑字(.dark --color-primary / --color-primary-foreground)
      return `${common}
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r}" fill="${C.primary}"/>
<text x="${w / 2}" y="${baseline}" font-family="${FONT}" font-size="${labelSize}" font-weight="600" fill="${C.primaryInk}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'ghost':
      return `${common}
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r}" fill="${C.bg}" stroke="${C.btnStroke}" stroke-width="1.5"/>
<text x="${w / 2}" y="${baseline}" font-family="${FONT}" font-size="${labelSize}" fill="${C.ink}" text-anchor="middle">${esc(text)}</text>
</svg>`;
    case 'browse':
      // 裸文字链接钮(2026-09-22 用户明令「浏览按钮的背景色容器请取消」):
      // 无填充容器、无描边,仅品牌色文字 + 同色下划线。BMP 无透明通道,
      // 底必须铺页面底色 C.bg 才能与内容区无缝(此前误铺 C.card = 视觉上多出一块容器)。
      return `${common}
<rect width="${w}" height="${h}" fill="${C.bg}"/>
<text x="${w / 2}" y="${baseline}" font-family="${FONT}" font-size="${labelSize}" fill="${C.accent}" text-anchor="middle">${esc(text)}</text>
<rect x="${w / 2 - labelSize * 1.6}" y="${h / 2 + labelSize * 0.78}" width="${labelSize * 3.2}" height="1.5" rx="0.75" fill="${C.accent}"/>
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
  ['btn-finish', 'primary', '完成', 120, 40, 15],
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

