// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  claimIdFromFileName,
  classifyClaimFreshness,
  evaluateServiceClaim,
  isClaimFileName,
  parseServiceClaim,
  selectLiveEndpoints,
  type ServiceClaim,
} from '../src/local-registry/claim'

const NOW = 1_800_000_000_000
const claim = (over: Partial<ServiceClaim> = {}): ServiceClaim => ({
  id: 'a1',
  port: 45_123,
  pid: 4242,
  timestamp: NOW - 1_000,
  generation: 'gen-x',
  ...over,
})

/** 全绿的注入:新鲜 + 进程活 + 端口自述同代次 */
const good = {
  now: NOW,
  isPidAlive: () => true,
  probeEndpoint: (port: number) => (port === 45_123 ? { generation: 'gen-x' } : null),
}

describe('认领件新鲜度:三态而不是两态', () => {
  it('① 心跳在窗口内 ⇒ fresh;超线 ⇒ stale(与对侧同档 30s)', () => {
    expect(classifyClaimFreshness(claim(), { now: NOW }).state).toBe('fresh')
    expect(classifyClaimFreshness(claim({ timestamp: NOW - 31_000 }), { now: NOW }).state).toBe(
      'stale',
    )
  })

  it('② 时刻超前 ⇒ unjudged(不判新鲜也不判陈旧);容忍窗内仍算新鲜', () => {
    expect(classifyClaimFreshness(claim({ timestamp: NOW + 4_000 }), { now: NOW }).state).toBe(
      'fresh',
    )
    const r = classifyClaimFreshness(claim({ timestamp: NOW + 60_000 }), { now: NOW })
    expect(r.state).toBe('unjudged')
    expect(r.reason).toContain('超前')
  })

  it('③ 脏时刻(NaN/Infinity)⇒ unjudged,不折成陈旧', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(classifyClaimFreshness(claim({ timestamp: bad }), { now: NOW }).state).toBe('unjudged')
    }
  })
})

describe('完整裁决:每条被拒都必须带原因,零静默丢弃', () => {
  it('④ 三要素齐备才 usable', () => {
    expect(evaluateServiceClaim(claim(), good).verdict).toBe('usable')
  })

  it('⑤ 代次不符 ⇒ 拒(对侧只判 pid+时刻,这一维是防伪造认领件的加强)', () => {
    const r = evaluateServiceClaim(claim(), {
      ...good,
      probeEndpoint: () => ({ generation: 'gen-VICTIM' }),
    })
    expect(r.verdict).toBe('rejected')
    expect(r.reason).toContain('代次不符')
  })

  it('⑥ 端口自称活但无应答 ⇒ 拒;pid 消亡 ⇒ 拒', () => {
    expect(evaluateServiceClaim(claim(), { ...good, probeEndpoint: () => null }).verdict).toBe(
      'rejected',
    )
    expect(
      evaluateServiceClaim(claim({ pid: 1 }), { ...good, isPidAlive: () => false }).reason,
    ).toContain('进程已消亡')
  })

  it('⑦ 缺注入 ⇒ unusable-unjudged(少一道核验不能被读成"那道核验过了")', () => {
    const noProbe = evaluateServiceClaim(claim(), { now: NOW, isPidAlive: () => true })
    expect(noProbe.verdict).toBe('unusable-unjudged')
    expect(noProbe.reason).toContain('probeEndpoint')
    const noPid = evaluateServiceClaim(claim(), { now: NOW, probeEndpoint: good.probeEndpoint })
    expect(noPid.reason).toContain('isPidAlive')
  })

  it('⑧ 记录没写代次 ⇒ 不做假核验,直接放行该维(与"不符即拒"分开,免得把旧件全判死)', () => {
    const r = evaluateServiceClaim(claim({ generation: undefined }), {
      ...good,
      probeEndpoint: () => ({}),
    })
    expect(r.verdict).toBe('usable')
  })
})

describe('批量选取与解析', () => {
  it('⑨ 枚举到 0 条候选 ⇒ unjudged,不用空数组冒充"本机没有实例"', () => {
    const r = selectLiveEndpoints([], good)
    expect(r.state).toBe('unjudged')
    expect(r.usable).toEqual([])
  })

  it('⑩ 混合批次:可用的进 usable,其余逐条点名(含形状坏的)', () => {
    const r = selectLiveEndpoints(
      [claim(), claim({ id: 'dead', pid: 9 }), { error: 'port 不是有限数字:undefined' }],
      { ...good, isPidAlive: (pid) => pid === 4242 },
    )
    expect(r.usable.map((u) => u.id)).toEqual(['a1'])
    expect(r.rejected.map((x) => x.id)).toEqual(['dead', null])
    expect(r.rejected[1]?.reason).toContain('port')
    expect(r.state).toBe('ok')
  })

  it('⑪ 解析不猜默认值:缺 pid / port 越界 / 非对象 一律带原因拒收', () => {
    expect(parseServiceClaim({ id: 'x', port: 1, timestamp: 1 }).error).toContain('pid')
    expect(parseServiceClaim({ id: 'x', port: 70_000, pid: 1, timestamp: 1 }).error).toContain(
      '越界',
    )
    expect(parseServiceClaim('nope').error).toContain('顶层不是对象')
    // 文件名带 id 时,记录里可以不写 id(与对侧同形态),但两者都不给就拒
    expect(parseServiceClaim({ port: 8080, pid: 1, timestamp: 1 }, 'fromName').claim?.id).toBe(
      'fromName',
    )
  })

  it('⑫ 文件名只认安全形态,别人的落物一律不碰', () => {
    expect(isClaimFileName('srv-1.json')).toBe(true)
    expect(isClaimFileName('README.md')).toBe(false)
    expect(isClaimFileName('../escape.json')).toBe(false)
    expect(claimIdFromFileName('srv-1.json')).toBe('srv-1')
  })
})

describe('shared 纯度门(§「shared 包非 Node 宿主纯度」)', () => {
  it('⑬ 判据层不得出现 node: 内建与宿主 API', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/local-registry/claim.ts', import.meta.url)),
      'utf8',
    )
    expect(src).not.toMatch(/from 'node:|require\('node:|process\.(env|cwd)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
