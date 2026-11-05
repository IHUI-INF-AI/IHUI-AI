// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * QR 版本与容量表(byte 模式 · 纠错等级 M · 版本 1–10)。
 *
 * 数据取自 ISO/IEC 18004 Table 9 的 M 档行(总码字数已在用例里逐版本反算校验:
 * 数据码字 + 分块数 × 每块纠错码字 == 该版本总码字数)。
 *
 * 档位刻意的边界:
 * - 只做 byte 模式(URL / 路径这类 ASCII 载荷用数字与文本模式省不了几个字节,
 *   换来的是第二把模式判据与第二套容量表,不值)。
 * - 只做 M 档(扫码场景的标准默认档,约 15% 码字冗余;L 太脆、Q/H 会白吃容量)。
 * - 只做版本 1–10(M 档 byte 容量上限 213 字节,已覆盖分享短链与本机路径;
 *   超过即具名拒绝,绝不静默截断载荷)。
 */

/** 支持的最高版本号(超出即 QrEncodeError reason='too-long') */
export const QR_MAX_VERSION = 10;
export const QR_MIN_VERSION = 1;

/** 纠错等级位:ISO/IEC 18004 Table 23 里 M 档的 2 bit 取值 */
export const EC_LEVEL_M_FORMAT_BITS = 0;

/** byte 模式指示符 0b0100(固定占 4 bit) */
export const BYTE_MODE_INDICATOR = 0b0100;
export const MODE_INDICATOR_BITS = 4;

/** 一个版本的布局与容量描述 */
export interface VersionSpec {
  readonly version: number;
  /** 边长(模块数)= 4 × version + 17 */
  readonly size: number;
  /** 每块纠错码字数 */
  readonly ecCodewordsPerBlock: number;
  readonly group1Blocks: number;
  readonly group1DataCodewords: number;
  readonly group2Blocks: number;
  readonly group2DataCodewords: number;
  /** 校正图形中心坐标 */
  readonly alignmentCenters: readonly number[];
  /** 数据码字总数 */
  readonly dataCodewords: number;
  /** 总码字(数据 + 纠错) */
  readonly totalCodewords: number;
  /** byte 模式字符容量 */
  readonly byteCapacity: number;
  /** 字符计数指示符位宽(v1–9 为 8,v10+ 为 16) */
  readonly charCountBits: number;
}

/** [version, ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data, ...alignmentCenters] */
const RAW_ROWS: readonly (readonly number[])[] = [
  [1, 10, 1, 16, 0, 0],
  [2, 16, 1, 28, 0, 0, 6, 18],
  [3, 26, 1, 44, 0, 0, 6, 22],
  [4, 18, 2, 32, 0, 0, 6, 26],
  [5, 24, 2, 43, 0, 0, 6, 30],
  [6, 16, 4, 27, 0, 0, 6, 34],
  [7, 18, 4, 31, 0, 0, 6, 22, 38],
  [8, 22, 2, 38, 2, 39, 6, 24, 42],
  [9, 22, 3, 36, 2, 37, 6, 26, 46],
  [10, 26, 4, 43, 1, 44, 6, 28, 50],
];

function buildVersionSpec(row: readonly number[]): VersionSpec {
  const version = row[0] ?? 1;
  const ecCodewordsPerBlock = row[1] ?? 0;
  const group1Blocks = row[2] ?? 0;
  const group1DataCodewords = row[3] ?? 0;
  const group2Blocks = row[4] ?? 0;
  const group2DataCodewords = row[5] ?? 0;
  const alignmentCenters = row.slice(6);
  const dataCodewords = group1Blocks * group1DataCodewords + group2Blocks * group2DataCodewords;
  const totalCodewords = dataCodewords + (group1Blocks + group2Blocks) * ecCodewordsPerBlock;
  const charCountBits = version >= 10 ? 16 : 8;
  const byteCapacity = Math.floor((dataCodewords * 8 - MODE_INDICATOR_BITS - charCountBits) / 8);
  return {
    version,
    size: 4 * version + 17,
    ecCodewordsPerBlock,
    group1Blocks,
    group1DataCodewords,
    group2Blocks,
    group2DataCodewords,
    alignmentCenters,
    dataCodewords,
    totalCodewords,
    byteCapacity,
    charCountBits,
  };
}

/** 版本 1–10 的规格表(按版本号升序) */
export const VERSION_SPECS: readonly VersionSpec[] = RAW_ROWS.map(buildVersionSpec);

/** 按版本号取规格;越界返回 undefined(调用方负责具名拒绝) */
export function versionSpec(version: number): VersionSpec | undefined {
  if (!Number.isInteger(version) || version < QR_MIN_VERSION || version > QR_MAX_VERSION) return undefined;
  return VERSION_SPECS[version - QR_MIN_VERSION];
}

/**
 * 容纳 byte 载荷所需的最小版本;放不下返回 undefined。
 * 纯函数,便于用例逐版本反查容量。
 */
export function pickMinimumVersion(byteLength: number): VersionSpec | undefined {
  if (!Number.isInteger(byteLength) || byteLength < 0) return undefined;
  return VERSION_SPECS.find((spec) => spec.byteCapacity >= byteLength);
}

/** 校正图形中心坐标(供布局层复用) */
export function alignmentCentersFor(version: number): readonly number[] {
  return versionSpec(version)?.alignmentCenters ?? [];
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
