// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 84「反回退对账」镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 本轮新增的判据是**性能护栏的例外**:普通文件超 300 个时整门跳过,但"乘数级"路径
 * (runner / 各道门自身 / 钩子 / package.json / 工作流 / 门的测试)必须照判 ——
 * 因为它们被写回旧版时**不会**表现为"少了一个功能",而是让一批守门静默失效。
 * 立因是 2026-09-24 同日两次实测:`guardian-runner.mjs` 的工作树副本落后 HEAD 61 行
 * (别人刚落地的守门 78 五维升级),任何人一次 `git add` 就替全队摘门,而当时全链无人报。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../check-stale-revert.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'

/** 夹具里的写入必须先建父目录 —— 直接 writeFileSync 到 `scripts/x.mjs` 会 ENOENT
 *  (本测试第一次跑就是这样红三条,不是判据错,是夹具缺一步)。 */
function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

function repo() {
  const dir = mkScratch('stale-revert-it-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 300000 }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  return { dir, run }
}

/** 造 n 个普通脏文件(用来把暂存集顶过 MAX_FILES) */
function pad(dir, run, n, content) {
  for (let i = 0; i < n; i++) put(dir, `junk-${i}.txt`, content)
  run('add', '-A')
}

/** v1 → v2 → 把 v1 重新放回暂存区 = 典型"旧基线回写" */
function stageAncestorContent(dir, run, rel, v1, v2) {
  put(dir, rel, v1)
  run('add', '-A')
  run('commit', '-qm', `${rel} v1`)
  put(dir, rel, v2)
  run('add', '-A')
  run('commit', '-qm', `${rel} v2`)
  put(dir, rel, v1) // 写回旧版
  run('add', '--', rel)
}

test('乘数级路径的识别:门的注册表 / 门自身 / 钩子 / 清单 / 工作流,普通源码不算', () => {
  const yes = [
    'scripts/guardian-runner.mjs',
    'scripts/check-stale-revert.mjs',
    'scripts/lib/gitdir.mjs',
    'scripts/tests/check-stale-revert.test.mjs',
    '.husky/pre-commit',
    'package.json',
    'pnpm-lock.yaml',
    '.github/workflows/ci.yml',
  ]
  for (const p of yes) assert.ok(G.isMultiplierPath(p), `${p} 必须算乘数级`)
  for (const p of ['apps/web/src/app/page.tsx', 'packages/shared/src/chat/index.ts', 'README.md', 'docs/x.md'])
    assert.ok(!G.isMultiplierPath(p), `${p} 不该被当乘数级(会把护栏撑爆)`)
  assert.ok(G.isMultiplierPath('scripts\\guardian-runner.mjs'), 'Windows 反斜杠形态必须同样认得')
})

test('端到端:暂存集顶过上限时,乘数级回写仍必须判红(护栏不得把尺子一起改短)', () => {
  const { dir, run } = repo()
  try {
    stageAncestorContent(dir, run, 'scripts/guardian-runner.mjs', 'id: 1\n', 'id: 2\nid: 3\n')
    pad(dir, run, G.MAX_FILES + 20, 'junk\n')
    const r = G.audit(dir, { staged: true })
    assert.equal(r.code, 1, `超限场景下乘数级回写必须拦,实际 exit ${r.code} / ${r.lines.slice(-3).join(' | ')}`)
    assert.ok(
      r.lines.some((l) => l.includes('scripts/guardian-runner.mjs')),
      `必须点名是哪个文件:${r.lines.join('\n').slice(0, 300)}`,
    )
    assert.ok(r.lines.some((l) => l.includes('乘数级')), '结论行必须说清为什么这一类不吃护栏')
  } finally {
    rmScratch(dir)
  }
})

test('反向对照:真新编辑(既不等于 HEAD 也不等于任何祖先版本)不得判红', () => {
  const { dir, run } = repo()
  try {
    put(dir, 'scripts/guardian-runner.mjs', 'id: 1\n')
    run('add', '-A')
    run('commit', '-qm', 'v1')
    put(dir, 'scripts/guardian-runner.mjs', 'id: 1\n// 本次真正新增的一行\n')
    run('add', '-A')
    const r = G.audit(dir, { staged: true })
    assert.equal(r.code, 0, `正常改动被拦 = 这道门会逼人绕过钩子:${r.lines.join('\n').slice(0, 240)}`)
  } finally {
    rmScratch(dir)
  }
})

test('未超限时语义与改前一致:普通文件的回写照样判红', () => {
  const { dir, run } = repo()
  try {
    stageAncestorContent(dir, run, 'apps/web/src/a.ts', 'export const a = 1\n', 'export const a = 2\nexport const b = 3\n')
    const r = G.audit(dir, { staged: true })
    assert.equal(r.code, 1, '未超限时普通文件的旧基线回写必须照拦')
    assert.ok(r.lines.some((l) => l.includes('apps/web/src/a.ts')))
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
