// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管 · AI 面板形态(2026-11-28 用户定档)。
 *
 * 用户明确不要独立的总管整页:总管是现有 AI 面板里的一种内容形态,
 * 工作台 / 智能体 / 待你确认则是它右侧工作展示区里的面板。
 * 这一层只做三件事:
 *  1. 顶部身份胶囊(复用 MasterIdentityHeader,名字可改);
 *  2. 三枚去工作区的入口(今日 / 总管创建的智能体 / 待你确认),点开走现有工作区,
 *     不在面板里再造一套表格式后台;
 *  3. 对话主体复用 MasterChatPanel,按 400–720px 窄面板留白。
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, ShieldCheck, Users } from 'lucide-react'

import { MasterChatPanel } from './MasterChatPanel'
import { MasterIdentityHeader } from './MasterIdentityHeader'
import { useAiPanelStore } from '@/stores/ai-panel'

interface MasterProfileView {
  displayName: string
  defaultDisplayName?: string
  maxLength?: number
  isCustom?: boolean
}

interface ApiBody<T> {
  code: number
  message: string
  data?: T
}

const DEFAULT_MASTER_NAME = '总管'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(init?.headers ?? {}),
    },
  })
  const body = (await response.json()) as ApiBody<T>
  if (!response.ok || body.code !== 0) throw new Error(body.message || `HTTP ${response.status}`)
  return body.data as T
}

export function MasterAssistantPanel() {
  const masterSessionId = useAiPanelStore((state) => state.masterSessionId)
  const setMasterSessionId = useAiPanelStore((state) => state.setMasterSessionId)
  const [masterName, setMasterName] = useState(DEFAULT_MASTER_NAME)
  const [maxLength, setMaxLength] = useState(24)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const profile = await api<MasterProfileView>('/api/master/profile')
        if (!alive) return
        setMasterName(profile.displayName || DEFAULT_MASTER_NAME)
        if (profile.maxLength) setMaxLength(profile.maxLength)
      } catch {
        // 未登录/接口暂不可用时保持默认名,不阻断对话。
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    const loadPending = async () => {
      try {
        const result = await api<{ items?: Array<{ id: string }> }>(
          '/api/agent-registry/approvals?status=pending&limit=20',
        )
        if (alive) setPending((result.items ?? []).length)
      } catch {
        if (alive) setPending(0)
      }
    }
    void loadPending()
    const timer = window.setInterval(() => void loadPending(), 30_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  async function renameMaster(next: string) {
    const profile = await api<MasterProfileView>('/api/master/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName: next }),
    })
    setMasterName(profile.displayName || next)
    if (profile.maxLength) setMaxLength(profile.maxLength)
  }

  async function resetMaster() {
    const profile = await api<MasterProfileView>('/api/master/profile', { method: 'DELETE' })
    setMasterName(profile.displayName || DEFAULT_MASTER_NAME)
    if (profile.maxLength) setMaxLength(profile.maxLength)
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-white" data-testid="master-assistant-panel">
      <MasterIdentityHeader
        name={masterName}
        maxLength={maxLength}
        onRename={renameMaster}
        onReset={resetMaster}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-4 pb-1 pt-3">
        <Link
          href="/master"
          data-testid="master-open-today"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#e7e2d8] bg-[#fbfaf7] px-3 py-1.5 text-[12px] text-[#5e574d] transition hover:border-[#d8d0c2] hover:bg-white hover:text-[#2c2823]"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          今日
        </Link>
        <Link
          href="/master/agents"
          data-testid="master-open-agents"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#e7e2d8] bg-[#fbfaf7] px-3 py-1.5 text-[12px] text-[#5e574d] transition hover:border-[#d8d0c2] hover:bg-white hover:text-[#2c2823]"
        >
          <Users className="h-3.5 w-3.5" />
          总管创建的智能体
        </Link>
        <Link
          href="/master/approvals"
          data-testid="master-open-approvals"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#e7e2d8] bg-[#fbfaf7] px-3 py-1.5 text-[12px] text-[#5e574d] transition hover:border-[#d8d0c2] hover:bg-white hover:text-[#2c2823]"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          待你确认
          {pending > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f0e0c8] px-1 text-[10px] tabular-nums text-[#8b5e20]">
              {pending}
            </span>
          )}
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        <MasterChatPanel
          masterName={masterName}
          initialSessionId={masterSessionId ?? undefined}
          onSessionIdChange={setMasterSessionId}
        />
      </div>
    </section>
  )
}
