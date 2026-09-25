// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 历史基线快照 —— 见文件头说明,禁止演进。

/**
 * 端内手搓的 `toJsonProperty` —— 「发给 provider 的 function parameters」在被 A13 投影器替换**之前**的产出路径。
 *
 * 取材(逐字,不做任何现代化改写):
 *   git show dd5142f2255^:apps/cli/src/tools/index.ts
 *   - 函数体 = 该版本第 529-540 行
 *   - parameters 组装 = 该版本 `toolsToProviderSchema` 第 546-565 行的 map 体
 *
 * 唯一用途:`apps/cli/tests/a13-projection-equivalence.test.ts` 的 **A/B 旧侧**。
 * 它是"旧实现长什么样"的入库证据,不是"希望旧实现长什么样"的自由发挥。
 *
 * ⚠️ 禁止演进:不得为了让等价性测试变绿而修改本文件 —— 那等于把断言改写成愿望。
 *    生产代码里已不存在这份实现(A13 已删),也不得加回(AGENTS.md §5「禁止端内手搓 parameters 对象」)。
 */
import type { ToolParameter } from '../../src/tools/index.js'

/** 旧侧的最小工具形状:只有 parameters / required 参与 A/B */
export interface LegacyProjectableTool {
  name: string
  parameters: Record<string, ToolParameter>
  required: string[]
}

/** 旧侧出口形态:与历史 `ProviderToolSchema['function']['parameters']` 同形 */
export interface LegacyParameters {
  type: 'object'
  properties: Record<string, unknown>
  required: string[]
}

/** 把单个 ToolParameter 递归转换为 JSON Schema(深拷贝,不共享引用) */
export function toJsonProperty(p: ToolParameter): Record<string, unknown> {
  const prop: Record<string, unknown> = { type: p.type, description: p.description }
  if (p.enum) prop.enum = [...p.enum]
  if (p.items) prop.items = toJsonProperty(p.items)
  if (p.properties) {
    const props: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(p.properties)) props[k] = toJsonProperty(v)
    prop.properties = props
  }
  if (p.required) prop.required = [...p.required]
  return prop
}

/**
 * 历史 `toolsToProviderSchema` 里 `function.parameters` 的组装段(第 552-561 行原样搬运)。
 * 单独导出是为了让 A/B 的旧侧**只**由历史代码构成,不含任何本会话新写的逻辑。
 */
export function legacyBuildParameters(tool: LegacyProjectableTool): LegacyParameters {
  const properties: Record<string, unknown> = {}
  for (const [name, p] of Object.entries(tool.parameters)) {
    properties[name] = toJsonProperty(p)
  }
  return {
    type: 'object' as const,
    properties,
    required: [...tool.required],
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
