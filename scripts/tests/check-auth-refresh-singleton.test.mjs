// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):check-auth-refresh-singleton.mjs 的取材面收口防线。
// 判据本体不在这里重写 —— 临时仓 A/B(T3 索引脏/磁盘净、T4 未跟踪副本、T5 阳性对照)
// 由门自己的 `--self-test` 在同源实现上跑(M5 经 CLI 证明其 exit 0),本文件只守:
// 装车(CLI 跑真仓 HEAD/索引两面)、面旗冲突判死、取材面形状锁、导出锚点、结论文案。

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as gate } from '../check-auth-refresh-singleton.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-auth-refresh-singleton.mjs')

function runCli(extraArgs, timeout = 300000) {
  let out = ''
  let code = 0
  try {
    out = execFileSync(process.execPath, [SCRIPT, ...extraArgs], {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    code = typeof e?.status === 'number' ? e.status : -1
    out = String(e?.stdout ?? '') + String(e?.stderr ?? '')
  }
  return { code, out }
}

test('M1 真仓 HEAD 面 CLI 必 exit 0 且结论行点名取材面(装车证明,输入逐字取自真实仓)', () => {
  const { code, out } = runCli([])
  assert.equal(code, 0, `真仓 HEAD 面应绿;实得 exit ${code}\n${out}`)
  assert.match(out, /取材面:HEAD blob/, `结论行必须说明判的是 HEAD blob:\n${out}`)
  assert.match(out, /未跟踪候选文件 \d+ 个\(按定义不构成违规/)
})

test('M2 真仓索引面 CLI 必 exit 0(提交链实际走的那一档)', () => {
  const { code, out } = runCli(['--staged'])
  assert.equal(code, 0, `真仓索引面应绿;实得 exit ${code}\n${out}`)
  assert.match(out, /取材面:索引 blob/)
})

test('M3 两面旗同给 ⇒ exit 2 判死(在派生任何 git 之前就拒,不冒红也不记绿)', () => {
  const { code, out } = runCli(['--staged', '--worktree'])
  assert.equal(code, 2, `应 exit 2;实得 ${code}\n${out}`)
  assert.match(out, /无法判定/)
})

test('M4 取材面形状锁:内容一律经 face-reader,磁盘直读/遍历不得回来(收口方向反转的旧锁)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '必须引共用取材层')
  assert.match(src, /catBatch\(/, '正文必须经 catBatch 一次批量读(引了层却散写 git = 半接线,守门 118)')
  assert.match(src, /readWorktreeFile\(/, 'worktree 逃生舱也必须走层里的读取出口,不得裸读磁盘')
  // 调用形态的磁盘直读/遍历不得再出现在判据路径(头注里的历史记述无括号,不受影响)
  assert.doesNotMatch(src, /\breadFileSync\s*\(/, '不得再用 readFileSync 读被审内容')
  assert.doesNotMatch(src, /\breaddirSync\s*\(/, '不得再按磁盘遍历枚举')
  assert.doesNotMatch(src, /\bstatSync\s*\(/, '不得再用 statSync 探目录')
})

test('M5 门自带 --self-test 全绿(临时仓 A/B 的唯一实现处,经 CLI 真跑)', () => {
  const { code, out } = runCli(['--self-test'], 240000)
  assert.equal(code, 0, `--self-test 应全绿;实得 exit ${code}\n${out}`)
  assert.match(out, /自检全绿/)
})

test('M6 §22c 导出锚点:__test__ 在 isDirectRun 之后且键齐、皆函数', () => {
  for (const k of ['faceFromArgv', 'listFaceFiles', 'countUntrackedCandidates', 'scanContent', 'scanCandidates', 'passLine', 'filterCandidates']) {
    assert.equal(typeof gate[k], 'function', `__test__ 缺出口 ${k}`)
  }
  const src = readFileSync(SCRIPT, 'utf8')
  assert.ok(
    src.indexOf('if (isDirectRun)') < src.indexOf('export const __test__'),
    '§22d:__test__ 必须放在 isDirectRun 守卫之后'
  )
})

test('M7 faceFromArgv 四态与 passLine 文案(判"未跟踪不判但报数"的承诺在结论行里,不静默)', () => {
  assert.equal(gate.faceFromArgv([]).face, 'head')
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  assert.ok(gate.faceFromArgv(['--staged', '--worktree']).error)
  assert.match(gate.passLine(10, 3, 'head'), /扫了 10 个跟踪候选/)
  assert.match(gate.passLine(10, -1, 'head'), /未跟踪候选:未判定/)
})

test('M8 清单口径:apps/packages 之外不收,排除段与扩展名过滤按构造面证明', () => {
  const kept = gate.filterCandidates([
    'apps/web/src/a.ts',
    'packages/x/y.mjs',
    'docs/z.ts', // 面外
    'apps/x/dist/b.js', // 排除段(与旧磁盘遍历同名集)
    'apps/x/next-thing/c.txt', // 扩展名外
    'apps/x/.next-variant/d.ts', // .next-* 排除段
  ])
  assert.deepEqual(kept, ['apps/web/src/a.ts', 'packages/x/y.mjs'])
})

test('M9 scanContent 判据按构造输入成对:裸 fetch 必报、白名单形态必放(不依赖真仓状态)', () => {
  const repo = '/tmp/ihui-mock-root'
  const bad = gate.scanContent(repo, 'apps/web/src/svc.ts', `const r = await fetch('/auth/refresh')\n`)
  assert.equal(bad.length, 1)
  assert.equal(bad[0].rule, 'direct-fetch')
  assert.equal(bad[0].file, 'apps/web/src/svc.ts')
  const ok1 = gate.scanContent(repo, 'apps/web/src/svc.ts', 'await refreshAccessTokenOnce()\n')
  assert.equal(ok1.length, 0, '合法单例出口不得判红')
  const ok2 = gate.scanContent(repo, 'apps/web/tests/mock.ts', `await fetch('/auth/refresh')\n`)
  assert.equal(ok2.length, 0, '测试面豁免语义未动')
  const ok3 = gate.scanContent(
    repo,
    'apps/web/src/lib/api.ts',
    "  refreshAccessToken: async () => { return fetchApi('/auth/refresh') },\n"
  )
  assert.equal(ok3.length, 0, 'token-provider 注入回调豁免语义未动')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
