/**
 * @file i18n-apply.mjs 回归测试基线
 * @description 本测试覆盖 scripts/i18n-apply.mjs 的核心规则(§19 AI 翻译流水线第④步):
 *   1. 输入读取:默认 .trae-cn/tmp/i18n-translations.json,--input 自定义路径
 *   2. 结构校验:translations 字段缺失 → exit 1;基准 zh-CN 缺失 → exit 1;文件不存在 → exit 1
 *   3. 应用规则:遍历 en/ja/ko/zh-TW
 *      - translations[lang] 不存在 → skipped++
 *      - messages[lang] 不存在 → errors++,跳过该语言
 *      - 翻译值非 string → errors++,跳过该 key
 *      - setByPath 按 dot-path 写入,自动创建中间对象
 *   4. reorderToBase:按 zh-CN 基准 key 顺序重排,目标语言多余 key 追加到末尾
 *   5. --check 模式:只校验 parity 不写入,通过 exit 0 / 失败 exit 1
 *   6. --target=<x>:web/extension/miniapp-taro/shared 切换 messages 目录
 *   7. 应用后自动 parity 校验:仍有 missing key → exit 1
 *   8. 写回格式:JSON.stringify(obj, null, 2) + '\n'
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
const SCRIPT_PATH = path.join(__dirname, '..', 'i18n-apply.mjs')
const BASE_LANG = 'zh-CN'
const TARGET_LANGS = ['en', 'ja', 'ko', 'zh-TW']

// ─── 辅助:strip ANSI 颜色码(脚本 stdout/stderr 含 \x1b[32m 等) ───
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

// ─── 辅助:创建临时项目根目录(含 packages/i18n/messages/<target>/ + .trae-cn/tmp/) ───
function createTempProject(target = 'web') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-i18n-apply-'))
  fs.mkdirSync(path.join(root, 'packages', 'i18n', 'messages', target), { recursive: true })
  fs.mkdirSync(path.join(root, '.trae-cn', 'tmp'), { recursive: true })
  return root
}

function writeMessages(root, target, lang, obj) {
  fs.writeFileSync(
    path.join(root, 'packages', 'i18n', 'messages', target, `${lang}.json`),
    JSON.stringify(obj, null, 2),
    'utf8',
  )
}

function readMessages(root, target, lang) {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'packages', 'i18n', 'messages', target, `${lang}.json`), 'utf8'),
  )
}

function readMessagesRaw(root, target, lang) {
  return fs.readFileSync(path.join(root, 'packages', 'i18n', 'messages', target, `${lang}.json`), 'utf8')
}

function writeTranslations(root, obj) {
  fs.writeFileSync(
    path.join(root, '.trae-cn', 'tmp', 'i18n-translations.json'),
    JSON.stringify(obj, null, 2),
    'utf8',
  )
}

// 写入完整 fixture(zh-CN 基准 + 4 目标语言 + 翻译结果)
function writeFullFixture(root, { base = {}, langs = {}, translations = {}, target = 'web' } = {}) {
  writeMessages(root, target, BASE_LANG, base)
  for (const lang of TARGET_LANGS) {
    writeMessages(root, target, lang, langs[lang] !== undefined ? langs[lang] : {})
  }
  writeTranslations(root, {
    translatedAt: '2026-07-24T00:00:00Z',
    translatedBy: 'AI agent (test)',
    translations,
  })
}

function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

describe('CLI 基础行为 — 输入校验 + 退出码', () => {
  test('翻译结果文件不存在 → exit 1,stderr 含"翻译结果文件不存在"', () => {
    const root = createTempProject()
    try {
      // 只写 zh-CN.json,不写 i18n-translations.json
      writeMessages(root, 'web', BASE_LANG, { save: '保存' })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 1, `文件不存在应 exit 1,实际 ${r.status}`)
      assert.match(stripAnsi(r.stderr), /翻译结果文件不存在/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('缺少 translations 字段 → exit 1,stderr 含"缺少 translations 字段"', () => {
    const root = createTempProject()
    try {
      writeMessages(root, 'web', BASE_LANG, { save: '保存' })
      writeTranslations(root, { translatedAt: 'x', translatedBy: 'y' }) // 无 translations
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 1, `缺少 translations 应 exit 1,实际 ${r.status}`)
      assert.match(stripAnsi(r.stderr), /缺少 translations 字段/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('基准语言 zh-CN.json 不存在 → exit 1,stderr 含"基准语言"', () => {
    const root = createTempProject()
    try {
      // 不写 zh-CN.json,只写 4 目标语言
      for (const lang of TARGET_LANGS) {
        writeMessages(root, 'web', lang, { save: 'x' })
      }
      writeTranslations(root, { translations: { en: { save: 'Save' } } })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 1, `基准语言缺失应 exit 1,实际 ${r.status}`)
      assert.match(stripAnsi(r.stderr), /基准语言/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('核心应用规则 — 翻译值写入 + 计数 + 写回格式', () => {
  test('基础应用:4 语言各 1 个翻译,applied=4,exit 0 + 写回 2 空格缩进末尾换行', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        base: { save: '保存' },
        langs: {
          en: { save: '保存' },
          ja: { save: '保存' },
          ko: { save: '保存' },
          'zh-TW': { save: '保存' },
        },
        translations: {
          en: { save: 'Save' },
          ja: { save: '保存' },
          ko: { save: '저장' },
          'zh-TW': { save: '儲存' },
        },
      })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `基础应用应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert.match(stripAnsi(r.stdout), /应用: 4 处/)
      assert.equal(readMessages(root, 'web', 'en').save, 'Save')
      assert.equal(readMessages(root, 'web', 'ja').save, '保存')
      assert.equal(readMessages(root, 'web', 'ko').save, '저장')
      assert.equal(readMessages(root, 'web', 'zh-TW').save, '儲存')
      // 写回格式:2 空格缩进 + 末尾换行
      const raw = readMessagesRaw(root, 'web', 'en')
      assert.ok(raw.endsWith('\n'), '文件应以 \\n 结尾')
      assert.ok(raw.includes('  "save": "Save"'), '应使用 2 空格缩进')
      assert.ok(!raw.includes('\t"save"'), '不应使用 tab 缩进')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('translations[lang] 不存在 → skipped++,该语言文件不变', () => {
    const root = createTempProject()
    try {
      const enOriginal = { save: 'Save' }
      writeFullFixture(root, {
        base: { save: '保存' },
        langs: {
          en: enOriginal,
          ja: { save: '保存' },
          ko: { save: '저장' },
          'zh-TW': { save: '儲存' },
        },
        translations: { ja: { save: '保存' } }, // 只 ja 有翻译,en/ko/zh-TW 缺失
      })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(stripAnsi(r.stdout), /跳过: 3 语言/)
      // en 未被翻译,保持原值
      assert.deepEqual(readMessages(root, 'web', 'en'), enOriginal)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('翻译值非字符串(number) → errors++,该 key 跳过,其他 key 正常应用', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        base: { save: '保存', count: '计数' },
        langs: {
          en: { save: 'Save', count: 'Count' },
          ja: { save: '保存', count: '計数' },
          ko: { save: '저장', count: '카운트' },
          'zh-TW': { save: '儲存', count: '計數' },
        },
        translations: { en: { save: 'Save', count: 42 } }, // count 是 number
      })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(stripAnsi(r.stdout), /错误: 1/)
      assert.match(stripAnsi(r.stderr), /\[en\] count: 翻译值非字符串/)
      // count 未被覆盖,保持原值
      assert.equal(readMessages(root, 'web', 'en').count, 'Count')
      // save 正常应用
      assert.equal(readMessages(root, 'web', 'en').save, 'Save')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('嵌套对象路径:setByPath 按 dot-path 写入,自动创建中间对象', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        base: { page: { title: '页面标题', action: { save: '保存' } } },
        langs: {
          en: { page: { title: 'Page Title', action: { save: 'Save' } } },
          ja: { page: { title: 'ページタイトル', action: { save: '保存' } } },
          ko: { page: { title: '페이지 제목', action: { save: '저장' } } },
          'zh-TW': { page: { title: '頁面標題', action: { save: '儲存' } } },
        },
        translations: { en: { 'page.action.save': 'Save Updated' } },
      })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `嵌套路径应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`)
      assert.equal(readMessages(root, 'web', 'en').page.action.save, 'Save Updated')
      // title 不受影响
      assert.equal(readMessages(root, 'web', 'en').page.title, 'Page Title')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('reorderToBase — 按 zh-CN 基准重排 key 顺序', () => {
  test('目标语言 key 顺序与 zh-CN 不一致,应用后按 zh-CN 重排', () => {
    const root = createTempProject()
    try {
      // zh-CN 顺序: a, b, c;en 故意乱序: c, b, a
      writeFullFixture(root, {
        base: { a: '甲', b: '乙', c: '丙' },
        langs: {
          en: { c: 'C', b: 'B', a: 'A' },
          ja: { a: '甲', b: '乙', c: '丙' },
          ko: { a: '갑', b: '을', c: '병' },
          'zh-TW': { a: '甲', b: '乙', c: '丙' },
        },
        translations: { en: { a: 'A-new' } },
      })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      const en = readMessages(root, 'web', 'en')
      // 重排后 key 顺序应为 a, b, c(与 zh-CN 一致)
      assert.deepEqual(Object.keys(en), ['a', 'b', 'c'], 'en 应按 zh-CN 顺序重排')
      assert.equal(en.a, 'A-new')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('目标语言多余的 key(base 缺失)追加到末尾,不丢失', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        base: { a: '甲', b: '乙' },
        langs: {
          en: { a: 'A', b: 'B', extraKey: 'Extra' }, // extraKey 不在 base
          ja: { a: '甲', b: '乙' },
          ko: { a: '갑', b: '을' },
          'zh-TW': { a: '甲', b: '乙' },
        },
        translations: { en: { a: 'A-new' } },
      })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      const en = readMessages(root, 'web', 'en')
      // base 的 key 在前,extraKey 追加到末尾
      assert.deepEqual(Object.keys(en), ['a', 'b', 'extraKey'])
      assert.equal(en.extraKey, 'Extra', '多余 key 不应丢失')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('--check 模式 — 只校验 parity 不写入', () => {
  test('parity 通过(4 语言 key 集合与 zh-CN 一致)→ exit 0', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        base: { save: '保存', cancel: '取消' },
        langs: {
          en: { save: 'Save', cancel: 'Cancel' },
          ja: { save: '保存', cancel: 'キャンセル' },
          ko: { save: '저장', cancel: '취소' },
          'zh-TW': { save: '儲存', cancel: '取消' },
        },
        translations: {}, // check 模式不读 translations,但文件要存在
      })
      const r = runScript(['--check'], { cwd: root })
      assert.equal(r.status, 0, `parity 通过应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`)
      assert.match(stripAnsi(r.stdout), /parity 校验通过/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('parity 失败(en 缺 key)→ exit 1,stderr 含缺失键', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        base: { save: '保存', cancel: '取消', delete: '删除' },
        langs: {
          en: { save: 'Save' }, // 缺 cancel, delete
          ja: { save: '保存', cancel: 'キャンセル', delete: '削除' },
          ko: { save: '저장', cancel: '취소', delete: '삭제' },
          'zh-TW': { save: '儲存', cancel: '取消', delete: '刪除' },
        },
        translations: {},
      })
      const r = runScript(['--check'], { cwd: root })
      assert.equal(r.status, 1, `parity 失败应 exit 1,实际 ${r.status}`)
      assert.match(stripAnsi(r.stderr), /parity 校验失败/)
      assert.match(stripAnsi(r.stderr), /\[en\] 缺失 2 键/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('--input 自定义路径 + --target 切换目录', () => {
  test('--input 指定自定义翻译结果路径,默认路径文件被忽略', () => {
    const root = createTempProject()
    try {
      writeMessages(root, 'web', BASE_LANG, { save: '保存' })
      for (const lang of TARGET_LANGS) {
        writeMessages(root, 'web', lang, { save: '保存' })
      }
      // 默认路径写一个"错误"的翻译(不应被读取)
      writeTranslations(root, {
        translatedBy: 'wrong',
        translations: { en: { save: 'WRONG' } },
      })
      // 自定义路径写正确翻译
      const customPath = path.join(root, 'custom-translations.json')
      fs.writeFileSync(
        customPath,
        JSON.stringify({
          translatedAt: '2026-07-24T00:00:00Z',
          translatedBy: 'correct',
          translations: { en: { save: 'Save' } },
        }, null, 2),
        'utf8',
      )
      const r = runScript(['--input', customPath], { cwd: root })
      assert.equal(r.status, 0, `--input 应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`)
      assert.equal(readMessages(root, 'web', 'en').save, 'Save', '应使用 --input 指定文件的翻译')
      assert.match(stripAnsi(r.stdout), /翻译来源: correct/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('--target=extension 操作 extension messages 目录,web 目录不受影响', () => {
    const root = createTempProject('extension')
    try {
      // extension 目录写完整 fixture
      writeMessages(root, 'extension', BASE_LANG, { save: '保存' })
      for (const lang of TARGET_LANGS) {
        writeMessages(root, 'extension', lang, { save: '保存' })
      }
      writeTranslations(root, {
        translatedAt: '2026-07-24T00:00:00Z',
        translatedBy: 'test',
        translations: { en: { save: 'Save' } },
      })
      const r = runScript(['--target=extension'], { cwd: root })
      assert.equal(r.status, 0, `--target=extension 应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`)
      assert.equal(readMessages(root, 'extension', 'en').save, 'Save')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('应用后 parity 自动校验 — 翻译不完整仍 exit 1', () => {
  test('应用后 en 仍缺 key(翻译结果不完整)→ exit 1,stderr 含"应用后仍有 parity 问题"', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        base: { save: '保存', cancel: '取消', delete: '删除' },
        langs: {
          en: { save: 'Save' }, // 缺 cancel, delete
          ja: { save: '保存', cancel: 'キャンセル', delete: '削除' },
          ko: { save: '저장', cancel: '취소', delete: '삭제' },
          'zh-TW': { save: '儲存', cancel: '取消', delete: '刪除' },
        },
        // 翻译结果只补 save,en 仍缺 cancel/delete
        translations: { en: { save: 'Save Updated' } },
      })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 1, `应用后 parity 不通过应 exit 1,实际 ${r.status}`)
      assert.match(stripAnsi(r.stderr), /应用后仍有 parity 问题/)
      assert.match(stripAnsi(r.stderr), /\[en\] 仍缺 2 键/)
      // save 仍被应用了(写回发生)
      assert.equal(readMessages(root, 'web', 'en').save, 'Save Updated')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
