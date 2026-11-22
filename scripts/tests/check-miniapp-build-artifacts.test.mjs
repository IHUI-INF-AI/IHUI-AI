// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-miniapp-build-artifacts.mjs(§22c:只 import 判据,不复制实现)。
// 阳性对照刻意"从绿档产物上拆件"来制造红/未判定 —— 证明判据真的在看文件,而不是恒绿摆设。
// 夹具落点一律走 scripts/lib/scratch-dir.mjs 的 mkScratch(§15b:禁 os.tmpdir、禁裸 mkdtempSync)。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../check-miniapp-build-artifacts.mjs')
const SRC_TEXT = readFileSync(SRC, 'utf8')
const { inspectWeappDist, parseCli, runCli } = await import(pathToFileURL(SRC).href)

let scratchSeq = 0
function makeDist(files) {
  const dir = mkScratch(`ihui-weapp-dist-${++scratchSeq}-`)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content ?? '')
  }
  return dir
}

const APP_JSON = JSON.stringify({
  pages: ['pages/index/index', 'pages/user/index'],
  subpackages: [{ root: 'pkg-ai', pages: ['ai/chat'] }],
  tabBar: {
    list: [
      { pagePath: 'pages/index/index', iconPath: 'assets/tab/home.png', selectedIconPath: 'assets/tab/home-on.png' },
      { pagePath: 'pages/user/index' },
    ],
  },
})

function goodFiles(extra = {}) {
  return {
    'app.js': '', 'app.wxss': '', 'app.json': APP_JSON,
    'pages/index/index.js': '', 'pages/index/index.wxml': '',
    'pages/user/index.js': '', 'pages/user/index.wxml': '',
    'pkg-ai/ai/chat.js': '', 'pkg-ai/ai/chat.wxml': '',
    'assets/tab/home.png': '', 'assets/tab/home-on.png': '',
    ...extra,
  }
}

test('绿档:入口/页面/分包/tabBar 引用全在位 ⇒ green', () => {
  const dir = makeDist(goodFiles())
  try {
    const r = inspectWeappDist(dir)
    assert.equal(r.status, 'green')
    assert.deepEqual(r.findings, [])
  } finally { rmScratch(dir) }
})

test('A2 阳性对照:拆掉一枚页面的 .wxml ⇒ red 且点名', () => {
  const files = goodFiles()
  delete files['pages/user/index.wxml']
  const dir = makeDist(files)
  try {
    const r = inspectWeappDist(dir)
    assert.equal(r.status, 'red')
    assert.ok(r.findings.some((f) => f.code === 'A2' && f.detail.includes('pages/user/index') && f.detail.includes('.wxml')))
  } finally { rmScratch(dir) }
})

test('A1 阳性对照:拆掉 app.wxss ⇒ red 入口缺件', () => {
  const files = goodFiles()
  delete files['app.wxss']
  const dir = makeDist(files)
  try {
    const r = inspectWeappDist(dir)
    assert.equal(r.status, 'red')
    assert.ok(r.findings.some((f) => f.code === 'A1' && f.detail.includes('app.wxss')))
  } finally { rmScratch(dir) }
})

test('A4 阳性对照:tabBar 图标引用落空 ⇒ red', () => {
  const files = goodFiles()
  delete files['assets/tab/home.png']
  const dir = makeDist(files)
  try {
    const r = inspectWeappDist(dir)
    assert.equal(r.status, 'red')
    assert.ok(r.findings.some((f) => f.code === 'A4' && f.detail.includes('home.png')))
  } finally { rmScratch(dir) }
})

test('A3 分包:缺分包页面文件 ⇒ red 且带 root 拼接后的路径', () => {
  const files = goodFiles()
  delete files['pkg-ai/ai/chat.js']
  const dir = makeDist(files)
  try {
    const r = inspectWeappDist(dir)
    assert.equal(r.status, 'red')
    assert.ok(r.findings.some((f) => f.code === 'A3' && f.detail.includes('pkg-ai/ai/chat')))
  } finally { rmScratch(dir) }
})

test('subPackages 大写拼法同样被枚举(微信官方两种都收)', () => {
  const appJson = JSON.stringify({ pages: ['pages/index/index'], subPackages: [{ root: 'pkg-x', pages: ['a/b'] }] })
  const dir = makeDist({
    'app.js': '', 'app.wxss': '', 'app.json': appJson,
    'pages/index/index.js': '', 'pages/index/index.wxml': '',
  })
  try {
    const r = inspectWeappDist(dir)
    assert.equal(r.status, 'red')
    assert.ok(r.findings.some((f) => f.code === 'A3' && f.detail.includes('pkg-x/a/b')))
  } finally { rmScratch(dir) }
})

test('未判定:app.json 缺失 ⇒ undetermined(不得读成通过)', () => {
  const dir = makeDist({ 'app.js': '', 'app.wxss': '' })
  try {
    const r = inspectWeappDist(dir)
    assert.equal(r.status, 'undetermined')
  } finally { rmScratch(dir) }
})

test('未判定:app.json 是坏 JSON ⇒ undetermined', () => {
  const dir = makeDist({ 'app.js': '', 'app.wxss': '', 'app.json': '{oops' })
  try {
    const r = inspectWeappDist(dir)
    assert.equal(r.status, 'undetermined')
  } finally { rmScratch(dir) }
})

test('未判定:目录不存在 ⇒ undetermined', () => {
  const root = mkScratch('ihui-weapp-dist-missing-')
  try {
    const r = inspectWeappDist(join(root, 'no-such-dist'))
    assert.equal(r.status, 'undetermined')
  } finally { rmScratch(root) }
})

test('runCli:--dist 缺参数 ⇒ rc 2 且显式未判定,不回落默认 dist(§0.3)', () => {
  const out = runCli(['--dist'])
  assert.equal(out.code, 2)
  assert.match(out.lines[0], /未判定/)
  assert.match(out.lines[0], /--dist/)
})

test('--self-test:旗标真的被消费且自检 rc=0(修复前的静默忽略在此翻红)', () => {
  const out = execFileSync(process.execPath, [SRC, '--self-test'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.match(out, /self-test 全部通过/)
})

test('S1 分派序锁:--self-test 先于 --dist 解析(旗标不得被忽略后按默认 dist 跑)', () => {
  assert.equal(parseCli(['--dist', 'x', '--self-test']).mode, 'self-test')
  assert.equal(parseCli(['--self-test']).mode, 'self-test')
})

test('S2 只读性源码锁:写盘动作只允许出现在 selfTestRun 内,且夹具走 scratch-dir 出口', () => {
  assert.match(SRC_TEXT, /import\(['"]\.\/lib\/scratch-dir\.mjs['"]\)/, '自检夹具没走 mkScratch 唯一出口')
  assert.ok(!/tmpdir\(/.test(SRC_TEXT), 'os.tmpdir() 可能钉在 C 盘,不得回来(§15b)')
  assert.ok(!/\bmkdtempSync\(/.test(SRC_TEXT), '裸 mkdtempSync 绕过落点约束')
  const at = SRC_TEXT.indexOf('async function selfTestRun(')
  assert.ok(at > 0, '找不到 selfTestRun ⇒ 写盘锁没有锚点')
  const outside = SRC_TEXT.slice(0, at)
  for (const w of ['writeFileSync', 'mkdirSync', 'rmScratch', 'rmSync'])
    assert.ok(!new RegExp(`\\b${w}\\b`).test(outside), `${w} 出现在 selfTestRun 之前 ⇒ 该门不再是只读的`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
