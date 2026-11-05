// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 更新包逐文件 sha256 自校验 — 判据测试(2026-11-04 立)。
// 覆盖:正常通过 / sha256 不符 / size 不符 / 文件缺失 / 清单缺项 / 清单多项 /
// 清单损坏(JSON/schemaVersion/形状/重复/非法路径/非法 hash)/多问题不短路 / 真实目录往返。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildUpdateFileManifest,
  checkDesktopFeedCoverage,
  mergeExternalAssets,
  parseExternalAssets,
  parseUpdateFileManifest,
  sha256File,
  verifyDirectory,
  verifyUpdateFileManifest,
  writeUpdateFileManifest,
} from '../update-file-manifest.mjs'

const hash = (s) => createHash('sha256').update(s).digest('hex')

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'ihui-upd-manifest-'))
}

/** 造一份与实际文件一致的清单。 */
function validManifest(entries) {
  return {
    schemaVersion: 1,
    generatedAt: '2026-11-04T00:00:00Z',
    files: entries.map(([path, content]) => ({ path, sha256: hash(content), size: Buffer.byteLength(content) })),
  }
}

function actual(entries) {
  return entries.map(([path, content]) => ({
    path,
    sha256: hash(content),
    size: Buffer.byteLength(content),
  }))
}

test('正常通过:三文件 sha256/size 全匹配 ⇒ ok', () => {
  const manifest = validManifest([
    ['desktop/a.exe', 'AAA'],
    ['desktop/a.exe.sig', 'sig'],
    ['latest.json', '{"v":1}'],
  ])
  const r = verifyUpdateFileManifest(manifest, actual([
    ['desktop/a.exe', 'AAA'],
    ['desktop/a.exe.sig', 'sig'],
    ['latest.json', '{"v":1}'],
  ]))
  assert.equal(r.ok, true)
  assert.equal(r.issues.length, 0)
  assert.equal(r.checked.manifestFiles, 3)
  assert.equal(r.checked.actualFiles, 3)
})

test('单文件 sha256 不符(same size):点名该文件并给出期望/实际', () => {
  const manifest = validManifest([['a.bin', 'abcd']])
  const r = verifyUpdateFileManifest(manifest, actual([['a.bin', 'abce']]))
  assert.equal(r.ok, false)
  const issue = r.issues.find((i) => i.code === 'sha256_mismatch')
  assert.ok(issue, '必须报 sha256_mismatch')
  assert.equal(issue.path, 'a.bin')
  assert.equal(issue.expected, hash('abcd'))
  assert.equal(issue.actual, hash('abce'))
})

test('size 不符:报字节数期望/实际', () => {
  const manifest = validManifest([['a.bin', 'abc']])
  const r = verifyUpdateFileManifest(manifest, [{ path: 'a.bin', sha256: hash('abc'), size: 99 }])
  const issue = r.issues.find((i) => i.code === 'size_mismatch')
  assert.ok(issue, '必须报 size_mismatch')
  assert.equal(issue.expected, 3)
  assert.equal(issue.actual, 99)
})

test('文件缺失:清单项在包里找不到 ⇒ file_missing + 清单多项分类', () => {
  const manifest = validManifest([['a.bin', 'abc'], ['b.txt', 'x']])
  const r = verifyUpdateFileManifest(manifest, actual([['b.txt', 'x']]))
  assert.equal(r.ok, false)
  const issue = r.issues.find((i) => i.path === 'a.bin')
  assert.equal(issue.code, 'file_missing')
  assert.equal(issue.category, 'manifest_extra_entry')
})

test('清单缺项:包里多出未登记文件 ⇒ manifest_missing_entry', () => {
  const manifest = validManifest([['a.bin', 'abc']])
  const r = verifyUpdateFileManifest(manifest, actual([['a.bin', 'abc'], ['stray.dll', 'zzz']]))
  assert.equal(r.ok, false)
  const issue = r.issues.find((i) => i.code === 'manifest_missing_entry')
  assert.equal(issue.path, 'stray.dll')
  assert.equal(issue.actual.size, 3)
})

test('清单多项:清单里塞一个不存在的路径 ⇒ 必须点名该路径', () => {
  const manifest = validManifest([['a.bin', 'abc'], ['ghost/never-exists.dat', 'g']])
  const r = verifyUpdateFileManifest(manifest, actual([['a.bin', 'abc']]))
  const issue = r.issues.find((i) => i.path === 'ghost/never-exists.dat')
  assert.ok(issue)
  assert.equal(issue.category, 'manifest_extra_entry')
  assert.match(issue.message, /清单多项/)
})

test('清单本身损坏:非法 JSON ⇒ ok=false 且 code=manifest_corrupt', () => {
  const p = parseUpdateFileManifest('{not json')
  assert.equal(p.ok, false)
  assert.equal(p.manifest, null)
  assert.equal(p.issues[0].code, 'manifest_corrupt')
})

test('清单本身损坏:schemaVersion 不符', () => {
  const p = parseUpdateFileManifest({ schemaVersion: 2, files: [] })
  assert.equal(p.ok, false)
  assert.equal(p.issues[0].code, 'manifest_corrupt')
})

test('清单本身损坏:files 不是数组', () => {
  const p = parseUpdateFileManifest({ schemaVersion: 1, files: 'nope' })
  assert.equal(p.ok, false)
  assert.match(p.issues[0].message, /files/)
})

test('清单本身损坏:重复路径 ⇒ duplicate_entry', () => {
  const p = parseUpdateFileManifest({
    schemaVersion: 1,
    files: [
      { path: 'a.bin', sha256: hash('a'), size: 1 },
      { path: 'a.bin', sha256: hash('b'), size: 1 },
    ],
  })
  assert.equal(p.ok, false)
  assert.equal(p.issues[0].code, 'duplicate_entry')
})

test('清单本身损坏:绝对路径/盘符/../ 一律拒绝', () => {
  for (const bad of ['/etc/passwd', 'C:\\x.exe', '../escape.bin', 'a//b.bin']) {
    const p = parseUpdateFileManifest({
      schemaVersion: 1,
      files: [{ path: bad, sha256: hash('x'), size: 1 }],
    })
    assert.equal(p.ok, false, `应拒绝路径 ${bad}`)
    assert.equal(p.issues[0].code, 'manifest_corrupt')
  }
})

test('清单本身损坏:sha256 非 64 位小写十六进制', () => {
  const p = parseUpdateFileManifest({
    schemaVersion: 1,
    files: [{ path: 'a.bin', sha256: 'ABC', size: 1 }],
  })
  assert.equal(p.ok, false)
  assert.equal(p.issues[0].code, 'manifest_corrupt')
})

test('多问题不短路:sha 不符 + 清单缺项同时报出', () => {
  const manifest = validManifest([['a.bin', 'abcd']])
  const r = verifyUpdateFileManifest(manifest, [
    { path: 'a.bin', sha256: hash('abce'), size: 4 },
    { path: 'extra.bin', sha256: hash('e'), size: 1 },
  ])
  assert.equal(r.ok, false)
  assert.equal(r.issues.length, 2)
  assert.deepEqual(r.issues.map((i) => i.code).sort(), ['manifest_missing_entry', 'sha256_mismatch'])
})

test('真实目录:生成清单 → 核对通过 → 篡改 1 字节后点名该文件', async () => {
  const dir = tmpDir()
  try {
    mkdirSync(join(dir, 'desktop'), { recursive: true })
    writeFileSync(join(dir, 'desktop', 'a.exe'), 'AAAA')
    writeFileSync(join(dir, 'latest.json'), '{"v":1}')
    const out = join(dir, '..', `${Math.random().toString(16).slice(2)}.json`)
    const manifest = await writeUpdateFileManifest(dir, out)
    assert.equal(manifest.files.length, 2)
    // 生成时不把清单自身算进文件集(out 在目录外)
    const okResult = await verifyDirectory(dir, manifest)
    assert.equal(okResult.ok, true, JSON.stringify(okResult.issues))

    writeFileSync(join(dir, 'desktop', 'a.exe'), 'AAAB')
    const bad = await verifyDirectory(dir, manifest)
    assert.equal(bad.ok, false)
    const issue = bad.issues.find((i) => i.code === 'sha256_mismatch')
    assert.equal(issue.path, 'desktop/a.exe')
    assert.equal(issue.expected, hash('AAAA'))
    assert.equal(issue.actual, hash('AAAB'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('真实目录:删掉一个真实文件项后报清单缺项', async () => {
  const dir = tmpDir()
  try {
    writeFileSync(join(dir, 'a.bin'), 'a')
    writeFileSync(join(dir, 'b.bin'), 'b')
    const manifest = await buildUpdateFileManifest(dir)
    const trimmed = { ...manifest, files: manifest.files.filter((f) => f.path !== 'b.bin') }
    const r = await verifyDirectory(dir, trimmed)
    assert.equal(r.ok, false)
    const issue = r.issues.find((i) => i.code === 'manifest_missing_entry')
    assert.equal(issue.path, 'b.bin')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('真实目录:清单塞不存在路径后报清单多项', async () => {
  const dir = tmpDir()
  try {
    writeFileSync(join(dir, 'a.bin'), 'a')
    const manifest = await buildUpdateFileManifest(dir)
    const padded = {
      ...manifest,
      files: [...manifest.files, { path: 'ghost.bin', sha256: hash('g'), size: 1 }],
    }
    const r = await verifyDirectory(dir, padded)
    assert.equal(r.ok, false)
    const issue = r.issues.find((i) => i.path === 'ghost.bin')
    assert.equal(issue.category, 'manifest_extra_entry')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('清单落在包目录内时自我排除,重复校验仍通过(不自指缺项)', async () => {
  const dir = tmpDir()
  try {
    writeFileSync(join(dir, 'a.bin'), 'a')
    const manifest = await writeUpdateFileManifest(dir, join(dir, 'update-files.json'))
    const r = await verifyDirectory(dir, manifest)
    assert.equal(r.ok, true, JSON.stringify(r.issues))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('sha256File 流式哈希与内存哈希一致', async () => {
  const dir = tmpDir()
  try {
    const p = join(dir, 'x.bin')
    writeFileSync(p, 'hello')
    assert.equal(await sha256File(p), hash('hello'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ==== 桌面更新包外部权威条目(2026-11-05 立:根治清单缺 desktop/* 导致更新必失败) ====

const DESKTOP_ASSETS = [
  ['AI_0.1.77_x64-setup.exe', 'EXE-BYTES'],
  ['AI_0.1.77_amd64.AppImage', 'APPIMAGE-BYTES'],
  ['AI_universal.app.tar.gz', 'MAC-TARGZ-BYTES'],
]

function externalFixture() {
  return {
    schemaVersion: 1,
    version: '0.1.77',
    tag: 'desktop-v0.1.77',
    assets: DESKTOP_ASSETS.map(([name, body]) => ({
      name,
      size: Buffer.byteLength(body),
      sha256: hash(body),
      url: `https://gitee.com/x/y/releases/download/desktop-v0.1.77/${name}`,
      source: 'github-release-digest',
      giteeSizeVerified: true,
    })),
  }
}

function feedTextFor(names = DESKTOP_ASSETS.map(([n]) => n)) {
  return JSON.stringify({
    version: '0.1.77',
    platforms: Object.fromEntries(
      names.map((n, i) => [`p${i}`, { signature: 'sig', url: `https://gitee.com/x/y/releases/download/desktop-v0.1.77/${n}` }]),
    ),
  })
}

test('元数据解析:合法资产名 ⇒ desktop/ 路径;路径段/坏 hash/重复/坏 schema 一律拒绝', () => {
  const ok = parseExternalAssets(externalFixture())
  assert.equal(ok.ok, true)
  assert.equal(ok.assets.length, 3)
  assert.deepEqual(
    ok.assets.map((a) => a.path).sort(),
    ['desktop/AI_0.1.77_amd64.AppImage', 'desktop/AI_0.1.77_x64-setup.exe', 'desktop/AI_universal.app.tar.gz'],
  )
  const badName = parseExternalAssets({
    schemaVersion: 1,
    assets: [{ name: '../evil.exe', size: 1, sha256: 'f'.repeat(64) }],
  })
  assert.equal(badName.ok, false)
  assert.equal(badName.assets.length, 0)
  assert.equal(badName.issues[0].code, 'external_assets_corrupt')
  assert.match(badName.issues[0].message, /资产名非法/)
  const badHash = parseExternalAssets({ schemaVersion: 1, assets: [{ name: 'a.exe', size: 1, sha256: 'zz' }] })
  assert.equal(badHash.ok, false)
  const dup = parseExternalAssets({
    schemaVersion: 1,
    assets: [
      { name: 'a.exe', size: 1, sha256: 'f'.repeat(64) },
      { name: 'a.exe', size: 2, sha256: 'e'.repeat(64) },
    ],
  })
  assert.equal(dup.ok, false)
  assert.match(dup.issues[0].message, /资产名重复/)
  const badSchema = parseExternalAssets({ schemaVersion: 2, assets: [] })
  assert.equal(badSchema.ok, false)
})

test('外部条目合入:本地 2 条 + 外部 3 条 ⇒ 5 条按路径排序;同名但字节不符 ⇒ external_entry_conflict', () => {
  const local = validManifest([
    ['extension/a.zip', 'zip'],
    ['manifest.json', '{}'],
  ])
  const assets = parseExternalAssets(externalFixture()).assets
  const merged = mergeExternalAssets(local, assets)
  assert.equal(merged.issues.length, 0)
  assert.deepEqual(merged.files.map((f) => f.path), [
    'desktop/AI_0.1.77_amd64.AppImage',
    'desktop/AI_0.1.77_x64-setup.exe',
    'desktop/AI_universal.app.tar.gz',
    'extension/a.zip',
    'manifest.json',
  ])
  const conflicting = mergeExternalAssets(
    { files: [{ path: 'desktop/AI_0.1.77_x64-setup.exe', sha256: 'f'.repeat(64), size: 1 }] },
    assets,
  )
  assert.equal(conflicting.issues[0].code, 'external_entry_conflict')
})

test('反向例(线上旧清单只有 2 条)+ 权威元数据 ⇒ external_entry_missing 逐条拦下', () => {
  const oldManifest = validManifest([
    ['extension/ext.zip', 'zip'],
    ['manifest.json', '{}'],
  ])
  const assets = parseExternalAssets(externalFixture()).assets
  const r = verifyUpdateFileManifest(oldManifest, actual([
    ['extension/ext.zip', 'zip'],
    ['manifest.json', '{}'],
  ]), { externalAssets: assets })
  assert.equal(r.ok, false)
  assert.deepEqual(
    r.issues.map((i) => i.code),
    ['external_entry_missing', 'external_entry_missing', 'external_entry_missing'],
  )
  assert.equal(r.checked.externalFiles, 3)
})

test('正向:清单含 desktop 条目、目录里没有实物 ⇒ 凭权威元数据放行;漏传元数据 ⇒ file_missing 必红', async () => {
  const dir = tmpDir()
  try {
    writeFileSync(join(dir, 'a.bin'), 'a')
    const assets = parseExternalAssets(externalFixture()).assets
    const manifest = mergeExternalAssets(validManifest([['a.bin', 'a']]), assets)
    const r = await verifyDirectory(dir, { schemaVersion: 1, generatedAt: 'x', files: manifest.files }, { externalAssets: assets })
    assert.equal(r.ok, true, JSON.stringify(r.issues))
    assert.equal(r.checked.manifestFiles, 4)
    assert.equal(r.checked.actualFiles, 1)
    const noExternal = await verifyDirectory(dir, { schemaVersion: 1, generatedAt: 'x', files: manifest.files })
    assert.equal(noExternal.ok, false)
    assert.deepEqual(
      noExternal.issues.map((i) => i.code),
      ['file_missing', 'file_missing', 'file_missing'],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('桌面更新源反查:引用的资产名未登记 ⇒ desktop_feed_uncovered;全登记 ⇒ 通过', () => {
  const full = mergeExternalAssets({ files: [] }, parseExternalAssets(externalFixture()).assets).files
  const ok = checkDesktopFeedCoverage(feedTextFor(), full)
  assert.equal(ok.ok, true)
  assert.equal(ok.required.length, 3)
  const missing = checkDesktopFeedCoverage(
    feedTextFor(),
    full.filter((f) => !f.path.includes('AppImage')),
  )
  assert.equal(missing.ok, false)
  assert.equal(missing.issues.length, 1)
  assert.equal(missing.issues[0].code, 'desktop_feed_uncovered')
  assert.match(missing.issues[0].message, /AI_0.1.77_amd64.AppImage/)
})

test('桌面更新源反查:必须容忍 prettier 重排(单引号/无引号键),不得因格式差异静默放行', () => {
  const prettierFeed = `export const DESKTOP_LATEST = {
  version: '0.1.77',
  platforms: {
    'windows-x86_64': { url: 'https://gitee.com/x/y/releases/download/desktop-v0.1.77/AI_0.1.77_x64-setup.exe' },
    'linux-x86_64': { url: 'https://gitee.com/x/y/releases/download/desktop-v0.1.77/AI_0.1.77_amd64.AppImage' },
  },
}
`
  const cov = checkDesktopFeedCoverage(prettierFeed, [])
  assert.equal(cov.required.length, 2)
  assert.equal(cov.ok, false)
  assert.deepEqual(cov.issues.map((i) => i.path), [
    'desktop/AI_0.1.77_x64-setup.exe',
    'desktop/AI_0.1.77_amd64.AppImage',
  ])
})

test('真实目录生成含外部条目 ⇒ verify 通过;清单删掉该条目 ⇒ 反查拦下', async () => {
  const dir = tmpDir()
  try {
    writeFileSync(join(dir, 'a.bin'), 'a')
    const assets = parseExternalAssets(externalFixture()).assets
    const manifest = await buildUpdateFileManifest(dir, assets)
    assert.equal(manifest.files.length, 4)
    const r = await verifyDirectory(dir, manifest, { externalAssets: assets })
    assert.equal(r.ok, true)
    const crippled = { ...manifest, files: manifest.files.filter((f) => !f.path.endsWith('x64-setup.exe')) }
    const coverage = checkDesktopFeedCoverage(feedTextFor(), crippled.files)
    assert.equal(coverage.ok, false)
    assert.equal(coverage.issues[0].code, 'desktop_feed_uncovered')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI(部署链形态):generate/verify 自动读 --external-assets;缺条目时 verify 退出码 1', () => {
  const root = tmpDir()
  try {
    const surface = join(root, 'surface')
    mkdirSync(surface)
    writeFileSync(join(surface, 'a.bin'), 'a')
    const extPath = join(root, 'desktop-update-assets.json')
    writeFileSync(extPath, JSON.stringify(externalFixture()))
    const script = fileURLToPath(new URL('../update-file-manifest.mjs', import.meta.url))
    const run = (args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
    const gen = run(['generate', '--dir', surface, '--external-assets', extPath, '--no-desktop-feed-check'])
    assert.equal(gen.status, 0, gen.stderr || gen.stdout)
    assert.equal(JSON.parse(readFileSync(join(surface, 'update-files.json'), 'utf8')).files.length, 4)
    const ok = run(['verify', '--dir', surface, '--external-assets', extPath, '--no-desktop-feed-check'])
    assert.equal(ok.status, 0, ok.stdout + ok.stderr)
    const blocked = run(['verify', '--dir', surface, '--no-external-assets', '--no-desktop-feed-check'])
    assert.equal(blocked.status, 1)
    assert.match(blocked.stdout + blocked.stderr, /package_entry_missing|file_missing/)
    const uncovered = run(['verify', '--dir', surface, '--external-assets', extPath, '--desktop-feed', join(root, 'feed.json')])
    // feed 文件不存在 ⇒ 参数校验失败(退出码 2),证明不会静默跳过反查
    assert.equal(uncovered.status, 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
