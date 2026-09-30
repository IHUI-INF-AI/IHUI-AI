// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/object-space-land.mjs(§22c —— 判据函数直接 import,端到端一律 spawn CLI 打临时仓)。
// 票面要求的取证逐条钉死:
//  3. 空清单/空消息必须非零退出(本仓踩过:空 LAND_PATHS 会把 "undefined" 当路径提交);
//  2. 索引对齐的归属纪律:索引==父提交 ⇒ 对齐;索引==别人新暂存 ⇒ 不动并点名;
//  + 防覆盖护栏:任一目标路径在基线与当下 HEAD 之间被别人改过 ⇒ 停,不覆盖;
//  + 声明无差异 ⇒ 事先拒绝(提交面回读结构上证明不了它,"commit message 只能写能被回读证明的东西");
//  + happy path:落地 + 提交面回读 + 主索引对齐三段各有正向断言;
//  + 陈旧落地守卫(2026-09-27 补,同一天一次真实自伤的常驻尺子):
//    T8 盘上副本等于祖先版本且会抹掉基线活行 ⇒ 拒绝并点名祖先;T9 人真删的行 ⇒ 照样能落;
//    T10 LAND_ALLOW_STALE=1 ⇒ 放行且大声留痕;T11 只复活不删除 ⇒ 只报不拦;
//    T12 形状锁:判据只能 import 守门 84 那一份,不得在本器里出现第二份祖先判定;
//    T13 lineDelta 纯函数面:多重集计数 / CRLF 不算删除 / 取不到正文不得折成 0。
// git 写操作只发生在 scripts/lib/scratch-dir.mjs 的临时仓内(§26/§15b 唯一夹具落点),绝不碰真仓。

import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ } from '../object-space-land.mjs'
import { decideBanner } from '../object-space-land.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import { git, headBlobOf, indexBlobOf, writeBlob } from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, '..', 'object-space-land.mjs')
const GIT = resolveGitBin() || 'git'
const runOpts = { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }
const runGit = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args], runOpts)

function makeRepo(t) {
  const dir = mkScratch('osl-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  writeFileSync(join(dir, 'a.txt'), 'v1\n')
  mkdirSync(join(dir, 'sub'), { recursive: true })
  writeFileSync(join(dir, 'sub', 'keep.txt'), 'keep\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

/**
 * 两枚提交的历史:祖先 A 有 old 行,HEAD B 删掉 old 并加了 new 行。
 * 把盘上副本写回 A ⇒ 落地会既**抹掉 B 里活着的 new 行**又**把 old 行搬回来**
 * —— 2026-09-27 那次真实事故的形状(25 行被复活 + 3 行被抹掉)。
 */
function makeTwoCommitRepo(t, { oldText, newText }) {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'pack.txt'), oldText)
  runGit(dir, ['add', '--', 'pack.txt'])
  runGit(dir, ['commit', '-q', '-m', 'A: 旧形态'])
  const ancestor = runGit(dir, ['rev-parse', 'HEAD']).trim()
  writeFileSync(join(dir, 'pack.txt'), newText)
  runGit(dir, ['add', '--', 'pack.txt'])
  runGit(dir, ['commit', '-q', '-m', 'B: 别人删了旧行、加了新行'])
  return { dir, ancestor9: ancestor.slice(0, 9) }
}

/**
 * 事故原形(2026-09-28 登记的 `c99b163ee5` 那一型):祖先 A 有 5 行 quit* 键,
 * HEAD B 把它们合法删掉并加了 cancel;调用方在**滞后的 A 副本**上又加了一行真新键。
 * ⇒ 落地内容 = `A ⊕ 新行`,逐字节不等于任何祖先 ⇒ 整 blob 判据永不命中,只有行级复活看得见。
 */
const LOCALE_A = [
  '{',
  '  "checkUpdate": "检查更新",',
  '  "quitChecking": "正在检查更新",',
  '  "quitDownloading": "正在下载更新",',
  '  "quitQuitting": "正在退出",',
  '  "quitRestarting": "正在重启",',
  '  "quitSkip": "跳过更新",',
  '  "settings": "设置"',
  '}',
  '',
].join('\n')
const LOCALE_B = [
  '{',
  '  "checkUpdate": "检查更新",',
  '  "cancel": "取消",',
  '  "settings": "设置"',
  '}',
  '',
].join('\n')
const NEW_KEY_LINE = '  "formChannelUnavailable": "该表单暂不可用",'

function makeLocaleRepo(t) {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'locale.json'), LOCALE_A)
  runGit(dir, ['add', '--', 'locale.json'])
  runGit(dir, ['commit', '-q', '-m', 'A: 含 5 行 quit* 文案'])
  const ancestor = runGit(dir, ['rev-parse', 'HEAD']).trim()
  writeFileSync(join(dir, 'locale.json'), LOCALE_B)
  runGit(dir, ['add', '--', 'locale.json'])
  runGit(dir, ['commit', '-q', '-m', 'B: 按 KR 合法删掉 quit*,加了 cancel'])
  return { dir, ancestor9: ancestor.slice(0, 9) }
}

function runLand(dir, { paths = '', msg = 'chore: e2e land', baseRef, allowStale, blobs, proof, jsonStructure } = {}) {
  const env = { ...process.env, LAND_ROOT: dir, LAND_PATHS: paths, LAND_MSG: msg }
  if (baseRef) env.LAND_BASE_REF = baseRef
  else delete env.LAND_BASE_REF
  if (allowStale) env.LAND_ALLOW_STALE = '1'
  else delete env.LAND_ALLOW_STALE
  // G-816037 的结构档必须**默认关闭**:不带这面旗时行为与加档前逐字同形(T-JS-3 钉这一条)。
  if (jsonStructure) env.LAND_JSON_STRUCTURE = '1'
  else delete env.LAND_JSON_STRUCTURE
  if (blobs) {
    env.LAND_BLOBS = writeFileSync(join(dir, '.blobs.json'), JSON.stringify({ files: blobs })) || join(dir, '.blobs.json')
    env.LAND_BLOB_PROOF = proof || 'e2e 取证:构造内容只动本票行'
  } else {
    delete env.LAND_BLOBS
    delete env.LAND_BLOB_PROOF
  }
  return spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20 })
}

test('T1 §22c 导出面:判据函数必须在 __test__ 里', () => {
  for (const k of ['parseArgs', 'clobberedPaths', 'lineDelta', 'resurrectAnalysis', 'detectStaleLanding', 'jsonStructuralSuperset', 'staleReport', 'commitFacePresence'])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
})

test('T2 happy path:落地 ⇒ 提交面回读 + 主索引对齐(新文件不留幽灵 D)', (t) => {
  const dir = makeRepo(t)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  writeFileSync(join(dir, 'a.txt'), 'v3\n')
  writeFileSync(join(dir, 'b.txt'), 'brand-new\n')
  const r = runLand(dir, { paths: 'a.txt;b.txt' })
  assert.equal(r.status, 0, `应成功,实得 ${r.status}:${r.stderr}`)
  assert.match(r.stdout, /提交面回读 2\/2 路径在树/)
  assert.match(r.stdout, /主索引已对齐 2\/2 路径/)
  const head = git(['rev-parse', 'HEAD'], { root: dir })
  assert.notEqual(head, before, 'HEAD 必须前进')
  assert.equal(headBlobOf(head, 'a.txt', { root: dir }), writeBlob('v3\n', { root: dir }))
  assert.notEqual(headBlobOf(head, 'b.txt', { root: dir }), 'ABSENT')
  assert.equal(headBlobOf(head, 'sub/keep.txt', { root: dir }), headBlobOf(before, 'sub/keep.txt', { root: dir }), '非声明路径必须原样')
  assert.equal(indexBlobOf('a.txt', { root: dir }), headBlobOf(head, 'a.txt', { root: dir }), '主索引必须对齐到新 blob')
  assert.notEqual(indexBlobOf('b.txt', { root: dir }), 'ABSENT', '新文件不得留在"暂存删除"形态')
})

test('T3 空清单 / 空消息 ⇒ 非零退出(2)且 HEAD 不动(本仓踩过把 undefined 当路径提交)', (t) => {
  const dir = makeRepo(t)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r1 = runLand(dir, { paths: '', msg: 'x' })
  assert.equal(r1.status, 2)
  assert.match(r1.stderr, /LAND_PATHS/)
  const r2 = runLand(dir, { paths: 'a.txt', msg: '' })
  assert.equal(r2.status, 2)
  assert.match(r2.stderr, /LAND_MSG/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before, '拒绝路径上 HEAD 必须一步没动')
})

test('T4 防覆盖护栏:目标路径在基线与当下 HEAD 之间被别人改过 ⇒ 拒绝落地并点名(LAND_BASE_REF 是造该现场的取证通道)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'a.txt'), 'v2-theirs\n')
  runGit(dir, ['add', '--', 'a.txt'])
  runGit(dir, ['commit', '-q', '-m', 'theirs']) // 别人把 a.txt 推进到 v2
  const theirsHead = git(['rev-parse', 'HEAD'], { root: dir })
  writeFileSync(join(dir, 'a.txt'), 'v3-mine\n')
  const r = runLand(dir, { paths: 'a.txt', baseRef: 'HEAD^' }) // 我方误按旧基线(v1)登记
  assert.equal(r.status, 1, `护栏必须拦,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.match(r.stderr + r.stdout, /被别人改过/)
  assert.match(r.stderr + r.stdout, /a\.txt/, '必须点名是哪条路径')
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), theirsHead, 'HEAD 必须仍停在别人的提交上(未新增落地提交)')
  assert.equal(headBlobOf('HEAD', 'a.txt', { root: dir }), writeBlob('v2-theirs\n', { root: dir }), '别人的 v2 不得被覆盖')
})

test('T5 声明无差异 ⇒ 事先拒绝(提交面回读永远证不了"改了它")', (t) => {
  const dir = makeRepo(t)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLand(dir, { paths: 'a.txt', msg: 'chore: no-op' }) // 盘上 a.txt == HEAD 的 v1
  assert.equal(r.status, 1)
  assert.match(r.stderr, /逐字节相同|无差异/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before)
})

test('T6 归属纪律端到端:索引==别人新暂存 ⇒ 落地成功但对齐不动该路径并点名"归属他人"', (t) => {
  const dir = makeRepo(t)
  // 现场:HEAD=v1;索引被别人暂存成 v2;盘上 v3(我要落的正是 v3)
  writeFileSync(join(dir, 'a.txt'), 'v2\n')
  runGit(dir, ['add', '--', 'a.txt'])
  writeFileSync(join(dir, 'a.txt'), 'v3\n')
  const foreign = indexBlobOf('a.txt', { root: dir })
  const r = runLand(dir, { paths: 'a.txt' })
  assert.equal(r.status, 0, `落地本身应成功:${r.stderr}`)
  assert.match(r.stdout, /未动\(归属他人\)[\s\S]*a\.txt/)
  assert.equal(indexBlobOf('a.txt', { root: dir }), foreign, '别人暂存的 v2 必须原样留在索引里')
  assert.equal(headBlobOf('HEAD', 'a.txt', { root: dir }), writeBlob('v3\n', { root: dir }), '提交面照落 v3')
})

test('T7 parseArgs 纯函数面:同一 env 两次调用结论一致(连跑不漂移的最小证明)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'b.txt'), 'nb\n')
  const envA = { LAND_PATHS: ' a.txt ; b.txt ', LAND_MSG: 'm', LAND_ROOT: dir }
  const a1 = __test__.parseArgs(envA)
  const a2 = __test__.parseArgs(envA)
  assert.equal(a1.error, undefined, `应通过,实得:${a1.error}`)
  assert.deepEqual(a2.paths, ['a.txt', 'b.txt'])
  assert.equal(a1.paths.join(','), a2.paths.join(','))
  const noPaths = __test__.parseArgs({ LAND_MSG: 'm', LAND_ROOT: dir })
  assert.match(String(noPaths.error), /LAND_PATHS/)
  const noMsg = __test__.parseArgs({ LAND_PATHS: 'a.txt', LAND_ROOT: dir })
  assert.match(String(noMsg.error), /LAND_MSG/)
  const notRepo = __test__.parseArgs({ LAND_PATHS: 'a.txt', LAND_MSG: 'm', LAND_ROOT: mkScratch('osl-notrepo-') })
  assert.match(String(notRepo.error), /不是可用仓库/)
})

const OLD_FORM = 'lineA\nlineB\nlineC\n'
const NEW_FORM = 'lineA\nlineD\nlineE\n'

test('T8 陈旧落地(a):盘上副本等于祖先版本且会抹掉基线活行 ⇒ 拒绝、点名祖先、报出消失/重现行数', (t) => {
  const { dir, ancestor9 } = makeTwoCommitRepo(t, { oldText: OLD_FORM, newText: NEW_FORM })
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  writeFileSync(join(dir, 'pack.txt'), OLD_FORM) // 滞后的磁盘副本 == 提交 A
  const r = runLand(dir, { paths: 'pack.txt', msg: 'chore: stale land' })
  assert.equal(r.status, 1, `守卫必须拦,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  const out = r.stderr + r.stdout
  assert.match(out, /陈旧落地守卫/)
  assert.ok(out.includes(ancestor9), `必须点名被回到的那枚祖先 ${ancestor9},实得:\n${out}`)
  assert.match(out, /pack\.txt/)
  assert.match(out, /消失 2 行/)
  assert.match(out, /重现 2 行/)
  assert.match(out, /消失: lineD/, '必须给出有界的样例行,不能只报数')
  assert.match(out, /重现: lineB/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before, '拒绝路径上 HEAD 必须一步没动')
  assert.equal(headBlobOf('HEAD', 'pack.txt', { root: dir }), writeBlob(NEW_FORM, { root: dir }), '别人的 B 形态不得被动过')
})

test('T9 陈旧落地(b)反向对照:人真删掉的行(内容不等于任何祖先)⇒ 必须照样落地', (t) => {
  const { dir } = makeTwoCommitRepo(t, { oldText: OLD_FORM, newText: NEW_FORM })
  // 删掉 B 里两行活内容,但这份组合从未作为整体提交过 ⇒ 判据不认领,不得把人自己的删除拦成"陈旧"
  writeFileSync(join(dir, 'pack.txt'), 'lineA\nlineD\n')
  const r = runLand(dir, { paths: 'pack.txt', msg: 'chore: honest deletion' })
  assert.equal(r.status, 0, `真删除必须能落,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.equal(headBlobOf('HEAD', 'pack.txt', { root: dir }), writeBlob('lineA\nlineD\n', { root: dir }))
})

test('T10 陈旧落地(c):LAND_ALLOW_STALE=1 ⇒ 放行、大声留痕、逐条点名被回写的路径', (t) => {
  const { dir, ancestor9 } = makeTwoCommitRepo(t, { oldText: OLD_FORM, newText: NEW_FORM })
  writeFileSync(join(dir, 'pack.txt'), OLD_FORM)
  const r = runLand(dir, { paths: 'pack.txt', msg: 'chore: intentional regeneration', allowStale: true })
  assert.equal(r.status, 0, `显式放行必须能落,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /LAND_ALLOW_STALE=1/, '放行必须打印留痕行(不得静默落地)')
  assert.match(r.stdout, /放行 1 处陈旧落地/)
  assert.ok(r.stdout.includes(ancestor9), '放行时同样要点名祖先,便于事后归因')
  assert.equal(headBlobOf('HEAD', 'pack.txt', { root: dir }), writeBlob(OLD_FORM, { root: dir }), '放行后确实按盘上内容落了')
})

test('T11 陈旧落地(d)【2026-09-28 重新定性】:内容等于祖先、相对基线**零消失**但复活了行 ⇒ 必须拒绝', (t) => {
  // 本条原断言"只复活不删除 ⇒ 只报不拦"(status 0)。那个前提是错的:**把基线已删的内容搬回来**
  // 本身就是伤害,不要求同时有人被抹掉。夹具行也按事故的形态写实(证据行有 12 字符门槛,
  // 原来那对 `lineA`/`lineB` 短行按判据根本不算证据 —— 用它断言"复活"会测到一台判据的反面)。
  const OLD_FORM = 'title: 更新检查\nquitChecking: 正在检查更新\nsettings: 设置\n'
  const NEW_FORM = 'title: 更新检查\nsettings: 设置\n'
  const { dir, ancestor9 } = makeTwoCommitRepo(t, { oldText: OLD_FORM, newText: NEW_FORM })
  writeFileSync(join(dir, 'pack.txt'), OLD_FORM) // == 祖先;基线的两行一行没被抹掉
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLand(dir, { paths: 'pack.txt', msg: 'chore: resurrect only' })
  const out = r.stderr + r.stdout
  assert.equal(r.status, 1, `复活他人删掉的行必须拦,实得 ${r.status}:${out}`)
  assert.match(out, /陈旧落地守卫/)
  assert.match(out, /复活 1 行/)
  assert.match(out, /消失 0 行/)
  assert.ok(out.includes(ancestor9), '必须点名复活内容出自哪枚祖先')
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before, '拒绝路径上 HEAD 必须一步没动')
})

test('T11b "只报不拦"那一支仍必须可达(否则等于把它偷偷删掉):等于祖先、零消失、只多一行空行', (t) => {
  // 空行/纯标点不构成"复活证据"(见 resurrectAnalysis 的噪声行边界),所以这条仍只报不拦。
  const { dir, ancestor9 } = makeTwoCommitRepo(t, { oldText: 'x\n\n', newText: 'x\n' })
  writeFileSync(join(dir, 'pack.txt'), 'x\n\n')
  const r = runLand(dir, { paths: 'pack.txt', msg: 'chore: noise-only resurrection' })
  assert.equal(r.status, 0, `只多一个空行不该拦,实得 ${r.status}:${r.stderr}|${r.stdout}`)
  assert.match(r.stdout, /只报不拦/)
  assert.match(r.stdout, /只增 1 行/)
  assert.ok(r.stdout.includes(ancestor9), '只报不拦也要点名祖先')
})

test('T12 形状锁:祖先判定与祖先窗口只能各引守门 84 那一份,本器内不得出现第二份实现(§3"两处算同一件事必漂移")', () => {
  const src = readFileSync(TOOL, 'utf8')
  const code = maskCommentsAndStrings(src) // 判"实现"要看遮掉注释/字符串后的代码面,否则说明性文字会被判成违规
  assert.match(
    src,
    /import\s*\{[^}]*\banalyze\b[^}]*\}\s*from\s*['"]\.\/check-stale-revert\.mjs['"]/,
    '必须从守门 84 import 那一份判定,而不是各写一份',
  )
  assert.match(code, /staleAncestorAnalysis\s*\(/, 'import 了却没调用 = 判据仍是自写的(假接线)')
  for (const secondImpl of [/function\s+analyze\b/, /function\s+ancestorCommits\b/, /\bANCESTOR_WINDOW\b/])
    assert.ok(!secondImpl.test(code), `出现第二份祖先判定的形状:${secondImpl}`)
  for (const rawOnly of [/--find-object/, /\[\s*['"]log['"]\s*,/])
    assert.ok(!rawOnly.test(src), `本器自己派生 git 找祖先(那正是守门 84 的活):${rawOnly}`)
  // ── 行级复活那一支的三条同源锁(2026-09-28 补;同日判据提取到 lib 后**改的是位置,不是松紧**)──
  assert.match(src, /import\s*\{[^}]*\bancestorCommits\b[^}]*\}\s*from\s*['"]\.\/check-stale-revert\.mjs['"]/,
    '祖先窗口必须走守门 84 的 ancestorCommits 出口(窗口长度住在它内部),不得在本器另立数字')
  assert.match(code, /ancestorCommits\s*\(/, 'import 了窗口出口却没调用 = 行级判据拿的是自造清单(假接线)')
  assert.ok(!/max-count\s*=/.test(src), '本器自己数祖先窗口(出现 --max-count=)就是第二份窗口阈值')
  /**
   * 剥尾 `\r` 的计行口径**仍然只能有一份** —— 2026-09-28 起那一份住在
   * `scripts/lib/stale-content-analysis.mjs`(守门 84 的 R1r 与本器共用),所以本器里必须是 **0 处**。
   * 原先这里断言"本器内恰好 1 处":那是提取**之前**的唯一合法形状,提取之后照旧断言 1 就等于
   * 要求本器再抄一份实现 —— 那正是这条锁要禁的东西。断言的**对象**(计数口径只能有一份)没变,
   * 变的是"那一份在哪";两侧都被钉死(本器 0 + lib 恰好 1),比改短之前更严,不是放宽。
   */
  assert.equal(
    (code.match(/replace\(\/\\r\$\//g) ?? []).length,
    0,
    '计行口径已提取到 lib:本器内不得再出现任何一处剥尾 \\r(出现即为第二份实现)',
  )
  assert.equal(
    (readFileSync(join(HERE, '..', 'lib', 'stale-content-analysis.mjs'), 'utf8').match(/replace\(\/\\r\$\//g) ?? []).length,
    1,
    'lib 里必须**恰好**一处剥尾 \\r(linesOf);0 处=判据没落地,2 处=同一文件里又分了叉',
  )
  assert.match(
    src,
    /import\s*\{[^}]*\bresurrectAnalysis\b[^}]*\}\s*from\s*['"]\.\/lib\/stale-content-analysis\.mjs['"]/,
    '行级复活判据必须从 lib import(与守门 84 的 R1r 同源)',
  )
  for (const moved of [/function\s+linesOf\b/, /function\s+tallyLines\b/, /function\s+resurrectAnalysis\b/, /function\s+lineDelta\b/])
    assert.ok(!moved.test(code), `已提取到 lib 的实现不得在本器重新出现:${moved}`)
  assert.match(code, /catBatch\s*\(/, '祖先正文必须走 face-reader 的批量读取口(守门 118 的取材面纪律),不得逐 blob 派生')
})

/**
 * T18 —— 同一性锁(比形状锁更有牙的一条):本器 `__test__` 里那两个函数**必须就是 lib 的同一对象**。
 * 形状锁只能证明源码里没有第二份"形状";拷贝一份再改名可以绕过它。函数标识符同一 ⇒ 结构上不可能
 * 存在第二份实现(两道判据对同一次落地给出不同结论这一型被排除在类型之外,而不是靠人自觉)。
 */
test('T18 同一性:本器用的复活/计行判据必须与 lib 是同一个函数对象(不是复制品)', async () => {
  const lib = await import('../lib/stale-content-analysis.mjs')
  assert.equal(__test__.resurrectAnalysis, lib.resurrectAnalysis, 'resurrectAnalysis 必须是 lib 的那一个')
  assert.equal(__test__.lineDelta, lib.lineDelta, 'lineDelta 必须是 lib 的那一个')
  // 守门 84 那一侧也必须是同一个函数对象(它经由自己的 import 引 lib;两条门各自持有拷贝就是漂移的起点)
  const gate = await import('../check-stale-revert.mjs')
  const gateSrc = readFileSync(join(HERE, '..', 'check-stale-revert.mjs'), 'utf8')
  assert.match(gateSrc, /from\s*['"]\.\/lib\/stale-content-analysis\.mjs['"]/, '守门 84 必须引 lib 那一份')
  assert.equal(typeof gate.__test__.analyzeResurrect, 'function', 'R1r 出口必须在位(不在即红,不得写成 ?? 兜底)')
  // 三态语义在 lib 层也被钉一次(与 T16 的构造面同源,防提取时把某一态写丢)
  assert.equal(lib.resurrectAnalysis({ baseText: 'a\n', newText: 'a\n', ancestors: [] }).status, 'out-of-scope')
  assert.equal(lib.resurrectAnalysis({ baseText: null, newText: 'a\n', ancestors: [{ commit: 'c', text: 'a\n' }] }).status, 'undetermined')
  assert.equal(lib.resurrectAnalysis({ baseText: 'a\n', newText: 'a\n', ancestors: [{ commit: 'c', text: 'a\n' }] }).status, 'judged')
})


test('T13 lineDelta 纯函数面:多重集计数 / CRLF 不算删除 / 取不到正文不得折成 0', () => {
  const d = __test__.lineDelta('a\nb\nc\n', 'a\nc\n')
  assert.equal(d.vanished, 1)
  assert.equal(d.appeared, 0)
  assert.deepEqual(d.vanishedSample, ['b'])
  // 同一行出现两次、落地只剩一次 ⇒ 计 1 行消失(位置对齐式 diff 会把它算成 0 或整段搬家)
  assert.equal(__test__.lineDelta('x\nx\ny\n', 'x\ny\n').vanished, 1)
  // 工作树常是 CRLF 而 blob 是 LF:不剥尾 \r 会把"每一行"报成被删(守门 13c 同型)
  const crlf = __test__.lineDelta('a\nb\n', 'a\r\nb\r\n')
  assert.equal(crlf.vanished, 0)
  assert.equal(crlf.appeared, 0)
  // 文末换行符不是一行:否则"只是少个行尾换行"会凭空多出 1 行消失 ⇒ 该放行的被拒(假阳)
  const eol = __test__.lineDelta('a\nb\n', 'a\nb')
  assert.equal(eol.vanished, 0)
  assert.equal(eol.appeared, 0)
  // 量不到 ≠ 没有:必须是 null,由调用方按未判定处理
  const none = __test__.lineDelta(null, 'a\n')
  assert.equal(none.vanished, null)
  assert.equal(none.appeared, null)
  // 采样有界:不把终端刷成一份完整 diff
  assert.equal(__test__.lineDelta(Array.from({ length: 40 }, (_, i) => `l${i}`).join('\n'), '').vanished, 40)
  assert.equal(__test__.lineDelta(Array.from({ length: 40 }, (_, i) => `l${i}`).join('\n'), '').appearedSample.length, 0)
})

/**
 * T14 —— **本票存在的全部理由**:整 blob 判据对"陈旧副本 ⊕ 真改动"结构失明,行级复活判据看得见。
 * 两臂成对(同一条判据、只差那一行复活内容),两臂同色就说明判据是装饰品。
 */
test('T14 事故形状:祖先副本 ⊕ 一行真新键 ⇒ 必须拒绝并点名祖先;只留真新键 ⇒ 必须放行', (t) => {
  const { dir, ancestor9 } = makeLocaleRepo(t)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const stalePlusEdit = LOCALE_A.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`)
  // 先证明整 blob 那一支确实**看不见**这一型(不是"两道判据都红,所以说不清是谁拦的")
  assert.deepEqual(
    __test__.detectStaleLanding({ root: dir, paths: ['locale.json'] }).offenders.length,
    0,
    '夹具不对:盘上仍是 HEAD 形态时无 offenders,谈不上证明',
  )
  writeFileSync(join(dir, 'locale.json'), stalePlusEdit)

  const g = __test__.detectStaleLanding({ root: dir, paths: ['locale.json'] })
  assert.equal(g.ok, false, '行级复活必须判为 offenders')
  assert.equal(g.offenders.length, 1)
  const [o] = g.offenders
  assert.equal(o.path, 'locale.json')
  assert.equal(o.commit, null, '内容不等于任何祖先 ⇒ 整 blob 那一支给不出 sha(这就是它失明之处)')
  assert.equal(o.resurrected, 5, '五条 quit* 文案都在 A 里、都不在 HEAD 里 ⇒ 复活 5 行')
  assert.equal(o.vanished, 1, 'HEAD 里的 cancel 会被抹掉 ⇒ 消失 1 行')
  assert.equal(o.appeared, 6, '五条复活 + 一条真新键')
  assert.ok(o.resurrectedBy.includes(ancestor9), `必须点名复活内容出自哪枚祖先,实得 ${o.resurrectedBy}`)
  assert.ok(
    o.resurrectedSample.every((l) => l.includes('quit')),
    `复活样例只能是被搬回的旧文案,实得 ${JSON.stringify(o.resurrectedSample)}`,
  )
  assert.ok(
    !o.resurrectedSample.some((l) => l.includes('formChannelUnavailable')),
    '真新键**不得**被算成复活 —— 那是 ①② 成立而 ③ 不成立的那一类',
  )
  assert.equal(o.lineStatus, 'judged', '这一条必须是量到的结论,不是未判定')

  const r = runLand(dir, { paths: 'locale.json', msg: 'chore: incident shape' })
  const out = r.stderr + r.stdout
  assert.equal(r.status, 1, `守卫必须拦,实得 ${r.status}:${out}`)
  assert.match(out, /陈旧落地守卫/)
  assert.match(out, /locale\.json/)
  assert.match(out, /内容不等于任何祖先/)
  assert.match(out, /复活 5 行/)
  assert.match(out, /↺ 复活: .*quitChecking/)
  assert.ok(out.includes(ancestor9))
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before, '拒绝路径上 HEAD 必须一步没动')

  // 反向臂:只删掉那 5 行复活内容、**保留**真新键 ⇒ 同一条判据必须放行
  writeFileSync(join(dir, 'locale.json'), LOCALE_B.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`))
  const r2 = runLand(dir, { paths: 'locale.json', msg: 'chore: honest edit only' })
  assert.equal(r2.status, 0, `只加真新行必须能落,实得 ${r2.status}:${r2.stderr}|${r2.stdout}`)
  assert.match(r2.stdout, /提交面回读 1\/1 路径在树/)
  assert.ok(
    headBlobOf('HEAD', 'locale.json', { root: dir }) === writeBlob(LOCALE_B.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`), { root: dir }),
    '落地内容必须就是那份"HEAD ⊕ 真新键"',
  )
})

test('T15 事故形状 + LAND_ALLOW_STALE=1 ⇒ 放行、大声留痕、把放过的条数报出来', (t) => {
  const { dir, ancestor9 } = makeLocaleRepo(t)
  writeFileSync(join(dir, 'locale.json'), LOCALE_A.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`))
  const r = runLand(dir, { paths: 'locale.json', msg: 'chore: intentional', allowStale: true })
  assert.equal(r.status, 0, `显式放行必须能落,实得 ${r.status}:${r.stderr}|${r.stdout}`)
  assert.match(r.stdout, /LAND_ALLOW_STALE=1/, '放行必须打印留痕行')
  assert.match(r.stdout, /放行 1 处陈旧落地/)
  assert.match(r.stdout, /复活 5 行/, '放行时同样要枚举放过了什么')
  assert.ok(r.stdout.includes(ancestor9), '放行时也要点名祖先,便于事后归因')
})

test('T16 resurrectAnalysis 纯函数面:三态不并桶 + 多重集取 min + 噪声行不当证据', () => {
  // 行都写成事故里那种"够长的内容行"(证据行有 12 字符门槛,见 RESURRECT_MIN_LINE_LEN 旁的量算记录)
  const L1 = 'alpha_key: 检查更新'
  const L2 = 'beta_key: 正在下载更新'
  const L3 = 'gamma_key: 正在退出应用'
  const A = { commit: 'aaaaaaaaa', text: `${L1}\n${L2}\n` }
  // judged:①②③ 齐 ⇒ 计数,③ 不成立 ⇒ 0(这一对就是 T14 两臂的构造面版本)
  assert.deepEqual(
    pick(__test__.resurrectAnalysis({ baseText: `${L1}\n`, newText: `${L1}\n${L2}\n${L3}\n`, ancestors: [A] })),
    { status: 'judged', count: 1, commits: ['aaaaaaaaa'] },
  )
  // 同一行落地加了 3 份、祖先只有 1 份 ⇒ 只算 1 份旧账,另 2 份是真新内容(不得把新账算成旧账)
  const K = 'key_multi: 值一'
  assert.equal(
    __test__.resurrectAnalysis({ baseText: 'x: 1\n', newText: `${K}\n${K}\n${K}\n`, ancestors: [{ commit: 'c', text: `${K}\n` }] }).count,
    1,
  )
  // 多个祖先各含一部分 ⇒ 出处逐枚报名(报告要能指到至少一枚,这里两枚都点名)
  const P = 'papa_key: 值甲一'
  const Q = 'quebec_key: 值乙一'
  const two = __test__.resurrectAnalysis({
    baseText: '{\n',
    newText: `{\n${P}\n${Q}\n`,
    ancestors: [{ commit: 'c1', text: `{\n${P}\n` }, { commit: 'c2', text: `{\n${Q}\n` }],
  })
  assert.equal(two.count, 2)
  assert.deepEqual(two.commits, ['c1', 'c2'])
  // 噪声行不算证据,两条门槛各钉一条(都是真仓量出来的,不是审美):
  //  ① 不含字母的行(空行 / 纯标点)  ② 含字母但短于 12 字符的骨架行(`return (` = 9)
  assert.equal(__test__.resurrectAnalysis({ baseText: 'a\n', newText: 'a\n\n  },\n  {  }\n', ancestors: [{ commit: 'c', text: 'a\n\n  },\n  {  }\n' }] }).count, 0)
  assert.equal(__test__.resurrectAnalysis({ baseText: 'x: 1\n', newText: 'x: 1\nreturn (\n', ancestors: [{ commit: 'c', text: 'x: 1\nreturn (\n' }] }).count, 0)
  // 同样带词、够长的行被搬回来就是证据 —— 与上一条只差长度,证明门槛真的在生效
  assert.equal(__test__.resurrectAnalysis({ baseText: 'x: 1\n', newText: 'x: 1\nquitChecking: 正在检查\n', ancestors: [{ commit: 'c', text: 'x: 1\nquitChecking: 正在检查\n' }] }).count, 1)
  // 三态分得清清楚楚:**判据该跑而没跑成** = undetermined(调用方按拒绝处理);
  // **按定义不在这条规则射程** = out-of-scope(不拒,但逐条报名)。两种都不能被读成"通过"。
  assert.equal(__test__.resurrectAnalysis({ baseText: 'a\n', newText: 'a\nbeta_key: 值\n', ancestors: [] }).status, 'out-of-scope')
  assert.equal(__test__.resurrectAnalysis({ baseText: 'a\n', newText: 'a\nbeta_key: 值\n', ancestors: [{ commit: 'c', text: null }] }).status, 'undetermined')
  assert.equal(__test__.resurrectAnalysis({ baseText: null, newText: 'a\nbeta_key: 值\n', ancestors: [A] }).status, 'undetermined')
  const big = __test__.resurrectAnalysis({ baseText: 'a\n', newText: `a\n${NEW_KEY_LINE}\n`, ancestors: [A], maxBlobBytes: 8 })
  assert.equal(big.status, 'out-of-scope', '尺寸护栏是"不覆盖",不是"判不过"—— 否则 PROJECT_PLAN.md 这类大文件每次落地都必红')
  assert.equal(big.count, null, '未覆盖的份数必须是 null,不是 0 —— 0 会被下游读成"查过了,干净"')
  // 二进制正文:行级判据按定义不适用 ⇒ out-of-scope(与"读不到"分两态)
  const bin = __test__.resurrectAnalysis({ baseText: 'a\n', newText: null, ancestors: [A] })
  assert.equal(bin.status, 'out-of-scope')
  assert.equal(bin.count, null)
  // 采样有界(行仍要过 12 字符门槛,否则一条都不算证据、这个"有界"就测不到东西)
  const many = Array.from({ length: 20 }, (_, i) => `key_num_${i}: 值${i}一`)
  assert.equal(
    __test__.resurrectAnalysis({
      baseText: '{\n',
      newText: `{\n${many.join('\n')}\n`,
      ancestors: [{ commit: 'c', text: `{\n${many.join('\n')}\n` }],
    }).sample.length,
    8,
  )

  function pick(r) {
    return { status: r.status, count: r.count, commits: r.commits }
  }
})

/**
 * T17 "未覆盖"这一维:二进制正文的行级判据按定义不成立 ⇒ **不拦**,但必须逐条报名 + 汇总喊"未覆盖 ≠ 通过"。
 * 反证方向:如果这一型改成拒绝,本器对 `PROJECT_PLAN.md` / `README.md` / 位图这类常态路径就每台每次必红,
 * 唯一出路是大家长期带 LAND_ALLOW_STALE=1 跑它 —— 那连事故那一型也一起放行(AGENTS §12e 恒红门同型)。
 */
test('T17 未覆盖(二进制):照样落地,但报告必须点名"未覆盖 ≠ 通过"', (t) => {
  const dir = makeRepo(t)
  const BIN_A = `HDR\nquitChecking: 正在检查更新\n\0\n`
  const BIN_B = `HDR\n\0\n`
  writeFileSync(join(dir, 'asset.txt'), BIN_A)
  runGit(dir, ['add', '--', 'asset.txt'])
  runGit(dir, ['commit', '-q', '-m', 'A: 二进制里带一行文案'])
  const ancestor9 = runGit(dir, ['rev-parse', 'HEAD']).trim().slice(0, 9)
  writeFileSync(join(dir, 'asset.txt'), BIN_B)
  runGit(dir, ['add', '--', 'asset.txt'])
  runGit(dir, ['commit', '-q', '-m', 'B: 删掉那行文案'])
  // 盘上 = 祖先副本 ⊕ 真新行(与事故同形),但正文含 NUL ⇒ 行级判据不覆盖它
  void ancestor9
  writeFileSync(join(dir, 'asset.txt'), BIN_A.replace('HDR\n', 'HDR\nnewest_key: 真新增加的一行\n'))
  const r = runLand(dir, { paths: 'asset.txt', msg: 'chore: binary payload' })
  assert.equal(r.status, 0, `未覆盖不得变成拒绝,实得 ${r.status}:${r.stderr}|${r.stdout}`)
  assert.match(r.stdout, /行级复活判据未覆盖此路径/, '必须逐条报名是哪个路径没被行级判据覆盖')
  assert.match(r.stdout, /未覆盖 ≠ 通过/, '汇总行必须写清"没判"不等于"判过了"')
  assert.match(r.stdout, /提交面回读 1\/1 路径在树/)
})

/**
 * ── blob 模式(2026-09-29 补)─────────────────────────────────────────────
 * 立因:共享工作树里"同一文件不同行"的并发编辑已是常态 —— 别人在同一批头像行上写
 * 已废除的豁免标记时,**交工作树字节就是替别人落地**。那种情况下合法内容只能是
 * `HEAD ⊕ 本票行`,它只存在于对象空间。
 * 盘上取材的两道陈旧守卫(整 blob 相等、行级复活)在这里结构上不适用:它们比的是盘上那份。
 * 所以这一组用例分三类各钉一条:① 少了替代证据直接拒落(不得静默当"少一道无所谓");
 * ② 阳性对照:构造内容恰等于祖先版本必须判红 —— 没有这条,新守卫可以恒绿;
 * ③ 端到端:落地成功且**绝不改写工作树**(盘上那份还是别人的内容)。
 */
function hashText(dir, text) {
  const tmp = join(dir, '.blob-src.tmp')
  writeFileSync(tmp, text)
  try {
    return runGit(dir, ['hash-object', '-w', '.blob-src.tmp']).trim()
  } finally {
    // 用 rmSync 而不是再派一个 node 进程去删:派生进程在 Windows 下要走 windowsHide,
    // 而这里删一个文件不值得再引入一个派生点(守门 52 的射程就是逐点补不全那一型)。
    rmSync(tmp, { force: true })
  }
}

function runLandBlob(dir, { paths, manifest, proof = 'e2e 构造证明', msg = 'chore: blob 模式落地' } = {}) {
  const env = { ...process.env, LAND_ROOT: dir, LAND_PATHS: paths, LAND_MSG: msg, LAND_BLOB_PROOF: proof }
  if (manifest) env.LAND_BLOBS = manifest
  else delete env.LAND_BLOBS
  return spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20 })
}

test('T-BLOB-1 blob 模式未出具替代证明 ⇒ 直接拒落(少一道守卫不得静默)', (t) => {
  const dir = makeRepo(t)
  const blob = hashText(dir, 'v2 本票新内容\n')
  const mf = join(dir, 'mf.json')
  writeFileSync(mf, JSON.stringify({ files: [{ path: 'a.txt', blob }] }))
  const env = { ...process.env, LAND_ROOT: dir, LAND_PATHS: 'a.txt', LAND_MSG: 'm', LAND_BLOBS: mf }
  delete env.LAND_BLOB_PROOF
  const r = spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 120_000 })
  assert.equal(r.status, 2, `无证明必须判死,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.match(r.stderr + r.stdout, /LAND_BLOB_PROOF/, '要指出缺的是哪一道')
})

test('T-BLOB-2 清单与声明面不一致 ⇒ 双向拒绝(不得多落一个路径,也不得少一个)', (t) => {
  const dir = makeRepo(t)
  const ok = hashText(dir, 'v2\n')
  const mfMissing = join(dir, 'mf-missing.json')
  writeFileSync(mfMissing, JSON.stringify({ files: [] }))
  const r1 = runLandBlob(dir, { paths: 'a.txt', manifest: mfMissing })
  assert.equal(r1.status, 2, '声明了路径而清单里没有 ⇒ 内容无从取得,不得退回去读盘上那份')
  assert.match(r1.stderr + r1.stdout, /清单里缺这些声明路径/)

  const mfExtra = join(dir, 'mf-extra.json')
  writeFileSync(mfExtra, JSON.stringify({ files: [{ path: 'a.txt', blob: ok }, { path: 'sub/keep.txt', blob: ok }] }))
  const r2 = runLandBlob(dir, { paths: 'a.txt', manifest: mfExtra })
  assert.equal(r2.status, 2, '清单里有未声明路径 ⇒ 声明面与内容面必须一致')
  assert.match(r2.stderr + r2.stdout, /未声明路径/)
})

test('T-BLOB-3 阳性对照:构造内容恰等于祖先版本 ⇒ 判红"写回旧版"(这条不响就是恒绿守卫)', (t) => {
  const dir = makeRepo(t)
  // 造一个祖先:第一枚提交里 a.txt = "v1",第二枚推进 HEAD 到别的形态
  const ancestorBlob = runGit(dir, ['rev-parse', 'HEAD:a.txt']).trim()
  writeFileSync(join(dir, 'a.txt'), '别人的新内容\n')
  runGit(dir, ['add', '--', 'a.txt'])
  runGit(dir, ['commit', '-q', '-m', 'B: 前进'])
  const mf = join(dir, 'mf-ancestor.json')
  writeFileSync(mf, JSON.stringify({ files: [{ path: 'a.txt', blob: ancestorBlob }] }))
  const r = runLandBlob(dir, { paths: 'a.txt', manifest: mf })
  assert.equal(r.status, 1, `等于祖先必须拒落,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.match(r.stderr + r.stdout, /写回旧版/, '点名这是写回而不是新内容')
})

test('T-BLOB-4 端到端:落地成功、索引对齐,而盘上那份(别人的)一字未动', (t) => {
  const dir = makeRepo(t)
  const mine = hashText(dir, 'v2 = HEAD ⊕ 本票行\n')
  // 盘上写一份"别人的在飞改动":blob 模式不得读它,更不得覆写它
  writeFileSync(join(dir, 'a.txt'), '别人的在飞改动\n')
  const mf = join(dir, 'mf-ok.json')
  writeFileSync(mf, JSON.stringify({ files: [{ path: 'a.txt', blob: mine }] }))
  const before = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const r = runLandBlob(dir, { paths: 'a.txt', manifest: mf })
  assert.equal(r.status, 0, `应落地成功,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /祖先对账 1\/1 路径/)
  // 横幅那一维现在是**分档**报数:基线本来无横幅的路径进"只点名"档,不进"保持"档。
  assert.match(r.stdout, /水印横幅保持 \d+\/1 路径/)
  assert.match(r.stdout, /主索引已对齐 1\/1 路径/)
  const after = runGit(dir, ['rev-parse', 'HEAD']).trim()
  assert.notEqual(after, before, 'HEAD 必须前进')
  assert.equal(runGit(dir, ['rev-parse', 'HEAD:a.txt']).trim(), mine, '新 HEAD 的内容必须是清单里那份')
  assert.equal(readFileSync(join(dir, 'a.txt'), 'utf8'), '别人的在飞改动\n', 'blob 模式绝不改写工作树')
  // 状态位是**两列**的:索引已对齐到 HEAD(第 1 列空格),盘上那份仍是别人的(第 2 列 M)。
  // 刻意不 trim —— trim 会把行首那一列吃掉,于是"索引已对齐"与"还停在旧 blob"两种相反状态都能过。
  assert.match(runGit(dir, ['status', '--porcelain']), /^ M a\.txt/, '留在别人改动那一格,不冒充已暂存')
})

/**
 * 接线锁:blob 模式必须真被 main 走到,且**不得**把"跳过水印预检"的措辞带进 blob 模式 ——
 * 那一支曾经是 `else`(无条件),于是 blob 模式(它上面已跑自己的横幅判据)又打印一句
 * "本次跳过水印预检",而那个环境变量根本没设 ⇒ 账面凭空出现一句没有发生过的放行。
 */
test('T-BLOB-5 接线与措辞:blob 模式已装进主流程,且不得凭空声称发生过一次放行', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /const \{ root, paths, msg, baseRef, blobOf(?:, jsonStructure)? \} =/, 'main 必须取 blobOf(G-816037 起该解构多一个字段,允许带上)')
  assert.match(src, /else if \(skipWatermark\)/, '"跳过了水印预检"这句必须只在真设了应急变量时打印')
  assert.ok(
    !/if \(!skipWatermark && !blobOf\) \{[\s\S]{0,600}?\} else \{\s*console\.log\('⚠️ IHUI_LAND_SKIP_WATERMARK/.test(src),
    '又写回无条件 else 了 ⇒ blob 模式会打印一句没发生过的放行',
  )
})

/**
 * 单向横幅判据的阳性对照(2026-09-29)。它现在是**条件**判据:基线本来没横幅就只点名不判红
 * (否则新增文件与第三方台账内容会被自己的预检挡住 —— 那是"给出路且跑不通"那一型)。
 * 条件判据必须自带"它确实会红"的证明:这里让基线带横幅、构造内容把横幅抹掉。
 */
test('T-BLOB-6 阳性对照:基线有横幅而构造内容抹掉 ⇒ 必须拒落', (t) => {
  const dir = makeRepo(t)
  const banner = '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。\n// [IHUI-AI-PROVENANCE]:x\n'
  writeFileSync(join(dir, 'src.txt'), banner + 'v1 正文\n')
  runGit(dir, ['add', '--', 'src.txt'])
  runGit(dir, ['commit', '-q', '-m', 'A: 带横幅'])
  const blob = hashText(dir, 'v2 本票新正文,但横幅被我抹了\n')
  const mf = join(dir, 'mf-banner.json')
  writeFileSync(mf, JSON.stringify({ files: [{ path: 'src.txt', blob }] }))
  const r = runLandBlob(dir, { paths: 'src.txt', manifest: mf })
  assert.equal(r.status, 1, `抹横幅必须拒落,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.match(r.stderr + r.stdout, /横幅被抹/)
})

/**
 * ── 票 G-801(2026-09-29):提交面回读把非 ASCII 路径误报成"缺路径" ──────────
 * 旧判据拿 `git show --name-only` 的**输出文本**与声明路径逐字比,而 git 默认按 core.quotePath
 * 把非 ASCII 路径八进制转写并加引号 ⇒ 中文/带空格路径必然比不中,已成功的交付被报成失败,
 * 假失败诱使重跑同一次落地(幂等判据 G-321① 拦的正是这个)。
 * 票面验收要求**两臂各钉一次**:只留修后那条等于没有反证。
 * 夹具用 .txt 而非事故原文件的 .md:.md 在水印 verify 射程内(无横幅会被预检拒落),
 * 而本票判据的唯一自变量是**路径字节**(非 ASCII + 空格),扩展位与此无关 —— 两臂都还成立。
 */
const ZH_PATH = 'docs/项目说明/8端一致性 认证矩阵.txt' // 中文目录 + 中文文件名 + 内含空格(事故原形)

function makeZhRepo(t) {
  const dir = makeRepo(t)
  mkdirSync(join(dir, 'docs', '项目说明'), { recursive: true })
  writeFileSync(join(dir, ZH_PATH), 'v1 初稿\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init: 中文路径'])
  return dir
}

test('T-G801-1 修后臂(端到端):含中文与空格的声明路径真落地 ⇒ 判"在树",不再报"缺路径"', (t) => {
  const dir = makeZhRepo(t)
  writeFileSync(join(dir, ZH_PATH), 'v2 本票改动\n')
  const r = runLand(dir, { paths: ZH_PATH, msg: 'docs: G-801 中文路径落地' })
  assert.equal(r.status, 0, `修后必须判在位,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /提交面回读 1\/1 路径在树/)
  assert.ok(!/缺路径/.test(r.stderr + r.stdout), '不得再出现"缺路径"字样')
  // git 自己的结论佐证:该路径确在新 HEAD 的树里(本器判据与之一致;rc 非 0 时 lib git() 抛错,本例即红)
  const head = runGit(dir, ['rev-parse', 'HEAD']).trim()
  git(['cat-file', '-e', `${head}:${ZH_PATH}`], { root: dir })
})

test('T-G801-2 修前臂(阳性对照,本票存在理由):同一枚提交上旧式"逐字比输出文本"必须比不中该路径', (t) => {
  const dir = makeZhRepo(t)
  writeFileSync(join(dir, ZH_PATH), 'v2 本票改动\n')
  const r = runLand(dir, { paths: ZH_PATH, msg: 'chore: G-801 修前对照夹具' })
  assert.equal(r.status, 0, `夹具先要能落(修后判据),实得 ${r.status}:${r.stderr}`)
  const head = runGit(dir, ['rev-parse', 'HEAD']).trim()
  // 复刻旧判据(显式 -c core.quotePath=true = git 内建默认,防全局配置把对照弄成恒绿):
  const oldSet = new Set(
    runGit(dir, ['-c', 'core.quotePath=true', 'show', '--name-only', '--format=', head])
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean),
  )
  assert.ok(
    !oldSet.has(ZH_PATH),
    '旧式比对在本夹具上必须比不中 ⇒ 夹具就是事故原形;若它命中了,这一臂退化成 T-G801-1 的复读,没有反证力',
  )
  // 且失败原因必须精确到八进制转写(而不是"路径压根没进清单"的另一种红):
  const escaped = [...oldSet].find((x) => x.startsWith('"docs/') && /\\\d{3}/.test(x))
  assert.ok(escaped, `默认档必须把中文路径转写成引号+八进制形态,实得清单 ${JSON.stringify([...oldSet])}`)
  // 加 quotePath=false 后同一条清单逐字命中 ⇒ 唯一变量就是转写,修法定位无歧义
  const fixedSet = new Set(
    runGit(dir, ['-c', 'core.quotePath=false', 'show', '--name-only', '--format=', head])
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean),
  )
  assert.ok(fixedSet.has(ZH_PATH), 'quotePath=false 下该路径必须逐字出现在清单里')
})

/**
 * T-G801-3 反恒绿锁 + 三态不并桶(判据函数直接 import,§22c):
 *  ① 非 ASCII 路径被探针**判**而不是被静默跳过 —— present+absent+undetermined 恒等于清单长度;
 *  ② "git 明确说不在树里"= absent(业务红),不许折进未判定;
 *  ③ "问不到"(提交解不出/派生失败)= undetermined,不许折成 absent ——
 *     两向折叠都会把"没判"写成结论,这正是本仓最高频的失效型。
 */
test('T-G801-3 commitFacePresence 三态闭合:非 ASCII 路径不得被静默跳过,问不到不得折成"没有"', (t) => {
  const dir = makeZhRepo(t)
  const head = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const zhMissing = 'docs/项目说明/不存在 的文件.md'
  const paths = [ZH_PATH, zhMissing, 'a.txt']
  const res = __test__.commitFacePresence({ root: dir, commit: head, paths })
  assert.deepEqual(res.present, [ZH_PATH, 'a.txt'], '在位的(含非 ASCII)必须逐条判 present')
  assert.deepEqual(res.absent, [zhMissing], '非 ASCII 的缺项必须判 absent —— 静默跳过或折进未判定都算失明')
  assert.deepEqual(res.undetermined, [])
  assert.equal(
    res.present.length + res.absent.length + res.undetermined.length,
    paths.length,
    '三态必须闭合到清单长度:少一条就是有一条被静默吞掉',
  )
  // 未判定臂:提交对象解不出 ⇒ 整批 undetermined,absent 必须为空(不得把"问不到"当"没有")
  const bogus = __test__.commitFacePresence({ root: dir, commit: '0'.repeat(40), paths })
  assert.equal(bogus.absent.length, 0, '"问不到"不得被折成"没有"')
  assert.equal(bogus.present.length, 0)
  assert.equal(bogus.undetermined.length, paths.length)
})

/**
 * T-G801-4 形状锁:存在性判据必须问 git 的结论,不得再拿 --name-only 的输出字节当路径身份;
 * 辅助清单维必须带 core.quotePath=false(否则它自己重演 G-801 那一型)。
 */
test('T-G801-4 形状锁:回读走 cat-file -e 探针且 --name-only 只作混提辅助并带 quotePath=false', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /commitFacePresence\(\{ root, commit: landed, paths \}\)/, 'main 必须真调用探针(判据在而无人调 = 判据不存在,守门 70/76/81 同型)')
  assert.match(src, /'cat-file', '-e'/, '探针必须问 git 的存在性结论')
  assert.match(src, /'-c', 'core\.quotePath=false', 'show', '--name-only'/, '混提辅助清单必须显式关转写')
  assert.ok(
    !/paths\.filter\(\(p\) => !inCommit\.has\(p\)\)/.test(src),
    '旧的"输出文本逐字比对"判据不得回来:那正是 G-801 的事故形态',
  )
})

/**
 * blob 模式 + 新增文件:必须**成功**。
 * 2026-09-29 10:46 那次把 `headBlobOf()==ABSENT`(基线里根本没有这条路径)与
 * `UNKNOWN`(问不到)合并成一个 unjudged,于是任何带新文件的 blob 落地一律 exit 2 ——
 * 而 blob 模式正是 §12 要求共脏文件走的路径,等于把所有"往 HEAD 加新文件"的交付堵死,
 * 且 T2 那条 happy path 抓不到它(它走工作树模式,不进 blobBannerPreserved)。
 */
test('T-NEWFILE-blobmode 新增文件不得被算成"横幅检查未判定"(blob 模式端到端)', (t) => {
  const dir = makeRepo(t)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const blob = writeBlob('// 新增件正文\n', { root: dir })
  const r = runLand(dir, {
    paths: 'brand/new.ts',
    blobs: [{ path: 'brand/new.ts', blob }],
    proof: '该路径基线不存在,构造内容由本票写出',
  })
  assert.equal(r.status, 0, `新增文件必须能落地,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /基线里没有该路径\(新增文件\)/, '必须点名"按定义无从保持",不得静默')
  assert.notEqual(git(['rev-parse', 'HEAD'], { root: dir }), before, 'HEAD 必须前进')
})

/** 反向对照:这一维的牙不能被这次放宽顺手卸掉 —— 已有横幅被抹仍必须 exit 1。 */
test('T-BANNER-TEETH blob 模式把基线横幅抹掉仍必须拒绝(放宽只针对新增文件)', (t) => {
  const dir = makeRepo(t)
  const banner = readFileSync(TOOL, 'utf8').split('\n').slice(0, 2).join('\n')
  writeFileSync(join(dir, 'signed.txt'), `${banner}\nconst x = 1\n`)
  runGit(dir, ['add', '--', 'signed.txt'])
  runGit(dir, ['commit', '-q', '-m', '带横幅的基线'])
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const blob = writeBlob('const x = 2\n', { root: dir })
  const r = runLand(dir, {
    paths: 'signed.txt',
    blobs: [{ path: 'signed.txt', blob }],
    proof: '只改正文一行',
  })
  assert.equal(r.status, 1, `抹横幅必须拦,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.match(r.stderr, /水印横幅未保持|横幅被抹/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before, '被拒时 HEAD 不得前进')
})


// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ─────────────────────────────────────────────────────────────────────────────
// G-815985 悬空相对引用预检(2026-09-29 立,由本会话一次真实自伤换来)
// 存在理由:旁路提交不跑 pre-commit,所以上一轮把 import 交进 HEAD 而把被 import 的文件
// 留在未跟踪面 —— 本机全绿(文件就在盘上),干净检出上 `git archive HEAD` 那份一加载就
// ERR_MODULE_NOT_FOUND。这组用例的**方向**必须是:被拒时什么都没发生(HEAD 未动、
// 且不产生 unreachable commit,否则给守门 30a 埋雷)。
// 水印预检在这组里统一用 IHUI_LAND_SKIP_WATERMARK=1 跳过 —— 夹具文件没有横幅,
// 不跳就会先红在水母闸上,测不到本闸。跳过是有意的、且在断言里写明。
// ─────────────────────────────────────────────────────────────────────────────
function runLandRaw(dir, paths, msg, extraEnv = {}) {
  const env = {
    ...process.env,
    LAND_ROOT: dir,
    LAND_PATHS: paths,
    LAND_MSG: msg,
    IHUI_LAND_SKIP_WATERMARK: '1',
    ...extraEnv,
  }
  for (const k of ['LAND_BLOBS', 'LAND_BLOB_PROOF', 'LAND_BASE_REF', 'LAND_ALLOW_STALE']) {
    if (!(k in extraEnv)) delete env[k]
  }
  return spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20 })
}

const unreachableCommits = (dir) =>
  runGit(dir, ['fsck', '--connectivity-only', '--unreachable', '--no-reflogs'])
    .split('\n')
    .filter((l) => /^unreachable commit/.test(l)).length

test('T-IMP-1 反例臂(端到端):声明面引用了未随本次落地的相对模块 ⇒ 必须拒绝,且不留任何 unreachable commit', (t) => {
  const dir = makeRepo(t)
  mkdirSync(join(dir, 'src', 'lib'), { recursive: true })
  writeFileSync(join(dir, 'src', 'a.mjs'), "import { x } from './lib/missing.mjs'\nexport const y = x\n")
  const before = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const r = runLandRaw(dir, 'src/a.mjs', 'test: 只交引用方')
  assert.notEqual(r.status, 0, '缺实体时不得落地成功')
  assert.match(r.stderr + r.stdout, /悬空相对引用预检不通过/, '拒绝原因必须点名本闸,不能是一句泛化失败')
  assert.match(r.stderr + r.stdout, /lib\/missing\.mjs/, '必须点名缺失的说明符')
  assert.equal(runGit(dir, ['rev-parse', 'HEAD']).trim(), before, 'HEAD 必须未动')
  assert.equal(unreachableCommits(dir), 0, '被拒的落地不得留下 unreachable commit(守门 30a 只数 commit 行)')
})

test('T-IMP-2 正例臂(端到端):引用与实体同枚声明 ⇒ 必须放行(否则本闸就是新的恒红拦路虎)', (t) => {
  const dir = makeRepo(t)
  mkdirSync(join(dir, 'src', 'lib'), { recursive: true })
  writeFileSync(join(dir, 'src', 'a.mjs'), "import { x } from './lib/present.mjs'\nexport const y = x\n")
  writeFileSync(join(dir, 'src', 'lib', 'present.mjs'), 'export const x = 1\n')
  const r = runLandRaw(dir, 'src/a.mjs;src/lib/present.mjs', 'test: 引用与实体同枚')
  assert.equal(r.status, 0, `同枚带实体必须成功,实际输出:\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /悬空相对引用预检:声明面源文件 2 个 \/ 缺失 0/, '放行也要报数,不得静默')
})

test('T-IMP-3 TS 约定:import ./c.js 而树里只有 c.ts ⇒ 不得判缺失(候选集必须覆盖 ESM .js→.ts 映射)', (t) => {
  const dir = makeRepo(t)
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src', 'b.ts'), "import { c } from './c.js'\nexport const d = c\n")
  writeFileSync(join(dir, 'src', 'c.ts'), 'export const c = 2\n')
  const r = runLandRaw(dir, 'src/b.ts;src/c.ts', 'test: .js 说明符指向 .ts')
  assert.equal(r.status, 0, `.js→.ts 是合法写法,判红即假阳:\n${r.stdout}\n${r.stderr}`)
})

test('T-IMP-4 未建模扩展名只报不拦:import ./x.css 不在树 ⇒ exit 0 且必须报名"判不出"', (t) => {
  const dir = makeRepo(t)
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src', 'w.ts'), "import './x.css'\nexport const w = 1\n")
  const r = runLandRaw(dir, 'src/w.ts', 'test: css 不在候选表')
  assert.equal(r.status, 0, '判不出的一律不拦(误拦一次,后人就学会整闸跳掉了)')
  assert.match(r.stdout, /判不出 1/, '但必须报数并点名,不得静默成"看起来全绿"')
  assert.match(r.stdout, /x\.css/, '未判定必须报名')
})

test('T-IMP-5 注释里的相对路径不算调用点(maskComments 装车的反向锁)', (t) => {
  const dir = makeRepo(t)
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src', 'n.mjs'), "// 曾经写 import './gone.mjs' 后来删了\nexport const n = 1\n")
  const r = runLandRaw(dir, 'src/n.mjs', 'test: 注释提了一句')
  assert.equal(r.status, 0, `注释不是调用点:\n${r.stdout}\n${r.stderr}`)
})

test('T-IMP-6 形状锁:onTree 必须真传进 commitTreeWithIndex,且两个开关各有其位', (t) => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /onTree:/, '摘掉 onTree 就等于本闸不存在 —— 判据在而无人调度是本仓最高频失效型')
  assert.match(src, /IHUI_LAND_SKIP_IMPORT_CHECK === '1'/, '应急跳过通道必须真实存在(文档不得写跑不通的出路)')
  assert.match(src, /拒绝落地\(未创建任何 commit/, '拒绝路径必须明说"什么都没创建"')
  const bg = readFileSync(join(dirname(TOOL), 'lib', 'bypass-git.mjs'), 'utf8')
  assert.match(bg, /if \(typeof onTree === 'function'\)/, 'plumbing 侧的钩子必须在位')
  assert.match(bg, /rejected\b/, '被拒时必须回报 rejected 而不是静默返回空 commit')
})

test('T-IMP-7 纯文档声明面不触发本闸(不得给每次活文档落地加时间)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'notes.md'), '# 引用 ./ghost.mjs 只是叙述\n')
  const r = runLandRaw(dir, 'notes.md', 'test: 只动文档')
  assert.equal(r.status, 0, `文档面必须照常落地:\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /声明面源文件 0 个|跳过/, '并如实说明本次没有源文件在声明面')
})

test('T-IMP-8 回归(本闸第一版被自己的落地枚打回的那一型):字符串**内容里**的 import 文本不是调用点', (t) => {
  // 第一版用正则在"只抹注释"的原文上扫说明符,于是这份夹具文件本身被判出 4 条不存在的缺失,
  // **本闸拒绝了自己的落地枚次**。这不是误报一次的问题:误拦会让人学会整闸跳掉(§12e 同型),
  // 所以这条是"判据必须只认字符串字面量 token"的永久锁,不是装饰。
  const dir = makeRepo(t)
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(
    join(dir, 'src', 'fixture.mjs'),
    "const tpl = \"import { x } from './lib/ghost.mjs'\\n\"\nexport const tpl2 = tpl\n",
  )
  const r = runLandRaw(dir, 'src/fixture.mjs', 'test: 夹具里写着别人的 import')
  assert.equal(r.status, 0, `字符串内容里的 import 不是调用点:\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /缺失 0 /, '且必须如实报"缺失 0",不得静默跳过判定')
})

/* ---------------------------------------------------------------------------
 * G-816037:机器格式化 JSON 的结构等值出口。
 * 立项事实(2026-09-29 第六十八批入账台账时实测):台账只做"数组尾部追加 + 计数器自增",
 * 行级复活判据却报「消失 11 / 重现 202 / 复活 1」并拒绝落地 ⇒ 只能靠 LAND_ALLOW_STALE 人工放行。
 * 下面五条把"该放行的放行、该拦的一次都别放过"钉成对。
 * ------------------------------------------------------------------------- */

// 三态夹具:A 有两个元素;基线 B 删掉第二个并把 read 由 1 改 2;盘上是"B ⊕ 把第二个补回末尾 + read 3"。
// ⇒ 盘上那行 `    "bbb-item-two"` 不在基线、在祖先 A ⇒ 行级判据读成"复活 1 行";
//   而结构判据看得见:基线的键与数组元素一个都没丢,只是标量值正常自增。
const A_JSON = '{\n  "read": 1,\n  "items": [\n    "aaa-item-one",\n    "bbb-item-two"\n  ]\n}\n'
const B_JSON = '{\n  "read": 2,\n  "items": [\n    "aaa-item-one"\n  ]\n}\n'
const LAND_JSON = '{\n  "read": 3,\n  "items": [\n    "aaa-item-one",\n    "bbb-item-two"\n  ]\n}\n'

test('T-JS-0 纯函数面:四态各一(键丢/元素丢/标量变允许/非 JSON 不适用)', () => {
  const f = __test__.jsonStructuralSuperset
  const ok = f({ baseText: B_JSON, nextText: LAND_JSON })
  assert.equal(ok.applicable, true, '两侧都是 JSON ⇒ 本档适用')
  assert.equal(ok.pass, true, `基线键与元素零丢失就应放行,实得:${JSON.stringify(ok)}`)
  const dropped = f({ baseText: '{"read": 2,\n  "keep": "a-long-enough-value"}\n', nextText: '{"read": 3}\n' })
  assert.equal(dropped.pass, false, '基线有 keep 而落地没有 ⇒ 必须判不成立')
  assert.ok(dropped.droppedKeys.some((k) => k.includes('keep')), `要能点名是哪个键丢了:${JSON.stringify(dropped)}`)
  const shrunk = f({ baseText: B_JSON, nextText: '{\n  "read": 3,\n  "items": []\n}\n' })
  assert.equal(shrunk.pass, false, '数组元素被清空 = 真回写,不得放过')
  assert.ok(shrunk.shrunkArrays.length > 0, '必须点名少了哪个元素')
  const notJson = f({ baseText: '- 一句话登记\n', nextText: '- 一句话登记\n- 又一句\n' })
  assert.equal(notJson.applicable, false, '活文档(非 JSON)必须直接不适用')
  assert.match(notJson.reason, /JSON|正文取不到/, `不适用也要说清原因:${notJson.reason}`)
  const missing = f({ baseText: B_JSON, nextText: null })
  assert.equal(missing.applicable, false, '取不到正文不是"通过"', '未判定不得被写成判过')
})

test('T-JS-1 正例(端到端):台账形态的"数组追加 + 计数自增"声明结构档 ⇒ 放行,且三个数照登', (t) => {
  const { dir, ancestor9 } = makeTwoCommitRepo(t, { oldText: A_JSON, newText: B_JSON })
  writeFileSync(join(dir, 'pack.txt'), LAND_JSON)
  const r = runLand(dir, {
    paths: 'pack.txt',
    msg: 'chore(ledger): 只追加条目 + 自增计数(结构档)',
    jsonStructure: true,
  })
  assert.equal(r.status, 0, `结构等值成立就必须能落,实得 ${r.status}:\n${r.stdout}\n${r.stderr}`)
  const out = r.stdout + r.stderr
  assert.match(out, /结构等值成立/, `必须大声说是哪条判据救的,不能静默绿:\n${out}`)
  assert.match(out, /复活 1 行/, '被豁免的那三个数必须照登(消失/重现/复活)')
  assert.match(out, /LAND_JSON_STRUCTURE/, '要写明本档来自显式声明,不是默认放宽')
  assert.ok(out.includes(ancestor9), `样本行仍要点名祖先 ${ancestor9}:\n${out}`)
  assert.equal(headBlobOf('HEAD', 'pack.txt', { root: dir }), writeBlob(LAND_JSON, { root: dir }), '确实按盘上内容落了')
})

test('T-JS-2 反例(端到端,本票的存在理由):搬回祖先行的同时又丢了基线键 ⇒ 结构档不得豁免它', (t) => {
  // 祖先 A:items 里有 bbb;基线 B:按正当动作删掉 bbb,并新增一行只此一份的 keepme;
  // 盘上这份 = 把 bbb 搬回来(这一半正是 T-JS-1 的假阳形态)⊖ 把 keepme 抹掉(这一半是真回写)。
  // ⇒ 行级判据照样拒绝,且报告必须说清"结构档不成立",而不是让人以为被豁免后又抽风。
  const ANC = '{\n  "read": 1,\n  "items": [\n    "aaa-item-one",\n    "bbb-item-two"\n  ]\n}\n'
  const BASE = '{\n  "read": 2,\n  "items": [\n    "aaa-item-one"\n  ],\n  "keepme": "baseline-only-long-value"\n}\n'
  const TOSEND = '{\n  "read": 3,\n  "items": [\n    "aaa-item-one",\n    "bbb-item-two"\n  ]\n}\n'
  const { dir, ancestor9 } = makeTwoCommitRepo(t, { oldText: ANC, newText: BASE })
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  writeFileSync(join(dir, 'pack.txt'), TOSEND)
  const r = runLand(dir, { paths: 'pack.txt', msg: 'chore: 试着用结构档把丢键蒙过去', jsonStructure: true })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `丢基线键 + 搬回祖先行必须拦(否则本档就是给整文件回写开后门),实得:\n${out}`)
  assert.match(out, /结构档不成立/, `要说明为什么没被豁免,而不是只喊原判决:\n${out}`)
  assert.match(out, /丢键 1/)
  assert.doesNotMatch(out, /结构等值成立/)
  assert.ok(out.includes(ancestor9), `仍要点名祖先 ${ancestor9}:\n${out}`)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before, '拒绝路径上 HEAD 一步没动')
})

test('T-JS-3 默认关闭:不带 LAND_JSON_STRUCTURE 时,同一份内容仍按原行级判据拦(行为同形锁)', (t) => {
  const { dir, ancestor9 } = makeTwoCommitRepo(t, { oldText: A_JSON, newText: B_JSON })
  writeFileSync(join(dir, 'pack.txt'), LAND_JSON)
  const r = runLand(dir, { paths: 'pack.txt', msg: 'chore: 同一份内容,不声明结构档' })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `开关不开就必须与改前同形(拦),实得 ${r.status}:\n${out}`)
  assert.match(out, /复活 1 行/)
  assert.ok(out.includes(ancestor9))
  assert.doesNotMatch(out, /结构等值成立/, '未声明时不得启用结构档(连提都不能提)')
})

test('T-JS-4 活文档不受影响:非 JSON 的面带上结构档旗也照原判据拦', (t) => {
  const OLD = 'title: 更新检查\nquitChecking: 正在检查更新\nsettings: 设置\n'
  const NEW = 'title: 更新检查\nsettings: 设置\n'
  const { dir, ancestor9 } = makeTwoCommitRepo(t, { oldText: OLD, newText: NEW })
  writeFileSync(join(dir, 'pack.txt'), OLD)
  const r = runLand(dir, { paths: 'pack.txt', msg: 'docs: 活文档复活他人删掉的行', jsonStructure: true })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `活文档不是 JSON ⇒ 本档不适用,必须照拦,实得:\n${out}`)
  assert.match(out, /复活 1 行/)
  assert.doesNotMatch(out, /结构等值成立/)
  assert.ok(out.includes(ancestor9))
})

test('T-JS-5 形状锁:结构档三条件都在,且 blob 模式明确不套用它', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /env\.LAND_JSON_STRUCTURE === '1'/, 'env 必须被真的读取(不是文档里写了就算)')
  assert.match(src, /jsonStructure = false/, '形参默认关闭')
  assert.match(src, /refuseByLines && !wholeHit && jsonStructure/, '三条同时成立才生效:行级判到了 + 整 blob 没命中祖先 + 显式声明')
  assert.match(src, /kind: 'json-structure-exempt'/, '豁免必须留痕成一条 note(报告要能点名)')
  // 失效方向检查:整 blob 命中祖先(真回写)那一支不得被顺手豁免。
  // **刻意不用"字符窗口内搜"的形状锁** —— 窗口宽度会随插代码漂(本仓记过:窗口型锁会静默变恒红),
  // 这里改成两条与距离无关的判据:顺序 + 赋值次数。
  assert.match(src, /const refuseByBlob = !!wholeHit/, 'blob 判据必须排在豁免之外且不受 jsonStructure 影响')
  const iBlob = src.indexOf('const refuseByBlob = !!wholeHit')
  const iIf = src.indexOf('if (refuseByBlob || refuseByLines)')
  assert.ok(iBlob > 0 && iIf > iBlob, `拒绝决策必须在 blob 判据之后(blob ${iBlob} / if ${iIf})`)
  const seg = src.slice(iBlob, iIf)
  assert.ok(seg.includes('jsonStructuralSuperset('), '中间段必须真的调用结构判据(引了不用 = 假接线,守门 118 那一型)')
  assert.equal(
    (src.match(/\brefuseByBlob\s*=(?!=)/g) ?? []).length,
    1,
    'refuseByBlob 只允许被赋值一次(声明处);再赋值 = 把唯一拦真回写的支路拆掉',
  )
  assert.equal(
    (src.match(/\brefuseByLines\s*=(?!=)/g) ?? []).length,
    2,
    'refuseByLines 只允许"声明 + 结构档豁免"两处赋值;多出第三处就是在私改拒绝口径',
  )
})

/**
 * 祖先命中的**行级子集出口**(2026-09-30 立,量纲修正)。
 *
 * 立因是真实一票:5 个 apps/web/src/components/ai/*-panel.tsx 的角色档清偿,目标内容逐字节等于
 * 09-27 之前的形态,旧判据按"整 blob 等值"一律当写回旧版拒落 —— 而逐行核过祖先↔基线只差
 * 本票那几行圆角,没有任何他人行被抹。判据的担忧成立、量纲不成立。
 * 这两条臂必须成对:放行臂证明出口能用,拒落臂证明出口**没有把事故那一型一起放掉**
 * (只留前者就是给"门瞎了"背书 —— 本仓 §22c 记过多次)。
 */
test('T-BLOB-7 出口放行臂:祖先命中 + 声明与差集逐行等值 ⇒ 落地并逐条点名是哪几行', (t) => {
  const dir = makeRepo(t)
  const ancestorBlob = runGit(dir, ['rev-parse', 'HEAD:a.txt']).trim() // "v1"
  writeFileSync(join(dir, 'a.txt'), '别人的新内容\n')
  runGit(dir, ['add', '--', 'a.txt'])
  runGit(dir, ['commit', '-q', '-m', 'B: 前进'])
  const mf = join(dir, 'mf-clash.json')
  writeFileSync(mf, JSON.stringify({ files: [{ path: 'a.txt', blob: ancestorBlob }] }))
  const sc = join(dir, 'scope-ok.json')
  writeFileSync(sc, JSON.stringify({ files: [{ path: 'a.txt', removed: ['别人的新内容'], added: ['v1'] }] }))
  const env = {
    ...process.env,
    LAND_ROOT: dir,
    LAND_PATHS: 'a.txt',
    LAND_MSG: 'chore: 行级声明放行',
    LAND_BLOB_PROOF: 'e2e:本票只动 a.txt 的那一行',
    LAND_BLOBS: mf,
    LAND_CLASH_SCOPE: sc,
  }
  const r = spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20 })
  assert.equal(r.status, 0, `声明与差集等值时应放行,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  const out = r.stdout + r.stderr
  assert.match(out, /命中祖先 .* 但差集与本票声明逐行等值/, '必须点名"命中过祖先"这件事,不得静默放行')
  assert.match(out, /写回旧态的本票行: 别人的新内容/, '放行的每一条都要列出会被写回的行')
  assert.match(out, /恢复的本票行: *v1/, '同理列出被恢复的行')
  assert.match(out, /1 个命中祖先但已按行级声明点名放行/, '汇总行必须把两档分开报数')
  assert.equal(runGit(dir, ['rev-parse', 'HEAD:a.txt']).trim(), ancestorBlob, '放行后新 HEAD 内容必须是清单那份')
})

test('T-BLOB-8 出口有牙臂(阳性对照):声明漏报他人行 ⇒ 照旧拒落并点名那几行', (t) => {
  const dir = makeRepo(t)
  // 祖先 A:两行都是旧形态。B:别人把两行都推进了。本票只想恢复自己那一行 ⇒ 落 A 的整份 blob
  // 会连带把别人的行写回旧态 —— 这正是本判据存在的理由,出口不得把它放掉。
  writeFileSync(join(dir, 'two.txt'), 'mine-v1\nother-v1\n')
  runGit(dir, ['add', '--', 'two.txt'])
  runGit(dir, ['commit', '-q', '-m', 'A: 旧形态'])
  const ancestorBlob = runGit(dir, ['rev-parse', 'HEAD:two.txt']).trim()
  writeFileSync(join(dir, 'two.txt'), 'mine-v2\nother-v2\n')
  runGit(dir, ['add', '--', 'two.txt'])
  runGit(dir, ['commit', '-q', '-m', 'B: 别人推进了两行'])
  const mf = join(dir, 'mf-partial.json')
  writeFileSync(mf, JSON.stringify({ files: [{ path: 'two.txt', blob: ancestorBlob }] }))
  const sc = join(dir, 'scope-partial.json')
  writeFileSync(sc, JSON.stringify({ files: [{ path: 'two.txt', removed: ['mine-v2'], added: ['mine-v1'] }] }))
  const env = {
    ...process.env,
    LAND_ROOT: dir,
    LAND_PATHS: 'two.txt',
    LAND_MSG: 'chore: 声明漏报他人行',
    LAND_BLOB_PROOF: 'e2e',
    LAND_BLOBS: mf,
    LAND_CLASH_SCOPE: sc,
  }
  const r = spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20 })
  assert.equal(r.status, 1, `声明不完整必须仍拒落,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  const out = r.stdout + r.stderr
  assert.match(out, /声明的改动行与祖先↔基线的实际差集不等/, '要说清是"不等"而不是笼统的"等于祖先"')
  assert.match(out, /other-v2/, '必须点名那条会被写回旧态的他人行')
  assert.match(out, /other-v1/, '也必须点名那条会被搬回来的行')
  assert.notEqual(runGit(dir, ['rev-parse', 'HEAD']).trim(), '', '拒落路径上 HEAD 不应前进')
})

test('T-BLOB-9 出口的两个判死臂:坏 JSON 与射程外声明都不得被读成"没有命中祖先"', (t) => {
  const dir = makeRepo(t)
  const ancestorBlob = runGit(dir, ['rev-parse', 'HEAD:a.txt']).trim()
  writeFileSync(join(dir, 'a.txt'), '别人的新内容\n')
  runGit(dir, ['add', '--', 'a.txt'])
  runGit(dir, ['commit', '-q', '-m', 'B: 前进'])
  const mf = join(dir, 'mf-c.json')
  writeFileSync(mf, JSON.stringify({ files: [{ path: 'a.txt', blob: ancestorBlob }] }))

  const bad = join(dir, 'scope-bad.json')
  writeFileSync(bad, '{这不是 JSON')
  const r1 = spawnSync(process.execPath, [TOOL], {
    env: { ...process.env, LAND_ROOT: dir, LAND_PATHS: 'a.txt', LAND_MSG: 'm', LAND_BLOB_PROOF: 'p', LAND_BLOBS: mf, LAND_CLASH_SCOPE: bad },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
  })
  assert.equal(r1.status, 2, `坏声明文件必须判死而不是当"无声明"落,实得 ${r1.status}:${r1.stdout}|${r1.stderr}`)
  assert.match(r1.stdout + r1.stderr, /LAND_CLASH_SCOPE/)

  const unknown = join(dir, 'scope-unknown.json')
  writeFileSync(unknown, JSON.stringify({ files: [{ path: 'sub/keep.txt', removed: [], added: [] }] }))
  const r2 = spawnSync(process.execPath, [TOOL], {
    env: { ...process.env, LAND_ROOT: dir, LAND_PATHS: 'a.txt', LAND_MSG: 'm', LAND_BLOB_PROOF: 'p', LAND_BLOBS: mf, LAND_CLASH_SCOPE: unknown },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
  })
  assert.equal(r2.status, 2, `射程外声明永不被核验 ⇒ 判死,实得 ${r2.status}:${r2.stdout}|${r2.stderr}`)
  assert.match(r2.stdout + r2.stderr, /射程外|未声明落地/)
})

/**
 * 形状锁:行级多重集只能有一份实现。本器**不得**自己再写一遍计行/差集/等值 ——
 * 两处算同一件事必漂移,而漂移的表现是"数字合理、结论相反"(§3、守门 134/135 同一课)。
 */
test('T-BLOB-10 形状锁:多重集口径只住在 lib,本器只 import', () => {
  const src = readFileSync(TOOL, 'utf8')
  for (const name of ['lineDeltaMaps', 'multisetOfLines', 'multisetsEqual']) {
    assert.ok(src.includes(name), `本器必须引 lib 的 ${name}(自己算 = 第二份真相)`)
  }
  assert.ok(!/function\s+tallyLines\b/.test(src), '本器里不得出现第二份 tallyLines')
  const lib = readFileSync(join(HERE, '..', 'lib', 'stale-content-analysis.mjs'), 'utf8')
  assert.equal((lib.match(/const extras = \(/g) ?? []).length, 1, 'lib 里差集口径只能有一处(计数与样本必须同源)')
  assert.match(lib, /const maps = lineDeltaMaps\(baseText, newText\)/, 'lineDelta 必须是 lineDeltaMaps 的投影,不是并列的第二份实现')
})

/**
 * `decideBanner` 的载荷档(2026-09-30)。这条判据此前**一条测试都没有** —— 于是它把
 * "§5c 要求的载荷修复"判成"改写横幅文字",4 个已损坏文件因此没有任何落地通道
 * (提交链上的水印门只会改磁盘,而磁盘那份属他人现场)。判据没有构造面自证 = 它随时可能
 * 咬到自己该放行的那一型。
 */
test('T-BANNER-P 纯函数面:只差在零宽载荷位 ⇒ 默认拒(fail-closed),经 verify 复核后才算修复', () => {
  const ZW = String.fromCodePoint(0x200b, 0x200d, 0x2060)
  const good = '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。\n// [IHUI-AI-PROVENANCE]:' + ZW.repeat(6) + '\n正文 A\n'
  // 夹具必须**只用零宽族**造差异:掺进任何可见字符,判据就会走"改写可见文案"那一支,
  // 而我这条测的是"只差在载荷位"那一支(第一版掺了 'x'/'y',测到的其实是另一条判序)。
  const damaged = good.replace(ZW.repeat(6), String.fromCodePoint(0x200c).repeat(6))
  assert.notEqual(damaged, good, '夹具必须真的不同')
  const a = decideBanner({ baseText: damaged, newText: good })
  assert.equal(a.verdict, 'broken', '没复核过就不得放行(默认坏 = fail-closed)')
  assert.equal(a.needsPayloadCheck, true, '要标明这是"待复核"而不是"已判定坏"')
  const b = decideBanner({ baseText: damaged, newText: good, newPayloadOk: true })
  assert.equal(b.verdict, 'repaired', '经唯一判据(verify)复核载荷完好 ⇒ 这是修复')
})

test('T-BANNER-Q 反向锁:可见文案被改写 ⇒ 不得借"载荷复核"通道洗白', () => {
  const base =
    '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。\n// [IHUI-AI-PROVENANCE]:x\n正文\n'
  const rewritten = base.replace('2026 IHUI AI', '2027 IHUI AI')
  const r = decideBanner({ baseText: base, newText: rewritten, newPayloadOk: true })
  assert.equal(r.verdict, 'broken', '换了可见文案就是改写,载荷复核过也不认')
  assert.notEqual(r.needsPayloadCheck, true, '这一档不得带"待复核"旗 —— 带了就等于给真改写开了第二次机会')
})

test('T-BANNER-R 形状锁:零宽族的剥离只许有一份实现,且载荷完坏只能问 watermark CLI', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /import \{[^}]*dropZeroWidth[^}]*\} from '\.\/lib\/watermark-lines\.mjs'/, '前三行的比较必须引 lib 的剥离出口')
  assert.ok(!/fromCodePoint\(0x2060/.test(src), '本器里不得再拼一份零宽族(§5c:哪一行算隐写只许有一份)')
  assert.match(src, /WATERMARK_CLI, 'verify'/, '"载荷完不完好"只能问那份 CLI,不在本器里重写解码')
})



