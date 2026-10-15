// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据一律 import 源脚本的 __test__,本文件不复制第二份实现。
// 锁的是三件事:① 面口径(全量=HEAD blob / --staged=索引 blob / 两面同给=exit 2);
// ② "装了自述但失明"那一型必须被 W2 抓到(成对:正控零违规 + 三条反例各红一处);
// ③ W1 覆盖面走差值棘轮 —— 存量不红、新增红、锚点取不到 ⇒ 未判定(不得当成 0 冒绿)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-ci-failure-triage-wiring.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-ci-failure-triage-wiring.mjs')

const run = (args = []) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 })

const GOOD = [
  'jobs:',
  '  unit:',
  '    steps:',
  '      - name: Checkout',
  '        id: checkout',
  '        uses: actions/checkout@v4',
  '      - name: Test',
  '        id: test',
  '        run: pnpm test',
  '      - name: Failure triage (public annotations)',
  '        id: failure-triage',
  '        if: failure()',
  '        env:',
  '          TRIAGE_WORKFLOW_FILE: .github/workflows/x.yml',
  '          TRIAGE_IDS: checkout test',
  '          O_CHECKOUT: ${{ steps.checkout.outcome }}',
  '          O_TEST: ${{ steps.test.outcome }}',
  `        run: bash ${gate.TRIAGE_SCRIPT}`,
  '',
].join('\n')

test('装车证明:门体在 runner 注册条目里是 blocking 且带 skipEnv(读 HEAD 面,不读工作区)', () => {
  const head = spawnSync('git', ['show', 'HEAD:scripts/guardian-runner.mjs'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 }).stdout
  const i = head.indexOf("'check-ci-failure-triage-wiring.mjs'")
  assert.ok(i > -1, '门体未接进提交链注册表')
  const block = head.slice(Math.max(0, i - 400), i + 700)
  assert.match(block, /mode:\s*'blocking'/, '注册条目须为 blocking')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_CI_TRIAGE_WIRING'/, 'blocking 门必须成套带 skipEnv')
})

test('正控:自洽的自述步骤 ⇒ 零违规', () => {
  const p = gate.parseWorkflow('.github/workflows/x.yml', GOOD)
  assert.equal(p.jobs.length, 1)
  assert.deepEqual(gate.judgeJob('.github/workflows/x.yml', p.jobs[0], new Map()), [])
})

test('反例一:新增带 id 步骤没进 TRIAGE_IDS ⇒ 报失明', () => {
  const blind = GOOD.replace('TRIAGE_IDS: checkout test', 'TRIAGE_IDS: checkout').replace('          O_TEST: ${{ steps.test.outcome }}\n', '')
  const v = gate.judgeJob('.github/workflows/x.yml', gate.parseWorkflow('.github/workflows/x.yml', blind).jobs[0], new Map())
  assert.ok(v.some((x) => x.startsWith('W2 失明') && x.includes('`test`')), JSON.stringify(v))
})

test('反例二:步骤改名后 O_ 键失配 ⇒ 报缺注入', () => {
  const renamed = GOOD.replace('id: test', 'id: tests-2').replace('TRIAGE_IDS: checkout test', 'TRIAGE_IDS: checkout tests-2')
  const v = gate.judgeJob('.github/workflows/x.yml', gate.parseWorkflow('.github/workflows/x.yml', renamed).jobs[0], new Map())
  assert.ok(v.some((x) => x.includes('O_TESTS_2')), JSON.stringify(v))
})

test('反例三:TRIAGE_WORKFLOW_FILE 指到别的工作流 ⇒ 报 W3', () => {
  const wrong = GOOD.replace('TRIAGE_WORKFLOW_FILE: .github/workflows/x.yml', 'TRIAGE_WORKFLOW_FILE: .github/workflows/y.yml')
  const v = gate.judgeJob('.github/workflows/x.yml', gate.parseWorkflow('.github/workflows/x.yml', wrong).jobs[0], new Map())
  assert.ok(v.some((x) => x.startsWith('W3')), JSON.stringify(v))
})

test('W1 差值棘轮:存量不红 / 新增红 / 锚点取不到 ⇒ 未判定', () => {
  assert.equal(gate.ratchetVerdict(new Map([['wf.yml', 2]]), new Map([['wf.yml', 2]])).length, 0)
  assert.equal(gate.ratchetVerdict(new Map([['wf.yml', 1]]), new Map([['wf.yml', 3]])).length, 0)
  assert.match(gate.ratchetVerdict(new Map([['wf.yml', 3]]), new Map([['wf.yml', 2]]))[0], /W1 新增/)
  assert.match(gate.ratchetVerdict(new Map([['wf.yml', 1]]), new Map([['wf.yml', null]]))[0], /未判定/)
})

test('具名豁免必须带 reason 才生效,且审面不再命中 ⇒ 腐烂判红', () => {
  const ledger = JSON.stringify({ items: [{ job: 'wf.yml#unit', reason: '只读侦察作业' }, { job: 'wf.yml#nokey' }] })
  const { map } = gate.readExemptLedger(() => ledger)
  assert.equal(map.size, 1, '缺 reason 的条目不得收录')
  const noTriage = GOOD.split('      - name: Failure triage')[0]
  assert.equal(gate.judgeJob('wf.yml', gate.parseWorkflow('wf.yml', noTriage).jobs[0], map).length, 0)
  const other = gate.judgeFace([{ rel: 'wf.yml', text: 'jobs:\n  renamed:\n    steps: []\n' }], map)
  assert.ok(hardHas(other.hard, '腐烂'), '登记过的作业已不命中审面 ⇒ 必须喊')
})

function hardHas(list, needle) {
  return list.some((x) => x.includes(needle))
}

test('口径:默认判 HEAD blob;--staged 判索引 blob;两面同给 ⇒ exit 2 未判定', () => {
  const both = run(['--staged', '--worktree'])
  assert.equal(both.status, 2, both.stdout + both.stderr)
  assert.match(both.stdout + both.stderr, /未判定/)
  const head = run([])
  assert.match(head.stdout, /面=head/)
  const staged = run(['--staged'])
  assert.match(staged.stdout, /面=staged/)
})

test('射程:真面(HEAD)扫得到全部工作流,且自洽维度现读零硬缺口', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.ok(src.includes("'ls-tree', '-r', '--name-only', 'HEAD', '--'"), '全量档必须按 HEAD 面列清单')
  assert.ok(src.includes("'ls-files', '--cached'"), '--staged 必须按索引面列清单')
  const r = run([])
  assert.match(r.stdout, /工作流 \d+ 份 \/ 作业 \d+ 个/)
  assert.equal(r.status, 0, `HEAD 面应无硬缺口,实得:\n${r.stdout}\n${r.stderr}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
