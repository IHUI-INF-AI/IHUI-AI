/**
 * @file apply-translation-fallback.mjs 回归测试基线
 * @description 覆盖 scripts/apply-translation-fallback.mjs 的核心规则:
 *   1. 读取 packages/i18n/messages/web/{en,ja,ko}.json,en 为基准扫描 leaf
 *   2. 仅处理 ja/ko 两个文件(不动 en/zh-CN/zh-TW)
 *   3. enValue 过滤:非 string / length < 2 / 非 ASCII 跳过
 *   4. langValue !== enValue 跳过(已翻译不重复处理)
 *   5. MAP_JA / MAP_KO 命中 → 用映射值,计数 replaced
 *   6. MAP 未命中 → fullwidthify 全角兜底,计数 fallback
 *   7. dry-run 模式只打印不写回
 *   8. 非 dry-run 写回:JSON.stringify(obj, null, 2) + '\n'
 *   9. 嵌套对象 dot path 支持(setNested)
 *  10. 数组/number/boolean 不受影响(collectLeaves 只收 string leaf)
 *  11. 输出格式:"{lang}: 翻译 N 处, 全角兜底 M 处" + "总计: ..."
 *  12. 未命中样例输出(unmappedSamples,最多 20)
 *
 * 测试策略:spawnSync 子进程运行原脚本,cwd=临时目录,fixture 完全隔离不污染项目。
 * 路径推导用 import.meta.url(AGENTS.md §15)。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = path.join(__dirname, '..', 'apply-translation-fallback.mjs')

// ─── 辅助:创建临时项目根目录(含 packages/i18n/messages/web/ 结构) ───
function createTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-translation-fallback-'))
  fs.mkdirSync(path.join(root, 'packages', 'i18n', 'messages', 'web'), { recursive: true })
  return root
}

// 写入完整 fixture(en + ja + ko),未指定 lang 默认 {}
function writeFixture(root, { en = {}, ja = {}, ko = {} } = {}) {
  const dir = path.join(root, 'packages', 'i18n', 'messages', 'web')
  fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify(en, null, 2), 'utf8')
  fs.writeFileSync(path.join(dir, 'ja.json'), JSON.stringify(ja, null, 2), 'utf8')
  fs.writeFileSync(path.join(dir, 'ko.json'), JSON.stringify(ko, null, 2), 'utf8')
}

function readLang(root, lang) {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'packages', 'i18n', 'messages', 'web', `${lang}.json`), 'utf8'),
  )
}

function readLangRaw(root, lang) {
  return fs.readFileSync(path.join(root, 'packages', 'i18n', 'messages', 'web', `${lang}.json`), 'utf8')
}

function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

describe('CLI 基础行为 — 退出码 + 空 fixture', () => {
  test('空 fixture (en/ja/ko 都是 {}) → exit 0 + 0 处翻译', () => {
    const root = createTempProject()
    try {
      writeFixture(root)
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `空 fixture 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert.match(r.stdout, /ja: 翻译 0 处, 全角兜底 0 处/)
      assert.match(r.stdout, /ko: 翻译 0 处, 全角兜底 0 处/)
      assert.match(r.stdout, /总计: 翻译 0 处, 全角兜底 0 处/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('正常替换 → exit 0 + 总计输出格式', () => {
    const root = createTempProject()
    try {
      writeFixture(root, { en: { brand: 'OpenAI' }, ja: { brand: 'OpenAI' }, ko: { brand: 'OpenAI' } })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `正常替换应 exit 0,实际 ${r.status}`)
      assert.match(r.stdout, /总计: 翻译 \d+ 处, 全角兜底 \d+ 处/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('enValue 过滤规则 — length/ASCII/已翻译跳过', () => {
  test('enValue.length < 2 跳过(单字符 "A" 不处理)', () => {
    const root = createTempProject()
    try {
      writeFixture(root, {
        en: { short: 'A', long: 'OpenAI' },
        ja: { short: 'A', long: 'OpenAI' },
      })
      runScript([], { cwd: root })
      const ja = readLang(root, 'ja')
      assert.equal(ja.short, 'A', '单字符 enValue(length 1 < 2)应跳过不处理')
      assert.equal(ja.long, 'オープンＡＩ', 'OpenAI(length 6 >= 2)应被 MAP_JA 替换')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('enValue 非 ASCII 跳过(含中文不处理)', () => {
    const root = createTempProject()
    try {
      writeFixture(root, {
        en: { mixed: 'Hello 世界', pure: 'OpenAI' },
        ja: { mixed: 'Hello 世界', pure: 'OpenAI' },
      })
      runScript([], { cwd: root })
      const ja = readLang(root, 'ja')
      assert.equal(ja.mixed, 'Hello 世界', '含中文的 enValue 应跳过(不匹配 ASCII_RE)')
      assert.equal(ja.pure, 'オープンＡＩ', '纯 ASCII 的 OpenAI 应被替换')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('langValue !== enValue 跳过(已翻译不重复处理)', () => {
    const root = createTempProject()
    try {
      writeFixture(root, {
        en: { brand: 'OpenAI' },
        ja: { brand: 'オープンＡＩ' }, // 已翻译,值 !== en
      })
      const r = runScript([], { cwd: root })
      assert.equal(readLang(root, 'ja').brand, 'オープンＡＩ', '已翻译的值不应被重复处理')
      assert.match(r.stdout, /ja: 翻译 0 处, 全角兜底 0 处/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('替换策略 — MAP 命中 + 全角兜底', () => {
  test('ja: MAP_JA 命中 "OpenAI" → "オープンＡＩ"(replaced 计数)', () => {
    const root = createTempProject()
    try {
      writeFixture(root, { en: { brand: 'OpenAI' }, ja: { brand: 'OpenAI' } })
      const r = runScript([], { cwd: root })
      assert.equal(readLang(root, 'ja').brand, 'オープンＡＩ')
      assert.match(r.stdout, /ja: 翻译 1 处, 全角兜底 0 处/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('ko: MAP_KO 命中 "OpenAI" → "오픈ＡＩ"(replaced 计数)', () => {
    const root = createTempProject()
    try {
      writeFixture(root, { en: { brand: 'OpenAI' }, ko: { brand: 'OpenAI' } })
      const r = runScript([], { cwd: root })
      assert.equal(readLang(root, 'ko').brand, '오픈ＡＩ')
      assert.match(r.stdout, /ko: 翻译 1 处, 全角兜底 0 处/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('MAP 未命中 → 全角兜底("FooBar" → "ＦｏｏＢａｒ")', () => {
    const root = createTempProject()
    try {
      writeFixture(root, { en: { unknown: 'FooBar' }, ja: { unknown: 'FooBar' } })
      const r = runScript([], { cwd: root })
      assert.equal(readLang(root, 'ja').unknown, 'ＦｏｏＢａｒ')
      assert.match(r.stdout, /ja: 翻译 0 处, 全角兜底 1 处/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('未命中样例输出(unmappedSamples 打印)', () => {
    const root = createTempProject()
    try {
      writeFixture(root, { en: { unknown: 'FooBar' }, ja: { unknown: 'FooBar' } })
      const r = runScript([], { cwd: root })
      assert.match(r.stdout, /未在映射表中、全角兜底的样例/)
      assert.match(r.stdout, /\[ja\] unknown: "FooBar" → "ＦｏｏＢａｒ"/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('dry-run 模式 — 只打印不写回', () => {
  test('--dry-run 打印替换信息但文件不变', () => {
    const root = createTempProject()
    try {
      const jaOriginal = { brand: 'OpenAI' }
      writeFixture(root, { en: { brand: 'OpenAI' }, ja: jaOriginal })
      const r = runScript(['--dry-run'], { cwd: root })
      assert.equal(r.status, 0, `dry-run 应 exit 0,实际 ${r.status}`)
      assert.match(r.stdout, /dry-run, 未写回/)
      assert.deepEqual(readLang(root, 'ja'), jaOriginal, 'dry-run 不应写回文件')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('无 --dry-run 实际写回(2 空格缩进 + 末尾换行)', () => {
    const root = createTempProject()
    try {
      writeFixture(root, { en: { brand: 'OpenAI' }, ja: { brand: 'OpenAI' } })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(r.stdout, /已写回/)
      const raw = readLangRaw(root, 'ja')
      assert.equal(
        raw,
        JSON.stringify({ brand: 'オープンＡＩ' }, null, 2) + '\n',
        '写回应为 2 空格缩进 + 末尾换行',
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('嵌套对象 + 边界场景', () => {
  test('嵌套对象 dot path 支持(page.title → 替换)', () => {
    const root = createTempProject()
    try {
      writeFixture(root, {
        en: { page: { title: 'OpenAI', desc: 'FooBar' } },
        ja: { page: { title: 'OpenAI', desc: 'FooBar' } },
      })
      runScript([], { cwd: root })
      const ja = readLang(root, 'ja')
      assert.equal(ja.page.title, 'オープンＡＩ', '嵌套 page.title 应被 MAP_JA 替换')
      assert.equal(ja.page.desc, 'ＦｏｏＢａｒ', '嵌套 page.desc 应全角兜底')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('数组/number/boolean 不受影响(collectLeaves 只收 string leaf)', () => {
    const root = createTempProject()
    try {
      const fixture = {
        count: 42,
        enabled: true,
        empty: null,
        list: ['OpenAI', 'FooBar'],
        nested: { num: 100, bool: false },
      }
      writeFixture(root, { en: fixture, ja: fixture })
      runScript([], { cwd: root })
      assert.deepEqual(readLang(root, 'ja'), fixture, '非 string leaf 值不应被修改')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('ja + ko 同时处理(默认两个语言都跑,MAP 各自独立)', () => {
    const root = createTempProject()
    try {
      writeFixture(root, {
        en: { a: 'OpenAI', b: 'FooBar' },
        ja: { a: 'OpenAI', b: 'FooBar' },
        ko: { a: 'OpenAI', b: 'FooBar' },
      })
      const r = runScript([], { cwd: root })
      const ja = readLang(root, 'ja')
      const ko = readLang(root, 'ko')
      assert.equal(ja.a, 'オープンＡＩ', 'ja 用 MAP_JA 替换')
      assert.equal(ko.a, '오픈ＡＩ', 'ko 用 MAP_KO 替换')
      assert.equal(ja.b, 'ＦｏｏＢａｒ', 'ja 全角兜底')
      assert.equal(ko.b, 'ＦｏｏＢａｒ', 'ko 全角兜底(同一英文值兜底结果相同)')
      // 总计:翻译 2 处(ja+ko 各 1 个 OpenAI), 全角兜底 2 处(ja+ko 各 1 个 FooBar)
      assert.match(r.stdout, /总计: 翻译 2 处, 全角兜底 2 处/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
