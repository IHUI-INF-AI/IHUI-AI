// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超级智能体工人的服务端工作目录解析。
 *
 * 单一真相源：roles.executionFor 只产出**逻辑目录**(`super-agent/<owner>/<ticket>`),
 * 真正落盘的位置由本模块统一决定 —— 根目录来自 IHUI_SUPER_AGENT_WORKSPACE_ROOT,
 * 未配置时落在当前工作目录下的 `.ihui-agent/super-agent`。
 *
 * 纪律:
 *  - 逻辑目录必须是相对路径且不得逃逸根目录(拒绝绝对路径、`..`、空串);
 *  - 只有本模块做「逻辑 → 绝对」映射,调用方不再自己拼路径(避免两套规则);
 *  - 目录在派发前就建好:执行器拿到的是可写绝对路径,而不是 prompt 里一句口头约束。
 */
import { mkdirSync } from 'node:fs'
import { isAbsolute, resolve, sep } from 'node:path'

const SUPER_AGENT_WORKSPACE_ROOT_ENV = 'IHUI_SUPER_AGENT_WORKSPACE_ROOT'

/** 工人目录根:env 优先,否则 `<cwd>/.ihui-agent/super-agent`(与 team-artifacts 同层落点)。 */
function superAgentWorkspaceRoot(): string {
  const configured = (process.env[SUPER_AGENT_WORKSPACE_ROOT_ENV] ?? '').trim()
  return configured.length > 0
    ? resolve(configured)
    : resolve(process.cwd(), '.ihui-agent', 'super-agent')
}

/** 同一路径根的包含判定;Windows 盘符/大小写不敏感,统一按小写比较。 */
function isInside(root: string, target: string): boolean {
  const normalize = (p: string): string => (process.platform === 'win32' ? p.toLowerCase() : p)
  const r = normalize(root)
  const t = normalize(target)
  return t === r || t.startsWith(`${r}${sep}`)
}

/** 逻辑目录 → 服务端绝对路径;非法输入直接抛错(调用方转 deliveryFailed,不静默兜底)。 */
function resolveWorkerDirectory(logical: string): string {
  const trimmed = logical.trim()
  if (trimmed.length === 0) throw new Error('worker directory is empty')
  if (isAbsolute(trimmed)) throw new Error('worker directory must be relative')
  const root = superAgentWorkspaceRoot()
  const absolute = resolve(root, trimmed)
  if (!isInside(root, absolute)) throw new Error('worker directory escapes workspace root')
  return absolute
}

/** 解析并建目录(递归),返回可写绝对路径。幂等:已存在不报错。 */
export function materializeWorkerDirectory(logical: string): string {
  const absolute = resolveWorkerDirectory(logical)
  mkdirSync(absolute, { recursive: true })
  return absolute
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
