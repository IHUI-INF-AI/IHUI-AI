// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发丝分隔线守门(`scripts/check-hairline-separator.mjs`)的镜像测试。
 *
 * 两条纪律:
 *   ① §22c —— 判据一律从源脚本 `__test__` import,**本文件不复制任何判据常量**
 *      (复算的第二把尺子必然漂开;本仓记过"两把尺子读出 31 与 59"那一型)。
 *   ② §22d —— 源脚本必须能被 import 而不跑主流程,这一点由本文件 import 成功本身证明。
 *
 * 夹具用 `mkScratch()`(§15b):临时 git 仓一律落在工作区外,不用 `os.tmpdir()`、不落仓内;
 * 派生 git 一律显式 `stdio` + `windowsHide`(§12g / §5b)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
// §22c:判据从源脚本 import,不在测试里复算
import { __test__ as gate } from '../check-hairline-separator.mjs'
import { __test__ as dividerGate } from '../check-no-divider.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-hairline-separator.mjs')
const GIT = gitBinary()

/** 派生 git 一律显式 stdio + windowsHide(§12g:不写 stdio 稳定 EBUSY) */
function git(cwd, args) {
  return spawnSync(GIT, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function writeRepoFile(dir, rel, content) {
  const full = join(dir, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

/** 建一个带一次提交的临时仓(全量档判 HEAD blob,没有 HEAD 就量不出存量) */
function createRepo(files) {
  const dir = mkScratch('ihui-hairline-git-')
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

/** 改工作树并 stage(不 commit)—— `--staged` 档判的就是这一份索引 blob */
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

const plain = (s) => String(s).replace(/\u001b\[[0-9;]*m/g, '')
const runHead = (cwd) => runScript(cwd)
const runStaged = (cwd) => runScript(cwd, ['--staged'])
// H19 两门同场:兄弟门 11d 的 staged 档也在同一个临时仓里跑(互顶只有"两把尺同场"才量得出)
const DIVIDER_SCRIPT = join(__dirname, '..', 'check-no-divider.mjs')
const runDividerStaged = (cwd) =>
  spawnSync(process.execPath, [DIVIDER_SCRIPT, '--staged'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

// ─────────── 判据直连(走源脚本 `__test__`,不复算) ───────────

test('H01 判据:三型结构件各一例放过(语义分隔件 / 导引轨 / 可拖拽分隔器)', () => {
  const semantic = gate.scanSource(
    'apps/web/src/components/ui/dropdown-menu.tsx',
    'const S = () => <div role="separator" className="-mx-1 my-1 h-px bg-border" />\n',
  ).hits[0]
  assert.equal(semantic?.kind, 'exempt', JSON.stringify(semantic))
  assert.equal(semantic?.type, 'semantic-separator')

  const rail = gate.scanSource(
    'apps/web/app/(main)/agent-workbench/components/SessionTree.tsx',
    '<span className="absolute top-0 bottom-0 w-px bg-border" />\n',
  ).hits[0]
  assert.equal(rail?.kind, 'exempt', JSON.stringify(rail))
  assert.equal(rail?.type, 'guide-rail')

  const splitter = gate.scanSource(
    'apps/web/src/components/ai/pane-split-container.tsx',
    "const RESIZER_CLASS = { x: { line: 'h-full w-px bg-border' } }\n",
  ).hits[0]
  assert.equal(splitter?.kind, 'exempt', JSON.stringify(splitter))
  assert.equal(splitter?.type, 'draggable-splitter')

  // 三型放过必须给出"凭什么",否则报告无法复核(§10)
  for (const h of [semantic, rail, splitter]) assert.ok(h?.why && h.why.length > 8, String(h?.why))
})

test('H02 判据:真分隔线判红,横向撑满的 absolute 不享受轨出口(反向锁)', () => {
  const hit = gate.scanSource(
    'apps/web/app/(main)/blog/[slug]/page.tsx',
    '<div className="h-px bg-border" />\n',
  )
  assert.equal(gate.countDividers(hit), 1, JSON.stringify(hit.hits))
  assert.equal(hit.hits[0].kind, 'divider')

  const horizontal = gate.scanSource(
    'apps/web/a.tsx',
    '<span className="absolute left-0 right-0 top-0 h-px bg-border" />\n',
  )
  assert.equal(gate.countDividers(horizontal), 1, '轨出口只认竖轴:w-px 且上界成对')
})

test('H03 判据:量不出物理像素 ⇒ 未判定(不记绿也不冒红)', () => {
  const scan = gate.scanSource('apps/web/a.tsx', '<span className="w-[0.125rem] bg-border" />\n')
  assert.equal(scan.hits.length, 1, JSON.stringify(scan.hits))
  assert.equal(scan.hits[0].kind, 'undetermined')
  assert.equal(scan.undetermined.length, 1)
  assert.equal(gate.countDividers(scan), 0, '未判定不得被读成违规,也不得被读成绿')
})

test('H04 判据:形状收窄与射程边界(彩色底放过 / 粗于发丝不进候选 / 无底色不归本门)', () => {
  const accent = gate.scanSource('apps/web/a.tsx', '<span className="h-px w-8 bg-primary/60" />\n')
    .hits[0]
  assert.equal(accent?.kind, 'exempt', JSON.stringify(accent))
  assert.equal(accent?.type, 'accent-background')

  // 粗于发丝的尺寸是"尺寸块"不是线 ⇒ 连候选都不进(否则报告被缩略图/骨架块淹掉)
  assert.equal(
    gate.scanSource('apps/web/a.tsx', '<span className="h-[4px] bg-border" />\n').hits.length,
    0,
  )
  assert.equal(
    gate.scanSource(
      'apps/miniapp-taro/src/pages/a/index.tsx',
      '<View className="h-[96rpx] bg-border" />\n',
    ).hits.length,
    0,
  )

  // 没写底色 ⇒ 线不是背景色画的,不抢守门 11d 的描边面
  assert.equal(
    gate.scanSource('apps/web/a.tsx', '<div className="h-px w-full" />\n').hits.length,
    0,
  )

  // RN 面:同族判据覆盖 height 与 width(竖线是 width)
  const rn = gate.scanSource(
    'packages/app/src/components/Toolbar.tsx',
    'const s = { separator: { width: 1, backgroundColor: tk.border.light } }\n',
  ).hits[0]
  assert.equal(rn?.kind, 'divider', JSON.stringify(rn))
})

test('H05 形状锁:解析器与判据本体(2026-10-24 合一后)都 import 自兄弟门 11d,锚点与读数同一把尺(§0.6 / §22c)', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  // ① 四件纯解析 + 合一后的判据本体 `scanHairlineFaces` 都从 11d import,不许在本门里长第二份
  assert.match(src, /from '\.\/check-no-divider\.mjs'/)
  for (const name of [
    'thinTokensOf',
    'enclosingBraceBlock',
    'isNeutralColorRef',
    'scanHairlineFaces',
  ]) {
    assert.ok(src.includes(name), `应复用 11d 的 ${name}`)
    assert.equal(
      new RegExp(`(?:export )?function ${name}\\s*\\(`).test(src),
      false,
      `${name} 不得在本门里重新实现(第二份必然漂开)`,
    )
  }
  // ② 取材与棘轮全部走共用层
  for (const name of ['sourceCandidates', 'readSources', 'headAnchors', 'addedLineNumbers']) {
    assert.ok(src.includes(`./lib/face-scan.mjs`), '取材/棘轮必须走 face-scan 共用层')
    assert.ok(src.includes(name), `缺 ${name}`)
  }
  // ③ 锚点闭包必须回调本门那个 countDividers(锚点与读数各写一份 = 不是棘轮)
  assert.match(
    src,
    /headAnchors\(top, files, \(rel, src\) => countDividers\(scanSource\(rel, src\)\)\)/,
  )
  // ④ §22d 双形态入口:pathToFileURL,禁手拼 'file:///'
  assert.match(src, /pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.equal(
    /['"]file:\/\/\/['"]\s*\+/.test(src),
    false,
    '手拼 file:/// 在 Windows 反斜杠上永不匹配',
  )
})

// ─────────── 全量档(HEAD blob) ───────────

test('H06 全量档:存量只报数、exit 0(§12e 存量未清不得判红)', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div className="h-px bg-border" aria-hidden />\n}\n',
  })
  try {
    const r = runHead(dir)
    assert.equal(r.status, 0, `全量档应 exit 0\n${plain(r.stdout)}\n${r.stderr}`)
    assert.match(plain(r.stdout), /真分隔线 存量 1 枚 新增 0 枚/)
    assert.match(plain(r.stdout), /\[存量\]/, '存量必须点名到行,不能只给总数')
  } finally {
    rmScratch(dir)
  }
})

test('H07 全量档:三型结构件在报告里带"凭什么放过"的原话', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div role="separator" className="my-1 h-px bg-border" />\n}\n',
  })
  try {
    const r = runHead(dir)
    assert.equal(r.status, 0, plain(r.stdout))
    const out = plain(r.stdout)
    assert.match(out, /\[放过\]/, `结构件应被点名放过\n${out}`)
    assert.match(out, /semantic-separator/)
    assert.match(out, /ARIA 语义分隔件/, '必须给出指纹原话,否则复核无从下手')
    assert.match(out, /真分隔线 存量 0 枚 新增 0 枚/)
  } finally {
    rmScratch(dir)
  }
})

test('H08 未判定 ⇒ exit 2(不记绿也不冒红,结论行点名)', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <span className="w-[0.125rem] bg-border" />\n}\n',
  })
  try {
    const r = runHead(dir)
    assert.equal(r.status, 2, `未判定必须 exit 2\n${plain(r.stdout)}`)
    const out = plain(r.stdout)
    assert.match(out, /未判定/)
    assert.match(out, /量不出物理像素/)
  } finally {
    rmScratch(dir)
  }
})

// ─────────── staged 档(索引 blob + 差值棘轮) ───────────

test('H09 staged:新文件新增一条 h-px bg-border ⇒ exit 1(新文件基线 0)', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': 'export const z = 1\n' })
  try {
    stage(
      dir,
      'apps/web/app/y/page.tsx',
      'export function Q() {\n  return <div className="h-px bg-border" />\n}\n',
    )
    const r = runStaged(dir)
    assert.equal(r.status, 1, `新增分隔线必须拦\n${plain(r.stdout)}`)
    const out = plain(r.stdout)
    assert.match(out, /\[新增\]/)
    assert.match(out, /新增 1 枚/)
  } finally {
    rmScratch(dir)
  }
})

test('H10 staged:存量行号挪位但枚数不变 ⇒ exit 0(这一条就是不按行判的理由)', () => {
  const body = 'export function P() {\n  return <div className="h-px bg-border" />\n}\n'
  const dir = createRepo({ 'apps/web/app/x/page.tsx': body })
  try {
    // 上面插两行无关内容:同一处发丝线的行号从 2 挪到 4,并作为 "+" 行进入 diff
    stage(dir, 'apps/web/app/x/page.tsx', 'const pad = 1\nconst pad2 = 2\n' + body)
    const r = runStaged(dir)
    assert.equal(r.status, 0, `行号挪位不该被读成新增\n${plain(r.stdout)}`)
    assert.match(plain(r.stdout), /存量 1 枚/)
  } finally {
    rmScratch(dir)
  }
})

test('H11 staged:比 HEAD 多加一条 ⇒ exit 1;减一条(清偿)⇒ exit 0', () => {
  const one = 'export function P() {\n  return <div className="h-px bg-border" />\n}\n'
  const two =
    'export function P() {\n  return <div>\n    <div className="h-px bg-border" />\n    <div className="h-px bg-border" />\n  </div>\n}\n'
  const zero = 'export function P() {\n  return <div className="p-3">a</div>\n}\n'
  const up = createRepo({ 'apps/web/app/x/page.tsx': one })
  const down = createRepo({ 'apps/web/app/x/page.tsx': one })
  try {
    stage(up, 'apps/web/app/x/page.tsx', two)
    const r1 = runStaged(up)
    assert.equal(r1.status, 1, `超出基线应拦\n${plain(r1.stdout)}`)
    assert.match(plain(r1.stdout), /新增 1 枚/)

    stage(down, 'apps/web/app/x/page.tsx', zero)
    const r2 = runStaged(down)
    assert.equal(r2.status, 0, `正在清偿存量绝不能被拦\n${plain(r2.stdout)}`)
  } finally {
    rmScratch(up)
    rmScratch(down)
  }
})

test('H12 staged:三型结构件新增不拦(否则型①就是恒红门)', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': 'export const z = 1\n' })
  try {
    stage(
      dir,
      'apps/web/app/y/page.tsx',
      'export function Q() {\n  return <div role="separator" className="my-1 h-px bg-border" />\n}\n',
    )
    const r = runStaged(dir)
    assert.equal(r.status, 0, `语义分隔件不该拦\n${plain(r.stdout)}`)
    assert.match(plain(r.stdout), /semantic-separator/)
  } finally {
    rmScratch(dir)
  }
})

// ─────────── 参数面与逃生舱 ───────────

test('H13 两面旗同给 ⇒ exit 2 且打「未判定」', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': 'export const z = 1\n' })
  try {
    const r = runScript(dir, ['--staged', '--worktree'])
    assert.equal(r.status, 2, `应落未判定\n${plain(r.stdout)}`)
    assert.match(plain(r.stdout), /未判定/)
    assert.match(plain(r.stdout), /不得同用/)
  } finally {
    rmScratch(dir)
  }
})

test('H14 工作树档:只量盘上进度,不判提交门禁(清掉后报 0,HEAD 档仍报存量)', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx':
      'export function P() {\n  return <div className="h-px bg-border" />\n}\n',
  })
  try {
    writeRepoFile(
      dir,
      'apps/web/app/x/page.tsx',
      'export function P() {\n  return <div className="p-3">a</div>\n}\n',
    )
    const wt = runScript(dir, ['--worktree'])
    assert.equal(wt.status, 0, `工作树档不拦\n${plain(wt.stdout)}`)
    assert.match(plain(wt.stdout), /工作树/)
    assert.match(plain(wt.stdout), /存量 0 枚/)
    assert.match(plain(runHead(dir).stdout), /\[存量\]/, 'HEAD 档仍按已入库那一份报数')
  } finally {
    rmScratch(dir)
  }
})

test('H15 --self-test 全绿(判据自检的入口本身不许坏)', () => {
  const r = runScript(process.cwd(), ['--self-test'])
  assert.equal(r.status, 0, plain(r.stdout) + plain(r.stderr))
  const m = /发丝分隔线守门自检: (\d+)\/(\d+) 通过/.exec(plain(r.stdout))
  assert.ok(m, `自检末行缺失\n${plain(r.stdout)}`)
  assert.equal(m[1], m[2], `自检未全过: ${m[0]}`)
})

test('H16 预筛是判据的超集(删掉任一支就静默少扫)', () => {
  for (const frag of [
    '[hw]-px',
    'hairlineWidth',
    '[hw]-\\[(length:)?[0-9.]',
    '(height|width): *[0-2]',
  ]) {
    assert.ok(gate.PREFILTER_RE.includes(frag), `预筛缺 ${frag}:${gate.PREFILTER_RE}`)
  }
  assert.ok(gate.SCAN_GLOBS.includes('*.tsx'))
  assert.ok(gate.SCAN_GLOBS.includes('*.ts'))
})

test('H17 两把尺子合一:同一枚发丝线在 11d 族 7 与本门同一判定(阳性 + 三型阴性对照)', () => {
  const rel = 'apps/web/src/components/x.tsx'
  const family7Verdict = (body, needle) => {
    const line = body.split('\n').find((l) => l.includes(needle))
    const lineStart = body.indexOf(line)
    return dividerGate.classifyHairlineLine(line, { relPath: rel, text: body, lineStart })
  }
  // 阳性:真分隔线 → 本门命中,族 7 同样命中(不许任一边因"合一"而漏)
  const expectHit = (body, needle) => {
    const hairline = gate.scanSource(rel, body)
    assert.equal(gate.countDividers(hairline), 1, `本门应命中\n${JSON.stringify(hairline.hits)}`)
    assert.ok(family7Verdict(body, needle), '11d 族 7 必须同样命中')
  }
  // 阴性:三型结构件 → 本门放过,族 7 同样放过,且两边认的是同一型
  const expectExempt = (body, needle, type) => {
    const hairline = gate.scanSource(rel, body)
    assert.equal(hairline.hits[0]?.kind, 'exempt', JSON.stringify(hairline.hits))
    assert.equal(hairline.hits[0].type, type)
    assert.equal(family7Verdict(body, needle), null, '11d 族 7 必须同样放过')
  }

  expectHit('<div className="h-px bg-border" />\n', 'h-px')
  expectHit('<div className="w-px bg-border" />\n', 'w-px')

  expectExempt(
    '<div role="separator" className="h-px bg-border" />\n',
    'h-px',
    'semantic-separator',
  )
  expectExempt('<div className="absolute top-0 bottom-0 w-px bg-border" />\n', 'w-px', 'guide-rail')
  expectExempt(
    '<div className="h-px w-8 cursor-col-resize bg-border" />\n',
    'h-px',
    'draggable-splitter',
  )

  // 两侧历史口径一并锁住(11d S62/S63 与 D24 已钉,不许在合一中漂开)
  // 裸 h-full + w-px:尺子判 divider 并带 railSuspect,族 7 同样照判 —— 合一后两边都计数
  expectHit('<div className="h-full w-px bg-border" />\n', 'w-px')
  expectExempt('<div className="w-full h-px bg-border" />\n', 'h-px', 'draggable-splitter')
})

test('H18 顺序即判据:≥3px 彩色块不落 accent 桶(粗尺寸过滤在彩色底判定之前)+ 阳性对照', () => {
  // 站点原文取自 HEAD 面实测(2026-10-23 账面「彩色底」96 枚里 92 枚即此型:尺寸块被记成发丝线)
  // neutralTwin = 同一枚站点把底色换成中性档(逐字手抄,不用正则加工夹具)
  const sites = [
    {
      rel: 'apps/miniapp-taro/src/components/MessageTabs.tsx',
      cls: 'ml-[8rpx] min-w-[32rpx] h-[32rpx] px-[6rpx] rounded-md bg-destructive flex items-center justify-center',
      neutralTwin:
        'ml-[8rpx] min-w-[32rpx] h-[32rpx] px-[6rpx] rounded-md bg-border flex items-center justify-center',
    },
    {
      rel: 'apps/miniapp-taro/src/pkg-about/about/contact.tsx',
      cls: 'w-full h-[100rpx] leading-[100rpx] bg-primary text-[length:32rpx] font-semibold rounded-sm',
      neutralTwin:
        'w-full h-[100rpx] leading-[100rpx] bg-border text-[length:32rpx] font-semibold rounded-sm',
    },
    {
      rel: 'apps/web/app/(main)/admin/monitor/panels/panel-render.tsx',
      cls: 'h-3 w-[3px] shrink-0 rounded-full bg-info/70',
      neutralTwin: 'h-3 w-[3px] shrink-0 rounded-full bg-border',
    },
    {
      rel: 'apps/web/app/(main)/edu/edu-management/meal/page.tsx',
      cls: 'min-h-[80px] border-b border-r p-1 transition-colors hover:bg-accent/30',
      neutralTwin: 'min-h-[80px] border-b border-r p-1 transition-colors hover:bg-border',
    },
  ]

  for (const { rel, cls, neutralTwin } of sites) {
    const body = `<View className="${cls}" />\n`
    const produced = gate.scanSource(rel, body)
    // ① 门体现实现:连放过行都不该有(它根本不是线)
    assert.deepEqual(produced.hits, [], `${rel} 粗块仍被记账:${JSON.stringify(produced.hits)}`)
    assert.equal(gate.excuseCounts(produced.hits)['accent-background'], 0, rel)
    assert.equal(gate.countDividers(produced), 0, rel)
    assert.equal(produced.undetermined.length, 0, rel)

    // ② 阳性对照:**用门体自己的两把谓词**按旧顺序(先问底色 → 后问粗细)复算同一枚站点。
    //    这里不写任何本地形态清单/正则(§22c),只是把"顺序"这一维单独拎出来:
    //    同一枚站点、同一批判据,旧顺序必然落进 accent 桶 ⇒ 账面 96 与实测 4 的差只可能来自顺序。
    const bgs = gate.bgTokensOf(cls)
    assert.ok(bgs.length > 0 && !bgs.some((b) => b.neutral), `${rel} 底色判据必须判得出"非中性"`)
    assert.equal(gate.thinTokensOf(cls).length, 0, `${rel} 尺寸判据必须量不出发丝档`)
    const oldOrderVerdict = bgs.some((b) => b.neutral)
      ? 'divider-or-structural'
      : 'accent-background'
    assert.equal(oldOrderVerdict, 'accent-background', `${rel} 旧顺序的失真正是这一格`)

    // ③ 同形尺寸的**中性底**站点照常是 0 命中(改动前后一致)⇒ 减掉的只有"粗细"这一维,
    //    与底色立场无关 ⇒ 真分隔线的识别面没有因为收窄而变小
    assert.equal(
      gate.scanSource(rel, `<View className="${neutralTwin}" />\n`).hits.length,
      0,
      `${rel} 同形中性底也必须 0 命中`,
    )
  }

  // ④ 反向锁:真发丝 + 彩色底仍留 accent 桶(收窄不许把这一族一起吞掉)
  const hairAccent = gate.scanSource(
    'apps/web/a.tsx',
    '<span className="h-px w-8 bg-primary/60" />',
  ).hits[0]
  assert.equal(hairAccent?.type, 'accent-background', JSON.stringify(hairAccent))
  assert.equal(gate.excuseCounts([hairAccent])['accent-background'], 1)

  // ⑤ 顺序锁(形状锁):面 A 里 `thinTokensOf(surface)` 必须写在彩色底 push 之前。
  //    行为对照只覆盖夹具这几枚,顺序一旦被换回去、新的粗块形态照样会静默进桶 —— 这一条钉写法。
  //    2026-10-24 合一:判据本体(面 A/面 B)已上收进 11d 族 7 段的 `scanHairlineFaces`(§0.6 一把尺子),
  //    本锁随之改钉 check-no-divider.mjs —— 钉"唯一实现"的写法,不钉已退化为适配层的发丝尺。
  const implSrc = readFileSync(join(__dirname, '..', 'check-no-divider.mjs'), 'utf8')
  // 锚点用**循环体内的分节注释**(与文件顶部的横幅注释不同字,不会命中横幅)
  const faceA = implSrc.slice(
    implSrc.indexOf('面 A:Tailwind 类名(h-px'),
    implSrc.indexOf('面 B:RN / 内联样式对象(height|width'),
  )
  assert.ok(faceA.length > 200, `面 A 区段定位失败(分节注释被改字?)\n${faceA.slice(0, 120)}`)
  const thinAt = faceA.indexOf('const thin = thinTokensOf(surface)')
  const accentAt = faceA.indexOf("type: 'accent-background'")
  assert.ok(thinAt >= 0, `面 A 里找不到粗尺寸过滤这一行\n${faceA.slice(0, 200)}`)
  assert.ok(accentAt >= 0, '面 A 里找不到彩色底 push 这一行')
  assert.ok(
    thinAt < accentAt,
    `粗尺寸过滤必须排在彩色底判定之前(thinTokensOf@${thinAt} vs accent@${accentAt})`,
  )
  // 底色"没写就不归本门"这一格仍须在粗筛之前(射程边界,自检 T04/T17 靠它)
  assert.ok(faceA.indexOf('const bgs = bgTokensOf(surface)') < thinAt, '射程边界不许被挪到粗筛之后')

  // ⑥ 兄弟门 11d 族 7 对同一枚粗块同样不判(它先认发丝档才看底色)⇒ 两门同口径
  for (const { cls } of sites) {
    assert.equal(
      dividerGate.classifyHairlineLine(`<View className="${cls}" />`, {
        relPath: 'apps/web/a.tsx',
        text: `<View className="${cls}" />`,
        lineStart: 0,
      }),
      null,
      '11d 族 7 也不该把粗块当发丝线',
    )
  }
})

// ─────────── 2026-10-24 合一(票 L29015 尾格:两把尺互顶 → 严格指纹单源)───────────

test('H19 两门同场 staged:等积清偿(发丝线→等积单边描边)两把尺都不得判新增(互顶回归锁)', () => {
  // 立因:旧族 7 自带一把宽松近似,`h-px bg-popover`/`h-[2px]`/RN `height: 2` 这些只有发丝尺
  // 计数的形状被改成等积单边描边时,发丝尺存量 1→0(变好)、族 6/4 棘轮却按 HEAD 基线 0 判
  // "新增 1 超棘轮"⇒ 清偿本身被拦、改动被回退(票面原话"单枚硬改=为一尺绿造另一尺红")。
  // 合一后族 7 与尺子读同一组枚数:动手前基线已含这枚线,清偿后计数只降不升。
  const cases = [
    {
      rel: 'apps/web/app/x/page.tsx',
      before: 'export function P() {\n  return <div className="h-px bg-popover" />\n}\n',
      after: 'export function P() {\n  return <div className="border-b border-border" />\n}\n',
    },
    {
      rel: 'apps/web/app/y/page.tsx',
      before: 'export function P() {\n  return <div className="h-[2px] bg-border" />\n}\n',
      after: 'export function P() {\n  return <div className="border-b border-border" />\n}\n',
    },
    {
      rel: 'apps/miniapp-taro/src/pages/z/index.tsx',
      before: 'export function P() {\n  return <View className="h-[2rpx] bg-border" />\n}\n',
      after: 'export function P() {\n  return <View className="border-b border-border" />\n}\n',
    },
    {
      rel: 'apps/mobile-rn/src/screens/W.tsx',
      before:
        'const shellStyles = {\n  hairline: {\n    height: 2,\n    backgroundColor: tokens.border.light,\n  } as const,\n}\n',
      after:
        'const shellStyles = {\n  hairline: {\n    borderTopWidth: 2,\n    borderTopColor: tokens.border.light,\n  } as const,\n}\n',
    },
    {
      // 票尾那一枚的原形(HomeScreen.modelModalHairline 形状)
      rel: 'apps/mobile-rn/src/screens/Home.tsx',
      before:
        'const shellStyles = {\n  modelModalHairline: {\n    height: StyleSheet.hairlineWidth,\n    backgroundColor: tokens.border.light,\n  } as const,\n}\n',
      after:
        'const shellStyles = {\n  modelModalHairline: {\n    borderTopWidth: StyleSheet.hairlineWidth,\n    borderTopColor: tokens.border.light,\n  } as const,\n}\n',
    },
    {
      // 低透明度发丝(合一后尺子/族 7 同计 blocking)→ 等积低透明描边落族 3 WARN
      rel: 'apps/web/app/v/page.tsx',
      before: 'export function P() {\n  return <div className="h-px bg-border/50" />\n}\n',
      after: 'export function P() {\n  return <div className="border-t border-border/50" />\n}\n',
    },
  ]
  for (const { rel, before, after } of cases) {
    const dir = createRepo({ [rel]: before })
    try {
      stage(dir, rel, after)
      const h = runStaged(dir)
      const d = runDividerStaged(dir)
      assert.equal(h.status, 0, `发丝尺不该拦等积清偿:${rel}\n${plain(h.stdout)}`)
      assert.equal(
        d.status,
        0,
        `族 7 棘轮不该把等积清偿判成新增(互顶回潮):${rel}\n${plain(d.stdout)}`,
      )
    } finally {
      rmScratch(dir)
    }
  }
  // 反向锁(摘掉合一即翻红):基线无发丝线的干净文件里
  // ① 裸加 h-px bg-border ⇒ 两把尺都拦(合并不许把真新增放过去)
  const dir1 = createRepo({ 'apps/web/app/x/page.tsx': 'export const z = 1\n' })
  try {
    stage(
      dir1,
      'apps/web/app/y/page.tsx',
      'export function Q() {\n  return <div className="h-px bg-popover" />\n}\n',
    )
    assert.equal(runStaged(dir1).status, 1, '新增发丝线发丝尺必须拦')
    assert.equal(runDividerStaged(dir1).status, 1, '新增发丝线族 7 必须拦(合一后只有更严,不更松)')
  } finally {
    rmScratch(dir1)
  }
  // ② 凭空新增单边描边(HEAD 无形无)⇒ 族 7 棘轮照拦(清偿出口不许被拿来遮真新增)
  const dir2 = createRepo({ 'apps/web/app/x/page.tsx': 'export const z = 1\n' })
  try {
    stage(
      dir2,
      'apps/web/app/y/page.tsx',
      'export function Q() {\n  return <div className="border-b border-border" />\n}\n',
    )
    assert.equal(runDividerStaged(dir2).status, 1, '凭空加描边必须拦')
  } finally {
    rmScratch(dir2)
  }
})

test('H20 严格指纹同尺对账:无描边形状上两把尺的 blocking/未判定枚数逐枚相等(§22c 一把尺子)', () => {
  const shapes = [
    ['apps/web/a.tsx', '<div className="h-px bg-border" />\n', 1, 0],
    ['apps/web/a.tsx', '<div className="h-px bg-popover" />\n', 1, 0],
    ['apps/web/a.tsx', '<div className="h-px bg-white" />\n', 1, 0],
    ['apps/web/a.tsx', '<div className="h-px bg-black" />\n', 1, 0],
    ['apps/web/a.tsx', '<div className="h-[2px] bg-border" />\n', 1, 0],
    ['apps/miniapp-taro/src/pages/a/index.tsx', '<View className="h-[2rpx] bg-border" />\n', 1, 0],
    ['apps/web/a.tsx', '<div className="h-px bg-muted-foreground" />\n', 1, 0],
    ['apps/web/a.tsx', '<div className="h-px bg-border/50" />\n', 1, 0],
    ['apps/web/a.tsx', '<span className="h-px w-8 bg-primary/60" />\n', 0, 0],
    ['apps/web/a.tsx', '<span className="h-[4px] bg-border" />\n', 0, 0],
    ['apps/web/a.tsx', '<span className="w-[0.125rem] bg-border" />\n', 0, 1],
    ['apps/web/a.tsx', '<div role="separator" className="h-px bg-border" />\n', 0, 0],
    ['apps/web/a.tsx', '<div className="absolute top-0 bottom-0 w-px bg-border" />\n', 0, 0],
    ['apps/web/a.tsx', '<div className="w-full h-px bg-border" />\n', 0, 0],
    [
      'apps/mobile-rn/src/a.tsx',
      'const s = {\n  line: { height: 1, backgroundColor: tk.border.light },\n}\n',
      1,
      0,
    ],
    [
      'apps/mobile-rn/src/a.tsx',
      'const s = {\n  line: { height: 2, backgroundColor: tk.border.light },\n}\n',
      1,
      0,
    ],
    [
      'apps/mobile-rn/src/a.tsx',
      'const s = {\n  line: { height: StyleSheet.hairlineWidth, backgroundColor: tk.border.light },\n}\n',
      1,
      0,
    ],
    [
      'apps/mobile-rn/src/a.tsx',
      'const s = {\n  line: { height: StyleSheet.hairlineWidth * 2, backgroundColor: tk.border.light },\n}\n',
      1,
      0,
    ],
    [
      'apps/mobile-rn/src/a.tsx',
      'const s = {\n  line: { height: StyleSheet.hairlineWidth * SCALE, backgroundColor: tk.border.light },\n}\n',
      0,
      1,
    ],
    [
      'apps/mobile-rn/src/a.tsx',
      'const s = {\n  card: { shadowOffset: { width: 0, height: 1 } },\n}\n',
      0,
      0,
    ],
    // 面 B 词界假阳锁(合一后族 7 在更大清单面上跑,kebab CSS 串不得冒充 RN 对象键)
    ['apps/web/a.tsx', 'const html = `<div style="font-size:16px;line-height:2;">x</div>`\n', 0, 0],
  ]
  for (const [rel, body, wantDividers, wantUndetermined] of shapes) {
    const h = gate.scanSource(rel, body)
    const d = dividerGate.scanSource(rel, body)
    assert.equal(
      gate.countDividers(h),
      dividerGate.countOpaqueSingles(d),
      `两把尺 blocking 枚数不等:${rel} ${body.trim()}`,
    )
    assert.equal(gate.countDividers(h), wantDividers, `尺子读数漂移:${rel} ${body.trim()}`)
    assert.equal(
      h.undetermined.length,
      d.undetermined,
      `两把尺未判定枚数不等:${rel} ${body.trim()}`,
    )
    assert.equal(h.undetermined.length, wantUndetermined, `未判定读数漂移:${rel} ${body.trim()}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
