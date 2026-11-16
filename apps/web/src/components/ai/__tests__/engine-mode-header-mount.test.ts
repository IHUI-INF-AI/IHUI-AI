// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AISidePanel 标题栏「agent 执行引擎切换」挂载点 · 源码静态断言(2026-11-15)。
 *
 * 为什么用源码断言而非渲染:ai-side-panel.tsx 3000+ 行、拖整棵 chat 依赖树,
 * 为验证「标题栏有没有挂 EngineModeControl」去渲染整面板成本高、且极易因无关重构误红。
 * 「标题栏是否挂了某控件」本身是**源码属性**,直接读源码判定更稳。
 *
 * 锁定的不变量:
 *  1. ai-side-panel.tsx 静态 import EngineModeControl(标题栏挂载,非懒加载)。
 *  2. 主面板 header JSX 里实际渲染 <EngineModeControl ... disabled={isStreaming} />。
 *  3. message-input.tsx 不得再挂 EngineModeControl(避免底栏 + 标题栏两处重复)。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readRepo(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

const PANEL_REL = 'src/components/ai/ai-side-panel.tsx'
const PANEL_SRC = readRepo(PANEL_REL)

describe('AISidePanel 标题栏引擎切换挂载点', () => {
  it('静态 import EngineModeControl(标题栏常驻,不懒加载)', () => {
    expect(PANEL_SRC).toMatch(
      /import\s*\{\s*EngineModeControl\s*\}\s*from\s*'@\/components\/chat\/engine-mode-button'/,
    )
  })

  it('header JSX 实际渲染 <EngineModeControl disabled={isStreaming} />', () => {
    expect(PANEL_SRC).toMatch(/<EngineModeControl\s+disabled=\{isStreaming\}\s*\/>/)
  })

  it('挂载点在工作区选择器(WorkspaceSelector)之前 = 标题右侧、面板上方', () => {
    const controlIdx = PANEL_SRC.indexOf('<EngineModeControl')
    const selectorIdx = PANEL_SRC.indexOf('<WorkspaceSelector />')
    expect(controlIdx, '应能定位 EngineModeControl 挂载').toBeGreaterThan(-1)
    expect(selectorIdx, '应能定位 WorkspaceSelector 挂载').toBeGreaterThan(-1)
    expect(controlIdx, '引擎切换应挂在工作区选择器之前(标题栏靠左)').toBeLessThan(selectorIdx)
  })

  it('message-input.tsx 底栏不得再挂 EngineModeControl(避免两处重复)', () => {
    const inputSrc = readRepo('src/components/chat/message-input.tsx')
    expect(inputSrc).not.toMatch(/<EngineModeControl/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
