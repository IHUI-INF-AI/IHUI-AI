// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Z63 席 · Z42 实测崩型的回归锁:旁路落地后的索引/工作树对齐腿不得再因下层形态而崩。
/**
 * landing-worktree-align.test.mjs —— `lib/landing-worktree-align.mjs` 的镜像测试。
 *
 * 立因(Z42 实测):`alignSharedIndex` 的 `lockAbandoned` 档与「轮次耗尽」档把桶写成**数字 0**
 * (`{ moved: 0, already: 0, … }`),而旧代码 `[...(align.moved ?? [])]` 里 `0 ?? []` 仍是 `0`
 * ⇒ `TypeError: 0 is not iterable`,崩在 CAS 之后 ⇒ 每次旁路落地都欠一条"落地欠回写"债,
 * 连"锁龄超上限"的点名与 exit 1 一起丢掉(只剩裸栈)。
 *
 * 判据一律 import 被测出口,本文件不复制任何判据(§0.6/§22c)。
 *
 * 用例:
 *  X1 崩型夹具(真·超龄 index.lock)⇒ RC 正常 + 点名行可 grep;
 *  X1b 同夹具的**反向对照**:旧形态表达式在同样输入下必须抛(证明 X1 不是空断言);
 *  X2 正常对齐 ⇒ 索引==HEAD(diff --cached 0 行)且形态异常点名一条也不产生;
 *  X3 路径不在树:ref 可达(真删除)⇒ 不崩不误判;ref 取空 ⇒ 逐条未判定点名;
 *  X4 paths 混入非字符串(留痕记录缺字段那一型)⇒ 不崩、逐条点名、不进射程;
 *  X5 形状锁:桶的消费不得回到"裸属性取值无守卫"形态(旧行加回即翻红)。
 */
import { existsSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { gitRaw } from '../lib/face-reader.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { casUpdateRef, commitTreeWithIndex } from '../lib/bypass-git.mjs'
import { __test__ as landingAlign } from '../lib/landing-worktree-align.mjs'

const { alignLandingPaths, bucketList, normalizePaths } = landingAlign

function mkRepo() {
  const dir = mkScratch('wt-align-')
  const g = (args) => gitRaw(args, dir, { timeout: 60000 })
  g(['init', '-q', '--initial-branch=main'])
  g(['config', 'user.email', 't@t'])
  g(['config', 'user.name', 't'])
  g(['config', 'core.autocrlf', 'false'])
  writeFileSync(join(dir, 'base.txt'), 'base\n')
  g(['add', '-A'])
  g(['commit', '-qm', 'base'])
  return { dir, g }
}

/** 造"CAS 已完成、索引与磁盘都还停在父提交"的旁路落地终态。 */
function landBypass(dir, entries) {
  const g = (args) => gitRaw(args, dir, { timeout: 60000 })
  const parent = g(['rev-parse', 'HEAD']).trim()
  const { commit } = commitTreeWithIndex({ root: dir, parent, message: 'bypass land', entries })
  assert.ok(commit, 'commit-tree 未产出提交')
  assert.equal(casUpdateRef(commit, parent, { root: dir }), true, 'CAS 应成功')
  return { parent, commit }
}

/** 放一枚**超龄**的 index.lock ⇒ 逼 alignSharedIndex 走 `moved: 0` 那条让路档(Z42 崩因输入)。 */
function plantAgedIndexLock(dir, ageMs = 3_600_000) {
  const lock = join(dir, '.git', 'index.lock')
  writeFileSync(lock, '')
  const old = new Date(Date.now() - ageMs)
  utimesSync(lock, old, old)
  return lock
}

const cachedNameStatus = (dir) =>
  gitRaw(['diff', '--cached', '--name-status'], dir, { timeout: 60000 }).trim()

test('X1 崩型夹具:超龄 index.lock ⇒ 不抛 TypeError,RC 正常且点名行可 grep', () => {
  const { dir } = mkRepo()
  try {
    const path = 'apps/web/src/z42.ts'
    const { parent } = landBypass(dir, [{ path, text: 'export const z42 = 1\n' }])
    const lock = plantAgedIndexLock(dir)
    let r
    assert.doesNotThrow(() => {
      r = alignLandingPaths({ root: dir, paths: [path], parentRef: parent })
    }, '下层返回 moved=0(数字)时本腿不得崩(Z42 实测 TypeError)')
    assert.equal(r.lockAbandoned, true, '锁龄超上限必须如实上报')
    assert.equal(r.alignFailed, false, '让路档不是失败档,两者不得并桶')
    assert.deepEqual(r.aligned, [], '让路时一条也不许冒充已对齐')
    const line = JSON.stringify(r)
    assert.match(line, /锁龄超上限/, 'failed 点名行必须可 grep')
    assert.match(line, /形态不是数组/, '下层桶形态异常必须落「未判定」而不是静默 0 条')
    assert.match(line, /alignSharedIndex 的 moved 桶/, '必须点名是哪个桶(便于归因到那档出口)')
    assert.equal(existsSync(join(dir, path)), false, '让路档不得顺手 checkout 他人可能在写的路径')
    utimesSync(lock, new Date(), new Date())
  } finally {
    rmScratch(dir)
  }
})

test('X1b 反向对照:旧形态表达式遇到同一份让路返回值必须抛(证明 X1 非空断言)', () => {
  const asOldShape = (align) => [...(align.moved ?? []), ...(align.already ?? [])]
  assert.throws(() => asOldShape({ moved: 0, already: 0, lockAbandoned: true }), TypeError)
  // 正向对照:归一化出口把同样的形态收成 null(交调用方落未判定),而不是拿去 spread。
  assert.deepEqual(bucketList([]), [])
  assert.deepEqual(bucketList(['a']), ['a'])
  assert.equal(bucketList(0), null)
  assert.equal(bucketList(undefined), null)
})

test('X2 正常对齐:索引==HEAD、磁盘落盘,且一条形态异常点名也不产生', () => {
  const { dir } = mkRepo()
  try {
    const path = 'packages/app/src/z63.tsx'
    const { parent } = landBypass(dir, [{ path, text: 'export const z63 = 2\n' }])
    const r = alignLandingPaths({ root: dir, paths: [path], parentRef: parent })
    assert.equal(r.lockAbandoned, false)
    assert.equal(r.alignFailed, false)
    assert.deepEqual(r.failed, [], `不应失败:${JSON.stringify(r.failed)}`)
    assert.deepEqual(r.undetermined, [], `正常档不应产生未判定:${JSON.stringify(r.undetermined)}`)
    assert.ok(r.aligned.includes(path), '索引对齐必须逐路径回报')
    assert.ok(r.checkedOut.includes(path), '磁盘仍缺 ⇒ 必须从新 HEAD checkout')
    assert.equal(cachedNameStatus(dir), '', '对齐后 git diff --cached 必须 0 行(尤其 0 条 D)')
    assert.equal(
      gitRaw(['rev-parse', `HEAD:${path}`], dir).trim(),
      gitRaw(['ls-files', '-s', '--', path], dir).trim().split(' ')[1],
      '索引 blob 必须等于 HEAD blob',
    )
  } finally {
    rmScratch(dir)
  }
})

test('X3 路径不在树:ref 可达(真删除)⇒ 不崩不误判;ref 取空 ⇒ 逐条未判定点名', () => {
  const { dir, g } = mkRepo()
  try {
    writeFileSync(join(dir, 'gone.txt'), 'gone\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'add-then-remove'])
    const before = g(['rev-parse', 'HEAD']).trim()
    g(['rm', '-q', 'gone.txt'])
    g(['commit', '-qm', 'remove it'])

    // ① 真不在新树(ref 可达):不崩、不 checkout、也不许编一条"未判定"。
    const ok = alignLandingPaths({ root: dir, paths: ['gone.txt'], parentRef: before, ref: 'HEAD' })
    assert.equal(existsSync(join(dir, 'gone.txt')), false, '删除路径不得被 checkout 回磁盘')
    assert.deepEqual(ok.failed, [])
    assert.deepEqual(ok.undetermined, [], 'ref 可达时的 ABSENT 是真删除,不是取不到输入')

    // ② ref 本身解析不到 ⇒ headBlobOf 同样给 ABSENT,必须如实落未判定(§0.3)。
    const bad = alignLandingPaths({
      root: dir,
      paths: ['base.txt'],
      parentRef: before,
      ref: 'refs/heads/does-not-exist-z63',
    })
    assert.equal(
      bad.undetermined.length,
      1,
      `ref 取空必须逐条点名:${JSON.stringify(bad.undetermined)}`,
    )
    assert.equal(bad.undetermined[0].path, 'base.txt')
    assert.match(bad.undetermined[0].reason, /HEAD 断言取空|解析不到/)
    // 如实分腿:索引侧仍由下层按 HEAD 真判定(可以报 aligned),**落盘侧**一条也不许说成做过。
    assert.deepEqual(bad.checkedOut, [], 'ref 取空时不得 checkout,也不得把没落的盘算进对齐')
    assert.equal(bad.failed.length, 0, '问不到不是失败,是未判定(两档不得并桶)')
  } finally {
    rmScratch(dir)
  }
})

test('X4 paths 混入非字符串(留痕记录缺字段那一型)⇒ 不崩、点名、不进射程', () => {
  const { dir } = mkRepo()
  try {
    const { parent } = landBypass(dir, [{ path: 'src/a.ts', text: 'export const a = 1\n' }])
    const dirty = [undefined, { path: 'src/a.ts' }, '   ', parent]
    assert.doesNotThrow(() => normalizePaths(dirty), '归一化本身不得崩')
    const norm = normalizePaths(dirty)
    assert.deepEqual(norm.list, [parent], '只有非空字符串进射程')
    assert.equal(norm.malformed.length, 3)

    const r = alignLandingPaths({ root: dir, paths: [...dirty, 'src/a.ts'], parentRef: parent })
    assert.equal(
      r.undetermined.length,
      3,
      `三条坏条目必须逐条点名:${JSON.stringify(r.undetermined)}`,
    )
    for (const u of r.undetermined) assert.match(u.reason, /不是非空字符串/)
    assert.ok(r.checkedOut.includes('src/a.ts'), '同批里合法的路径必须照常对齐')
  } finally {
    rmScratch(dir)
  }
})

test('X5 形状锁:桶的消费不得回到「裸属性取值无守卫」形态(旧行加回即翻红)', () => {
  const raw = readFileSync(new URL('../lib/landing-worktree-align.mjs', import.meta.url), 'utf8')
  // 判的是代码形态,注释与字符串一律先遮(头注里必须复述旧崩溃行,不遮会把取证当违规)。
  const src = maskCommentsAndStrings(raw)
  const UNGUARDED = [
    /\.\.\.\s*\(?\s*align\.(moved|already|skipped|undetermined)\b/, // 旧崩溃正身:直接 spread 下层桶
    /align\.(moved|already|skipped|undetermined)\s*\?\?/, // ?? 对 0 不回落 ⇒ 同样是无守卫
  ]
  const hits = UNGUARDED.filter((re) => re.test(src)).map(String)
  assert.deepEqual(hits, [], `对齐腿出现无守卫的桶取值形态:\n${hits.join('\n')}`)
  // 正向对照:被禁的旧形态喂进同一把尺子必须翻红(尺子不是空转)。
  const oldLine = '    aligned: [...(align.moved ?? []), ...(align.already ?? [])],'
  assert.ok(
    UNGUARDED.some((re) => re.test(oldLine)),
    '形状锁必须能认出旧崩溃行',
  )
  assert.ok(
    maskCommentsAndStrings(oldLine).match(UNGUARDED[0]),
    '遮罩后旧形态仍须命中(锁不靠注释措辞)',
  )
  // 现形态必须经由归一化出口消费桶(只有一份守卫)。
  assert.match(raw, /bucketList/, '守卫实现必须存在')
  assert.match(raw, /const moved = pick\('moved'\)/, '四个桶必须同一条归一化通道')
})

test('X6 夹具落点:临时 git 仓只落批准 scratch 根(§15b/§15c)', () => {
  const dir = mkScratch('wt-align-sanity-')
  try {
    assert.match(
      dir.replace(/\\/g, '/'),
      /\.DevEnv\/Temp\/ihui-scratch\/wt-align-sanity-/,
      `夹具落点不对:${dir}`,
    )
    assert.ok(existsSync(dir))
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
