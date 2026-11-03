// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-660:版本比较四态 —— 不可解析不得折成 0,须返回 unknown,且两个消费点同尺。
//
// 立项现读(修前):`compareVersions('invalid','1.0.0')` 返回 **-1**(把垃圾折成 0.0.0 后"低于 1.0.0"),
// 于是 `decideGate('0.0.0', {minimumVersion:'2.0.0'})` 判 blocked=true 直接退出进程,
// 而同一事实上 `enforceServerMinimumVersion` 对 UNKNOWN_VERSION 一律放行 —— 同一个版本两把答案。
// 本文件成对钉住:① 不可解析 ⇒ unknown(不拦但喊"判不了");② 真低于最低版 ⇒ 照拦(证明不是把门修瞎)。
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  UNKNOWN_VERSION,
  compareVersionsOrUnknown,
  decideGate,
  parseVersionTriple,
  updateOutcome,
  versionOutcome,
} from '../src/updater.js'

const facts = (minimumVersion: string | null): { minimumVersion: string | null; source: string; reason: string } => ({
  minimumVersion,
  source: 'env',
  reason: '配置文件 config/cli-min-version.json',
})

describe('parseVersionTriple:严格 X.Y.Z,其余一律 null', () => {
  it('可解析 ⇒ 三段数字', () => {
    expect(parseVersionTriple('1.2.3')).toEqual([1, 2, 3])
    expect(parseVersionTriple('0.0.0')).toEqual([0, 0, 0])
  })

  it('票面点名的两型必得 null(不是 0.0.0、不是"相等")', () => {
    expect(parseVersionTriple('v1.2.3-beta')).toBe(null)
    expect(parseVersionTriple('abc')).toBe(null)
    expect(parseVersionTriple('1.2')).toBe(null)
    expect(parseVersionTriple(undefined)).toBe(null)
  })
})

describe('compareVersionsOrUnknown:决策面唯一出口', () => {
  it('逐段整数比仍成立(1.10 > 1.9,不许退回字符串比)', () => {
    expect(compareVersionsOrUnknown('1.10.0', '1.9.0')).toBe(1)
    expect(compareVersionsOrUnknown('1.9.0', '1.10.0')).toBe(-1)
    expect(compareVersionsOrUnknown('2.0.0', '2.0.0')).toBe(0)
  })

  it('任一端不可解析 ⇒ null', () => {
    expect(compareVersionsOrUnknown('v1.2.3-beta', '1.0.0')).toBe(null)
    expect(compareVersionsOrUnknown('1.0.0', 'abc')).toBe(null)
  })
})

describe('versionOutcome / updateOutcome:unknown 不与 ok 并桶', () => {
  it('不可解析 ⇒ unknown 且不拦人', () => {
    expect(versionOutcome('abc', '1.0.0')).toEqual({ belowMinimum: false, minimumStatus: 'unknown' })
    expect(updateOutcome('abc', '1.2.0')).toEqual({ hasUpdate: false, updateStatus: 'unknown' })
  })

  it('没有配最低版本 ⇒ ok(服务端明确要求过"不拦")', () => {
    expect(versionOutcome('1.0.0', undefined)).toEqual({ belowMinimum: false, minimumStatus: 'ok' })
  })

  it('真低于最低版 ⇒ below(阳性对照:收紧没把判断修成恒放行)', () => {
    expect(versionOutcome('1.0.0', '2.0.0')).toEqual({ belowMinimum: true, minimumStatus: 'below' })
    expect(updateOutcome('1.0.0', '1.2.0')).toEqual({ hasUpdate: true, updateStatus: 'available' })
  })
})

describe('decideGate 与 enforceServerMinimumVersion 对同一事实同尺(G-660 的落点)', () => {
  it('哨兵版本 0.0.0 ⇒ determined:false、blocked:false,并且喊出"不是已满足"', () => {
    const r = decideGate(UNKNOWN_VERSION, facts('2.0.0'))
    expect(r.blocked).toBe(false)
    expect(r.determined).toBe(false)
    expect(r.reason).toMatch(/NOT the same as satisfying it/)
    // 修前这里是 blocked=true —— 与 enforce 的"一律放行"对同一个版本给相反答案
  })

  it('当前版本不可解析 ⇒ 同样 determined:false(两把答案不得再分叉)', () => {
    const a = decideGate('v1.2.3-beta', facts('2.0.0'))
    expect([a.blocked, a.determined]).toEqual([false, false])
  })

  it('真低于最低版 ⇒ blocked:true、determined:true(阳性对照)', () => {
    const r = decideGate('1.0.0', facts('2.0.0'))
    expect([r.blocked, r.determined]).toEqual([true, true])
  })

  it('服务端回答"没有要求" ⇒ determined:true(那是一个结论,不是没判)', () => {
    const r = decideGate('1.0.0', facts(null))
    expect([r.blocked, r.determined, r.requiredVersion]).toEqual([false, true, null])
  })

  it('响应形状不认识 ⇒ determined:false(不得记成 pass)', () => {
    const r = decideGate('1.0.0', null)
    expect([r.blocked, r.determined]).toEqual([false, false])
  })
})

describe('反向锁:决策面不得再走宽松档', () => {
  const src = readFileSync(new URL('../src/updater.ts', import.meta.url), 'utf8')

  it('decideGate / versionOutcome / updateOutcome 体内只调 compareVersionsOrUnknown', () => {
    const body = (name: string): string => {
      const at = src.indexOf(`export function ${name}(`)
      expect(at).toBeGreaterThan(-1)
      const next = src.indexOf('\nexport ', at + 1)
      return src.slice(at, next === -1 ? src.length : next)
    }
    for (const name of ['decideGate', 'versionOutcome', 'updateOutcome']) {
      const b = body(name)
      // 宽松档 compareVersions( 仍允许存在于展示面与旧测试,但三条决策出口里一次都不许出现
      expect(b.replace(/compareVersionsOrUnknown\(/g, '')).not.toMatch(/\bcompareVersions\(/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
