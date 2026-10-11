// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 广场(AI 需求广场 / 社区广场)失败分支的身份回归。
 *
 * 题面:PROJECT_PLAN「广场(AI需求广场)首屏直接进错误态」——上屏文案是
 * 「提交的信息有误,请检查后重试」,读起来像 400(参数错),而**服务端根本没回 400**。
 *
 * 本机实测(2026-10-01,自起 apps/api 于 8802 + Playwright 打 8801 真量):
 *   GET /api/plaza/list?page=1&pageSize=10&taskStatus=waiting
 *     无凭据   → HTTP 401 `{"code":401,"message":"Authentication required"}`
 *     凭据失效 → HTTP 401 `{"code":401,"message":"Invalid or expired token"}`
 *     有效凭据 → HTTP 200(⇒ "首屏真的 400" 这一假设被否证)
 *   POST /api/plaza(游客)→ HTTP 403 `{"code":403,"message":"CSRF 令牌缺失或无效"}`
 *   三个响应体**都不带 errorCode** ⇒ 能分辨"这是鉴权/授权失败"的档只剩 HTTP `status`。
 *
 * 所以那句文案只能来自"调用侧把 status 丢了":`toUserFriendlyMessage` 判序是
 * errorCode → HTTP status → 文案正则,前两档一空,401 的英文原文就撞进参数类正则
 * `/invalid|missing|required/i` ⇒「提交的信息有误,请检查后重试」,把"去重新登录"
 * 引导成"回去改表单"(守门 135 的立项型)。
 *
 * 本文件钉三层,每层都带反向对照:
 *  ① 广场族唯一出口 `helpers.api()` —— 同一个 401,带 status 与只取 message 两臂必不同形;
 *  ② 发布页 `/plaza/new` 的**上屏**文案(守门 135 明确"不判的第二半":catch 里直读
 *     `e.message` 时,即使 throw 换了出口仍然丢身份)—— 断言上屏的是身份档,
 *     且服务端原文没被摊给用户;失败时**不得**出现成功 toast / 跳转(副作用没发生);
 *  ③ 源码锁:广场族只许一份 `api()` 实现,发布页不得再手搓 `throw new Error(r.error)`。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import type { ApiResult } from '@ihui/types'
import { apiFailureToError, toUserFriendlyMessage } from '@ihui/shared/utils'

/** `@/lib/api` 会拉起 api-client + stores + vault 整条链;本票只判身份链,替身即可。 */
const fetchApiMock = vi.fn()
vi.mock('@/lib/api', () => ({
  fetchApi: (url: string, options?: RequestInit) => fetchApiMock(url, options),
}))

const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock('@/components/common/Toaster', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}))

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `t:${key}`,
}))

import { api } from '../app/(main)/plaza/helpers'
import PlazaNewPage from '../app/(main)/plaza/new/page'

/** 真机实测响应体逐字搬进来(见文件头注),不是自造夹具。 */
const REAL_401 = {
  success: false,
  error: 'Invalid or expired token',
  status: 401,
} as const
const REAL_401_GUEST = {
  success: false,
  error: 'Authentication required',
  status: 401,
} as const
const REAL_403_CSRF = {
  success: false,
  error: 'CSRF 令牌缺失或无效',
  status: 403,
} as const

describe('① 广场族唯一出口 helpers.api() 保住失败身份', () => {
  beforeEach(() => fetchApiMock.mockReset())

  it('401 失败分支抛出的 Error 带 status=401,文案落"登录已过期"档', async () => {
    fetchApiMock.mockResolvedValue(REAL_401 satisfies ApiResult<unknown>)
    const err = await api<unknown>('/api/plaza/list?page=1&pageSize=10').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error & { status?: number }).status).toBe(401)
    expect(toUserFriendlyMessage(err)).toBe('登录已过期,请重新登录')
  })

  it('反向对照:只取 message 的旧写法(new Error(r.error))必落参数档', () => {
    // 这一臂就是实拍那句文案的成因:两臂必须不同形,否则本票保住的那一档并不存在。
    const messageOnly = new Error(REAL_401.error)
    expect(toUserFriendlyMessage(messageOnly)).toBe('提交的信息有误,请检查后重试')
    expect(toUserFriendlyMessage(apiFailureToError(REAL_401))).not.toBe(
      toUserFriendlyMessage(messageOnly),
    )
  })
})

describe('② 发布页 /plaza/new 的上屏文案取身份档,不摊服务端原文', () => {
  beforeEach(() => {
    fetchApiMock.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
    pushMock.mockReset()
  })
  afterEach(cleanup)

  async function submit(): Promise<void> {
    render(React.createElement(PlazaNewPage))
    fireEvent.change(screen.getByLabelText('t:titleLabel'), {
      target: { value: '探针需求标题' },
    })
    fireEvent.change(screen.getByLabelText('t:descLabel'), {
      target: { value: '这是一条用于量失败身份文案的探针描述内容。' },
    })
    fireEvent.click(screen.getByRole('button', { name: 't:submit' }))
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1))
  }

  it('游客 POST 实测 403 ⇒ 上屏"没有权限执行此操作",原文不上屏', async () => {
    fetchApiMock.mockResolvedValue(REAL_403_CSRF satisfies ApiResult<unknown>)
    await submit()
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
    const shown = toastError.mock.calls[0]?.[0]
    expect(shown).toBe('没有权限执行此操作')
    expect(shown).not.toContain('CSRF')
    // 失败就是失败:不得出现成功提示,也不得跳转(副作用没发生)
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('会话过期实测 401 ⇒ 上屏"登录已过期,请重新登录"而非英文原文', async () => {
    fetchApiMock.mockResolvedValue(REAL_401_GUEST satisfies ApiResult<unknown>)
    await submit()
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
    const shown = toastError.mock.calls[0]?.[0]
    expect(shown).toBe('登录已过期,请重新登录')
    expect(shown).not.toContain('Authentication required')
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('错误没带任何可用信息时回落到本页词表(证明判空臂不是死代码)', async () => {
    fetchApiMock.mockResolvedValue({ success: false, error: '', status: 500 })
    await submit()
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
    expect(toastError.mock.calls[0]?.[0]).toBe('t:failed')
  })

  it('成功臂仍写回数据并跳转(本票没把功能改成只会报错)', async () => {
    fetchApiMock.mockResolvedValue({ success: true, data: { id: 'x', title: 'ok' } })
    await submit()
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1))
    expect(pushMock).toHaveBeenCalledWith('/plaza')
    expect(toastError).not.toHaveBeenCalled()
  })
})

describe('③ 源码锁:广场族只有一份 api(),发布页不再手搓丢身份的写法', () => {
  const root = resolve(__dirname, '..')
  const read = (rel: string) => readFileSync(join(root, rel), 'utf8')
  const pageSource = read('app/(main)/plaza/new/page.tsx')
  const helpersSource = read('app/(main)/plaza/helpers.ts')

  it('发布页不得再出现 throw new Error(r.error) / 直读 e.message 上屏', () => {
    expect(pageSource).not.toMatch(/throw new Error\(\s*r\.error\s*\)/)
    expect(pageSource).not.toMatch(/toast\.error\(\s*\(e as Error\)\.message/)
    expect(pageSource).toMatch(/from '\.\.\/helpers'/)
  })

  it('api() 只在 helpers 里实现一次(两处各写一遍必然漂开)', () => {
    const implCount = [pageSource, helpersSource].filter((s) =>
      /export async function api<|async function api</.test(s),
    ).length
    expect(implCount).toBe(1)
    expect(helpersSource).toMatch('apiFailureToError(r)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
