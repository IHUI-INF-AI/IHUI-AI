#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端图标一致性校验(构建链守门,2026-11-21 立)。
 *
 * 为什么要有这道门:图标唯一源 = apps/mobile-rn/assets/icon.png,
 * 经 make-rounded-icon.mjs 圆角化成 icons/source-rounded.png,再由 `tauri icon` 派生各尺寸。
 * 0.1.81 曾只改 16/20/24/32/48/64 小尺寸为「透明底 ∞」、0.1.82 当天回退,
 * 中间发布过一版混合图标的包 —— 机器上于是长期显示回退前那版(installed package 图标缓存)。
 * 只要「入仓各尺寸必须同源派生」这条在构建前被机器判定,这类"改了半边/回退半边"的包就出不来。
 *
 * 判据(结构相似,容忍重采样差异,不容忍换图):
 *   1) 尺寸/存在性:清单内每个文件存在且尺寸正确;
 *   2) 不透明占比:与源图同尺寸缩放结果相差 ≤ 6 个百分点(抓"黑底变透明/透明换黑底");
 *   3) 平均色差:双方都不透明像素的 RGB 平均绝对差 ≤ 阈值(抓"换成了另一张图")。
 *
 * 用法:node scripts/check-desktop-icons.mjs [--icons-dir=<dir>] [--verbose]
 *   --icons-dir 缺省 = <cwd>/apps/desktop/src-tauri/icons(从仓库根跑);
 *   构建链在 apps/desktop 下调用,显式传 --icons-dir=src-tauri/icons。
 * 退出码:0 = 同源一致;1 = 不一致(逐项点名);2 = 未判定(源图/依赖缺失)。
 */
import sharp from 'sharp';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function argOf(name) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}
const ICONS = resolve(process.cwd(), argOf('--icons-dir') ?? join('apps', 'desktop', 'src-tauri', 'icons'));
const SRC = join(ICONS, 'source-rounded.png');
const verbose = process.argv.includes('--verbose');

const OPAQUE_DIFF_LIMIT = 6; // 百分点
const MEAN_RGB_LIMIT = 40; // 0..255

const PNG_EXPECT = [
  ['32x32.png', 32],
  ['64x64.png', 64],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['256x256.png', 256],
  ['icon.png', 512],
];
const ICO_EXPECT = [16, 24, 32, 48, 64, 256];

if (!existsSync(SRC)) {
  console.error(`[icons-check] ❌ 未判定:源图缺失 ${SRC}(先跑 pnpm --filter @ihui/desktop icons:regen)`);
  process.exit(2);
}

/** 读 RGBA raw */
async function rawOf(buf, w, h) {
  return sharp(buf).resize(w, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** 解析 ico 条目:{ size, png } */
function icoEntries(buf) {
  const count = buf.readUInt16LE(4);
  const out = [];
  for (let i = 0; i < count; i++) {
    const o = 6 + 16 * i;
    const w = buf[o] === 0 ? 256 : buf[o];
    const len = buf.readUInt32LE(o + 8);
    const off = buf.readUInt32LE(o + 12);
    const isPng = buf[off] === 0x89 && buf[off + 1] === 0x50;
    out.push({ size: w, png: isPng ? buf.subarray(off, off + len) : null });
  }
  return out;
}

/** 结构相似度:不透明占比差(百分点) + 双方不透明像素的平均 RGB 差 */
function similarity(actual, expected, w, h) {
  const a = actual.data;
  const e = expected.data;
  let aOpaque = 0;
  let eOpaque = 0;
  let bothOpaque = 0;
  let sumDiff = 0;
  for (let i = 0; i < a.length; i += 4) {
    const aOn = a[i + 3] > 128;
    const eOn = e[i + 3] > 128;
    if (aOn) aOpaque++;
    if (eOn) eOpaque++;
    if (aOn && eOn) {
      bothOpaque++;
      sumDiff += (Math.abs(a[i] - e[i]) + Math.abs(a[i + 1] - e[i + 1]) + Math.abs(a[i + 2] - e[i + 2])) / 3;
    }
  }
  const total = w * h;
  const opaqueDiff = Math.abs((aOpaque - eOpaque) / total) * 100;
  const meanDiff = bothOpaque ? sumDiff / bothOpaque : 999;
  return { opaqueDiff, meanDiff, aOpaque, eOpaque };
}

const failures = [];

async function checkOne(label, buf, w, h) {
  const actual = await rawOf(buf, w, h);
  const expected = await rawOf(readFileSync(SRC), w, h);
  const s = similarity(actual, expected, w, h);
  const bad = s.opaqueDiff > OPAQUE_DIFF_LIMIT || s.meanDiff > MEAN_RGB_LIMIT;
  const line = `${bad ? '✘' : '✔'} ${label.padEnd(16)} ${w}x${h} 不透明占比=${(s.aOpaque / (w * h) * 100).toFixed(1)}%/源=${(s.eOpaque / (w * h) * 100).toFixed(1)}% 差=${s.opaqueDiff.toFixed(1)}pt 色差=${s.meanDiff.toFixed(1)}`;
  if (bad || verbose) console.log(line);
  if (bad) failures.push(`${label}(${w}x${h}) 与源图不是同一次派生: 不透明占比差 ${s.opaqueDiff.toFixed(1)}pt / 平均色差 ${s.meanDiff.toFixed(1)}`);
}

// 1) 常规 PNG
for (const [name, size] of PNG_EXPECT) {
  const p = join(ICONS, name);
  if (!existsSync(p)) {
    failures.push(`缺文件: icons/${name}(tauri.conf.json bundle.icon 引用中)`);
    continue;
  }
  const meta = await sharp(p).metadata();
  if (meta.width !== size || meta.height !== size) {
    failures.push(`尺寸不符: icons/${name} 实际 ${meta.width}x${meta.height},期望 ${size}x${size}`);
    continue;
  }
  await checkOne(`icons/${name}`, readFileSync(p), size, size);
}

// 2) ico 每一层(这次事故的爆点:ico 内部分层被单独改过)
const icoPath = join(ICONS, 'icon.ico');
if (!existsSync(icoPath)) {
  failures.push('缺文件: icons/icon.ico');
} else {
  const entries = icoEntries(readFileSync(icoPath));
  const sizes = entries.map((e) => e.size).sort((x, y) => x - y);
  const missing = ICO_EXPECT.filter((s) => !sizes.includes(s));
  const extra = sizes.filter((s) => !ICO_EXPECT.includes(s));
  if (missing.length) failures.push(`icon.ico 缺尺寸层: ${missing.join('/')}(Windows 会回退到其它尺寸,观感跳变)`);
  if (extra.length) failures.push(`icon.ico 多余尺寸层: ${extra.join('/')}(清单外的层没有任何派生规则)`);
  for (const e of entries) {
    if (!e.png) {
      failures.push(`icon.ico ${e.size}x${e.size} 层不是 PNG(无法溯源派生,需 icons:regen 重生成)`);
      continue;
    }
    await checkOne(`icon.ico:${e.size}`, e.png, e.size, e.size);
  }
}

if (failures.length) {
  console.error(`\n[icons-check] ❌ 图标与源图不一致(${failures.length} 项):`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('  出路:改源图后跑 `pnpm --filter @ihui/desktop icons:regen` 整组重生成,不要单改某一尺寸;');
  console.error('  若确实要换图,必须整组一起提交(32/64/128/128@2x/256/icon.png/icon.ico 同批)。');
  process.exit(1);
}

console.log(`[icons-check] ✔ 全部 ${PNG_EXPECT.length} 个 PNG + ${ICO_EXPECT.length} 个 ico 层与源图同源派生`);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
