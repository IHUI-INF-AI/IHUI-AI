// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as B } from '../bake-desktop-latest.mjs'

const latest = {
  version: '0.1.77',
  notes: 'fixture',
  pub_date: '2026-10-20T00:00:00.000Z',
  platforms: {
    'windows-x86_64': {
      signature: 'sig-win',
      url: 'https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v0.1.77/AI_0.1.77_x64-setup.exe',
    },
    'linux-x86_64': {
      signature: 'sig-linux',
      url: 'https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v0.1.77/AI_0.1.77_amd64.AppImage',
    },
    'darwin-x86_64': {
      signature: 'sig-mac',
      url: 'https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v0.1.77/AI_universal.app.tar.gz',
    },
    'darwin-aarch64': {
      signature: 'sig-mac',
      url: 'https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v0.1.77/AI_universal.app.tar.gz',
    },
  },
}
const GITEE =
  'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/desktop-v0.1.77/AI_0.1.77_x64-setup.exe'

test('字节相等 ⇒ Windows 直链改写为 Gitee,其余平台与签名逐字不动', () => {
  const r = B.bakeDesktopLatest({ latest, githubSize: 10142082, giteeSize: 10142082, giteeUrl: GITEE })
  assert.equal(r.verdict, 'same')
  assert.equal(r.data.platforms['windows-x86_64'].url, GITEE)
  assert.equal(r.data.platforms['windows-x86_64'].signature, 'sig-win')
  assert.equal(r.data.platforms['linux-x86_64'].url, latest.platforms['linux-x86_64'].url)
  assert.equal(r.data.platforms['darwin-aarch64'].url, latest.platforms['darwin-aarch64'].url)
  assert.ok(r.reason.includes('一致'))
})

test('字节不等 ⇒ 保留 GitHub 并大声报原因(绝不静默改写)', () => {
  const r = B.bakeDesktopLatest({ latest, githubSize: 10142082, giteeSize: 10146255, giteeUrl: GITEE })
  assert.equal(r.verdict, 'different')
  assert.equal(r.data.platforms['windows-x86_64'].url, latest.platforms['windows-x86_64'].url)
  assert.ok(r.reason.includes('不一致'))
})

test('字节量不到 ⇒ 未判定 ⇒ 保留 GitHub', () => {
  const r = B.bakeDesktopLatest({ latest, githubSize: 0, giteeSize: 0, giteeUrl: GITEE })
  assert.equal(r.verdict, 'undetermined')
  assert.equal(r.data.platforms['windows-x86_64'].url, latest.platforms['windows-x86_64'].url)
  assert.ok(r.reason.includes('未判定'))
})

test('字节相等但未给出 Gitee URL ⇒ 保留 GitHub(未判定)', () => {
  const r = B.bakeDesktopLatest({ latest, githubSize: 100, giteeSize: 100, giteeUrl: '' })
  assert.equal(r.verdict, 'same')
  assert.equal(r.data.platforms['windows-x86_64'].url, latest.platforms['windows-x86_64'].url)
  assert.ok(r.reason.includes('未给出'))
})

test('deriveGiteeUrl:同 owner/repo,只换 tag 与资产名', () => {
  const old = 'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/desktop-v0.1.76/AI_0.1.76_x64-setup.exe'
  assert.equal(B.deriveGiteeUrl({ existingUrl: old, tag: 'desktop-v0.1.77', assetName: 'AI_0.1.77_x64-setup.exe' }), GITEE)
  assert.equal(B.deriveGiteeUrl({ existingUrl: 'https://github.com/x/y', tag: 't', assetName: 'a' }), null)
})

test('extractGeneratedObject 能从带水印尾行的 TS 里取回纯 JSON;坏输入返回 null', () => {
  const ts = `${B.serializeGenerated(latest)}{'\\u2060\\u200b'}`
  assert.deepEqual(B.extractGeneratedObject(ts), latest)
  assert.equal(B.extractGeneratedObject('no marker'), null)
  assert.equal(B.extractGeneratedObject('export const DESKTOP_LATEST = { bad'), null)
})

test('buildGiteeUrl / assetNameOf / detectGiteeRepo:显式构造与派生', () => {
  assert.equal(
    B.buildGiteeUrl({ owner: 'JLSLSSZWHYXGS_0', repo: 'IHUI-AI', tag: 'desktop-v0.1.77', assetName: 'AI_0.1.77_x64-setup.exe' }),
    GITEE,
  )
  assert.equal(B.buildGiteeUrl({ owner: '', repo: 'IHUI-AI', tag: 't', assetName: 'a' }), null)
  assert.equal(B.assetNameOf('https://gitee.com/o/r/releases/download/t/AI_x64-setup.exe'), 'AI_x64-setup.exe')
  assert.equal(B.assetNameOf('not-a-url'), '')
  assert.deepEqual(B.detectGiteeRepo({ platforms: { 'windows-x86_64': { url: GITEE } } }), {
    owner: 'JLSLSSZWHYXGS_0',
    repo: 'IHUI-AI',
  })
  assert.equal(B.detectGiteeRepo({ platforms: { 'windows-x86_64': { url: latest.platforms['windows-x86_64'].url } } }), null)
})

const GH_SIZES = {
  'AI_0.1.77_x64-setup.exe': 9690695,
  'AI_0.1.77_amd64.AppImage': 86968824,
  'AI_universal.app.tar.gz': 13646808,
}

test('bakeDesktopPlatforms:四平台字节全等 ⇒ 全部改写 Gitee,签名逐字不动', () => {
  const r = B.bakeDesktopPlatforms({
    latest,
    tag: 'desktop-v0.1.77',
    githubSizes: GH_SIZES,
    giteeSizes: { ...GH_SIZES },
    owner: 'JLSLSSZWHYXGS_0',
    repo: 'IHUI-AI',
  })
  assert.equal(r.changed, 4)
  assert.equal(r.blocked, false)
  for (const [k, v] of Object.entries(r.data.platforms)) {
    assert.ok(v.url.startsWith('https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/desktop-v0.1.77/'), k)
    assert.equal(v.signature, latest.platforms[k].signature, k)
  }
  assert.ok(r.decisions['linux-x86_64'].reason.includes('字节一致'))
})

test('bakeDesktopPlatforms:某平台 Gitee 资产缺失/字节不等 ⇒ 该平台保留 GitHub,其余照改', () => {
  const giteeSizes = { 'AI_0.1.77_x64-setup.exe': 9690695, 'AI_universal.app.tar.gz': 13646808 }
  const r = B.bakeDesktopPlatforms({
    latest,
    tag: 'desktop-v0.1.77',
    githubSizes: GH_SIZES,
    giteeSizes,
    owner: 'JLSLSSZWHYXGS_0',
    repo: 'IHUI-AI',
  })
  assert.equal(r.changed, 3)
  assert.equal(r.data.platforms['linux-x86_64'].url, latest.platforms['linux-x86_64'].url)
  assert.equal(r.decisions['linux-x86_64'].verdict, 'undetermined')
  assert.ok(r.decisions['linux-x86_64'].reason.includes('未判定'))

  const diff = B.bakeDesktopPlatforms({
    latest,
    tag: 'desktop-v0.1.77',
    githubSizes: GH_SIZES,
    giteeSizes: { ...GH_SIZES, 'AI_0.1.77_x64-setup.exe': 9690696 },
    owner: 'JLSLSSZWHYXGS_0',
    repo: 'IHUI-AI',
  })
  assert.equal(diff.data.platforms['windows-x86_64'].url, latest.platforms['windows-x86_64'].url)
  assert.equal(diff.decisions['windows-x86_64'].verdict, 'different')
  assert.ok(diff.decisions['windows-x86_64'].reason.includes('不一致'))
})

test('bakeDesktopPlatforms:缺 Gitee owner ⇒ 全部保留 GitHub(changed=0)', () => {
  const r = B.bakeDesktopPlatforms({
    latest,
    tag: 'desktop-v0.1.77',
    githubSizes: GH_SIZES,
    giteeSizes: { ...GH_SIZES },
    owner: '',
    repo: 'IHUI-AI',
  })
  assert.equal(r.changed, 0)
  for (const [k, v] of Object.entries(r.data.platforms)) {
    assert.equal(v.url, latest.platforms[k].url, k)
  }
  assert.ok(r.decisions['windows-x86_64'].reason.includes('缺 Gitee owner/repo'))
})

test('checkAgainstExisting:同对象通过;版本/URL 漂移逐项点名', () => {
  const baked = B.bakeDesktopLatest({ latest, githubSize: 100, giteeSize: 100, giteeUrl: GITEE }).data
  assert.equal(B.checkAgainstExisting({ existing: baked, expected: baked }).ok, true)
  const drift = { ...baked, version: '0.1.78' }
  const r = B.checkAgainstExisting({ existing: drift, expected: baked })
  assert.equal(r.ok, false)
  assert.ok(r.reason.includes('version'))

  const urlDrift = JSON.parse(JSON.stringify(baked))
  urlDrift.platforms['linux-x86_64'].url = 'https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/x/y'
  const ru = B.checkAgainstExisting({ existing: urlDrift, expected: baked })
  assert.equal(ru.ok, false)
  assert.ok(ru.reason.includes('linux-x86_64'))
})

test('CLI --check:一致 exit 0,字节不一致 exit 1(只读,不写盘)', () => {
  const dir = mkScratch('bake-latest-')
  try {
    const fixture = join(dir, 'latest.json')
    const out = join(dir, 'desktop-latest.generated.ts')
    writeFileSync(fixture, JSON.stringify(latest, null, 2), 'utf8')
    const baked = B.bakeDesktopLatest({ latest, githubSize: 100, giteeSize: 100, giteeUrl: GITEE }).data
    writeFileSync(out, B.serializeGenerated(baked), 'utf8')
    const script = join(process.cwd(), 'scripts', 'bake-desktop-latest.mjs')
    const run = (...extra) =>
      spawnSync(process.execPath, [script, '--latest-json', fixture, '--out', out, '--gitee-url', GITEE, ...extra], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      })
    const ok = run('--github-size', '100', '--gitee-size', '100', '--check')
    assert.equal(ok.status, 0, String(ok.stderr).slice(0, 300))
    assert.ok(String(ok.stdout).includes('--check'))
    const drift = run('--github-size', '100', '--gitee-size', '101', '--check')
    assert.equal(drift.status, 1, String(drift.stderr).slice(0, 300))
    assert.equal(readFileSync(out, 'utf8'), B.serializeGenerated(baked), '--check 不得写盘')
  } finally {
    rmScratch(dir)
  }
})

// ==== 桌面安装包权威条目烘焙(2026-11-05 立) ====

const GH_TABLE = new Map([
  ['AI_0.1.77_x64-setup.exe', { size: 9690695, digest: `sha256:${'a'.repeat(64)}` }],
  ['AI_0.1.77_amd64.AppImage', { size: 86968824, digest: `sha256:${'b'.repeat(64)}` }],
  ['AI_universal.app.tar.gz', { size: 13646808, digest: `sha256:${'c'.repeat(64)}` }],
])

test('buildDesktopAssets:按更新源唯一资产名去重,size/sha256 取 GitHub digest;GitHub 直链不要求 Gitee 对账', () => {
  const r = B.buildDesktopAssets({
    feed: latest,
    githubAssets: GH_TABLE,
    giteeSizes: new Map(),
    version: '0.1.77',
    tag: 'desktop-v0.1.77',
  })
  assert.equal(r.issues.length, 0, JSON.stringify(r.issues))
  assert.equal(r.assets.length, 3)
  assert.deepEqual(r.assets.map((a) => a.name), [
    'AI_0.1.77_amd64.AppImage',
    'AI_0.1.77_x64-setup.exe',
    'AI_universal.app.tar.gz',
  ])
  const exe = r.assets.find((a) => a.name === 'AI_0.1.77_x64-setup.exe')
  assert.equal(exe.size, 9690695)
  assert.equal(exe.sha256, 'a'.repeat(64))
  assert.equal(exe.giteeSizeVerified, null)
  assert.equal(exe.source, 'github-release-digest')
})

test('buildDesktopAssets:Gitee 直链必须字节对账;不等 ⇒ 拒绝;相等 ⇒ giteeSizeVerified=true', () => {
  const giteeFeed = {
    ...latest,
    platforms: Object.fromEntries(
      Object.entries(latest.platforms).map(([k, v]) => [k, { ...v, url: v.url.replace('github.com/IHUI-INF-AI', 'gitee.com/JLSLSSZWHYXGS_0') }]),
    ),
  }
  const sizes = new Map([
    ['AI_0.1.77_x64-setup.exe', 9690695],
    ['AI_0.1.77_amd64.AppImage', 86968824],
    ['AI_universal.app.tar.gz', 13646808],
  ])
  const ok = B.buildDesktopAssets({ feed: giteeFeed, githubAssets: GH_TABLE, giteeSizes: sizes, version: '0.1.77' })
  assert.equal(ok.issues.length, 0)
  assert.equal(ok.assets.every((a) => a.giteeSizeVerified === true), true)
  const bad = new Map(sizes)
  bad.set('AI_0.1.77_amd64.AppImage', 86968825)
  const broken = B.buildDesktopAssets({ feed: giteeFeed, githubAssets: GH_TABLE, giteeSizes: bad, version: '0.1.77' })
  assert.equal(broken.issues.length, 1)
  assert.equal(broken.issues[0].code, 'desktop_asset_gitee_size_mismatch')
  assert.match(broken.issues[0].message, /AI_0.1.77_amd64.AppImage/)
})

test('buildDesktopAssets:GitHub 资产缺 digest/size ⇒ 拒绝,绝不落半份元数据', () => {
  const noDigest = new Map(GH_TABLE)
  noDigest.set('AI_0.1.77_x64-setup.exe', { size: 9690695, digest: '' })
  const r = B.buildDesktopAssets({ feed: latest, githubAssets: noDigest, giteeSizes: new Map(), version: '0.1.77' })
  assert.equal(r.issues.length, 1)
  assert.equal(r.issues[0].code, 'desktop_asset_digest_missing')
  assert.equal(r.assets.length, 2)
  const noSize = new Map(GH_TABLE)
  noSize.set('AI_universal.app.tar.gz', { size: 0, digest: `sha256:${'c'.repeat(64)}` })
  const r2 = B.buildDesktopAssets({ feed: latest, githubAssets: noSize, giteeSizes: new Map(), version: '0.1.77' })
  assert.equal(r2.issues[0].code, 'desktop_asset_size_missing')
})

test('serializeDesktopAssets:同输入两次逐字节一致,含版本/tag/三条资产', () => {
  const built = B.buildDesktopAssets({ feed: latest, githubAssets: GH_TABLE, giteeSizes: new Map(), version: '0.1.77', tag: 'desktop-v0.1.77' })
  const a = B.serializeDesktopAssets({ version: '0.1.77', tag: 'desktop-v0.1.77', assets: built.assets })
  const b = B.serializeDesktopAssets({ version: '0.1.77', tag: 'desktop-v0.1.77', assets: built.assets })
  assert.equal(a, b)
  const parsed = JSON.parse(a)
  assert.equal(parsed.schemaVersion, 1)
  assert.equal(parsed.source, 'github-release-digest')
  assert.equal(parsed.version, '0.1.77')
  assert.equal(parsed.tag, 'desktop-v0.1.77')
  assert.equal(parsed.assets.length, 3)
  assert.deepEqual(Object.keys(parsed.assets[0]), ['name', 'size', 'sha256', 'url', 'source', 'giteeSizeVerified'])
})

test('checkAssetsAgainstExisting:一致通过;版本漂移/缺资产逐项点名', () => {
  const built = B.buildDesktopAssets({ feed: latest, githubAssets: GH_TABLE, giteeSizes: new Map(), version: '0.1.77', tag: 'desktop-v0.1.77' })
  const text = B.serializeDesktopAssets({ version: '0.1.77', tag: 'desktop-v0.1.77', assets: built.assets })
  assert.equal(B.checkAssetsAgainstExisting({ existingText: text, expectedText: text }).ok, true)
  const stale = JSON.parse(text)
  stale.version = '0.1.76'
  stale.assets = stale.assets.filter((x) => x.name !== 'AI_0.1.77_amd64.AppImage')
  const v = B.checkAssetsAgainstExisting({ existingText: JSON.stringify(stale), expectedText: text })
  assert.equal(v.ok, false)
  assert.match(v.reason, /version/)
  assert.match(v.reason, /缺资产 AI_0.1.77_amd64.AppImage/)
  assert.equal(B.checkAssetsAgainstExisting({ existingText: '', expectedText: text }).ok, false)
})

test('parseFeedFacts:兼容 prettier 重排(单引号/无引号键)与 JSON 两种形态', () => {
  const prettier = `export const DESKTOP_LATEST = {\n  version: '0.1.77',\n  platforms: {\n    'windows-x86_64': {\n      url: 'https://gitee.com/a/b/releases/download/desktop-v0.1.77/AI_0.1.77_x64-setup.exe',\n    },\n  },\n}\n`
  assert.deepEqual(B.parseFeedFacts(prettier), {
    version: '0.1.77',
    urls: ['https://gitee.com/a/b/releases/download/desktop-v0.1.77/AI_0.1.77_x64-setup.exe'],
  })
  const json = JSON.stringify({ version: '0.1.77', platforms: { p: { url: 'https://x/y/AI_universal.app.tar.gz' } } })
  assert.equal(B.parseFeedFacts(json).version, '0.1.77')
  assert.deepEqual(B.parseFeedFacts(json).urls, ['https://x/y/AI_universal.app.tar.gz'])
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
