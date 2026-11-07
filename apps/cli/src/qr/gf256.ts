// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GF(256) 有限域运算 —— QR 里所有 Reed-Solomon 纠错的算地基座。
 *
 * 纯函数、零 IO、零 `node:` 内建(可整体上浮到共享层)。
 * 域多项式采用 ISO/IEC 18004 规定的 0x11d(x^8 + x^4 + x^3 + x^2 + 1),原元素 2。
 *
 * 系数约定:多项式按「最高次项在前」存放(Uint8Array,index 0 是 x^n 的系数),
 * 生成多项式是 monic(首项恒 1),因此取余运算里只用 `generator[j + 1]`。
 */

/** 域生成多项式 x^8 + x^4 + x^3 + x^2 + 1 */
const GF_POLY = 0x11d;

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function buildTables(): void {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if ((x & 0x100) !== 0) x ^= GF_POLY;
  }
  // 第二圈副本:让 gfMultiply 里的 (log[a] + log[b]) 直接取模索引,免去 % 255
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255] ?? 0;
})();

/** α^k(k 可 ≥255,表内已折叠) */
export function gfPow(alphaIndex: number): number {
  return GF_EXP[((alphaIndex % 255) + 255) % 255] ?? 0;
}

/** 域内乘法(a 或 b 为 0 时结果是 0,不是「未定义」) */
export function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  const la = GF_LOG[a] ?? 0;
  const lb = GF_LOG[b] ?? 0;
  return GF_EXP[la + lb] ?? 0;
}

/** 多项式乘法(系数按「最高次项在前」) */
function gfPolynomialMultiply(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length + right.length - 1);
  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      out[i + j] = (out[i + j] ?? 0) ^ gfMultiply(left[i] ?? 0, right[j] ?? 0);
    }
  }
  return out;
}

/**
 * RS 生成多项式 g(degree):∏(x - α^i),i = 0 … degree-1。
 * degree 即该版本/纠错等级下的「每块纠错码字数」。
 */
export function rsGeneratorPolynomial(degree: number): Uint8Array {
  if (degree < 1) throw new RangeError(`rsGeneratorPolynomial: degree 必须 ≥ 1,收到 ${degree}`);
  let poly: Uint8Array = Uint8Array.from([1]);
  for (let i = 0; i < degree; i += 1) {
    poly = gfPolynomialMultiply(poly, Uint8Array.from([1, gfPow(i)]));
  }
  return poly;
}

/**
 * 求 message(x) · x^degree 除以 generator 的余式 —— 即纠错码字。
 * generator 必须是 monic(首项 1),返回值长度 = generator.length - 1。
 */
export function rsRemainder(message: Uint8Array, generator: Uint8Array): Uint8Array {
  const degree = generator.length - 1;
  if (degree < 1) throw new RangeError('rsRemainder: generator 次数必须 ≥ 1');
  const remainder = new Uint8Array(degree);
  for (let k = 0; k < message.length; k += 1) {
    const factor = (message[k] ?? 0) ^ (remainder[0] ?? 0);
    remainder.copyWithin(0, 1);
    remainder[degree - 1] = 0;
    if (factor === 0) continue;
    for (let j = 0; j < degree; j += 1) {
      remainder[j] = (remainder[j] ?? 0) ^ gfMultiply(generator[j + 1] ?? 0, factor);
    }
  }
  return remainder;
}

/**
 * 校验子 S_i = C(α^i),i = 0 … count-1(Horner 求值,系数按最高次项在前)。
 * 码字多项式必须能被生成多项式整除 ⇒ 全部校验子为 0:这是不依赖任何外部库的代数自证。
 */
export function rsSyndromes(codeword: Uint8Array, count: number): number[] {
  const syndromes: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const alpha = gfPow(i);
    let value = 0;
    for (let k = 0; k < codeword.length; k += 1) {
      value = gfMultiply(value, alpha) ^ (codeword[k] ?? 0);
    }
    syndromes.push(value);
  }
  return syndromes;
}

/** 供用例与调试读取的域表快照(不暴露可变表本体) */
export function gfTables(): { exp: Uint8Array; log: Uint8Array } {
  return { exp: GF_EXP.slice(0, 256), log: GF_LOG.slice() };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
