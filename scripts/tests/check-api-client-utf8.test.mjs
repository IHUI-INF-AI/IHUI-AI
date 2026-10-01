// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-api-client-utf8.mjs` 的镜像测试(2026-10-01 随判定面迁移重写)。
 *
 * 门体自 2026-10-01 起**判被审面 blob**(HEAD / 索引),不再读磁盘工作树 —— 所以本镜像
 * 的现场全部是**真 git 临时仓**(旧版"临时目录写盘即测"的现场结构上测不到面语义):
 *  - 纯函数面:scanBuffer 逐型构造(与旧磁盘版同一套字节判据,载体从文件换成 Buffer);
 *  - 真仓面:提交/暂存不同字节序列,断言门在 HEAD 面与索引面**各判各的** ——
 *    尤其"HEAD 干净 + 索引损坏"这一格:面分离错了,门就会把别人暂存的半成品判成本次的债,
 *    或者反过来把已入库的损坏放行。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-api-client-utf8.mjs')
const ENDPOINTS_REL = join('packages', 'api-client', 'src', 'endpoints')

// ─── 真 git 临时仓现场 ───────────────────────────────────────
function gitIn(root, args) {
  const r = spawnSync('git', ['-c', 'core.autocrlf=false', ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败: ${r.stderr}`)
  return r.stdout
}

function createGitRoot() {
  const root = mkScratch('ihui-api-cli-utf8-')
  gitIn(root, ['init', '--quiet'])
  gitIn(root, ['config', 'user.email', 'gate-test@example.invalid'])
  gitIn(root, ['config', 'user.name', 'gate-test'])
  return root
}

/** 在临时仓写入 endpoints 文件;staged=true 则只 add 不 commit(进索引面)。 */
function putFiles(root, files, { staged = false } = {}) {
  const dir = join(root, ENDPOINTS_REL)
  mkdirSync(dir, { recursive: true })
  for (const f of files || []) {
    const target = join(dir, f.name)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, Buffer.isBuffer(f.content) ? f.content : f.content, { flag: 'w' })
  }
  gitIn(root, ['add', '-A', '--', ENDPOINTS_REL])
  if (!staged) gitIn(root, ['commit', '--quiet', '-m', 'gate-test'])
}

const ANSI_RE = /\x1b\[[0-9;]*m/g
function runGate(args = [], cwd, extra = []) {
  const fullArgs = [...args, '--root', cwd].concat(extra)
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...fullArgs], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 << 20,
  })
  if (r.stdout) r.stdout = r.stdout.replace(ANSI_RE, '')
  if (r.stderr) r.stderr = r.stderr.replace(ANSI_RE, '')
  r.all = `${r.stdout || ''}\n${r.stderr || ''}`
  return r
}

// ─── 字节常量 ─────────────────────────────────────────────
// "中":U+4E2D → E4 B8 AD(合法 3 字节 UTF-8);E4 B8 3F = 票面登记的损坏形态
const ZHONG_OK = Buffer.from('export const name = "\xe4\xb8\xad"\n', 'latin1')
const RULE_A = Buffer.from([0xe4, 0xb8, 0x3f])
const CLEAN_ASCII = Buffer.from('export const foo = 1\n')

// ─── 纯函数面:scanBuffer 逐型构造(旧磁盘版同一套判据,载体换 Buffer) ──
test('self-test:门体自检 12 条全过', () => {
  const r = runGate(['--self-test'])
  assert.equal(r.status, 0, `self-test 应 exit 0\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, /❌ 0 条/)
})

test('scanBuffer:合法序列不报 / 损坏逐型点名', async () => {
  const { scanBuffer } = await import(pathToFileURL(SCRIPT_PATH).href)
  assert.equal(scanBuffer(Buffer.alloc(0)).violations.length, 0, '空文件不误报')
  assert.equal(scanBuffer(ZHONG_OK).violations.length, 0, '合法 3 字节中文不报')
  assert.equal(scanBuffer(Buffer.from([0xf0, 0x9f, 0x98, 0x80])).violations.length, 0, '合法 4 字节 emoji 不报')
  const a = scanBuffer(RULE_A).violations
  assert.equal(a.length, 1)
  assert.match(a[0].type, /3rd byte replaced by 0x3F/)
  assert.equal(a[0].bytes.join(','), '228,184,63', 'bytes 必须是原字节值(G-467:不能是 utf8 解码后的 U+FFFD)')
  assert.match(scanBuffer(Buffer.from([0xc2, 0x00])).violations[0].type, /2-byte UTF-8 invalid continuation/)
  assert.match(scanBuffer(Buffer.from([0xf0, 0x00, 0x80, 0x80])).violations[0].type, /4-byte UTF-8 invalid continuation/)
  assert.match(scanBuffer(Buffer.from([0x80])).violations[0].type, /invalid UTF-8 leading byte 0x80/)
  assert.equal(scanBuffer(Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80])).violations.length, 7, '计数不丢')
})

// ─── 真仓面:HEAD / 索引各判各的 ──────────────────────────
test('HEAD 面:干净提交 → exit 0 + 报面名', () => {
  const root = createGitRoot()
  try {
    putFiles(root, [
      { name: 'clean.ts', content: CLEAN_ASCII },
      { name: 'zhong.ts', content: ZHONG_OK },
    ])
    const r = runGate([], root)
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /head 面/)
    assert.match(r.stdout, /UTF-8 干净: 2 个文件/)
    assert.match(r.stdout, /字节级 UTF-8 完整/)
  } finally {
    rmScratch(root)
  }
})

test('HEAD 面:已提交损坏(E4 B8 3F)→ exit 1 + 规则 A 报告 + bytes hex', () => {
  const root = createGitRoot()
  try {
    putFiles(root, [
      { name: 'clean.ts', content: CLEAN_ASCII },
      { name: 'broken.ts', content: RULE_A },
    ])
    const r = runGate([], root)
    assert.equal(r.status, 1, `应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /UTF-8 干净: 1 个文件/)
    assert.match(r.stdout, /发现 1 处损坏字节序列/)
    assert.match(r.stdout, /3rd byte replaced by 0x3F/)
    assert.match(r.stdout, /0xe4 0xb8 0x3f/)
    assert.match(r.stdout, /Turbopack/)
    assert.match(r.stdout, /node -e/)
  } finally {
    rmScratch(root)
  }
})

test('面分离:HEAD 干净 + 索引损坏 → 默认 exit 0、--staged exit 1(各判各的面)', () => {
  const root = createGitRoot()
  try {
    putFiles(root, [{ name: 'developer.ts', content: CLEAN_ASCII }])
    // 只进索引、不提交:索引面损坏,HEAD 面仍干净
    putFiles(root, [{ name: 'developer.ts', content: RULE_A }], { staged: true })
    const head = runGate([], root)
    assert.equal(head.status, 0, `HEAD 面应 exit 0(损坏只在索引)\nstdout: ${head.stdout}`)
    assert.match(head.stdout, /head 面/)
    const staged = runGate(['--staged'], root)
    assert.equal(staged.status, 1, `索引面应 exit 1\nstdout: ${staged.stdout}`)
    assert.match(staged.stdout, /staged 面/)
    assert.match(staged.stdout, /3rd byte replaced by 0x3F/)
  } finally {
    rmScratch(root)
  }
})

test('尺子空转:被审面 0 个 .ts → exit 2(不得读成通过)', () => {
  const root = createGitRoot()
  try {
    gitIn(root, ['commit', '--quiet', '--allow-empty', '-m', 'empty'])
    const r = runGate([], root)
    assert.equal(r.status, 2, `空面应 exit 2\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.all, /尺子空转/)
  } finally {
    rmScratch(root)
  }
})

test('非 .ts 文件不进分母(门枚举只认 .ts)', () => {
  const root = createGitRoot()
  try {
    putFiles(root, [
      { name: 'foo.js', content: CLEAN_ASCII },
      { name: 'bar.json', content: Buffer.from('{"x":1}') },
      { name: 'keep.ts', content: CLEAN_ASCII },
    ])
    const r = runGate([], root)
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /扫描 1 个/)
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
