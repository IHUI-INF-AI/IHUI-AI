// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 结构锁:守护派发器不得把"未知结论"记成"判过且健康"(§0.3 没判绝不写成判过)。
 *
 * 为什么不是逐点用例:同族缺陷的成因就是**抄样板** —— 一处 `typeof x !== 'string'`
 * 的存在性判定被复制到十几个派发器里,逐点补用例只能钉住"当下这 13 处",
 * 下一处新抄的仍然漏。本锁从文件本身导出判据:
 *   ① 从函数体里抽出该点**自己比较过**的取值集合(那把尺的真词表);
 *   ② 守卫必须是白名单,且白名单 ⊇ ① —— 少一个就把某个真状态误判成未判定(丢报警);
 *   ③ 若守卫仍只做存在性判定,则要求它的**兜底分支是保守方向**(多喊/按值判 ok),
 *      并逐条写明归属,否则判红。
 * 判据实现住在本文件(它是测试,不是第二份门体判据);不复制任何门的常量(§22c)。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
const lines = SRC.split('\n')

/** 顶层函数切段(顶格 function / export function / export async function) */
function topFunctions() {
  const starts = []
  lines.forEach((l, i) => {
    const m = /^(?:export )?(?:async )?function (\w+)\(/.exec(l)
    if (m) starts.push({ name: m[1], i })
  })
  return starts.map((s, k) => ({
    name: s.name,
    from: s.i,
    to: k + 1 < starts.length ? starts[k + 1].i : lines.length,
    body: lines.slice(s.i, k + 1 < starts.length ? starts[k + 1].i : lines.length).join('\n'),
  }))
}

const KEYS = ['verdict', 'state', 'overall']
const cmpLiterals = (body, key) => {
  const out = new Set()
  const re = new RegExp(`parsed\\.${key}\\s*===\\s*'([^']+)'`, 'g')
  for (const m of body.matchAll(re)) out.add(m[1])
  return out
}
/** 存在性判定守卫(缺陷形态):只做 typeof/真值检查,不看取值 */
const existenceOnly = (body, key) =>
  new RegExp(`!parsed \\|\\| typeof parsed\\.${key} !== 'string'`).test(body) ||
  new RegExp(`!parsed \\|\\| !parsed\\.${key}\\b`).test(body) ||
  new RegExp(`!parsed \\|\\| parsed\\.${key} === 'error'`).test(body)
/** 白名单守卫,返回名单内容与位置 */
const whitelist = (body, key) => {
  const m = new RegExp(`!parsed \\|\\| !(\\[[^\\]]*\\])\\.includes\\(parsed\\.${key}\\)`).exec(body)
  if (!m) return null
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}
/** 兜底是否保守:最后一条结论行是否按值判(而不是无条件 ✅) */
const fallthroughConservative = (body, key) => {
  const i = body.lastIndexOf(`✅`)
  const tail = body.slice(i)
  // 形如 `ok: parsed.state === 'clean'` ⇒ 保守;形如无条件 `judged: true` / `state: 'clean'` ⇒ 会记绿
  const condOk = new RegExp(`ok: parsed\\.${key} ===`).test(tail)
  const flagged = /state: 'flagged'|state: 'breach'|ok: false/.test(tail)
  return condOk || flagged
}

const fns = topFunctions()
const uses = fns.filter((f) => KEYS.some((k) => new RegExp(`parsed\\.${k}\\b`).test(f.body)))

test('锁1 每个派发点的守卫必须覆盖它自己比较过的取值(否则真状态会被误判成未判定)', () => {
  const problems = []
  for (const f of uses) {
    for (const k of KEYS) {
      const compared = cmpLiterals(f.body, k)
      if (compared.size === 0) continue
      const wl = whitelist(f.body, k)
      if (!wl) continue // 存在性判定另由锁 2 处理
      for (const v of compared) if (!wl.includes(v)) problems.push(`${f.name}: 比较了 ${k}='${v}' 但白名单不含 ⇒ 该状态会被判成未判定`)
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'))
})

test('锁2 残余的存在性判定必须落在保守兜底上,并逐条登记归属', () => {
  const ALLOWED = {
    auditLandedReverts: '未知值落到 state:flagged(多喊一次),方向安全',
    auditI18nCrossEndWording: '末条是 ok: parsed.state === "clean",未知即判不 ok',
    dispatchGateRot:
      '实测(2026-11-04):未知 overall 直接 return ok:false + why=结论不可解析,不写 judged:true ⇒ 保守档',
  }
  // 待核登记 ≠ 豁免:它必须带到期日,过期即红(§0.7 "豁免必须验过才免且会到期")。
  // sweepDesktopDiscoveryBudget 的尺子顶层取值(breach/unjudged/ok/fail/pass/partial/undetermined)
  // 与派发器实际比较的键(只有 fail 与 undetermined)不对应 ⇒ 套白名单会连带改这条腿的语义,
  // 归它自己的席位复核;在那之前它留在明处,不静默放行。
  const NEEDS_OWNER_REVIEW = { sweepDesktopDiscoveryBudget: '2026-11-18' }
  const problems = []
  for (const f of uses) {
    for (const k of KEYS) {
      if (!existenceOnly(f.body, k)) continue
      if (ALLOWED[f.name]) continue
      if (NEEDS_OWNER_REVIEW[f.name]) {
        const until = new Date(NEEDS_OWNER_REVIEW[f.name] + 'T23:59:59')
        if (!(until instanceof Date && !Number.isNaN(until.getTime()))) problems.push(`${f.name}: 待核登记到期日形状坏 ⇒ 视同无登记`)
        else if (Date.now() > until.getTime()) problems.push(`${f.name}: 待核登记已过期(${NEEDS_OWNER_REVIEW[f.name]})⇒ 必须收紧或续期并写明理由`)
        continue
      }
      if (fallthroughConservative(f.body, k)) {
        problems.push(`${f.name}: 仍是存在性判定但自证为保守 ⇒ 请登记进 ALLOWED 并注明方向(别让下一席猜)`)
        continue
      }
      problems.push(`${f.name}: 存在性判定 + 无条件记绿 ⇒ 未知结论被写成"判过且健康"(§0.3)`)
    }
  }
  for (const name of Object.keys(ALLOWED)) {
    const f = uses.find((x) => x.name === name)
    if (!f) problems.push(`登记的安全档 ${name} 已不在文件里 ⇒ 台账腐烂(§0.7)`)
  }
  for (const name of Object.keys(NEEDS_OWNER_REVIEW)) {
    const f = uses.find((x) => x.name === name)
    if (f && !KEYS.some((k) => existenceOnly(f.body, k)))
      problems.push(`待核登记 ${name} 已不成立(它已收紧)⇒ 摘掉这条登记,别让清单腐烂`)
  }
  assert.deepEqual(problems, [], problems.join('\n'))
})

test('锁3 收紧面不能被悄悄改回存在性判定(反向锁:摘掉白名单即红)', () => {
  const tightened = uses.filter((f) => KEYS.some((k) => whitelist(f.body, k)))
  assert.ok(
    tightened.length >= 13,
    `收紧过的派发点应 ≥13(2026-11-04 实测 13),现读 ${tightened.length} —— 少了就说明有人改回存在性判定`,
  )
})

test('锁4 派发点若新增而既无白名单又无保守兜底,本锁自动覆盖到它(覆盖面自证)', () => {
  const names = uses.map((f) => f.name).sort()
  assert.ok(names.includes('sweepGitProbeHeadroom'), '本席新增的派发点必须在扫描面内(否则说明切段逻辑漏了函数)')
  assert.ok(names.includes('auditSmsChannelHealth'), '同族原型必须在扫描面内')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
