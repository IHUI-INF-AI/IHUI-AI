#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 格式对账尺巡检腿(`sweepFormatParity`)的调度镜像测试(2026-11-04 立)。
 *
 * 立因:尺子 `check-format-support-parity.mjs` 判据齐全而全仓零派发(§0.9「造好没装车 = 没有」),
 * 现由 `git-guardian` 的 `sweepFormatParity` 独任调度。本文件钉的是**调度层**,不复制尺子判据
 * (§22c:三桶/族/豁免怎么算归尺子自己,这里只喂它产出的 JSON 形态)。
 *
 * 钉死七件事:
 *  F1 尺子不在位 ⇒ 跳过且**不写节流戳**(补回尺子后下一轮立刻能跑);
 *  F2 `state=ok` ⇒ 判过、记 registry 读数、不寄信;
 *  F3 `state=drift` ⇒ 不记绿,日志逐档点名 ②/③,**不寄信**(§5e-2:补白名单/摘虚假承诺归 agent 当场做);
 *  F4 `state=unjudged` ⇒ 未判定,连击起点落盘、首轮不到人;
 *  F5 结论取不到(派生失败 / stdout 无 JSON)⇒ 同样未判定,形状漂移不许冒绿;
 *  F6 ③ 只认**剔掉具名豁免后的有效集**(与尺子 verdict 同一份,不得一处 4 一处 3);
 *  F7 节流分档:判过档走 interval,未判定档走 cooldown;
 *  F8 出口锁:调度腿必须登记进 `__test__`(不登记 ⇒ 接线锁结构上打不到这一格)。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { sweepFormatParity, __test__ as guardian } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = process.cwd()
const REAL_SCRIPT = join(ROOT, 'scripts', 'check-format-support-parity.mjs')

/** 造一份"尺子已经判过"的 stdout(形状取自尺子 --json 现读键,不写判据)。 */
function rulerJson(over = {}) {
  const base = {
    face: 'head',
    registryCount: 34,
    buckets: { hollow: [], unregistered: [] },
    waiver: { unregistered: [], waived: [] },
    state: 'ok',
    exit: 0,
    reason: '十面对齐:登记↔实现(按族)零缺口',
  }
  return `FORMAT-PARITY ... \n${JSON.stringify({ ...base, ...over })}\n`
}

function mkEnv() {
  const dir = mkScratch('g-format-sweep')
  return {
    dir,
    tickFile: join(dir, 'tick.json'),
    undetFile: join(dir, 'undet-first.json'),
    lines: [],
    mails: [],
    opts() {
      return {
        tickFile: this.tickFile,
        undetFile: this.undetFile,
        logger: (s) => this.lines.push(String(s)),
        notify: (name, detail, o) => {
          this.mails.push({ name, detail, o })
          return true
        },
        scriptFile: REAL_SCRIPT,
      }
    },
  }
}

test('F1 尺子不在位 ⇒ 跳过且不写节流戳(补回后下一轮立刻能跑)', () => {
  const env = mkEnv()
  try {
    const r = sweepFormatParity({
      ...env.opts(),
      scriptFile: join(env.dir, 'no-such-ruler.mjs'),
      runner: () => {
        throw new Error('不该派生')
      },
    })
    assert.equal(r.ran, false)
    assert.ok(!existsSync(env.tickFile), '器物不在位仍写戳 ⇒ 会把"没跑成"记成"刚跑过"')
    assert.match(env.lines.join('\n'), /尺子不在位/)
  } finally {
    rmScratch(env.dir)
  }
})

test('F2 ok ⇒ 判过、读数入戳、一声不寄', () => {
  const env = mkEnv()
  try {
    const r = sweepFormatParity({ ...env.opts(), runner: () => rulerJson() })
    assert.equal(r.state, 'ok')
    assert.equal(r.judged, true)
    assert.equal(r.ok, true)
    assert.equal(env.mails.length, 0)
    const tick = JSON.parse(readFileSync(env.tickFile, 'utf8'))
    assert.equal(tick.judged, true)
    assert.equal(tick.registry, 34)
    assert.match(env.lines.join('\n'), /十面对齐/)
  } finally {
    rmScratch(env.dir)
  }
})

test('F3 drift ⇒ 不记绿、日志逐档点名,且**不寄信**(出路归 agent 当场做)', () => {
  const env = mkEnv()
  try {
    const r = sweepFormatParity({
      ...env.opts(),
      runner: () =>
        rulerJson({
          state: 'drift',
          exit: 1,
          buckets: { hollow: ['zip'], unregistered: ['m4v', 'html'] },
          waiver: { unregistered: ['m4v'], waived: [{ ext: 'html' }] },
        }),
    })
    assert.equal(r.ok, false, 'drift 被读成绿 ⇒ 本锁失去意义')
    assert.equal(r.judged, true)
    assert.deepEqual(r.hollow, ['zip'])
    assert.deepEqual(r.unregistered, ['m4v'])
    const out = env.lines.join('\n')
    assert.match(out, /②空头 zip/)
    assert.match(out, /③有实现未登记 m4v/)
    assert.equal(env.mails.length, 0, '端上表是 agent 能当场改的活,不得推回机主(§5e-2)')
  } finally {
    rmScratch(env.dir)
  }
})

test('F4 unjudged ⇒ 未判定入戳、连击起点落盘,首轮只报不寄', () => {
  const env = mkEnv()
  try {
    const r = sweepFormatParity({
      ...env.opts(),
      runner: () =>
        rulerJson({ state: 'unjudged', exit: 2, buckets: undefined, waiver: undefined }),
    })
    assert.equal(r.judged, false)
    assert.equal(r.state, 'unjudged')
    const tick = JSON.parse(readFileSync(env.tickFile, 'utf8'))
    assert.equal(tick.judged, false)
    assert.ok(existsSync(env.undetFile), '未判定不落连击起点 ⇒ 「这格瞎了」永远量不到')
  } finally {
    rmScratch(env.dir)
  }
})

test('F5 结论取不到(无 JSON / 派生失败)⇒ 一律未判定,绝不冒绿', () => {
  for (const bad of ['', 'FORMAT-PARITY 跑完了但没打结论 JSON', null]) {
    const env = mkEnv()
    try {
      const r = sweepFormatParity({
        ...env.opts(),
        runner: () =>
          bad === null
            ? { status: null, stdout: '', stderr: 'spawn EBUSY' }
            : { status: 0, stdout: bad, stderr: '' },
      })
      assert.equal(r.judged, false, `坏输入(${String(bad).slice(0, 12)})被读成判过`)
      assert.equal(r.state, 'unjudged')
      assert.equal(JSON.parse(readFileSync(env.tickFile, 'utf8')).judged, false)
    } finally {
      rmScratch(env.dir)
    }
  }
})

test('F6 ③ 只认剔掉具名豁免后的有效集(与尺子 verdict 同一份)', () => {
  const env = mkEnv()
  try {
    const r = sweepFormatParity({
      ...env.opts(),
      runner: () =>
        rulerJson({
          state: 'drift',
          exit: 1,
          buckets: { hollow: [], unregistered: ['html', 'flac'] },
          waiver: { unregistered: ['flac'], waived: [{ ext: 'html' }] },
        }),
    })
    assert.deepEqual(r.unregistered, ['flac'], '日志用了原始集 ⇒ 与 verdict 一处 2 一处 1')
    const tick = JSON.parse(readFileSync(env.tickFile, 'utf8'))
    assert.equal(tick.unregistered, 1)
    assert.match(env.lines.join('\n'), /③有实现未登记 flac/)
    assert.doesNotMatch(env.lines.join('\n'), /③有实现未登记 html/)
  } finally {
    rmScratch(env.dir)
  }
})

test('F7 节流分档:判过档走 interval,未判定档走 cooldown(更短)', () => {
  const env = mkEnv()
  try {
    const base = env.opts()
    const t0 = 1_780_000_000_000
    writeFileSync(
      env.tickFile,
      JSON.stringify({ attemptAt: new Date(t0).toISOString(), judged: true }),
    )
    const held = sweepFormatParity({
      ...base,
      now: t0 + 10 * 60 * 1000,
      intervalMs: 30 * 60 * 1000,
      runner: () => {
        throw new Error('判过档窗口内不该再派生')
      },
    })
    assert.equal(held.why, '未到节流窗口')
    writeFileSync(
      env.tickFile,
      JSON.stringify({ attemptAt: new Date(t0).toISOString(), judged: false }),
    )
    const cooled = sweepFormatParity({
      ...base,
      now: t0 + 30 * 60 * 1000,
      cooldownMs: 60 * 60 * 1000,
      runner: () => {
        throw new Error('未判定冷却内不该再派生')
      },
    })
    assert.equal(cooled.why, '未判定冷却中')
    const retried = sweepFormatParity({
      ...base,
      now: t0 + 61 * 60 * 1000,
      cooldownMs: 60 * 60 * 1000,
      runner: () => rulerJson(),
    })
    assert.equal(retried.state, 'ok', '过冷却仍不重试 ⇒ 瞎掉的那格再也没人复量')
  } finally {
    rmScratch(env.dir)
  }
})

test('F8 出口锁:调度腿登记进 __test__(否则接线锁打不到这一格)', () => {
  assert.equal(typeof guardian.sweepFormatParity, 'function')
  assert.equal(guardian.sweepFormatParity, sweepFormatParity)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
