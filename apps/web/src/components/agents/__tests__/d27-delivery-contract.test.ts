// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D27(2026-09-20 立):交付审查视图源码契约测试。
 *
 * 不渲染组件,直接对源码做关键锚点断言,防止后续改动无声破坏契约:
 *   1. D27 新建文件溯源水印完整(头 3 行 + 尾行隐形 unicode 串);
 *   2. CitationBar SOURCE_CLS 四新 source 色(wiki/memory/skill/mcp);
 *   3. TaskDetailDialog tab 化与交付端点契约、progress-pane 实时交付卡、
 *      use-agent-runtime 二次提取、types/agent-delivery 三接口三纯函数;
 *   4. i18n 五语言 deliveryReview.* 命名空间同构 + ai.pane 实时卡文案。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** 以 apps/web(vitest 进程工作目录)为基准读仓库内文件 */
function readRepo(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

/** 尾部水印行:仅由 "// " + 隐形 unicode(零宽/词连接符等)组成 */
const TAIL_WATERMARK_RE = /^\/\/ [\u200B-\u200F\u2060-\u2064\uFEFF]+$/

/** 断言源码含完整水印(头 3 行 + 尾部隐形溯源串) */
function expectWatermark(src: string): void {
  const lines = src.split('\n')
  expect(lines[0]).toContain('© 2026 IHUI AI')
  expect(lines[1]).toContain('Provenance-watermarked')
  expect(lines[2]).toContain('[IHUI-AI-PROVENANCE]')
  const lastLine = [...lines].reverse().find((line) => line.trim().length > 0) ?? ''
  expect(TAIL_WATERMARK_RE.test(lastLine)).toBe(true)
}

describe('D27 新建文件溯源水印', () => {
  const newFiles = [
    'src/types/agent-delivery.ts',
    'src/components/agents/DeliveryReviewPanel.tsx',
    'src/types/__tests__/agent-delivery.test.ts',
    'src/components/agents/__tests__/delivery-review-panel.test.tsx',
    'src/components/agents/__tests__/task-detail-dialog.test.tsx',
  ]
  it.each(newFiles)('%s 头尾水印完整', (relPath) => {
    expectWatermark(readRepo(relPath))
  })
})

describe('CitationBar 四新 source 色(只读区最小接触,断言文本锚点)', () => {
  const readCitationBar = () => readRepo('src/components/ai/progress-sections/citation-bar.tsx')
  it('SOURCE_CLS 含 wiki=cyan / memory=fuchsia / skill=lime / mcp=orange 四键', () => {
    const src = readCitationBar()
    expect(src).toContain("wiki: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'")
    expect(src).toContain("memory: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400'")
    expect(src).toContain("skill: 'bg-lime-500/15 text-lime-600 dark:text-lime-400'")
    expect(src).toContain("mcp: 'bg-orange-500/15 text-orange-600 dark:text-orange-400'")
  })
})

describe('TaskDetailDialog tab 化契约', () => {
  const readDialog = () => readRepo('src/components/agents/TaskDetailDialog.tsx')
  it('三 tab 与三 panel testid 锚点存在', () => {
    const src = readDialog()
    expect(src).toContain('task-detail-tab-')
    expect(src).toContain('task-detail-panel-overview')
    expect(src).toContain('task-detail-panel-delivery')
    expect(src).toContain('task-detail-panel-changes')
  })
  it('交付端点契约与会话级解析/跨会话合并函数接入', () => {
    const src = readDialog()
    expect(src).toContain('/api/v1/ai/agents/sessions/')
    expect(src).toContain('extractSessionDeliverables')
    expect(src).toContain('mergeFilesChanged')
    expect(src).toContain('DeliveryReviewPanel')
    expect(src).toContain('DeliveryFileChangeList')
  })
})

describe('实时面板交付卡与运行时状态契约', () => {
  it('progress-pane 条件渲染标记与交付面板数据源接入', () => {
    const src = readRepo('src/components/ai/agent-task-progress-pane.tsx')
    expect(src).toContain('pane-runtime-session-deliverables')
    expect(src).toContain('runtimeSessionDeliverables')
    expect(src).toContain('DeliveryReviewPanel')
  })
  it('use-agent-runtime sessionDeliverables 二次提取就位', () => {
    const src = readRepo('src/hooks/use-agent-runtime.ts')
    expect(src).toContain('sessionDeliverables')
    expect(src).toContain('extractSessionDeliverables')
  })
  it('types/agent-delivery 三接口与三纯函数齐备', () => {
    const src = readRepo('src/types/agent-delivery.ts')
    expect(src).toContain('DeliverableCitation')
    expect(src).toContain('DeliverableFileChange')
    expect(src).toContain('TaskDeliverables')
    expect(src).toContain('normalizeTaskDeliverables')
    expect(src).toContain('extractSessionDeliverables')
    expect(src).toContain('mergeFilesChanged')
  })
})

describe('i18n 五语言同构(deliveryReview.* 与 ai.pane 实时卡文案)', () => {
  const LANGS = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
  const DELIVERY_KEYS = [
    'title',
    'tabOverview',
    'tabDelivery',
    'tabChanges',
    'loading',
    'empty',
    'summary',
    'toolsSummary',
    'filesChanged',
    'filesEmpty',
    'kindAdd',
    'kindDelete',
    'kindUpdate',
    'stepsTooltip',
    'generatedAt',
  ]

  it.each(LANGS)('%s:deliveryReview 15 键齐备 + ai.pane 实时卡两键齐备', (lang) => {
    const messages = JSON.parse(
      // vitest 进程 cwd=apps/web,仓库根为 ../../
      readRepo(`../../packages/i18n/messages/web/${lang}.json`),
    ) as Record<string, unknown>
    const deliveryReview = messages.deliveryReview as Record<string, string> | undefined
    expect(deliveryReview).toBeTruthy()
    for (const key of DELIVERY_KEYS) {
      expect(typeof deliveryReview?.[key]).toBe('string')
      expect((deliveryReview?.[key] ?? '').length).toBeGreaterThan(0)
    }
    // 生成时间插值槽位契约
    expect(deliveryReview?.generatedAt).toContain('{time}')
    // 实时交付卡文案(ai.pane 命名空间)
    const pane = (messages.ai as Record<string, unknown> | undefined)?.pane as
      Record<string, string> | undefined
    expect(typeof pane?.runtimeSessionDeliverables).toBe('string')
    expect((pane?.runtimeSessionDeliverables ?? '').length).toBeGreaterThan(0)
    expect(pane?.runtimeSessionDeliverablesSummary).toContain('{n}')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
