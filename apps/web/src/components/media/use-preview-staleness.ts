// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

/**
 * 文件预览的"内容身份"状态机(D90 / G-123)。
 *
 * 要解决的问题:预览只读一次,之后文件可能被改掉,而界面仍在展示先前那次读取的结果。
 * 旧实现只有"读到 / 没读到"两态,读不到时把整块内容换成一句错误,用户既丢了正在看的
 * 内容,也无从判断"我看到的这份还是不是当前文件"。
 *
 * 这里把可见内容拆成两个正交事实:
 *  - `content` + `readAt`:界面此刻展示什么、它是**什么时候**读到的;
 *  - `isRecord`:它是不是历史快照(工具记录内容)而不是当前文件。
 * 快照态的产生只有两条真实路径:重读失败(退回展示已记录的内容)、重读到 0 字节
 * (这次变更没记全)。没有"投机分支"——不存在既无记录又自称快照的状态。
 *
 * 触发重读的真实信号:标签页重新可见(`visibilitychange`)与用户点"刷新"。
 * 服务端不推送文件变更,所以这是当前数据流里唯一可得的更新线索;它覆盖"切走→改文件→
 * 切回"这一主场景,不承诺实时。
 */

/** 降级提示种类:`cannot-read` = L2,`incomplete` = L3,`no-content` = L4。 */
export type PreviewNoticeKind = 'cannot-read' | 'incomplete' | 'no-content' | null

export interface FeedState {
  readonly loading: boolean
  readonly content: string
  readonly readAt: number | null
  readonly isRecord: boolean
  readonly notice: PreviewNoticeKind
  readonly pending: string | null
}

export type ReadOutcome =
  | {
      readonly kind: 'ok'
      readonly text: string
      readonly at: number
      /** 服务端给的版本指纹(ETag / Last-Modified);空串 = 该资源无法判版本,不猜。 */
      readonly version: string
    }
  | { readonly kind: 'failed' }
  | { readonly kind: 'aborted' }

type PreviewFeedAction =
  | {
      readonly type: 'read'
      readonly outcome: ReadOutcome
      readonly mode: 'initial' | 'revalidate'
    }
  | { readonly type: 'apply-latest'; readonly at: number }
  | { readonly type: 'dismiss-updated' }
  | { readonly type: 'unavailable' }
  | { readonly type: 'reset' }

export const INITIAL_FEED_STATE: FeedState = {
  loading: true,
  content: '',
  readAt: null,
  isRecord: false,
  notice: null,
  pending: null,
}

function asCurrent(text: string, at: number): FeedState {
  return { loading: false, content: text, readAt: at, isRecord: false, notice: null, pending: null }
}

function isPristine(state: FeedState): boolean {
  return (
    state.loading &&
    state.content === '' &&
    state.readAt === null &&
    !state.isRecord &&
    state.notice === null &&
    state.pending === null
  )
}

/** 纯函数状态机:渲染级用例与单元级用例可各自钉住,不必为了断言状态而造组件。 */
export function reducePreviewFeed(prev: FeedState, action: PreviewFeedAction): FeedState {
  switch (action.type) {
    case 'reset':
      // url 变了:上一文件的记录必须作废 —— 否则会把 A 文件的内容当成 B 文件的历史快照
      return isPristine(prev) ? prev : INITIAL_FEED_STATE

    case 'unavailable':
      // 没有可寻址的 url(非文本类型复用同一钩子时传空):直接落 L4,不发任何请求
      return { ...INITIAL_FEED_STATE, loading: false, notice: 'no-content' }

    case 'apply-latest':
      if (prev.pending === null) return prev
      return asCurrent(prev.pending, action.at)

    case 'dismiss-updated':
      // 关掉提示条 ≠ 内容变回当前:仍在展示旧一次读取的结果,快照标识必须留下
      if (prev.pending === null) return prev
      return { ...prev, pending: null, isRecord: true }

    case 'read': {
      const { outcome, mode } = action
      if (outcome.kind === 'aborted') return prev
      const hasRecord = prev.content !== ''

      if (outcome.kind === 'failed') {
        if (mode === 'initial')
          return { ...INITIAL_FEED_STATE, loading: false, notice: 'no-content' }
        if (!hasRecord) return { ...prev, loading: false, notice: 'no-content' }
        // L2:当前文件读不到,但手里有上次读到的内容 —— 留住内容并明说它是记录
        return { ...prev, loading: false, isRecord: true, notice: 'cannot-read', pending: null }
      }

      if (mode === 'initial') {
        if (outcome.text === '')
          return { ...INITIAL_FEED_STATE, loading: false, notice: 'no-content' }
        return asCurrent(outcome.text, outcome.at)
      }

      if (outcome.text === prev.content) return { ...prev, pending: null }
      if (outcome.text === '') {
        if (hasRecord)
          return { ...prev, loading: false, isRecord: true, notice: 'incomplete', pending: null }
        return { ...prev, loading: false, notice: 'no-content' }
      }
      // 首读没内容(失败或空)、这次才读到 → 它本身就是当前内容,不该再套一层"已更新"
      if (!hasRecord) return asCurrent(outcome.text, outcome.at)
      return { ...prev, pending: outcome.text }
    }
  }
}

/** 2026-09-09 0-5-f 豁免确认:预览的 url 可能是外部 OSS 地址,裸 fetch 仅取纯文本;
 *  fetchApi 会向第三方注入鉴权头并按统一包装解析,不适用。 */
async function readRemoteResource(
  url: string,
  signal: AbortSignal,
  wantBody: boolean,
): Promise<ReadOutcome> {
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return { kind: 'failed' }
    const text = wantBody ? await res.text() : ''
    const version = res.headers.get('etag') ?? res.headers.get('last-modified') ?? ''
    return { kind: 'ok', text, at: Date.now(), version }
  } catch {
    if (signal.aborted) return { kind: 'aborted' }
    return { kind: 'failed' }
  }
}

export interface PreviewTextFeed {
  readonly loading: boolean
  readonly content: string
  readonly readAt: number | null
  readonly isRecord: boolean
  readonly notice: PreviewNoticeKind
  readonly fileUpdated: boolean
  readonly refresh: () => void
  readonly applyLatest: () => void
  readonly dismissFileUpdated: () => void
}

export interface PreviewFeedOptions {
  /** false = 只探"这个地址现在还能不能取到"(图片等二进制用),不读正文、不假装读全了 */
  readonly readBody?: boolean
}

/** 二进制资源没有可比对的正文,用"可取到"标记占位,状态机其余分支完全复用。 */
const READABLE_MARK = '\u0000readable'

export function usePreviewTextFeed(url: string, options?: PreviewFeedOptions): PreviewTextFeed {
  const readBody = options?.readBody !== false
  const [state, dispatch] = React.useReducer(reducePreviewFeed, INITIAL_FEED_STATE)
  const primaryRef = React.useRef<AbortController | null>(null)
  const checkRef = React.useRef<AbortController | null>(null)

  const read = React.useCallback(
    async (mode: 'initial' | 'revalidate'): Promise<void> => {
      if (!url) return
      if (mode === 'revalidate' && (primaryRef.current || checkRef.current)) return
      const controller = new AbortController()
      if (mode === 'initial') {
        primaryRef.current?.abort()
        primaryRef.current = controller
      } else {
        checkRef.current = controller
      }
      const outcome = await readRemoteResource(url, controller.signal, readBody)
      if (mode === 'initial') {
        if (primaryRef.current === controller) primaryRef.current = null
      } else if (checkRef.current === controller) {
        checkRef.current = null
      }
      dispatch({
        type: 'read',
        mode,
        outcome:
          readBody || outcome.kind !== 'ok'
            ? outcome
            : { ...outcome, text: outcome.version || READABLE_MARK },
      })
    },
    [url, readBody],
  )

  React.useEffect(() => {
    dispatch({ type: 'reset' })
    if (!url) {
      dispatch({ type: 'unavailable' })
      return
    }
    void read('initial')
    return () => {
      primaryRef.current?.abort()
      primaryRef.current = null
    }
  }, [read])

  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) return
      void read('revalidate')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      checkRef.current?.abort()
      checkRef.current = null
    }
  }, [read])

  return {
    loading: state.loading,
    content: state.content,
    readAt: state.readAt,
    isRecord: state.isRecord,
    notice: state.notice,
    fileUpdated: state.pending !== null,
    refresh: () => void read('revalidate'),
    applyLatest: () => dispatch({ type: 'apply-latest', at: Date.now() }),
    dismissFileUpdated: () => dispatch({ type: 'dismiss-updated' }),
  }
}

export interface PreviewMediaProbe {
  readonly readAt: number | null
  readonly isRecord: boolean
  readonly notice: PreviewNoticeKind
  readonly refresh: () => void
}

/**
 * 非文本资源(图片等)的内容身份:只有"取到 / 取不到"两种事实,没有正文可比,
 * 所以不渲染"文件已更新"提示条(没有可执行的"应用最新"动作),探不到时一律按
 * L2(有历史记录)或 L4(什么都没有)说话。
 */
export function usePreviewMediaProbe(url: string): PreviewMediaProbe {
  const feed = usePreviewTextFeed(url, { readBody: false })
  return {
    readAt: feed.readAt,
    isRecord: feed.isRecord,
    notice: feed.notice === 'incomplete' ? 'cannot-read' : feed.notice,
    refresh: feed.refresh,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
