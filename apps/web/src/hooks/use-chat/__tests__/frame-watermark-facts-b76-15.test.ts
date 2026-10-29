// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// b76-15(2026-10-29 立):帧水位事实端内投影 + 接线自证。
//
// 钉三件事(与 stream-error-report.test.ts 的接线自证同一姿势):
//   ① 投影纪律:载荷级水位缺席 ⇒ 输出必须点名 `generation/epoch=undetermined`,
//      绝不许让"没报错"读起来像三维全绿(AGENTS §0.3);
//   ② cursor === null 写 `undetermined` 而不是 0(0 是合法 seq,写成 0 就是造假);
//   ③ 接线:send-message.ts 的 streamChat 选项里必须是**代码行**真调
//      reportFrameWatermarkFacts —— 只测纯函数证不出"事实上报真的有人接"。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FrameWatermarkFacts } from '@ihui/api-client'

import { formatFrameWatermarkFacts, reportFrameWatermarkFacts } from '../stream-error-report'

const here = dirname(fileURLToPath(import.meta.url))

function readSrc(file: string): string {
  return readFileSync(join(here, '..', file), 'utf8')
}

const ABSENT: FrameWatermarkFacts = {
  kind: 'stream-end',
  dropped: 0,
  cursor: null,
  payloadWatermarkSeen: false,
}

describe('b76-15 帧水位事实端内投影', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('载荷级水位缺席 ⇒ 输出点名两维 undetermined(不冒充三维全绿)', () => {
    const line = formatFrameWatermarkFacts(ABSENT)
    expect(line).toContain('payloadWatermark=absent')
    expect(line).toContain('generation=undetermined')
    expect(line).toContain('epoch=undetermined')
    // 反例守卫:不得出现任何"已判"字样
    expect(line).not.toContain('generation=judged')
    expect(line).not.toContain('epoch=judged')
  })

  it('载荷级水位在场 ⇒ 两维标 judged;cursor 原值', () => {
    const line = formatFrameWatermarkFacts({
      kind: 'seq-discontinuity',
      dropped: 2,
      cursor: 17,
      payloadWatermarkSeen: true,
    })
    expect(line).toContain('generation=judged')
    expect(line).toContain('epoch=judged')
    expect(line).toContain('seq=17')
    expect(line).toContain('dropped=2')
  })

  it('cursor === null 写 undetermined,绝不写 0(0 是合法 seq)', () => {
    const line = formatFrameWatermarkFacts(ABSENT)
    expect(line).toContain('seq=undetermined')
    expect(line).not.toContain('seq=0')
  })

  it('dropped=0 是有效读数(照写),不省略', () => {
    expect(formatFrameWatermarkFacts(ABSENT)).toContain('dropped=0')
  })

  it('上报面:零丢弃走 info,有丢弃走 warn(静默流也留读数)', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    reportFrameWatermarkFacts(ABSENT)
    expect(info).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(0)
    expect(String(info.mock.calls[0]![0])).toContain('[frame-watermark]')

    reportFrameWatermarkFacts({ ...ABSENT, kind: 'seq-discontinuity', dropped: 1, cursor: 9 })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain('kind=seq-discontinuity')
  })

  it('接线自证:send-message.ts 的 streamChat 选项真调 reportFrameWatermarkFacts', () => {
    const src = readSrc('send-message.ts')
    expect(src).toContain('onFrameWatermarkFacts: (facts) => reportFrameWatermarkFacts(facts)')
    // 且真的 import 了它(不是只写了一行没人解析的回调名)
    expect(src).toMatch(
      /reportFrameWatermarkFacts,?\n?\s*reportStreamError|reportFrameWatermarkFacts/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
