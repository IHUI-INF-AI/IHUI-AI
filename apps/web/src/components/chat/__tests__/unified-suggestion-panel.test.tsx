// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D68 统一多源建议面板用例。
// 覆盖台账验收四件:①六源聚合用例 ②三句降级用例(某一源失败时另几源仍可用的断言)
// ③「引用标签不新增执行授权」声明可见性断言(渲染树节点存在 + 真实词包 zh-CN 逐字)
// ④旧三浮层入口不回归(message-input 挂载面静态结构断言 + 既有测试继续跑)。
// 另覆盖:引用上限拒收可见 / 粘贴引用有效性预览 / 聚合 hook 单源失败隔离。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// api-client 五源出口全部 mock:用例零网络,单源成败由测试自己造
vi.mock('@ihui/api-client', () => ({
  listAutomations: vi.fn(),
  listAiSkills: vi.fn(),
  getInstalledPlugins: vi.fn(),
  getConnectors: vi.fn(),
  getAgents: vi.fn(),
}))

import * as api from '@ihui/api-client'
import {
  aggregateUnifiedSuggestions,
  capReferences,
  computeDegradationNotice,
  DEFAULT_SOURCE_PROVENANCE,
  MAX_PANEL_REFERENCES,
  previewPastedReferences,
  resolveProvenance,
  SUGGESTION_PROVENANCES,
  SUGGESTION_SOURCE_KINDS,
  type SuggestionSourceKind,
  type SuggestionSourceState,
} from '../unified-suggestion-sources'
import {
  UnifiedPasteReferencePreview,
  UnifiedSuggestionPanel,
} from '../unified-suggestion-panel'
import { useUnifiedSuggestions } from '@/hooks/use-unified-suggestions'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function makeState(
  source: SuggestionSourceKind,
  status: SuggestionSourceState['status'],
  labels: string[] = [],
): SuggestionSourceState {
  return {
    source,
    status,
    items: labels.map((label) => ({ id: `${source}:${label}`, source, label })),
  }
}

const ALL_READY: SuggestionSourceState[] = SUGGESTION_SOURCE_KINDS.map((s) =>
  makeState(s, 'ready', [`${s}-one`]),
)

describe('D68 六源聚合(纯逻辑)', () => {
  it('固定顺序输出六源分节;状态集缺哪一源补 idle 空节(不得静默少一格)', () => {
    const partial = [makeState('file', 'ready', ['a.ts']), makeState('task', 'loading')]
    const out = aggregateUnifiedSuggestions(partial, '')
    expect(out.map((s) => s.source)).toEqual([...SUGGESTION_SOURCE_KINDS])
    expect(out.find((s) => s.source === 'skill')?.status).toBe('idle')
    expect(out.find((s) => s.source === 'file')?.status).toBe('ready')
  })

  it('query 对 label/detail 大小写不敏感过滤,命中为空的源仍保留分节', () => {
    const out = aggregateUnifiedSuggestions(ALL_READY, 'TASK-')
    expect(out.find((s) => s.source === 'task')?.items).toHaveLength(1)
    expect(out.find((s) => s.source === 'agent')?.items).toHaveLength(0)
    expect(out).toHaveLength(6)
  })

  it('逐源来源标注:六源默认档齐备且在封闭词表内;条目可覆盖(内置技能)', () => {
    for (const kind of SUGGESTION_SOURCE_KINDS) {
      expect(SUGGESTION_PROVENANCES).toContain(DEFAULT_SOURCE_PROVENANCE[kind])
    }
    expect(
      resolveProvenance({ source: 'skill', provenance: undefined }).valueOf(),
    ).not.toBe('')
    expect(resolveProvenance({ source: 'skill', provenance: 'builtin' })).toBe('builtin')
    expect(resolveProvenance({ source: 'plugin' })).toBe('market')
  })
})

describe('D68 部分失败降级三句(纯逻辑)', () => {
  it('无失败源 → none,不渲染降级条', () => {
    expect(computeDegradationNotice(ALL_READY)).toEqual({ kind: 'none' })
  })

  it('恰一个源失败 → single;其余源全部 ready(single 句仍含可用源)', () => {
    const states = ALL_READY.map((s) => (s.source === 'task' ? { ...s, status: 'failed' as const } : s))
    expect(computeDegradationNotice(states)).toEqual({ kind: 'single', failed: 'task' })
  })

  it('多源失败且有可用源 → partial,failed/usable 清单精确', () => {
    const states = ALL_READY.map((s) =>
      s.source === 'task' || s.source === 'agent' ? { ...s, status: 'failed' as const } : s,
    )
    const notice = computeDegradationNotice(states)
    expect(notice.kind).toBe('partial')
    if (notice.kind === 'partial') {
      expect(notice.failed).toEqual(['task', 'agent'])
      expect(notice.usable).toEqual(['skill', 'plugin', 'connector', 'file'])
    }
  })

  it('六源全失败 → all(不得只报"某源失败"掩盖整面不可用)', () => {
    const states = SUGGESTION_SOURCE_KINDS.map((s) => makeState(s, 'failed'))
    expect(computeDegradationNotice(states)).toEqual({ kind: 'all' })
  })
})

describe('D68 引用上限与粘贴引用有效性预览(纯逻辑)', () => {
  it('上限内全收;顶到上限后多余条目进 rejected(拒收必须可见,不静默丢)', () => {
    expect(capReferences(0, [1, 2, 3]).kept).toEqual([1, 2, 3])
    const r = capReferences(MAX_PANEL_REFERENCES - 1, ['a', 'b'])
    expect(r.kept).toEqual(['a'])
    expect(r.rejected).toEqual(['b'])
    expect(capReferences(MAX_PANEL_REFERENCES, ['x']).kept).toEqual([])
  })

  it('@token 与反引号 path 双形态提取;已知集命中 recognized,未知为 false;重复只报一次', () => {
    const previews = previewPastedReferences(
      '看 @src/a.ts 和 `report.pdf`,再看 @src/a.ts 与 @nope/x.ts',
      { paths: ['src/a.ts'], labels: ['report.pdf'] },
    )
    expect(previews.map((p) => p.normalized)).toEqual([
      'src/a.ts',
      'nope/x.ts',
      'report.pdf',
    ])
    expect(previews.find((p) => p.normalized === 'src/a.ts')?.recognized).toBe(true)
    expect(previews.find((p) => p.normalized === 'report.pdf')?.recognized).toBe(true)
    expect(previews.find((p) => p.normalized === 'nope/x.ts')?.recognized).toBe(false)
  })

  it('空文本 / 无引用 sigil 文本 → 空数组(调用方不渲染预览条)', () => {
    expect(previewPastedReferences('', { paths: [], labels: [] })).toEqual([])
    expect(previewPastedReferences('普通一句话', { paths: [], labels: [] })).toEqual([])
  })
})

describe('D68 聚合 hook:某一源失败时另几源仍可用(三句降级的数据面)', () => {
  const mockAll = (impl: Partial<Record<string, unknown>>) => {
    vi.mocked(api.listAutomations).mockResolvedValue(
      (impl.task ?? { items: [{ id: 't1', name: '日报任务', prompt: '每天汇总' }] }) as never,
    )
    vi.mocked(api.listAiSkills).mockResolvedValue({
      success: true,
      data: [{ id: 's1', name: '润色', source: 'builtin' }],
    } as never)
    vi.mocked(api.getInstalledPlugins).mockResolvedValue({
      states: { 'p1': { installedAt: '', pinned: false } },
      authenticated: true,
    } as never)
    vi.mocked(api.getConnectors).mockResolvedValue({
      success: true,
      data: { connectors: [{ key: 'yuque:x', type: 'yuque', name: '语雀' }], count: 1 },
    } as never)
    vi.mocked(api.getAgents).mockResolvedValue({
      success: true,
      data: { list: [{ id: 'a1', name: '客服助手', description: '' }], total: 1 },
    } as never)
    if (impl.failTask) vi.mocked(api.listAutomations).mockRejectedValue(new Error('boom'))
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('任务源失败:task=failed,其余五源 items 不受影响;file 源用宿主注入条目', async () => {
    mockAll({ failTask: true })
    const fileItems = [
      { id: 'file:1', source: 'file' as const, label: 'spec.md', detail: 'docs · 2KB' },
    ]
    const { result } = renderHook(() => useUnifiedSuggestions(true, fileItems))
    await waitFor(() => {
      const task = result.current.states.find((s) => s.source === 'task')
      expect(task?.status).toBe('failed')
    })
    const bySource = Object.fromEntries(
      result.current.states.map((s) => [s.source, s] as const),
    )
    // 降级三句的数据面:failed 只有 task,可用面 = skill/plugin/connector/agent/file 五个 ready
    expect(bySource.skill?.status).toBe('ready')
    expect(bySource.plugin?.status).toBe('ready')
    expect(bySource.connector?.status).toBe('ready')
    expect(bySource.agent?.status).toBe('ready')
    expect(bySource.file?.items.map((i) => i.id)).toEqual(['file:1'])
    expect(computeDegradationNotice(result.current.states)).toEqual({
      kind: 'single',
      failed: 'task',
    })
    // 技能条目的内置标注来自 AiSkillMeta.source==='builtin'(真数据信号,非编造)
    expect(resolveProvenance(bySource.skill!.items[0]!)).toBe('builtin')
  })

  it('六源全失败(远端五源 reject + 宿主无文件)→ all 降级,面板数据结构仍完整六格', async () => {
    mockAll({})
    vi.mocked(api.listAutomations).mockRejectedValue(new Error('x'))
    vi.mocked(api.listAiSkills).mockRejectedValue(new Error('x'))
    vi.mocked(api.getInstalledPlugins).mockRejectedValue(new Error('x'))
    vi.mocked(api.getConnectors).mockRejectedValue(new Error('x'))
    vi.mocked(api.getAgents).mockRejectedValue(new Error('x'))
    const { result } = renderHook(() => useUnifiedSuggestions(true, []))
    await waitFor(() => {
      expect(
        result.current.states.filter((s) => s.status === 'failed' && s.source !== 'file'),
      ).toHaveLength(5)
    })
    expect(result.current.states).toHaveLength(6)
  })

  it('retry(source) 只重拉该源:第二次成功后该源恢复 ready,其它源状态不动', async () => {
    mockAll({ failTask: true })
    const { result } = renderHook(() => useUnifiedSuggestions(true, []))
    await waitFor(() => {
      expect(result.current.states.find((s) => s.source === 'task')?.status).toBe('failed')
    })
    vi.mocked(api.listAutomations).mockResolvedValue({
      items: [{ id: 't1', name: '恢复的任务', prompt: '重放' }],
      total: 1,
    } as never)
    act(() => result.current.retry('task'))
    await waitFor(() => {
      expect(result.current.states.find((s) => s.source === 'task')?.status).toBe('ready')
    })
    expect(result.current.states.find((s) => s.source === 'agent')?.status).toBe('ready')
  })
})

describe('D68 面板渲染:来源标注 / 三句降级 / 键盘提示行 / 授权声明可见性', () => {
  const anchorRef = { current: null } as React.RefObject<HTMLElement | null>
  const noop = () => undefined

  const renderPanel = (states: SuggestionSourceState[], capRejected = false) =>
    render(
      <UnifiedSuggestionPanel
        open
        anchorRef={anchorRef}
        onClose={noop}
        states={states}
        onSelect={noop}
        onRetry={noop}
        capRejected={capRejected}
      />,
    )

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('六源分节全部出现,每条建议带可见来源标注徽章', () => {
    renderPanel(ALL_READY)
    for (const kind of SUGGESTION_SOURCE_KINDS) {
      expect(screen.getByTestId(`unified-suggestion-section-${kind}`)).toBeTruthy()
    }
    // task 默认档 userRemote → 徽章文本为 i18n 键(mock 下逐字回显)
    expect(screen.getAllByTestId('unified-suggestion-provenance-userRemote').length).toBeGreaterThan(0)
  })

  it('partial 降级(两源失败四源可用):一条可见文案,失败源之外条目仍渲染可用', () => {
    const states = ALL_READY.map((s) =>
      s.source === 'agent' || s.source === 'connector'
        ? { ...s, status: 'failed' as const, items: [] }
        : s,
    )
    renderPanel(states)
    const bar = screen.getByTestId('unified-suggestion-degradation')
    expect(bar.getAttribute('data-degradation-kind')).toBe('partial')
    expect(bar.textContent).toBe('degradePartial')
    // 另几源仍可用:file / task 条目仍在渲染树
    expect(screen.getByTestId('unified-suggestion-item-file:file-one')).toBeTruthy()
    expect(screen.getByTestId('unified-suggestion-item-task:task-one')).toBeTruthy()
    // 失败源分节仍出现(带重试入口),不是整面消失
    expect(screen.getByTestId('unified-suggestion-section-agent')).toBeTruthy()
    expect(screen.getByTestId('unified-suggestion-section-connector')).toBeTruthy()
  })

  it('single / all 两种降级各渲染一次对应键;无失败时不渲染降级条', () => {
    document.body.innerHTML = ''
    const single = ALL_READY.map((s) => (s.source === 'file' ? { ...s, status: 'failed' as const, items: [] } : s))
    const r1 = render(
      <UnifiedSuggestionPanel open anchorRef={anchorRef} onClose={noop} states={single} onSelect={noop} />,
    )
    expect(
      screen.getByTestId('unified-suggestion-degradation').getAttribute('data-degradation-kind'),
    ).toBe('single')
    r1.unmount()
    document.body.innerHTML = ''
    const all = SUGGESTION_SOURCE_KINDS.map((s) => makeState(s, 'failed'))
    const r2 = render(
      <UnifiedSuggestionPanel open anchorRef={anchorRef} onClose={noop} states={all} onSelect={noop} />,
    )
    expect(
      screen.getByTestId('unified-suggestion-degradation').getAttribute('data-degradation-kind'),
    ).toBe('all')
    r2.unmount()
    document.body.innerHTML = ''
    const r3 = render(
      <UnifiedSuggestionPanel open anchorRef={anchorRef} onClose={noop} states={ALL_READY} onSelect={noop} />,
    )
    expect(screen.queryByTestId('unified-suggestion-degradation')).toBeNull()
    r3.unmount()
  })

  it('键盘提示行(↑↓ / Enter / ESC)+ 引用计数上限档可见', () => {
    renderPanel(ALL_READY)
    const kbds = Array.from(document.querySelectorAll('kbd')).map((k) => k.textContent)
    expect(kbds).toContain('↑↓')
    expect(kbds).toContain('Enter')
    expect(kbds).toContain('ESC')
    // mock 的 t() 逐字回显键名,故断言键出现即"计数档已渲染"(真实取值断言在词包组)
    expect(document.body.textContent).toContain('referenceCount')
  })

  it('「引用标签不新增执行授权」声明以可见文本节点渲染(非 aria-only / 非 tooltip)', () => {
    renderPanel(ALL_READY)
    const notice = screen.getByTestId('unified-suggestion-authorization-notice')
    expect(notice).toBeTruthy()
    // 必须是渲染树里的真实文本(mock t 逐字回显键名 => 断言节点在、文本渲染、位于可见 <p>)
    expect(notice.tagName).toBe('P')
    expect(notice.textContent).toBe('authorizationNotice')
    // 可见性护栏:声明不得以 title / aria-label 单通道承载
    expect(notice.getAttribute('title')).toBeNull()
    expect(notice.getAttribute('aria-label')).toBeNull()
  })

  it('引用上限拒收回显:capRejected=true 时出现可见提示,不得静默', () => {
    renderPanel(ALL_READY, true)
    expect(screen.getByTestId('unified-suggestion-cap-notice').textContent).toBe(
      'referenceCapFull',
    )
  })

  it('粘贴引用有效性预览条:有效/未识别两态各一个可见节点;空集不渲染', () => {
    const { unmount } = render(
      <UnifiedPasteReferencePreview
        previews={[
          { raw: '@src/a.ts', normalized: 'src/a.ts', recognized: true },
          { raw: '@nope', normalized: 'nope', recognized: false },
        ]}
        onDismiss={noop}
      />,
    )
    expect(screen.getByTestId('unified-paste-ref-valid')).toBeTruthy()
    expect(screen.getByTestId('unified-paste-ref-unknown')).toBeTruthy()
    unmount()
    document.body.innerHTML = ''
    render(<UnifiedPasteReferencePreview previews={[]} onDismiss={noop} />)
    expect(screen.queryByTestId('unified-paste-reference-preview')).toBeNull()
  })
})

describe('D68 旧三浮层入口不回归(message-input 挂载面静态结构断言)', () => {
  const src = readFileSync(join(here, '../message-input.tsx'), 'utf8')

  it('三浮层组件仍被 import、仍各自挂载、触发状态位原样在位', () => {
    expect(src).toContain('import { FileMentionPopover }')
    expect(src).toContain('import { SlashCommandPalette }')
    expect(src).toContain('ContextSelectorPopover,')
    expect(src).toContain('<FileMentionPopover')
    expect(src).toContain('<ContextSelectorPopover')
    expect(src).toContain('<SlashCommandPalette')
    // 各自入口触发态:@ 提及 / # 上下文 / 斜杠面板(含全局快捷键走的 slashOpen)
    expect(src).toContain('open={mentionOpen}')
    expect(src).toContain('open={contextSelector.open}')
    expect(src).toContain('open={slashOpen}')
  })

  it('统一建议面板作为新增聚合入口挂上,且不改写以上任何一处', () => {
    expect(src).toContain('<UnifiedSuggestionPanel')
    expect(src).toContain('data-testid="unified-suggestion-entry"')
    expect(src).toContain('<FileMentionPopover')
    expect(src).toContain('<ContextSelectorPopover')
    expect(src).toContain('<SlashCommandPalette')
  })
})

describe('D68 词包覆盖(读真实词包,不 mock)', () => {
  const readNs = (locale: string): Record<string, string> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { unifiedSuggestion?: Record<string, string> }
    const node = parsed.unifiedSuggestion
    if (!node) throw new Error(`missing unifiedSuggestion in ${locale}.json`)
    return node
  }

  it('五语言键集完全一致(parity)且取值全非空', () => {
    const base = Object.keys(readNs('zh-CN')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      const ns = readNs(locale)
      expect(Object.keys(ns).sort(), locale).toEqual(base)
      for (const [k, v] of Object.entries(ns)) {
        expect(typeof v === 'string' && v.trim().length > 0, `${locale}.${k}`).toBe(true)
      }
    }
  })

  it('zh-CN 台账判据原文逐字一致(安全声明与三句降级不自创措辞)', () => {
    const ns = readNs('zh-CN')
    expect(ns.authorizationNotice).toBe('引用标签不新增执行授权')
    expect(ns.degradeSingle).toBe('{failed} 暂时无法加载')
    expect(ns.degradePartial).toBe('{failed} 暂时无法加载，仍可继续使用 {ok}')
    expect(ns.degradeAll).toBe('所有建议来源暂时无法加载，仍可直接输入并发送消息')
    expect(ns.title).toBe('多源建议')
    expect(ns.sourceAgent).toBe('Agent')
    for (const k of ['sourceTask', 'sourceSkill', 'sourcePlugin', 'sourceConnector', 'sourceFile']) {
      expect(ns[k]).toBeTruthy()
    }
  })

  it('占位符 {failed}/{ok}/{max}/{n} 五语言原样保留;ko 无中文残留', () => {
    for (const locale of LOCALES) {
      const ns = readNs(locale)
      expect(ns.degradePartial).toContain('{failed}')
      expect(ns.degradePartial).toContain('{ok}')
      expect(ns.referenceCapFull).toContain('{max}')
      expect(ns.referenceCount).toContain('{n}')
    }
    for (const [k, v] of Object.entries(readNs('ko'))) {
      expect(/[\u4e00-\u9fff]/.test(v), `ko.${k} 含中文残留`).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
