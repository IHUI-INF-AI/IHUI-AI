// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):「合流会静默吞掉『已真机验证』的代码修复」这条票的落地前复量。
// 判据对象是"本侧已提交的行还在不在合并结果里",不是"事故必须重现" ⇒ 全部用真临时仓的构造面,
// 直接调源脚本导出的 preAdvanceLocalPreserved / localPreservedVerdict,不在测试里复算判据。
// 三态:保留 ⇒ 0;被吞 ⇒ 非零且点名;**输入取不到 ⇒ 未判定(exit 2),不得落成绿**。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  preAdvanceLocalPreserved,
  localPreservedVerdict,
  ensureUnionModule,
} from '../git-sync-converge.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// CLI 入口在 isDirectRun 里先 ensureUnionModule() 再 main();测试直接 import 时必须照同一顺序
// 装载闸门尺子,否则默认 union = unionGate.mod 恒为 null ⇒ 每条用例都只会走到"未判定"。
await ensureUnionModule()

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const PLAN = '# 台账\n- [ ] G-1 基底行\n'

function makeRepo() {
  const dir = mkScratch('gsc-preserved-')
  const g = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...a], {
      encoding: 'utf8',
      windowsHide: true,
      // §12g:本机派生 git 必须显式接管 stdio(不吃 stdin)
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    }).trim()
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  const write = (rel, text) => writeFileSync(join(dir, rel), text, 'utf8')
  const commit = (msg) => {
    g('add', '-A')
    g('commit', '-qm', msg)
    return g('rev-parse', 'HEAD')
  }
  const APP_BASE = "const a = 1\nconst keep = 2\n"
  write('app.ts', APP_BASE)
  write('PROJECT_PLAN.md', PLAN)
  const base = commit('base')
  // 本侧:真机验证过的那一行(票面事故里的 resolvedTheme)
  write('app.ts', `${APP_BASE}const theme = 'resolvedTheme'\n`)
  write('PROJECT_PLAN.md', `${PLAN}- [ ] G-2 本侧真机验证过的改动\n`)
  const local = commit('local: verified on device')
  // 对侧:从基底分叉的另一条提交线
  g('checkout', '-q', base)
  g('checkout', '-q', '-b', 'remote-side')
  write('app.ts', `${APP_BASE}const remote = 2\n`)
  write('PROJECT_PLAN.md', `${PLAN}- [ ] G-3 对侧新增\n`)
  const remote = commit('remote: another line')
  // 合并结果:保留两侧 ⇒ 干净;取对侧整份文件 + 丢本侧台账行 ⇒ 被吞
  g('checkout', '-q', 'main')
  write('app.ts', `${APP_BASE}const remote = 2\nconst theme = 'resolvedTheme'\n`)
  write('PROJECT_PLAN.md', `${PLAN}- [ ] G-2 本侧真机验证过的改动\n- [ ] G-3 对侧新增\n`)
  const mergedOk = commit('merge ok')
  write('app.ts', `${APP_BASE}const remote = 2\n`)
  write('PROJECT_PLAN.md', `${PLAN}- [ ] G-3 对侧新增\n`)
  const mergedLost = commit('merge lost')
  return { dir, base, local, remote, mergedOk, mergedLost, cleanup: () => rmScratch(dir) }
}

test('P1 本侧已提交的代码行与台账行仍在合并结果 ⇒ status=ok,exit 0', () => {
  const r = makeRepo()
  try {
    const got = preAdvanceLocalPreserved({
      local: r.local,
      remote: r.remote,
      tree: r.mergedOk,
      base: r.base,
      cwd: r.dir,
    })
    assert.equal(localPreservedVerdict(got).status, 'ok', `不得判红:${got.bad.join(' | ')}`)
    assert.equal(localPreservedVerdict(got).exitCode, 0)
    assert.ok(got.judged >= 1, '双侧同改的 app.ts 必须真被判过(judged=0 ⇒ 本锁对着空气判绿)')
  } finally {
    r.cleanup()
  }
})

test('P2 本侧已提交的行被吞 ⇒ status=lost,exit 1 且点名 app.ts 与 PROJECT_PLAN.md', () => {
  const r = makeRepo()
  try {
    const got = preAdvanceLocalPreserved({
      local: r.local,
      remote: r.remote,
      tree: r.mergedLost,
      base: r.base,
      cwd: r.dir,
    })
    const v = localPreservedVerdict(got)
    assert.equal(v.status, 'lost')
    assert.equal(v.exitCode, 1)
    const text = got.bad.join('\n')
    assert.match(text, /app\.ts[\s\S]*lostAddedLines/, '代码行被吞必须按文件点名(票面事故那一格)')
    assert.match(text, /PROJECT_PLAN\.md[\s\S]*未存活行/, '活文档行被吞必须由 verifyUnion 点名')
  } finally {
    r.cleanup()
  }
})

test('P3 输入取不到 ⇒ 未判定 exit 2,绝不落成绿(坏 sha / 基底为空)', () => {
  const r = makeRepo()
  try {
    for (const bad of [
      { local: 'not-a-sha', remote: r.remote, tree: r.mergedOk, base: r.base },
      { local: r.local, remote: '', tree: r.mergedOk, base: r.base },
      { local: r.local, remote: r.remote, tree: r.mergedOk, base: '' },
    ]) {
      const got = preAdvanceLocalPreserved({ ...bad, cwd: r.dir })
      const v = localPreservedVerdict(got)
      assert.equal(v.status, 'undetermined', `输入 ${JSON.stringify(bad)} 不得被判成 ok/lost`)
      assert.equal(v.exitCode, 2)
      assert.ok(got.undetermined.length > 0, '未判定必须逐条点名原因')
      assert.equal(got.bad.length, 0, '未判成时不得借"丢失"出口')
    }
  } finally {
    r.cleanup()
  }
})

test('P4 union-converge 自证出口未装载 ⇒ 未判定(不记绿、不记丢)', () => {
  const r = makeRepo()
  try {
    const got = preAdvanceLocalPreserved({
      local: r.local,
      remote: r.remote,
      tree: r.mergedOk,
      base: r.base,
      cwd: r.dir,
      union: null,
    })
    const v = localPreservedVerdict(got)
    assert.equal(v.status, 'undetermined')
    assert.equal(v.exitCode, 2)
    assert.match(got.undetermined.join(' '), /union-converge/)
  } finally {
    r.cleanup()
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
