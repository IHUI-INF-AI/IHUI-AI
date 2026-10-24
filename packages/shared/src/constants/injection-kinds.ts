// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 注入来源 kind 单一真相源(D34 + D120)。
 *
 * `injection_applied` 帧的 kind 只作"取哪条本地化文案"的键:界面措辞一律出自各端词表,
 * 后端 `collapsed` 只在未知 kind 时兜底 —— 直接渲染后端中文会让 en/ja/ko 看到中文。
 *
 * 为什么必须单源:此前同一份 kind 在 web 聚合条、`@ihui/ui-react` 单条交代各抄一份字面量,
 * D120 新增 `iteration_extension` 只补了 web 一处,其余消费方(u-react → web 单条条 /
 * extension)仍按 4 值判断,于是这条交代被当成未知 kind 回落成后端中文。
 * 改 kind 只改本文件;`@ihui/ui-react` 与 apps/web 都从这里取,不再各自声明。
 */

/** 与后端 `apps/ai-service/app/routers/llm.py` 的 injection_frames 发射点一一对应 */
export const INJECTION_KINDS = [
  'developer_instructions',
  'workspace_memory',
  'repo_wiki',
  'auto_context',
  'iteration_extension',
] as const

/** 注入来源 kind(闭集;未知 kind 在展示层回落 `collapsed`) */
export type InjectionKind = (typeof INJECTION_KINDS)[number]

/**
 * kind → 词表键。web 用 `ai.pane` 命名空间;extension 把同一个键投影进自己的 `chat`
 * 命名空间(`t={(k) => t('chat.' + k)}`)⇒ 两端共用这一份,词条仍各端自持。
 * `satisfies` 是关键:新增 kind 忘了配词表键,当场编译失败(而不是运行时静默回落)。
 */
export const INJECTION_KIND_KEYS = {
  developer_instructions: 'injectionKindDeveloper',
  workspace_memory: 'injectionKindWorkspace',
  repo_wiki: 'injectionKindRepoWiki',
  auto_context: 'injectionKindAutoContext',
  iteration_extension: 'injectionKindIterationExtension',
} as const satisfies Readonly<Record<InjectionKind, string>>

/**
 * 取 kind 对应词表键。未知 kind 返回 `undefined`(调用方回落 `collapsed`),
 * 且走 `hasOwnProperty` —— 否则 `kind = 'toString'` 会从原型链上取到函数当文案。
 */
export function injectionKindKey(kind: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(INJECTION_KIND_KEYS, kind)
    ? INJECTION_KIND_KEYS[kind as InjectionKind]
    : undefined
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
