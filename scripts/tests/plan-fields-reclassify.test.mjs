// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `plan-fields-reclassify.mjs` 镜像测试(§22c)—— 从外部 import 生产出口 `__test__`,
 * 判据一律走生产函数(`buildReclassifyPlan` / `verifyLanded` + extract 的 `writeDedupedRecords`),
 * 测试里**不复制任何判据常量**(why 长度、owner 形态、桶映射全部由被测代码回答)。
 *
 * 三条承重(票 O68):
 *  ① 改判必须能看见**派单桶**的 before/after(否则"改完了"与"桶没动"分不出来);
 *  ② 任一条声明不成话 ⇒ **整批不落**(不做部分应用);
 *  ③ 落盘后回读逐键自证,且不误伤未声明的键。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { __test__ as X } from '../plan-fields-reclassify.mjs'
import { writeDedupedRecords } from '../plan-fields-extract.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

/** 夹具键用复合主键现算(手写键会把"侧车接不上"误测成"改判判错")。 */
const ROW = '- [ ]〔归:机主真机验证面｜等:—〕 O02 跨端 UI 单一源:小程序端与 App(RN)端逐档同值'
const KEY = 'O02#跨端UI单一源'
const WHY = '行内标头已改归机主真机面(2026-10-29),剩余仅真机观感读数,本机结构上不可做'
const rowOf = (raw = ROW) => ({ line: 1, state: 'open', raw })
const recOf = (extra = {}) => ({
  key: KEY,
  waiting: 'none',
  blocking: '',
  updatedAt: '2026-10-25T08:18:07.725Z',
  updatedBy: 'plan-fields-reclassify',
  ...extra,
})
const fieldsOf = (rec = recOf()) => ({ map: new Map([[KEY, rec]]), undetermined: false })
const planOf = (items, opts = {}) =>
  X.buildReclassifyPlan({
    rows: opts.rows ?? [rowOf()],
    beforeFields: opts.beforeFields ?? fieldsOf(),
    headFields: opts.headFields ?? null,
    records: opts.records ?? [[...(opts.beforeFields ?? fieldsOf()).map.values()][0]],
    items,
    nowIso: '2026-10-29T00:00:00.000Z',
  })

describe('声明式改判:桶维读数与整批不落', () => {
  it('改判前 actionable(散文与侧车冲突)→ 改后 owned-elsewhere(冲突消失)', () => {
    const p = planOf([{ key: KEY, owner: '机主真机验证面', waiting: 'none', why: WHY }])
    assert.equal(p.error, undefined)
    assert.equal(p.items[0].before.bucket, 'actionable')
    assert.equal(p.items[0].before.conflict, true, '行内标头说"归机主"而侧车说"可做"—— 这正是本票的病')
    assert.equal(p.items[0].after.bucket, 'owned-elsewhere')
    assert.equal(p.items[0].after.conflict, false)
    assert.equal(p.changes[0].rec.owner, '机主真机验证面')
    assert.equal(p.changes[0].rec.updatedBy, 'plan-fields-reclassify')
  })

  it('why 太短 ⇒ 整批拒(判据来自 extract 的 applyReclassify,不另写第二把)', () => {
    const p = planOf([{ key: KEY, owner: '机主真机验证面', why: '短' }])
    assert.match(p.error, /少于 10 字/)
    assert.equal(p.changes, undefined, '被拒的批次不得留下改动')
  })

  it('判定面找不到该行的 key ⇒ 整批拒(挂空的改判无从复算桶)', () => {
    const p = planOf([{ key: KEY, owner: '机主真机验证面', why: WHY }], { rows: [] })
    assert.match(p.error, /找不到对应登记行/)
  })

  it('同一份声明里同键两份 ⇒ 整批拒(两份矛盾的交代没有胜者)', () => {
    const p = planOf([
      { key: KEY, owner: '甲面持有人', why: WHY },
      { key: KEY, owner: '乙面持有人', why: WHY },
    ])
    assert.match(p.error, /重复声明/)
  })

  it('owner 形态非法(截断符 / 占位)⇒ 整批拒(与抽出器的 cleanOwner 同一把尺)', () => {
    assert.match(planOf([{ key: KEY, owner: '…', why: WHY }]).error, /owner 形态不合法/)
    assert.match(planOf([{ key: KEY, owner: '待认领', why: WHY }]).error, /owner 形态不合法/)
  })

  it('只给 why 不给任何语义字段 ⇒ 整批拒(不制造"改过"的假账)', () => {
    assert.match(planOf([{ key: KEY, why: WHY }]).error, /没有声明任何语义字段/)
  })

  it('改判目标落已禁桶 ⇒ 整批拒;从禁桶改出来则放行(禁桶族唯一出路)', () => {
    assert.match(planOf([{ key: KEY, waiting: 'env', why: WHY }]).error, /已禁形态/)
    const out = planOf(
      [{ key: KEY, owner: '门 130 持有人', waiting: 'none', why: '等条件禁令清偿:改归具体持有人,本行不再挂等条件牌' }],
      { beforeFields: fieldsOf(recOf({ waiting: 'env' })) },
    )
    assert.equal(out.error, undefined)
    assert.equal(out.items[0].before.bucket, 'waiting-env')
    assert.equal(out.items[0].after.bucket, 'owned-elsewhere')
  })

  it('与写面现状同形 ⇒ 零改动(重跑幂等,不制造假账)', () => {
    const p = planOf(
      [{ key: KEY, owner: '机主真机验证面', why: WHY }],
      { beforeFields: fieldsOf(recOf({ owner: '机主真机验证面' })) },
    )
    assert.equal(p.error, undefined)
    assert.equal(p.changes.length, 0)
    assert.equal(p.items[0].unchanged, true)
  })

  it('写面与判定面(HEAD)读数不同 ⇒ 报对照读数,不冒充写面读数', () => {
    const p = planOf([{ key: KEY, owner: '机主真机验证面', why: WHY }], {
      beforeFields: fieldsOf(recOf({ owner: '机主真机验证面' })),
      headFields: fieldsOf(),
    })
    assert.equal(p.items[0].unchanged, true)
    assert.equal(p.items[0].headRead.bucket, 'actionable', 'HEAD 面仍是旧读数 ⇒ 必须点出来(未提交)')
  })
})

describe('声明式改判:落盘原子 + 回读逐键自证', () => {
  it('落盘后回读通过,且未声明的键逐字不动', () => {
    const dir = mkScratch('pf-reclassify')
    try {
      const file = path.join(dir, 'scripts/data/plan-fields.jsonl')
      mkdirSync(path.dirname(file), { recursive: true })
      const other = { key: 'G-50#DevEnv搬入G', waiting: 'none', blocking: '', updatedAt: '2026-10-25T08:18:07.725Z', updatedBy: 'plan-fields-extract' }
      const before = recOf()
      writeFileSync(file, [JSON.stringify(before), JSON.stringify(other)].join('\n') + '\n', 'utf8')

      const p = planOf([{ key: KEY, owner: '机主真机验证面', waiting: 'none', why: WHY }], {
        records: [before, other],
      })
      assert.equal(p.error, undefined)
      const w = writeDedupedRecords(dir, p.nextRecords)
      assert.equal(w.before, 2)
      assert.equal(w.after, 2, '改判不该增删键')

      const back = X.verifyLanded(dir, p.nextRecords)
      assert.equal(back.ok, true, `回读应通过,实测:${back.why}`)
      assert.equal(back.keys, 2)
      const lines = readFileSync(file, 'utf8').trim().split('\n')
      assert.ok(lines.includes(JSON.stringify(other)), '未声明的键必须逐字不动')
      assert.ok(lines.some((l) => l.includes('"owner":"机主真机验证面"')), '声明的键必须落盘')
    } finally {
      rmScratch(dir)
    }
  })

  it('回读与计划不符 ⇒ verifyLanded 必须报错(尺子有牙)', () => {
    const dir = mkScratch('pf-reclassify-tamper')
    try {
      const file = path.join(dir, 'scripts/data/plan-fields.jsonl')
      mkdirSync(path.dirname(file), { recursive: true })
      const tampered = recOf({ owner: '别人' })
      writeFileSync(file, JSON.stringify(tampered) + '\n', 'utf8')
      const want = [recOf({ owner: '机主真机验证面' })]
      const back = X.verifyLanded(dir, want)
      assert.equal(back.ok, false)
      assert.match(back.why, /回读与计划不符/)
    } finally {
      rmScratch(dir)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
