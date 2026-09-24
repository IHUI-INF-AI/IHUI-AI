// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展侧 adapter：把句柄族动词接进 content script 的执行面。
 *
 * 为什么端内还要这么一小层（而不是直接让 background 调共享包）：
 * 句柄是**某一个文档**里的活引用，跨标签页/跨导航使用必然错。扩展的转发链
 * （background → 当前 active tab 的 content script）在应答里必须带上"这批句柄属于哪个文档"，
 * 调用方才有可能把后续动作钉回同一页面 —— 这与 web 桥的 instanceId 是同一个问题。
 * 除这一层文档身份标注外，动作执行完全走 @ihui/dom-actions，端内不复制第二份语义。
 */
import {
  buildPageApiInstallExpression,
  executeDomAction,
  isPageAction,
  pageApiState,
  type DomActionResult,
  type PageActionType,
} from '@ihui/dom-actions'

/**
 * 注入表达式的**唯一装配点在共享包**（`@ihui/dom-actions`），这里只做 re-export。
 *
 * 本端当前的装载路径是页内 `import` 同一个安装函数（见 `installPageApi()`），不经表达式；
 * 但一旦有"把安装函数送进另一个 world / 另一个文档"的需求，必须用下面这个入口，
 * **不得在端内自己拼 `(${source})(${json})`** —— `.toString()` 取来的源取决于宿主用哪种打包器
 * （esbuild keepNames 会插入住在模块作用域里的 `__name`），两端各拼一次的后果是
 * "扩展好的、CLI 坏的"这类最难查的分叉。
 */
export { buildPageApiInstallExpression }

export interface PageActionEnvelope extends DomActionResult {
  data?: Record<string, unknown>
}

/**
 * 在**当前文档**执行一个句柄族动词。
 *
 * 非页内环境（service worker / Node）下共享包会返回 `PAGE_API_UNAVAILABLE` 且
 * `sideEffect: 'none'` —— 这里原样透出并补上文档身份（此时 scope 为 null，
 * 明确表示"没有任何句柄可用"），不把它粉饰成执行失败。
 */
export async function executePageActionInThisDocument(
  action: string,
  params: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<PageActionEnvelope> {
  if (!isPageAction(action)) {
    return {
      success: false,
      errorCode: 'UNSUPPORTED_ACTION',
      error: `not a page-handle action: ${action}`,
      data: { sideEffect: 'none' },
    }
  }
  const result = await executeDomAction(action as PageActionType, params, timeoutMs)
  const state = pageApiState()
  return {
    ...result,
    data: {
      ...(result.data ?? {}),
      pageScope: state.scope,
      pageHandles: state.handles,
      pageUrl: typeof location === 'undefined' ? '' : location.href,
    },
  }
}

/** 供 background 与测试复用的判据：这个动词是否属于句柄族。 */
export { isPageAction }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
