// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端站点更新 feed 四平台化的判据测试(2026-09-24 立)。
// 钉死四类事故形态:
//   ① Windows 键改前改后逐字节一致(正向锁定,基准值取自改造前
//      apps/web/src/config/desktop-feed.generated.ts 已入库快照,非现写);
//   ② dmg 永远不得充当 darwin 条目(反例);
//   ③ 签名缺失/为空的平台键必须不出现(反例);
//   ④ 输出 URL 的 host 只能落在白名单(github.com;gitee.com 仅限 windows),
//      相对路径/占位符一律不出键。
// 另含装车证明:两条站点 feed route 必须共用 desktop-feed-payload、生成链必须
// 共用 scripts/lib/tauri-updater-platforms.mjs(出现第二份 /Windows/i 派生即红)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildUpdaterPlatforms,
  inferPlatformForPackage,
  isUpdaterUrlAllowed,
} from '../lib/tauri-updater-platforms.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const read = (rel) => readFileSync(join(REPO_ROOT, rel), 'utf-8')

const GH = 'https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v0.1.45'
const GITEE = 'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/desktop-v0.1.45'

// 改造前(2026-09-24 00:47 快照 → 旧 route 输出)的 windows 键逐字节基准:
// url = Gitee 直链 AI_0.1.44 exe,signature = 该 exe 的 .sig 内容(截短在此全量写死)。
const LOCKED_WIN_URL =
  'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/desktop-v0.1.44/AI_0.1.44_x64-setup.exe'
const LOCKED_WIN_SIG =
  'dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRSTI3R2lmdWJYdFlnZmd1eVQzQ0JqKzk3UFJPaHpORjlwempJWDNIRXZLZ2lYem13WW9nWFUrVy9yd2s3VlMvWnhjYmxZWXRCcHVLWk41bDNxZnV4ay92dzhFcnpFMFFrPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkwMjEwNjQ3CWZpbGU65pm65rGHQUlfMC4xLjQ0X3g2NC1zZXR1cC5leGUJdmVyc2lvbjowLjEuNDQKN0tZWU9MSWNPemNrMm1yMnkyYS83LzVQam0zbENxZU9oRjRlQ0dDaEdOQUpXTFpmSFBGMDNnRlJDZyt1NEh0VW1SRUs5eHpqWHdIelg0Qk4ya3plQWc9PQo='

/** 解析已入库快照的 DESKTOP_FEED 对象字面量(与 resolve-desktop-download 同款手法) */
function loadSnapshotFeed() {
  const src = read('apps/web/src/config/desktop-feed.generated.ts')
  const m = src.match(/export const DESKTOP_FEED(?:\s*:\s*[\w.<>\s|]+)?\s*=\s*/)
  assert.ok(m, '快照中找不到 DESKTOP_FEED 导出')
  return Function(`"use strict"; return (${src.slice(m.index + m[0].length)})`)()
}

// ─── ① Windows 正向锁定 ──────────────────────────────────────

test('① windows 键逐字节回显输入(url + signature 原样,不改写不重编码)', () => {
  const platforms = buildUpdaterPlatforms(
    [{ name: 'AI_0.1.44_x64-setup.exe', url: LOCKED_WIN_URL, signature: LOCKED_WIN_SIG }],
    { version: '0.1.44' },
  )
  assert.deepEqual(platforms['windows-x86_64'], {
    url: LOCKED_WIN_URL,
    signature: LOCKED_WIN_SIG,
  })
})

test('① 入库快照的 windows-x86_64 键与改造前基准逐字节一致', () => {
  const feed = loadSnapshotFeed()
  assert.ok(feed.updaterPlatforms, '快照必须已含 updaterPlatforms(CI/本地刷新后)')
  assert.deepEqual(feed.updaterPlatforms['windows-x86_64'], {
    url: LOCKED_WIN_URL,
    signature: LOCKED_WIN_SIG,
  })
  // 与旧 route 的消费对象(assets 里第一条 Windows)同源同值 —— 两形态并读不相悖
  const legacyWin = feed.assets.find((a) => /Windows/i.test(a.format))
  assert.equal(feed.updaterPlatforms['windows-x86_64'].url, legacyWin.href)
  assert.equal(feed.updaterPlatforms['windows-x86_64'].signature, legacyWin.signature)
})

// ─── ② dmg 反例 ─────────────────────────────────────────────

test('② dmg 永不判为可更新平台(即使旁边躺着假的 dmg.sig 内容)', () => {
  assert.equal(inferPlatformForPackage('AI_0.1.44_universal.dmg'), null)
  const platforms = buildUpdaterPlatforms(
    [
      { name: 'AI_0.1.44_universal.dmg', url: `${GH}/AI_0.1.44_universal.dmg`, signature: 'sig' },
      { name: 'AI_0.1.44_x64.dmg', url: `${GH}/AI_0.1.44_x64.dmg`, signature: 'sig' },
    ],
    { version: '0.1.44' },
  )
  assert.deepEqual(platforms, {}, '仅有 dmg 时不得产出任何 darwin 键')
})

test('② 入库快照中 dmg 未混入 updaterPlatforms(正例对照:darwin 必须是 app.tar.gz)', () => {
  const feed = loadSnapshotFeed()
  const json = JSON.stringify(feed.updaterPlatforms)
  assert.ok(!json.includes('.dmg'), 'feed 不得引用 dmg 资产')
  for (const key of ['darwin-x86_64', 'darwin-aarch64']) {
    if (feed.updaterPlatforms[key]) {
      assert.match(feed.updaterPlatforms[key].url, /\.app\.tar\.gz$/, `${key} 必须是 .app.tar.gz`)
    }
  }
})

// ─── ③ 空签名不出键 ─────────────────────────────────────────

test('③ 签名缺失/空串/纯空白的平台一律不出键(0.1.44 dmg sig 空串形态复现)', () => {
  const platforms = buildUpdaterPlatforms(
    [
      { name: 'AI_0.1.44_universal.dmg', url: `${GH}/a.dmg`, signature: '' },
      { name: 'AI_universal.app.tar.gz', url: `${GH}/AI_universal.app.tar.gz`, signature: '   ' },
      { name: 'AI_0.1.44_amd64.deb', url: `${GH}/AI_0.1.44_amd64.deb`, signature: undefined },
      { name: 'AI_0.1.44_x64-setup.exe', url: `${GITEE}/AI_0.1.44_x64-setup.exe`, signature: 'ok' },
    ],
    { version: '0.1.44' },
  )
  assert.deepEqual(Object.keys(platforms), ['windows-x86_64'])
})

test('③ AppImage 无签名时 linux 回落 deb(择低优先级的**有签名**产物,而非不出键)', () => {
  const platforms = buildUpdaterPlatforms(
    [
      { name: 'AI_0.1.45_amd64.AppImage', url: `${GH}/AI_0.1.45_amd64.AppImage`, signature: '' },
      { name: 'AI_0.1.45_amd64.deb', url: `${GH}/AI_0.1.45_amd64.deb`, signature: 'deb-sig' },
    ],
    { version: '0.1.45' },
  )
  assert.deepEqual(platforms['linux-x86_64'], { url: `${GH}/AI_0.1.45_amd64.deb`, signature: 'deb-sig' })
})

// ─── ④ host 白名单 ──────────────────────────────────────────

test('④ 相对路径/占位符/未知 host/非 https 一律拒;gitee 仅 windows 可用', () => {
  assert.equal(isUpdaterUrlAllowed('windows-x86_64', 'AI_0.1.45_x64-setup.exe'), false)
  assert.equal(isUpdaterUrlAllowed('windows-x86_64', '{placeholder}/app.exe'), false)
  assert.equal(isUpdaterUrlAllowed('windows-x86_64', 'http://github.com/x/y'), false)
  assert.equal(isUpdaterUrlAllowed('darwin-aarch64', `${GITEE}/AI_universal.app.tar.gz`), false)
  assert.equal(isUpdaterUrlAllowed('windows-x86_64', `${GITEE}/AI_0.1.45_x64-setup.exe`), true)
  assert.equal(isUpdaterUrlAllowed('linux-x86_64', `${GH}/AI_0.1.45_amd64.AppImage`), true)

  const platforms = buildUpdaterPlatforms(
    [
      // Gitee 的 linux/darwin 资产实测 404:即便带合法签名也必须被拒
      { name: 'AI_0.1.45_amd64.deb', url: `${GITEE}/AI_0.1.45_amd64.deb`, signature: 'x' },
      { name: 'AI_universal.app.tar.gz', url: 'releases/download/AI_universal.app.tar.gz', signature: 'x' },
      { name: 'AI_0.1.45_amd64.deb', url: `${GH}/AI_0.1.45_amd64.deb`, signature: 'deb-sig' },
    ],
    { version: '0.1.45' },
  )
  assert.deepEqual(Object.keys(platforms), ['linux-x86_64'])
  assert.equal(platforms['linux-x86_64'].url, `${GH}/AI_0.1.45_amd64.deb`)
})

test('④ 入库快照每个键的 host 都在白名单且 mac/linux 只走 GitHub', () => {
  const feed = loadSnapshotFeed()
  for (const [key, entry] of Object.entries(feed.updaterPlatforms || {})) {
    const host = new URL(entry.url).hostname
    assert.ok(['github.com', 'gitee.com'].includes(host), `host 越白名单: ${host}`)
    if (key !== 'windows-x86_64') {
      assert.equal(host, 'github.com', `${key} 不得使用 ${host}(Gitee mac/linux 实测 404)`)
    }
    assert.ok(entry.signature.length > 0, `${key} 出现空签名`)
  }
})

// ─── 其余生成侧判据 ──────────────────────────────────────────

test('universal app.tar.gz 同时写入 darwin-x86_64 与 darwin-aarch64(同 url 同签名)', () => {
  const platforms = buildUpdaterPlatforms(
    [{ name: 'AI_universal.app.tar.gz', url: `${GH}/AI_universal.app.tar.gz`, signature: 'u-sig' }],
    { version: '0.1.45' },
  )
  assert.deepEqual(platforms['darwin-x86_64'], { url: `${GH}/AI_universal.app.tar.gz`, signature: 'u-sig' })
  assert.deepEqual(platforms['darwin-aarch64'], platforms['darwin-x86_64'])
})

test('平台择优先 exe>msi、AppImage>deb>rpm;版本匹配产物压过残留旧版', () => {
  const platforms = buildUpdaterPlatforms(
    [
      { name: 'AI_0.1.45_x64_en-US.msi', url: `${GH}/AI_0.1.45_x64_en-US.msi`, signature: 'msi-sig' },
      { name: 'AI_0.1.45_x64-setup.exe', url: `${GH}/AI_0.1.45_x64-setup.exe`, signature: 'exe-sig' },
      { name: 'AI-0.1.45-1.x86_64.rpm', url: `${GH}/AI-0.1.45-1.x86_64.rpm`, signature: 'rpm-sig' },
      { name: 'AI_0.1.45_amd64.deb', url: `${GH}/AI_0.1.45_amd64.deb`, signature: 'deb-sig' },
      { name: 'AI_0.1.45_amd64.AppImage', url: `${GH}/AI_0.1.45_amd64.AppImage`, signature: 'ai-sig' },
      // release 里残留的旧版 exe —— 即便排在最前,也应被版本匹配者替换
      { name: 'AI_0.1.44_x64-setup.exe', url: `${GH}/stale/AI_0.1.44_x64-setup.exe`, signature: 'stale-sig' },
    ],
    { version: '0.1.45' },
  )
  assert.equal(platforms['windows-x86_64'].signature, 'exe-sig')
  assert.equal(platforms['linux-x86_64'].signature, 'ai-sig')
})

test('输出键序稳定(windows → linux → darwin-x86 → darwin-aarch,快照 diff 可读)', () => {
  const platforms = buildUpdaterPlatforms(
    [
      { name: 'AI_universal.app.tar.gz', url: `${GH}/AI_universal.app.tar.gz`, signature: 'a' },
      { name: 'AI_0.1.45_amd64.deb', url: `${GH}/AI_0.1.45_amd64.deb`, signature: 'b' },
      { name: 'AI_0.1.45_x64-setup.exe', url: `${GH}/AI_0.1.45_x64-setup.exe`, signature: 'c' },
    ],
    { version: '0.1.45' },
  )
  assert.deepEqual(Object.keys(platforms), [
    'windows-x86_64',
    'linux-x86_64',
    'darwin-x86_64',
    'darwin-aarch64',
  ])
})

// ─── 装车证明(接线层) ─────────────────────────────────────

test('装车:两条站点 feed route 共用 desktop-feed-payload,且不再自带 /Windows/i 派生', () => {
  for (const rel of ['apps/web/app/desktop-feed.json/route.ts', 'apps/web/app/api/desktop-feed/route.ts']) {
    const src = read(rel)
    assert.match(src, /from '@\/config\/desktop-feed-payload'/, `${rel} 必须 import 共享拼装器`)
    assert.match(src, /buildDesktopFeedPayload\(DESKTOP_FEED\)/, `${rel} 必须调用共享拼装器`)
    assert.ok(!/\/Windows\/i\.test\(/.test(src), `${rel} 不得再自己按 /Windows/i 挑资产`)
  }
  const builder = read('apps/web/src/config/desktop-feed-payload.ts')
  assert.match(builder, /feed\.updaterPlatforms/, '拼装器必须以 updaterPlatforms 为首位数据源')
})

test('装车:两生成脚本都 import 共享平台判据,不残留本地第二实现', () => {
  const resolver = read('scripts/resolve-desktop-download.mjs')
  const latestJson = read('scripts/generate-latest-json.mjs')
  assert.match(resolver, /from '\.\/lib\/tauri-updater-platforms\.mjs'/)
  assert.match(latestJson, /from '\.\/lib\/tauri-updater-platforms\.mjs'/)
  // generate-latest-json 的本地实现必须已删除(留一份 = 第二份真相)
  assert.ok(!/function inferPlatform\(/.test(latestJson), 'generate-latest-json 仍自带 inferPlatform')
  assert.ok(!/function shouldReplacePlatform\(/.test(latestJson))
  assert.ok(!/function extractVersion\(/.test(latestJson))
})

test('装车:入库快照形状完整(四键、签名非空、与 lib 重算结果一致)', () => {
  const feed = loadSnapshotFeed()
  const up = feed.updaterPlatforms || {}
  assert.ok(Object.keys(up).length >= 1, 'updaterPlatforms 不得为空(CI 未刷新前允许仅 windows)')
  // 用 lib 对快照自身 assets + darwin 现值重算:windows/linux 两键必须能由
  // assets 独立复现(darwin 依赖下载页不展示的 app.tar.gz,不参与此断言)
  const recomputed = buildUpdaterPlatforms(
    feed.assets.map((a) => ({
      name: decodeURIComponent(a.href.split('/').pop()),
      url: a.href,
      signature: a.signature,
    })),
    { version: feed.version },
  )
  for (const key of ['windows-x86_64', 'linux-x86_64']) {
    if (recomputed[key]) assert.deepEqual(up[key], recomputed[key], `${key} 与 assets 重算不一致`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
