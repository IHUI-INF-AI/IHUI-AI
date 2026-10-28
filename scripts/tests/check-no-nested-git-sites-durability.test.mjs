// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据 import 源脚本 __test__,本文件不复制第二份。
// 锁四件事:① 单源形状锁(台账行解析必须委派门 208 的 loadNamedSites/loadNamedExemptions,
//    不得自抄第二份「什么算合格登记行」);② 判据本体 import 生产实现且有牙;
// ③ 装车成套按注册与否分支(未注册 ⇒ 头注不得自称已接线;已注册 ⇒ blocking+skipEnv 成套
//    且 idsOfRegistry 反查无撞号);④ scratch 夹具路径(parseLedgerTexts 真走 §15b 唯一落点)
//    + 真仓 CLI 三档(全量/自检/两面旗)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-no-nested-git-sites-durability.mjs'
import { __test__ as gate208 } from '../check-no-nested-git.mjs'
import { idsOfRegistry } from '../check-gate-wiring.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-no-nested-git-sites-durability.mjs')
const SOURCE = readFileSync(SCRIPT, 'utf8')
const RUNNER_TEXT = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
const GATE_BASENAME = 'check-no-nested-git-sites-durability.mjs'
const FUTURE = '2099-01-01'

const run = (args = []) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

test('装车分支:未注册 ⇒ 头注不得自称已接线;已注册 ⇒ blocking+skipEnv 成套且 id 无撞号', () => {
  const registered = new RegExp(`['"]${GATE_BASENAME}['"]`).test(RUNNER_TEXT)
  if (!registered) {
    // 门体尚未插进 runner 注册表 ⇒ 头注不得预支接线事实(门 89 R2 会抓假声称)
    assert.ok(!/已接线/.test(SOURCE), '未注册时头注不得自称「已接线」')
    assert.ok(!/pre-commit 已注册|已接 pre-commit/.test(SOURCE), '未注册时头注不得自称已注册进提交链')
    assert.match(SOURCE, /guardian-runner\.mjs/, '头注必须点名注册状态的唯一真相源(guardian-runner 注册条目)')
    return
  }
  const i = RUNNER_TEXT.indexOf(`'${GATE_BASENAME}'`) > -1
    ? RUNNER_TEXT.indexOf(`'${GATE_BASENAME}'`)
    : RUNNER_TEXT.indexOf(`"${GATE_BASENAME}"`)
  const block = RUNNER_TEXT.slice(Math.max(0, i - 500), i + 1200)
  assert.match(block, /mode:\s*'(blocking|warn)'/, '注册条目必须带 mode')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_[A-Z_]+'/, 'blocking 门必须成套带 skipEnv')
  assert.ok(!/stagedTriggers:\s*\[\s*\]/.test(block), '禁止空 stagedTriggers 数组(归一层当场抛错,R8 同型)')
  const ids = idsOfRegistry(RUNNER_TEXT)
  const dupes = ids.filter((v, k) => ids.indexOf(v) !== k)
  assert.deepEqual(dupes, [], `注册表撞号(门 89 R5 在 HEAD 面拦):${dupes.join(',')}`)
  // 已注册 ⇒ 头注必须点名本门在 runner 的注册事实来源
  assert.match(SOURCE, /guardian-runner\.mjs/)
})

test('单源形状锁:台账行解析委派门 208 的 loadNamedSites/loadNamedExemptions,不自抄判据', () => {
  assert.ok(
    String(gate.parseLedgerTexts).includes('loadNamedSites') &&
      String(gate.parseLedgerTexts).includes('loadNamedExemptions'),
    'parseLedgerTexts 必须调用门 208 的单一解析实现',
  )
  assert.equal(gate.parseLedgerTexts && typeof gate208.loadNamedSites, 'function')
  assert.ok(!/function\s+(loadNamedSites|loadNamedExemptions|entryUsable|normRel)\s*\(/.test(SOURCE),
    '本门不得再定义第二份登记行判据(§0.6/§22c)')
})

test('判据本体 import 生产实现且有牙(构造面,不跑真 git)', () => {
  const headRows = [{ rel: '.worktrees/wt-demo', owner: '甲', why: 'x', expires: FUTURE, via: '行式现场登记' }]
  const v1 = gate.durabilityVerdict({ headRows, faceRows: [], today: '2026-10-20' })
  assert.equal(v1.ok, false, '被审面缺失未到期行 ⇒ 红')
  assert.equal(v1.missing.length, 1)
  const v2 = gate.durabilityVerdict({ headRows, faceRows: headRows, today: '2026-10-20' })
  assert.equal(v2.ok, true, '被审面保留 ⇒ 绿')
  const v3 = gate.durabilityVerdict({ headRows, faceRows: [], today: '3000-01-01' })
  assert.equal(v3.ok, true, '到期行允许被摘 ⇒ 绿')
  const v4 = gate.durabilityVerdict({ headRows: [], faceRows: [], today: '2026-10-20' })
  assert.equal(v4.ok, true, 'HEAD 面无登记行 ⇒ 绿(不是恒红门)')
  // 同 rel 多条以「至少一条存活」计
  const v5 = gate.durabilityVerdict({
    headRows: [
      { rel: 'outputs/demo', owner: '甲', expires: FUTURE },
      { rel: 'outputs/demo', owner: '乙', expires: FUTURE },
    ],
    faceRows: [{ rel: 'outputs/demo', owner: '丙', expires: FUTURE }],
    today: '2026-10-20',
  })
  assert.equal(v5.ok, true, '同 rel 至少一条存活 ⇒ 绿')
  const both = gate.pickFace(true, true)
  assert.equal(both.undetermined, true, '两面旗同给 ⇒ 未判定(main 落 exit 2)')
  assert.equal(gate.pickFace(true, false).face, 'staged')
  assert.equal(gate.pickFace(false, false).face, 'head')
})

test('scratch 夹具路径:parseLedgerTexts 真走 §15b 唯一落点(mkScratch)并正确分流坏数据', async () => {
  const { mkScratch, rmScratch } = await import('../lib/scratch-dir.mjs')
  const box = mkScratch('nnsg-mirror-')
  try {
    assert.match(box, /ihui-scratch/, '夹具必须落 §15b 批准的 scratch 根,不得 os.tmpdir()/仓库树内')
  } finally {
    rmScratch(box)
  }
  const good = gate.parseLedgerTexts({
    sitesText: JSON.stringify({ rel: '.worktrees/wt-a', owner: '甲', why: 'x', expires: FUTURE }),
    exemptionsText: '{"entries":[]}',
  })
  assert.equal(good.rows.length, 1)
  assert.equal(good.rows[0].rel, '.worktrees/wt-a')
  assert.equal(good.rows[0].via, '行式现场登记')
  assert.equal(good.unreadable.length, 0)
  // HEAD 面坏 JSON ⇒ unreadable ⇒ fail-closed(exit 2),不冒充「没有登记行」
  const bad = gate.parseLedgerTexts({ sitesText: null, exemptionsText: '{not-json' })
  assert.ok(bad.unreadable.length > 0)
  assert.equal(gate.headFaceUsable(bad), false)
  assert.equal(gate.headFaceUsable(good), true)
  // 坏行(缺 owner/why/到期日)同样进 unreadable
  const badLine = gate.parseLedgerTexts({ sitesText: '{"rel": ".x"}', exemptionsText: null })
  assert.ok(badLine.unreadable.length > 0, 'HEAD 面 jsonl 坏行必须 fail-closed')
})

test('真仓 CLI:全量档绿(HEAD 面未到期行在 HEAD 面当然仍在),自检全过,两面旗 exit 2', () => {
  const full = run([])
  assert.equal(full.status, 0, `全量档应 0,实得 ${full.status}:\n${full.stdout}\n${full.stderr}`)
  assert.match(full.stdout, /台账存续对账通过/)
  const st = run(['--self-test'])
  assert.equal(st.status, 0, `${st.stdout}\n${st.stderr}`)
  assert.match(st.stdout, /✅ 自检 \d+\/\d+ 例全过/)
  const both = run(['--staged', '--worktree'])
  assert.equal(both.status, 2, both.stdout + both.stderr)
  assert.match(both.stdout + both.stderr, /未判定/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
