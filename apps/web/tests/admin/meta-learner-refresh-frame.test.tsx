// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /admin/meta-learner「重新扫描记忆源」入口 —— 控制帧 `refresh_memory` 的前端侧证明
 * (2026-10-28 立)
 *
 * 立因:D141 正本 §1.7 把 `refresh_memory` 判为**真缺**(2026-10-01 二轮否证:
 * 全仓只命中 `agent_longterm_memory.py:278` 的内部 `refresh updated_at`,不是运行时刷新帧),
 * 竞品原帧是
 * `async refreshMemory(){await this.requireSdkMemoryEnabled(),
 *  await this.request({type:"refresh_memory"})}`
 * —— 即「宿主显式调用 + **必须回报结果**」。
 *
 * 本档钉两条纪律:
 * ① **读失败 ≠ 空**:重扫失败时必须把服务端给的 error 载荷显示出来,并保留刷新前的
 *    总数 —— 把「读不到」报成「没有记忆」是这一族最典型的谎报(与 G-748 同型口径,
 *    不得改回)。前端不许把 refreshed=false 的回执渲染成「刷新成功」。
 * ② **差额必须可见**:added/removed/changed 三个名单与各自数量都要显式渲染,
 *    否则用户无从判断「改了到底生效没有」。
 *
 * 纪律(AGENTS §22c 镜像测试纪律):本文件**不 mock next-intl**,而是挂**真的
 * NextIntlClientProvider + 真词包**(zh-CN.json),并从真词包里取期望文案 ——
 * 否则"文案里的数字 === 真实计数"这条只是在复读测试自己的替身。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshMemory } from '@ihui/api-client/endpoints/control-frames'

const apiOrThrowMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({
  apiOrThrow: apiOrThrowMock,
}))

vi.mock('@ihui/api-client/endpoints/control-frames', () => ({
  refreshMemory: vi.fn(),
}))

vi.mock('@/components/common', () => ({
  BackButton: () => null,
}))

import MetaLearnerPage from '../../app/(main)/admin/meta-learner/page'

const here = dirname(fileURLToPath(import.meta.url))
// tests/admin → tests → web(apps/web) → packages/i18n/messages/web
const MESSAGES_FILE = join(here, '../../../../packages/i18n/messages/web/zh-CN.json')

type Messages = Record<string, unknown>
const messages = JSON.parse(readFileSync(MESSAGES_FILE, 'utf8')) as Messages

const metaLearner = (messages.eduAi as Messages).metaLearner as Messages as Record<string, string>

/** 从真词包取词条(刻意不抄字面量 —— 抄一份就成了"测试替身自证")。 */
const w = (key: string): string => metaLearner[key] ?? ''

/** 把真词包里的 ICU 占位按给定值填成期望文案。 */
const fill = (template: string, vars: Record<string, string>): string =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), template)

const refreshMemoryMock = vi.mocked(refreshMemory)

/** 页面四个只读 query 的兜底回包(与本判据无关,但不许让它们在渲染期炸)。 */
function stubReadQueries(): void {
  apiOrThrowMock.mockImplementation(async (url: string) => {
    if (url.includes('/status')) {
      return {
        learner: { totalLessons: 2, byType: {}, avgConfidence: 0.5 },
        scheduler: {
          enabled: true,
          intervalSeconds: 60,
          minFailures: 3,
          running: false,
          historyCount: 0,
        },
        skillEvolution: {
          enabled: true,
          intervalSeconds: 60,
          minFailures: 3,
          maxSkillsPerRun: 5,
          running: false,
          historyCount: 0,
        },
      }
    }
    if (url.includes('/lessons')) return { lessons: [] }
    if (url.includes('/history')) return { history: [] }
    if (url.includes('/agent-failures')) {
      return {
        agentErrors: { total: 0, byType: {} },
        toolFailures: { total: 0, byType: {} },
        failedCheckpoints: 0,
        recent: [],
      }
    }
    return {}
  })
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="zh-CN" messages={messages}>
        <MetaLearnerPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

describe('/admin/meta-learner 重新扫描入口(控制帧 refresh_memory)', () => {
  beforeEach(() => {
    apiOrThrowMock.mockReset()
    stubReadQueries()
    refreshMemoryMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('点了"重新扫描"要真的调帧,不是静默按钮', async () => {
    refreshMemoryMock.mockResolvedValue({
      success: true,
      data: {
        refreshed: true,
        added: [],
        removed: [],
        changed: [],
        unchanged: 2,
        before: 2,
        totalLessons: 2,
        loadState: 'loaded',
      },
    })

    renderPage()
    fireEvent.click(await screen.findByTestId('meta-learner-refresh'))

    await waitFor(() => {
      expect(refreshMemoryMock).toHaveBeenCalledTimes(1)
    })
  })

  it('成功态必须把差额(新增/移除/更新)与刷新前后总数显式渲染出来', async () => {
    refreshMemoryMock.mockResolvedValue({
      success: true,
      data: {
        refreshed: true,
        added: ['lesson-a'],
        removed: ['lesson-b'],
        changed: ['lesson-c'],
        unchanged: 4,
        before: 6,
        totalLessons: 7,
        loadState: 'loaded',
      },
    })

    renderPage()
    fireEvent.click(await screen.findByTestId('meta-learner-refresh'))

    const panel = await screen.findByTestId('meta-learner-refresh-result')
    expect(panel.textContent).toContain(w('refreshAdded'))
    expect(panel.textContent).toContain(w('refreshRemoved'))
    expect(panel.textContent).toContain(w('refreshChanged'))
    expect(panel.textContent).toContain('lesson-a')
    expect(panel.textContent).toContain('lesson-b')
    expect(panel.textContent).toContain('lesson-c')
    // 刷新前 → 刷新后 的总数必须能看到(用户才知道重扫到底动了多少)
    expect(panel.textContent).toContain(fill(w('refreshTotal'), { before: '6', after: '7' }))
  })

  it('读失败必须显示原因,且不许把 refreshed=false 渲染成"刷新成功"', async () => {
    refreshMemoryMock.mockResolvedValue({
      success: true,
      data: {
        refreshed: false,
        error: '读不到持久化记忆源(重扫失败),已保留刷新前的内存态',
        added: [],
        removed: [],
        changed: [],
        unchanged: 5,
        before: 5,
        totalLessons: 5,
        loadState: 'retry_backoff',
      },
    })

    renderPage()
    fireEvent.click(await screen.findByTestId('meta-learner-refresh'))

    const panel = await screen.findByTestId('meta-learner-refresh-result')
    // 原因必须在
    const err = await screen.findByTestId('meta-learner-refresh-error')
    expect(err.textContent).toContain('读不到持久化记忆源')
    // 成功标题不许出现
    expect(panel.textContent).not.toContain(w('refreshSuccess'))
    // 失败标题必须在
    expect(panel.textContent).toContain(w('refreshReadFailed'))
  })

  it('接口失败(ApiResult 失败分支)必须给可见原因', async () => {
    refreshMemoryMock.mockResolvedValue({
      success: false,
      error: 'ai-service unavailable',
    } as never)

    renderPage()
    fireEvent.click(await screen.findByTestId('meta-learner-refresh'))

    await waitFor(() => {
      expect(screen.getByText('ai-service unavailable')).toBeTruthy()
    })
    // 失败态不得出现成功面板
    expect(screen.queryByTestId('meta-learner-refresh-result')).toBeNull()
  })

  it('网络异常也要给原因(不能吞异常)', async () => {
    refreshMemoryMock.mockRejectedValue(new Error('网络异常'))

    renderPage()
    fireEvent.click(await screen.findByTestId('meta-learner-refresh'))

    await waitFor(() => {
      expect(screen.getByText('网络异常')).toBeTruthy()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
