// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 掩码:码字落位(zigzag)、8 个掩码候选、ISO 惩罚分与「8 选 1」。
 *
 * 全部纯函数:输入基础网格 + 码字,输出新网格,不改调用方对象。
 * 坐标约定与 patterns 层一致(x = 列,y = 行)。
 */
import { type QrGrid, cloneGrid, darkModuleCount, drawFormatBits, moduleAt } from './patterns.js';

/** 8 种掩码的条件函数(ISO/IEC 18004 Table 15,i = 列 x,j = 行 y) */
const MASK_PREDICATES: ReadonlyArray<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** 第 maskPattern 号掩码在 (x, y) 处是否需要翻转 */
function maskBit(x: number, y: number, maskPattern: number): boolean {
  const predicate = MASK_PREDICATES[maskPattern];
  if (!predicate) throw new RangeError(`maskBit: 非法掩码号 ${maskPattern}`);
  return predicate(x, y);
}

/**
 * 码字落位:自右下角起、两列宽的蛇形扫描,跳过第 6 列(定时图形),
 * 交替向上/向下;数据用尽后剩余的「余数比特」按 0 参与掩码(标准要求,不是可选)。
 */
function placeCodewords(base: QrGrid, codewords: Uint8Array, maskPattern: number): QrGrid {
  const grid = cloneGrid(base);
  const { size } = grid;
  const totalBits = codewords.length * 8;
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        const idx = y * size + x;
        if ((grid.reserved[idx] ?? 0) === 1) continue;
        let bit = 0;
        if (bitIndex < totalBits) {
          const byte = codewords[bitIndex >>> 3] ?? 0;
          bit = (byte >>> (7 - (bitIndex & 7))) & 1;
          bitIndex += 1;
        }
        const flipped = maskBit(x, y, maskPattern) ? 1 - bit : bit;
        grid.modules[idx] = flipped;
      }
    }
  }
  return grid;
}

/** 候选掩码下的完整符号(含格式信息)—— 评分与渲染都只认这张表 */
export function maskedSymbol(base: QrGrid, codewords: Uint8Array, maskPattern: number): QrGrid {
  const grid = placeCodewords(base, codewords, maskPattern);
  drawFormatBits(grid, maskPattern);
  return grid;
}

const PATTERN_FINDER_HEAD = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
const PATTERN_FINDER_TAIL = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];

function lineAt(grid: QrGrid, index: number, horizontal: boolean): number[] {
  const line: number[] = new Array<number>(grid.size);
  for (let k = 0; k < grid.size; k += 1) line[k] = horizontal ? moduleAt(grid, k, index) : moduleAt(grid, index, k);
  return line;
}

function rule1And3(line: number[]): number {
  let penalty = 0;
  // 规则 1:同色连段长度 k ≥ 5 记 3 + (k - 5)
  let run = 1;
  for (let i = 1; i < line.length; i += 1) {
    if (line[i] === line[i - 1]) {
      run += 1;
    } else {
      if (run >= 5) penalty += 3 + (run - 5);
      run = 1;
    }
  }
  if (run >= 5) penalty += 3 + (run - 5);
  // 规则 3:定位图形似形(1:1:3:1:1 前后带 4 格浅)每出现一次记 40
  for (let i = 0; i + 11 <= line.length; i += 1) {
    let head = true;
    let tail = true;
    for (let k = 0; k < 11; k += 1) {
      const value = line[i + k] ?? 0;
      if (value !== PATTERN_FINDER_HEAD[k]) head = false;
      if (value !== PATTERN_FINDER_TAIL[k]) tail = false;
    }
    if (head) penalty += 40;
    if (tail) penalty += 40;
  }
  return penalty;
}

function rule2(grid: QrGrid): number {
  let penalty = 0;
  for (let y = 0; y < grid.size - 1; y += 1) {
    for (let x = 0; x < grid.size - 1; x += 1) {
      const value = moduleAt(grid, x, y);
      if (value === moduleAt(grid, x + 1, y) && value === moduleAt(grid, x, y + 1) && value === moduleAt(grid, x + 1, y + 1)) {
        penalty += 3;
      }
    }
  }
  return penalty;
}

function rule4(grid: QrGrid): number {
  const total = grid.size * grid.size;
  const percent = (darkModuleCount(grid) * 100) / total;
  const deviation = Math.abs(Math.floor(percent) - 50);
  return Math.floor(deviation / 5) * 10;
}

/** ISO/IEC 18004 §8.8.2 的四条惩罚规则之和(逐维独立可查,便于用例定位偏差) */
export function penaltyScore(grid: QrGrid): number {
  let penalty = 0;
  for (let i = 0; i < grid.size; i += 1) {
    penalty += rule1And3(lineAt(grid, i, true));
    penalty += rule1And3(lineAt(grid, i, false));
  }
  penalty += rule2(grid);
  penalty += rule4(grid);
  return penalty;
}

export interface MaskCandidate {
  readonly maskPattern: number;
  readonly penalty: number;
}

/** 逐候选打分(纯函数,用例可直接断言这张表) */
export function scoreMaskCandidates(base: QrGrid, codewords: Uint8Array): MaskCandidate[] {
  const scores: MaskCandidate[] = [];
  for (let mask = 0; mask <= 7; mask += 1) {
    scores.push({ maskPattern: mask, penalty: penaltyScore(maskedSymbol(base, codewords, mask)) });
  }
  return scores;
}

/** 8 选 1:取最低分;同分取掩码号小者(标准未定同次序,本仓定档并在用例里钉住) */
export function selectMaskPattern(candidates: readonly MaskCandidate[]): number {
  if (candidates.length === 0) throw new RangeError('selectMaskPattern: 候选集为空(枚举到 0 即未判定)');
  let best = candidates[0] as MaskCandidate;
  for (const candidate of candidates) {
    if (candidate.penalty < best.penalty || (candidate.penalty === best.penalty && candidate.maskPattern < best.maskPattern)) {
      best = candidate;
    }
  }
  return best.maskPattern;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
