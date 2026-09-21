// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * #21 流内实时 token 用量估算(2026-09-15 立):
 * 流式输出过程中,后端权威 usage 在流末尾(onUsage)才到达,此模块依据「已生成文本」
 * 即时估算 completion tokens,UI 先行以半透明徽章(estimated)展示,流结束权威值到达后被覆盖。
 * 估算公式:cjk 字符 ×0.6 + 其他字符 /4,向上取整(自实现 cjk 计数,不依赖外部库)。
 */
export interface LiveUsageEstimate {
  promptTokens?: number
  completionTokens: number
  /** 标记为前端估算值,区别于后端权威 usage */
  estimated: true
}

/** 自实现 CJK 码点判定(覆盖中日韩统一表意文字 / 扩展 A / 兼容 / 平假名片假名 / 谚文 / 全角形) */
function isCjkCodePoint(cp: number): boolean {
  return (
    (cp >= 0x3000 && cp <= 0x303f) || // CJK 符号与标点
    (cp >= 0x3040 && cp <= 0x30ff) || // 平假名 + 片假名
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK 扩展 A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK 统一表意文字
    (cp >= 0xac00 && cp <= 0xd7af) || // 谚文音节
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK 兼容表意文字
    (cp >= 0xff00 && cp <= 0xffef) // 半角全角形
  )
}

/**
 * 依据已生成文本估算 token 用量。
 * @param generatedText 本流截至当前的累计生成文本(用于 CJK 字符计数)
 */
export function estimateLiveUsage(generatedText: string): LiveUsageEstimate {
  let cjk = 0
  let other = 0
  // 按码点遍历,正确处理代理对(1 个码点 = 1 字符)
  for (const ch of generatedText) {
    const cp = ch.codePointAt(0) ?? 0
    if (isCjkCodePoint(cp)) cjk += 1
    else other += 1
  }
  const completionTokens = Math.ceil(cjk * 0.6 + other / 4)
  return { completionTokens, estimated: true }
}
