// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— 票 G-998142 的只读普查尺子(check-state-transition-guard.mjs)
 *
 * 判据一律 **import 门体的 __test__ 出口**,本文件不抄第二份正则/链扫描(§22c 红线:"禁止在测试
 * 文件里复制源判据"—— 复制了它就只是复读机,漂开了也照样绿)。
 * 真仓阳性对照(T3)只跑一次 analyze 并缓存复用:全量普查是分钟级慢门,每条用例各跑一遍会把
 * `node --test` 拖成十分钟,而"跑得动"是取证能重复的前提。
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-state-transition-guard.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const GATE_SRC = readFileSync(resolve(HERE, '..', 'check-state-transition-guard.mjs'), 'utf8')
// runner 取 **HEAD 面**(磁盘副本常年滞后 ⇒ 按磁盘判会把刚落地的接线读成"未接",反之亦然)。
let runnerAtHead = null
function runnerHead() {
  if (runnerAtHead === null) {
    try {
      runnerAtHead = readFileSync(resolve(HERE, '..', 'guardian-runner.mjs'), 'utf8')
    } catch {
      runnerAtHead = ''
    }
  }
  return runnerAtHead
}

const HEAD_IMPORTS = "import { db } from './db'\nimport { agentTasks, sql, eq, ne, and } from './schema'\n\n"
const J = (body) => gate.judgeSource('apps/api/src/db/x.ts', HEAD_IMPORTS + body)

/** 同一夹具只差 WHERE 里那一个状态谓词 —— 一红一绿才算判据有牙(不是靠两个不同夹具各证一头)。 */
function casPair() {
  const base =
    'export async function runTask(id: string) {\n' +
    '  const r = await db.select().from(agentTasks)\n' +
    '  if (r[0].status === 1) {\n' +
    '    await db\n' +
    '      .update(agentTasks)\n' +
    '      .set({ status: 2 })\n' +
    '      .where(%S)\n' +
    '  }\n' +
    '}\n'
  return {
    without: base.replace('%S', 'eq(agentTasks.id, id)'),
    with: base.replace('%S', "and(eq(agentTasks.id, id), ne(agentTasks.status, 'settled'))"),
  }
}

let cachedFull = null
function fullCensus() {
  if (!cachedFull) cachedFull = gate.analyze(ROOT, 'head', { strict: false, maxSites: 0 })
  return cachedFull
}

describe('G-998142 普查尺子:判据只有一份(形状锁)', () => {
  it('T1 门体复用既有链扫描与遮罩,未自带第二台分词器/第二遍配平', () => {
    assert.ok(GATE_SRC.includes("from './lib/code-mask.mjs'"), '必须引 code-mask 那一份分词器')
    assert.ok(GATE_SRC.includes("from './lib/face-reader.mjs'"), '必须走 face-reader 取材(门 118 口径)')
    assert.ok(
      GATE_SRC.includes("from './check-batch-write-count-honesty.mjs'"),
      '链扫描/体切分必须复用门 134 那一份,不得再写一遍',
    )
    for (const banned of ['function scanSpans', 'function findWriteChains', 'function closeParen', 'function findFunctionBodies', 'function maskText']) {
      assert.ok(!GATE_SRC.includes(banned), `门体不得自带:${banned}(两处实现必漂移,§22c)`)
    }
  })

  it('T2 结论行自报未接线;被接进 runner 时本条必须翻红(方向锁)', () => {
    // 判据不能拿"头注里有没有出现某字样"当尺子 —— 本文件的解释性散文里就逐字写着那些字样,
    // 按字样判会把门自己立项说明判成仓库违规(守门 70/131/150 同一课)。看的是**机器事实**:
    // analyze 的 `wired` 字段必须恒 false,且 runner 面上不得出现本门脚本名。
    assert.equal(gate.analyze.name, 'analyze')
    assert.equal(fullCensus().wired, false, '结论行必须自报"未接提交链"')
    const wired = runnerHead().includes('check-state-transition-guard')
    assert.equal(
      wired,
      false,
      '守门 89 的 R2 会对"谎称已接/实际已接而文档说不接"分叉判红;真要接线,先带证据改这条测试与头注(§12e)',
    )
  })

  it('T3 真仓阳性对照:HEAD 面必须看得见候选(看不见存量的尺子不算尺子)', () => {
    const out = fullCensus()
    assert.ok(out.candidates.length > 0, 'HEAD 面候选 0 ⇒ 判据对本型失明,不得读成"仓库没问题"')
    assert.ok(out.agg.files > 100, `扫描面异常小:${out.agg.files}`)
    // 三态不得并桶:候选 = 站点 + 放过 + 未成状(未判定另有自己的计数)
    assert.equal(
      out.agg.candidates,
      out.agg.sites + out.agg.passed + out.agg.notInShape,
      '站点/放过/未成状 必须恰好铺满候选面',
    )
    assert.ok(out.sites.every((s) => !s.cas && !!s.read), '站点定义:无 CAS 谓词且有状态读取证据')
    assert.ok(out.passed.every((p) => p.cas && !!p.channel), '放过定义:CAS 在位且带 channel 名(放过与没看见必须各自被问到)')
  })

  it('T4 双向锁:同一夹具只差一个状态谓词 ⇒ 一侧站点、一侧放过', () => {
    const { without, with: withCas } = casPair()
    assert.equal(J(without).sites.length, 1)
    assert.equal(J(without).passed.length, 0)
    assert.equal(J(withCas).sites.length, 0)
    assert.equal(J(withCas).passed[0].channel, 'cas-drizzle')
  })

  it('T5 未判定逐型有牙(不冒红也不记绿)', () => {
    const kinds = (body) => J(body).undetermined.map((u) => u.kind)
    assert.deepEqual(
      kinds(
        'export async function f(id: string) {\n' +
          '  const r = await db.select().from(agentTasks)\n' +
          '  if (r[0].status === 1) await db.update(agentTasks).set({ status: 2 }).where((t) => eq(t.id, id))\n' +
          '}\n',
      ),
      ['opaque-chain'],
    )
    assert.ok(
      kinds('export async function f() {\n  await db.update(agentTasks).where(eq(agentTasks.id, 1))\n}\n').includes(
        'no-set-link',
      ),
    )
    assert.deepEqual(
      kinds(
        'const r = await db.select().from(agentTasks)\n' +
          "if (r[0].status === 1) await db.update(agentTasks).set({ status: 2 }).where(eq(agentTasks.id, 1))\n",
      ),
      ['no-body'],
    )
    assert.deepEqual(
      kinds(
        'export async function f(id: string) {\n' +
          '  const r = await db.select().from(agentTasks)\n' +
          "  if (r[0].status === 1) await db.update(agentTasks).set({ status: 2 }).where(sql`status <> 9`)\n" +
          '}\n',
      ),
      ['where-sql-blanked'],
    )
  })

  it('T6 退出码三臂 + 空枚举判死(默认档恒不判红不是恒真式)', () => {
    const und = [{ kind: 'no-body' }]
    assert.equal(gate.finishAggregate({ files: 9, candidates: 3, sites: 3, undetermined: und, strict: false }).exit, 0)
    assert.equal(gate.finishAggregate({ files: 9, candidates: 3, sites: 3, undetermined: und, strict: true }).exit, 2)
    assert.equal(gate.finishAggregate({ files: 9, candidates: 3, sites: 3, undetermined: [], strict: true }).exit, 1)
    assert.equal(gate.finishAggregate({ files: 9, candidates: 0, sites: 0, undetermined: [], strict: false }).exit, 2)
    assert.throws(() => gate.analyze(resolve(HERE, '..', '..', '..', 'definitely-not-a-repo-root'), 'head'), (e) => e instanceof Error)
  })

  it('T7 遮罩等长是行号的前置(视图B 少一种词法类别就会静默错行)', () => {
    const src =
      "// status: 2\nconst a = 'status: 3'\nconst b = `UPDATE t SET status = 4 WHERE id = 5`\nexport async function f() {\n  await db.update(agentTasks).set({ status: 2 })\n}\n"
    const m = gate.maskCommentsKeepStrings(src)
    assert.equal(m.length, src.length)
    assert.ok(!m.includes('// status'), '注释必须遮掉')
    assert.ok(m.includes('status = 4'), '模板原文必须留着(裸 SQL 的列名住在里面)')
    assert.equal(m.split('\n').length, src.split('\n').length)
    assert.equal(gate.lineOf(m, m.indexOf('UPDATE')), 3)
  })

  it('T8 读数可 JSON 序列化(CI/台账消费的是机器面,不是终端彩字)', () => {
    const out = fullCensus()
    const round = JSON.parse(JSON.stringify(out))
    assert.equal(round.agg.candidates, out.agg.candidates)
    assert.equal(round.wired, false)
    assert.ok(round.sites.length === out.sites.length)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
