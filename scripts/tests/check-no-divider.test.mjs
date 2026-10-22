// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
// §22c:判据从源脚本 import,不在测试里复算(复算的第二把尺子必然漂开)
import { __test__ as gate } from '../check-no-divider.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-no-divider.mjs')
const GIT = gitBinary()

/** 派生 git 一律显式 stdio + windowsHide(§12g / §5b 派生进程纪律) */
function git(cwd, args) {
  return spawnSync(GIT, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

/** 建一个带一次提交的临时仓(全量档判 HEAD blob,没有 HEAD 就量不出存量) */
function createRepo(files) {
  const dir = mkScratch('ihui-divider-git-')
  const r = git(dir, ['init', '-q'])
  assert.equal(r.status, 0, `git init 失败: ${r.stderr}`)
  git(dir, ['config', 'user.email', 'test@ihui.local'])
  git(dir, ['config', 'user.name', 'Test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  for (const [rel, content] of Object.entries(files)) writeRepoFile(dir, rel, content)
  git(dir, ['add', '-A'])
  const c = git(dir, ['commit', '-q', '-m', 'baseline'])
  assert.equal(c.status, 0, `baseline commit 失败: ${c.stdout}${c.stderr}`)
  return dir
}

function writeRepoFile(dir, rel, content) {
  const full = join(dir, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

/** 改工作树并 stage(不 commit)—— --staged 档判的就是这一份索引 blob */
function stage(dir, rel, content) {
  writeRepoFile(dir, rel, content)
  const r = git(dir, ['add', '--', rel])
  assert.equal(r.status, 0, `git add 失败: ${r.stderr}`)
}

function runScript(cwd, extraArgs = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...extraArgs], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

const runHead = (cwd) => runScript(cwd)
const runStaged = (cwd) => runScript(cwd, ['--staged'])

// ─── 判据直连(源脚本 __test__ 出口,不复制常量) ───

test('D01 判据:中性单边描边判 blocking,整圈/粗边/彩色/擦除放过', () => {
  assert.equal(
    gate.classifyDividerLine('<div className="border-b border-border" />').level,
    'blocking',
  )
  assert.equal(gate.classifyDividerLine('<tr className="border-t" />').level, 'blocking')
  assert.equal(gate.classifyDividerLine('<div className="border border-border" />'), null)
  assert.equal(gate.classifyDividerLine('<div className="border-l-4 border-info" />'), null)
  assert.equal(gate.classifyDividerLine('<div className="border-b border-accent" />'), null)
  assert.equal(gate.classifyDividerLine('<div className="last:border-b-0" />'), null)
  assert.equal(
    gate.classifyDividerLine('<div className="border-t border-border/50" />').level,
    'warn',
  )
})

test('D02 判据:族 4 计数口径与 scanSource 同尺(棘轮锚点与读数不得各写一份)', () => {
  const src =
    'export const P = () => (\n  <div>\n    <div className="border-t border-border" />\n    <div className="border-b" />\n    <div className="border-x border-border" />\n  </div>\n)\n'
  const scan = gate.scanSource('apps/web/a.tsx', src)
  assert.equal(gate.countOpaqueSingles(scan), 2, JSON.stringify(scan.single))
})

test('D03 形状锁:锚点与读数都走 countOpaqueSingles,不许在门里另写一把尺', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  const uses = (src.match(/countOpaqueSingles\(/g) || []).length
  assert.ok(uses >= 4, `countOpaqueSingles 至少应有 4 个调用点(定义+读数+锚点两处),实得 ${uses}`)
  assert.match(src, /anchor\.set\(rel, countOpaqueSingles\(/)
  assert.match(src, /rename 基线源 HEAD blob 取不到/)
})

// ─── 全量档(HEAD blob)───

test('D04 全量档:单边不透明描边只报数、exit 0(§12e 存量不拦)', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div className="border-b border-border px-3">a</div>\n}\n',
  })
  try {
    const r = runHead(dir)
    assert.equal(r.status, 0, `全量档应 exit 0\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stdout, /\[single-side divider\]/)
    assert.match(r.stdout, /存量/)
  } finally {
    rmScratch(dir)
  }
})

test('D05 全量档:divide-y 仍进"发现 N 处违规"报告', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <ul className="divide-y"><li>a</li></ul>\n}\n',
  })
  try {
    const r = runHead(dir)
    assert.equal(r.status, 0)
    assert.match(r.stdout, /divide-y/)
  } finally {
    rmScratch(dir)
  }
})

test('D06 全量档:整圈描边的仓判通过(✅)', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div className="border border-border p-3 space-y-2">a</div>\n}\n',
  })
  try {
    const r = runHead(dir)
    assert.equal(r.status, 0)
    assert.ok(r.stdout.includes('✅'), `应通过\n${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── staged 档(索引 blob + 差值棘轮)───

test('D07 staged:新增 divide-y ⇒ exit 1', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx': 'export function P() {\n  return <ul className="space-y-1" />\n}\n',
  })
  try {
    stage(
      dir,
      'apps/web/app/y/page.tsx',
      'export function Q() {\n  return <ul className="divide-y"><li>b</li></ul>\n}\n',
    )
    const r = runStaged(dir)
    assert.equal(r.status, 1, `新增 divide-y 应拦\n${r.stdout}`)
    assert.match(r.stdout, /\[divide-y\]/)
  } finally {
    rmScratch(dir)
  }
})

test('D08 staged:新文件带单边描边 ⇒ exit 1(新文件基线 0)', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div className="p-3 space-y-1">a</div>\n}\n',
  })
  try {
    stage(
      dir,
      'apps/web/app/y/page.tsx',
      'export function Q() {\n  return <div className="border-b border-border">b</div>\n}\n',
    )
    const r = runStaged(dir)
    assert.equal(r.status, 1, `新文件单边描边应拦\n${r.stdout}`)
    assert.match(r.stdout, /\[single-side divider\]/)
    assert.match(r.stdout, /BLOCKING/)
  } finally {
    rmScratch(dir)
  }
})

test('D09 staged:存量行号挪位但数量不变 ⇒ exit 0(这一条就是不走按行拦的理由)', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div className="border-b border-border">a</div>\n}\n',
  })
  try {
    // 在它上面插两行无关内容:同一处描边的行号从 2 挪到 4,并作为 "+" 行进入 diff
    stage(
      dir,
      'apps/web/app/x/page.tsx',
      'const pad = 1\nconst pad2 = 2\nexport function P() {\n  return <div className="border-b border-border">a</div>\n}\n',
    )
    const r = runStaged(dir)
    assert.equal(r.status, 0, `行号挪位不该被读成新增\n${r.stdout}`)
    assert.match(r.stdout, /存量:.*单边描边 1/)
  } finally {
    rmScratch(dir)
  }
})

test('D10 staged:比 HEAD 多加一条 ⇒ exit 1;少加一条 ⇒ exit 0', () => {
  const baseline =
    'export function P() {\n  return <div className="border-b border-border">a</div>\n}\n'
  const more =
    'export function P() {\n  return <div>\n    <div className="border-b border-border">a</div>\n    <div className="border-t border-border">b</div>\n  </div>\n}\n'
  const less = 'export function P() {\n  return <div className="p-3">a</div>\n}\n'
  const up = createRepo({ 'apps/web/app/x/page.tsx': baseline })
  const down = createRepo({ 'apps/web/app/x/page.tsx': baseline })
  try {
    stage(up, 'apps/web/app/x/page.tsx', more)
    const r1 = runStaged(up)
    assert.equal(r1.status, 1, `超出基线应拦\n${r1.stdout}`)
    assert.match(r1.stdout, /超出 HEAD 基线 1/)

    stage(down, 'apps/web/app/x/page.tsx', less)
    const r2 = runStaged(down)
    assert.equal(r2.status, 0, `正在清偿存量绝不能被拦\n${r2.stdout}`)
  } finally {
    rmScratch(up)
    rmScratch(down)
  }
})

test('D11 staged:rename + 同行改动时,基线跟着旧路径走(否则存量被读成新增)', () => {
  // 内容够长 git 才配成 R(实测 81 字节的小文件只报 A);name-status 还必须**不带 pathspec**,
  // 带上之后 git 看不见删除那一侧,改名一律报 A(2026-10-23 实测,门体头注记着这一格)。
  const body =
    'export function P() {\n' +
    Array.from({ length: 40 }, (_, i) => `  const v${i} = ${i}\n`).join('') +
    '  return <div className="border-b border-border">a</div>\n}\n'
  const dir = createRepo({ 'apps/web/app/old/page.tsx': body })
  try {
    mkdirSync(join(dir, 'apps/web/app/new'), { recursive: true }) // git mv 不会自己建目标目录
    const mv = git(dir, ['mv', 'apps/web/app/old/page.tsx', 'apps/web/app/new/page.tsx'])
    assert.equal(mv.status, 0, `git mv 失败: ${mv.stdout}${mv.stderr}`)
    // 纯改名的 diff 里没有 "+" 行,会被"只判被改文件"筛掉;改一个字才真走到 rename 取基线那一支
    stage(dir, 'apps/web/app/new/page.tsx', body.replace('>a<', '>abc<'))
    const paired = git(dir, ['diff', '--cached', '--name-status', '-M']).stdout
    assert.match(paired, /^R\d+\t/m, `夹具没配成 rename,这条根本测不到基线跟随:${paired}`)
    const r = runStaged(dir)
    assert.equal(r.status, 0, `改名 + 微改不该产出一条新违规\n${r.stdout}\n${r.stderr}`)
    // 光"绿"不够:绿有两种成因 —— 基线跟到了旧路径,或这文件根本没进射程(实测 --diff-filter
    // 少带 R 就是这一型)。必须正面断言"在射程内,且这一条被算作存量"。
    assert.match(
      r.stdout,
      /单边描边 1/,
      `改名后的文件没被真的判进射程(读成"跳过"即失守):\n${r.stdout}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('D12 全量档:整圈描边 + 单边 override 判绿(结构性出口,摘掉它这条就红)', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div className="border border-border border-r bg-card">a</div>\n}\n',
  })
  try {
    const r = runHead(dir)
    assert.equal(r.status, 0, `结构性描边不该被拦\n${r.stdout}`)
    assert.ok(r.stdout.includes('✅'), `应通过\n${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('D13 全量档:网格收口(同格横边+竖边)不算分隔线 —— 课程表/考勤矩阵的格线', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div className="min-h-[60px] border-b border-r p-1">格</div>\n}\n',
  })
  try {
    const r = runHead(dir)
    assert.equal(r.status, 0)
    assert.ok(r.stdout.includes('✅'), `格线不该进射程\n${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('D14 全量档:同向两条边(上+下)仍判分隔线 —— 网格档不许被拿来遮两条线', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div className="border-t border-b px-3 py-2">条</div>\n}\n',
  })
  try {
    const r = runHead(dir)
    assert.equal(r.status, 0, '全量档只报数')
    assert.match(r.stdout, /\[single-side divider\]/, `同向两条边必须仍被点名\n${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('D15 工作树档:只量盘上进度,恒 exit 0(不作提交门禁)', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div className="border-b border-border">a</div>\n}\n',
  })
  try {
    // 盘上把它清掉 ⇒ 工作树档应报 0 条,而 HEAD 档仍报存量(三面各量各的)
    writeRepoFile(
      dir,
      'apps/web/app/x/page.tsx',
      'export function P() {\n  return <div className="p-3">a</div>\n}\n',
    )
    const wt = runScript(dir, ['--worktree'])
    assert.equal(wt.status, 0, `工作树档不拦\n${wt.stdout}`)
    assert.match(wt.stdout, /工作树/)
    const head = runHead(dir)
    assert.match(head.stdout, /\[single-side divider\]/, 'HEAD 档仍按已入库那一份报数')
  } finally {
    rmScratch(dir)
  }
})

test('D16 两面旗同给 ⇒ exit 2(取哪一面都会让另一面成为假绿)', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': 'export const z = 1\n' })
  try {
    const r = runScript(dir, ['--staged', '--worktree'])
    assert.equal(r.status, 2, `应落未判定\n${r.stdout}`)
    assert.match(r.stdout, /不得同用/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
