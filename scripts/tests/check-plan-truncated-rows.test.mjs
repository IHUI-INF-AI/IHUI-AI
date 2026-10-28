// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-plan-truncated-rows.mjs` 的镜像测试(§22c:判据 import 源脚本的 `__test__`,本文件零复制)。
 * 钉的六件事:
 *  1. 票面两型各能命中 1 例(R1 空正文 / R2 截断收尾);
 *  2. 正常行 0 误报(行首标记 + 整段正文、句中逗号 + 句号收尾都不得进射程);
 *  3. 基线内命中只报数,不判红;
 *  4. 基线外新增命中判红;
 *  5. fail-closed:被审面读不到 ⇒ 非零退出;基线缺失/坏形状 ⇒ 未判定(不当 0 存量);
 *  6. 形状锁:两型识别必须 import 单源 `check-plan-fragment-rows.mjs`,门体不自带第二份判据。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../check-plan-truncated-rows.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, '..', 'check-plan-truncated-rows.mjs')
const BASELINE = path.join(HERE, '..', 'check-plan-truncated-rows-baseline.json')

const EMPTY = '- [ ]（认领已释放@2026-10-23/stale-claim-strip#fixture-27）'
const HEALTHY_LEAD = '- [ ]（认领已释放@2026-10-23/x） **本项遗留** ① 补 SMTP ② 补退信钩子'
const TRUNCATED = '- [ ] G-9002 确认旁路仍在调用方(`commands/agent.ts:1757`),'
const HEALTHY_CLOSED = '- [ ] G-9003 正常一行,句中可以有逗号,收尾是句号。'
const DOC = [EMPTY, HEALTHY_LEAD, TRUNCATED, HEALTHY_CLOSED].join('\n')

describe('check-plan-truncated-rows 镜像档', () => {
  it('R1 空正文命中 1 例;行首标记 + 整段正文的健康行不误报', () => {
    const c = G.collect(DOC)
    assert.equal(c.counts[G.TYPE_EMPTY], 1, '空正文行必须恰好命中 1 枚')
    assert.equal(c.hits.find((h) => h.line === 1)?.rule, 'R1')
    assert.equal(
      c.hits.some((h) => h.line === 2),
      false,
      '有正文的健康长行不得判 R1',
    )
  })

  it('R2 截断收尾命中 1 例;句中逗号但句号收尾的正常行不误报', () => {
    const c = G.collect(DOC)
    assert.equal(c.counts[G.TYPE_TRUNCATED], 1, '截断收尾行必须恰好命中 1 枚')
    assert.equal(c.hits.find((h) => h.line === 3)?.rule, 'R2')
    assert.equal(
      c.hits.some((h) => h.line === 4),
      false,
      '正常行不得进 R2 射程',
    )
    assert.equal(c.hits.length, 2, `正常行 0 误报(两型合计应恰为 2,实读 ${c.hits.length})`)
    assert.equal(c.denominator.rows, 4, '分母必须来自单源 parseTaskRows')
  })

  it('基线内命中只报数、不判红', () => {
    const c = G.collect(DOC)
    const base = G.buildBaseline(c.hits)
    const v = G.judgeRatchet(c.hits, G.parseBaseline(JSON.stringify(base)))
    assert.equal(v.state, 'ok', '基线内命中被判红 ⇒ 造出恒红门(§12e)')
    assert.equal(v.stock.length, 2)
    assert.equal(v.fresh.length, 0)
  })

  it('基线外新增命中判红(点名带行号 + 判据编号 + 身份)', () => {
    const c = G.collect(DOC)
    const base = G.buildBaseline(c.hits)
    const added = G.collect(`${DOC}\n- [ ] G-9100 新增截断行还在等参数,`)
    const v = G.judgeRatchet(added.hits, base)
    assert.equal(v.state, 'blocking')
    assert.equal(v.fresh.length, 1)
    assert.equal(v.fresh[0].rule, 'R2')
    assert.equal(typeof v.fresh[0].line, 'number')
    assert.match(v.fresh[0].key, /^[KT]:/)
  })

  it('基线缺失/坏形状 ⇒ 未判定,绝不当 0 存量继续', () => {
    const c = G.collect(DOC)
    assert.equal(G.judgeRatchet(c.hits, null).state, 'undetermined')
    assert.equal(G.parseBaseline('{'), null)
    assert.equal(G.parseBaseline('{"version":1}'), null)
    assert.equal(G.parseBaseline(''), null)
  })

  it('枚举到 0 枚登记行 ⇒ 不记绿(列盲区)', () => {
    assert.equal(G.collect('# 只有标题,以逗号收尾,\n').denominator.rows, 0)
  })

  it('fail-closed:被审面读不到时 CLI 非零退出(仓外 fixture 文件不存在)', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--worktree'], {
      encoding: 'utf8',
      env: { ...process.env, IHUI_PLAN_FRAGMENT_DOC: 'NO-SUCH-TRUNCATED-ROWS-FIXTURE.md' },
    })
    assert.equal(r.status, 2, `读不到台账必须 exit 2,实读 ${r.status};stdout=${r.stdout}`)
    assert.match(r.stdout, /未判定/)
  })

  it('fail-closed:基线档读不到时 CLI 非零退出(不当 0 存量)', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--baseline=NO-SUCH-BASELINE.json'], {
      encoding: 'utf8',
    })
    assert.equal(r.status, 2, `基线读不到必须 exit 2,实读 ${r.status};stdout=${r.stdout}`)
    assert.match(r.stdout, /未判定/)
  })

  it('基线档在仓内且可解析(与既有 scripts/*-baseline.json 同目录同形态)', () => {
    const base = G.parseBaseline(readFileSync(BASELINE, 'utf8'))
    assert.ok(base, '基线档必须能被本尺自己的解析器读回')
    assert.equal(base.version, 1)
    for (const type of G.TYPES) assert.ok(Array.isArray(base.types[type].keys))
  })

  it('形状锁:识别 import 单源,门体不自带第二份判据', () => {
    const src = readFileSync(SCRIPT, 'utf8')
    assert.match(src, /from '\.\/check-plan-fragment-rows\.mjs'/, '两型识别必须委派单源尺子')
    assert.doesNotMatch(src, /CONTINUATION_PUNCT\s*=/, '门体不得另立续写标点集(第二份判据必漂)')
    assert.doesNotMatch(src, /const\s+\w*(ROW|FRAGMENT)_RE\s*=/, '门体不得另写"什么算残行"的正则')
  })
})
