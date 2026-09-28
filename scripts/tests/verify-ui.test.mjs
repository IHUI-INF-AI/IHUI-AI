// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file verify-ui.mjs 的镜像测试(带值旗标 --spec 的取值)
 *
 * 为什么单独一票:verify-ui.mjs 顶层就是 CLI 且**没有 §22d isDirectRun 守卫**(import 即派生
 * dev-server 探测与 Playwright),所以判据只能经 spawn 子进程 + 源码形状锁来验,不得 import 判据函数。
 * §22c 禁止在测试里再抄一份源判据 —— 这里没有复制 flagValue,判据的输入是"真跑一次的退出码与文案"。
 *
 * 事故形态:`--spec --staged` 旧写法把 `--staged` 当成正则喂给 `pnpm playwright test --grep`
 * ⇒ 0 条测试匹配 ⇒ Playwright 报通过 ⇒ 本脚本 exit 0,即 AGENTS §17 的"假验收"。
 * 口径照抄枚 380431ffc / 636c28f58 / 8832e73a4,不另发明。
 *
 * 夹具唯一落点:scripts/lib/scratch-dir.mjs(§26)—— 不落 os.tmpdir()、不写进真仓工作树。
 * 本测试**不真跑 Playwright**(它要 dev server + 浏览器):合法值那一臂用 --check-server 早退档,
 * 并与 `git show HEAD:` 取出的改前副本同瞬间对账退出码。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO = path.resolve(__dirname, '..', '..')
const SCRIPT_PATH = path.join(REPO, 'scripts', 'verify-ui.mjs')

function runScript(args, cwd) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    // §5b 弹窗治理 + 守门 52:派生控制台程序必须 windowsHide,且不得无界挂起
    windowsHide: true,
    timeout: 60_000,
  })
}

// 把改前那份(HEAD 面)取到 scratch 里;该脚本只 import node 内置,不存在闭包缺失问题
// —— 若照旧"只拷单文件"就够用,但先把 import 面断言住,免得日后它引了本地模块而这里静默失效。
function materializeHeadCopy(dir) {
  const src = execFileSync('git', ['-C', REPO, 'show', 'HEAD:scripts/verify-ui.mjs'], {
    encoding: 'utf8',
    maxBuffer: 1 << 24,
    windowsHide: true,
    timeout: 60_000,
  })
  const localImports = src
    .split('\n')
    .filter((l) => /^\s*import\s.*from\s+['"]\.\.?\/|['"]@/.test(l))
  assert.equal(
    localImports.length,
    0,
    `改前副本只拷单文件的前提不再成立(出现本地 import:${localImports.join(';')})—— 需连带取闭包`,
  )
  const out = path.join(dir, 'verify-ui.head.mjs')
  fs.writeFileSync(out, src, 'utf8')
  return out
}

const listing = (dir) => fs.readdirSync(dir).sort().join('|')

// ─── (a) 值是另一个旗标 ⇒ 拒绝、非零、点名、且不跑全量 ───
test('(a) --spec --staged:exit 2 + 点名实得 token + 未派生 Playwright + 不写文件', () => {
  const dir = mkScratch('ihui-verify-ui-a-')
  try {
    const before = listing(dir)
    const r = runScript(['--spec', '--staged'], dir)
    assert.equal(r.status, 2, `无效值必须非零退出,实际 ${r.status}`)
    assert.match(r.stderr, /--spec 没有收到有效的过滤串/, '必须点名是哪个旗标')
    assert.match(r.stderr, /"--staged"/, '必须原样带出实得的 token')
    assert.doesNotMatch(r.stdout, /运行 Playwright/, '拒绝不得发生在派生测试之后(那已经跑起来了)')
    assert.doesNotMatch(r.stdout, /测试全部通过/, '绝不允许把"0 条匹配"报成通过')
    assert.equal(listing(dir), before, '拒绝时不得写出任何文件')
  } finally {
    rmScratch(dir)
  }
})

test('(a) --spec 后面没有参数 / 空串:同样 exit 2 并点名两种不同形态', () => {
  const dir = mkScratch('ihui-verify-ui-a2-')
  try {
    const r1 = runScript(['--spec'], dir)
    assert.equal(r1.status, 2, `缺值必须非零,实际 ${r1.status}`)
    assert.match(r1.stderr, /\(其后没有任何参数\)/, '缺值与"被别的旗标顶上"是两种修法,不得合成一句')
    const r2 = runScript(['--spec', ''], dir)
    assert.equal(r2.status, 2, `空串必须非零,实际 ${r2.status}`)
    assert.match(r2.stderr, /""/, '空串也要原样带出')
  } finally {
    rmScratch(dir)
  }
})

// ─── (b) 合法值 ⇒ 行为与改动前逐字一致(防"把值校验写成永远拒") ───
test('(b) --spec sidebar:不被拒绝,且与 HEAD 改前副本同档位同退出码', () => {
  const dir = mkScratch('ihui-verify-ui-b-')
  try {
    const headCopy = materializeHeadCopy(dir)
    // --check-server 在 runVisualTests 之前早退 ⇒ 全程不派生 Playwright,只比"是否被拒绝"与退出码
    const args = ['--spec', 'sidebar', '--check-server']
    const now = runScript(args, dir)
    const before = spawnSync('node', [headCopy, ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 60_000,
    })
    assert.doesNotMatch(now.stderr, /没有收到有效的过滤串/, '合法值绝不得被拒绝(否则本校验成了永拒)')
    assert.equal(now.status, before.status, '合法值的退出码必须与改前逐字一致')
    assert.doesNotMatch(before.stderr, /没有收到有效的过滤串/, '对照面(改前)本就不拒绝')
  } finally {
    rmScratch(dir)
  }
})

test('(b) 不带 --spec 的默认档:退出码与改前副本一致(默认行为一字未改)', () => {
  const dir = mkScratch('ihui-verify-ui-b2-')
  try {
    const headCopy = materializeHeadCopy(dir)
    const now = runScript(['--check-server'], dir)
    const before = spawnSync('node', [headCopy, '--check-server'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 60_000,
    })
    assert.doesNotMatch(now.stderr, /没有收到有效的过滤串/, '没给 --spec 时不得凭空拒绝')
    assert.equal(now.status, before.status, '默认档退出码必须与改前一致')
  } finally {
    rmScratch(dir)
  }
})

// ─── (c) 源码形状锁 ───
test('(c) 形状锁:--spec 取值必须走 flagValue,裸 args[indexOf(...)+1] 不得回来', () => {
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8')
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
    .replace(/\/\/[^\n]*/g, '')
  assert.doesNotMatch(
    code,
    /args\[\s*args\.indexOf\(\s*'--spec'\s*\)\s*\+\s*1\s*\]/,
    '旧写法 args[args.indexOf("--spec") + 1] 不得回来',
  )
  assert.match(code, /function\s+flagValue\s*\(/, '唯一取值出口必须在位')
  assert.match(code, /flagValue\(\s*args\s*,\s*'--spec'\s*\)/, '站点必须走出口')
  assert.match(code, /specFlag\.present\s*&&\s*!specFlag\.valid/, '拒绝分支必须挂在"旗标在场而值无效"上')
  assert.match(code, /process\.exit\(2\)/, '拒绝必须真的非零退出')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
