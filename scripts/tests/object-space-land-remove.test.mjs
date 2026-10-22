// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * object-space-land 删除档(LAND_REMOVE_PATHS)的镜像测试 —— G-926 的器物侧。
 *
 * 立项因由(全部现读,不是推理):G-926 的 B 档 58 枚"已跟踪却被 .gitignore 覆盖"的临时件
 * 卡在台账里,题面原话是"拦路的不是判断而是器物:取消跟踪 = 从树里摘路径,而
 * scripts/object-space-land.mjs 结构上表达不了删除",唯一已具备判据的底层是
 * lib/bypass-git.mjs 的 commitTreeWithIndex(`entries:[{path,deleted:true}]`,G-1080881)。
 * 本测试钉的就是"把那条底层能力暴露成声明式出口"这件事本身没走样:
 *
 *  T1  反向自证:删除项问的是"**不在**树里",不是写入档那把"在树里"的尺子
 *      (拿错尺子量删除 ⇒ 一条都没删也能过 —— 2026-10-18 空内容守卫那次事故的同型)
 *  T2  工作树不被动:取消跟踪 ≠ 删盘上文件(否则就是替别人做了一次 rm)
 *  T3  正控:声明摘除后 `git ls-tree` 查不到,且**反向**自证通过
 *  T4  反证:声明一个基线里不在位的路径 ⇒ 拒(底层护栏,不得静默变成"什么都没删")
 *  T5  互斥:同一路径同时出现在 LAND_PATHS 与 LAND_REMOVE_PATHS ⇒ 拒(自相矛盾)
 *  T6  纯删除是合法入口:两边都空才拒,只有 LAND_REMOVE_PATHS 必须放行(G-926 的 58 枚就是零写入)
 *  T7  clobber 同语义:CAS 期间 HEAD 推进而该路径在位性变了 ⇒ 拒绝照旧删
 *  T8  写删混同一次落地:既有写入又有摘除,两条自证各自问各自的方向
 *  T9  形状锁:源码里删除档的接线在位(import 了 commitTreeWithIndex、entries 里有 deleted 项)
 *  T10 器物自证入口:`--self-test` 真跑得通(交付现场没有 node --test 也能问"删除档还在不在")
 *
 * 一律走 mkScratch 临时仓(退出即回收),**不碰真仓**;不跑会写工作树的命令。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as LANDER } from '../object-space-land.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'object-space-land.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')
/**
 * 自含电池的**字面期望**(期望值不许由被测函数生成,否则变异测不出 —— 仓内同族惯例):
 * 落地器 SELF_TEST_PLAN 少一条、改一个 id、或把"必须拒"的例子换成放行,这里立刻红。
 */
const SELF_TEST_PLAN_FOR_TEST = [
  { id: 'ST1', expect: 'accept' },
  { id: 'ST2', expect: 'reject' },
  { id: 'ST3', expect: 'reject' },
  { id: 'ST4', expect: 'accept' },
  { id: 'ST5', expect: 'accept' },
  { id: 'ST6', expect: 'accept' },
  { id: 'ST7', expect: 'reject' },
]
const GIT = resolveGitBin() || 'git'
const RUN_OPTS = { encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] }
const runGit = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args], RUN_OPTS)

/** 造一个三文件临时仓:gone.txt(待摘) / keep.txt(不动) / sub/stay.txt(嵌套路径)。 */
function makeRepo(t) {
  const dir = mkScratch('osl-rm-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  writeFileSync(join(dir, 'gone.txt'), 'to be untracked\n')
  writeFileSync(join(dir, 'keep.txt'), 'keep me\n')
  mkdirSync(join(dir, 'sub'), { recursive: true })
  writeFileSync(join(dir, 'sub', 'stay.txt'), 'stay\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

/**
 * 真跑一次落地。跳过三项在临时仓里判不出的预检(它们各有自己的应急出口与留痕,
 * 与删除档判据正交):水印(临时仓无横幅基线)、悬空引用(closure 未复制)、
 * 门 98(树不是本仓 HEAD)。**暖色描边门不跳** —— G-929 起门体支持 `--root`,
 * 落地器把它透传给门,临时仓的真树真判(射程外 ⇒ 本门不适用 ⇒ 放行)。
 */
function land(dir, { paths = '', remove = '', msg = 'e2e', extra = {} }) {
  const r = spawnSync(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      LAND_ROOT: dir,
      LAND_PATHS: paths,
      LAND_REMOVE_PATHS: remove,
      LAND_MSG: msg,
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
  return r
}

const inTree = (dir, p) => {
  try {
    runGit(dir, ['cat-file', '-e', `HEAD:${p}`])
    return true
  } catch {
    return false
  }
}

test('T1 反向自证:删除项问的是"不在树里"而不是"在树里"(拿错尺子 ⇒ 一条没删也能过)', () => {
  // 源码形状:删除档的自证必须走 present→拒绝、absent→放行 这一族,
  // 而写入档是 absent→拒绝。两把尺子方向相反,这里锁的是"确实存在另一把反向的尺子"。
  assert.match(SRC, /删除档反向自证/, '必须有删除档专属的反向自证段')
  assert.match(SRC, /delFace\.present\.length > 0/, '仍在树里必须判红(不是拿写入档的 absent 当尺子)')
  assert.match(SRC, /✅ 删除档反向自证/, '放行必须打出可读结论,不得静默')
  // 且它问的是删除清单,不是写入清单
  assert.match(SRC, /commitFacePresence\(\{ root, commit: landed, paths: removePaths \}\)/, '反向自证的输入必须是 removePaths')
})

test('T2 工作树不被动:取消跟踪 ≠ 删盘上文件', (t) => {
  const dir = makeRepo(t)
  const r = land(dir, { remove: 'gone.txt' })
  assert.equal(r.status, 0, `纯删除必须成功:${r.stdout}\n${r.stderr}`)
  assert.equal(inTree(dir, 'gone.txt'), false, 'HEAD 树里必须没有它')
  assert.equal(readFileSync(join(dir, 'gone.txt'), 'utf8'), 'to be untracked\n', '盘上文件必须原样还在(取消跟踪不是 rm)')
  assert.equal(inTree(dir, 'keep.txt'), true, '无关文件必须原样在位')
})

test('T3 正控:嵌套路径也能摘,且自证打出来', (t) => {
  const dir = makeRepo(t)
  const r = land(dir, { remove: 'sub/stay.txt' })
  assert.equal(r.status, 0, `应成功:${r.stdout}\n${r.stderr}`)
  assert.equal(inTree(dir, 'sub/stay.txt'), false)
  assert.match(r.stdout, /删除档反向自证 1\/1 路径已不在树/, '自证结论必须可见')
  assert.equal(inTree(dir, 'gone.txt'), true, '未声明的路径必须不动')
})

test('T4 反证:声明一个基线里不在位的路径 ⇒ 拒(不得静默变成"什么都没删")', (t) => {
  const dir = makeRepo(t)
  const headBefore = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const r = land(dir, { remove: 'never-existed.txt' })
  assert.notEqual(r.status, 0, '摘一个不在位路径必须拒绝')
  assert.match(`${r.stdout}${r.stderr}`, /不在位|拒绝|拒/, `拒绝理由必须点名,实得:${r.stdout}${r.stderr}`)
  assert.equal(runGit(dir, ['rev-parse', 'HEAD']).trim(), headBefore, '拒绝路径上 HEAD 不得动')
})

test('T5 互斥:同一路径同时声明写入与删除 ⇒ 拒(自相矛盾)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'gone.txt'), 'changed\n')
  const r = land(dir, { paths: 'gone.txt', remove: 'gone.txt' })
  assert.notEqual(r.status, 0)
  assert.match(`${r.stdout}${r.stderr}`, /自相矛盾/, '必须说清是互斥冲突')
})

test('T6 纯删除是合法入口:只有 LAND_REMOVE_PATHS 必须放行(G-926 的 58 枚就是零写入)', (t) => {
  const dir = makeRepo(t)
  const r = land(dir, { remove: 'gone.txt' })
  assert.equal(r.status, 0, `纯删除必须能落地:${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /删除档 1 路径已摘除/, '报告行必须体现删除档')
})

test('T7 clobber 同语义:CAS 期间 HEAD 推进而该路径在位性变了 ⇒ 拒绝照旧删', (_t) => {
  // 直接验判据面(纯函数),不模拟真实并发(那需要两个落地进程竞争,夹具噪声大):
  // 在位性对账必须同时看 baseRef 与当下 HEAD 两侧。
  assert.match(SRC, /removeBase/, '删除档必须为在位性建基线快照')
  assert.match(SRC, /removeClobber/, '必须有删除档的 clobber 判定')
  assert.match(SRC, /headBlobOf\(head, p, \{ root \}\) !== removeBase\.get\(p\)/, '在位性比对必须是 baseRef 对当下 HEAD')
  assert.match(SRC, /待摘除路径的在位性被别人改过/, '拒绝理由必须点明是哪一档')
})

test('T8 写删混同一次落地:两条自证各问各的方向', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'keep.txt'), 'new content\n')
  const r = land(dir, { paths: 'keep.txt', remove: 'gone.txt' })
  assert.equal(r.status, 0, `混同落地必须成功:${r.stdout}\n${r.stderr}`)
  assert.equal(inTree(dir, 'keep.txt'), true, '写入的路径必须在树里')
  assert.equal(readFileSync(join(dir, 'keep.txt'), 'utf8') === 'new content\n', true, '写入内容必须真落地')
  assert.equal(inTree(dir, 'gone.txt'), false, '删除的路径必须不在树里')
  assert.match(r.stdout, /删除档反向自证 1\/1 路径已不在树/)
})

test('T9 形状锁:源码里删除档的接线在位(import 了底层、entries 里有 deleted 项)', () => {
  assert.match(SRC, /commitTreeWithIndex,/, '必须 import 底层删除档的宿主函数')
  assert.match(SRC, /\{ path: p, deleted: true \}/, 'entries 必须真的带上 deleted 项(不是只在注释里声称)')
  assert.match(SRC, /LAND_REMOVE_PATHS/, 'env 名必须在源码里可寻')
  // 声明面必须并入留痕与混提核查(否则纯删除的落地从旁路台账整批消失)
  assert.match(SRC, /declaredFiles: paths\.concat\(removePaths\)/, '留痕的声明面必须含删除档')
  assert.match(SRC, /!removePaths\.includes\(p\)/, '混提核查必须把删除路径算作已声明')
  // 主索引对齐必须收到删除路径(否则索引留 `D `,下一次普通提交会把死文件加回 HEAD)
  assert.match(SRC, /alignSharedIndex\(\{ root, paths: paths\.concat\(removePaths\)/, '索引对齐必须覆盖删除路径')
})

test('T10 器物自证入口:--self-test 真跑得通,且每条用例都点名(不是空跑)', (_t) => {
  // 票面原话"带 --self-test 与镜像用例"的前半截:交付现场/值守复盘没有 node --test,
  // `node scripts/object-space-land.mjs --self-test` 一条命令必须能自证删除档还在。
  // 它自己造自己的临时仓(走 mkScratch),这里只当调用方:问退出码、问汇总行、问每条用例都在。
  const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `--self-test 必须全绿,实得 rc=${r.status}:${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /self-test: \d+\/\d+ 通过/, '汇总行必须存在')
  const plan = SELF_TEST_PLAN_FOR_TEST
  assert.ok(Array.isArray(plan) && plan.length >= 5, `自含用例清单至少 5 条,实得 ${plan?.length}`)
  // 被测自己导出的清单必须与字面期望**逐条同 id 同期望** —— 否则"把 reject 的例子改成 accept"
  // 这种变异(自证失效的最危险形态)只靠输出里有个 ✅ 是拦不住的
  const actual = LANDER.SELF_TEST_PLAN
  assert.deepEqual(
    actual.map((c) => ({ id: c.id, expect: c.expect })),
    plan,
    'SELF_TEST_PLAN 的 id 与期望必须与字面清单逐条一致(改了就是变异)',
  )
  for (const c of plan) assert.ok(r.stdout.includes(c.id), `汇总输出必须点名 ${c.id}(空跑/漏跑都算坏)`)
  // 反证与互斥两条"必须拒"的用例不能悄悄变成放行(那等于自证失效)
  for (const c of plan.filter((x) => x.expect === 'reject'))
    assert.ok(r.stdout.includes(`✅ ${c.id}`), `拒的例子 ${c.id} 必须真拒(✅),实得输出里找不到它`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
