// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 功能图形布局:定位图形(含分隔符)/ 定时图形 / 校正图形 / 暗模块 / 格式信息 / 版本信息。
 *
 * 判据与渲染分离:本层只维护「模块值 + 是否为功能位」两张位图,不参与掩码与评分。
 * 坐标约定统一为 (x = 列, y = 行),索引 = y * size + x。
 */
import { EC_LEVEL_M_FORMAT_BITS, type VersionSpec } from './tables.js';

export interface QrGrid {
  readonly size: number;
  /** 模块值:1 = 深,0 = 浅 */
  readonly modules: Uint8Array;
  /** 1 = 功能图形/保留位(码字落位必须跳过) */
  readonly reserved: Uint8Array;
}

export function createGrid(size: number): QrGrid {
  return { size, modules: new Uint8Array(size * size), reserved: new Uint8Array(size * size) };
}

export function cloneGrid(grid: QrGrid): QrGrid {
  return { size: grid.size, modules: grid.modules.slice(), reserved: grid.reserved.slice() };
}

export function moduleAt(grid: QrGrid, x: number, y: number): 0 | 1 {
  return (grid.modules[y * grid.size + x] ?? 0) === 1 ? 1 : 0;
}

/** 深模块数(掩码评分的占比维用它) */
export function darkModuleCount(grid: QrGrid): number {
  let count = 0;
  for (let i = 0; i < grid.modules.length; i += 1) count += grid.modules[i] ?? 0;
  return count;
}

/** 非功能位数量 —— 用例用它反算「8 × 总码字 + 余数比特」是否严格相等 */
export function dataRegionModuleCount(grid: QrGrid): number {
  let count = 0;
  for (let i = 0; i < grid.reserved.length; i += 1) if ((grid.reserved[i] ?? 0) === 0) count += 1;
  return count;
}

function setFunction(grid: QrGrid, x: number, y: number, dark: boolean): void {
  const { size } = grid;
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const idx = y * size + x;
  grid.modules[idx] = dark ? 1 : 0;
  grid.reserved[idx] = 1;
}

/**
 * 7×7 定位图形 + 一圈分隔符:以中心 (cx, cy) 展开 9×9 的切比雪夫环。
 * 环距 0/1 深、2 浅、3 深(外环)、4 浅(分隔符);四种环一次画完,且都标成功能位。
 */
function drawFinder(grid: QrGrid, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setFunction(grid, cx + dx, cy + dy, dist !== 2 && dist !== 4);
    }
  }
}

/** 定时图形:第 6 行/列的中段(两端落在定位图形里的部分由其负责) */
function drawTiming(grid: QrGrid): void {
  const { size } = grid;
  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    setFunction(grid, i, 6, dark);
    setFunction(grid, 6, i, dark);
  }
}

/** 校正图形:5×5,环距 0 深、1 浅、2 深;与定位图形重叠的那几格跳过 */
function drawAlignment(grid: QrGrid, centers: readonly number[]): void {
  const { size } = grid;
  if (centers.length < 2) return;
  const last = size - 7;
  for (const cy of centers) {
    for (const cx of centers) {
      const overlapsFinder =
        (cx === 6 && cy === 6) || (cx === 6 && cy === last) || (cx === last && cy === 6);
      if (overlapsFinder) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFunction(grid, cx + dx, cy + dy, dist !== 1);
        }
      }
    }
  }
}

/**
 * 格式信息第 i 位(0..14)的两处落位:第一副本绕左上定位图形,第二副本拆到右上/左下。
 * 顺序即 ISO/IEC 18004 §8.9 的绘制序,用例按同一坐标集反查,不许两处各写一套。
 */
export function formatSlotPair(size: number, i: number): readonly [readonly [number, number], readonly [number, number]] {
  const first: readonly [number, number] =
    i <= 5 ? [8, i] : i === 6 ? [8, 7] : i === 7 ? [8, 8] : i === 8 ? [7, 8] : [14 - i, 8];
  const second: readonly [number, number] = i < 8 ? [size - 1 - i, 8] : [8, size - 15 + i];
  return [first, second];
}

/** 15 位格式信息的全部落位(两副本按位序展开) */
export function formatBitPositions(size: number): ReadonlyArray<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (let i = 0; i < 15; i += 1) {
    const [first, second] = formatSlotPair(size, i);
    out.push(first, second);
  }
  return out;
}

/** 版本信息 18 位 × 两副本的落位(version < 7 时无此块) */
export function versionBitPositions(size: number): ReadonlyArray<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (let i = 0; i < 18; i += 1) {
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    out.push([a, b], [b, a]);
  }
  return out;
}

/** BCH(15,5) 生成 + 0x5412 异或掩码:M 档的数据位就是 maskPattern */
export function formatInformationBits(maskPattern: number): number {
  const data = (EC_LEVEL_M_FORMAT_BITS << 3) | (maskPattern & 0b111);
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** BCH(18,6):版本信息 18 bit(version < 7 返回 0,调用侧据此跳过) */
export function versionInformationBits(version: number): number {
  if (version < 7) return 0;
  let rem = version;
  for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

function bitAt(value: number, index: number): boolean {
  return ((value >>> index) & 1) === 1;
}

/** 写格式信息(两副本)+ 恒暗的暗模块;每个掩码候选都要重写一次(评分射程含它) */
export function drawFormatBits(grid: QrGrid, maskPattern: number): void {
  const bits = formatInformationBits(maskPattern);
  for (let i = 0; i < 15; i += 1) {
    const [first, second] = formatSlotPair(grid.size, i);
    setFunction(grid, first[0], first[1], bitAt(bits, i));
    setFunction(grid, second[0], second[1], bitAt(bits, i));
  }
  setFunction(grid, 8, grid.size - 8, true);
}

/** 预留格式信息位与暗模块(基表阶段占位,值由 drawFormatBits 填) */
function reserveFormatSlots(grid: QrGrid): void {
  for (const [x, y] of formatBitPositions(grid.size)) grid.reserved[y * grid.size + x] = 1;
  grid.reserved[(grid.size - 8) * grid.size + 8] = 1;
}

/** 预留并写入版本信息(仅 version ≥ 7) */
function drawVersionBits(grid: QrGrid, version: number): void {
  const bits = versionInformationBits(version);
  if (bits === 0) return;
  for (let i = 0; i < 18; i += 1) {
    const a = grid.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunction(grid, a, b, bitAt(bits, i));
    setFunction(grid, b, a, bitAt(bits, i));
  }
}

/**
 * 建立「含全部功能图形、未放码字」的基础网格。
 * reserved 位图即码字落位禁区;数据区格数由用例反算 8 × 总码字 + 余数比特。
 */
export function buildBaseGrid(spec: VersionSpec): QrGrid {
  const grid = createGrid(spec.size);
  drawFinder(grid, 3, 3);
  drawFinder(grid, spec.size - 4, 3);
  drawFinder(grid, 3, spec.size - 4);
  drawTiming(grid);
  drawAlignment(grid, spec.alignmentCenters);
  reserveFormatSlots(grid);
  setFunction(grid, 8, spec.size - 8, true);
  drawVersionBits(grid, spec.version);
  return grid;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
