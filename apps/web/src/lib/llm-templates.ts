/**
 * Provider → LLM 模板代码映射
 *
 * 用于 model-selector 根据 model vendor 字段判断当前模型是否已配置(查 LLM 配置中心)。
 *
 * 2026-07-19 临时 stub:此文件缺失导致 dev server 编译失败(MODULE_NOT_FOUND),
 * 先用 identity 映射(直接返回 vendor 字符串)让 build 通过,后续 PR 补全完整映射表。
 */
export function providerToTemplateCode(vendor: string | null | undefined): string | null {
  if (!vendor) return null
  // stub:直接返回小写 vendor 作为 templateCode,后续按需扩展
  return vendor.toLowerCase()
}
