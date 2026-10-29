// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 裁决件词表适配层(`apply-cross-end-verdicts`)的镜像测试。
 *
 * 立因(2026-10-26 实测):子代理裁决件用 `mirrored | missing | not-applicable`,
 * 而落地器 web 分支只认 `aligned | excluded | gap` —— 不匹配的那几档**既不平移也不进
 * refused**,229 条裁决会在最后一公里静默消失。本测试钉住"归一正确 + 未知值必须大声拒"。
 *
 * 判据零复制(§22c):词表与归一函数 import 源脚本 `__test__`;落地器的接受词表用
 * **行为锁**(源里必须有对应分支)而不是在测试里抄一份同名集合。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { __test__ as A } from '../apply-cross-end-verdicts.mjs'

const LANDER = readFileSync(resolve(import.meta.dirname, '..', 'auto-register-cross-end.mjs'), 'utf8')

const longEv = 'App 不承载该管理后台页,RN 侧检索无同名屏与端点,故排除'

test('T1 mirrored ⇒ aligned(要求 rn 屏路径)', () => {
  const r = A.normalizeVerdictItem({ web: 'agents/x', rn: 'apps/mobile-rn/src/screens/AgentScreen.tsx', verdict: 'mirrored', evidence: longEv })
  assert.equal(r.ok, true)
  assert.equal(r.to, 'aligned')
  const bad = A.normalizeVerdictItem({ web: 'agents/x', verdict: 'mirrored', evidence: longEv })
  assert.equal(bad.ok, false, '缺 rn 的 mirrored 必须拒,不许猜一个屏')
})

test('T2 not-applicable ⇒ excluded(证据 <10 字拒)', () => {
  const ok = A.normalizeVerdictItem({ web: 'admin/users', verdict: 'not-applicable', evidence: longEv })
  assert.equal(ok.to, 'excluded')
  const bad = A.normalizeVerdictItem({ web: 'admin/users', verdict: 'not-applicable', evidence: '不承载' })
  assert.equal(bad.ok, false, '短证据必须拒(空口声明不算证据)')
})

test('T3 missing ⇒ gap 且不委托落地器', () => {
  const one = A.normalizeVerdictItem({ web: 'a2a', verdict: 'missing', evidence: longEv })
  assert.equal(one.to, 'gap')
  const all = A.normalizeAll([{ web: 'a2a', verdict: 'missing', evidence: longEv }])
  assert.equal(all.web.length, 0, 'missing 不许写成 aligned/excluded')
  assert.equal(all.keptGap.length, 1, '必须留在缺口台账,不许静默消失')
})

test('T4 未知词表 ⇒ 大声拒(不允许静默丢)', () => {
  const r = A.normalizeVerdictItem({ web: 'x', verdict: 'whatever', evidence: longEv })
  assert.equal(r.ok, false)
  assert.match(r.why, /未知 verdict/)
  const all = A.normalizeAll([{ web: 'x', verdict: 'whatever', evidence: longEv }])
  assert.equal(all.refused.length, 1, '未知值必须进 refused 清单')
})

test('T5 miniapp 三档透传,未知拒', () => {
  for (const v of ['declare', 'missing', 'not-applicable']) {
    assert.equal(A.normalizeVerdictItem({ shared: 's.tsx', verdict: v }).ok, true, `${v} 应透传`)
  }
  assert.equal(A.normalizeVerdictItem({ shared: 's.tsx', verdict: 'mirrored' }).ok, false)
})

test('T6 归一输出 ⊆ 落地器接受词(行为锁)', () => {
  const emitted = new Set()
  for (const v of Object.keys(A.WEB_VERDICT_ALIASES)) {
    const r = A.normalizeVerdictItem({ web: 'w', rn: 'x.tsx', verdict: v, evidence: longEv })
    if (r.ok && r.to !== 'gap') emitted.add(r.to)
  }
  assert.deepEqual([...emitted].sort(), ['aligned', 'excluded'], `归一输出只能是落地器认的两档(实测 ${[...emitted].join(',')})`)
  for (const v of emitted) {
    assert.ok(
      LANDER.includes(`it.verdict === '${v}'`),
      `落地器 auto-register-cross-end.mjs 里必须存在 it.verdict === '${v}' 分支 —— 否则这一档会被静默丢掉`,
    )
  }
})

test('T7 缺 verdict / 非对象 ⇒ 拒', () => {
  assert.equal(A.normalizeVerdictItem({ web: 'x' }).ok, false)
  assert.equal(A.normalizeVerdictItem(null).ok, false)
  assert.equal(A.normalizeVerdictItem({}).ok, false)
})

test('T8 counts 按「原词→落地词」如实记账', () => {
  const all = A.normalizeAll([
    { web: 'a', rn: 'x.tsx', verdict: 'mirrored', evidence: longEv },
    { web: 'b', verdict: 'not-applicable', evidence: longEv },
    { web: 'c', verdict: 'missing', evidence: longEv },
  ])
  assert.equal(all.counts['mirrored→aligned'], 1)
  assert.equal(all.counts['not-applicable→excluded'], 1)
  assert.equal(all.counts['missing→gap'], 1)
  assert.equal(all.web.length, 2)
  assert.equal(all.keptGap.length, 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
