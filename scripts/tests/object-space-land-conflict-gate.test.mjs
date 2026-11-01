// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-OSL 2026-11-01
/**
 * object-space-land 落地前**冲突标记闸**的镜像测试 —— L33560 的最后一格。
 *
 * 立项因由(票面):`scripts/lib/conflict-marker-landing-gate.mjs` 与 `union-converge.mjs:1426-1451`
 * 那枚落地闸前一席已入库,但同走 `commit-tree` 旁路的 `object-space-land.mjs` **一次都没调用过**
 * 冲突标记判据 —— 它正是"标记被摘 → 下一枚并集按'对侧在场即补回'捞回"这个循环的第二条腿。
 * 本测试钉的就是"这一格接线在,并且有牙":
 *
 *  T1 must-block(任一侧有真内容)⇒ **不落地**(HEAD / 主索引 blob / 工作树脏面三者前后一致)
 *     + exit 1(本器退出码表里的"业务拒绝"档,与 union-converge 的 bad 同档)+ 点名文件/行号/标记原文
 *  T2 strippable(区域内两侧零正文)⇒ **照常落地** + 输出"建议摘除"(不得退化成一门恒红门)
 *  T3 无标记 ⇒ 照常落地(回归:证明闸没误伤)
 *  T4 逃生口(`IHUI_OSL_SKIP_CONFLICT_MARKER_GATE=1`,转发到 lib 的
 *     `IHUI_LAND_SKIP_CONFLICT_MARKER_GATE`)⇒ must-block 内容照常落地,且**必打留痕行**。
 *     ⚠️ 登记:这一档就是"逃生口会让本判据失效"的现场证据 —— 设了它,冲突标记三行可以再进 HEAD。
 *  T5 形状锁:接线在位且**排在 `casUpdateRef(` 之前**(本文件用相对位置断言,不靠人眼)
 *
 * 一律在 `os.tmpdir()` 的 `git init` 合成仓里跑(经 `mkScratch`,退出即回收),
 * **绝不在真仓上跑任何落地动作**;每例都跳过三项临时仓判不出的预检(水印/悬空引用/门 98),
 * 与 object-space-land-remove.test.mjs 同一姿势,被跳的判据与本闸正交。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'object-space-land.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')
const GIT = resolveGitBin() || 'git'
const RUN_OPTS = {
  encoding: 'utf8',
  windowsHide: true,
  timeout: 120_000,
  maxBuffer: 64 << 20,
  stdio: ['ignore', 'pipe', 'pipe'],
}
const runGit = (dir, args) =>
  execFileSync(
    GIT,
    [
      '-c',
      'safe.directory=*',
      '-c',
      'user.email=t@e2e.local',
      '-c',
      'user.name=e2e',
      '-c',
      'core.autocrlf=false',
      '-C',
      dir,
      ...args,
    ],
    RUN_OPTS,
  )

const BASE_TEXT = 'alpha\nbeta\n'
/** 待落地内容:基线两行原样保留(不制造"消失/复活"),只在尾部追加。 */
const withTail = (tail) => `${BASE_TEXT}${tail}`

const MUST_BLOCK_TAIL = [
  '<<<<<<< HEAD',
  'mine-side-from-this-ticket',
  '=======',
  'theirs-side-from-other-ticket',
  '>>>>>>> other-branch',
  '',
].join('\n')

const STRIPPABLE_TAIL = ['<<<<<<< HEAD', '=======', '>>>>>>> other-branch', ''].join('\n')

/** 合成仓:land.txt 是基线在位的跟踪件(本测试唯一的落地面)。 */
function makeRepo(t) {
  const dir = mkScratch('osl-cm-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  writeFileSync(join(dir, 'land.txt'), BASE_TEXT, 'utf8')
  writeFileSync(join(dir, 'other.txt'), 'untouched\n', 'utf8')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

/** 真跑一次落地(env 驱动的 CLI,与外部调用完全同形)。 */
function land(dir, { paths = 'land.txt', msg = 'e2e', extra = {} } = {}) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      LAND_ROOT: dir,
      LAND_PATHS: paths,
      LAND_MSG: msg,
      // 三项与冲突标记判据正交的预检:临时仓判不出(无横幅基线 / closure 未复制 / 树不是本仓 HEAD)。
      IHUI_LAND_SKIP_WATERMARK: '1',
      IHUI_LAND_SKIP_IMPORT_CHECK: '1',
      IHUI_LAND_SKIP_DANGLING_GATE: '1',
      ...extra,
    },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 现场快照:HEAD / 索引 blob / 工作树脏面 —— 三者任一变化都算"落地动作真的发生了"。 */
const snapshot = (dir) => ({
  head: runGit(dir, ['rev-parse', 'HEAD']).trim(),
  indexBlob: runGit(dir, ['ls-files', '-s', '--', 'land.txt']).trim(),
  dirty: runGit(dir, ['status', '--porcelain']).trim(),
  headText: runGit(dir, ['cat-file', 'blob', 'HEAD:land.txt']),
})

const out = (r) => `${r.stdout ?? ''}${r.stderr ?? ''}`

test('T1 must-block ⇒ 不落地(引用/索引/工作树脏面三者未变)+ exit 1 + 点名文件/行号/标记原文', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'land.txt'), withTail(MUST_BLOCK_TAIL), 'utf8')
  const before = snapshot(dir)
  const r = land(dir)
  const o = out(r)
  assert.equal(r.status, 1, `必须判红在"业务拒绝"档(1),实得 ${r.status}:${o}`)

  const after = snapshot(dir)
  assert.equal(after.head, before.head, 'HEAD 不得推进:这一档是"不落地"')
  assert.equal(after.indexBlob, before.indexBlob, '主索引里 land.txt 的 blob 不得被对齐到构造内容')
  assert.equal(after.dirty, before.dirty, '工作树脏面不得变化(本器绝不写工作树)')
  assert.equal(after.headText, before.headText, 'HEAD 里的正文必须还是基线那份')

  assert.match(o, /拒绝落地/, '必须明说"拒绝落地",不能只报一句失败')
  assert.match(o, /land\.txt:3.7/, '必须点名文件与行号区间(3–7)')
  assert.ok(o.includes('<<<<<<< HEAD'), '必须给出标记行原文(开头那行)')
  assert.ok(o.includes('>>>>>>> other-branch'), '必须给出标记行原文(结尾那行)')
  assert.match(o, /IHUI_LAND_SKIP_CONFLICT_MARKER_GATE/, '拒绝时必须告知应急出口名')
})

test('T2 strippable(两侧零正文)⇒ 照常落地 + 输出"建议摘除"', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'land.txt'), withTail(STRIPPABLE_TAIL), 'utf8')
  const r = land(dir)
  const o = out(r)
  assert.equal(r.status, 0, `空冲突区不得拦落地,实得 ${r.status}:${o}`)
  assert.match(o, /建议摘除/, '必须打一行"建议摘除"(只报不拦,不许静默)')
  const headText = runGit(dir, ['cat-file', 'blob', 'HEAD:land.txt'])
  assert.ok(headText.includes('<<<<<<< HEAD'), '空区档确实照常落地(标记随之进 HEAD,由建议行提示摘除)')
})

test('T3 无冲突标记 ⇒ 照常落地(回归:闸不误伤)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'land.txt'), withTail('gamma\n'), 'utf8')
  const r = land(dir)
  const o = out(r)
  assert.equal(r.status, 0, `干净内容必须能落,实得 ${r.status}:${o}`)
  assert.match(o, /落地前冲突标记自检:1\/1 路径无 must-block 区/, '干净档必须报数(证明闸真跑过,不是没装)')
  assert.doesNotMatch(o, /建议摘除/)
  assert.ok(
    runGit(dir, ['cat-file', 'blob', 'HEAD:land.txt']).includes('gamma'),
    '内容必须真的进 HEAD',
  )
})

/**
 * T4 逃生口登记:⚠️ 这一例就是"逃生口会让本判据失效"的证据 —— 同一份 must-block 内容在
 * T1 里被拒、在这里被放行。它测的不是"放行是对的",而是"放行**会出声**"(跳过必须留痕),
 * 免得有人在真仓上悄悄设旗再把标记带进 HEAD。
 */
test('T4 逃生口 IHUI_OSL_SKIP_CONFLICT_MARKER_GATE=1 ⇒ must-block 内容照常落地(登记:判据失效)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'land.txt'), withTail(MUST_BLOCK_TAIL), 'utf8')
  const r = land(dir, { extra: { IHUI_OSL_SKIP_CONFLICT_MARKER_GATE: '1' } })
  const o = out(r)
  assert.equal(r.status, 0, `逃生口档必须能落(与 T1 同内容反向),实得 ${r.status}:${o}`)
  assert.match(o, /跳过/, '跳过必须出声(留痕行)')
  assert.match(o, /IHUI_LAND_SKIP_CONFLICT_MARKER_GATE/, '留痕行必须写明是哪个变量让判据失效')
  assert.match(o, /IHUI_OSL_SKIP_CONFLICT_MARKER_GATE=1 视同/, '别名转发必须自己交代,不构成第二个开关')
  assert.ok(
    runGit(dir, ['cat-file', 'blob', 'HEAD:land.txt']).includes('<<<<<<< HEAD'),
    '逃生口生效的证据:冲突标记确实进了 HEAD(这正是"判据失效"的含义)',
  )
})

test('T5 形状锁:闸在源码里,且排在 casUpdateRef( 之前(落地动作之前那一刻)', () => {
  // 用行首锚定,避免"注释里出现过一次"就被当成接线在(变异实测踩到过这一型)。
  const callAt = SRC.search(/^\s*const cgate = gateLandingMarkers\(gateEntries/m)
  const gateAt = callAt
  const casAt = SRC.indexOf('casUpdateRef(commit, head, { root })')
  assert.ok(gateAt > 0, '必须真调用 gateLandingMarkers(gateEntries)(不是只 import 不接)')
  assert.ok(casAt > 0, 'casUpdateRef 调用点必须还在')
  assert.ok(gateAt < casAt, '闸必须排在落地动作之前 —— 排在后面就是事后喊,票面要的是"落地前"')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
