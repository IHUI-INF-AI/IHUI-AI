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

test('checkAgainstExisting:同对象通过;版本/URL 漂移逐项点名', () => {
  const baked = B.bakeDesktopLatest({ latest, githubSize: 100, giteeSize: 100, giteeUrl: GITEE }).data
  assert.equal(B.checkAgainstExisting({ existing: baked, expected: baked }).ok, true)
  const drift = { ...baked, version: '0.1.78' }
  const r = B.checkAgainstExisting({ existing: drift, expected: baked })
  assert.equal(r.ok, false)
  assert.ok(r.reason.includes('version'))
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
