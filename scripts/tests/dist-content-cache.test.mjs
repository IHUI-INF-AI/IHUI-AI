// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// dist 内容寻址夹具(2026-11-07):证明"mtime 变了但内容没变"不重建,内容真变/产物缺失必重建。
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkContentFresh,
  expectedArtifacts,
  manifestPath,
  readManifest,
  sourceFingerprint,
  writeManifest,
} from '../lib/dist-content-cache.mjs'

const TMP = mkdtempSync(join(tmpdir(), 'ihui-dist-'))
process.on('exit', () => {
  try {
    rmSync(TMP, { recursive: true, force: true })
  } catch {
    /* 忽略 */
  }
})

function makePkg(name) {
  const dir = join(TMP, name)
  mkdirSync(join(dir, 'src'), { recursive: true })
  mkdirSync(join(dir, 'dist'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, scripts: { build: 'tsc' } }))
  writeFileSync(join(dir, 'tsconfig.json'), '{"compilerOptions":{}}')
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1\n')
  writeFileSync(join(dir, 'src', 'b.ts'), 'export const b = 2\n')
  for (const rel of ['a.js', 'a.d.ts', 'b.js', 'b.d.ts']) {
    writeFileSync(join(dir, 'dist', rel), `// ${rel}\n`)
  }
  return { name, dir }
}

const root = join(TMP, 'root')
const entry = makePkg('@ihui/probe')

test('D1 产物清单按 src 推导;.d.ts 输入不产出', () => {
  writeFileSync(join(entry.dir, 'src', 'manual.d.ts'), 'export type X = 1\n')
  assert.deepEqual(expectedArtifacts(entry.dir), ['a.d.ts', 'a.js', 'b.d.ts', 'b.js'])
})

test('D2 首次落 manifest 后内容一致 ⇒ fresh', () => {
  assert.equal(writeManifest(root, entry).ok, true)
  const m = readManifest(root, entry.name, entry)
  assert.equal(m.artifacts.length, 4)
  assert.equal(typeof m.artifacts[0].hash, 'string', '产物必须记 sha256')
  assert.equal(checkContentFresh(root, entry).fresh, true)
})

test('D3 只掀 mtime(内容一字未变) ⇒ 仍 fresh(这正是 checkout 假重建的解药)', () => {
  const future = new Date(Date.now() + 3600_000)
  utimesSync(join(entry.dir, 'src', 'a.ts'), future, future)
  const r = checkContentFresh(root, entry)
  assert.equal(r.fresh, true, `mtime-only 变化不得判重建:${r.reason}`)
  // 反向对照:源码内容真变 ⇒ 必须不 fresh。
  writeFileSync(join(entry.dir, 'src', 'a.ts'), 'export const a = 42\n')
  const changed = checkContentFresh(root, entry)
  assert.equal(changed.fresh, false)
  assert.match(changed.reason, /源码内容已变/)
})

test('D4 产物缺失 ⇒ 不 fresh(fail-closed,不许拿半份 dist 下结论)', () => {
  writeFileSync(join(entry.dir, 'src', 'a.ts'), 'export const a = 1\n')
  assert.equal(writeManifest(root, entry).ok, true)
  rmSync(join(entry.dir, 'dist', 'b.d.ts'))
  const r = checkContentFresh(root, entry)
  assert.equal(r.fresh, false)
  assert.match(r.reason, /产物|不符|缺失/)
})

test('D5 产物内容被篡改 ⇒ 不 fresh(sha256 复核,不是只看存在)', () => {
  writeFileSync(join(entry.dir, 'dist', 'b.d.ts'), '// tampered\n')
  const r = checkContentFresh(root, entry)
  assert.equal(r.fresh, false)
  assert.match(r.reason, /不符/)
})

test('D6 产物缺到写不出 manifest ⇒ writeManifest 必须拒绝(不许播种半份快照)', () => {
  rmSync(join(entry.dir, 'dist', 'a.js'))
  const w = writeManifest(root, entry)
  assert.equal(w.ok, false)
})

test('D7 源码指纹与文件集合相关:新增文件必须改变指纹', () => {
  writeFileSync(join(entry.dir, 'dist', 'a.js'), '// a.js\n')
  const before = sourceFingerprint(entry.dir).hash
  writeFileSync(join(entry.dir, 'src', 'c.ts'), 'export const c = 3\n')
  const after = sourceFingerprint(entry.dir).hash
  assert.notEqual(before, after, '新增源码文件必须触发重建')
})

// ── 2026-11-08:缓存键必须绑定构建根/outDir/tsbuildinfo,禁止跨根复用 ──
// 病根:多 worktree 共享主区 node_modules 时 manifest 物理上是同一份;
// 键里不带构建根,则 A 根"内容已构建"的结论会被 B 根直接拿来用(假绿/假红都由此起)。
test('D8 同一包在 A 根落的 manifest,B 根不可复用(键必须按根分桶)', () => {
  const rootA = join(TMP, 'rootA')
  const rootB = join(TMP, 'rootB')
  const e = makePkg('@ihui/rootprobe')
  assert.equal(writeManifest(rootA, e).ok, true)
  assert.equal(checkContentFresh(rootA, e).fresh, true)
  const b = checkContentFresh(rootB, e)
  assert.equal(b.fresh, false, 'B 根不得复用 A 根的 manifest')
  assert.match(b.reason, /无 manifest/)
  assert.notEqual(manifestPath(rootA, e.name, e), manifestPath(rootB, e.name, e))
})

test('D9 manifest 记录的构建身份不符 ⇒ 拒绝复用,并点名两套构建面', () => {
  const rootC = join(TMP, 'rootC')
  const e = makePkg('@ihui/identprobe')
  assert.equal(writeManifest(rootC, e).ok, true)
  const p = manifestPath(rootC, e.name, e)
  const m = JSON.parse(readFileSync(p, 'utf8'))
  assert.equal(m.schema, 2, 'manifest 必须升到 schema=2 并携带 buildIdentity')
  m.buildIdentity.outDir = 'x:/other-root/packages/x/dist'
  writeFileSync(p, JSON.stringify(m))
  const r = checkContentFresh(rootC, e)
  assert.equal(r.fresh, false)
  assert.match(r.reason, /构建身份不符/)
  assert.match(r.reason, /x:\/other-root\/packages\/x\/dist/, '错误信息必须点名记录里的另一套 outDir')
})

test('D10 tsBuildInfoFile / outDir 不同 ⇒ 缓存键不同(禁止共用同一缓存条目)', () => {
  const rootD = join(TMP, 'rootD')
  const mk = (dir, buildInfo, outDir) => {
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { outDir, tsBuildInfoFile: buildInfo } }),
    )
    return { name: '@ihui/keyprobe', dir }
  }
  const e1 = mk(join(TMP, 'keyA'), '../../cache/a.tsbuildinfo', './dist')
  const e2 = mk(join(TMP, 'keyB'), '../../cache/b.tsbuildinfo', './dist')
  const e3 = mk(join(TMP, 'keyC'), '../../cache/a.tsbuildinfo', './out')
  const key = (e) => manifestPath(rootD, e.name, e)
  assert.notEqual(key(e1), key(e2), 'tsbuildinfo 路径不同必须换键')
  assert.notEqual(key(e1), key(e3), '产物输出根不同必须换键')
  assert.equal(key(e1), key(mk(join(TMP, 'keyA'), '../../cache/a.tsbuildinfo', './dist')), '同构身份必须落同一键')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
