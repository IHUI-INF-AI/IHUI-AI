// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

/**
 * D113(本票):extension 工具卡的流中 diff 预览必须**真渲染出来**。
 *
 * 为什么在源码相邻性锁之外再加一份静态渲染:接线锁证明"代码里写了条件",
 * 而"running 才显示、终态不残留"这一条取决于 buildRenderModel 的投影是否真把
 * partialDiff 带到 block 上 —— 那是共享层的一格,端内 grep 看不见它断没断。
 * 沿用本端既有约定(见 message-content-terminal-isolation.test.tsx):
 * react-dom/server 静态渲染 + mock 掉 useI18n,不引入 jsdom 生命周期的额外变量。
 */
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'zh-CN',
    setLocale: () => {},
  }),
}))

const { MessageContent } = await import('../entrypoints/sidepanel/components/MessageContent')

const PREVIEW = '@@ -1,0 +1,2 @@\n+const a = 1\n+const b = 2\n'

function render(status: 'running' | 'success', partialDiff?: string): string {
  const message = {
    id: 'm1',
    role: 'assistant',
    content: '回答正文',
    toolCalls: [
      {
        id: 'call-1',
        toolName: 'write_file',
        args: { path: 'src/a.ts' },
        status,
        ...(partialDiff === undefined ? {} : { partialDiff }),
      },
    ],
  } as unknown as ComponentProps<typeof MessageContent>['message']
  return renderToStaticMarkup(<MessageContent message={message} streaming={status === 'running'} />)
}

describe('D113 渲染位:扩展工具卡的流中预览', () => {
  it('running + 非空 partialDiff ⇒ 预览块出现,内容是服务端原文', () => {
    const html = render('running', PREVIEW)
    expect(html).toContain('data-testid="tool-call-partial-diff"')
    expect(html).toContain('+const a = 1')
  })

  it('running 但无 partialDiff ⇒ 不凭空出框(普通工具零占位)', () => {
    expect(render('running')).not.toContain('data-testid="tool-call-partial-diff"')
  })

  it('终态条目即便仍带 partialDiff 也不得渲染(预览只属于执行中)', () => {
    expect(render('success', PREVIEW)).not.toContain('data-testid="tool-call-partial-diff"')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
