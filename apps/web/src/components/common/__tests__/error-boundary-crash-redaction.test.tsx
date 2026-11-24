// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ErrorBoundary 崩溃上报的**发射前脱敏**(2026-09-27 立)。
 *
 * 病灶(实测):本组件的 componentDidCatch 把 `error.message` / `error.stack` 原样 POST 到
 * `/api/crash-reports`,而那个端点**匿名可写**、服务端当时只有 zod 长度上限 ⇒
 * 错误消息里内嵌的 API key / Bearer / 用户机器绝对路径明文进 `crash_reports`(保留 90 天)
 * 并进 admin 面板。服务端 `recordCrash` 是权威防线;客户端这一道是"少把用户原文送出浏览器"。
 *
 * 两臂成对(与守门「崩溃上报出口脱敏对账」同源,共用一份规则实现):
 *  ① 含凭据形状的 message/stack 在出浏览器前就被遮;
 *  ② 普通业务错误消息与合法堆栈**逐字**不被改坏 —— 否则崩溃排障失去价值。
 *
 * 注:这里断言的是 fetch 的 **body**(出网点),不是渲染结果 —— 崩溃上报的全部风险就在这一份
 * payload 上;只断言"页面还在 fallback"证明不了任何事。
 */

import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from '../ErrorBoundary'

interface CrashPayload {
  platform?: string
  errorMessage?: string
  stack?: string
  route?: string
}

/** 造一个 message 与 stack 都可控的 Error(真实 `error.stack` 会带测试运行器路径,不可复现)。 */
function makeError(message: string, stack: string): Error {
  const err = new Error(message)
  err.stack = stack
  return err
}

function Throwing({ error }: { error: Error }): ReactNode {
  throw error
}

/** 取出第 n 次上报的 JSON body。 */
function payloadAt(n = 0): CrashPayload {
  const init = vi.mocked(fetch).mock.calls[n]?.[1] as RequestInit | undefined
  expect(typeof init?.body, '崩溃上报必须带字符串 body').toBe('string')
  return JSON.parse(String(init?.body)) as CrashPayload
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true } as unknown as Response)),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ErrorBoundary / 崩溃上报发射前脱敏', () => {
  it('① message 里的 Bearer + sk- 凭据不得出浏览器', () => {
    const secret = 'sk-proj-' + 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
    render(
      <ErrorBoundary>
        <Throwing
          error={makeError(
            `上游鉴权失败 Authorization: Bearer ${secret}`,
            'Error\n at x (a.js:1:1)',
          )}
        />
      </ErrorBoundary>,
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    const p = payloadAt()
    expect(p.errorMessage).not.toContain(secret)
    expect(p.errorMessage).toContain('[REDACTED_SECRET]')
    // 业务语义保留:这句还得读得出来是"上游鉴权失败"
    expect(p.errorMessage).toContain('上游鉴权失败')
    expect(p.platform).toBe('web')
  })

  it('①b stack 里的用户机器绝对路径:用户名被遮、文件位置保留', () => {
    const stack = [
      'Error: 读取本地缓存失败',
      '    at readCache (C:\\Users\\Administrator\\AppData\\Local\\ihui\\chat.js:12:3)',
      '    at readCache (/c/Users/Administrator/AppData/Local/ihui/chat.js:12:3)',
    ].join('\n')
    render(
      <ErrorBoundary>
        <Throwing error={makeError('读取本地缓存失败', stack)} />
      </ErrorBoundary>,
    )
    const p = payloadAt()
    expect(p.stack).not.toContain('Administrator')
    expect(p.stack).toContain('<user>')
    // 遮的是"是谁的机器",留的是"哪个文件哪一行" —— 堆栈必须还能用于排障
    expect(p.stack).toContain('AppData\\Local\\ihui\\chat.js:12:3')
    expect(p.stack).toContain('AppData/Local/ihui/chat.js:12:3')
    expect(p.route).toBe(window.location.pathname)
  })

  it('② 普通业务错误消息与合法堆栈逐字不被改坏', () => {
    const message = '无法保存草稿,请检查网络后重试(共 12 项,已跳过 3 项)'
    const stack = [
      'Error: 无法保存草稿',
      '    at handleSubmit (http://localhost:8801/_next/static/chunks/app/page.js:412:19)',
      '    at Object.<anonymous> (G:\\IHUI-AI\\apps\\web\\src\\components\\editor\\index.tsx:33:5)',
      '    at Array.forEach (<anonymous>)',
      '    at /app/src/pages/home/index.tsx:10:5',
    ].join('\n')
    render(
      <ErrorBoundary>
        <Throwing error={makeError(message, stack)} />
      </ErrorBoundary>,
    )
    const p = payloadAt()
    expect(p.errorMessage).toBe(message)
    expect(p.stack).toBe(stack)
  })

  it('②b 无 message 时仍是 unknown error(兜底形态不变)', () => {
    // `new Error()` 的 message 是**空串**而非 nullish ⇒ 旧写法 `?? 'unknown error'` 兜不住,
    // 空消息撞上服务端 `errorMessage.min(1)` 就是 400 静默丢弃。这条断言钉的是
    // "兜底放在脱敏之后"(`|| 'unknown error'`)—— 它同时 cover 原文为空与被遮成空两种形态。
    const err = new Error()
    err.stack = undefined
    render(
      <ErrorBoundary>
        <Throwing error={err} />
      </ErrorBoundary>,
    )
    const p = payloadAt()
    expect(p.errorMessage).toBe('unknown error')
    // 与改前同形:没有 stack 时这个键整体缺席,而不是落成 ""
    expect('stack' in p).toBe(false)
  })

  it('③ 渲染面不受影响:上报载荷被改写不等于错误被吞(fallback 仍在)', () => {
    const { container } = render(
      <ErrorBoundary>
        <Throwing error={makeError('页面出错了校验', 'Error\n at y (b.js:2:2)')} />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain('页面出错了')
    expect(payloadAt().errorMessage).toBe('页面出错了校验')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
