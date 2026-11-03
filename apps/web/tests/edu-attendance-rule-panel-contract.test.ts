// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤规则面板 / 扫码签到面板的契约锁(2026-11-03,ATT-WEB 票)
 *
 * 钉三件事(机主原话口径):
 * ① 后端 `GET /attendance/rule` 回 `rule: null` 时界面必须显示"未配置",**不得补 00:00**
 *    (补零等于把"没规则"谎报成"规则是零点",缺勤自动补录会据此判定);
 * ② 非法 HH:MM 必须把**后端 message 原样上屏**,且输入框保留用户原值(不回落、不静默清空)
 *    —— 与 §0.3"取不到不冒充"同一条纪律;
 * ③ qrSecret 原文永不上屏:面板只渲染 `qrSecretConfigured` 布尔与轮换回执的指纹,
 *    二维码载荷只交给 QRCodeSVG,不以文本形态出现。
 *
 * 纪律(AGENTS §22c):本文件**不 mock next-intl**,挂真 NextIntlClientProvider + 真词包
 * (zh-CN.json),期望文案从真词包取,不抄字面量。因白名单指定 `.ts` 后缀,渲染用
 * React.createElement(vitest esbuild 已配 jsx: automatic,两种形态都可)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as React from 'react'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

const apiOrThrowMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', () => ({ apiOrThrow: apiOrThrowMock }))

import { AttendanceRulePanel } from '../app/(main)/edu/edu-management/attendance/AttendanceRulePanel'
import { CheckInQrPanel } from '../app/(main)/edu/edu-management/attendance/CheckInQrPanel'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_FILE = join(here, '../../../packages/i18n/messages/web/zh-CN.json')
const messages = JSON.parse(readFileSync(MESSAGES_FILE, 'utf8')) as Record<string, unknown>
const att = messages.eduAttendance as Record<string, string>
/** 从真词包取词条(抄字面量就成了"测试替身自证") */
const w = (key: string): string => att[key] ?? ''
/** 把词包模板里的 ICU 占位编译成匹配任意秒数的正则(倒计时读数每秒都变) */
const EXPIRES_RE = (): RegExp =>
  new RegExp('^' + w('qrExpiresIn').replace('{seconds}', '\\d+') + '$')

const CLASS_ID = '11111111-1111-4111-8111-111111111111'
/** 假密钥:后端结构上不会把它回出来,一旦界面出现即证明"密钥原文上屏" */
const FAKE_SECRET = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

function renderPanel(node: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(NextIntlClientProvider, { locale: 'zh-CN', messages }, node),
    ),
  )
}

/** 按 URL + method 分流的假 fetch 层(只喂 apiOrThrow,不发真请求) */
function fakeApi(handler: (url: string, init?: RequestInit) => unknown): void {
  apiOrThrowMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const result = handler(url, init)
    if (result instanceof Error) throw result
    return result
  })
}

afterEach(() => {
  cleanup()
  apiOrThrowMock.mockReset()
})

describe('AttendanceRulePanel', () => {
  it('① 后端回 rule:null 时显示"未配置",三个输入框留空而不补 00:00', async () => {
    fakeApi((url) => (url.includes('/attendance/rule') ? { rule: null } : { rule: null }))
    const { container } = renderPanel(
      React.createElement(AttendanceRulePanel, { classId: CLASS_ID }),
    )

    await waitFor(() => expect(container.textContent).toContain(w('ruleNotConfigured')))
    expect(container.textContent).not.toContain('00:00')
    for (const field of ['lateAfter', 'earlyBefore', 'absentAfter']) {
      const input = container.querySelector(`#att-rule-${field}`) as HTMLInputElement | null
      expect(input, `缺少输入框 ${field}`).not.toBeNull()
      expect(input!.value).toBe('')
    }
  })

  it('② 非法 HH:MM:后端 message 原样上屏,输入框保留用户原值(不回落)', async () => {
    const serverRule = {
      id: 'r1',
      classId: CLASS_ID,
      lateAfter: '08:30',
      earlyBefore: '17:00',
      absentAfter: null,
      enabled: true,
      qrSecretConfigured: true,
      qrSecret: FAKE_SECRET,
    }
    const badMessage = `时间格式非法:lateAfter="25:99"(必须可归一化为 HH:MM)`
    fakeApi((url, init) => {
      if (init?.method === 'PUT') return new Error(badMessage)
      return { rule: serverRule }
    })
    const { container } = renderPanel(
      React.createElement(AttendanceRulePanel, { classId: CLASS_ID }),
    )
    await waitFor(() => expect(apiOrThrowMock).toHaveBeenCalled())

    const late = container.querySelector('#att-rule-lateAfter') as HTMLInputElement
    await waitFor(() => expect(late.value).toBe('08:30'))
    fireEvent.change(late, { target: { value: '25:99' } })
    fireEvent.click(screen.getByRole('button', { name: w('ruleSave') }))

    await waitFor(() => expect(container.textContent).toContain(badMessage))
    expect(late.value).toBe('25:99')
    expect(container.textContent).not.toContain('00:00')
  })

  it('③ 界面不渲染 qrSecret 原文,只渲染 qrSecretConfigured 的文案', async () => {
    fakeApi(() => ({
      rule: {
        id: 'r1',
        classId: CLASS_ID,
        lateAfter: '08:30',
        earlyBefore: '17:00',
        absentAfter: '09:30',
        enabled: true,
        qrSecretConfigured: false,
        qrSecret: FAKE_SECRET,
      },
    }))
    const { container } = renderPanel(
      React.createElement(AttendanceRulePanel, { classId: CLASS_ID }),
    )
    await waitFor(() =>
      expect((container.querySelector('#att-rule-lateAfter') as HTMLInputElement).value).toBe(
        '08:30',
      ),
    )

    expect(container.textContent).not.toContain(FAKE_SECRET)
    expect(container.textContent).not.toContain('qrSecret')
    expect(container.textContent).toContain(w('ruleQrSecretOff'))
  })
})

describe('CheckInQrPanel', () => {
  it('二维码载荷只进 QRCodeSVG,不以文本形态上屏;读数保持单行', async () => {
    const payload = JSON.stringify({
      type: 'edu-attendance-checkin',
      version: 1,
      classId: CLASS_ID,
      token: FAKE_SECRET,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    fakeApi((url) =>
      url.includes('/attendance/qrcode')
        ? { payload, classId: CLASS_ID, expiresAt: JSON.parse(payload).expiresAt, ttlMs: 60_000 }
        : { rule: null },
    )
    const { container } = renderPanel(React.createElement(CheckInQrPanel, { classId: CLASS_ID }))

    // 词包里的 "将在 {seconds}s 后过期" 编译成正则(不抄字面量);命中即证明二维码已到货
    const readout = await screen.findByText(EXPIRES_RE())
    expect(screen.getByTestId('attendance-qr').querySelector('svg')).not.toBeNull()
    expect(container.textContent).not.toContain(FAKE_SECRET)
    expect(container.textContent).not.toContain('token')
    expect(container.textContent).toContain(w('qrPanelTitle'))
    // 门 240:一格一读数必须整条单行
    expect(readout.className).toContain('whitespace-nowrap')
    expect(readout.textContent).toMatch(EXPIRES_RE())
  })

  it('后端 400(未配规则/未轮换)时给出可执行下一步提示', async () => {
    fakeApi(() => new Error('该班未配置启用中的考勤规则或未设置扫码密钥(qrSecret)'))
    const { container } = renderPanel(React.createElement(CheckInQrPanel, { classId: CLASS_ID }))

    await waitFor(() =>
      expect(container.textContent).toContain('该班未配置启用中的考勤规则或未设置扫码密钥'),
    )
    expect(container.textContent).toContain(w('qrNeedSetup'))
    expect(screen.queryByTestId('attendance-qr')).toBeNull()
  })

  it('轮换成功:显示指纹回执并重取二维码,界面仍无密钥原文', async () => {
    let qrCalls = 0
    fakeApi((url, init) => {
      if (init?.method === 'POST') return { rotated: true, fingerprint: 'a1b2c3' }
      if (url.includes('/attendance/qrcode')) {
        qrCalls += 1
        return {
          payload: JSON.stringify({ type: 'edu-attendance-checkin', token: FAKE_SECRET }),
          classId: CLASS_ID,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          ttlMs: 60_000,
        }
      }
      return { rule: null }
    })
    const { container } = renderPanel(React.createElement(CheckInQrPanel, { classId: CLASS_ID }))
    await screen.findByText(EXPIRES_RE())
    const before = qrCalls

    fireEvent.click(screen.getByRole('button', { name: w('qrRotateSecret') }))
    await waitFor(() => expect(container.textContent).toContain('a1b2c3'))
    expect(qrCalls).toBeGreaterThan(before)
    expect(container.textContent).not.toContain(FAKE_SECRET)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
