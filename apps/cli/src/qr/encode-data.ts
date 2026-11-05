// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 数据编码:byte 模式比特流 → 数据码字 → 分块 Reed-Solomon → 交织后的最终码字流。
 *
 * 纯函数、零 IO。容量口径来自 tables 层(M 档 · 版本 1–10),越界一律具名拒绝,
 * 绝不静默截断载荷(截断等于把「扫出来的是另一条链接」交给用户)。
 */
import { rsGeneratorPolynomial, rsRemainder } from './gf256.js';
import { BYTE_MODE_INDICATOR, MODE_INDICATOR_BITS, type VersionSpec } from './tables.js';

/** 填充码字的两枚交替字节(ISO/IEC 18004 §8.4.9) */
const PAD_BYTE_A = 0xec;
const PAD_BYTE_B = 0x11;

/** UTF-8 编码(URL 与路径均为 ASCII 时逐字节等同 Latin-1;非 ASCII 走 UTF-8,与解码侧口径一致) */
export function toUtf8Bytes(text: string): Uint8Array {
  // 用标准 TextEncoder 而不是 Buffer:整族编码器保持宿主中立(可整体上浮到共享层,门 126 口径)
  return new TextEncoder().encode(text);
}

/** 往比特流追加 value 的低 bitWidth 位(高位在前) */
export function appendBits(bits: number[], value: number, bitWidth: number): void {
  if (bitWidth < 0 || bitWidth > 32) throw new RangeError(`appendBits: 位宽越界 ${bitWidth}`);
  for (let i = bitWidth - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

/**
 * 数据码字:模式指示 + 字符计数 + 载荷字节,补齐到字节边界后交替填充 EC/11。
 * 载荷超容量 ⇒ 抛 RangeError(调用方负责换成具名业务错误)。
 */
export function buildDataCodewords(payload: Uint8Array, spec: VersionSpec): Uint8Array {
  if (payload.length > spec.byteCapacity) {
    throw new RangeError(
      `buildDataCodewords: v${spec.version} M 档 byte 容量 ${spec.byteCapacity},收到 ${payload.length}`,
    );
  }
  const bits: number[] = [];
  appendBits(bits, BYTE_MODE_INDICATOR, MODE_INDICATOR_BITS);
  appendBits(bits, payload.length, spec.charCountBits);
  for (const byte of payload) appendBits(bits, byte, 8);

  const capacityBits = spec.dataCodewords * 8;
  // 终止符:先补 0 到 8 的倍数(不足 4 bit 的剩余空间按标准直接补满)
  const terminator = Math.min(Math.max(0, capacityBits - bits.length), 4);
  for (let i = 0; i < terminator; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (bits[i + j] ?? 0);
    codewords[i / 8] = byte;
  }
  for (let i = bits.length / 8; i < spec.dataCodewords; i += 1) {
    codewords[i] = (i - bits.length / 8) % 2 === 0 ? PAD_BYTE_A : PAD_BYTE_B;
  }
  return codewords;
}

export interface RsBlock {
  readonly data: Uint8Array;
  readonly ecc: Uint8Array;
}

/**
 * 分块与纠错码字:先 g1 组(g1Data 字节/块),再 g2 组(g2Data 字节/块);
 * 每块用同一个 degree = ecPerBlock 的生成多项式取余。
 */
export function splitIntoBlocks(dataCodewords: Uint8Array, spec: VersionSpec): RsBlock[] {
  const generator = rsGeneratorPolynomial(spec.ecCodewordsPerBlock);
  const blocks: RsBlock[] = [];
  let offset = 0;
  const groups: ReadonlyArray<readonly [number, number]> = [
    [spec.group1Blocks, spec.group1DataCodewords],
    [spec.group2Blocks, spec.group2DataCodewords],
  ];
  for (const [blockCount, blockDataLength] of groups) {
    for (let i = 0; i < blockCount; i += 1) {
      const data = dataCodewords.slice(offset, offset + blockDataLength);
      if (data.length !== blockDataLength) {
        throw new RangeError(`splitIntoBlocks: 数据码字不足(v${spec.version} 第 ${blocks.length + 1} 块)`);
      }
      blocks.push({ data, ecc: rsRemainder(data, generator) });
      offset += blockDataLength;
    }
  }
  return blocks;
}

/** 交织:数据码字按块轮转,再纠错码字按块轮转(标准 §8.6.1) */
export function interleaveBlocks(blocks: readonly RsBlock[]): Uint8Array {
  const out: number[] = [];
  const maxData = blocks.reduce((m, b) => Math.max(m, b.data.length), 0);
  for (let i = 0; i < maxData; i += 1) {
    for (const block of blocks) {
      const byte = block.data[i];
      if (byte !== undefined) out.push(byte);
    }
  }
  const maxEcc = blocks.reduce((m, b) => Math.max(m, b.ecc.length), 0);
  for (let i = 0; i < maxEcc; i += 1) {
    for (const block of blocks) {
      const byte = block.ecc[i];
      if (byte !== undefined) out.push(byte);
    }
  }
  return Uint8Array.from(out);
}

/** 载荷 → 该版本的最终码字流(数据 + 纠错交织,长度 = spec.totalCodewords) */
export function buildFinalCodewords(payload: Uint8Array, spec: VersionSpec): Uint8Array {
  return interleaveBlocks(splitIntoBlocks(buildDataCodewords(payload, spec), spec));
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
