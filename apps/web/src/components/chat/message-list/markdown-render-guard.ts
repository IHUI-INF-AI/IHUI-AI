// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-825(2026-09-29 立)· 消息级 markdown 渲染守卫的**纯函数层**。
 *
 * 为什么住在这里(而不是把逻辑写在 JSX 里):边界要判的两件事都必须"能直接判"——
 *   ① 复位键的形状(streaming ⇒ 稳定键 / 完成态 ⇒ 掺内容 hash);
 *   ② 结构化 warn 的载荷(只带量,绝不带正文)。
 * 两者写进组件就成了 render 里的表达式,测试只能靠整棵树渲染去反推;
 * 命名与放置参照同目录既有纯函数辅助件(fold-policy.ts / detail-mode-filter.ts / retry-countdown.ts)。
 *
 * 复位语义本身**不在这里实现** —— 复用 `apps/web/src/components/common/ErrorBoundary.tsx`
 * 的 `resetKeys`(逐项 `Object.is`、仅变化才清错,2026-09-26 A10B-2 已入库并有自己的用例),
 * 本层只负责"喂给它的那把键长什么样"。禁止再写第二份边界语义。
 */

/** 边界捕获后派发结构化 warn 的事件名(唯一标识,便于日志聚合)。 */
export const MARKDOWN_RENDER_FAILURE_EVENT = 'markdown-render-failure'

/**
 * 本调用点交给 `MarkdownStream` 的渲染模式。
 * 取值刻意只由 `collapseLines` 推导:那是 MarkdownStream 唯一的行为开关
 * (`markdown-stream.tsx` 的 `MarkdownStreamProps.collapseLines` 文档:"<=0 表示不折叠"),
 * 与"是否在流式中"分两维,这样 warn 才答得出"是哪条渲染分支炸的"。
 */
export type MarkdownRenderMode = 'code-collapsible' | 'code-plain'

export function markdownRenderModeFor(collapseLines: number | undefined): MarkdownRenderMode {
  return collapseLines !== undefined && collapseLines > 0 ? 'code-collapsible' : 'code-plain'
}

export interface MarkdownRenderContext {
  /** 待渲染正文;**只**用于算长度与 hash,任何出口都不回传它 */
  content: string
  /** 这条消息此刻是否还在流式输出(= MessageItem 的 `streamingThis`) */
  renderStreaming: boolean
  mode: MarkdownRenderMode
}

/* FNV-1a 32 位:与 `packages/types/src/device.ts` 的 `fnv1aHash` 同一算法。
   那份是本仓唯一的 FNV 实现,但它是**模块私有**(未 export),而 device.ts 在本票禁改区,
   所以这里按同一算法自带一份并把出处写在上面 —— 不是新发明算法,是为了不复用不到那份。 */
const FNV1A_OFFSET_BASIS = 0x811c9dc5
const FNV1A_PRIME = 0x01000193

function fnv1a32Hex(input: string): string {
  let hash = FNV1A_OFFSET_BASIS
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    // Math.imul 保证 32 位溢出语义(与 device.ts 那份同因:纯 JS,不依赖 node:crypto)
    hash = Math.imul(hash, FNV1A_PRIME)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * 边界复位键。
 *
 * 流式中**必须**给恒定键(`streaming:<mode>`,不掺内容):每个 token 都会重渲染,
 * 若键里带内容 hash,就等于每个 token 复位一次 —— 边界先清错再重抛、再清错,
 * 表现是抖动 + 降级形态永远看不见(边界成了摆设)。
 * 完成态才掺内容键:此时"这条消息换了正文"是唯一能让同一实例重试的理由,
 * 长度与 hash **双量**是因为单靠 32 位 hash 会把两篇不同正文撞成"同一篇"、错误态永不复位。
 *
 * 返回**数组**是给 `ErrorBoundary.resetKeys` 直接用的形状;键内容不变而数组引用变 ⇒
 * 边界判"没变"(该项已由 ErrorBoundary 自身用例钉死,故这里每次新建数组是安全的)。
 */
export function markdownResetKeys(ctx: MarkdownRenderContext): readonly string[] {
  const { content, renderStreaming, mode } = ctx
  if (renderStreaming) return [`streaming:${mode}`]
  return [`done:${mode}:${content.length}:${fnv1a32Hex(content)}`]
}

export interface MarkdownRenderFailureFacts {
  event: typeof MARKDOWN_RENDER_FAILURE_EVENT
  markdownLength: number
  mode: MarkdownRenderMode
  renderStreaming: boolean
}

/**
 * 结构化 warn 载荷:三条量,零条正文。
 * 上报面不落用户正文是与本仓脱敏链(crash_reports 发射前一律过 `redactCrashText`)同一条纪律 ——
 * markdown 渲染失败时"正文里有什么"往往正是可疑输入,把它写进日志等于把聊天内容寄出去。
 */
export function markdownRenderFailureFacts(ctx: MarkdownRenderContext): MarkdownRenderFailureFacts {
  return {
    event: MARKDOWN_RENDER_FAILURE_EVENT,
    markdownLength: ctx.content.length,
    mode: ctx.mode,
    renderStreaming: ctx.renderStreaming,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
