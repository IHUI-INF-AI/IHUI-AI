import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  copyFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SOURCE_SCRIPT = join(__dirname, '..', 'check-cli-i18n-parity.mjs')

// ============================================================
// 源脚本核心规则(scripts/check-cli-i18n-parity.mjs)
// ============================================================
// cli 域 i18n parity 守门:校验 packages/i18n/messages/cli/*.json
// 5 语言(zh-CN/en/ja/ko/zh-TW)键集合一致。
// - getAllKeys 递归提取嵌套 key(用 . 拼接)。
// - 目录不存在 → exit 0 skipping;目录存在但无 JSON → exit 0 skipping。
// - 以第一个 locale 为 baseline,其余 locale 必须键集合一致(size + key)。
// - JSON 解析失败 → exit 1 "invalid JSON"。
// - --quiet 抑制通过消息(stdout 空),不一致时 stderr 仍输出错误。
// 退出码:0 parity 一致,1 parity drift / invalid JSON。
// ============================================================

/** 创建临时环境(复制脚本到 <tmp>/scripts/)。 */
function createTempEnv() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-cli-i18n-'))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-cli-i18n-parity.mjs'))
  return dir
}

/** 在 <tmp>/packages/i18n/messages/cli/ 写入 locale JSON。 */
function writeLocale(dir, locale, data) {
  const localeDir = join(dir, 'packages', 'i18n', 'messages', 'cli')
  mkdirSync(localeDir, { recursive: true })
  writeFileSync(join(localeDir, `${locale}.json`), JSON.stringify(data, null, 2))
}

function runScript(dir, args = []) {
  const r = spawnSync('node', [join(dir, 'scripts', 'check-cli-i18n-parity.mjs'), ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.cleanStdout = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.cleanStderr = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// ─── 1. 边界:目录/文件不存在 ─────────────────────────────

test('边界: 目录不存在 → exit 0 + "skipping"', () => {
  const dir = createTempEnv()
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `目录不存在应 exit 0\ncleanStdout: ${r.cleanStdout}`)
    assert.match(r.cleanStdout, /skipping/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('边界: 目录存在但无 JSON 文件 → exit 0 + "skipping"', () => {
  const dir = createTempEnv()
  try {
    mkdirSync(join(dir, 'packages', 'i18n', 'messages', 'cli'), { recursive: true })
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.cleanStdout, /skipping/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --quiet 目录不存在时仍 exit 0(抑制 [OK] 输出)', () => {
  const dir = createTempEnv()
  try {
    const r = runScript(dir, ['--quiet'])
    assert.equal(r.status, 0)
    assert.ok(!r.cleanStdout.includes('[OK]'), `--quiet 应抑制 [OK] 输出\ncleanStdout: ${r.cleanStdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. Parity 一致 ─────────────────────────────────────

test('Parity: 5 语言一致 → exit 0 + "parity"', () => {
  const dir = createTempEnv()
  try {
    const data = { greeting: 'hello', farewell: 'bye' }
    for (const loc of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']) {
      writeLocale(dir, loc, data)
    }
    const r = runScript(dir)
    assert.equal(r.status, 0, `parity 一致应 exit 0\ncleanStdout: ${r.cleanStdout}`)
    assert.match(r.cleanStdout, /parity/)
    assert.match(r.cleanStdout, /5 locales/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('Parity: --quiet 一致时抑制 stdout', () => {
  const dir = createTempEnv()
  try {
    const data = { greeting: 'hello' }
    for (const loc of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']) {
      writeLocale(dir, loc, data)
    }
    const r = runScript(dir, ['--quiet'])
    assert.equal(r.status, 0)
    assert.equal(r.cleanStdout, '', `--quiet 应抑制 stdout,实际: ${r.cleanStdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('Parity: 嵌套 key 一致 → exit 0', () => {
  const dir = createTempEnv()
  try {
    const data = {
      nav: { home: 'Home', settings: 'Settings' },
      actions: { save: 'Save', cancel: 'Cancel' },
    }
    for (const loc of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']) {
      writeLocale(dir, loc, data)
    }
    const r = runScript(dir)
    assert.equal(r.status, 0, `嵌套 key 一致应 exit 0\ncleanStdout: ${r.cleanStdout}`)
    assert.match(r.cleanStdout, /parity/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('Parity: 空对象(0 keys)一致 → exit 0', () => {
  const dir = createTempEnv()
  try {
    for (const loc of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']) {
      writeLocale(dir, loc, {})
    }
    const r = runScript(dir)
    assert.equal(r.status, 0, `空对象一致应 exit 0\ncleanStdout: ${r.cleanStdout}`)
    assert.match(r.cleanStdout, /parity/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. Parity 不一致 ───────────────────────────────────

test('违规: 5 语言 key 名不同(size 相同)→ exit 1 + "missing key"', () => {
  const dir = createTempEnv()
  try {
    // 所有语言 size 相同(2 keys),但 en 把 b 改成 c
    // 无论 baseline 是谁,都会检测到 "missing key":
    //   baseline=zh-CN(a,b) → en 缺 b → "missing key: b"
    //   baseline=en(a,c)    → 其余缺 c → "missing key: c"
    writeLocale(dir, 'zh-CN', { a: '1', b: '2' })
    writeLocale(dir, 'en', { a: '1', c: '2' })
    writeLocale(dir, 'ja', { a: '1', b: '2' })
    writeLocale(dir, 'ko', { a: '1', b: '2' })
    writeLocale(dir, 'zh-TW', { a: '1', b: '2' })
    const r = runScript(dir)
    assert.equal(r.status, 1, `key 名不同应 exit 1\ncleanStderr: ${r.cleanStderr}`)
    assert.match(r.cleanStderr, /parity drift/)
    assert.match(r.cleanStderr, /missing key/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: 5 语言 key 数量不同 → exit 1', () => {
  const dir = createTempEnv()
  try {
    writeLocale(dir, 'zh-CN', { a: '1', b: '2', c: '3' })
    writeLocale(dir, 'en', { a: '1', b: '2' }) // 少一个
    writeLocale(dir, 'ja', { a: '1', b: '2', c: '3' })
    writeLocale(dir, 'ko', { a: '1', b: '2', c: '3' })
    writeLocale(dir, 'zh-TW', { a: '1', b: '2', c: '3' })
    const r = runScript(dir)
    assert.equal(r.status, 1)
    assert.match(r.cleanStderr, /parity drift/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: JSON 解析失败 → exit 1 + "invalid JSON"', () => {
  const dir = createTempEnv()
  try {
    const localeDir = join(dir, 'packages', 'i18n', 'messages', 'cli')
    mkdirSync(localeDir, { recursive: true })
    writeFileSync(join(localeDir, 'zh-CN.json'), '{ invalid json }')
    writeFileSync(join(localeDir, 'en.json'), JSON.stringify({ a: '1' }))
    const r = runScript(dir)
    assert.equal(r.status, 1)
    assert.match(r.cleanStderr, /invalid JSON/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('边界: 只有 3 语言文件 → 校验存在的 3 语言(一致 → exit 0)', () => {
  const dir = createTempEnv()
  try {
    const data = { greeting: 'hello' }
    writeLocale(dir, 'zh-CN', data)
    writeLocale(dir, 'en', data)
    writeLocale(dir, 'ja', data)
    const r = runScript(dir)
    assert.equal(r.status, 0, `3 语言一致应 exit 0\ncleanStdout: ${r.cleanStdout}`)
    assert.match(r.cleanStdout, /3 locales/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: --quiet 不一致时仍输出错误 → exit 1', () => {
  const dir = createTempEnv()
  try {
    writeLocale(dir, 'zh-CN', { a: '1', b: '2' })
    writeLocale(dir, 'en', { a: '1' })
    const r = runScript(dir, ['--quiet'])
    assert.equal(r.status, 1)
    assert.match(r.cleanStderr, /parity drift/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
