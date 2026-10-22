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

import { __test__ as G, judge, verdict } from '../check-plan-fields.mjs'
import { buildEntry } from '../gate-registry-insert.mjs'
import { findDuplicateIds, idsOfRegistry } from '../check-gate-wiring.mjs'
import { compositeKeyOf } from '../lib/plan-task-index.mjs'
import { renderHeader } from '../lib/plan-field-line.mjs'
import { FIELDS_REL } from '../lib/plan-fields.mjs'

const GATE_ID = '234'
const GATE_SCRIPT = 'check-plan-fields.mjs'
const GATE_SKIP_ENV = 'HUSKY_SKIP_PLAN_FIELDS'
const GATE_LABEL = '计划台账侧车字段一致性(新增行有侧车 ∧ 标头==侧车投影)'
const GATE_TRIGGERS = ['PROJECT_PLAN.md']
const GATE_MODE = 'blocking'
const GATE_HINT = [
  '读数:node scripts/check-plan-fields.mjs;结清存量:node scripts/plan-fields-extract.mjs --apply(只搬说辞不改台账行)',
]

// 注册面取材 = **工作树**的 runner:本票 G-965 正是在同一枚提交里把该块从 warn 改成 blocking,
// 提交前 HEAD 必然还是旧档位 —— 拿 HEAD 判等于要求用例在落地前先红。真仓注册面的权威复核在提交链上
// (门 89 按 HEAD ∪ 索引判 R5/R13),本文件只锁"将要入库的这一版逐字是什么"。
const runnerText = () => readFileSync(new URL('../guardian-runner.mjs', import.meta.url), 'utf8')
const mk = (raw, line = 1) => ({ line, state: 'open', raw, key: compositeKeyOf(raw) })

describe('守门装车证明(§22c)', () => {
  it('① 注册条目由装件器同一份文本生成:blocking 档(不再是 warn)且 skipEnv 成套', () => {
    const want = buildEntry({
      id: GATE_ID,
      section: '计划/台账',
      label: GATE_LABEL,
      script: GATE_SCRIPT,
      skipEnv: GATE_SKIP_ENV,
      triggers: GATE_TRIGGERS,
      hint: GATE_HINT,
      mode: GATE_MODE,
    }).join('\n')
    assert.ok(
      runnerText().includes(want),
      `runner 里没有逐字一致的注册项(blocking 档 + skipEnv 成套)。期望:\n${want}`,
    )
    assert.notEqual(GATE_MODE, 'warn', '档位必须已从 warn 升出,否则差值强制不生效')
    assert.ok(
      runnerText().includes(`    script: '${GATE_SCRIPT}',`) &&
        runnerText().includes(
          `    stagedTriggers: [${GATE_TRIGGERS.map((t) => `'${t}'`).join(', ')}],`,
        ) &&
        runnerText().includes('    args: [],'),
      'script / args / stagedTriggers 不得漂(漂了就是另一道门的射程)',
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
  it('新行无租约无侧车 ⇒ A1 点名到枚,且 verdict 红并 exit 1', () => {
    const v = judge([mk('- [ ] G-1 甲 细节')], { baseRowTexts: new Set(), map: new Map() })
    assert.equal(v.a1, 1)
    assert.match(v.a1List[0], /G-1/, '点名必须带得出编号,否则人无法复跑')
    const r = verdict(v, 'staged')
    assert.equal(r.state, 'red')
    assert.equal(r.code, 1, '新增违规必须冒红(升 blocking 后这是唯一的拦截面)')
  })

  it('全量档无基准 ⇒ a1 报 NA 且不当 red(§0.3 没判不写成判过)', () => {
    const v = judge([mk('- [ ] G-1 甲 细节')], { map: new Map() })
    assert.equal(v.hasBase, false)
    const r = verdict(v, 'head')
    assert.match(r.line, /a1=NA/)
    assert.equal(r.code, 0, '只有存量 ⇒ 不得冒红(§12e)')
  })

  it('只有存量(行已在基准面且缺侧车)⇒ 只报数,staged 面也 exit 0(零误拦)', () => {
    const row = '- [ ] G-1 甲 细节'
    const v = judge([mk(row)], { baseRowTexts: new Set([row]), map: new Map() })
    assert.equal(v.a1, 0)
    assert.equal(v.stock, 1)
    const r = verdict(v, 'staged')
    assert.equal(r.state, 'warn')
    assert.equal(r.code, 0, '存量缺侧车不得拦提交')
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
    const r = verdict(judge([bad], { map }), 'staged')
    assert.equal(r.state, 'red')
    assert.equal(r.code, 1)
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
