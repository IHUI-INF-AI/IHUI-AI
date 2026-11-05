// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 渲染:模块矩阵 → 静态 SVG(分享页与 data URL 共用同一把尺)。
 *
 * 判据与渲染分离:本层不做编码、不改矩阵,只把 0/1 矩阵画成同一张图。
 * 零外链口径:输出不含 `<script`、不含 `<img`、不含任何 http 引用;
 * xmlns 只在 data URL 形态必需(内联进 HTML 时由 HTML 解析器负责命名空间)。
 */
import { type QrGrid, moduleAt } from './patterns.js';

/** 静区(标准要求 ≥4 模块宽,扫码器靠它把码从页面底色里切出来) */
export const QUIET_ZONE_MODULES = 4;

/** 深色模块:纯黑;浅色底:纯白 —— 对比度取满,不给屏幕反光留余地 */
export const QR_DARK_COLOR = '#000';
export const QR_LIGHT_COLOR = '#fff';

/** 每模块显示像素(1 模块 = 4px:29 模块的 v3 码约 148px 见方,手机贴近即可扫) */
export const MODULE_PIXEL = 4;

export interface QrSvgOptions {
  /** 每模块像素,默认 4 */
  readonly modulePixel?: number;
  readonly darkColor?: string;
  readonly lightColor?: string;
  /** 无障碍说明(渲染成 aria-label,不作为可读文案上屏) */
  readonly label?: string;
  /** data URL 形态需要 xmlns;内联进 HTML 时不需要 */
  readonly standalone?: boolean;
}

/** 带静区的总模块边长 */
export function svgModuleExtent(grid: QrGrid, quietZone = QUIET_ZONE_MODULES): number {
  return grid.size + quietZone * 2;
}

/**
 * 把每行的连续深模块并成一条闭合成子路径(`M x y h w v 1 h -w z`,行程合并):
 * 几何与逐格 rect 完全同形,但一枚 49×49 的码把 447 个节点压进同一条 `d`,
 * 分享页不因二维码而胀到几十 KB。
 */
export function darkModuleRuns(grid: QrGrid): ReadonlyArray<readonly [number, number, number]> {
  const runs: Array<readonly [number, number, number]> = [];
  for (let y = 0; y < grid.size; y += 1) {
    let x = 0;
    while (x < grid.size) {
      if (moduleAt(grid, x, y) !== 1) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < grid.size && moduleAt(grid, end, y) === 1) end += 1;
      runs.push([x, y, end - x]);
      x = end;
    }
  }
  return runs;
}

/** 行程表 → 单一 `d` 字符串(静区偏移在这里一次性加进去;单位就是模块) */
export function runsToPathD(
  runs: ReadonlyArray<readonly [number, number, number]>,
  quietZone = QUIET_ZONE_MODULES,
): string {
  return runs.map(([x, y, width]) => `M${x + quietZone} ${y + quietZone}h${width}v1h-${width}z`).join('');
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 生成 SVG 字符串(坐标单位即模块,像素尺寸由 width/height 决定) */
export function renderQrSvg(grid: QrGrid, options: QrSvgOptions = {}): string {
  const modulePixel = options.modulePixel ?? MODULE_PIXEL;
  const dark = options.darkColor ?? QR_DARK_COLOR;
  const light = options.lightColor ?? QR_LIGHT_COLOR;
  const extent = svgModuleExtent(grid);
  const pixels = extent * modulePixel;
  const xmlns = options.standalone ? ' xmlns="http://www.w3.org/2000/svg"' : '';
  const label = options.label ? ` role="img" aria-label="${escapeAttribute(options.label)}"` : '';
  const d = runsToPathD(darkModuleRuns(grid));
  return (
    `<svg${xmlns} width="${pixels}" height="${pixels}" viewBox="0 0 ${extent} ${extent}"` +
    ` shape-rendering="crispEdges"${label}>` +
    `<rect width="${extent}" height="${extent}" fill="${light}"/>` +
    `<path fill="${dark}" d="${d}"/>` +
    `</svg>`
  );
}

/**
 * data URL 形态(percent-encode,不引 base64 依赖):
 * 与内联 SVG 同一把尺,只是补上 standalone 需要的 xmlns。
 */
export function renderQrSvgDataUrl(grid: QrGrid, options: QrSvgOptions = {}): string {
  const svg = renderQrSvg(grid, { ...options, standalone: true });
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
