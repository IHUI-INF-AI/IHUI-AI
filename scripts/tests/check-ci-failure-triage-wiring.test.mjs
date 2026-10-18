// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据一律 import 源脚本的 __test__,本文件不复制第二份实现。
// 锁的是四件事:① 面口径(全量=HEAD blob / --staged=索引 blob / 两面同给=exit 2);
// ② "装了自述但失明"那一型必须被 W2 抓到(成对:正控零违规 + 三条反例各红一处);
// ③ W1 覆盖面走差值棘轮 —— 存量不红、新增红、锚点取不到 ⇒ 未判定(不得当成 0 冒绿);
// ④ 射程臂量的是"看不看得见 + 报了改不改得动"(与独立清单对账,不钉份数),
//    不钉 HEAD 现读硬缺口数 —— 那是并发提交随时会挪的活读数,钉上去就是把别人的缺口变成我的红(§12e);
//    门体本身照旧按档判红(W2/W3 硬拦不在本文件收窄),测试闪绿不等于缺口销账,现读数恒随运行打印。

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

// §12g:派生 git 必须显式接管 stdio;取不到 ⇒ 当场判"未判定",不得当成空清单冒绿
const gitOut = (args) => {
  const g = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(g.status, 0, `HEAD 面取不到(git ${args.join(' ')}),本臂不判定:\n${g.stderr}`)
  return g.stdout
}

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
  const head = spawnSync('git', ['show', 'HEAD:scripts/guardian-runner.mjs'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).stdout
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

test('射程:HEAD 面扫得到该面的全部工作流,判定可判定且每处硬缺口可归因(现读缺口只报不钉)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.ok(src.includes("'ls-tree', '-r', '--name-only', 'HEAD', '--'"), '全量档必须按 HEAD 面列清单')
  assert.ok(src.includes("'ls-files', '--cached'"), '--staged 必须按索引面列清单')

  // 覆盖面对账取独立清单(整仓 ls-tree 后按目录+扩展名筛),不抄门体自己那条命令:
  // 门体把射程收窄、把 .yaml 漏掉时两份计数会分叉;而钉死"47 份"则会把别人的并发新增读成我的红(§12e)。
  const workflows = gitOut(['ls-tree', '-r', '--name-only', 'HEAD'])
    .split(/\r?\n/)
    .filter((l) => l.startsWith('.github/workflows/') && /\.ya?ml$/.test(l))
    .sort()
  assert.ok(workflows.length > 0, 'HEAD 面枚举到 0 个工作流 ⇒ 无从对账射程(不判定,不冒绿)')
  const face = new Map(workflows.map((rel) => [rel, gate.parseWorkflow(rel, gitOut(['show', `HEAD:${rel}`]))]))

  const r = run(['--json'])
  assert.match(r.stdout, /面=head/, '默认档必须判 HEAD 面')
  assert.notEqual(r.status, 2, `真面取得到输入却判不出 ⇒ 失明:\n${r.stdout}\n${r.stderr}`)
  const jsonStart = r.stdout.indexOf('{')
  const jsonEnd = r.stdout.lastIndexOf('}')
  assert.ok(jsonStart > -1 && jsonEnd > jsonStart, `--json 自述拿不到:\n${r.stdout}\n${r.stderr}`)
  const verdict = JSON.parse(r.stdout.slice(jsonStart, jsonEnd + 1))
  assert.equal(verdict.counts.files, workflows.length, `门只扫到 ${verdict.counts.files} 份,HEAD 面实有 ${workflows.length} 份 ⇒ 射程失明`)
  assert.ok(verdict.counts.jobs > 0 && verdict.counts.triageSteps > 0, `作业/自述步骤枚举到 0 ⇒ 解析失明:${JSON.stringify(verdict.counts)}`)
  assert.equal(r.status === 0, verdict.hard.length === 0, `退出码与硬缺口清单分叉(rc=${r.status},hard=${verdict.hard.length})`)

  // 可整改性(§5e-1):每处硬缺口必须点名到 HEAD 面真实存在的工作流/作业,报出的步骤 id 必须真对不上 —— 报得出才改得动
  for (const line of verdict.hard) {
    const ref = line.match(/(\.github\/workflows\/[^\s`]+\.ya?ml)(?:#([^\s`,]+))?/)
    assert.ok(ref, `硬缺口没点名到工作流文件 ⇒ 无从整改:${line}`)
    assert.ok(face.has(ref[1]), `硬缺口点了 HEAD 面不存在的工作流 ${ref[1]}:${line}`)
    if (!ref[2] || line.startsWith('W1 腐烂')) continue // 棘轮档只点名文件;腐烂这一维判的就是"作业已不命中"
    const job = face.get(ref[1]).jobs.find((j) => j.name === ref[2])
    assert.ok(job, `硬缺口点了 ${ref[1]}#${ref[2]},但该作业不在 HEAD 面解析结果里(报告不实):${line}`)
    const blind = line.match(/步骤 id `([^`]+)`/)
    if (blind) {
      const ids = new Set(job.steps.map((s) => s.id).filter(Boolean))
      assert.ok(ids.has(blind[1]), `报 ${ref[1]}#${ref[2]} 失明于 ${blind[1]},但该 id 根本不在 HEAD 面步骤里:${line}`)
      const t = job.triages[job.triages.length - 1]
      const named = ((t && t.env.TRIAGE_IDS) || '').split(/\s+/).filter(Boolean)
      assert.ok(!named.includes(blind[1]), `报 ${blind[1]} 不在 TRIAGE_IDS,但它其实已登记(报告不实):${line}`)
    }
  }
  // 现读硬缺口是活账:归各工作流持有人,门体在提交链按档判红;本臂只把它念出来,不钉成每个会话的红
  if (verdict.hard.length > 0) {
    console.log(`   ℹ HEAD 现读 ${verdict.hard.length} 处硬缺口(只报不钉,销账归工作流持有人):`)
    for (const line of verdict.hard.slice(0, 5)) console.log(`     ${line}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
