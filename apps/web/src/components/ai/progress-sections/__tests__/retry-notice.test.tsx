// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D39/D108 上游重试交代(web 消费端)。第 42 轮我只把通道做进 api-client + web 的 injections,
// retry_scheduled 在 web/extension 一直 0 命中 —— 本用例锁住"帧真的进界面",并钉死
// "retryInMs=0 不得写成 0 秒后继续"这条假精确。措辞断言取自真实 web 词包,防写死中文。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', async () => {
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(readFile(pack, 'utf8')) as { ai?: { pane?: Record<string, string> } }
  const pane = root.ai?.pane ?? {}
  if (Object.keys(pane).length === 0) throw new Error('web 语言包没有 ai.pane 命名空间')
  return {
    useTranslations:
      () =>
      (key: string, values?: Record<string, string | number>): string => {
        const raw = pane[key]
        if (raw === undefined) return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
  }
})

import { RetryNotice } from '../retry-notice'

const here = dirname(fileURLToPath(import.meta.url))
const panePack = (
  JSON.parse(
    readFileSync(join(here, '../../../../../../../packages/i18n/messages/web/zh-CN.json'), 'utf8'),
  ) as { ai: { pane: Record<string, string> } }
).ai.pane

afterEach(() => cleanup())

describe('RetryNotice(D39/D108)', () => {
  it('退避重试:出"第 N/M 次 + 秒数"的本地化文案', () => {
    const { getByTestId } = render(
      <RetryNotice notice={{ attempt: 2, maxRetries: 3, retryInMs: 4000 }} />,
    )
    const text = getByTestId('retry-notice').textContent ?? ''
    expect(text).toContain('2/3')
    expect(text).toContain('4')
    const expected = panePack.retryScheduled
    expect(typeof expected).toBe('string')
    // 整句相等(不是"包含"):证明渲染的就是词包插值结果,没夹带写死文案
    expect(text).toBe(
      expected?.replace('{attempt}', '2').replace('{max}', '3').replace('{seconds}', '4'),
    )
  })

  it('retryInMs=0 说"立即",绝不出现"0 秒"', () => {
    const { getByTestId } = render(
      <RetryNotice notice={{ attempt: 1, maxRetries: 2, retryInMs: 0 }} />,
    )
    const text = getByTestId('retry-notice').textContent ?? ''
    expect(text).toContain('立即')
    expect(text).not.toMatch(/0\s*秒/)
  })

  it('httpStatus 有值才显示状态码(缺省不渲染 undefined/NaN)', () => {
    const withStatus = render(
      <RetryNotice notice={{ attempt: 1, maxRetries: 3, retryInMs: 1000, httpStatus: 429 }} />,
    )
    expect(withStatus.getByTestId('retry-notice').textContent).toContain('429')
    withStatus.unmount()
    const without = render(<RetryNotice notice={{ attempt: 1, maxRetries: 3, retryInMs: 1000 }} />)
    const text = without.getByTestId('retry-notice').textContent ?? ''
    expect(text).not.toMatch(/undefined|NaN/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
