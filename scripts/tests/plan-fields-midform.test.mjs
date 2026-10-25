// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 门 234 A2 三档等式 + 抽取器同键冲突闸的镜像测试(§22c:判据一律 import 生产出口,零复算)。
 *
 * 立因(2026-10-26 现读):主席报 `a2=4 conflict=1`,四条 A2 里三条是 `〔归:X｜等:—〕` 这种
 * **投影器物从不产出、但语义与投影完全等价**的手写占位形态,第四条是抽取器把正文历史注记里的
 * `〔归:机主处置隧道…〕` 当成本行归属。四条都不是"另一席正在改的行"(连续 25 个台账提交里
 * 形态恒定),所以判据侧的收口必须让等式对这两种形态都成立,而不是把台账判成恒红(§12e)。
 *
 * 四组承重(任务书 4 条):
 *  ① 三条真实占位形态 ⇒ A2=0、midform=1、exit 0(点名不判红);
 *  ② 行内写错 owner / 等段换成真等待 ⇒ 仍 A2=1、exit 1(不许把"说错了"一起放过);
 *  ③ 同批同键投影互斥 ⇒ 抽取器拒写并点名(两个写入口 + 规划面);门面 conflict 进 blind 不判 A2;
 *  ④ 摘掉新判据的两个方向各翻一次红:退回裸逐字比 ⇒ ① 红;改成恒 exact ⇒ ② 红。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G, judge, verdict } from '../check-plan-fields.mjs'
import { __test__ as H } from '../lib/plan-field-line.mjs'
import { __test__ as X } from '../plan-fields-extract.mjs'
import { cleanOwner, collisionKeysOf, writePendingRecords } from '../plan-fields-extract.mjs'
import { compositeKeyOf } from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const mk = (raw, line = 1) => ({ line, state: 'open', raw })

/** 三条真实形态的行内串(取 HEAD 台账原文那一段,不改一个字)。 */
const PLACEHOLDER_ROWS = [
  ['- [ ] 〔归:机主小程序后台域名白名单面｜等:—〕 G-957 小程序网页登录三处入口是死路', '机主小程序后台域名白名单面'],
  ['- [ ] 〔归:机主运维面｜等:—〕 G-329 机主 2026-09-28 拍板四条', '机主运维面'],
  ['- [ ] 〔归:机主运维面｜等:—〕 G-1182551 生产备份链日志写入侧 UTF-8', '机主运维面'],
]

describe('A2 三档等式:语义同、形态未收敛 ⇒ 只点名不判红', () => {
  it('① 三条真实占位形态(`｜等:—`)⇒ A2=0、midform=1、exit 0', () => {
    for (const [line, owner] of PLACEHOLDER_ROWS) {
      const rec = { key: compositeKeyOf(line), owner, waiting: 'none', updatedAt: '2026-10-25T00:00:00.000Z' }
      const v = judge([mk(line)], { map: new Map([[rec.key, rec]]) })
      assert.equal(v.a2, 0, `占位形态被误判成说错:${line}`)
      assert.equal(v.midform, 1, `占位形态必须点名(否则形态漂移没人看得见):${line}`)
      assert.equal(verdict(v, 'staged').code, 0, '语义等价的形态不得拦住提交(§12e 恒红门禁令)')
      const eq = H.headerEquivalence(line, rec)
      assert.equal(eq.kind, H.HEADER_KIND.MIDFORM)
      assert.equal(eq.want, `〔归:${owner}〕`)
    }
  })

  it('② 行内写错 owner ⇒ A2=1、exit 1(成对:中间态不得把"说错了"一起放过)', () => {
    const line = '- [ ] 〔归:换了一个面｜等:—〕 G-329 机主 2026-09-28 拍板四条'
    const rec = { key: compositeKeyOf(line), owner: '机主运维面', waiting: 'none' }
    const v = judge([mk(line)], { map: new Map([[rec.key, rec]]) })
    assert.equal(v.a2, 1)
    assert.equal(v.midform, 0)
    assert.equal(verdict(v, 'staged').code, 1)
  })

  it('②b 同 owner 但等段写成真等待 ⇒ A2=1(等段文案也是读数)', () => {
    const line = '- [ ] 〔归:机主运维面｜等:机主核隧道〕 G-329 机主 2026-09-28 拍板四条'
    const rec = { key: compositeKeyOf(line), owner: '机主运维面', waiting: 'none' }
    const v = judge([mk(line)], { map: new Map([[rec.key, rec]]) })
    assert.equal(v.a2, 1)
    assert.equal(v.midform, 0)
  })

  it('②c G-76 真形态:行内 `归:—｜等:机主核隧道` vs 侧车 `归:机主处置隧道` ⇒ 仍红', () => {
    const line = '- [ ] 〔归:—｜等:机主核隧道〕 G-76 生产备份链日志的写入侧编码要改成 UTF-8'
    const rec = { key: compositeKeyOf(line), owner: '机主处置隧道', waiting: 'none' }
    const v = judge([mk(line)], { map: new Map([[rec.key, rec]]) })
    assert.equal(v.a2, 1, '两面对归属的表态不同 ⇒ 必须点名,不得按中间态放过')
  })

  it('④ 摘掉新判据的两个方向各翻一次红(成对夹具,防判据被静默摘成恒放过/恒红)', () => {
    // 方向一:退回"裸逐字相等" ⇒ 占位形态全红(旧实现就是这型,4 枚恒红的来源)
    for (const [line, owner] of PLACEHOLDER_ROWS) {
      const want = H.renderHeader({ owner, waiting: 'none' })
      const span = H.locateSidecarHeader(line)
      const said = line.slice(span.start, span.end)
      assert.notEqual(said, want, '旧判据下这一行必须是不一致(否则夹具①不承重)')
    }
    // 方向二:改成"恒 exact"(把判据摘掉) ⇒ 真不一致必须仍能翻红
    const bad = '- [ ] 〔归:另一个面｜等:—〕 G-329 机主 2026-09-28 拍板四条'
    const rec = { key: compositeKeyOf(bad), owner: '机主运维面', waiting: 'none' }
    const eq = H.headerEquivalence(bad, rec)
    assert.equal(eq.kind, H.HEADER_KIND.MISMATCH, '读数不同必须落 mismatch,不得被中间态吞掉')
    assert.equal(verdict(judge([mk(bad)], { map: new Map([[rec.key, rec]]) }), 'staged').code, 1)
  })

  it('装车锁:门体 A2 分支真的走 headerEquivalence 且保留 MIDFORM 分支(不许改回裸逐字比)', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/check-plan-fields.mjs'), 'utf8')
    assert.match(src, /headerEquivalence\(line, rec\)/)
    assert.match(src, /HEADER_KIND\.MIDFORM/)
    assert.ok(
      !/want !== '' && headerOf\(line\) !== want/.test(src),
      '退回裸逐字比会让占位形态重新变成恒红门',
    )
  })
})

describe('抽取器:同批同键投影互斥 ⇒ 拒写并点名', () => {
  const KEY = compositeKeyOf('- [ ] G-7 同键冲突样例 —— 归属:甲面')
  const A = { key: KEY, owner: '甲面', waiting: 'none', updatedAt: '2026-10-26T00:00:00.000Z' }
  const B = { key: KEY, owner: '乙面', waiting: 'none', updatedAt: '2026-10-26T00:00:01.000Z' }

  it('③ collisionKeysOf 认出互斥键;同读数的重跑不算冲突', () => {
    assert.deepEqual(collisionKeysOf([A, B]), [KEY])
    assert.deepEqual(collisionKeysOf([A, { ...A, updatedAt: '2026-10-26T00:00:02.000Z' }]), [])
  })

  it('③ writeRecords 整键拒写并点名(同批只写干净键)', () => {
    const dir = mkScratch('sidecar2-dup')
    try {
      const ok = { key: 'G-8#干净的键', owner: '丙面', waiting: 'none', updatedAt: '2026-10-26T00:00:00.000Z' }
      const w = X.writeRecords(dir, [A, B, ok])
      assert.deepEqual(w.collisions, [KEY], '互斥键必须被点名')
      assert.equal(w.appended, 1, '只写干净键;互斥键一条都不写')
      assert.equal(X.readBackCount(dir), 1)
      const recs = readFileSync(path.join(dir, 'scripts/data/plan-fields.jsonl'), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
      assert.equal(recs.filter((r) => r.key === KEY).length, 0, '互斥键不得有任何一条落盘')
    } finally {
      rmScratch(dir)
    }
  })

  it('③ writePendingRecords 同批互斥 ⇒ 一条都不写(不许静默留最后一条)', () => {
    const dir = mkScratch('sidecar2-dup2')
    try {
      const w = writePendingRecords(dir, [A, B])
      assert.equal(w.rewritten + w.appended, 0)
      assert.deepEqual(w.collisions, [KEY])
      assert.equal(X.readBackCount(dir), 0)
    } finally {
      rmScratch(dir)
    }
  })

  it('③ planFromRows 同批互斥 ⇒ collisions 点名(规划面与写入口同一把尺)', () => {
    const p = X.planFromRows([], new Map())
    assert.deepEqual(p.collisions, [])
    // 同键两行(同题副本)抽成两个互斥 owner ⇒ 规划面必须看见
    const l1 = '- [ ] G-7 同键冲突样例 —— 归属:甲面'
    const l2 = '- [ ] G-7 同键冲突样例 —— 归属:乙面'
    const q = X.planFromRows([l1, l2], new Map())
    assert.deepEqual(q.collisions, [KEY], '同题副本两个归属 ⇒ 必须拒写点名')
  })
})

describe('抽取器:owner 取值面收窄(注记里的嵌入标头不算本行归属)', () => {
  it('G-76 型:正文历史注记里的 `〔归:机主处置隧道｜等:—〕` 不得被当成本行 owner', () => {
    const line =
      '- [ ] 〔归:—｜等:机主核隧道〕 G-76 **生产备份链日志的写入侧编码要改成 UTF-8**:' +
      '〔改判归机主处置隧道:改法已落地入库+影子等值,生产…〕〔副本正文并入·承载整段:…〕 归属**:生产备份链持有人。'
    const r = X.extractFromLine(line)
    assert.ok(!r || r.owner !== '机主处置隧道', `注记里的旧读数被当成本行归属:${JSON.stringify(r)}`)
  })

  it('超长 owner 不截断造值(截点常落在反引号/句中,G-63 那型)', () => {
    const long = '- [ ] G-9 超长归属样例 —— 归属:`scripts/lib/pre-commit-hook.js` 与 `scripts/safe-commit.mjs` 两条线持有人'
    const r = X.extractFromLine(long)
    assert.ok(!r || (r.owner ?? '').length <= 48, `超长值必须整条不造,实际:${JSON.stringify(r?.owner)}`)
    assert.equal(cleanOwner('`scripts/lib/x.mjs` 与 `scripts/safe-commit.mjs` 两条线持有人'), null)
  })

  it('孤立右括号(无反引号)不造值;真实带反引号标头写法仍保留', () => {
    assert.equal(cleanOwner('ai-service 成本账本)'), null)
    assert.equal(cleanOwner('`scripts/lib/commit-gate-attribution.mjs` 持有人)'), '`scripts/lib/commit-gate-attribution.mjs` 持有人)')
  })
})

describe('conflict 治理:互斥键位进 blind,不判 A2', () => {
  it('同键两条互斥且基准面没有 ⇒ conflict/A3 报数,该行 A2 不判(blind)', () => {
    const line = `- [ ] 〔归:甲面〕 G-7 同键冲突样例`
    const key = compositeKeyOf(line)
    const a = { key, owner: '甲面', waiting: 'none', updatedAt: '2026-10-26T00:00:00.000Z' }
    const b = { key, owner: '乙面', waiting: 'none', updatedAt: '2026-10-26T00:00:01.000Z' }
    const v = judge([mk(line)], { map: new Map([[key, b]]), allRecords: [a, b], baseSideSignatures: new Set() })
    assert.equal(v.a2, 0)
    assert.equal(v.blind, 1)
    assert.equal(v.conflict, 1)
    assert.equal(v.a3, 1, '基准面没有该矛盾签名 ⇒ A3 拦红')
  })

  it('G 出口同一引用(§22c:测试不另造一份判定)', () => {
    assert.equal(G.judge, judge)
    assert.equal(G.verdict, verdict)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
