#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— scripts/quarantine-disk-root-strays.mjs(影子版)
 *
 * 为什么必须有它:`--self-test` 证明的是**夹具内判据会给答案**,证不了 CLI 这一层
 * (参数解析、--wt-file/--now/--devenv 通道、退出码、JSON/人读两档输出)有人问它。
 * 本文件跑**真 CLI + 真夹具**,并把三件只有跨文件才看得见的事钉住:
 *   ① 判据确实 import 自 sibling 尺子与取材层(§22c 单一真相源),本文件不复制常量;
 *   ② 影子版纪律在**源码级**成立:无 rename/rm/cp/unlink、无第二套 gitdir 推导、
 *      --apply 被拒、判据时钟可注入;
 *   ③ 生产判盘干净时的三桶形状稳定(不断言"此刻盘根无残留"—— 那会是 flaky;
 *      断言的是"任何 wouldMove 都必须带完整取证、白名单项不得进桶")。
 *
 * 平台口径:跨卷条件在 POSIX 上没有第二个卷可指(parse('/x').root 恒为 '/'),故两处
 * 跨卷用例按结构性守卫跳过并打印原因 —— 跳过是"本机不适用",不是"没测"。
 *
 * 零副作用:夹具落 mkScratch(§26 唯一临时物落点);对真盘根只读;断言隔离目录不被创建。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { currentDriveRoot } from '../check-disk-root-hygiene.mjs'
import { resolveGitdir } from '../lib/gitdir.mjs'
import { devEnvRoot } from '../seal-c-root-stray.mjs'
import { quarantineScan } from '../quarantine-disk-root-strays.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'quarantine-disk-root-strays.mjs')
const IS_WIN32 = process.platform === 'win32'

function runCli(args, env = process.env) {
  return execFileSync(process.execPath, [GATE, ...args], {
    encoding: 'utf8',
    cwd: REPO,
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  })
}

// 非零退出是若干用例的**预期结论**(rc=1 有只报项 / rc=2 拒 --apply),统一从这里取;
// stdout/stderr 分开 —— JSON 只在 stdout,混进来会让 parse 把告警行也吞进去。
function runCliCaptured(args, env = process.env) {
  try {
    const stdout = runCli(args, env)
    return { rc: 0, stdout, stderr: '' }
  } catch (e) {
    return { rc: e.status ?? -1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }
  }
}

const runJson = (args, env) => JSON.parse(runCliCaptured(args, env).stdout)

/**
 * 造一份合成盘根夹具(G-1059131 纪律:盘符运行时现取,夹具不赌本机盘符)。
 * 判据时钟用 --now 前移 1000h 让真实新建的夹具"老于窗口";Windows 上 ctime 即创建
 * 时间、用户态回拨不了,所以"旧"不靠改文件出生时间,靠判据时钟说话。
 */
function buildFixture(dir) {
  const root = join(dir, 'root')
  mkdirSync(root, { recursive: true })
  const gitdir = resolveGitdir()
  assert.ok(gitdir, 'resolveGitdir() 在本机必须算得出')
  const shifted = new Date(Date.now() + 1000 * 3_600_000)
  const mk = (name, markers = []) => {
    const p = join(root, name)
    mkdirSync(p, { recursive: true })
    if (markers.includes('gitfile')) writeFileSync(join(p, '.git'), `gitdir: ${gitdir}\n`)
    if (markers.includes('workspace')) writeFileSync(join(p, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
    if (markers.includes('refs')) writeFileSync(join(p, 'refs-manifest.json'), '{ "refs": [] }\n')
    if (markers.includes('agents'))
      writeFileSync(
        join(p, 'AGENTS.md'),
        '<!--\n  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n-->\n\n# fixture\n',
      )
    return p
  }
  mk('ihui-head-check', ['gitfile', 'agents'])
  mk('ihui-wt-live', ['workspace'])
  mk('ihui-main-wt', ['refs'])
  mk('ihui-name-only', [])
  mk('ihui-cross-vol', ['workspace'])
  const jump = join(dir, 'jump-target')
  mkdirSync(jump, { recursive: true })
  symlinkSync(jump, join(root, 'ihui-junction'), IS_WIN32 ? 'junction' : 'dir')
  const wtFile = join(dir, 'porcelain.txt')
  writeFileSync(
    wtFile,
    `worktree ${join(root, 'ihui-main-wt')}\nHEAD aaa\nbranch refs/heads/main\n\nworktree ${join(root, 'ihui-wt-live')}\nHEAD bbb\ndetached\n\n`,
  )
  return { root, wtFile, now: shifted.toISOString(), gitdir }
}

const reasonOf = (json, name) => {
  const hit = json.onlyReport.find((x) => basename(x.path) === name)
  return hit ? hit.reasons[0] : null
}

test('T1 --self-test 必须真跑完并全绿(有求值的用例数,不是恒绿)', () => {
  const out = runCli(['--self-test'])
  assert.doesNotMatch(out, /❌/, `自检有失败项:\n${out}`)
  const m = out.match(/自检:pass (\d+) \/ fail (\d+)/)
  assert.ok(m, `末行缺 pass/fail 汇总:\n${out.slice(-200)}`)
  assert.equal(Number(m[2]), 0, 'fail 必须为 0')
  assert.ok(Number(m[1]) >= 20, `自检用例数不得倒退(现 ${m[1]})`)
})

test('T2 真实盘根 --check --json:三桶形状稳定,白名单项不进桶,wouldMove 必带取证', () => {
  // 不断言 rc:盘根出现真残留时 rc=1 是工具的预期检出,不是测试失败。
  const j = runJson(['--check', '--json'])
  for (const k of ['wouldMove', 'onlyReport', 'undetermined']) {
    assert.equal(Array.isArray(j[k]), true, `${k} 必须是数组`)
  }
  assert.ok(j.meta && typeof j.meta.quarantineRoot === 'string', 'meta.quarantineRoot 缺失')
  assert.ok(Array.isArray(j.meta.roots) && j.meta.roots.length >= 1, 'meta.roots 必须报到扫了哪些盘')
  // 本机仓根所在盘必须被报到(它是"工作树盘"那一半);状态只允许枚举值
  // (scanned/undetermined/unreadable/absent),未申报的盘落 undetermined 也是如实报。
  const here = currentDriveRoot()
  assert.ok(here, 'currentDriveRoot() 在本机必须解析得出来')
  const hereRoot = j.meta.roots.find((r) => r.root === here)
  assert.ok(hereRoot, `仓根盘 ${here} 必须出现在 meta.roots,实得 ${JSON.stringify(j.meta.roots)}`)
  assert.ok(
    ['scanned', 'undetermined', 'unreadable', 'absent'].includes(hereRoot.status),
    `meta.roots 状态非法:${hereRoot.status}`,
  )
  for (const r of j.meta.roots) {
    if (r.status !== 'scanned') assert.equal(r.status, 'absent', `非 scanned 的已存在盘只能是 absent,实得 ${r.status}`)
  }
  // 白名单已知项不得进任何桶(它们是合法条目,不是候选)
  const known = ['IHUI-AI', 'DevEnv', 'IHUI-AI-git-repo', 'pagefile.sys']
  const names = [...j.wouldMove, ...j.onlyReport].map((x) => basename(x.path))
  for (const k of known) assert.ok(!names.includes(k), `白名单项 ${k} 不该进桶`)
  // 任何 wouldMove 都必须带完整取证 —— 没有取证的"将会移动"就是没有牙的指控
  for (const w of j.wouldMove) {
    assert.equal(typeof w.sizeBytes, 'number', 'wouldMove 顶层必须带 sizeBytes(规格形状)')
    assert.ok(w.evidence && Array.isArray(w.evidence.markers) && w.evidence.markers.length > 0, 'wouldMove 必须带内容标记取证')
    assert.ok(w.evidence.namePattern, 'wouldMove 必须带名模式取证')
  }
  for (const o of j.onlyReport) {
    assert.ok(Array.isArray(o.reasons) && o.reasons.length > 0, 'onlyReport 每条必须带原因')
  }
})

test('T3 CLI --dry-run 夹具:正例被预演 + 反例逐因 + 恢复命令 + EPERM 分支 + 零副作用', () => {
  const dir = mkScratch('quar-mir-t3-')
  try {
    const fx = buildFixture(dir)
    const cap = runCliCaptured(['--dry-run', '--root', fx.root, '--wt-file', fx.wtFile, '--now', fx.now])
    assert.equal(cap.rc, 1, `夹具有只报项 ⇒ 应 exit 1,实得 ${cap.rc}\n${cap.stdout}\n${cap.stderr}`)
    // 预演路径形状(盘符段运行时现取,不写死;POSIX 上该段为空串)
    const drive = IS_WIN32 ? parse(fx.root).root[0].toUpperCase() : ''
    assert.match(
      cap.stdout,
      new RegExp(`将会移入 .*disk-root-quarantine[\\\\/]\\d{8}T\\d{6}Z[\\\\/]${drive}[\\\\/]?ihui-head-check`),
      `正例预演路径形状不对:\n${cap.stdout}`,
    )
    assert.match(cap.stdout, /恢复:move ".*" ".*"/, '恢复命令必须逐条给出')
    assert.match(cap.stdout, /EPERM\/EBUSY 只记录并原样保留,绝不删除/, '预演必须体现 EPERM/EBUSY 分支')
    // 反例逐条给出原因(人读档)
    for (const [name, reason] of [
      ['ihui-wt-live', 'worktreeRegistered'],
      ['ihui-main-wt', 'mainWorktree'],
      ['ihui-name-only', 'unidentified'],
      ['ihui-junction', 'reparse'],
    ]) {
      assert.match(cap.stdout, new RegExp(`${name}[\\s\\S]{0,200}?${reason}`), `${name} 必须只报并给出 ${reason}`)
    }
    // 零副作用:预演不得创建隔离批次目录(影子版连目录都不建)
    assert.ok(!existsSync(join(devEnvRoot(), 'Temp', 'disk-root-quarantine')), 'dry-run 创建了隔离目录')
    // JSON 档同一份扫描的机器可读面
    const j = runJson(['--dry-run', '--json', '--root', fx.root, '--wt-file', fx.wtFile, '--now', fx.now])
    const wm = j.wouldMove.find((x) => basename(x.path) === 'ihui-head-check')
    assert.ok(wm, 'JSON 档正例必须在 wouldMove')
    assert.ok(wm.evidence.markers.includes('gitfile-points-project-gitdir'), 'gitfile 取证')
    assert.equal(reasonOf(j, 'ihui-wt-live'), 'worktreeRegistered')
    assert.equal(reasonOf(j, 'ihui-main-wt'), 'mainWorktree')
    assert.equal(reasonOf(j, 'ihui-name-only'), 'unidentified')
    assert.equal(reasonOf(j, 'ihui-junction'), 'reparse')
  } finally {
    rmScratch(dir)
  }
})

test('T4 新鲜臂(真实时钟):窗口内的可识别项 ⇒ onlyReport(fresh),wouldMove 为空', () => {
  const dir = mkScratch('quar-mir-t4-')
  try {
    const fx = buildFixture(dir)
    // 不传 --now ⇒ 判据时钟 = 真实此刻 ⇒ 夹具统统落在 24h 窗口内
    const j = runJson(['--check', '--json', '--root', fx.root, '--wt-file', fx.wtFile])
    assert.equal(j.wouldMove.length, 0, `真实时钟下夹具应全部 fresh,实得 ${JSON.stringify(j.wouldMove)}`)
    assert.equal(reasonOf(j, 'ihui-head-check'), 'fresh', '正例夹具在窗口内必须翻 fresh')
  } finally {
    rmScratch(dir)
  }
})

test('T5 跨卷臂(--devenv 换结构性不同的盘符,G-1059131) ⇒ crossVolume', () => {
  if (!IS_WIN32) {
    console.info('  ⏭ 跳过:POSIX 没有第二个卷可指(parse 的 root 恒为 /),跨卷条件本机不适用')
    return
  }
  const dir = mkScratch('quar-mir-t5-')
  try {
    const fx = buildFixture(dir)
    const fakeLetter = parse(fx.root).root[0].toUpperCase() === 'Q' ? 'R' : 'Q'
    const j = runJson([
      '--check',
      '--json',
      '--root',
      fx.root,
      '--wt-file',
      fx.wtFile,
      '--now',
      fx.now,
      '--devenv',
      `${fakeLetter}:${sep}fake-quarantine-root`,
    ])
    assert.equal(j.wouldMove.length, 0, '跨卷下不得有 wouldMove')
    assert.equal(reasonOf(j, 'ihui-cross-vol'), 'crossVolume', '跨卷条目必须只报 crossVolume')
    // 反例的"先拦住它的那条"仍应是更早的条件(reparse 先于跨卷)
    assert.equal(reasonOf(j, 'ihui-junction'), 'reparse', '条件次序不能乱:junction 恒只报 reparse')
  } finally {
    rmScratch(dir)
  }
})

test('T6 退出码:净盘根 0 / 有项 1 / --apply 2 / 非法 env 2 / 非法 --now 2', () => {
  const dir = mkScratch('quar-mir-t6-')
  try {
    // 空替身盘根:没有条目 ⇒ 三桶皆空 ⇒ exit 0
    const empty = join(dir, 'empty-root')
    mkdirSync(empty, { recursive: true })
    const clean = runCliCaptured(['--check', '--root', empty])
    assert.equal(clean.rc, 0, `空盘根应 exit 0,实得 ${clean.rc}\n${clean.stdout}\n${clean.stderr}`)

    const fx = buildFixture(dir)
    const busy = runCliCaptured(['--check', '--root', fx.root, '--wt-file', fx.wtFile, '--now', fx.now])
    assert.equal(busy.rc, 1, '有只报项应 exit 1')

    // --apply 影子版必须拒任,且说明原因(不是静默降级成 check)
    const apply = runCliCaptured(['--apply'])
    assert.equal(apply.rc, 2, `--apply 必须 exit 2,实得 ${apply.rc}`)
    assert.match(apply.stdout + apply.stderr, /--apply 未实现|影子版/, '拒任必须带原因')

    const badEnv = runCliCaptured(['--check'], { ...process.env, QUARANTINE_FRESH_HOURS: 'abc' })
    assert.equal(badEnv.rc, 2, '非法新鲜窗必须 exit 2(静默失效比没有窗口坏)')
    assert.match(badEnv.stderr, /QUARANTINE_FRESH_HOURS/)

    const badNow = runCliCaptured(['--check', '--now', 'not-a-timestamp'])
    assert.equal(badNow.rc, 2, '非法 --now 必须 exit 2')
  } finally {
    rmScratch(dir)
  }
})

test('T7 幂等:同输入两次 --dry-run,三桶逐字一致(为将来 --apply 的准备)', () => {
  const dir = mkScratch('quar-mir-t7-')
  try {
    const fx = buildFixture(dir)
    const args = ['--dry-run', '--json', '--root', fx.root, '--wt-file', fx.wtFile, '--now', fx.now]
    const a = JSON.parse(runCliCaptured(args).stdout)
    const b = JSON.parse(runCliCaptured(args).stdout)
    assert.equal(JSON.stringify(a.wouldMove), JSON.stringify(b.wouldMove), 'wouldMove 必须可重放')
    assert.equal(JSON.stringify(a.onlyReport), JSON.stringify(b.onlyReport), 'onlyReport 必须可重放')
    assert.equal(JSON.stringify(a.undetermined), JSON.stringify(b.undetermined), 'undetermined 必须可重放')
  } finally {
    rmScratch(dir)
  }
})

test('T8 新鲜窗 env 真的接线:QUARANTINE_FRESH_HOURS 放大 ⇒ 同一夹具翻 fresh', () => {
  const dir = mkScratch('quar-mir-t8-')
  try {
    const fx = buildFixture(dir)
    const j = runJson(['--check', '--json', '--root', fx.root, '--wt-file', fx.wtFile, '--now', fx.now], {
      ...process.env,
      QUARANTINE_FRESH_HOURS: '2000',
    })
    assert.equal(j.wouldMove.length, 0, '2000h 窗下 1000h 老的夹具必须全翻 fresh')
    assert.equal(reasonOf(j, 'ihui-head-check'), 'fresh', 'env 覆盖必须落到判定上')
    assert.equal(j.meta.freshWindowHours, 2000, 'meta 必须如实报出用的窗口')
  } finally {
    rmScratch(dir)
  }
})

test('T9 形状锁:判据只 import 不复制;影子版纪律在源码级成立', () => {
  const src = readFileSync(GATE, 'utf8')
  // ① 判据来源(§22c):五处 import 必须在位,且本文件不得出现第二份定义。
  // 名字逐个断、不断言 import 列表的内部顺序(顺序是格式化产物,不是判据)。
  const importNames = (from) => {
    const m = src.match(new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'${from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}'`))
    assert.ok(m, `找不到 import ... from '${from}'`)
    return m[1]
  }
  for (const name of ['auditDiskRoot', 'deriveSanctioned', 'normalizeRootKey', 'currentDriveRoot']) {
    assert.ok(importNames('./check-disk-root-hygiene.mjs').includes(name), `盘根/白名单/派生层判据 ${name} 必须 import 自 sibling 尺子`)
  }
  assert.ok(importNames('./lib/face-reader.mjs').includes('gitRaw'), 'porcelain 必须走取材层 gitRaw')
  assert.ok(importNames('./seal-c-root-stray.mjs').includes('devEnvRoot'), '隔离根必须复用 devEnvRoot')
  assert.ok(importNames('./lib/gitdir.mjs').includes('resolveGitdir'), '真 gitdir 必须走共用层')
  assert.ok(importNames('./lib/watermark-lines.mjs').includes('isBannerLine'), '水印行识别必须走共用层')
  assert.doesNotMatch(src, /function\s+deriveSanctioned/, '不得在本地再定义一份派生豁免')
  assert.doesNotMatch(src, /function\s+normalizeRootKey/, '不得在本地再抄一份键形归一')
  assert.doesNotMatch(src, /--git-dir|rev-parse/, '不得自己派生 gitdir(第二套指针推导必漂移)')
  // ② 影子版纪律:绝不删除/绝不移动 —— 四个写 API 在整个文件零出现
  for (const api of ['renameSync', 'rmSync(', 'cpSync', 'unlinkSync']) {
    assert.doesNotMatch(src, new RegExp(api.replace('(', '\\(')), `影子版不得出现 ${api}`)
  }
  // 夹具写入(mkdirSync/writeFileSync/symlinkSync/utimesSync)只许出现在自检段
  const selfTestAt = src.indexOf('export function selfTest')
  assert.ok(selfTestAt > 0, '找不到 selfTest 边界 ⇒ 下方断言会退化成空判')
  for (const api of ['mkdirSync(', 'writeFileSync(', 'symlinkSync(', 'utimesSync(']) {
    const first = src.indexOf(api)
    assert.ok(first === -1 || first > selfTestAt, `${api} 不得出现在生产段(自检夹具之外)`)
  }
  // ③ --apply 拒任 + 双形态入口 + 退出码口径 + 隔离根运行时推导
  assert.match(src, /--apply 未实现/, '必须显式拒任 --apply')
  assert.match(
    src,
    /if \(process\.argv\[1\] && resolve\(process\.argv\[1\]\) === fileURLToPath\(import\.meta\.url\)\)/,
    '§22d 双形态入口必须在位',
  )
  assert.match(
    src,
    /wouldMove\.length \|\| onlyReport\.length \|\| undetermined\.length \? 1 : 0/,
    '退出码口径:任一桶非空 ⇒ 1(含未判定)',
  )
  assert.match(src, /devEnvRoot\(\)/, '隔离区根必须按 devEnvRoot() 运行时推导,不写死盘符')
  // 盘符字面量只许出现在自检夹具里(生产判据不得赌本机盘符)
  const driveLiterals = src.match(/['"][A-Za-z]:[\\/]/g) ?? []
  for (const lit of driveLiterals) {
    assert.ok(src.indexOf(lit) > selfTestAt, `盘符字面量 ${lit} 不得出现在生产段`)
  }
})

test('T10 双形态入口:import 不跑 main;出口齐备(缺出口即红)', async () => {
  const mod = await import(pathToFileURL(GATE).href)
  for (const fn of [
    'quarantineScan',
    'evaluateEntry',
    'hardProtectionReason',
    'planQuarantinePath',
    'parsePorcelain',
    'matchesProjectName',
    'contentMarkers',
    'newestMtimeScan',
    'dirSizeScan',
    'freshWindowMs',
    'quarantineStamp',
    'selfTest',
  ]) {
    assert.equal(typeof mod[fn], 'function', `出口 ${fn} 缺失 ⇒ 镜像测试会悄悄测镜像实现`)
  }
  // import 不得有副作用:不创建隔离目录
  assert.ok(!existsSync(join(devEnvRoot(), 'Temp', 'disk-root-quarantine')), 'import 居然建了隔离目录')
})

test('T11 降级有牙:porcelain 取不到 ⇒ wouldMove 必须为空(直呼 scan,注入 null)', () => {
  const dir = mkScratch('quar-mir-t11-')
  try {
    const fx = buildFixture(dir)
    const r = quarantineScan({
      root: fx.root,
      porcelain: null, // 登记面取不到(生产档 git 失败的同形态)
      quarantineRoot: devEnvRoot(),
      freshHours: 24,
      now: new Date(fx.now),
    })
    assert.equal(r.wouldMove.length, 0, '判不了"是否登记在册"就不得出 wouldMove')
    assert.ok(
      r.onlyReport.some((x) => x.reasons[0] === 'worktreeRegistryUnavailable'),
      '每条候选必须落 worktreeRegistryUnavailable',
    )
    assert.ok(r.undetermined.some((u) => /worktree/.test(u.why)), '未判定桶必须报名')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
