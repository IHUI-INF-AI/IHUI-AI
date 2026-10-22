// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import {
  tryConsumeWindows,
  incrWindow,
  resetCounters,
  __test__ as wc,
} from '../src/utils/window-counter.js'

/**
 * 多档限速计数器的契约。
 *
 * 立票理由(2026-10-22):发码链原来有三档进程内 Map(60s / 1h / 24h),两个缺陷叠在一起 ——
 *  ① 住在进程内 ⇒ **一次部署就把配额清零**,而 24h 档的上限正是云侧那 100~200 条免费额度的护栏;
 *  ② 逐档"先加后判" ⇒ 被最窄一档挡下的请求,照样把宽档配额也烧掉了。
 * 本文件把 ② 钉死:被挡的那一次,一档都不许加。
 */

describe('tryConsumeWindows：多档必须"先全判、后全加"', () => {
  beforeEach(async () => {
    await resetCounters(['t:'])
  })

  it('本轮档位由运行者声明(否则两档跑出来长得一样)', async () => {
    const declared = process.env.IHUI_EXPECT_BACKEND
    if (!declared) return
    // 客户端是首次调用时懒建的,冷启动那一刻 status 还是 connecting ⇒ 必须给一次短轮询,
    // 否则 redis 档会被误读成 memory 档(实测踩过)。
    let seen = wc.backend()
    for (let i = 0; i < 20 && seen !== declared; i++) {
      await new Promise((r) => setTimeout(r, 100))
      seen = wc.backend()
    }
    expect(seen).toBe(declared)
  })

  it('第一次放行,60 秒内第二次被最窄一档挡下', async () => {
    const specs = [
      { key: 't:x:60s', windowMs: 60_000, max: 1 },
      { key: 't:x:24h', windowMs: 86_400_000, max: 20 },
    ]
    expect(await tryConsumeWindows(specs)).toBe(0)
    expect(await tryConsumeWindows(specs)).toBe(1)
  })

  it('被挡的那一次不得烧掉宽档配额(旧写法"先加后判"在此翻红)', async () => {
    const narrow = { key: 't:y:60s', windowMs: 60_000, max: 1 }
    const wide = { key: 't:y:24h', windowMs: 86_400_000, max: 20 }
    expect(await tryConsumeWindows([narrow, wide])).toBe(0) // 两档各 +1
    expect(await tryConsumeWindows([narrow, wide])).toBe(1) // 被窄档挡下

    // 宽档此刻应当只被加过一次。把它的上限压到 2 再单独试同一把键:
    // 先判后加 ⇒ 1 < 2 ⇒ 放行(返回 0);先加后判 ⇒ 已被烧到 2 ⇒ 当场挡下(返回 1)。
    expect(await tryConsumeWindows([{ ...wide, max: 2 }])).toBe(0)
  })

  it('超宽档时返回该档的序号(1 起算),调用方据此挑文案', async () => {
    const a = { key: 't:z:60s', windowMs: 60_000, max: 3 }
    const b = { key: 't:z:1h', windowMs: 3_600_000, max: 2 }
    expect(await tryConsumeWindows([a, b])).toBe(0)
    expect(await tryConsumeWindows([a, b])).toBe(0)
    expect(await tryConsumeWindows([a, b])).toBe(2) // 第 3 次撞在 b 上
  })
})

describe('incrWindow / resetCounters', () => {
  beforeEach(async () => {
    await resetCounters(['t:'])
  })

  it('同键累加,reset 后归零', async () => {
    expect(await incrWindow('t:acc', 60_000)).toBe(1)
    expect(await incrWindow('t:acc', 60_000)).toBe(2)
    await resetCounters(['t:'])
    expect(await incrWindow('t:acc', 60_000)).toBe(1)
  })

  it('不同键互不影响(键里必须带着窗口与标识,否则两档会互相吃数)', async () => {
    expect(await incrWindow('t:k1:60s', 60_000)).toBe(1)
    expect(await incrWindow('t:k2:60s', 60_000)).toBe(1)
    expect(await incrWindow('t:k1:60s', 60_000)).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
