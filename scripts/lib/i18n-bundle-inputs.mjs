// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n-bundle-inputs.mjs —— 小程序离线包「钉输入清单」的唯一构造规则
 *
 * 一层规则,两处消费者(scripts/gen-i18n-compressed.mjs 写钉 / scripts/check-miniapp-generated.mjs 现算钉)。
 * 立因(2026-10-27 实测):承载层(2026-10-26 立)给生成器加了第三层输入,门没跟 —— 门按两层现算,
 * 于是钉里那 4 条 `mobile-rn/*.json` 被报成「面上 ABSENT」,守门 105 的 G5 从此**在完好仓库上恒红**。
 * 「ABSENT」这个词在这里说的不是"文件不在盘上",而是"门自己的清单里没有它" —— 判据失效的表现照旧是安静。
 *
 * has() 必须是**同一个被审面**上的存在性判断(§0.4 同面同轮):生成器用它决定要不要把承载层算进钉,
 * 门用它决定要不要按那份面的字节现算承载层。两侧各列一遍清单必然漂,所以清单只在这里列一次。
 */

export const MESSAGES_REL = 'packages/i18n/messages'

/** 基础层(全端共用文案) */
export function baseSourceRel(locale) {
  return `${MESSAGES_REL}/shared/${locale}.json`
}
/** 端内覆盖层(小程序自己的措辞,优先级高于基础层) */
export function overrideSourceRel(locale) {
  return `${MESSAGES_REL}/miniapp-taro/${locale}.json`
}
/** 承载层源(RN 词包 —— 承载页可达而端内没有的键从这里补) */
export function carriedSourceRel(locale) {
  return `${MESSAGES_REL}/mobile-rn/${locale}.json`
}

/**
 * 某组语言的离线包钉输入清单。
 * 前两层恒在(缺一份 ⇒ 生成器 exit 2,不许"那就少算一份");
 * 承载层是**增强层**:面上没有 RN 词包时它不算一份输入(生成器显式跳过并在产物里记 carried:skipped)。
 * @param {string[]} locales
 * @param {(rel:string)=>boolean} has 被审面上的存在性
 * @returns {string[]} 仓库根相对路径(顺序不参与哈希 —— digestInputs 按 rel 排序)
 */
export function bundleInputRels(locales, has) {
  const out = []
  for (const locale of locales) {
    out.push(baseSourceRel(locale), overrideSourceRel(locale))
    const carried = carriedSourceRel(locale)
    if (has(carried)) out.push(carried)
  }
  return out
}

/** 需要预取的承载层源(批量读必须先知道候选集,存在性留给 bundleInputRels 判) */
export function carriedSourceRelsOf(locales) {
  return locales.map((locale) => carriedSourceRel(locale))
}

export const __test__ = {
  MESSAGES_REL,
  baseSourceRel,
  overrideSourceRel,
  carriedSourceRel,
  bundleInputRels,
  carriedSourceRelsOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
