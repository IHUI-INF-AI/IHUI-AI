// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D176 任务回顾与「移交到新任务」(2026-09-30 立,对标竞品 chatSession.highlights.recap.*)。
//
// 这一票的判据核心不是"界面能不能打开",而是**界面有没有如实报出可达性**:
// 交接文档的生成出口在现有链路里不存在(取证四条出处见 d176-task-recap.tsx 文件头),
// 所以 UI 必须落在"依赖的生成出口不存在"这一真实状态 —— 表单在位、下游动作禁用并给禁因,
// 绝不做成"点了会假装生成"的按钮,也不拿 waitingPreview / phase.* 的进度文案冒充能力在线。
//
// 三层合围:
//   渲染层:回顾入口 → 交接菜单项 → 交接表单两级视图,禁因与禁用态逐条断言;
//   缺席层:生成态文案(waitingPreview / phase.generating / phase.finalizing / phase.done /
//           creating / createFailed)在不可达状态下**一个字都不许出现**;
//   装车层:宿主 ai-side-panel.tsx 确实 import 并挂载 <TaskRecapEntry />(头部动作簇内)。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  // 词包五语言由主会话落地后另立锁;这里 echo 键名,断言"取了哪个键"与"没取哪些键"
  useTranslations:
    () =>
    (key: string) =>
      key,
}))

import { TaskRecapEntry } from '@/components/ai/d176-task-recap'

function readRepo(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

const host = readRepo('src/components/ai/ai-side-panel.tsx')
const component = readRepo('src/components/ai/d176-task-recap.tsx')

afterEach(cleanup)

describe('D176 渲染层:回顾两级视图在位', () => {
  it('头部入口:aria-label 取 recap.title,点击开 Dialog', () => {
    render(<TaskRecapEntry />)
    const entry = screen.getByTestId('ai-panel-recap-entry')
    expect(entry.getAttribute('aria-label')).toBe('recap.title')
    fireEvent.click(entry)
    expect(screen.getByTestId('recap-dialog-title').textContent).toBe('recap.title')
    expect(screen.getByTestId('recap-handoff-menu-item').textContent).toBe(
      'recap.handoff.menuItem',
    )
  })

  it('菜单项进入交接视图:标题取 recap.handoff.title,说明取 recap.previewDescription', () => {
    render(<TaskRecapEntry />)
    fireEvent.click(screen.getByTestId('ai-panel-recap-entry'))
    fireEvent.click(screen.getByTestId('recap-handoff-menu-item'))
    expect(screen.getByTestId('recap-dialog-title').textContent).toBe('recap.handoff.title')
    expect(screen.getByText('recap.previewDescription')).toBeTruthy()
    expect(screen.getByText('recap.purposeLabel')).toBeTruthy()
    expect(screen.getByTestId('recap-purpose-input').getAttribute('placeholder')).toBe(
      'recap.purposePlaceholder',
    )
  })

  it('返回:交接视图的 recap.title 按钮退回菜单视图(两级视图各自可达,不是单向死路)', () => {
    render(<TaskRecapEntry />)
    fireEvent.click(screen.getByTestId('ai-panel-recap-entry'))
    fireEvent.click(screen.getByTestId('recap-handoff-menu-item'))
    fireEvent.click(screen.getByTestId('recap-back-to-list'))
    expect(screen.getByTestId('recap-dialog-title').textContent).toBe('recap.title')
    expect(screen.getByTestId('recap-handoff-menu-item')).toBeTruthy()
  })
})

describe('D176 缺席层:生成出口不可达 ⇒ 如实禁用,不冒充进度', () => {
  it('交接视图:目的输入与两个下游动作(显示文件/创建新任务)一律禁用并给禁因', () => {
    render(<TaskRecapEntry />)
    fireEvent.click(screen.getByTestId('ai-panel-recap-entry'))
    fireEvent.click(screen.getByTestId('recap-handoff-menu-item'))
    expect(screen.getByTestId('recap-purpose-input').hasAttribute('disabled')).toBe(true)
    const reveal = screen.getByTestId('recap-reveal-file') as HTMLButtonElement
    const create = screen.getByTestId('recap-create-session') as HTMLButtonElement
    expect(reveal.disabled).toBe(true)
    expect(create.disabled).toBe(true)
    expect(reveal.getAttribute('aria-disabled')).toBe('true')
    expect(create.getAttribute('aria-disabled')).toBe('true')
    // 键位刻意平铺成 recap.handoffUnavailable(而非 recap.handoff.generationUnavailable):
    // 五语包内 `      "handoff": {` 锚点各命中 2 处(aiChat.recap.handoff 与 ai 命名空间内的
    // 同名块),按"锚点必须恰好命中 1 次"的插入规矩不可用;`    "recap": {` 在五语包内各恰好 1 处。
    expect(screen.getByTestId('recap-generation-unavailable').textContent).toBe(
      'recap.handoffUnavailable',
    )
  })

  it('点击禁用的动作不产生任何"已生成/已创建"的假象(无成功态、无进度文案)', () => {
    render(<TaskRecapEntry />)
    fireEvent.click(screen.getByTestId('ai-panel-recap-entry'))
    fireEvent.click(screen.getByTestId('recap-handoff-menu-item'))
    fireEvent.click(screen.getByTestId('recap-create-session'))
    fireEvent.click(screen.getByTestId('recap-reveal-file'))
    for (const fake of [
      'recap.waitingPreview',
      'recap.phase.generating',
      'recap.phase.finalizing',
      'recap.phase.done',
      'recap.creating',
      'recap.createFailed',
    ]) {
      expect(screen.queryByText(fake)).toBeNull()
    }
    // 禁因仍在(点击不会把状态洗成"可用")
    expect(screen.getByTestId('recap-generation-unavailable')).toBeTruthy()
  })

  it('组件里那条可达性常量确实是 false(状态登记,不是待翻的默认值)', () => {
    expect(component).toContain('const RECAP_HANDOFF_GENERATION_AVAILABLE = false')
    expect(component).toContain('const unavailable = !RECAP_HANDOFF_GENERATION_AVAILABLE')
  })
})

describe('D176 装车层:入口真挂在面板头部动作簇里', () => {
  it('宿主 ai-side-panel.tsx 含 import 与 <TaskRecapEntry />(造好必须装车)', () => {
    expect(host).toContain("import { TaskRecapEntry } from '@/components/ai/d176-task-recap'")
    expect(host).toContain('<TaskRecapEntry />')
  })

  it('挂载点落在 D182 头部动作组(role=group)之后、工作面全屏按钮之前(同一簇内)', () => {
    const groupAt = host.indexOf('data-testid="ai-panel-header-actions-group"')
    const entryAt = host.indexOf('<TaskRecapEntry />')
    const fullscreenAt = host.indexOf('data-testid="ai-panel-workspace-fullscreen"')
    expect(groupAt).toBeGreaterThan(-1)
    expect(entryAt).toBeGreaterThan(groupAt)
    expect(entryAt).toBeLessThan(fullscreenAt)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
