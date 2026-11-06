// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 学生本人「签退」入口(miniapp-taro)验收。
 *
 * 取证边界(如实):本仓小程序端无 DOM 测试环境(无 @testing-library / react-test-renderer),
 * 所以这里证的是**静态渲染输出**(renderToStaticMarkup)、**请求出口**(直接调导出的
 * submitSelfCheckOut)与**载荷键集**;不是"真机点过按钮"。
 *
 * 三条真不变量:
 *  ① 签退载荷只有 date —— 身份/班级/状态/方式都由后端现算,端上自报即等于把签退判定权搬回客户端;
 *  ② 不可签退时组件不挂载(今日未签到/已签退都不会出现按钮);
 *  ③ 失败原因必须可上屏(不吞 401/403/409 的 message)。
 */
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/taro', () => ({ default: { showToast: vi.fn() } }))
vi.mock('@/i18n', () => ({ useI18n: () => ({ t: (k: string) => `«${k}»` }) }))
vi.mock('@/components/Button', () => ({
  Button: (props: { children?: ReactNode; loading?: boolean }) =>
    createElement('button', { 'data-loading': props.loading ? '1' : '0' }, props.children),
}))
vi.mock('@/api', () => ({ post: vi.fn() }))

import {
  SELF_CHECK_OUT_URL,
  SelfCheckOutAction,
  submitSelfCheckOut,
} from '@/pkg-user/edu-my-attendance/checkout-action'
import { buildSelfCheckOutPayload } from '@/pkg-user/edu-mgmt-attendance/contract'

const DATE = '2026-11-08'
const postMock = vi.fn()

beforeEach(() => {
  postMock.mockReset()
})

describe('自签退请求出口', () => {
  it('① POST 固定端点,载荷只有业务日(date),不夹带身份/班级/状态/方式', async () => {
    postMock.mockResolvedValue({ classId: 'c1', status: 'present', checkOutTime: 'x' })
    const r = await submitSelfCheckOut(DATE, postMock)
    expect(r).toEqual({ ok: true, status: 'present' })
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock.mock.calls[0]?.[0]).toBe(SELF_CHECK_OUT_URL)
    const payload = (postMock.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>
    expect(payload).toEqual({ date: DATE })
    const keys = Object.keys(payload)
    for (const k of ['studentId', 'classId', 'status', 'checkOutMethod']) {
      expect(keys, `payload 不得自报 ${k}`).not.toContain(k)
    }
  })

  it('①b 载荷构造单源在 contract.ts,键集恰为 ["date"]', () => {
    expect(buildSelfCheckOutPayload(DATE)).toEqual({ date: DATE })
    expect(Object.keys(buildSelfCheckOutPayload(DATE))).toEqual(['date'])
  })

  it('③ 服务端拒绝时把 message 原样交回调用方(不吞 403/409 原因)', async () => {
    postMock.mockRejectedValue(new Error('409 今日已签退'))
    const r = await submitSelfCheckOut(DATE, postMock)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('409 今日已签退')
  })
})

describe('签退入口挂载面', () => {
  const onDone = () => undefined

  it('② 可签退(今日已签到未签退)⇒ 按钮挂载,文案取共享词表 eduAttendance.checkOut', () => {
    const html = renderToStaticMarkup(
      createElement(SelfCheckOutAction, { date: DATE, canCheckOut: true, onDone }),
    )
    expect(html).toContain('«eduAttendance.checkOut»')
    expect(html).not.toContain('data-loading="1"')
  })

  it('② 不可签退(未签到/已签退)⇒ 入口不挂载,不给假按钮', () => {
    const html = renderToStaticMarkup(
      createElement(SelfCheckOutAction, { date: DATE, canCheckOut: false, onDone }),
    )
    expect(html).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
