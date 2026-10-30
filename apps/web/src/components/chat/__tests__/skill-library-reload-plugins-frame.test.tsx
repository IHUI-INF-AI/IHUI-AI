// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SkillLibrary「重载插件面」入口 —— 控制帧 `reload_plugins` 的前端侧证明(2026-10-28 立)
 *
 * 立因:D141 正本 §1.7 把 `reload_plugins` 判为**真缺**(2026-10-01 二轮否证:
 * 全仓 0 命中),竞品原帧是
 * `let e=await this.request({type:"reload_plugins"});
 *  return this.replaceLatestCommands(e.commands),e`
 * —— 即「宿主显式调用 + **必须把重载后的命令列表回灌给宿主**」。判据不是"点了有反应",
 * 而是"调用方拿得到重载后的命令集合"。
 *
 * 与同屏 `reload_skills` 的分工(两条不同的帧,判据不同):
 *  · `reload_skills` 判据 = 技能注册表差额(added/removed/changed);
 *  · `reload_plugins` 判据 = **回灌物(最新命令清单)** + 插件差额。
 * 只回一句"已重载"、把回灌物藏起来,等于把这一帧退化成"reload_skills 的同义反复"。
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

import { reloadPlugins } from '@ihui/api-client/endpoints/control-frames'

import { SkillLibrary } from '../skill-library'

// 端点层(网络)桩掉:本判据只关心"帧被调到了 + 回灌物被显示 + 失败给原因"
vi.mock('@ihui/api-client/endpoints/control-frames', () => ({
  reloadPlugins: vi.fn(),
}))

// AI 技能端点(与本判据无关,避免真发请求)
vi.mock('@ihui/api-client/endpoints/ai-skills', () => ({
  listAiSkills: vi.fn(async () => ({ success: true, data: [] })),
  reloadAiSkills: vi.fn(async () => ({ success: true, data: undefined })),
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

const reloadPluginsMock = vi.mocked(reloadPlugins)

const renderLibrary = () =>
  render(
    <NextIntlClientProvider locale="zh-CN" messages={messages}>
      <SkillLibrary onSelect={vi.fn()} onClose={vi.fn()} onSendToChat={vi.fn()} />
    </NextIntlClientProvider>,
  )

describe('SkillLibrary「重载插件面」入口(控制帧 reload_plugins)', () => {
  beforeEach(() => {
    reloadPluginsMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('点了"重载插件面"要真的调帧(force=true),不是静默按钮', async () => {
    reloadPluginsMock.mockResolvedValue({
      success: true,
      data: {
        reloaded: true,
        commands: [],
        commandCount: 0,
        skills: 0,
        skillNames: [],
        added: [],
        removed: [],
        changed: [],
        lastReload: '2026-10-28T00:00:00Z',
        forced: true,
      },
    })

    renderLibrary()
    const btn = await screen.findByTestId('skill-library-reload-plugins')
    fireEvent.click(btn)

    await waitFor(() => {
      expect(reloadPluginsMock).toHaveBeenCalledTimes(1)
    })
    // force=true 是这帧的关键语义:用户手改 SKILL.md 后 mtime 可能不变,
    // 只走增量会把"改了没生效"报成"没有变化"
    expect(reloadPluginsMock).toHaveBeenCalledWith({ force: true })
  })

  it('成功态必须把**回灌物(最新命令清单)**显式渲染出来 —— 命令列表藏起来,这一帧就退化成 reload_skills 的同义反复', async () => {
    reloadPluginsMock.mockResolvedValue({
      success: true,
      data: {
        reloaded: true,
        commands: [
          { name: 'skill', description: '调用技能' },
          { name: 'goal', description: '设定当前会话目标' },
        ],
        commandCount: 2,
        skills: 1,
        skillNames: ['alpha'],
        added: [],
        removed: [],
        changed: [],
        lastReload: '2026-10-28T00:00:00Z',
        forced: true,
      },
    })

    renderLibrary()
    fireEvent.click(await screen.findByTestId('skill-library-reload-plugins'))

    const panel = await screen.findByTestId('skill-library-reload-plugins-result')
    // 命令清单标题(回灌物的分区标题)必须在
    expect(panel.textContent).toContain(w('reloadPluginsCommandList'))
    // 每条命令的名与描述都要在 —— 竞品那句 replaceLatestCommands(e.commands) 交回的就是这个集合
    expect(panel.textContent).toContain('/skill')
    expect(panel.textContent).toContain('调用技能')
    expect(panel.textContent).toContain('/goal')
    expect(panel.textContent).toContain('设定当前会话目标')
    // 命令条数与技能数也要在
    expect(panel.textContent).toContain(fill(w('reloadPluginsCommandCount'), 2))
    expect(panel.textContent).toContain(fill(w('reloadPluginsSkillCount'), 1))
  })

  it('插件差额(新增/移除/更新)必须可见 —— 只回"已重载"等于把静默失败包装成成功态', async () => {
    reloadPluginsMock.mockResolvedValue({
      success: true,
      data: {
        reloaded: true,
        commands: [{ name: 'skill', description: '调用技能' }],
        commandCount: 1,
        skills: 2,
        skillNames: ['alpha', 'beta'],
        added: ['skill-alpha'],
        removed: ['skill-beta'],
        changed: ['skill-gamma'],
        lastReload: '2026-10-28T00:00:00Z',
        forced: true,
      },
    })

    renderLibrary()
    fireEvent.click(await screen.findByTestId('skill-library-reload-plugins'))

    const panel = await screen.findByTestId('skill-library-reload-plugins-result')
    expect(panel.textContent).toContain(fill(w('reloadSkillsAdded'), 1))
    expect(panel.textContent).toContain(fill(w('reloadSkillsRemoved'), 1))
    expect(panel.textContent).toContain(fill(w('reloadSkillsChanged'), 1))
    // 三类名单都要在(数量对了但名单缺席,用户仍不知道改了谁)
    expect(panel.textContent).toContain('skill-alpha')
    expect(panel.textContent).toContain('skill-beta')
    expect(panel.textContent).toContain('skill-gamma')
  })

  it('命令清单为空时要明说"没有可用命令",不能留一片空白让人以为面板没加载出来', async () => {
    reloadPluginsMock.mockResolvedValue({
      success: true,
      data: {
        reloaded: true,
        commands: [],
        commandCount: 0,
        skills: 0,
        skillNames: [],
        added: [],
        removed: [],
        changed: [],
        lastReload: null,
        forced: true,
      },
    })

    renderLibrary()
    fireEvent.click(await screen.findByTestId('skill-library-reload-plugins'))

    const panel = await screen.findByTestId('skill-library-reload-plugins-result')
    expect(panel.textContent).toContain(w('reloadPluginsNoCommand'))
  })

  it('失败态必须带原因,不能只说"失败了"', async () => {
    reloadPluginsMock.mockResolvedValue({
      success: false,
      error: '插件面重载服务暂不可用',
    } as never)

    renderLibrary()
    fireEvent.click(await screen.findByTestId('skill-library-reload-plugins'))

    const alert = await screen.findByTestId('skill-library-reload-plugins-error')
    expect(alert.textContent).toContain('插件面重载服务暂不可用')
    // 失败态不该出现成功面板(否则等于把失败包装成成功)
    expect(screen.queryByTestId('skill-library-reload-plugins-result')).toBeNull()
  })

  it('网络异常也要给原因(不能吞异常)', async () => {
    reloadPluginsMock.mockRejectedValue(new Error('网络异常'))

    renderLibrary()
    fireEvent.click(await screen.findByTestId('skill-library-reload-plugins'))

    const alert = await screen.findByTestId('skill-library-reload-plugins-error')
    expect(alert.textContent).toContain('网络异常')
  })

  it('reload_plugins 与 reload_skills 是两条不同的帧:点前者不得触发后者', async () => {
    const { reloadAiSkills } = await import('@ihui/api-client/endpoints/ai-skills')
    const reloadAiSkillsMock = vi.mocked(reloadAiSkills)
    reloadAiSkillsMock.mockClear()

    reloadPluginsMock.mockResolvedValue({
      success: true,
      data: {
        reloaded: true,
        commands: [],
        commandCount: 0,
        skills: 0,
        skillNames: [],
        added: [],
        removed: [],
        changed: [],
        lastReload: null,
        forced: true,
      },
    })

    renderLibrary()
    fireEvent.click(await screen.findByTestId('skill-library-reload-plugins'))

    await waitFor(() => {
      expect(reloadPluginsMock).toHaveBeenCalledTimes(1)
    })
    expect(reloadAiSkillsMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
