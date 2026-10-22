// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-plan-fields.mjs` 的镜像测试(§22c):判据一律从门体 import 生产出口,本文件**零复算**。
 *
 * 三条承重锁:
 *  ① 注册条目成套 —— 用装件器自己的 `buildEntry` 重建期望文本做逐字节包含,而不是在这里手写
 *     一份"什么算一条注册项"(手写那份就是第二把尺子,runner 改字段顺序时它会静默失明)。
 *  ② 头注自称已接线 ⇒ 注册表必须真命中 —— 取号与查重都问 `check-gate-wiring` 的
 *     `idsOfRegistry` / `findDuplicateIds`(门 89 用的那把尺),不在这里再 grep 一遍。
 *  ③ A1/A2 的 verdict 只在门体一处 —— 本文件只断言出口同一引用,不重算状态。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G, judge, verdict } from '../check-plan-fields.mjs'
import { buildEntry } from '../gate-registry-insert.mjs'
import { findDuplicateIds, idsOfRegistry } from '../check-gate-wiring.mjs'
import { compositeKeyOf } from '../lib/plan-task-index.mjs'
import { renderHeader } from '../lib/plan-field-line.mjs'
import { FIELDS_REL } from '../lib/plan-fields.mjs'
import { gitRaw } from '../lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE_ID = '234'
const GATE_SCRIPT = 'check-plan-fields.mjs'
const GATE_SKIP_ENV = 'HUSKY_SKIP_PLAN_FIELDS'
const GATE_LABEL = '计划台账侧车字段一致性(新增行有侧车 ∧ 标头==侧车投影)'
const GATE_TRIGGERS = ['PROJECT_PLAN.md']
const GATE_HINT = [
  '读数:node scripts/check-plan-fields.mjs;结清存量:node scripts/plan-fields-extract.mjs --apply(只搬说辞不改台账行)',
]

// 装车证明读 **HEAD 面**的 runner(与既有镜像测试同口径):旁路落地只推进 HEAD、不写工作树,
// 读盘会拿到滞后副本,于是"注册在位"这件事永远证不了(本仓记过的那一型:证据面与断言面不同形)。
const runnerText = () =>
  gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], ROOT, { timeout: 60000 })
const mk = (raw, line = 1) => ({ line, state: 'open', raw, key: compositeKeyOf(raw) })

describe('守门装车证明(§22c)', () => {
  it('① 注册条目由装件器同一份文本生成:warn 档且 skipEnv 成套', () => {
    const want = buildEntry({
      id: GATE_ID,
      section: '计划/台账',
      label: GATE_LABEL,
      script: GATE_SCRIPT,
      skipEnv: GATE_SKIP_ENV,
      triggers: GATE_TRIGGERS,
      hint: GATE_HINT,
      mode: 'warn',
    }).join('\n')
    assert.ok(
      runnerText().includes(want),
      `runner 里没有逐字一致的注册项(warn 档 + skipEnv 成套)。期望:\n${want}`,
    )
  })

  it('② 自称已接线 ⇒ 注册表真命中且号不重(问门 89 那把尺)', () => {
    const ids = idsOfRegistry(runnerText())
    assert.ok(ids.includes(GATE_ID), `注册表里没有 ${GATE_ID}`)
    assert.ok(
      !findDuplicateIds(runnerText()).includes(GATE_ID),
      `${GATE_ID} 在注册表里出现多枚(R5 同型)`,
    )
  })

  it('③ verdict 只有一份实现:出口引用与具名导出同一', () => {
    assert.equal(G.judge, judge)
    assert.equal(G.verdict, verdict)
  })
})

describe('判据在构造面上的行为(与门体自检同一份实现)', () => {
  it('新行无租约无侧车 ⇒ A1 点名到枚', () => {
    const v = judge([mk('- [ ] G-1 甲 细节')], { baseRowTexts: new Set(), map: new Map() })
    assert.equal(v.a1, 1)
    assert.match(v.a1List[0], /G-1/, '点名必须带得出编号,否则人无法复跑')
  })

  it('全量档无基准 ⇒ a1 报 NA 且不当 red(§0.3 没判不写成判过)', () => {
    const v = judge([mk('- [ ] G-1 甲 细节')], { map: new Map() })
    assert.equal(v.hasBase, false)
    const r = verdict(v, 'head')
    assert.match(r.line, /a1=NA/)
    assert.equal(r.code, 0, '只有存量 ⇒ warn 档不得冒红(§12e)')
  })

  it('标头 ⇄ 侧车逐字不一致 ⇒ A2 red;一致 ⇒ 不报', () => {
    const rec = {
      key: compositeKeyOf('- [ ] G-1 甲 细节'),
      owner: '门 130 持有人',
      waiting: 'none',
      updatedAt: '2026-10-22T00:00:00.000Z',
    }
    const map = new Map([[rec.key, rec]])
    const good = mk(`- [ ] ${renderHeader(rec)} G-1 甲 细节`)
    const bad = mk('- [ ] 〔归:换了一个人〕 G-1 甲 细节')
    assert.equal(judge([good], { map }).a2, 0)
    assert.equal(judge([bad], { map }).a2, 1)
    assert.equal(verdict(judge([bad], { map }), 'staged').code, 1)
  })

  it('完整租约算交代 ⇒ 不逼侧车重复登记', () => {
    const v = judge([mk('- [ ] （进行中@2026-10-22/holder-x） G-2 乙 细节')], {
      baseRowTexts: new Set(),
      map: new Map(),
    })
    assert.equal(v.a1, 0)
    assert.equal(v.stock, 0)
  })
})

describe('侧车面必须与台账同轮在位(取不到 ⇒ 未判定,不记绿)', () => {
  it('门体读的侧车路径 = 单源 FIELDS_REL(不在这里另拼一份路径)', () => {
    const src = readFileSync(new URL(`../${GATE_SCRIPT}`, import.meta.url), 'utf8')
    assert.match(src, /readFieldsFace/, '必须走 plan-tasks 的同面同轮取材出口')
    assert.ok(!src.includes("'scripts' + " + "'data'"), `不得手拼侧车路径(单源 = ${FIELDS_REL})`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
