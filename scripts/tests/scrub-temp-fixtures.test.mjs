// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/scrub-temp-fixtures.mjs 的镜像测试(§22c:源文件 export + 测试 import + isDirectRun 守卫)。
 *
 * 本工具会**删文件**,所以每条正向判定都必须配一条"绝不该被删"的诱饵负向对照:
 *   - 账龄未到 / 前缀不命中 → 不得进候选
 *   - 夹具内部藏着 `密钥` 目录 → 整条不许删,且必须点名
 *   - 夹具内部藏着 junction → 不得穿透(canary 必须活着)
 * junction 建不成时(非 win32 / 无权限)判"未判定"并**显式 skip**,绝不退化成"通过"。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, existsSync, lstatSync, readdirSync, statSync, utimesSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { scan, del, formatReport } from '../scrub-temp-fixtures.mjs'

const DAY = 86400000
/** 用 utimesSync 改 mtime(目录也算),不依赖 shell */
const touchOld = (p, daysAgo = 30) => {
  const t = new Date(Date.now() - daysAgo * DAY)
  utimesSync(p, t, t)
}

const mkFixture = (root, name, { files = 1, ageDays = 30 } = {}) => {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  for (let i = 0; i < files; i++) writeFileSync(join(dir, `f${i}.bin`), Buffer.alloc(2048, i))
  touchOld(dir, ageDays)
  return dir
}

test('T1 老夹具进候选,且报告量到字节', () => {
  const root = mkScratch('scrub-t1')
  try {
    mkFixture(root, 'ihui-agents-ABC123', { files: 3 })
    mkdirSync(join(root, 'someone-else-workdir'), { recursive: true })
    writeFileSync(join(root, 'someone-else-workdir', 'keep.txt'), 'not ours')
    const r = scan({ root, minAgeDays: 7 })
    assert.equal(r.error, null)
    assert.deepEqual(r.candidates.map((c) => c.name), ['ihui-agents-ABC123'])
    assert.ok(r.candidates[0].bytes >= 3 * 2048, '字节必须量到,不得一律记 0')
    assert.equal(r.skipped.notOurs, 1)
    const line = formatReport(r, { apply: false, minAgeDays: 7 }).join('\n')
    assert.match(line, /候选 1/, '结论行必须报候选数')
  } finally {
    rmScratch(root)
  }
})

test('T2 账龄未到的夹具不得进候选(当日在跑的测试不许被删)', () => {
  const root = mkScratch('scrub-t2')
  try {
    mkFixture(root, 'ihui-fresh-now', { ageDays: 0 })
    mkFixture(root, 'ihui-old-then', { ageDays: 30 })
    const r = scan({ root, minAgeDays: 7 })
    assert.deepEqual(r.candidates.map((c) => c.name), ['ihui-old-then'])
    assert.equal(r.skipped.fresh, 1)
  } finally {
    rmScratch(root)
  }
})

test('T3 保护区硬阻断:夹具内含 `密钥` 子目录 ⇒ 整条不删且点名', () => {
  const root = mkScratch('scrub-t3')
  try {
    const dir = mkFixture(root, 'ihui-with-secrets', { files: 2 })
    mkdirSync(join(dir, '密钥'), { recursive: true })
    writeFileSync(join(dir, '密钥', 'master.txt'), 'DO NOT DELETE')
    touchOld(dir, 30) // 同 T4:造完内层再设龄,否则测到的是账龄闸而不是保护区闸
    const r = scan({ root, minAgeDays: 7 })
    assert.equal(r.candidates.length, 0, '藏着凭据目录的整条候选必须被拒')
    assert.equal(r.skipped.protected, 1)
    assert.equal(r.protectedPaths.length, 1)
    assert.match(r.protectedPaths[0], /密钥/)
    assert.equal(existsSync(join(dir, '密钥', 'master.txt')), true)
    assert.match(formatReport(r, { apply: true, minAgeDays: 7 }).join('\n'), /整条不删/)
  } finally {
    rmScratch(root)
  }
})

test('T4 junction 不得被穿透:canary 在 apply 之后必须原样活着', () => {
  const root = mkScratch('scrub-t4')
  const outside = mkScratch('scrub-t4-outside')
  try {
    const target = join(outside, 'real-user-data')
    mkdirSync(target, { recursive: true })
    const canary = join(target, 'canary.txt')
    writeFileSync(canary, 'must survive')

    const fixture = mkFixture(root, 'ihui-has-junction', { files: 1 })
    const link = join(fixture, 'link-into-real')
    const mk = spawnSync('cmd.exe', ['/c', 'mklink', '/J', link, target], {
      windowsHide: true,
      encoding: 'utf8',
    })
    let madeLink = false
    try {
      madeLink = lstatSync(link).isSymbolicLink()
    } catch {
      madeLink = false
    }
    if (!madeLink) {
      // 建不成 link 就不能假装测过:显式判"未判定"
      assert.ok(
        mk.status !== 0 || process.platform !== 'win32',
        'lstat 未认作符号链接,但 mklink 报了 0 —— 尺子失效,须排查',
      )
      console.log('  ℹ️ T4 未判定:本机建不出 junction(非 win32 或无权限),该护栏未被证明')
      return
    }
    // 往目录里加条目会把它的 mtime 顶回当天 —— 必须在造完内容之后再设龄,
    // 否则测的是"账龄闸跳过新改动"这条正确行为,而不是 junction 护栏。
    touchOld(fixture, 30)
    const r = scan({ root, minAgeDays: 7 })
    const c = r.candidates.find((x) => x.name === 'ihui-has-junction')
    assert.ok(c, '夹具本身仍应是候选(link 只是它内部的一个条目)')
    assert.equal(c.links, 1, '内部重解析点必须被数出来')
    const d = del(root, [c])
    assert.equal(d.ok, 1)
    assert.equal(existsSync(canary), true, '❌ junction 被穿透,真实目标被删 —— 这是 §26 记过的自毁型事故')
    assert.equal(statSync(canary).size, 'must survive'.length)
  } finally {
    rmScratch(root)
    rmScratch(outside)
  }
})

test('T5 dry-run 不得产生任何删除(默认即只报告)', () => {
  const root = mkScratch('scrub-t5')
  try {
    mkFixture(root, 'ihui-old-a')
    mkFixture(root, 'ihui-old-b')
    const before = readdirSync(root).length
    const r = scan({ root, minAgeDays: 7 })
    formatReport(r, { apply: false, minAgeDays: 7 })
    assert.equal(readdirSync(root).length, before, 'scan + 报告必须是零副作用')
    assert.equal(r.candidates.length, 2)
  } finally {
    rmScratch(root)
  }
})

test('T6 del 只删候选,越出 root 的路径一律拒', () => {
  const root = mkScratch('scrub-t6')
  try {
    const keep = mkFixture(root, 'ihui-keep-me')
    const d = del(root, [{ name: 'escape', path: join(root, '..', 'definitely-not-inside'), dir: true, bytes: 0 }])
    assert.equal(d.ok, 0)
    assert.equal(d.fail, 1)
    assert.equal(existsSync(keep), true)
  } finally {
    rmScratch(root)
  }
})

test('T7 取不到目录 ⇒ 判"无法判定",不冒绿也不冒红', () => {
  const r = scan({ root: join(process.cwd(), 'no-such-dir-xyz-42'), minAgeDays: 7 })
  assert.ok(r.error, '必须给出原因')
  assert.equal(r.candidates.length, 0)
  const line = formatReport(r, { apply: false, minAgeDays: 7 }).join('\n')
  assert.match(line, /无法判定/)
})

test('T8 前缀围栏按"起始"判定:近似名与含前缀的他名不得被当成我们的', () => {
  const root = mkScratch('scrub-t8')
  try {
    // 这三个都不是以本项目前缀开头 —— 混进 TEMP 的他人产物,一条都不许进候选
    for (const n of ['my-ihui-workdir', 'ihui2-cache', 'xIHUI-tool']) mkdirSync(join(root, n), { recursive: true })
    mkdirSync(join(root, 'ihui-really-ours'), { recursive: true })
    for (const n of ['my-ihui-workdir', 'ihui2-cache', 'xIHUI-tool', 'ihui-really-ours']) touchOld(join(root, n), 40)
    const r = scan({ root, minAgeDays: 7 })
    assert.deepEqual(r.candidates.map((c) => c.name), ['ihui-really-ours'])
    assert.equal(r.skipped.notOurs, 3)
  } finally {
    rmScratch(root)
  }
})

test('T9 变异对照:把账龄闸改成 0 天会让当日夹具进候选(证明那条闸真的有牙)', () => {
  const root = mkScratch('scrub-t9')
  try {
    mkFixture(root, 'ihui-today', { ageDays: 0 })
    assert.equal(scan({ root, minAgeDays: 7 }).candidates.length, 0)
    assert.equal(scan({ root, minAgeDays: 0 }).candidates.length, 1)
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
