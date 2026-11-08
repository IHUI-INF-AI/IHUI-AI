// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 A —— 倒数秒数在「重发」按钮上真的上屏,且全 locale 模板都带占位符。
 *
 * 缺陷形态(修前):mobile-rn 5 个 locale 的 `auth.resendCode` 是纯「重新发送」,而调用点
 * `VerifyCodeModal` 已经传了 `{ seconds: remaining }` ⇒ 占位参数被静默丢弃,用户只看得到
 * “重新发送”,看不见还剩几秒;web 同键是 `{seconds}s 后重发`,两端同一句话两种读法。
 *
 * 三条判据:
 * ① 5 个 locale 的 `auth.resendCode` 必须含 `{seconds}`;
 * ② 真渲染:点「重新发送」后倒计时复位到 60,按钮文案必须含这个 60(不是模板恒真);
 * ③ 反向全扫:任何 `t('key', { ... })` 调用传的参数,必须在同键模板里存在占位符 ——
 *    这条把“调用点传了、模板没有”的整族缺陷变成一道常驻尺(不止本票那 5 个键)。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { getValueByPath, messages, I18nProvider, type Locale } from '../src/i18n'
import { VerifyCodeModal } from '../src/components/VerifyCodeModal'

vi.mock('../src/theme/active-tokens', async () => {
  const { rnLightTokens } = await import('@ihui/design-tokens')
  return { tokens: rnLightTokens }
})

const LOCALES: Locale[] = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']

function templateOf(locale: Locale, key: string): string {
  const value = getValueByPath(messages[locale], key)
  return typeof value === 'string' ? value : ''
}

afterEach(cleanup)

describe('票 A:重发倒计时的秒数上屏', () => {
  it('5 个 locale 的 auth.resendCode 都含 {seconds} 占位符', () => {
    for (const locale of LOCALES) {
      expect(templateOf(locale, 'auth.resendCode'), `locale=${locale}`).toContain('{seconds}')
    }
  })

  it('渲染输出含剩余秒数(点重发后倒计时复位到 60,按钮文案带 60)', async () => {
    render(
      <I18nProvider>
        <VerifyCodeModal
          visible
          phone="13800000000"
          onClose={() => {}}
          onSubmit={() => {}}
          onResend={async () => {}}
        />
      </I18nProvider>,
    )
    // 初始 remaining=0 ⇒ 按钮是 verify.resend(纯「重新发送」)
    const resend = screen.getByText('重新发送')
    await act(async () => {
      fireEvent.click(resend)
    })
    // remaining=60 ⇒ 必须走 auth.resendCode 且真的把秒数插进去
    expect(screen.getByText('60s 后重发')).toBeTruthy()
    expect(screen.queryByText('重新发送')).toBeNull()
  })
})

/**
 * 反向全扫:调用点传了参数,模板就必须有这个占位符。
 *
 * 只认字面量键 + 字面量对象实参(`t('k', { a: x })`);变量形态的实参这段静态尺看不见,
 * 属于本尺的已知边界(宁漏不误报),由端内 t() 的运行时插值兜住。
 */
function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) listSourceFiles(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

function callsWithParams(src: string): Array<{ key: string; params: string[] }> {
  const calls: Array<{ key: string; params: string[] }> = []
  const re = /\btt?\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*\{/g
  let match: RegExpExecArray | null
  while ((match = re.exec(src))) {
    let i = re.lastIndex
    let depth = 1
    while (i < src.length && depth > 0) {
      const ch = src[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      i++
    }
    const body = src.slice(re.lastIndex, i - 1)
    const params = [...body.matchAll(/(?:^|,)\s*(\w+)\s*:/g)].map((m) => m[1] ?? '')
    if (params.length) calls.push({ key: match[2] ?? '', params })
  }
  return calls
}

describe('反向全扫:调用点参数必须在模板里有占位符', () => {
  it('src 下全部 t(key, {...}) 调用不得有被静默丢弃的参数', () => {
    const files = listSourceFiles(resolve(__dirname, '../src'))
    const drops: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const call of callsWithParams(src)) {
        const template = templateOf('zh-CN', call.key)
        if (!template) continue // 键不在本端词表:由 t() 的 key-as-text 兜底,不属本尺
        for (const param of call.params) {
          if (!new RegExp(`\\{\\{?\\s*${param}\\b`).test(template)) {
            drops.push(`${call.key} 丢失参数 {${param}}（模板=${JSON.stringify(template)}）`)
          }
        }
      }
    }
    expect(drops).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
