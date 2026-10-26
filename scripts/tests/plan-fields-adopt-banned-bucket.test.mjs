// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `adoptMovesOf` 搬支的**违禁桶族**补洞锁(2026-10-27 立)。
 *
 * 立因(另一名工程师取证原文):搬支只拒 `waiting-human` / `blocking 拍板残留`,**不拒 `waiting-env`**
 * ⇒ 一枚等条件孤儿键若目标键为空,`--apply` 会把违禁桶整值搬到活键上,凭空造出一枚真 F12 活票 ——
 * 台账面上本来干净的行,被一次归并改写成机主两条例令(2026-10-23 待拍板 / 2026-10-25 等条件)要拦的形态。
 * 洞在生产者一侧,不在判据一侧,所以补的是"拦归并",不是"改数据"。
 *
 * 四条承重:
 *  ① 正向对照:`waiting=env` 的孤儿键 + 目标键该字段为空 ⇒ **不得搬**,留在 `skipped` 并点名;
 *     同批钉住"守恒闸单独拦不住这一型"(漂移读 0 ⇒ 唯一的防线就是这一支,摘掉即翻红)。
 *  ② 反向对照:旧键已出桶(`waiting=none`、blocking 不带拍板残留)⇒ 仍能正常**搬**;
 *     目标键已有记录且逐字覆盖 ⇒ 仍能**退场**(不许把原有能力削坏)。
 *  ③ 原有两臂(waiting-human / blocking 拍板残留)仍拒 —— 补齐整族不是替换。
 *  ④ 单源 import 锁:条件必须 import 门 234 的 `rotReasonsOf`(§0.6/§22c),搬支内不得再出现
 *     第二份桶名/词表实现。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as X } from '../plan-fields-extract.mjs'
import { compositeKeyOf } from '../lib/plan-task-index.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const EXTRACT_SRC = readFileSync(path.join(HERE, '..', 'plan-fields-extract.mjs'), 'utf8')

/** 孤儿键 = 旧号段 + 与活键**逐字相等**的标题锚点(锚点现算,不手写键,否则测的是"侧车接不上")。 */
const oldKeyOf = (newKey, oldId) => `${oldId}#${newKey.slice(newKey.indexOf('#') + 1)}`
const openRow = (raw, line = 1) => ({ line, state: 'open', raw })

const STAMP = '2026-10-27T00:00:00.000Z'
/** 活键散文面本就判"等环境"(自述槽 `在等:`)⇒ 把 waiting=env 搬上去时桶零漂移(守恒闸拦不住这一型)。 */
const ENV_ROW = '- [ ] G-70 备份链重建 在等:上游镜像源同步'
/** 活键散文面判"归他人" ⇒ 已出桶的旧记录搬上去零漂移(反向对照)。 */
const OWNED_ROW = '- [ ] G-70 备份链重建 —— 归属:备份链持有人'

describe('孤儿键归并:违禁桶族整族不搬(2026-10-27 补洞)', () => {
  it('① 正向对照:waiting=env 的孤儿键 ⇒ 不得搬到活键,必须留在 skipped 并点名', () => {
    const newKey = compositeKeyOf(ENV_ROW)
    const rec = { key: oldKeyOf(newKey, 'G-79'), waiting: 'env', blocking: '上游镜像源同步', updatedAt: STAMP }
    const r = X.adoptMovesOf([rec], [openRow(ENV_ROW)], new Map())
    assert.equal(r.moves.length, 0, '等条件孤儿键被搬到活键 = 凭空造出真 F12 活票,必须拒')
    assert.equal(r.retires.length, 0)
    assert.equal(r.skipped.length, 1)
    assert.equal(r.skipped[0].key, rec.key)
    assert.match(r.skipped[0].why, /已禁形态/, '点名原因必须摆出判据给的那句话')
    assert.match(r.skipped[0].why, /reclassify/, '拒搬的出路仍是逐条改判,不是本器代裁')
  })

  it('①b 立因锁:同一枚记录的守恒闸读数是"零漂移" ⇒ 拦住它的只有新补的这一支', () => {
    const newKey = compositeKeyOf(ENV_ROW)
    const rec = { key: oldKeyOf(newKey, 'G-79'), waiting: 'env', blocking: '上游镜像源同步', updatedAt: STAMP }
    const after = new Map()
    after.set(newKey, { ...rec, key: newKey })
    assert.equal(
      X.batchBucketDrift([ENV_ROW], after, new Map()).length,
      0,
      '搬上去前后都判 waiting-env ⇒ 漂移闸天然放行,这一型只能由违禁族判据拦',
    )
  })

  it('② 反向对照:已出桶的旧记录(waiting=none、blocking 不带拍板残留)⇒ 仍能正常搬', () => {
    const newKey = compositeKeyOf(OWNED_ROW)
    const rec = {
      key: oldKeyOf(newKey, 'G-79'),
      owner: '备份链持有人',
      waiting: 'none',
      blocking: '等容器镜像源就绪',
      updatedAt: STAMP,
    }
    const r = X.adoptMovesOf([rec], [openRow(OWNED_ROW)], new Map())
    assert.equal(r.skipped.length, 0, '干净记录不得被新条件误伤(补洞不能削掉原有能力)')
    assert.equal(r.moves.length, 1)
    assert.equal(r.moves[0].fromKey, rec.key)
    assert.equal(r.moves[0].toKey, newKey)
    assert.equal(r.moves[0].rec.key, newKey)
    assert.equal(r.moves[0].rec.updatedBy, 'plan-fields-extract-adopt')
  })

  it('②b 反向对照:目标键已有逐字覆盖的记录 ⇒ 退场支照旧走得通', () => {
    const newKey = compositeKeyOf(OWNED_ROW)
    const rec = {
      key: oldKeyOf(newKey, 'G-79'),
      owner: '备份链持有人',
      waiting: 'none',
      blocking: '等容器镜像源就绪',
      updatedAt: STAMP,
    }
    const live = { ...rec, key: newKey, updatedAt: '2026-10-28T00:00:00.000Z' }
    const r = X.adoptMovesOf([rec], [openRow(OWNED_ROW)], new Map([[newKey, live]]))
    assert.equal(r.retires.length, 1, '删旧键零信息丢失 ⇒ 退场,不受违禁族闸影响')
    assert.equal(r.moves.length, 0)
    assert.equal(r.skipped.length, 0)
  })

  it('③ 原有两臂仍拒:waiting=human 与 blocking 带拍板残留(补齐整族 ≠ 替换)', () => {
    const newKey = compositeKeyOf(OWNED_ROW)
    const human = X.adoptMovesOf(
      [{ key: oldKeyOf(newKey, 'G-73'), waiting: 'human', updatedAt: STAMP }],
      [openRow(OWNED_ROW)],
      new Map(),
    )
    assert.equal(human.moves.length, 0)
    assert.match(human.skipped[0]?.why ?? '', /已禁形态/)

    const residual = X.adoptMovesOf(
      [
        {
          key: oldKeyOf(newKey, 'G-74'),
          owner: '备份链持有人',
          waiting: 'none',
          blocking: '等机主拍板更新源',
          updatedAt: STAMP,
        },
      ],
      [openRow(OWNED_ROW)],
      new Map(),
    )
    assert.equal(residual.moves.length, 0, 'owner 在场时桶判 owned-elsewhere,拍板残留仍得拒')
    assert.match(residual.skipped[0]?.why ?? '', /已禁形态/)
  })

  it('④ 单源 import 锁:违禁族判据 import 门 234 的 rotReasonsOf,搬支内不得有第二把尺子', () => {
    assert.match(
      EXTRACT_SRC,
      /import \{ rotReasonsOf \} from '\.\/check-plan-fields\.mjs'/,
      '整族读数只许一份:搬支必须问门 234,而不是自己数桶名',
    )
    const body = EXTRACT_SRC.slice(
      EXTRACT_SRC.indexOf('export function adoptMovesOf'),
      EXTRACT_SRC.indexOf('export function applyAdoptMoves'),
    )
    assert.ok(body.length > 0, '取到了 adoptMovesOf 的函数体')
    assert.match(body, /rotReasonsOf\(rec\)/)
    assert.doesNotMatch(body, /bucketFromFields\s*\(/, '搬支内再算一遍桶 = 第二把尺子(§0.6)')
    assert.doesNotMatch(body, /=== 'waiting-human'/, '旧的那支 ad-hoc 桶名比对不得回潮')
    assert.doesNotMatch(body, /String\(rec\?\.blocking \?\? ''\)\.includes\(/, '拍板残留的 ad-hoc 词判不得回潮')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
