// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 空转阶梯的「发射集 ⊆ 分档集」覆盖锁(2026-11-04 立)。
 *
 * 立因(现读,不是推测):把台账里实际出现过的 action 与 `lib/autonomy-nonprogress.mjs` 的两张数组
 * 对账,发射侧共 15 种而阶梯只认 13 种;改为**从源码收割**后是 13 认 / 23 不认。
 * `attemptsSinceProgress` 对不认识的串直接跳过(既不计数也不清零),后果不是报错而是**静默漏计**:
 * 同一枚票可以每小时白占一份日预算而永远数不到 rotate/park 阈值 —— 与 B53 那型
 * "209 行台账里吃掉 127 行"是同一条病,只是这次漏在动作名对不上上。
 *
 * 分档判据一律 import 生产那一份(`actionBucketOf` / 两张数组 / 豁免表),本文件零复算(§22c);
 * 本文件只做"收割发射串"这件测试侧脚手架活,不另立任何判定。
 *
 * 收割走三路互补(单靠一种会假绿,这一点在本枚开发中被实测抓到过两次):
 *  ① 直写形态 `action: 'x'`;
 *  ② 模板形态按**前缀**识别并按登记的并集展开(不按"值表达式切片" —— 三元式 / `??` / `?.` 都会把切片切错);
 *  ③ 真实台账里出现过的 action(数据侧兜底)。
 * 另有 C4 反向要求"每一条分档登记都能在源码里找到字面串",两个方向一起锁死。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as NP } from '../lib/autonomy-nonprogress.mjs'
import { ARTIFACT_MANIFEST_STATES } from '../lib/ticket-artifacts.mjs'
import { VALVE_ACTIONS, PREFLIGHT_STATES } from '../lib/autonomy-runner.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SRC = readFileSync(join(ROOT, 'scripts', 'auto-evolve.mjs'), 'utf8')

/**
 * 取出 `action:` 的值表达式(扫到同深度的 `,`/换行/`}` 为止),再只取**三元式的分支**部分。
 * 为什么不用 indexOf('?'):可选链 `valve?.action`、空值合并 `?? []` 里的 `?` 会把切片切到
 * 表达式中间去 —— 上一版就是这么把 `valve-allow` 漏掉、又把条件字面串 `'unjudged'` 收进来的。
 */
function actionValueSpan(text, from) {
  let depth = 0
  for (let i = from; i < text.length; i += 1) {
    const c = text[i]
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return text.slice(from, i)
      depth -= 1
    } else if ((c === ',' || c === '\n') && depth === 0) return text.slice(from, i)
  }
  return text.slice(from)
}

/** 找三元式的 `?`(排除 `?.` 与 `??`),返回其后半段;没有就返回原表达式。 */
function ternaryBranches(value) {
  for (let i = 1; i < value.length - 1; i += 1) {
    if (value[i] !== '?') continue
    const prev = value[i - 1]
    const next = value[i + 1]
    if (prev === '.' || prev === '?' || next === '?') continue
    return value.slice(i + 1)
  }
  return value
}

/** ①+② 从源码收割(直写 + 三元分支 + 登记过的模板并集)。 */
function harvestFromSource(text) {
  const out = new Set()
  for (const m of text.matchAll(/\baction:\s*/g)) {
    const raw = actionValueSpan(text, m.index + m[0].length)
    const prefixes = [
      ['valve-', VALVE_ACTIONS],
      ['artifact-manifest-', ARTIFACT_MANIFEST_STATES],
      ['runner-preflight-', PREFLIGHT_STATES],
    ]
    // 顺序要紧:**先**按原样识别模板并展开,**再**摘掉 `${...}`,**最后**才对剩余部分做三元切片。
    // 反过来先切三元会把 `` `valve-${`` 的开头切没(那个 `?` 在插值里面),
    // 于是 valve 一族全部漏收、而插值里的拼料 `'unjudged'` 反而被当成发射名 —— 实测连踩两次。
    let rest = raw
    for (const [prefix, union] of prefixes) {
      if (!raw.includes('`' + prefix + '${')) continue
      for (const v of union) out.add(prefix + v)
      rest = rest.replace(/\$\{[^}]*\}/g, ' ')
    }
    rest = ternaryBranches(rest)
    for (const lit of rest.matchAll(/'([a-z][a-z0-9-]{2,})'/g)) out.add(lit[1])
  }
  return out
}

/** ③ 真实台账里出现过的 action;文件取不到 ⇒ ok:false(由调用方按未判定处理,不当通过)。 */
function observedActions() {
  try {
    const text = readFileSync(
      join(ROOT, '.ihui-agent', 'state', 'auto-evolve-ledger.jsonl'),
      'utf8',
    )
    const out = new Set()
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const o = JSON.parse(line)
        if (typeof o?.action === 'string') out.add(o.action)
      } catch {
        /* 坏行跳过:数据侧兜底不承担形状判定 */
      }
    }
    return { ok: true, actions: [...out] }
  } catch {
    return { ok: false, actions: [] }
  }
}

const emitted = [...harvestFromSource(SRC)]
const observed = observedActions()

test('C1 发射集 ⊆ 分档集:源码直写与模板展开出的每一枚动作都能被阶梯认出', () => {
  const unclassified = emitted.filter((a) => NP.actionBucketOf(a) === 'unclassified')
  assert.deepEqual(
    unclassified,
    [],
    `这些动作两档都不在 ⇒ 计数器会静默跳过它们:${unclassified.join(', ')}`,
  )
  assert.ok(
    emitted.length >= 13,
    `收割到 ${emitted.length} 枚 ⇒ 少于已知发射面说明收割器本身在漏,锁就成装饰`,
  )
})

test('C2 数据侧兜底:真实台账里出现过的每一枚 action 都必须已分档', () => {
  assert.ok(observed.ok, '台账取不到 ⇒ 这一档未判定(不许当通过,也不许当违规)')
  const unclassified = observed.actions.filter((a) => NP.actionBucketOf(a) === 'unclassified')
  assert.deepEqual(unclassified, [], `台账里出现过但没人分档:${unclassified.join(', ')}`)
})

test('C3 三档互斥:同一枚动作不许既算推进又算空转,也不许同时被豁免', () => {
  const overlap = NP.PROGRESS_ACTIONS.filter((a) => NP.NON_PROGRESS_ACTIONS.includes(a))
  assert.deepEqual(overlap, [], `同时出现在两档:${overlap.join(', ')}`)
  const exemptOverlap = [...NP.PROGRESS_ACTIONS, ...NP.NON_PROGRESS_ACTIONS].filter((a) =>
    Object.prototype.hasOwnProperty.call(NP.ACTION_EXEMPTIONS, a),
  )
  assert.deepEqual(exemptOverlap, [], '豁免的语义是"票级但不计数",与两档并存即自相矛盾')
})

test('C4 豁免必须"验过才免":每条带 ≥10 字理由 + 发射点,且源码里真能收到该字面串', () => {
  const keys = Object.keys(NP.ACTION_EXEMPTIONS)
  const bad = keys.filter(
    (k) =>
      [...String(NP.ACTION_EXEMPTIONS[k]?.reason ?? '')].length < 10 ||
      !String(NP.ACTION_EXEMPTIONS[k]?.site ?? '').trim(),
  )
  assert.deepEqual(bad, [], `理由不足 10 字或没写发射点(§0.7):${bad.join(', ')}`)
  // 腐烂判据用"收割/台账能不能得到这一枚",不是"源码里有没有这个字面串"——
  // 模板展开出来的名字(valve-allow 等)结构上不会以字面串形式出现在源码里,按字面串判会把真豁免当腐烂。
  const known = new Set([...emitted, ...observed.actions])
  const dead = keys.filter((k) => !known.has(k))
  assert.deepEqual(
    dead,
    [],
    `豁免表里有收割与台账都得不到的条目:${dead.join(', ')} —— 留着就是把曾经的漏计伪装成已处理`,
  )
})

test('C5 反向牙 P1:源码里悄悄加一枚没分档的动作 ⇒ 锁必红', () => {
  const mutated = SRC.replace("action: 'session-ok'", "action: 'session-silently-new'")
  assert.ok(mutated !== SRC, '替换必须真发生,否则这一档什么都没测')
  assert.ok(harvestFromSource(mutated).has('session-silently-new'), '收割器必须能看见新发射的串')
  assert.equal(NP.actionBucketOf('session-silently-new'), 'unclassified', '没分档 ⇒ 必须被认出来')
})

test('C6 反向牙 P2:并集里多一个 state 而没分档 ⇒ 展开后当场判红(模板漏判这一型)', () => {
  const grown = harvestFromSource('record({ action: `artifact-manifest-${state}` })')
  assert.ok(
    grown.has('artifact-manifest-invalid') && grown.has('artifact-manifest-ok'),
    '模板必须按登记的并集展开',
  )
  assert.equal(
    NP.actionBucketOf('artifact-manifest-orphan'),
    'unclassified',
    '并集扩了而阶梯没跟 ⇒ 就是这一型',
  )
})

test('C7 反向牙 P3:本轮补上的五枚票级漏计确有登记,且双计那一族确被排除', () => {
  for (const a of [
    'artifact-manifest-invalid',
    'artifact-manifest-stale',
    'mint-failed',
    'template-empty',
    'valve-block',
  ])
    assert.equal(NP.actionBucketOf(a), 'non-progress', `${a} 该计入空转`)
  assert.equal(NP.actionBucketOf('valve-allow'), 'exempt', '放行标记紧随 session 行,再计就是双计')
  assert.equal(
    NP.actionBucketOf('dispatched'),
    'exempt',
    '日预算占班次标记,不计入空转(否则与 session 行双计)',
  )
})

test('C8 不许拼出没分档的串:valve 模板对非法输入归 unjudged 而不是 undefined', () => {
  assert.ok(
    !emitted.some((a) => a.includes('undefined')),
    `发射集里不许出现 valve-undefined:${emitted.join(',')}`,
  )
  assert.ok(
    SRC.includes("VALVE_ACTIONS.includes(valve?.action) ? valve.action : 'unjudged'"),
    'decideValveDispatch 必须先按并集校验再拼串',
  )
})

test('C9 阶梯读的是同一份表:PROGRESS/NON_PROGRESS/EXEMPT 三段都从本 lib 导出(§0.6 不许第二份)', () => {
  assert.ok(
    Array.isArray(NP.PROGRESS_ACTIONS) && Array.isArray(NP.NON_PROGRESS_ACTIONS),
    '两张数组必须导出',
  )
  assert.equal(typeof NP.ACTION_EXEMPTIONS, 'object', '豁免表必须导出(锁与阶梯读同一份)')
  assert.equal(typeof NP.actionBucketOf, 'function', '分档判据必须是导出的那一份,测试不许自己抄')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
