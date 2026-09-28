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
//  + 活文档编号形态闸(2026-09-29 补,票面六道成对判据):
//    T19 正向:父提交没有、本次内容有畸形号 ⇒ rc=1 并点名该行(且拒绝路径上水印预检与 write-tree 都没跑到);
//    T20 同一性:本器用的 newMalformed / LIVE_DOCS 必须与宿主是**同一个对象**(不是复制品);
//    T21 形状锁:必须 import live-doc-edit 的那一份并真调用,代码面不得出现第二份 MALFORMED_*_RE 或重抄的活文档清单;
//    T22 反向(存量):父提交里已在的畸形行逐字带着 ⇒ rc=0 且打印"存量 N 行…只报数";
//    T23 反向(射程):同一形态写在非活文档路径 ⇒ 不判,并喊出"这是射程,不是判过且干净";
//    T24 应急出口:LAND_ALLOW_MALFORMED_ID=1 ⇒ 落地成功但大声放行并点名判据;而 '0'/'true' 这类非 '1' 真值仍拒;
//    T25 父提交取不到 ⇒ 落"未判定",既不判红也绝不静默当零存量。
// git 写操作只发生在 scripts/lib/scratch-dir.mjs 的临时仓内(§26/§15b 唯一夹具落点),绝不碰真仓。

import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ } from '../object-space-land.mjs'
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

function runLand(dir, { paths = '', msg = 'chore: e2e land', baseRef, allowStale, skipWatermark, allowMalformedId, malformedIdRaw } = {}) {
  const env = { ...process.env, LAND_ROOT: dir, LAND_PATHS: paths, LAND_MSG: msg }
  if (baseRef) env.LAND_BASE_REF = baseRef
  else delete env.LAND_BASE_REF
  if (allowStale) env.LAND_ALLOW_STALE = '1'
  else delete env.LAND_ALLOW_STALE
  // 编号形态闸排在水印预检**之前**,而"放行/存量/未判定"那几档要走到落地这一步才量得到 ——
  // 夹具是无横幅的 .md,那一道预检会先把整个落地拦下(与本案无关的第二个理由)。
  // 这里按既有的显式应急出口跳过它,并在断言里只判编号形态这一维;跳过行会照常被打印。
  if (skipWatermark) env.IHUI_LAND_SKIP_WATERMARK = '1'
  else delete env.IHUI_LAND_SKIP_WATERMARK
  if (allowMalformedId) env.LAND_ALLOW_MALFORMED_ID = '1'
  else delete env.LAND_ALLOW_MALFORMED_ID
  // malformedIdRaw:造"非 '1' 的真值"现场(如 '0' / 'true'),钉"默认关闭"不是"非空即放行"
  if (malformedIdRaw !== undefined) env.LAND_ALLOW_MALFORMED_ID = malformedIdRaw
  return spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20 })
}

test('T1 §22c 导出面:判据函数必须在 __test__ 里', () => {
  for (const k of ['parseArgs', 'clobberedPaths', 'lineDelta', 'resurrectAnalysis', 'detectStaleLanding', 'staleReport'])
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

/* ─────────────────────────────────────────────────────────────────────────────
 * 活文档编号形态闸(2026-09-29):畸形登记编号(`G-G-334`/`DD128` 这种族名在编号段出现两次)的
 * 唯一判据住在 `live-doc-edit.mjs`,而旁路落地**不跑任何钩子** —— 这一族用例钉的就是"落地点也问了
 * 那一份实现,而且只问那一份"。六条成对:正向拦 / 存量放 / 射程外不伤 / 应急出口大声 / 无父提交不猜 /
 * 同一性与形状各锁一遍。
 * ───────────────────────────────────────────────────────────────────────────── */

// 两型畸形号都取真仓在案的形状(G- 族双写、D 族连写),再加一行合法登记当对照。
const MAL_GG = '- [ ] G-G-390 **W4-W7 四波覆盖票** —— 族名在编号段出现两次的畸形登记行'
const MAL_DD = '- [ ] DD128 另一族同型:并发取号把同一个号改派过三次就会留下这种行'
const OK_ROW = '- [ ] O81 跨端 UI 单一源:这一行形态合法,只作对照用'
const HONEST_NEW = '- [ ] V3-77 本次真写的新登记:合法形态,不该被任何一档算成畸形'

/** 造一个"活文档已在 HEAD 里、内容干净"的仓,再单独提交把畸形行写进**父提交**(存量档用)。 */
function makePlanRepo(t, headContent) {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), headContent)
  runGit(dir, ['add', '--', 'PROJECT_PLAN.md'])
  runGit(dir, ['commit', '-q', '-m', 'P: 活文档基线形态'])
  return dir
}

test('T19 正向:父提交没有、本次内容里有畸形号 ⇒ rc=1 点名该行,且水印预检与 write-tree 都没被跑到', (t) => {
  const dir = makePlanRepo(t, `# PROJECT_PLAN\n\n${OK_ROW}\n`)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# PROJECT_PLAN\n\n${OK_ROW}\n${MAL_GG}\n${MAL_DD}\n`)
  const r = runLand(dir, { paths: 'PROJECT_PLAN.md', msg: 'docs(plan): 加两行(含畸形号)' })
  const out = r.stderr + r.stdout
  assert.equal(r.status, 1, `编号形态闸必须拦,实得 ${r.status}:${out}`)
  assert.match(out, /活文档编号形态闸/)
  assert.match(out, /本次要落地的内容里有 2 行畸形登记编号/, '结论行必须给数')
  assert.match(out, /本次新增 2 行/, '逐文件行必须给该文件自己的数')
  assert.ok(out.includes('G-G-390'), `必须点名到那一行原文,实得:\n${out}`)
  assert.ok(out.includes('DD128'), '两型都要点名(G 族双写与 D 族连写同判)')
  assert.match(out, /LAND_ALLOW_MALFORMED_ID/, '拒绝时必须给出显式应急出口的名字')
  // 位置证明:闸排在水印预检与 write-tree/commit-tree **之前** ⇒ 拒绝路径上既没花那次 verify 派生,
  // 也没新建提交。少了这一断言,"落地之后再 exit 1"那种实现(把已入库谎报成没落地)照样全绿。
  assert.ok(!/水印预检/.test(out), '拒绝不得先跑水印预检(闸必须排在它之前)')
  assert.ok(!/CAS 成功/.test(out), '拒绝路径上不得新建提交')
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before, 'HEAD 必须一步没动(不留半截提交)')
  assert.equal(headBlobOf('HEAD', 'PROJECT_PLAN.md', { root: dir }), writeBlob(`# PROJECT_PLAN\n\n${OK_ROW}\n`, { root: dir }))
})

test('T20 同一性:本器用的 newMalformed / LIVE_DOCS 必须与宿主是同一个对象(不是改名复制品)', async () => {
  const host = await import('../live-doc-edit.mjs')
  const conv = await import('../union-converge.mjs')
  assert.equal(typeof host.newMalformed, 'function', '判据宿主的出口必须在位(不在即红,不得写 ?? 兜底)')
  assert.equal(__test__.newMalformed, host.newMalformed, '本器必须引那一个函数,不是抄一份')
  assert.equal(__test__.LIVE_DOCS, conv.LIVE_DOCS, '活文档清单必须是 union-converge 导出的那一份数组')
  // 宿主的判据本身也要有牙:两型畸形各命中一次,合法行一条都不命中(否则本器引的是一把空尺子)
  assert.deepEqual(host.findMalformedIds(MAL_GG).map((x) => x.family), ['G'])
  assert.deepEqual(host.findMalformedIds(MAL_DD).map((x) => x.family), ['D'])
  assert.equal(host.findMalformedIds(OK_ROW).length, 0, '合法形态不得被算成畸形(误伤就是一台恒红门)')
})

test('T21 形状锁:编号形态判据只能 import live-doc-edit 那一份;代码面不得出现第二份 MALFORMED_*_RE 或重抄的清单', () => {
  const src = readFileSync(TOOL, 'utf8')
  const code = maskCommentsAndStrings(src) // 判"实现"看遮掉注释/字符串后的代码面,否则说明文字会被判成违规
  assert.match(
    src,
    /import\s*\{[^}]*\bnewMalformed\b[^}]*\}\s*from\s*['"]\.\/live-doc-edit\.mjs['"]/,
    '必须从活文档编辑器 import 那一份判据',
  )
  assert.match(code, /newMalformed\s*\(/, 'import 了却没调用 = 判据仍是自写的(假接线)')
  assert.match(
    src,
    /import\s*\{\s*LIVE_DOCS\s*\}\s*from\s*['"]\.\/union-converge\.mjs['"]/,
    '活文档清单必须引 union-converge 导出的那一份',
  )
  assert.match(code, /LIVE_DOCS\.includes\(/, '清单没被用来收窄射程(引了不判)同样是假接线')
  // 第二份实现的三种形状,一条都不许出现在代码面
  for (const secondImpl of [/MALFORMED_ID_RE/, /MALFORMED_BODY_RE/, /findMalformedIds\s*\(/, /function\s+newMalformed\b/])
    assert.ok(!secondImpl.test(code), `代码面出现第二份编号形态判据的形状:${secondImpl}`)
  // 注释里点名宿主实现是**允许的**(要说清依据从哪来),所以必须能区分两面 —— 两面同色就等于本锁在判散文
  assert.match(src, /MALFORMED_ID_RE/, '反向对照:注释里引用宿主正则名应当留在原文面,被遮掉才算锁住了代码面')
  // 不得重抄清单字面量(那是第四本的开端)
  assert.ok(
    !/PROJECT_PLAN\.md['"],\s*['"]AGENTS\.md/.test(code),
    '本器里不得再写一份活文档清单字面量 —— 清单只有 union-converge 那一份',
  )
})

test('T22 反向(存量不判红):父提交里已在的畸形行逐字带着落地 ⇒ rc=0,且 stdout 喊"存量 N 行…只报数"', (t) => {
  const dir = makePlanRepo(t, `# PROJECT_PLAN\n\n${OK_ROW}\n${MAL_GG}\n${MAL_DD}\n`)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  // 本次只加一行真新登记,畸形行是别人历史留下的 ⇒ 不得钉红本次落地(§12e 恒红门同一条)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# PROJECT_PLAN\n\n${OK_ROW}\n${MAL_GG}\n${MAL_DD}\n${HONEST_NEW}\n`)
  const r = runLand(dir, { paths: 'PROJECT_PLAN.md', msg: 'docs(plan): 加一行合法登记', skipWatermark: true })
  const out = r.stderr + r.stdout
  assert.equal(r.status, 0, `存量不得判红,实得 ${r.status}:${out}`)
  assert.match(out, /存量畸形登记编号 2 行/, '存量必须报名并给数,否则"存量"与"我刚造的"同形')
  assert.match(out, /只报数/)
  assert.match(out, /已判 1 本活文档\(本次新增畸形 0 行\)/, '跑了且干净必须给出"跑了"的正向句')
  assert.match(r.stdout, /IHUI_LAND_SKIP_WATERMARK=1/, '跳过水印那道也要大声留痕')
  assert.notEqual(git(['rev-parse', 'HEAD'], { root: dir }), before, '这一档是真落地,HEAD 必须前进')
})

test('T23 反向(不许顺手放宽):同一畸形形态写在**非活文档**路径 ⇒ 不判,并喊出"这是射程,不是判过且干净"', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'notes.md'), `# 说明\n\n${MAL_GG}\n${MAL_DD}\n`)
  const r = runLand(dir, { paths: 'notes.md', msg: 'docs: 普通说明文件', skipWatermark: true })
  const out = r.stderr + r.stdout
  assert.equal(r.status, 0, `清单外路径不得被判红,实得 ${r.status}:${out}`)
  assert.match(out, /本次声明路径不含活文档/)
  assert.match(out, /不进射程,这是\*\*射程\*\*,不是/)
  assert.ok(!/新增畸形登记编号/.test(out), '射程外不得产出任何"畸形号"结论 —— 全局误伤就是这台闸的死法')
  // 同一条判据在**清单内**路径上必须仍然拦(两臂只差路径名,两臂同色才证明判据是按清单走的)
  const dir2 = makePlanRepo(t, `# PROJECT_PLAN\n\n${OK_ROW}\n`)
  writeFileSync(join(dir2, 'PROJECT_PLAN.md'), `# PROJECT_PLAN\n\n${OK_ROW}\n${MAL_GG}\n`)
  const r2 = runLand(dir2, { paths: 'PROJECT_PLAN.md', msg: 'docs(plan): 同一形态,这次在清单内' })
  assert.equal(r2.status, 1, `清单内必须拦,实得 ${r2.status}:${r2.stderr}|${r2.stdout}`)
  assert.match(r2.stderr + r2.stdout, /G-G-390/)
})

test('T24 应急出口:LAND_ALLOW_MALFORMED_ID=1 ⇒ 落地成功但大声放行并点名判据;非 "1" 的真值("0"/"true"/"yes")仍拒', (t) => {
  const dir = makePlanRepo(t, `# PROJECT_PLAN\n\n${OK_ROW}\n`)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# PROJECT_PLAN\n\n${OK_ROW}\n${MAL_GG}\n`)
  const r = runLand(dir, {
    paths: 'PROJECT_PLAN.md',
    msg: 'docs(plan): 人工放行畸形号',
    skipWatermark: true,
    allowMalformedId: true,
  })
  const out = r.stderr + r.stdout
  assert.equal(r.status, 0, `显式放行必须能落,实得 ${r.status}:${out}`)
  assert.match(r.stdout, /本次由人工放行 1 行畸形登记编号落地/, '放行行必须大声、给数')
  assert.match(r.stdout, /LAND_ALLOW_MALFORMED_ID=1/, '必须点名是哪条旗标放行的')
  assert.match(r.stdout, /live-doc-edit\.newMalformed/, '必须点名被放过的判据名字')
  assert.match(r.stdout, /放行不等于判过/)
  assert.match(r.stdout, /G-G-390/, '放行时同样要逐条点名放了什么行,便于事后归因')
  /**
   * "默认关闭"的牙:每次造**新仓**,不复用上面那枚 —— 上一次落地已把那行畸形号写进 HEAD,
   * 复用会让"本次新增"退化成"存量",rc 反而因为另一条拒绝(声明无差异)变 1 ⇒ 断言过了但过的不是本案。
   */
  for (const raw of ['0', 'true', 'yes', '']) {
    const d = makePlanRepo(t, `# PROJECT_PLAN\n\n${OK_ROW}\n`)
    writeFileSync(join(d, 'PROJECT_PLAN.md'), `# PROJECT_PLAN\n\n${OK_ROW}\n${MAL_GG}\n`)
    const rr = runLand(d, {
      paths: 'PROJECT_PLAN.md',
      msg: 'docs(plan): 非 1 真值',
      skipWatermark: true,
      malformedIdRaw: raw,
    })
    assert.equal(rr.status, 1, `LAND_ALLOW_MALFORMED_ID=${JSON.stringify(raw)} 不得被当成放行,实得 ${rr.status}:${rr.stderr}|${rr.stdout}`)
    assert.match(rr.stderr + rr.stdout, /拒绝落地/)
  }
  const src = readFileSync(TOOL, 'utf8')
  assert.equal(
    (src.match(/process\.env\.LAND_ALLOW_MALFORMED_ID\s*===\s*'1'/g) ?? []).length,
    1,
    '旗标读取必须恰好一处且是严格等于 "1"',
  )
  assert.ok(!/if\s*\(\s*process\.env\.LAND_ALLOW_MALFORMED_ID\s*\)/.test(src), '出现"非空即放行"的写法就等于默认放行,禁止')
})

test('T25 父提交取不到(新增活文档):落"未判定",既不判红也绝不静默当零存量', (t) => {
  // 纯函数面**先跑**,并且用另一枚仓:CLI 那一档如果落成了,HEAD 就带上这个文件了,
  // 再拿同一个 dir 问判据问到的已是"存量"而不是"取不到" —— 那种断言不是测本案,只是恰好不红。
  const pure = makeRepo(t)
  writeFileSync(join(pure, 'PROJECT_PLAN.md'), `# PROJECT_PLAN\n\n${MAL_GG}\n`)
  writeFileSync(join(pure, 'notes.md'), `# 说明\n\n${MAL_DD}\n`)
  const g = __test__.detectMalformedLiveDocIds({ root: pure, paths: ['PROJECT_PLAN.md', 'notes.md'], baseRef: 'HEAD' })
  assert.equal(g.scanned, 1, '只有清单内的路径算射程')
  assert.equal(g.ok, true, '未判定不得被折成拒绝(那是恒红门那一型)')
  assert.equal(g.undetermined.length, 1, '未判定必须逐条报名,不许只报一个数')
  assert.equal(g.offenders.length, 0)
  assert.equal(g.stock.length, 0, '判不出时"存量"必须是空数组,不是 0 行那个假数')
  assert.match(g.undetermined[0].reason, /新文件/)

  const dir = makeRepo(t) // a.txt/sub/keep.txt 都在,PROJECT_PLAN.md 从未进过任何提交 ⇒ 父提交面取不到
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# PROJECT_PLAN\n\n${MAL_GG}\n`)
  const r = runLand(dir, { paths: 'PROJECT_PLAN.md', msg: 'docs(plan): 新建活文档,带一行畸形号', skipWatermark: true })
  const out = r.stderr + r.stdout
  assert.equal(r.status, 0, `无父提交不得判红,实得 ${r.status}:${out}`)
  assert.match(out, /未判定/, '必须点名"未判定"这一态')
  assert.match(out, /取不到该路径正文\(新文件 \/ 对象不可读 \/ 二进制\)/, '原因要写清,不能只喊一句"未判定"')
  assert.match(out, /更不得当"零存量"/, '并把"这不等于存量是零"写进同一句,否则读报告的人会拿它当放行凭据')
  assert.ok(!/本次新增畸形/.test(out), '未判定那一档不得同时产出"新增畸形"结论(那是判得出时才有的话)')
  assert.ok(
    !/已判 1 本活文档\(本次新增畸形 0 行\)/.test(out),
    '"跑了且干净"那句在判不出时不得出现 —— 出现就等于给没判的东西发合格证',
  )
})


// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
