// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 会话行级动作出口(2026-10-28 立,工作台片A 抽自 conversation-list)。
 *
 * 六个单行 mutation(删除/收藏/置顶/归档/取消归档/重命名)的 API 面 + 乐观更新 +
 * 失效面唯一实现:history 页的 ConversationList 与 /chat/workbench 的 rail 同连此处,
 * 不再各写一份(§0.6)。失效键 ['chat','conversations'] / ['chat','favorites'] 为
 * 全仓共享契约(取数面 useWorkbenchConversations/侧栏/历史页同键)。
 *
 * 页特异动作(导出下载/压缩/批量/org 归类)仍留在 conversation-list —— 那是历史管理页
 * 的承载面,不是"多宿主行操作",抽出来只会把页面态拖进共享件。
 *
 * toast 文案取词与来源实现逐字同口径:tc=aiChat('deleteFailed'/'toast.pinFailed')。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { archiveConversation, setConversationPinned, unarchiveConversation } from '@ihui/api-client'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { Conversation } from '@/components/chat/conversation-list'

export function useConversationRowActions() {
  const queryClient = useQueryClient()
  const { error } = useToast()
  const tc = useTranslations('aiChat')

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] }),
      queryClient.invalidateQueries({ queryKey: ['chat', 'favorites'] }),
    ])

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.success) throw new Error(res.error)
      return res
    },
    onSuccess: () => invalidateAll(),
    onError: (err: Error) => {
      error(err.message || tc('deleteFailed'))
    },
  })

  // P1 乐观更新(2026-07-23):收藏/归档即时反馈,不等 API 返回
  const favMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}/favorite`, { method: 'POST' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['chat', 'conversations'] })
      await queryClient.cancelQueries({ queryKey: ['chat', 'favorites'] })
      const prevConv = queryClient.getQueryData<Conversation[]>(['chat', 'conversations'])
      const prevFav = queryClient.getQueryData<Conversation[]>(['chat', 'favorites'])
      const toggle = (list: Conversation[] | undefined) =>
        list?.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c))
      queryClient.setQueryData(['chat', 'conversations'], toggle)
      queryClient.setQueryData(['chat', 'favorites'], toggle)
      return { prevConv, prevFav }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prevConv) queryClient.setQueryData(['chat', 'conversations'], ctx.prevConv)
      if (ctx?.prevFav) queryClient.setQueryData(['chat', 'favorites'], ctx.prevFav)
    },
    onSettled: () => invalidateAll(),
  })

  // 置顶/取消置顶(2026-08-30 立):乐观更新 pinned,刷新会话列表(后端排序置顶优先)
  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      setConversationPinned(id, pinned),
    onMutate: async ({ id, pinned }) => {
      await queryClient.cancelQueries({ queryKey: ['chat', 'conversations'] })
      await queryClient.cancelQueries({ queryKey: ['chat', 'favorites'] })
      const prevConv = queryClient.getQueryData<Conversation[]>(['chat', 'conversations'])
      const prevFav = queryClient.getQueryData<Conversation[]>(['chat', 'favorites'])
      const apply = (list: Conversation[] | undefined) =>
        list?.map((c) => (c.id === id ? { ...c, pinned } : c))
      queryClient.setQueryData(['chat', 'conversations'], apply)
      queryClient.setQueryData(['chat', 'favorites'], apply)
      return { prevConv, prevFav }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prevConv) queryClient.setQueryData(['chat', 'conversations'], ctx.prevConv)
      if (ctx?.prevFav) queryClient.setQueryData(['chat', 'favorites'], ctx.prevFav)
      error(tc('toast.pinFailed'))
    },
    onSettled: () => invalidateAll(),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveConversation(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['chat', 'conversations'] })
      await queryClient.cancelQueries({ queryKey: ['chat', 'favorites'] })
      const prevConv = queryClient.getQueryData<Conversation[]>(['chat', 'conversations'])
      const prevFav = queryClient.getQueryData<Conversation[]>(['chat', 'favorites'])
      const remove = (list: Conversation[] | undefined) => list?.filter((c) => c.id !== id)
      queryClient.setQueryData(['chat', 'conversations'], remove)
      queryClient.setQueryData(['chat', 'favorites'], remove)
      return { prevConv, prevFav }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prevConv) queryClient.setQueryData(['chat', 'conversations'], ctx.prevConv)
      if (ctx?.prevFav) queryClient.setQueryData(['chat', 'favorites'], ctx.prevFav)
    },
    onSettled: () => invalidateAll(),
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => unarchiveConversation(id),
    onSuccess: () => invalidateAll(),
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => invalidateAll(),
  })

  return {
    invalidateAll,
    deleteMutation,
    favMutation,
    pinMutation,
    archiveMutation,
    unarchiveMutation,
    renameMutation,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
