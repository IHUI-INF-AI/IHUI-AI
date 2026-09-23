// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D92 组件级契约:失败面板的三条 UI 承诺 + 三个消费点的接线防回退。
 *
 * 纯函数层已由 packages/shared/tests/utils/view-failure-taxonomy.test.ts 钉住 21 例;
 * 本文件补"渲染面"这一层:分类必须真的驱动文案、未知码必须真的不出错误码行、
 * 恢复动作在回落态与 reloading 态都必须恒可点。第三组断言读源码原文,拦
 * "面板造好了但没人 import"的回退(本项目守门 64 的同族教训)。
 *
 * 注:apps/web 的 vitest setup 未挂 jest-dom,故只用 testing-library 查询 + DOM 原生断言。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { McpViewFailure } from '../mcp-view-failure'
// ?raw:按源码原文读三个消费点(与 cwd / import.meta.url 协议无关,vite 直接内联字符串)
import managerSrc from '../mcp-manager.tsx?raw'
import quickCallSrc from '../mcp-quick-call.tsx?raw'
import promptManagerSrc from '../mcp-prompt-manager.tsx?raw'

// 取词 mock:返回值把命名空间与键名一起显形,断言才能证明"是分类表在驱动文案",
// 而不是恰好等于某个兜底字面量。
vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string, values?: Record<string, unknown>): string => {
      let out = `${ns}:${key}`
      if (values) {
        for (const [k, v] of Object.entries(values)) out += `@${k}=${String(v)}`
      }
      return out
    },
}))

afterEach(cleanup)

describe('D92 McpViewFailure 渲染契约', () => {
  it('文案命中分类表:标题/动作/恢复三键都来自 viewFailure 的该 kind', () => {
    render(<McpViewFailure error={new Error('request timed out')} onReload={() => {}} />)
    expect(screen.queryByText('viewFailure:backendTimeout.title')).not.toBeNull()
    expect(screen.queryByText('viewFailure:backendTimeout.action')).not.toBeNull()
    expect(screen.queryByText('viewFailure:reloadView')).not.toBeNull()
  })

  it('有可信 errorCode → 错误码行渲染,并真的把 ICU 参数带进去', () => {
    render(
      <McpViewFailure
        error={{ errorCode: 'RESOURCE_NOT_FOUND', message: 'no such resource' }}
        onReload={() => {}}
      />,
    )
    expect(screen.queryByText('viewFailure:resourceNotFound.title')).not.toBeNull()
    expect(
      screen.queryByText(/viewFailure:errorCodeLabel@errorCode=RESOURCE_NOT_FOUND/),
    ).not.toBeNull()
  })

  it('无可判定信号 → 回落通用态且错误码整行不渲染(不把"未知"包装成结论)', () => {
    render(<McpViewFailure error="一句完全没有可判定信号的话" onReload={() => {}} />)
    expect(screen.queryByText('viewFailure:unknown.title')).not.toBeNull()
    expect(screen.queryByText(/errorCodeLabel/)).toBeNull()
  })

  it('回落态恢复按钮同样可点,点击真的触发 onReload', () => {
    const onReload = vi.fn()
    render(<McpViewFailure error="一句完全没有可判定信号的话" onReload={onReload} />)
    const btn = screen.getByRole('button', { name: /reloadView/ })
    expect(btn.hasAttribute('disabled')).toBe(false)
    fireEvent.click(btn)
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('reloading=true 只改图标不改可点性(恢复动作任何时刻可用)', () => {
    const onReload = vi.fn()
    render(
      <McpViewFailure
        error={{ errorCode: 'BACKEND_TIMEOUT', message: 'timeout' }}
        onReload={onReload}
        reloading
      />,
    )
    const btn = screen.getByRole('button', { name: /reloadView/ })
    expect(btn.hasAttribute('disabled')).toBe(false)
    fireEvent.click(btn)
    expect(onReload).toHaveBeenCalledTimes(1)
  })
})

describe('D92 三个消费点接线(源码结构层,防"造好没装车"回退)', () => {
  const consumers = [
    { name: 'mcp-manager.tsx', src: managerSrc },
    { name: 'mcp-quick-call.tsx', src: quickCallSrc },
    { name: 'mcp-prompt-manager.tsx', src: promptManagerSrc },
  ] as const

  for (const { name, src } of consumers) {
    it(`${name}:import 并在 isError 分支渲染面板,不再裸倒 error.message`, () => {
      expect(src).toMatch(/import\s*\{\s*McpViewFailure\s*\}\s*from\s*'\.\/mcp-view-failure'/)
      expect(src).toMatch(/<McpViewFailure\b[^>]*error=\{/)
      // 曾经的缺陷形态:把上游 error.message 直接倒进一行红字/结果卡
      expect(src).not.toMatch(/error instanceof Error \? \w+\.error\.message/)
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
