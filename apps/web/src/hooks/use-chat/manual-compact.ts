// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// D117 /compact 斜杠命令(G-231)配套抽取:手动压缩上下文的单一实现。
// 原实现内联在 message-input.tsx handleCompact(2026-09-02 立),/compact 命令需要
// 同一语义 —— 按「不复制实现」抽为纯异步函数,输入框按钮与斜杠命令两处消费。
// isStreaming 守卫在本函数内读 store(调用方无需重复判断);compacting 这类
// 输入框本地 UI 态仍归调用方(message-input 持有按钮 loading,斜杠命令无 UI 态)。

import { toast } from '@/components/common'
import { compactConversation, getMessages } from '@ihui/api-client'
import { useChatStore } from '@/stores/chat'

/** 压缩结果语义(与后端 reason 对齐;failed = 网络/服务端错误) */
export type ManualCompactOutcome = 'ok' | 'too_few' | 'incompressible' | 'skipped' | 'failed'

type CompactTranslator = (key: string, vars?: Record<string, string>) => string

/**
 * 执行手动压缩(POST /api/chat/compact)并给出 toast 反馈;成功后重拉会话消息。
 *
 * - conversationId 缺失或正在流式 → 'skipped'(不弹错误,调用方无感);
 * - 消息重拉仅在仍处于同一会话时写回 store(与 send-message.ts 压缩兜底同规)。
 */
export async function runManualCompact(
  conversationId: string | null,
  t: CompactTranslator,
): Promise<ManualCompactOutcome> {
  if (!conversationId) return 'skipped'
  if (useChatStore.getState().isStreaming) return 'skipped'
  try {
    const res = await compactConversation(conversationId)
    if (res.success && res.data) {
      if (res.data.compressed) {
        toast.success(
          t('compaction.compactSuccess', {
            before: String(res.data.originalTokens),
            after: String(res.data.compressedTokens),
            saved: String(Math.max(0, res.data.originalTokens - res.data.compressedTokens)),
          }),
        )
        const result = await getMessages(conversationId, { direction: 'initial', pageSize: 100 })
        if (
          result.success &&
          result.data &&
          useChatStore.getState().conversationId === conversationId
        ) {
          useChatStore.getState().setMessages(
            result.data.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: new Date(m.createdAt).getTime(),
              model: '',
              reasoning: m.reasoning,
            })),
          )
        }
        return 'ok'
      }
      if (res.data.reason === 'too_few_messages') {
        toast.info(t('compaction.compactTooFew'))
        return 'too_few'
      }
      toast.info(t('compaction.compactIncompressible'))
      return 'incompressible'
    }
    toast.error(t('compaction.compactFailed'), {
      description: res.success ? undefined : res.error,
    })
    return 'failed'
  } catch (e) {
    const msg = (e as Error).message || t('compaction.compactFailed')
    toast.error(t('compaction.compactFailed'), { description: msg })
    return 'failed'
  }
}
