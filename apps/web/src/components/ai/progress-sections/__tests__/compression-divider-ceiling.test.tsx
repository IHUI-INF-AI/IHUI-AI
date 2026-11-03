// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-150:trigger=incompressible 必须换口径(警示行 + 下一步指引),不能继续给一条低调分隔线。
// 措辞断言取真实 web 词包(chat.compaction.*),防"写死中文也能过"。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', async () => {
  const { readFileSync: rd } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(rd(pack, 'utf8')) as { chat?: { compaction?: Record<string, string> } }
  const comp = root.chat?.compaction ?? {}
  if (Object.keys(comp).length === 0) throw new Error('web 语言包没有 chat.compaction 命名空间')
  return {
    useTranslations:
      () =>
      (key: string, values?: Record<string, string | number>): string => {
        const leaf = key.startsWith('compaction.') ? key.slice('compaction.'.length) : key
        const raw = comp[leaf]
        if (raw === undefined) return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
  }
})

import { CompressionDivider } from '../compression-divider'

const here = dirname(fileURLToPath(import.meta.url))
const compPack = (
  JSON.parse(
    readFileSync(join(here, '../../../../../../../packages/i18n/messages/web/zh-CN.json'), 'utf8'),
  ) as { chat: { compaction: Record<string, string> } }
).chat.compaction

afterEach(() => cleanup())

describe('CompressionDivider 上限口径(G-150)', () => {
  it('incompressible → 出警示行与下一步,role=status', () => {
    const { getByTestId, queryByRole } = render(
      <CompressionDivider
        compaction={{ originalTokens: 120000, compressedTokens: 118000, trigger: 'incompressible' }}
      />,
    )
    const box = getByTestId('compaction-ceiling')
    expect(box.textContent).toBe(`${compPack.ceilingTitle}${compPack.ceilingHint}`)
    expect(queryByRole('separator')).toBeNull()
  })

  it('普通压缩仍是低调分隔线,不出警示行', () => {
    const { getByRole, queryByTestId } = render(
      <CompressionDivider
        compaction={{ originalTokens: 120000, compressedTokens: 90000, trigger: 'llm' }}
      />,
    )
    expect(getByRole('separator')).toBeTruthy()
    expect(queryByTestId('compaction-ceiling')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
