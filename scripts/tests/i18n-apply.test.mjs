// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file i18n-apply.mjs 回归测试基线
 * @description 本测试覆盖 scripts/i18n-apply.mjs 的核心规则(§19 AI 翻译流水线第④步):
 *   1. 输入读取:默认 .ihui-agent/tmp/i18n-translations.json,--input 自定义路径
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
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// §22c:镜像测试直接 import 源脚本导出的判据函数,禁止在测试里复制一份规则
import { __test__ as __testSut } from '../i18n-apply.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = path.join(__dirname, '..', 'i18n-apply.mjs')
const BASE_LANG = 'zh-CN'
const TARGET_LANGS = ['en', 'ja', 'ko', 'zh-TW']

// ─── 辅助:strip ANSI 颜色码(脚本 stdout/stderr 含 \x1b[32m 等) ───
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

// ─── 辅助:创建临时项目根目录(含 packages/i18n/messages/<target>/ + .ihui-agent/tmp/) ───
function createTempProject(target = 'web') {
  const root = mkScratch("ihui-i18n-apply-")
  fs.mkdirSync(path.join(root, 'packages', 'i18n', 'messages', target), { recursive: true })
  fs.mkdirSync(path.join(root, '.ihui-agent', 'tmp'), { recursive: true })
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
    fs.readFileSync(
      path.join(root, 'packages', 'i18n', 'messages', target, `${lang}.json`),
      'utf8',
    ),
  )
}

function readMessagesRaw(root, target, lang) {
  return fs.readFileSync(
    path.join(root, 'packages', 'i18n', 'messages', target, `${lang}.json`),
    'utf8',
  )
}

function writeTranslations(root, obj) {
  fs.writeFileSync(
    path.join(root, '.ihui-agent', 'tmp', 'i18n-translations.json'),
    JSON.stringify(obj, null, 2),
    'utf8',
  )
}

// 写入完整 fixture(zh-CN 基准 + 4 目标语言 + 翻译结果)
// 2026-10-15 起真实契约多了两道写盘准入(票面修法③):本轮跑过 --check ∧ 载荷不早于盘上 mtime。
// 所以 fixture 的 translatedAt 用"现在"(与真实流水线一致:i18n-diff 产出载荷总在上一次写盘之后),
// 并替调用方跑一次 --check 生成对账凭据 —— 需要测准入拒绝的用例请改用 runScriptRaw / 自己造旧时间戳。
function writeFullFixture(root, { base = {}, langs = {}, translations = {}, target = 'web', translatedAt } = {}) {
  writeMessages(root, target, BASE_LANG, base)
  for (const lang of TARGET_LANGS) {
    writeMessages(root, target, lang, langs[lang] !== undefined ? langs[lang] : {})
  }
  writeTranslations(root, {
    translatedAt: translatedAt ?? new Date(Date.now() + 1000).toISOString(),
    translatedBy: 'AI agent (test)',
    translations,
  })
}

function runScriptRaw(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    // §5b 弹窗治理 + 守门 52/80:派生控制台程序必须 windowsHide,且不得无界挂起
    windowsHide: true,
    timeout: 60_000,
  })
}

/**
 * 2026-10-15 新契约(票面修法③):写盘模式必须先有本轮 `--check` 的对账凭据。
 * 默认替调用方补这一步(`--check` 本身不写任何文件,只会生成凭据),
 * 需要测"没对账就拒写/凭据对不上"的用式请直接用 runScriptRaw。
 */
function runScript(args = [], opts = {}) {
  if (!args.includes('--check')) {
    runScriptRaw(['--check', ...args], opts)
  }
  return runScriptRaw(args, opts)
}

// 某端语言包目录的字节指纹(文件名 + 内容),用于证明"这一端一个字节都没动"
function dirFingerprint(root, target) {
  const dir = path.join(root, 'packages', 'i18n', 'messages', target)
  if (!fs.existsSync(dir)) return '<missing>'
  return fs
    .readdirSync(dir)
    .sort()
    .map((f) => `${f}::${fs.readFileSync(path.join(dir, f), 'utf8')}`)
    .join('||')
}

// 同时铺两端(web + 被测端)的干净夹具:错读/错写任何一端都能被指纹区分出来
function writeTwoEndFixture(root, end, translations) {
  for (const target of ['web', end]) {
    fs.mkdirSync(path.join(root, 'packages', 'i18n', 'messages', target), { recursive: true })
    writeMessages(root, target, BASE_LANG, { save: '保存' })
    for (const lang of TARGET_LANGS) {
      writeMessages(root, target, lang, { save: '保存' })
    }
  }
  writeTranslations(root, translations)
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
      assert.equal(
        r.status,
        0,
        `基础应用应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
      )
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

  test('翻译值为非字符串(number/array)→ 2026-07-28 起按新契约**应用**,不再计 errors', () => {
    // 被测 i18n-apply.mjs:163-176 明确升级:"支持非字符串值(数组/对象)"。
    // 旧契约(typeof value !== 'string' → errors++ 并跳过)已作废,
    // 现只有 undefined/null 才算错误(见下方反向用例)。
    const root = createTempProject()
    try {
      writeFullFixture(root, {
        base: { save: '保存', count: '计数', items: '条目' },
        langs: {
          en: { save: 'Save', count: 'Count', items: ['a'] },
          ja: { save: '保存', count: '計数', items: ['あ'] },
          ko: { save: '저장', count: '카운트', items: ['ㅇ'] },
          'zh-TW': { save: '儲存', count: '計數', items: ['ㄚ'] },
        },
        translations: { en: { save: 'Save', count: 42, items: ['x', 'y'] } },
      })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      const out = stripAnsi(r.stdout)
      assert.match(
        out,
        /应用: 3 处,跳过: 3 语言,错误: 0/,
        `新契约: 非字符串值计入 applied\nstdout: ${out}`,
      )
      // number 与 array 均落到文件里(不是"跳过")
      const en = readMessages(root, 'web', 'en')
      assert.equal(en.count, 42, 'number 值应被应用')
      assert.deepEqual(en.items, ['x', 'y'], 'array 值应被应用')
      assert.equal(en.save, 'Save')
      assert.ok(readMessagesRaw(root, 'web', 'en').includes('"count": 42'), '文件应含写入后的数值')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('反向钉:真正的错误路径(null 值 / 目标语言文件缺失)仍计 errors 并点名', () => {
    // 上一用例把"非字符串不再报错"的口子开后,若不钉反向用例,等于把错误检测整个关掉。
    // 被测 i18n-apply.mjs:155-157(语言文件缺失)/ 170-172(值为 null)两条错误通道必须仍生效。
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
        translations: { en: { save: null }, ja: { save: 'セーブ' } },
      })
      // 删除 ja.json → messages 读不到 ja(该语言是错误,不是 skip)
      fs.rmSync(path.join(root, 'packages', 'i18n', 'messages', 'web', 'ja.json'))
      const r = runScript([], { cwd: root })
      // 现契约:errors 计数并打印告警,但退出码仍由 parity 决定(此处 parity 无缺键 → exit 0)
      assert.equal(r.status, 0, `错误不阻断退出码(仅 parity 阻断)\nstdout: ${r.stdout}`)
      assert.match(
        stripAnsi(r.stdout),
        /应用: 0 处,跳过: 2 语言,错误: 2/,
        `stdout:\n${stripAnsi(r.stdout)}`,
      )
      const err = stripAnsi(r.stderr)
      assert.match(err, /\[en\] save: 翻译值为/, `null 值应点名\nstderr: ${err}`)
      assert.match(err, /ja\.json 不存在/, `缺语言文件应点名\nstderr: ${err}`)
      // 报错的 key 未被覆盖
      assert.equal(readMessages(root, 'web', 'en').save, 'Save', 'null 值不得写入')
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
        JSON.stringify(
          {
            // 这几臂测的是 --input / --target 路由,不是陈旧守卫 ⇒ 载荷用"现在"(见 writeFullFixture 注)
          translatedAt: new Date(Date.now() + 1000).toISOString(),
            translatedBy: 'correct',
            translations: { en: { save: 'Save' } },
          },
          null,
          2,
        ),
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
        // 本臂测 --target 路由,不测陈旧守卫 ⇒ 载荷用"现在"
        translatedAt: new Date(Date.now() + 1000).toISOString(),
        translatedBy: 'test',
        translations: { en: { save: 'Save' } },
      })
      const r = runScript(['--target=extension'], { cwd: root })
      assert.equal(
        r.status,
        0,
        `--target=extension 应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`,
      )
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

// ─── 2026-09-25:--target 端注册 + 写错端的两道防线 ──────────────────────────
// 旧实现 `TARGET_CONFIG[TARGET] || TARGET_CONFIG.web` 让 `--target=mobile-rn` **改写 web 的语言包**,
// 而输出全程报告"成功"。这里两侧都钉:① 写对了那一端(阳性对照:两端都铺夹具,靠指纹区分),
// ② 未知值 / 输入与 --target 不符时零写入。
describe('--target 端注册:mobile-rn / cli / api 真的能写对目录', () => {
  for (const end of ['mobile-rn', 'cli', 'api']) {
    test(`--target=${end} 写 ${end},web 逐字节不变`, () => {
      const root = createTempProject(end)
      try {
        writeTwoEndFixture(root, end, {
          // 本臂测端注册路由(写对目录 + web 不变),不测陈旧守卫 ⇒ 载荷用"现在"
          translatedAt: new Date(Date.now() + 1000).toISOString(),
          translatedBy: 'AI agent (test)',
          target: end,
          messagesDir: `packages/i18n/messages/${end}`,
          translations: { en: { save: `Save-${end}` } },
        })
        const webBefore = dirFingerprint(root, 'web')
        const r = runScript([`--target=${end}`], { cwd: root })
        const out = stripAnsi(r.stdout) + stripAnsi(r.stderr)
        assert.equal(r.status, 0, `应 exit 0\n${out}`)
        // 写对了那一端(若回落到 web,这一条必然失败)
        assert.equal(readMessages(root, end, 'en').save, `Save-${end}`)
        // web 一个字节都没动
        assert.equal(dirFingerprint(root, 'web'), webBefore, `web 语言包不得被改写`)
        // 输出必须自证目标目录
        assert.ok(out.includes(`packages/i18n/messages/${end}`), `stdout 应点名写入目录:\n${out}`)
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })
  }

  test('不带 --target 仍默认写 web(既有行为未变)', () => {
    const root = createTempProject('web')
    try {
      writeTwoEndFixture(root, 'mobile-rn', {
        translations: { en: { save: 'Save-web' } }, // 未声明 target → 只警告,不判死
      })
      const rnBefore = dirFingerprint(root, 'mobile-rn')
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert.equal(readMessages(root, 'web', 'en').save, 'Save-web')
      assert.equal(dirFingerprint(root, 'mobile-rn'), rnBefore, 'mobile-rn 不得被动')
      assert.match(stripAnsi(r.stderr), /未声明 target \/ messagesDir ⇒ 写前对账无从进行/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('显式 --target 指向不存在的目录 → exit 2,不创建目录、不写文件', () => {
    const root = mkScratch("ihui-i18n-apply-")
    fs.mkdirSync(path.join(root, '.ihui-agent', 'tmp'), { recursive: true })
    try {
      writeTranslations(root, { translations: { en: { save: 'Save' } } })
      const r = runScript(['--target=mobile-rn'], { cwd: root })
      const out = stripAnsi(r.stdout) + stripAnsi(r.stderr)
      assert.equal(r.status, 2, `应 exit 2,实际 ${r.status}\n${out}`)
      assert.match(out, /语言包目录不存在/)
      assert.ok(
        !fs.existsSync(path.join(root, 'packages', 'i18n', 'messages', 'mobile-rn')),
        '不得顺手创建目标目录',
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('未知 / 拼错的 --target 一律判死(旧行为:静默按 web 处理)', () => {
  for (const [bad, why] of [
    ['mobile_rn', '下划线代替连字符'],
    ['Miniapp-Taro', '大小写不符'],
    ['nonsense', '根本不存在的名'],
    ['', '空值(--target=)'],
  ]) {
    test(`--target=${bad || '(空)'} (${why}) → exit 2 + 点名错值 + 列可用端 + web 零写入`, () => {
      const root = createTempProject('web')
      try {
        writeMessages(root, 'web', BASE_LANG, { save: '保存' })
        for (const lang of TARGET_LANGS) writeMessages(root, 'web', lang, { save: '保存' })
        writeTranslations(root, { translations: { en: { save: 'Hijacked' } } })
        const webBefore = dirFingerprint(root, 'web')

        const r = runScript([`--target=${bad}`], { cwd: root })
        const out = stripAnsi(r.stdout) + stripAnsi(r.stderr)
        assert.equal(r.status, 2, `应 exit 2(用法错误),实际 ${r.status}\n${out}`)
        assert.match(out, /不是受支持的端/)
        assert.ok(out.includes(JSON.stringify(bad)), `须原样点名 "${bad}":\n${out}`)
        for (const end of [
          'web',
          'extension',
          'miniapp-taro',
          'shared',
          'mobile-rn',
          'cli',
          'api',
        ]) {
          assert.match(
            out,
            new RegExp(`\\b${end.replace(/-/g, '\\-')}\\b`),
            `可用端清单应含 ${end}`,
          )
        }
        // 关键反证:旧实现在这里会把 "Hijacked" 写进 web
        assert.equal(dirFingerprint(root, 'web'), webBefore, '判死前不得发生任何写入')
        assert.equal(readMessages(root, 'web', 'en').save, '保存')
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })
  }

  test('回归锁:源码里不得再出现"未知 target 回落到 web"的那一表达式', () => {
    // 必须先剥注释 —— resolveTarget 的头注逐字引用那串旧表达式来解释为什么禁它,
    // 不剥的话这条锁会在完全合规的源码上恒红(判据看见了自己产出的形态)。
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8')
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n')
      .replace(/\/\/[^\n]*/g, '')
    assert.ok(
      !/TARGET_CONFIG\s*\[\s*TARGET\s*\]\s*\|\|/.test(code),
      'i18n-apply.mjs 不得再有 `TARGET_CONFIG[TARGET] || TARGET_CONFIG.web` 静默回落',
    )
    assert.match(code, /function resolveTarget\(/, '应经 resolveTarget 显式解析')
    assert.match(code, /targetMismatchProblems\(/, '写前对账函数必须存在')
  })
})

describe('写前对账:输入声明的端必须与 --target 一致(防"拿错文件")', () => {
  test('输入 target=web 而 --target=mobile-rn → exit 2,两端都不写', () => {
    const root = createTempProject('mobile-rn')
    try {
      writeTwoEndFixture(root, 'mobile-rn', {
        target: 'web',
        messagesDir: 'packages/i18n/messages/web',
        translations: { en: { save: 'WrongEnd' } },
      })
      const webBefore = dirFingerprint(root, 'web')
      const rnBefore = dirFingerprint(root, 'mobile-rn')
      const r = runScript(['--target=mobile-rn'], { cwd: root })
      const out = stripAnsi(r.stdout) + stripAnsi(r.stderr)
      assert.equal(r.status, 2, `应 exit 2,实际 ${r.status}\n${out}`)
      assert.match(out, /拒绝写入/)
      assert.match(out, /target=web/, '须点名输入声明的那一端')
      assert.match(out, /--target=mobile-rn/, '须点名本次要求的那一端')
      assert.equal(dirFingerprint(root, 'web'), webBefore, 'web 不得被写')
      assert.equal(dirFingerprint(root, 'mobile-rn'), rnBefore, 'mobile-rn 也不得被写')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('输入 messagesDir 与解析出的目录不符(哪怕 target 写得对)→ exit 2', () => {
    const root = createTempProject('cli')
    try {
      writeTwoEndFixture(root, 'cli', {
        target: 'cli',
        messagesDir: 'packages/i18n/messages/web', // 目录串露馅
        translations: { en: { save: 'X' } },
      })
      const before = dirFingerprint(root, 'cli')
      const r = runScript(['--target=cli'], { cwd: root })
      assert.equal(r.status, 2, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert.match(stripAnsi(r.stderr), /messagesDir=packages\/i18n\/messages\/web/)
      assert.equal(dirFingerprint(root, 'cli'), before)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('一致时不误伤:target/messagesDir 与 --target 相符 → 正常写入 exit 0', () => {
    const root = createTempProject('cli')
    try {
      writeTwoEndFixture(root, 'cli', {
        target: 'cli',
        messagesDir: 'packages/i18n/messages/cli',
        translations: { en: { save: 'Save-ok' } },
      })
      const r = runScript(['--target=cli'], { cwd: root })
      assert.equal(r.status, 0, `对账通过应正常写入\n${r.stdout}${r.stderr}`)
      assert.equal(readMessages(root, 'cli', 'en').save, 'Save-ok')
      assert.ok(!stripAnsi(r.stderr).includes('拒绝写入'))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('输入声明了一个不受支持的 target → exit 2 并说明该值本身不是端', () => {
    const root = createTempProject('web')
    try {
      writeMessages(root, 'web', BASE_LANG, { save: '保存' })
      for (const lang of TARGET_LANGS) writeMessages(root, 'web', lang, { save: '保存' })
      writeTranslations(root, { target: 'desktop', translations: { en: { save: 'X' } } })
      const before = dirFingerprint(root, 'web')
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 2, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert.match(stripAnsi(r.stderr), /不是受支持的端/)
      assert.equal(dirFingerprint(root, 'web'), before)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('--check 模式同样先对账(不写入也不等于可以拿错端的输入)', () => {
    const root = createTempProject('mobile-rn')
    try {
      writeTwoEndFixture(root, 'mobile-rn', {
        target: 'web',
        translations: { en: { save: 'X' } },
      })
      const rnBefore = dirFingerprint(root, 'mobile-rn')
      const r = runScript(['--check', '--target=mobile-rn'], { cwd: root })
      assert.equal(r.status, 2, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert.match(stripAnsi(r.stderr), /拒绝写入/)
      assert.equal(dirFingerprint(root, 'mobile-rn'), rnBefore)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

describe('参数守卫 — `--help` 与未识别参数一律不得降级成"无参=写盘"', () => {
  // 四语齐备的载荷:让夹具在正常路径下能通过"应用后自动 parity 校验";
  // 否则退出码不是 0,"盘上零变化"的断言会因为别的原因成立 —— 那是假通过。
  const FULL = {
    en: { greet: 'Hello' },
    ja: { greet: 'こんにちは' },
    ko: { greet: '안녕' },
    'zh-TW': { greet: '你好' },
  }
  // 事故本体(2026-09-25):`node scripts/i18n-apply.mjs --help` 被当无参直接进写盘模式,
  // 拿一份盘上遗留的旧批次重排改写了 web 四份语言包(各 176-214 行新增 / 35-39 删除)。
  // 下面这组用例的每一条都同时断言"退出码"与"目录指纹不变"——只看退出码会放过
  // "打印了用法但顺手写了盘"这种最坏的形态。
  const CASES = [
    { name: '--help', args: ['--help'], want: 0 },
    { name: '-h', args: ['-h'], want: 0 },
    { name: '未知参数 --frobnicate', args: ['--frobnicate'], want: 2 },
    { name: '拼错的 --targett=web', args: ['--targett=web'], want: 2 },
    { name: '裸位置参数(被无声忽略过)', args: ['i18n-translations.json'], want: 2 },
    { name: '把 --input 的值丢了也不许当默认路径写', args: ['--target=web', '--input'], want: 2 },
  ]

  for (const c of CASES) {
    test(`${c.name} → exit ${c.want} 且盘上零变化`, () => {
      const root = createTempProject('web')
      try {
        writeFullFixture(root, {
          base: { greet: '你好' },
          langs: { en: {}, ja: {}, ko: {}, 'zh-TW': {} },
          translations: FULL,
        })
        const before = dirFingerprint(root, 'web')
        const r = runScript(c.args, { cwd: root })
        assert.equal(r.status, c.want, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)
        if (c.want === 0) assert.match(stripAnsi(r.stdout), /用法/)
        else assert.match(stripAnsi(r.stderr), /未识别的参数/)
        assert.equal(dirFingerprint(root, 'web'), before, '守卫失效:语言包被动过')
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })
  }

  // 变异自证:同一份夹具**不带任何参数**必须真的写盘。
  // 缺了这条,上面的"零变化"断言可能只是因为夹具本身跑不起来而恒真。
  test('变异对照:同夹具下无参调用确实会写盘(证明守卫挡掉的是真实破坏面)', () => {
    const root = createTempProject('web')
    try {
      writeFullFixture(root, {
        base: { greet: '你好' },
        langs: { en: {}, ja: {}, ko: {}, 'zh-TW': {} },
        translations: FULL,
      })
      const before = dirFingerprint(root, 'web')
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert.notEqual(
        dirFingerprint(root, 'web'),
        before,
        '无参调用没写盘 → 上面的零变化断言是空的',
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('--deny-overwrite:会改写已翻译键时拒写且零变化;默认模式只点名不拦', () => {
    const mk = () => {
      const root = createTempProject('web')
      // en 里 greet 已是人译的 'Hello'(≠ 源值 '你好'),载荷要把它改成 'Hi'
      writeMessages(root, 'web', BASE_LANG, { greet: '你好' })
      for (const lang of TARGET_LANGS) writeMessages(root, 'web', lang, { greet: 'Hello' })
      writeTranslations(root, { translations: { en: { greet: 'Hi' } } })
      return root
    }
    const def = mk()
    try {
      const r = runScript([], { cwd: def })
      assert.equal(r.status, 0, `默认应放行: ${r.stderr}`)
      assert.match(stripAnsi(r.stderr), /已翻译.*键|会改写/)
      assert.match(
        fs.readFileSync(path.join(def, 'packages/i18n/messages/web/en.json'), 'utf8'),
        /Hi/,
      )
    } finally {
      fs.rmSync(def, { recursive: true, force: true })
    }
    const strict = mk()
    try {
      const before = dirFingerprint(strict, 'web')
      const r = runScript(['--deny-overwrite'], { cwd: strict })
      assert.equal(r.status, 2, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert.match(stripAnsi(r.stderr), /--deny-overwrite 生效/)
      assert.equal(dirFingerprint(strict, 'web'), before, '拒写路径下盘必须零变化')
    } finally {
      fs.rmSync(strict, { recursive: true, force: true })
    }
  })

  test('纯新增(流水线正常动作)不得被回退判据误报', () => {
    const root = createTempProject('web')
    try {
      writeFullFixture(root, {
        base: { greet: '你好', farewell: '再见' },
        langs: {
          en: { greet: '你好' },
          ja: { greet: '你好' },
          ko: { greet: '你好' },
          'zh-TW': { greet: '你好' },
        },
        // greet 现值 == 源值 ⇒ 未翻译占位;farewell 是新键。两者都属正常批次。
        translations: {
          en: { greet: 'Hello', farewell: 'Goodbye' },
          ja: { greet: 'こんにちは', farewell: 'さようなら' },
          ko: { greet: '안녕', farewell: '잘가' },
          'zh-TW': { greet: '你好', farewell: '再見' },
        },
      })
      const r = runScript(['--deny-overwrite'], { cwd: root })
      assert.equal(r.status, 0, `占位重译被误拦: ${r.stderr}`)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

// ─── 2026-10-15 票面修法③(写盘准入)───
// 票面验收判据原文:「`node scripts/i18n-apply.mjs --help` 跑完后
// `git status --porcelain -- packages/i18n` **必须为空**,并把这条负向判据钉成镜像测试。」
// 下面第一臂就是这句话的字面镜像(在隔离夹具里真起一枚 git 仓,真跑 git status);
// 其余各臂钉"陈旧载荷 / 本轮没对账"两道拒绝必须**盘上零变化**。
describe('写盘准入(票面修法③)— 陈旧载荷 / 本轮未对账 ⇒ exit 2 且一个字节都不写', () => {
  const FULL = {
    en: { greet: 'Hello' },
    ja: { greet: 'こんにちは' },
    ko: { greet: '안녕' },
    'zh-TW': { greet: '你好' },
  }
  // 与 FULL 同 key 不同值:应用它**一定会**改变语言包字节。
  // 用它才能让"零变化"断言有牙 —— 拿一份本来就不会改盘的载荷去证明"没写",是空断言。
  const OTHER = {
    en: { greet: 'Second' },
    ja: { greet: '二次' },
    ko: { greet: '두 번째' },
    'zh-TW': { greet: '贰' },
  }

  // §22c:镜像测试直接吃源脚本导出的判据,不在测试里复制一份规则
  const SUT = __testSut

  /** 整棵树指纹(跳过 .git:里面是二进制,读 utf8 会抛)—— 比只看语言包目录更严 */
  function treeFingerprint(root) {
    const walk = (dir, rel) => {
      const out = []
      const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))
      for (const e of entries) {
        if (e.name === '.git') continue
        const abs = path.join(dir, e.name)
        const key = `${rel}/${e.name}`
        if (e.isDirectory()) out.push(...walk(abs, key))
        else out.push(`${key}::${fs.readFileSync(abs, 'utf8')}`)
      }
      return out
    }
    return walk(root, '.').join('||')
  }

  function gitIn(cwd, args) {
    return spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      // §12g:派生 git 必须显式接管 stdio(不写本机稳定 EBUSY)
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 60_000,
    })
  }

  /** 铺一枚真 git 仓夹具:输入载荷 + 语言包一起提交,使工作区初始为 clean(§15c:落点在 scratch,不在仓库树内) */
  function createGitFixture() {
    const root = createTempProject('web')
    writeFullFixture(root, {
      base: { greet: '你好' },
      langs: { en: {}, ja: {}, ko: {}, 'zh-TW': {} },
      translations: FULL,
    })
    const opt = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    gitIn(root, ['init', '-q', '-b', 'main'])
    for (const kv of [
      ['config', 'user.email', 'test@ihui.local'],
      ['config', 'user.name', 'Test'],
      ['config', 'commit.gpgsign', 'false'],
    ]) {
      spawnSync('git', kv, opt)
    }
    // 真仓 .gitignore 忽略 .ihui-agent/tmp;夹具照抄这条条件,否则"工作区干净"是夹具缺条件造出来的
    fs.writeFileSync(path.join(root, '.gitignore'), '.ihui-agent/\n', 'utf8')
    gitIn(root, ['add', '-A'])
    const c = gitIn(root, ['commit', '-q', '-m', 'init'])
    assert.equal(c.status, 0, `夹具 commit 失败:${c.stdout}\n${c.stderr}`)
    return root
  }

  test("票面验收原形:--help 跑完 git status --porcelain 必须为空(整仓 + packages/i18n 两面)", () => {
    const root = createGitFixture()
    try {
      assert.equal(gitIn(root, ['status', '--porcelain']).stdout, '', '夹具起点不干净,下面的判据会是空的')
      const treeBefore = treeFingerprint(root)
      for (const flag of ['--help', '-h']) {
        const r = runScriptRaw([flag], { cwd: root })
        assert.equal(r.status, 0, `${flag} 应 exit 0:${r.stdout}\n${r.stderr}`)
        assert.match(stripAnsi(r.stdout), /用法/, `${flag} 没打印用法`)
        // 票面点名的那一面
        const scoped = gitIn(root, ['status', '--porcelain', '--', 'packages/i18n']).stdout
        assert.equal(scoped, '', `${flag} 之后 packages/i18n 被弄脏:\n${scoped}`)
        // 顺带把票面没限制到的面也钉住:凭据目录、输入载荷都不许动
        const whole = gitIn(root, ['status', '--porcelain']).stdout
        assert.equal(whole, '', `${flag} 之后整仓出现改动:\n${whole}`)
      }
      assert.equal(treeFingerprint(root), treeBefore, '--help 写了字节(含 .ihui-agent 下的凭据/输入)')
    } finally {
      rmScratch(root, { bestEffort: true })
    }
  })

  test('本轮没跑过 --check 就想写盘 → exit 2、点名「未对账」、盘上零变化、不伪造凭据', () => {
    const root = createTempProject('web')
    try {
      writeFullFixture(root, {
        base: { greet: '你好' },
        langs: { en: {}, ja: {}, ko: {}, 'zh-TW': {} },
        translations: FULL,
      })
      const before = dirFingerprint(root, 'web')
      const r = runScriptRaw([], { cwd: root })
      const err = stripAnsi(r.stderr)
      assert.equal(r.status, 2, `应拒绝写入并 exit 2:${r.stdout}\n${err}`)
      assert.match(err, /写盘准入未通过/)
      assert.match(err, /未对账/)
      assert.match(err, /一个字节都没写/)
      assert.doesNotMatch(err, /陈旧载荷/, '载荷是新鲜的,不该把它算进拒绝理由(误伤就是恒红门)')
      assert.equal(dirFingerprint(root, 'web'), before, '未对账的写盘被放过了')
      assert.equal(
        fs.existsSync(path.join(root, '.ihui-agent', 'tmp', 'i18n-apply')),
        false,
        '拒绝路径不许顺手生成对账凭据(那会把下一轮变成"已对账")',
      )
      // 变异对照:补上 --check 这一步,同一份载荷必须真能写进去。
      // 夹具此刻 parity 是坏的(4 语言都缺 greet)⇒ --check 必须 exit 1,
      // 而凭据**照记**(票面要的是"本轮先看过账",不是"账已绿";增量流水线应用前 parity 天然坏)。
      const c = runScriptRaw(['--check'], { cwd: root })
      assert.equal(c.status, 1, `parity 坏的 --check 竟报绿:${c.stdout}`)
      const w = runScriptRaw([], { cwd: root })
      assert.equal(w.status, 0, `fail 也记的凭据没被认(把增量翻译堵死了):${w.stderr}`)
      assert.notEqual(dirFingerprint(root, 'web'), before, '凭据没起作用:该写的没写')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('陈旧载荷 translatedAt 早于盘上 mtime → exit 2 点名「陈旧载荷」;放行必须带原因', () => {
    const root = createTempProject('web')
    try {
      // 第一步:新鲜载荷正常应用一次 ⇒ 语言包 mtime 推到"现在"
      writeFullFixture(root, {
        base: { greet: '你好' },
        langs: { en: {}, ja: {}, ko: {}, 'zh-TW': {} },
        translations: FULL,
      })
      const first = runScript([], { cwd: root })
      assert.equal(first.status, 0, `第一步应用失败:${first.stderr}`)

      // 第二步:换成一份 2026-01-01 的旧载荷(内容不同 ⇒ 真会改盘);语言包保持第一步的成果
      writeTranslations(root, {
        translatedAt: '2026-01-01T00:00:00Z',
        translatedBy: 'AI agent (test)',
        translations: OTHER,
      })
      const before = dirFingerprint(root, 'web')
      const ck = runScriptRaw(['--check'], { cwd: root })
      assert.equal(ck.status, 0, `--check 不该因陈旧而失败(票面要"跑过账",不是"账已绿")`)
      const r = runScriptRaw([], { cwd: root })
      const err = stripAnsi(r.stderr)
      assert.equal(r.status, 2, `陈旧载荷被放过:${r.stdout}\n${err}`)
      assert.match(err, /陈旧载荷/)
      assert.match(err, /一个字节都没写/)
      assert.equal(dirFingerprint(root, 'web'), before, '陈旧载荷真被烤进盘了')

      // 放行必须**有原因**:裸 --allow-stale 不算放行
      const bare = runScriptRaw(['--allow-stale'], { cwd: root })
      assert.equal(bare.status, 2, `裸 --allow-stale 竟放行:${bare.stderr}`)
      assert.match(stripAnsi(bare.stderr), /--allow-stale=<原因>/)
      assert.match(stripAnsi(bare.stderr), /缺原因/)
      assert.equal(dirFingerprint(root, 'web'), before, '无原因放行也被写盘了')

      // 带原因 ⇒ 放行,并且必须把"凭原因放行"这件事报出来(不许静默)
      const ok = runScriptRaw(['--allow-stale=人工确认重放上一批正确载荷'], { cwd: root })
      assert.equal(ok.status, 0, `带原因仍被拒:${ok.stderr}`)
      assert.match(stripAnsi(ok.stdout), /已凭显式原因放行/)
      assert.notEqual(dirFingerprint(root, 'web'), before, '放行了却没写盘')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('两道拒绝同时成立时都要点名(陈旧 ∧ 未对账不许只报一条)', () => {
    const root = createTempProject('web')
    try {
      writeFullFixture(root, {
        base: { greet: '你好' },
        langs: { en: { greet: 'Hello' }, ja: { greet: 'こんにちは' }, ko: { greet: '안녕' }, 'zh-TW': { greet: '你好' } },
        translations: OTHER,
        translatedAt: '2026-01-01T00:00:00Z',
      })
      const before = dirFingerprint(root, 'web')
      const r = runScriptRaw([], { cwd: root })
      const err = stripAnsi(r.stderr)
      assert.equal(r.status, 2, `未拒绝:${r.stdout}\n${err}`)
      assert.match(err, /陈旧载荷/)
      assert.match(err, /未对账/)
      assert.equal(dirFingerprint(root, 'web'), before)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('凭据指纹:换载荷 / 换端即失效,不认"上一轮的对账"(直接吃源脚本判据)', () => {
    const A = 'a'.repeat(64)
    const B = 'b'.repeat(64)
    assert.equal(SUT.checkStampVerdict({ stamp: null, inputSha256: A, target: 'web' }).state, 'absent')
    assert.equal(SUT.checkStampVerdict({ stamp: { inputSha256: A, target: 'web' }, inputSha256: A, target: 'web' }).refused, false)
    const swapped = SUT.checkStampVerdict({ stamp: { inputSha256: A, target: 'web' }, inputSha256: B, target: 'web' })
    assert.equal(swapped.refused, true)
    assert.match(swapped.reason, /另一份载荷/)
    const otherEnd = SUT.checkStampVerdict({ stamp: { inputSha256: A, target: 'extension' }, inputSha256: A, target: 'web' })
    assert.equal(otherEnd.refused, true)
    assert.match(otherEnd.reason, /本次目标端是 web/)
    // 文件名吃 sha + 端名:换任何一个,凭据就不是同一个文件
    assert.notEqual(
      SUT.checkStampName({ inputSha256: A, target: 'web' }),
      SUT.checkStampName({ inputSha256: B, target: 'web' }),
    )
    assert.notEqual(
      SUT.checkStampName({ inputSha256: A, target: 'web' }),
      SUT.checkStampName({ inputSha256: A, target: 'cli' }),
    )
    // 端名里的分隔符不许造出路径逃逸:产物必须是**单段**文件名(遍历需要分隔符,`..` 留在段内不构成逃逸)
    const escaped = SUT.checkStampName({ inputSha256: A, target: '../../evil' })
    assert.doesNotMatch(escaped, /[\\/]/)
    assert.equal(path.basename(escaped), escaped)
    assert.equal(escaped.startsWith('.'), false, '凭据文件名不得以点开头(会被当隐藏项/相对段)')
    assert.match(escaped, /^check-stamp-\.\._\.\._evil-a{16}\.json$/)
  })

  test('陈旧守卫的三态不得混(§0.3:取不到输入 ⇒ 如实报名,不冒充判过)', () => {
    const now = Date.now()
    const mk = (n) => now - n * 1000
    assert.equal(SUT.stalePayloadVerdict({ translatedAt: undefined, targetMtimesMs: [mk(0)] }).state, 'undetermined')
    assert.equal(SUT.stalePayloadVerdict({ translatedAt: '不是时刻', targetMtimesMs: [mk(0)] }).state, 'undetermined')
    assert.equal(SUT.stalePayloadVerdict({ translatedAt: new Date(now).toISOString(), targetMtimesMs: [] }).state, 'undetermined')
    for (const v of [
      SUT.stalePayloadVerdict({ translatedAt: undefined, targetMtimesMs: [mk(0)] }),
      SUT.stalePayloadVerdict({ translatedAt: '不是时刻', targetMtimesMs: [mk(0)] }),
      SUT.stalePayloadVerdict({ translatedAt: new Date(now).toISOString(), targetMtimesMs: [] }),
    ]) {
      assert.equal(v.refused, false, '未判定不许当成拒绝(那是恒红门的成因)')
      assert.match(v.note, /不冒充|无 mtime/, '未判定必须如实报名')
    }
    assert.equal(
      SUT.stalePayloadVerdict({ translatedAt: new Date(now + 5000).toISOString(), targetMtimesMs: [mk(0)] }).state,
      'fresh',
    )
    const stale = SUT.stalePayloadVerdict({ translatedAt: new Date(mk(600)).toISOString(), targetMtimesMs: [mk(0)] })
    assert.equal(stale.state, 'stale')
    assert.equal(stale.refused, true)
    const allowed = SUT.stalePayloadVerdict({
      translatedAt: new Date(mk(600)).toISOString(),
      targetMtimesMs: [mk(0)],
      allowStaleReason: '重放上一批',
    })
    assert.equal(allowed.refused, false)
    assert.equal(allowed.state, 'stale-allowed')
    assert.match(allowed.note, /重放上一批/)
    // NaN mtime(文件不存在)不得混进"最新 mtime"
    assert.equal(
      SUT.stalePayloadVerdict({ translatedAt: new Date(mk(600)).toISOString(), targetMtimesMs: [Number.NaN] }).state,
      'undetermined',
    )
  })
})
