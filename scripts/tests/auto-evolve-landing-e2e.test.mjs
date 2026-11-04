// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 落账腿的**端到端**装载证明(2026-11-05 立)。
//
// 为什么必须有这一格:台账里 `artifact-committed` 至今为 0 —— 9 次派发全部死在
// `artifact-manifest-missing`(会话压根没写清单)。于是"清单之后那一腿(真提交进 HEAD +
// 落地五问自证 + 正证留痕)"在真实运行里从来没有被走过一次,而既有镜像测试喂的都是
// 假 commitFn ⇒ 那条腿只有编排层的绿,没有装车的绿。§0.9:造好没装车 = 没有。
//
// 被测对象必须是**被判的那一份**:整棵 scripts/ 由 `git archive HEAD scripts` 导出 ——
// 多会话共树时盘上那份是别席从旧基线长出来的改写(今天实测缺 7/7 条判据锚点),
// 拿它跑出来的"腿能落地"是给不相干的代码背书。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const KEY = 'e2e-ticket-1'
const TICKET = '- [ ] T-9991 端到端落账腿夹具票(不派单,只验腿)'

const git = (cwd, args) =>
  spawnSync('git', args, {
    cwd,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })

/** 临时 git 仓 + 从 HEAD 面导出的整棵 scripts/(被测的就是被判的那一份)。 */
function makeRepo(dir) {
  const tar = join(dir, 'scripts-head.tar')
  const arc = git(ROOT, ['archive', '--format=tar', '-o', tar, 'HEAD', 'scripts'])
  assert.equal(
    arc.status,
    0,
    'git archive HEAD scripts 失败:' + String(arc.stderr ?? arc.error ?? '').slice(0, 200),
  )
  // Git Bash 的 GNU tar 会把 "C:" 当成远程主机语法 ⇒ 必须 --force-local + 正斜杠路径
  const fsPath = (p) => String(p).replace(/\\/g, '/')
  const untar = spawnSync('tar', ['--force-local', '-xf', fsPath(tar), '-C', fsPath(dir)], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
  assert.equal(untar.status, 0, '解包失败:' + String(untar.stderr ?? '').slice(0, 200))
  rmSync(tar, { force: true })
  git(dir, ['init', '-q'])
  git(dir, ['config', 'user.email', 'fixture@example.invalid'])
  git(dir, ['config', 'user.name', 'fixture'])
  writeFileSync(join(dir, 'a.txt'), 'v1\n')
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'fixture 基线'])
}

const loadScheduler = (dir) => import(pathToFileURL(join(dir, 'scripts', 'auto-evolve.mjs')).href)

test('E2E① 清单 + 真提交通道 ⇒ 产物字节进 HEAD、票键进提交信息', async () => {
  const dir = mkScratch('ae-land-')
  try {
    makeRepo(dir)
    const before = String(git(dir, ['rev-parse', 'HEAD']).stdout).trim()
    writeFileSync(join(dir, 'a.txt'), 'v2\n')
    const mfDir = join(dir, '.ihui-agent', 'state', 'ticket-artifacts')
    mkdirSync(mfDir, { recursive: true })
    const manifestPath = join(mfDir, KEY + '.json')
    writeFileSync(manifestPath, JSON.stringify({ ticketKey: KEY, files: ['a.txt'] }), 'utf8')

    const ae = await loadScheduler(dir)
    const r = ae.landTicketArtifacts({
      ticketKey: KEY,
      ticketText: TICKET,
      manifestText: readFileSync(manifestPath, 'utf8'),
      statusFn: (f) => String(git(dir, ['status', '--porcelain', '--', f]).stdout),
      commitFn: (args) => ae.runLandCommit(args),
      dryRun: false,
    })
    assert.equal(
      r.action,
      'artifact-committed',
      '落账腿没能产出提交 ⇒ action=' +
        r.action +
        ' why=' +
        r.why +
        ' 细节=' +
        String(r.detail ?? '').slice(0, 600),
    )
    const after = String(git(dir, ['rev-parse', 'HEAD']).stdout).trim()
    assert.notEqual(after, before, 'HEAD 必须真前进(不是只写盘)')
    assert.equal(String(git(dir, ['show', after + ':a.txt']).stdout), 'v2\n', '产物字节必须真在树里')
    const body = String(git(dir, ['log', '-1', '--format=%B', after]).stdout)
    assert.match(body, /T-9991|端到端落账腿/, '提交信息要能归因到票:' + body.slice(0, 200))
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('E2E② 成对反向:清单写了但盘上没有真改动 ⇒ 不落任何提交(不许空提交冒充产出)', async () => {
  const dir = mkScratch('ae-land-')
  try {
    makeRepo(dir)
    const before = String(git(dir, ['rev-parse', 'HEAD']).stdout).trim()
    const mfDir = join(dir, '.ihui-agent', 'state', 'ticket-artifacts')
    mkdirSync(mfDir, { recursive: true })
    const manifestPath = join(mfDir, KEY + '.json')
    writeFileSync(manifestPath, JSON.stringify({ ticketKey: KEY, files: ['a.txt'] }), 'utf8')
    const ae = await loadScheduler(dir)
    const r = ae.landTicketArtifacts({
      ticketKey: KEY,
      ticketText: TICKET,
      manifestText: readFileSync(manifestPath, 'utf8'),
      statusFn: () => '',
      commitFn: (args) => ae.runLandCommit(args),
      dryRun: false,
    })
    assert.notEqual(r.action, 'artifact-committed', '无改动却报落地 = 假产出')
    assert.equal(String(git(dir, ['rev-parse', 'HEAD']).stdout).trim(), before, '不许产生空提交')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('E2E③ 成对反向:清单混进逃逸路径/活文档 ⇒ 整批不提交(不做部分提交)', async () => {
  const dir = mkScratch('ae-land-')
  try {
    makeRepo(dir)
    writeFileSync(join(dir, 'a.txt'), 'v2\n')
    const ae = await loadScheduler(dir)
    const r = ae.landTicketArtifacts({
      ticketKey: KEY,
      ticketText: TICKET,
      manifestText: JSON.stringify({
        ticketKey: KEY,
        files: ['a.txt', '../outside.txt', 'PROJECT_PLAN.md'],
      }),
      statusFn: (f) => String(git(dir, ['status', '--porcelain', '--', f]).stdout),
      commitFn: (args) => ae.runLandCommit(args),
      dryRun: false,
    })
    assert.equal(r.action, 'artifact-manifest-invalid', '路径不安全必须整批拒:' + r.action + '/' + r.why)
    const st = String(git(dir, ['status', '--porcelain']).stdout)
    assert.match(st, /a\.txt/, '被拒批次不得顺手把 a.txt 也提交掉')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
