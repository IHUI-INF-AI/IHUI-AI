// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file i18n-diff.mjs 回归测试基线
 * @description 本测试覆盖 scripts/i18n-diff.mjs 的核心规则(§19 AI 翻译流水线第①步):
 *   1. 3 类检测维度:
 *      - missing      - base-only key(zh-CN 有但目标语言缺失)
 *      - untranslated - 值 === zh-CN 原值且含汉字(ko/en 未翻译;zh-TW/ja 豁免)
 *      - asciiFallback - 值 === en 值且纯 ASCII(ko/ja/zh-TW 用 en 兜底,收集到 reviewAscii 不进 pending)
 *   2. 退出码:0 = 无 pending;1 = 有 pending
 *   3. CLI 选项:--staged(仅 zh-CN staged 时触发) / --quiet(只输出 JSON) / --output(自定义路径) / --target(切换目录)
 *   4. 豁免规则:zh-TW 简繁同形、ja 日文汉字词、asciiFallback 短词(<3)/纯大写词/glossary 白名单
 *   5. 输出:.ihui-agent/tmp/i18n-pending.json(机器可读,AI agent 消费)
 *
 * 测试策略:spawnSync 子进程运行原脚本,cwd=临时目录,fixture 完全隔离不污染项目。
 * 路径推导用 import.meta.url(AGENTS.md §15)。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
// 夹具唯一落点(AGENTS §26 / §15b):新增用例一律落 DevEnv 临时根,不再往 os.tmpdir() 写。
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = path.join(__dirname, '..', 'i18n-diff.mjs')
const BASE_LANG = 'zh-CN'
const TARGET_LANGS = ['en', 'ja', 'ko', 'zh-TW']

// ─── 辅助:strip ANSI 颜色码(脚本 stdout 含 \x1b[32m 等) ───
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

// ─── 辅助:创建临时项目根目录(含 packages/i18n/messages/<target>/ + .ihui-agent/tmp/) ───
function createTempProject(target = 'web') {
  const root = mkScratch("ihui-i18n-diff-")
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

// 写入完整 fixture(zh-CN 基准 + 4 目标语言)
function writeAllLangs(root, target, base, langs) {
  writeMessages(root, target, BASE_LANG, base)
  for (const lang of TARGET_LANGS) {
    writeMessages(root, target, lang, langs[lang] !== undefined ? langs[lang] : {})
  }
}

function readPendingJson(root) {
  return JSON.parse(
    fs.readFileSync(path.join(root, '.ihui-agent', 'tmp', 'i18n-pending.json'), 'utf8'),
  )
}

function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    // §5b 弹窗治理 + 守门 52/80:派生控制台程序必须 windowsHide,且不得无界挂起
    windowsHide: true,
    timeout: 60_000,
  })
}

// 初始化 git 仓库(--staged 测试需要)
function initGitRepo(root) {
  const opts = { cwd: root, stdio: 'pipe', windowsHide: true, timeout: 60_000 }
  execSync('git init -b main', opts)
  execSync('git config user.email test@test.com', opts)
  execSync('git config user.name test', opts)
  execSync('git config commit.gpgsign false', opts)
}

// 完整翻译的 fixture(5 语言 parity + 翻译完整 → exit 0)
const FULL_TRANSLATED = {
  base: { common: { save: '保存', cancel: '取消' } },
  langs: {
    en: { common: { save: 'Save', cancel: 'Cancel' } },
    ja: { common: { save: '保存', cancel: 'キャンセル' } },
    ko: { common: { save: '저장', cancel: '취소' } },
    'zh-TW': { common: { save: '儲存', cancel: '取消' } },
  },
}

describe('CLI 基础行为 — 输入校验 + 退出码', () => {
  test('messages 目录不存在 → exit 0 + stdout 含"不存在或不完整"', () => {
    const root = mkScratch("ihui-i18n-diff-")
    try {
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `messages 不存在应 exit 0,实际 ${r.status}`)
      assert.match(stripAnsi(r.stdout), /不存在或不完整|跳过/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('zh-CN.json 损坏(JSON 解析失败)→ 该文件被跳过 → exit 0', () => {
    const root = createTempProject()
    try {
      const dir = path.join(root, 'packages', 'i18n', 'messages', 'web')
      fs.writeFileSync(path.join(dir, 'zh-CN.json'), '{ broken json }')
      for (const lang of TARGET_LANGS) {
        writeMessages(root, 'web', lang, { save: 'x' })
      }
      const r = runScript([], { cwd: root })
      // zh-CN 解析失败 → messages[BASE_LANG] 不存在 → exit 0 "跳过"
      assert.equal(r.status, 0, `zh-CN 损坏应 exit 0,实际 ${r.status}`)
      assert.match(stripAnsi(r.stdout), /不存在或不完整|跳过/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('5 语言 parity + 翻译完整 → exit 0 + "无 pending"', () => {
    const root = createTempProject()
    try {
      writeAllLangs(root, 'web', FULL_TRANSLATED.base, FULL_TRANSLATED.langs)
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `翻译完整应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
      assert.match(stripAnsi(r.stdout), /无 pending/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('检测维度 1: missing — zh-CN 有但目标语言缺失', () => {
  test('ko 缺 common.save(zh-CN 有)+ 嵌套 dot-path 展开验证 → exit 1 + pending.ko 含 missing', () => {
    const root = createTempProject()
    try {
      // 嵌套结构:验证 collectLeafEntries 按 dot-path 展开
      const base = {
        common: { save: '保存' },
        page: { action: { cancel: '取消' } },
      }
      const langs = {
        en: { common: { save: 'Save' }, page: { action: { cancel: 'Cancel' } } },
        ja: { common: { save: '保存' }, page: { action: { cancel: 'キャンセル' } } },
        ko: { common: { save: '저장' } }, // 缺 page.action.cancel(嵌套)
        'zh-TW': { common: { save: '儲存' }, page: { action: { cancel: '取消' } } },
      }
      writeAllLangs(root, 'web', base, langs)
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 1, `missing key 应 exit 1,实际 ${r.status}`)
      const pending = readPendingJson(root)
      assert.ok(pending.pending.ko, 'pending.ko 应存在')
      // 验证嵌套 key 按 dot-path 展开
      const item = pending.pending.ko.find((x) => x.key === 'page.action.cancel')
      assert.ok(item, '应按 dot-path 展开 page.action.cancel')
      assert.equal(item.type, 'missing')
      assert.equal(item.sourceValue, '取消')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('检测维度 2: untranslated — 值 === zh-CN 原值(含汉字)', () => {
  test('ko value === zh-CN value 且含汉字 → untranslated', () => {
    const root = createTempProject()
    try {
      const langs = JSON.parse(JSON.stringify(FULL_TRANSLATED.langs))
      langs.ko.common.save = '保存' // 未翻译,等于 zh-CN 原值
      writeAllLangs(root, 'web', FULL_TRANSLATED.base, langs)
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 1, `ko 未翻译应 exit 1,实际 ${r.status}`)
      const pending = readPendingJson(root)
      const item = pending.pending.ko.find((x) => x.key === 'common.save')
      assert.ok(item, 'ko common.save 应被检测为 untranslated')
      assert.equal(item.type, 'untranslated')
      assert.equal(item.sourceValue, '保存')
      assert.equal(item.currentValue, '保存')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('en value === zh-CN value 且含汉字 → untranslated', () => {
    const root = createTempProject()
    try {
      const langs = JSON.parse(JSON.stringify(FULL_TRANSLATED.langs))
      langs.en.common.cancel = '取消' // 未翻译,等于 zh-CN 原值
      writeAllLangs(root, 'web', FULL_TRANSLATED.base, langs)
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 1)
      const pending = readPendingJson(root)
      const item = pending.pending.en.find((x) => x.key === 'common.cancel')
      assert.equal(item.type, 'untranslated')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('zh-TW value === zh-CN value 不报(简繁同形豁免)', () => {
    const root = createTempProject()
    try {
      const langs = JSON.parse(JSON.stringify(FULL_TRANSLATED.langs))
      // "取消" 简繁同形,zh-TW 故意等于 zh-CN → 不报 untranslated
      langs['zh-TW'].common.cancel = '取消'
      writeAllLangs(root, 'web', FULL_TRANSLATED.base, langs)
      const r = runScript([], { cwd: root })
      // zh-TW 豁免 untranslated 检测,无 pending → exit 0
      assert.equal(r.status, 0, `zh-TW 简繁同形应豁免,exit 0,实际 ${r.status}`)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('ja value === zh-CN value 不报(日文汉字词豁免)', () => {
    const root = createTempProject()
    try {
      const base = { common: { save: '保存', notify: '通知' } }
      const langs = {
        en: { common: { save: 'Save', notify: 'Notify' } },
        ja: { common: { save: '保存', notify: '通知' } }, // 日文汉字词合法(保存/通知)
        ko: { common: { save: '저장', notify: '알림' } },
        'zh-TW': { common: { save: '儲存', notify: '通知' } },
      }
      writeAllLangs(root, 'web', base, langs)
      const r = runScript([], { cwd: root })
      // ja 豁免 untranslated 检测 → exit 0
      assert.equal(r.status, 0, `ja 日文汉字词应豁免,exit 0,实际 ${r.status}`)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('检测维度 3: asciiFallback — 值 === en 值且纯 ASCII(收集到 reviewAscii)', () => {
  test('ko value === en value 且纯 ASCII → reviewAscii 收集,不进 pending → exit 0', () => {
    const root = createTempProject()
    try {
      const base = { common: { save: '保存', dashboard: '仪表盘' } }
      const langs = {
        en: { common: { save: 'Save', dashboard: 'Dashboard' } },
        ja: { common: { save: '保存', dashboard: 'ダッシュボード' } },
        ko: { common: { save: '저장', dashboard: 'Dashboard' } }, // asciiFallback
        'zh-TW': { common: { save: '儲存', dashboard: '儀表板' } },
      }
      writeAllLangs(root, 'web', base, langs)
      const r = runScript([], { cwd: root })
      // asciiFallback 进 reviewAscii 不进 pending → exit 0
      assert.equal(r.status, 0, `asciiFallback 不进 pending 应 exit 0,实际 ${r.status}`)
      const pending = readPendingJson(root)
      assert.ok(!pending.pending.ko, 'ko 不应有 pending(asciiFallback 不算 pending)')
      const reviewItem = pending.reviewAscii.ko.find((x) => x.key === 'common.dashboard')
      assert.ok(reviewItem, 'reviewAscii.ko 应含 common.dashboard')
      assert.equal(reviewItem.type, 'asciiFallback')
      assert.equal(reviewItem.enValue, 'Dashboard')
      assert.equal(pending.stats.reviewCount, 1, 'reviewCount 应为 1')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('asciiFallback 短词豁免: enValue.length < 3 不报', () => {
    const root = createTempProject()
    try {
      const base = { common: { ai: '人工智能' } }
      const langs = {
        en: { common: { ai: 'AI' } }, // length=2 < 3
        ja: { common: { ai: 'AI' } },
        ko: { common: { ai: 'AI' } },
        'zh-TW': { common: { ai: 'AI' } },
      }
      writeAllLangs(root, 'web', base, langs)
      const r = runScript([], { cwd: root })
      // "AI" 长度 2 < 3 → 不报 asciiFallback → exit 0 + reviewCount=0
      assert.equal(r.status, 0)
      const pending = readPendingJson(root)
      assert.equal(pending.stats.reviewCount, 0, '短词应豁免,reviewCount=0')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('asciiFallback 纯大写词豁免: "API"/"HTML" 不报(技术术语)', () => {
    const root = createTempProject()
    try {
      const base = { common: { save: '保存', api: 'API 接口' } }
      const langs = {
        en: { common: { save: 'Save', api: 'API' } },
        ja: { common: { save: '保存', api: 'API' } }, // 纯大写 → 豁免
        ko: { common: { save: '저장', api: 'API' } },
        'zh-TW': { common: { save: '儲存', api: 'API' } },
      }
      writeAllLangs(root, 'web', base, langs)
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      const pending = readPendingJson(root)
      // "API" 纯大写 → 豁免,不进 reviewAscii
      assert.equal(pending.stats.reviewCount, 0, '纯大写词应豁免')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('asciiFallback glossary 白名单豁免: enValue 在 brand-glossary 中不报', () => {
    const root = createTempProject()
    try {
      // 创建 brand-glossary.json(SimSun 是 fonts 的 canonical value)
      const glossaryDir = path.join(root, 'scripts')
      fs.mkdirSync(glossaryDir, { recursive: true })
      fs.writeFileSync(
        path.join(glossaryDir, 'brand-glossary.json'),
        JSON.stringify({
          brands: { 智谱清言: 'Zhipu AI' },
          fonts: { 宋体: 'SimSun' },
          terms: { 物联网: 'IoT' },
        }),
      )
      const base = { common: { save: '保存', font: '宋体' } }
      const langs = {
        en: { common: { save: 'Save', font: 'SimSun' } },
        ja: { common: { save: '保存', font: 'SimSun' } }, // SimSun 在 glossary → 豁免
        ko: { common: { save: '저장', font: 'SimSun' } },
        'zh-TW': { common: { save: '儲存', font: 'SimSun' } },
      }
      writeAllLangs(root, 'web', base, langs)
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      const pending = readPendingJson(root)
      // "SimSun" 在 glossary.fonts values 中 → 豁免
      assert.equal(pending.stats.reviewCount, 0, 'glossary 白名单应豁免')
      // 输出 JSON 应含 glossary 字段
      assert.ok(pending.glossary, '应有 glossary 字段')
      assert.deepEqual(pending.glossary.fonts, { 宋体: 'SimSun' })
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('CLI 选项: --quiet / --output / --target / --staged', () => {
  test('--quiet + --output: 不打印人类可读报告 + 自定义输出路径', () => {
    const root = createTempProject()
    try {
      writeAllLangs(root, 'web', FULL_TRANSLATED.base, FULL_TRANSLATED.langs)
      const customPath = path.join(root, 'custom-pending.json')
      const r = runScript(['--quiet', '--output', customPath], { cwd: root })
      assert.equal(r.status, 0)
      // --quiet:不打印 "无 pending" 报告
      assert.ok(!stripAnsi(r.stdout).includes('无 pending'), '--quiet 不应打印人类可读报告')
      // --output:自定义路径应存在
      assert.ok(fs.existsSync(customPath), '自定义输出路径应存在')
      const output = JSON.parse(fs.readFileSync(customPath, 'utf8'))
      assert.equal(output.baseLang, 'zh-CN')
      // 默认路径不应存在(用了 --output)
      assert.ok(
        !fs.existsSync(path.join(root, '.ihui-agent', 'tmp', 'i18n-pending.json')),
        '默认路径不应被写入',
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('--target=extension: 切换到 extension messages 目录', () => {
    const root = createTempProject('extension')
    try {
      writeAllLangs(root, 'extension', FULL_TRANSLATED.base, FULL_TRANSLATED.langs)
      const r = runScript(['--target=extension'], { cwd: root })
      assert.equal(r.status, 0, `extension target 应 exit 0,实际 ${r.status}`)
      const pending = readPendingJson(root)
      assert.equal(pending.baseLang, 'zh-CN')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('--staged: 暂存区未改动 zh-CN → 跳过 exit 0', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      writeAllLangs(root, 'web', FULL_TRANSLATED.base, FULL_TRANSLATED.langs)
      // 只 stage en.json(不 stage zh-CN)
      execSync('git add packages/i18n/messages/web/en.json', { cwd: root, stdio: 'pipe' })
      const r = runScript(['--staged'], { cwd: root })
      // zh-CN 未 staged → 跳过
      assert.equal(r.status, 0, `zh-CN 未 staged 应跳过 exit 0,实际 ${r.status}`)
      assert.match(stripAnsi(r.stdout), /跳过/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('--staged: zh-CN staged → 正常检测(有 missing → exit 1)', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      const langs = JSON.parse(JSON.stringify(FULL_TRANSLATED.langs))
      delete langs.ko.common.save // 制造 missing
      writeAllLangs(root, 'web', FULL_TRANSLATED.base, langs)
      // stage zh-CN.json
      execSync('git add packages/i18n/messages/web/zh-CN.json', { cwd: root, stdio: 'pipe' })
      const r = runScript(['--staged'], { cwd: root })
      // zh-CN staged → 正常检测 → 有 missing → exit 1
      assert.equal(r.status, 1, `zh-CN staged + 有 pending 应 exit 1,实际 ${r.status}`)
      const pending = readPendingJson(root)
      assert.ok(pending.pending.ko, '应有 ko pending')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

// ─── 2026-09-25:--target 端注册 + "静默回落到 web"根治 ──────────────────────
// 阳性对照设计(没有它这些用例等于没测):夹具同时铺两端 ——
//   被测端 = 翻译完全干净(exit 0),web = 故意让 ko 缺一个键(exit 1)。
//   旧实现 `TARGET_CONFIG[TARGET] || TARGET_CONFIG.web` 一旦回落,结果必然 exit 1,
//   于是"exit 0"才真的证明读到的是被测那一端;只测"exit 0 / 目录存在"无法把
//   "读对了端"和"读的是恰好干净的 web"区分开。
describe('--target 端注册(mobile-rn / cli / api)', () => {
  const NEW_ENDS = ['mobile-rn', 'cli', 'api']

  /** 造一个"被测端干净 + web 脏"的双端项目 */
  function createTwoEndProject(cleanTarget) {
    const root = createTempProject(cleanTarget)
    writeAllLangs(root, cleanTarget, FULL_TRANSLATED.base, FULL_TRANSLATED.langs)
    const dirtyWebLangs = JSON.parse(JSON.stringify(FULL_TRANSLATED.langs))
    delete dirtyWebLangs.ko.common.save // web 故意留 1 处 missing
    fs.mkdirSync(path.join(root, 'packages', 'i18n', 'messages', 'web'), { recursive: true })
    writeAllLangs(root, 'web', FULL_TRANSLATED.base, dirtyWebLangs)
    return root
  }

  for (const end of NEW_ENDS) {
    test(`--target=${end} 读的是 packages/i18n/messages/${end}(错读 web 必红)`, () => {
      const root = createTwoEndProject(end)
      try {
        const r = runScript([`--target=${end}`], { cwd: root })
        assert.equal(
          r.status,
          0,
          `--target=${end} 应 exit 0(该端夹具干净);若为 1 则说明回落到脏 web\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
        )
        // 报告必须自证解析到的目录(不只是退出码)
        assert.ok(
          stripAnsi(r.stdout).includes(`packages/i18n/messages/${end}`),
          `stdout 应点名 ${end} 的目录,实际:\n${stripAnsi(r.stdout)}`,
        )
        assert.ok(!stripAnsi(r.stdout).includes('packages/i18n/messages/web'))
        const pending = readPendingJson(root)
        assert.equal(pending.target, end, '清单应记录 target')
        assert.equal(pending.messagesDir, `packages/i18n/messages/${end}`)
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })
  }

  test('不带 --target 仍默认 web:双端夹具下必须读到脏 web 并 exit 1(默认行为未变)', () => {
    const root = createTwoEndProject('mobile-rn')
    try {
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 1, `默认应仍走 web(ko 缺键 → pending)\nstdout: ${r.stdout}`)
      assert.ok(stripAnsi(r.stdout).includes('packages/i18n/messages/web'))
      const pending = readPendingJson(root)
      assert.equal(pending.target, 'web')
      assert.ok(pending.pending.ko, 'web 端 ko 缺键应被检出')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('--target 未知值一律判死(不再静默按 web 处理)', () => {
  /** 某端语言包目录的字节指纹(路径+内容),用于证明"一个字节都没写" */
  function dirFingerprint(root, target) {
    const dir = path.join(root, 'packages', 'i18n', 'messages', target)
    if (!fs.existsSync(dir)) return '<missing>'
    return fs
      .readdirSync(dir)
      .sort()
      .map((f) => `${f}::${fs.readFileSync(path.join(dir, f), 'utf8')}`)
      .join('||')
  }

  const BAD_TARGETS = [
    ['mobile_rn', '下划线代替连字符'],
    ['Miniapp-Taro', '大小写不符'],
    ['nonsense', '根本不存在的名'],
    ['', '空值(--target=)'],
  ]

  for (const [bad, why] of BAD_TARGETS) {
    test(`--target=${bad || '(空)'} (${why}) → exit 2 + 点名错值 + 列可用端 + 零写入`, () => {
      const root = createTempProject('web')
      try {
        writeAllLangs(root, 'web', FULL_TRANSLATED.base, FULL_TRANSLATED.langs)
        const webBefore = dirFingerprint(root, 'web')
        const r = runScript([`--target=${bad}`], { cwd: root })
        const out = stripAnsi(r.stdout) + stripAnsi(r.stderr)

        assert.equal(r.status, 2, `应 exit 2(用法错误),实际 ${r.status}\n${out}`)
        assert.match(out, /不是受支持的端/)
        assert.ok(out.includes(JSON.stringify(bad)), `错误信息须原样点名 "${bad}"(空值显示为 ""):\n${out}`)
        // 可用端清单:漏列任何一个都是把门又关小一格
        for (const end of ['web', 'extension', 'miniapp-taro', 'shared', 'mobile-rn', 'cli', 'api']) {
          assert.match(out, new RegExp(`\\b${end.replace(/[-]/g, '\\-')}\\b`), `清单应含 ${end}`)
        }
        // 零副作用:既不写清单,也不碰 web 语言包
        assert.ok(
          !fs.existsSync(path.join(root, '.ihui-agent', 'tmp', 'i18n-pending.json')),
          '判死时不应产出 pending 清单',
        )
        assert.equal(dirFingerprint(root, 'web'), webBefore, 'web 语言包必须逐字节未变')
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })
  }

  test('已注册但目录不存在的端 → exit 2(不把"没有目录"当成"没有差异")', () => {
    const root = mkScratch("ihui-i18n-diff-")
    fs.mkdirSync(path.join(root, '.ihui-agent', 'tmp'), { recursive: true })
    try {
      const r = runScript(['--target=mobile-rn'], { cwd: root })
      const out = stripAnsi(r.stdout) + stripAnsi(r.stderr)
      assert.equal(r.status, 2, `实际 ${r.status}\n${out}`)
      assert.match(out, /语言包目录不存在/)
      assert.match(out, /packages\/i18n\/messages\/mobile-rn/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('回归锁:源码里不得再出现"未知 target 回落到 web"的那一表达式', () => {
    // 这一条不跑子进程,直接钉源码 —— 判据表达式一旦被写回 `|| TARGET_CONFIG.web`,
    // 上面所有用例都可能因为"夹具恰好两端都干净"而重新变绿,所以这条是最后的地板。
    // 必须先剥注释:resolveTarget 的头注**逐字引用**了那串旧表达式来解释为什么禁它,
    // 不剥的话这条锁会在**完全合规**的源码上恒红(判据看见了自己产出的形态)。
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8')
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释(JSDoc)
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line)) // 整行注释
      .join('\n')
      .replace(/\/\/[^\n]*/g, '') // 行尾注释
    assert.ok(
      !/TARGET_CONFIG\s*\[\s*TARGET\s*\]\s*\|\|/.test(code),
      'i18n-diff.mjs 不得再有 `TARGET_CONFIG[TARGET] || TARGET_CONFIG.web` 静默回落',
    )
    assert.match(code, /function resolveTarget\(/, '应经 resolveTarget 显式解析')
    assert.match(code, /resolveTarget\(TARGET\s*,\s*ROOT\s*,\s*TARGET_IS_EXPLICIT/, '解析结果必须真被使用')
  })
})

// ─── 带值旗标的吞噬:--output 的值以 - 开头 / 缺失 / 空串 ⇒ 大声拒绝,绝不静默回落默认路径 ───
// 事故形态是 `--output --staged`(guardian-runner 给每道门追加 --staged)⇒ 在 cwd 写出一个名叫
// `--staged` 的文件,而 DEFAULT_OUTPUT 不更新 ⇒ 2f-web / 2f-miniapp-taro / 2f-shared-diff 三道 blocking
// 复验仍去读默认路径,于是流水线报"翻译流水线通过"而 pending 根本没刷新(比写出垃圾文件更糟的一层)。
// 口径照抄枚 380431ffc / 636c28f58 / 8832e73a4,不另发明。
describe('--output 的取值(带值旗标不得吞掉相邻旗标)', () => {
  // 有 pending 的夹具(en 缺 cancel)⇒ 正常路径应 exit 1,便于把"拒绝"与"通过"分得开
  const mkPendingProject = () => {
    const root = mkScratch('ihui-i18n-diff-out-')
    fs.mkdirSync(path.join(root, 'packages', 'i18n', 'messages', 'web'), { recursive: true })
    fs.mkdirSync(path.join(root, '.ihui-agent', 'tmp'), { recursive: true })
    writeAllLangs(
      root,
      'web',
      { common: { save: '保存', cancel: '取消' } },
      {
        en: { common: { save: 'Save' } },
        ja: { common: { save: '保存', cancel: 'キャンセル' } },
        ko: { common: { save: '저장', cancel: '취소' } },
        'zh-TW': { common: { save: '儲存', cancel: '取消' } },
      },
    )
    return root
  }
  const listing = (dir) => fs.readdirSync(dir).sort().join('|')
  const defaultPending = (root) => path.join(root, '.ihui-agent', 'tmp', 'i18n-pending.json')
  // generatedAt 每次运行都不同 ⇒ 内容对账必须剥掉它,否则"一致"永远判不出来
  const semantic = (file) => {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'))
    delete j.generatedAt
    return JSON.stringify(j)
  }

  test('(a) --output --staged:exit 2 + 点名实得 token + 不写任何文件(含默认路径)', () => {
    const root = mkPendingProject()
    try {
      const before = listing(root)
      const r = runScript(['--output', '--staged'], { cwd: root })
      assert.equal(r.status, 2, `无效值必须非零退出,实际 ${r.status}`)
      assert.match(r.stderr, /--output 没有收到有效路径/, '必须点名是哪个旗标')
      assert.match(r.stderr, /"--staged"/, '必须原样带出实得的 token')
      assert.equal(listing(root), before, '拒绝时不得在夹具根写出任何东西')
      assert.ok(!fs.existsSync(path.join(root, '--staged')), '不得产出一个名叫 --staged 的文件')
      assert.ok(!fs.existsSync(defaultPending(root)), '不得静默回落默认路径写别处')
    } finally {
      rmScratch(root)
    }
  })

  test('(a) --output 后面没有参数:exit 2 + 点名"(其后没有任何参数)" + 零写入', () => {
    const root = mkPendingProject()
    try {
      const before = listing(root)
      const r = runScript(['--output'], { cwd: root })
      assert.equal(r.status, 2, `缺值必须非零退出,实际 ${r.status}`)
      assert.match(r.stderr, /\(其后没有任何参数\)/, '两种失败形态不能合成一句"参数错"')
      assert.equal(listing(root), before, '拒绝时不得写任何文件')
      assert.ok(!fs.existsSync(defaultPending(root)), '缺值时同样不得静默按默认路径写')
    } finally {
      rmScratch(root)
    }
  })

  test('(a) --output ""(空串):exit 2 + 点名空 token,空串不是路径', () => {
    const root = mkPendingProject()
    try {
      const r = runScript(['--output', ''], { cwd: root })
      assert.equal(r.status, 2, `空串值必须非零退出,实际 ${r.status}`)
      assert.match(r.stderr, /""/, '必须原样带出实得的空 token')
      assert.ok(!fs.existsSync(defaultPending(root)), '不得静默回落')
    } finally {
      rmScratch(root)
    }
  })

  test('(b) --output <合法路径>:仍按给定路径写、exit 1(有 pending),默认路径不写', () => {
    const root = mkPendingProject()
    try {
      const custom = path.join('.ihui-agent', 'tmp', 'custom-pending.json')
      const r = runScript(['--output', custom], { cwd: root })
      assert.equal(r.status, 1, `有 pending 应 exit 1(与改动前同),实际 ${r.status}`)
      assert.ok(fs.existsSync(path.join(root, custom)), '合法值必须真写到给定路径')
      assert.ok(!fs.existsSync(defaultPending(root)), '给了合法值就不该再写默认路径')
    } finally {
      rmScratch(root)
    }
  })

  test('(b) 不带 --output 的默认档:默认路径照旧写,内容与合法自定义路径那份逐字等值(仅时间戳除外)', () => {
    const a = mkPendingProject()
    const b = mkPendingProject()
    try {
      const ra = runScript([], { cwd: a })
      const rb = runScript(['--output', path.join('.ihui-agent', 'tmp', 'c.json')], { cwd: b })
      assert.equal(ra.status, rb.status, '两条出口的退出码必须一致')
      assert.ok(fs.existsSync(defaultPending(a)), '默认档必须落默认路径')
      assert.equal(
        semantic(defaultPending(a)),
        semantic(path.join(b, '.ihui-agent', 'tmp', 'c.json')),
        '同一份夹具下,默认档与自定义档的 pending 内容必须等值',
      )
    } finally {
      rmScratch(a)
      rmScratch(b)
    }
  })

  test('(c) 源码形状锁:--output 取值必须走 flagValue,裸 argv[indexOf+1] 形态不得回来', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8')
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n')
      .replace(/\/\/[^\n]*/g, '')
    assert.doesNotMatch(
      code,
      /argv\[\s*outputIdx\s*\+\s*1\s*\]/,
      '旧写法 process.argv[outputIdx + 1] 不得回来(它是本判据要防的形态)',
    )
    assert.match(code, /function\s+flagValue\s*\(/, '唯一取值出口必须在位')
    assert.match(code, /flagValue\(\s*process\.argv\.slice\(2\)\s*,\s*'--output'\s*\)/, '站点必须走出口')
    assert.match(code, /outputFlag\.present\s*&&\s*!outputFlag\.valid/, '拒绝分支必须挂在"旗标在场而值无效"上')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
