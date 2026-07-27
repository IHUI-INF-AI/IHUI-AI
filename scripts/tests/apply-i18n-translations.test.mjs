/**
 * @file apply-i18n-translations.mjs 回归测试基线
 * @description 覆盖 scripts/apply-i18n-translations.mjs 的核心规则:
 *   1. 4 语言(ja/ko/zh-CN/zh-TW)各自读 i18n-translation-<lang>.json 翻译映射
 *   2. en.json 为源,leaf path 提取;仅替换 lang 文件中值 === en 值的键
 *   3. enValue 过滤:非 string / length < 2 / 非 ASCII 跳过
 *   4. 翻译映射过滤:translation === undefined / === enValue 跳过
 *   5. langValue !== enValue 跳过(已翻译不重复)
 *   6. BOM 容忍:readJSONStripBOM 处理 UTF-8 BOM
 *   7. 嵌套对象路径:getNested/setNested 支持 dot path
 *   8. 写回格式:JSON.stringify(obj, null, 2) + '\n'
 *   9. 退出码 + 日志输出("N 个键已翻译" + "总计: N 个键已翻译")
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
const SCRIPT_PATH = path.join(__dirname, '..', 'apply-i18n-translations.mjs')
const LANGS = ['ja', 'ko', 'zh-CN', 'zh-TW']

// ─── 辅助:创建临时项目根目录(含 apps/web/messages/ + .trae-cn/goal-runtime/) ───
function createTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-apply-i18n-'))
  fs.mkdirSync(path.join(root, 'apps', 'web', 'messages'), { recursive: true })
  fs.mkdirSync(path.join(root, '.trae-cn', 'goal-runtime'), { recursive: true })
  return root
}

function writeMessages(root, lang, obj) {
  fs.writeFileSync(
    path.join(root, 'apps', 'web', 'messages', `${lang}.json`),
    JSON.stringify(obj, null, 2),
    'utf8',
  )
}

function writeMessagesWithBOM(root, lang, obj) {
  fs.writeFileSync(
    path.join(root, 'apps', 'web', 'messages', `${lang}.json`),
    '\uFEFF' + JSON.stringify(obj, null, 2),
    'utf8',
  )
}

function writeTranslationMap(root, lang, obj) {
  fs.writeFileSync(
    path.join(root, '.trae-cn', 'goal-runtime', `i18n-translation-${lang}.json`),
    JSON.stringify(obj, null, 2),
    'utf8',
  )
}

function readMessages(root, lang) {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'apps', 'web', 'messages', `${lang}.json`), 'utf8'),
  )
}

function readMessagesRaw(root, lang) {
  return fs.readFileSync(path.join(root, 'apps', 'web', 'messages', `${lang}.json`), 'utf8')
}

// 写入完整 fixture(en + 4 lang + 4 translation map),未指定的 lang/translation 默认 {}
function writeFullFixture(root, { en = {}, langs = {}, translations = {} } = {}) {
  writeMessages(root, 'en', en)
  for (const lang of LANGS) {
    writeMessages(root, lang, langs[lang] !== undefined ? langs[lang] : {})
  }
  for (const lang of LANGS) {
    writeTranslationMap(root, lang, translations[lang] || {})
  }
}

function runScript(opts = {}) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

describe('CLI 基础行为 — 退出码 + 文件缺失', () => {
  test('完整 fixture 但 en={} → exit 0,4 语言均 0 替换', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, { en: {} })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0, `空 en 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
      for (const lang of LANGS) {
        assert.match(r.stdout, new RegExp(`${lang}: 0 个键已翻译`), `应输出 ${lang}: 0 个键已翻译`)
      }
      assert.match(r.stdout, /总计: 0 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('缺失 i18n-translation-<lang>.json → 抛错 exit 非 0', () => {
    const root = createTempProject()
    try {
      // 只创建 en.json,不创建 translation map → 脚本读 i18n-translation-ja.json 时抛 ENOENT
      writeMessages(root, 'en', { save: 'Save' })
      const r = runScript({ cwd: root })
      assert.notEqual(r.status, 0, `缺失翻译映射应 exit 非 0,实际 ${r.status}`)
      assert.match(r.stderr, /ENOENT|i18n-translation-/, `stderr 应含 ENOENT 或文件名,实际: ${r.stderr}`)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('核心替换规则 — en 值 → lang 值', () => {
  test('基础替换:zh-CN 仍为英文 "Save" → 替换为 "保存"', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        en: { common: { save: 'Save' } },
        langs: { 'zh-CN': { common: { save: 'Save' } } },
        translations: { 'zh-CN': { Save: '保存' } },
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0, `基础替换应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
      assert.equal(readMessages(root, 'zh-CN').common.save, '保存')
      assert.match(r.stdout, /zh-CN: 1 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('langValue !== enValue 跳过:zh-CN 已翻译为 "已保存" 不重复替换', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        en: { save: 'Save' },
        langs: { 'zh-CN': { save: '已保存' } },
        translations: { 'zh-CN': { Save: '保存' } },
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0)
      assert.equal(readMessages(root, 'zh-CN').save, '已保存', '已翻译的值不应被覆盖')
      assert.match(r.stdout, /zh-CN: 0 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('enValue.length < 2 跳过:单字符 "S" 不替换', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        en: { short: 'S' },
        langs: { 'zh-CN': { short: 'S' } },
        translations: { 'zh-CN': { S: '甲' } },
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0)
      assert.equal(readMessages(root, 'zh-CN').short, 'S', '长度 < 2 应跳过')
      assert.match(r.stdout, /zh-CN: 0 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('enValue 非 ASCII 跳过:"Hello 世界" 不替换(含中文)', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        en: { greeting: 'Hello 世界' },
        langs: { 'zh-CN': { greeting: 'Hello 世界' } },
        translations: { 'zh-CN': { 'Hello 世界': '你好世界' } },
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0)
      assert.equal(readMessages(root, 'zh-CN').greeting, 'Hello 世界', '非 ASCII 应跳过')
      assert.match(r.stdout, /zh-CN: 0 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('translation === undefined 跳过:翻译映射无 "Save" 条目', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        en: { save: 'Save' },
        langs: { 'zh-CN': { save: 'Save' } },
        translations: { 'zh-CN': {} }, // 空 mapping
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0)
      assert.equal(readMessages(root, 'zh-CN').save, 'Save', '无翻译条目应跳过')
      assert.match(r.stdout, /zh-CN: 0 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('translation === enValue 跳过:映射值与原值相同(no-op)', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        en: { save: 'Save' },
        langs: { 'zh-CN': { save: 'Save' } },
        translations: { 'zh-CN': { Save: 'Save' } }, // 相同值
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0)
      assert.equal(readMessages(root, 'zh-CN').save, 'Save', 'translation === enValue 应跳过')
      assert.match(r.stdout, /zh-CN: 0 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('非 string enValue 跳过:number/boolean/null/array 不替换', () => {
    const root = createTempProject()
    try {
      const en = { count: 42, enabled: true, empty: null, list: ['a', 'b'] }
      writeFullFixture(root, {
        en,
        langs: { 'zh-CN': { ...en } },
        translations: { 'zh-CN': { '42': '数', true: '真' } },
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0)
      const after = readMessages(root, 'zh-CN')
      assert.equal(after.count, 42)
      assert.equal(after.enabled, true)
      assert.equal(after.empty, null)
      assert.deepEqual(after.list, ['a', 'b'])
      assert.match(r.stdout, /zh-CN: 0 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('嵌套对象路径替换:en.page.title + en.page.nested.deep', () => {
    const root = createTempProject()
    try {
      const en = { page: { title: 'Save', nested: { deep: 'Cancel' } } }
      writeFullFixture(root, {
        en,
        langs: { 'zh-CN': JSON.parse(JSON.stringify(en)) },
        translations: { 'zh-CN': { Save: '保存', Cancel: '取消' } },
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0)
      const after = readMessages(root, 'zh-CN')
      assert.equal(after.page.title, '保存')
      assert.equal(after.page.nested.deep, '取消')
      assert.match(r.stdout, /zh-CN: 2 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('BOM 容忍 — readJSONStripBOM', () => {
  test('en.json + zh-CN.json 带 UTF-8 BOM 仍可正确解析替换', () => {
    const root = createTempProject()
    try {
      writeMessagesWithBOM(root, 'en', { save: 'Save' })
      writeMessagesWithBOM(root, 'zh-CN', { save: 'Save' })
      for (const lang of ['ko', 'ja', 'zh-TW']) {
        writeMessages(root, lang, {})
      }
      for (const lang of LANGS) {
        writeTranslationMap(root, lang, lang === 'zh-CN' ? { Save: '保存' } : {})
      }
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0, `BOM fixture 应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`)
      assert.equal(readMessages(root, 'zh-CN').save, '保存', 'BOM 不影响解析替换')
      assert.match(r.stdout, /zh-CN: 1 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('4 语言独立处理 — 各自翻译映射', () => {
  test('4 语言各自读独立 translation map,总计 4 替换', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        en: { save: 'Save' },
        langs: {
          ja: { save: 'Save' },
          ko: { save: 'Save' },
          'zh-CN': { save: 'Save' },
          'zh-TW': { save: 'Save' },
        },
        translations: {
          ja: { Save: '保存' },
          ko: { Save: '저장' },
          'zh-CN': { Save: '保存' },
          'zh-TW': { Save: '儲存' },
        },
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0)
      assert.equal(readMessages(root, 'ja').save, '保存')
      assert.equal(readMessages(root, 'ko').save, '저장')
      assert.equal(readMessages(root, 'zh-CN').save, '保存')
      assert.equal(readMessages(root, 'zh-TW').save, '儲存')
      assert.match(r.stdout, /总计: 4 个键已翻译/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('写回格式 — 2 空格缩进 + 末尾换行', () => {
  test('zh-CN.json 写回后:2 空格缩进 + 末尾 "\\n"', () => {
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        en: { save: 'Save' },
        langs: { 'zh-CN': { save: 'Save' } },
        translations: { 'zh-CN': { Save: '保存' } },
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0)
      const raw = readMessagesRaw(root, 'zh-CN')
      assert.ok(raw.endsWith('\n'), '文件应以 \\n 结尾')
      assert.ok(raw.includes('  "save": "保存"'), '应使用 2 空格缩进')
      assert.ok(!raw.includes('    "save"'), '不应使用 4 空格缩进')
      assert.ok(!raw.includes('\t"save"'), '不应使用 tab 缩进')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('多键替换 + 总计计数', () => {
  test('4 语言不同替换数,总计 = 各语言替换数之和', () => {
    const root = createTempProject()
    try {
      const en = { a: 'Save', b: 'Cancel', c: 'Delete' }
      writeFullFixture(root, {
        en,
        langs: {
          ja: { ...en },
          ko: { ...en },
          'zh-CN': { ...en },
          'zh-TW': { ...en },
        },
        translations: {
          ja: {}, // 0 替换
          ko: { Save: '저장' }, // 1
          'zh-CN': { Save: '保存', Delete: '删除' }, // 2(Cancel 无映射)
          'zh-TW': { Save: '儲存', Cancel: '取消', Delete: '刪除' }, // 3
        },
      })
      const r = runScript({ cwd: root })
      assert.equal(r.status, 0, `多键替换应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
      assert.match(r.stdout, /ja: 0 个键已翻译/)
      assert.match(r.stdout, /ko: 1 个键已翻译/)
      assert.match(r.stdout, /zh-CN: 2 个键已翻译/)
      assert.match(r.stdout, /zh-TW: 3 个键已翻译/)
      assert.match(r.stdout, /总计: 6 个键已翻译/)

      const ko = readMessages(root, 'ko')
      assert.equal(ko.a, '저장')
      assert.equal(ko.b, 'Cancel')
      assert.equal(ko.c, 'Delete')

      const zhCN = readMessages(root, 'zh-CN')
      assert.equal(zhCN.a, '保存')
      assert.equal(zhCN.b, 'Cancel', 'Cancel 无映射应保留原值')
      assert.equal(zhCN.c, '删除')

      const zhTW = readMessages(root, 'zh-TW')
      assert.equal(zhTW.a, '儲存')
      assert.equal(zhTW.b, '取消')
      assert.equal(zhTW.c, '刪除')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
