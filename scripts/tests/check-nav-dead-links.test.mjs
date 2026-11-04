// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file check-nav-dead-links.test.mjs 集成测试
 * @description 三态覆盖 scripts/check-nav-dead-links.mjs(AGENTS.md §0.3):
 *   - 真 0:全部 href 有对应 page → exit 0
 *   - 真违规:存在死链 → exit 1
 *   - 未判定:nav-data 读不到 / 解析不到 href / 页面目录读不到 / 无 page 文件 → exit 2 并点名
 *
 * 门体支持 --nav-data / --app-dir 注入扫描面,测试只喂夹具,不依赖真实仓库内容。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-nav-dead-links.mjs')

function run(args = []) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    // 不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
  })
}

function makeFixture(hrefs, pages) {
  const root = mkScratch('ihui-nav-dead-links-')
  const nav = join(root, 'nav-data.ts')
  writeFileSync(nav, hrefs.map((h) => `  { href: '${h}' },`).join('\n') + '\n', 'utf8')
  const app = join(root, 'app')
  mkdirSync(app, { recursive: true })
  for (const p of pages) {
    const abs = join(app, p)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, 'export default function Page() { return null }\n', 'utf8')
  }
  return { root, nav, app }
}

test('真 0:全部 href 有对应 page → exit 0', () => {
  const fx = makeFixture(['/ok'], ['ok/page.tsx'])
  try {
    const r = run(['--nav-data', fx.nav, '--app-dir', fx.app])
    assert.equal(r.status, 0, `应 exit 0,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stdout, /无死链/)
  } finally {
    rmScratch(fx.root)
  }
})

test('真违规:存在死链 → exit 1', () => {
  const fx = makeFixture(['/ok', '/dead'], ['ok/page.tsx'])
  try {
    const r = run(['--nav-data', fx.nav, '--app-dir', fx.app])
    assert.equal(r.status, 1, `应 exit 1,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stdout, /死链/)
    assert.match(r.stdout, /\/dead/)
  } finally {
    rmScratch(fx.root)
  }
})

test('未判定:nav-data 读不到 → exit 2', () => {
  const fx = makeFixture(['/ok'], ['ok/page.tsx'])
  try {
    const r = run(['--nav-data', join(fx.root, 'no-such-nav.ts'), '--app-dir', fx.app])
    assert.equal(r.status, 2, `应 exit 2,实际 ${r.status}\n${r.stderr}`)
    assert.match(r.stderr, /未判定/)
    assert.match(r.stderr, /读不到导航数据/)
  } finally {
    rmScratch(fx.root)
  }
})

test('未判定:nav-data 解析不到任何 href → exit 2', () => {
  const fx = makeFixture([], ['ok/page.tsx'])
  try {
    const r = run(['--nav-data', fx.nav, '--app-dir', fx.app])
    assert.equal(r.status, 2, `应 exit 2,实际 ${r.status}\n${r.stderr}`)
    assert.match(r.stderr, /未判定/)
    assert.match(r.stderr, /解析到任何 href/)
  } finally {
    rmScratch(fx.root)
  }
})

test('未判定:页面目录读不到 → exit 2', () => {
  const fx = makeFixture(['/ok'], ['ok/page.tsx'])
  try {
    const r = run(['--nav-data', fx.nav, '--app-dir', join(fx.root, 'no-such-app')])
    assert.equal(r.status, 2, `应 exit 2,实际 ${r.status}\n${r.stderr}`)
    assert.match(r.stderr, /未判定/)
    assert.match(r.stderr, /读不到页面目录/)
  } finally {
    rmScratch(fx.root)
  }
})

test('未判定:页面目录存在但无 page 文件 → exit 2', () => {
  const fx = makeFixture(['/ok'], [])
  try {
    const r = run(['--nav-data', fx.nav, '--app-dir', fx.app])
    assert.equal(r.status, 2, `应 exit 2,实际 ${r.status}\n${r.stderr}`)
    assert.match(r.stderr, /未判定/)
    assert.match(r.stderr, /无任何 page 文件/)
  } finally {
    rmScratch(fx.root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
