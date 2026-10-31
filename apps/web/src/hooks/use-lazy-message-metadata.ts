// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D35 metadata 懒取状态机(2026-10-31 立)。
 *
 * 消息列表读面只回九类过程信息的摘要(`@ihui/shared/chat` 的
 * `ChatMetadataKindSummary`)。展开位在需要全文时才调用本钩子,按
 * (conversationId, messageId) 取该条消息的完整 metadata。
 *
 * 平台特有:依赖 React 生命周期与 web 端 `@ihui/api-client` 单例注入
 * (`apps/web/src/lib/api.ts`),故留在端内而非共享层。
 *
 * 三条不可漂的语义:
 *  ① 状态是**码**(idle/loading/ready/failed),文案归 i18n —— 本层不写中文字面量;
 *  ② `failed` 允许重试(再点展开会重新发起),但绝不落成 `ready`:
 *     取不到 ≠ 该消息没有 metadata,把失败说成空是丢证据;
 *  ③ 每次 fetch 只一条消息,不批量 —— 懒取若做成列表级二次全量,等于把摘要化收益还回去。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getMessageMetadata } from '@ihui/api-client'

export type LazyMetadataStatus = 'idle' | 'loading' | 'ready' | 'failed'

export interface LazyMessageMetadataResult {
  status: LazyMetadataStatus
  /** `ready` 时的完整 metadata;其余状态恒 null(不用摘要冒充全文)。 */
  metadata: Record<string, unknown> | null
  /** 幂等:loading / ready 时再调用不重复发请求;failed 可重试。 */
  load: () => void
}

export function useLazyMessageMetadata(
  conversationId: string | null | undefined,
  messageId: string,
): LazyMessageMetadataResult {
  const [status, setStatus] = useState<LazyMetadataStatus>('idle')
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
  // 放 ref 而不只靠 state:展开按钮可能在同一个事件里连点两次,
  // 读异步 setState 的旧状态会重复发起(与 use-chat-history-projection 的游标同一处置)。
  const statusRef = useRef<LazyMetadataStatus>('idle')

  // 换会话 / 换消息时整组作废(MessageItem 按 message.id 复用组件实例)。
  useEffect(() => {
    statusRef.current = 'idle'
    setStatus('idle')
    setMetadata(null)
  }, [conversationId, messageId])

  const load = useCallback(() => {
    if (!conversationId) return
    if (statusRef.current === 'loading' || statusRef.current === 'ready') return
    statusRef.current = 'loading'
    setStatus('loading')
    void (async () => {
      try {
        const res = await getMessageMetadata(conversationId, messageId)
        // fetchApi 回 ApiResult 判别联合:success=false 不是抛错,必须显式分流,
        // 否则 `res.data` 在失败分支是 undefined ⇒ 状态机误判成 ready。
        if (!res.success) throw new Error('metadata-load-failed')
        statusRef.current = 'ready'
        setMetadata((res.data.metadata as Record<string, unknown> | null) ?? null)
        setStatus('ready')
      } catch {
        // 失败降级为占位(不抛、不白屏);下次展开可重试。
        statusRef.current = 'failed'
        setStatus('failed')
      }
    })()
  }, [conversationId, messageId])

  return { status, metadata, load }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
