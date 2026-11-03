// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SkillLibrary 重载入口 —— 控制帧 `reload_skills` 的前端侧证明(2026-10-28 立)
 *
 * 立因:D141 正本把 `reload_skills` 判为**真缺**(2026-10-01 三轮否证:skill 面只有
 * 调度与统计,无运行时重载口),竞品原帧是 `requireCliCapability("reload_skills_v1")`
 * + `request({type:"reload_skills"})` —— 即"宿主可显式调用、且必须回报结果"的帧。
 * 本文件给前端这一格补上证明,并把两条纪律钉成用例:
 *
 * ① **差额必须可见**:只弹"已重载"而不给新增/移除/更新名单,等于把一次静默失败
 *    包装成成功态 —— 用户无从判断改动到底生效没有。本用例要求成功态必须把
 *    三类名单(added/removed/changed)与各自数量显式渲染出来。
 * ② **失败必须给原因**:失败态不能只说"失败了",必须把服务端给出的原因带出来,
 *    否则用户既不知道是"没登录/没权限"还是"AI 技能服务不可用"。
 *
 * 纪律(AGENTS §22c 镜像测试纪律):本文件**不 mock next-intl**,而是挂**真的
 * NextIntlClientProvider + 真词包**(zh-CN.json),并从真词包里取期望文案 ——
 * 否则"文案里的数字 === 真实计数"这条只是在复读测试自己的替身。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reloadAiSkills } from '@ihui/api-client/endpoints/ai-skills'

import { SkillLibrary } from '../skill-library'

// 端点层(网络)桩掉:本判据只关心"帧被调到了 + 差额被显示 + 失败给原因"
vi.mock('@ihui/api-client/endpoints/ai-skills', () => ({
  listAiSkills: vi.fn(async () => ({ success: true, data: [] })),
  reloadAiSkills: vi.fn(),
  invokeAiSkill: vi.fn(async () => ({ success: false, error: 'not used' })),
}))

// 自定义技能端点(与本判据无关,避免真发请求)
vi.mock('@ihui/api-client/endpoints/chat-skills', () => ({
  listChatSkills: vi.fn(async () => ({ success: true, data: { skills: [] } })),
  createChatSkill: vi.fn(),
  deleteChatSkill: vi.fn(),
  updateChatSkill: vi.fn(),
}))

// 鉴权 store:未登录 ⇒ 不渲染"新建"按钮(与本判据无关,但避免真实 token 读取)
vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => { isAuthenticated: boolean }) =>
    sel({ isAuthenticated: false }),
}))

vi.mock('@/hooks/use-confirm', () => ({
  useConfirm: () => ({ confirm: vi.fn(), ConfirmDialogRenderer: () => null }),
}))

vi.mock('@/lib/ai-skill-variables', () => ({
  getLabelKey: () => 'label',
  getPlaceholderKey: () => 'placeholder',
  getMaxLen: () => 100,
  isLongText: () => false,
  parseVariables: () => [],
}))

const here = dirname(fileURLToPath(import.meta.url))
// __tests__ → chat → components → src → web(apps/web) → packages/i18n/messages/web
const MESSAGES_FILE = join(here, '../../../../../../packages/i18n/messages/web/zh-CN.json')

type Messages = Record<string, unknown>
const messages = JSON.parse(readFileSync(MESSAGES_FILE, 'utf8')) as Messages

const skillLib = (messages.chat as Messages).skillLibrary as Messages as Record<string, string>

/** 从真词包取词条(刻意不抄字面量 —— 抄一份就成了"测试替身自证")。 */
const w = (key: string): string => skillLib[key] ?? ''

/** 把真词包里的 ICU `{count}` 占位按"裸数字"口径填成期望文案。 */
const fill = (template: string, count: number): string => template.replace('{count}', String(count))

const reloadAiSkillsMock = vi.mocked(reloadAiSkills)

const renderLibrary = () =>
  render(
    <NextIntlClientProvider locale="zh-CN" messages={messages}>
      <SkillLibrary onSelect={vi.fn()} onClose={vi.fn()} onSendToChat={vi.fn()} />
    </NextIntlClientProvider>,
  )

describe('SkillLibrary 重载入口(控制帧 reload_skills)', () => {
  beforeEach(() => {
    reloadAiSkillsMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('点了"重载"要真的调帧(force=true),不是静默按钮', async () => {
    reloadAiSkillsMock.mockResolvedValue({
      success: true,
      data: {
        total: 3,
        auto: 2,
        added: [],
        removed: [],
        changed: [],
        unchanged: 2,
        lastReload: 1730000000,
        forced: true,
        sourceDirs: ['/tmp/skills'],
      },
    })

    renderLibrary()
    const btn = await screen.findByTestId('skill-library-reload')
    fireEvent.click(btn)

    await waitFor(() => {
      expect(reloadAiSkillsMock).toHaveBeenCalledTimes(1)
    })
    // force=true 是这帧的关键语义:用户手改 SKILL.md 后 mtime 可能不变,
    // 只走增量会把"改了没生效"报成"没有变化"
    expect(reloadAiSkillsMock).toHaveBeenCalledWith({ force: true })
  })

  it('成功态必须把三类差额(新增/移除/更新)显式渲染出来 —— 只报"已重载"等于把静默失败包装成成功态', async () => {
    reloadAiSkillsMock.mockResolvedValue({
      success: true,
      data: {
        total: 5,
        auto: 4,
        added: ['skill-alpha'],
        removed: ['skill-beta'],
        changed: ['skill-gamma'],
        unchanged: 1,
        lastReload: 1730000000,
        forced: true,
        sourceDirs: ['/tmp/skills'],
      },
    })

    renderLibrary()
    fireEvent.click(await screen.findByTestId('skill-library-reload'))

    const panel = await screen.findByTestId('skill-library-reload-result')
    // 三类数量都要在
    expect(panel.textContent).toContain(fill(w('reloadSkillsAdded'), 1))
    expect(panel.textContent).toContain(fill(w('reloadSkillsRemoved'), 1))
    expect(panel.textContent).toContain(fill(w('reloadSkillsChanged'), 1))
    // 三类名单都要在(数量对了但名单缺席,用户仍不知道改了谁)
    expect(panel.textContent).toContain('skill-alpha')
    expect(panel.textContent).toContain('skill-beta')
    expect(panel.textContent).toContain('skill-gamma')
    // 总数也要在
    expect(panel.textContent).toContain(fill(w('reloadSkillsTotal'), 5))
  })

  it('无变化时要明说"没有内容变化",不能让用户以为重载失败', async () => {
    reloadAiSkillsMock.mockResolvedValue({
      success: true,
      data: {
        total: 2,
        auto: 2,
        added: [],
        removed: [],
        changed: [],
        unchanged: 2,
        lastReload: 1730000000,
        forced: true,
        sourceDirs: ['/tmp/skills'],
      },
    })

    renderLibrary()
    fireEvent.click(await screen.findByTestId('skill-library-reload'))

    const panel = await screen.findByTestId('skill-library-reload-result')
    expect(panel.textContent).toContain(w('reloadSkillsNoChange'))
  })

  it('失败态必须带原因,不能只说"失败了"', async () => {
    reloadAiSkillsMock.mockResolvedValue({
      success: false,
      error: 'AI 技能服务暂不可用',
    } as never)

    renderLibrary()
    fireEvent.click(await screen.findByTestId('skill-library-reload'))

    const alert = await screen.findByTestId('skill-library-reload-error')
    expect(alert.textContent).toContain('AI 技能服务暂不可用')
    // 失败态不该出现成功面板(否则等于把失败包装成成功)
    expect(screen.queryByTestId('skill-library-reload-result')).toBeNull()
  })

  it('网络异常也要给原因(不能吞异常)', async () => {
    reloadAiSkillsMock.mockRejectedValue(new Error('网络异常'))

    renderLibrary()
    fireEvent.click(await screen.findByTestId('skill-library-reload'))

    const alert = await screen.findByTestId('skill-library-reload-error')
    expect(alert.textContent).toContain('网络异常')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
