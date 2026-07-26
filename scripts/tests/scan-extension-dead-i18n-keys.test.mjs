/**
 * @file extension 端 i18n 死 key 扫描器集成测试
 * @description 端到端覆盖 _i18n-scan-helpers.mjs 的 main() 入口,模拟 extension 端
 *   (messagesPath=packages/i18n/messages/extension + scanTargets=apps/extension/{entrypoints,src,lib})
 *   的完整扫描流程:加载 zh-CN.json + 4 语言 → 扫描代码 → 死 key 判定 → 报告写入。
 *
 *   测试用临时 fixture 文件(在 os.tmpdir() 下创建 + chdir 模拟项目根),
 *   不依赖项目真实 i18n 文件,符合 AGENTS.md §23(目录用 tests/)。
 *
 *   ⚠️ 关键实现:_i18n-scan-helpers.mjs 顶层 const ROOT = process.cwd() 在模块加载时锁定,
 *   所以必须在 chdir 到临时目录后再 dynamic import 模块,且所有测试共用同一 ROOT
 *   (即同一临时目录),通过 setupFixture 在每个测试前重置目录内容实现隔离。
 *
 *   覆盖场景:
 *   ① 所有 key 被引用 → exit 0
 *   ② 部分 key 死 + exitOnDead=true → exit 1
 *   ③ t('key', { args }) 带参数调用被识别(2026-07-26 STATIC_T_RE 增强,P2 关键验证)
 *   ④ dryRun=true 不写报告文件
 *   ⑤ dryRun=false + out=<path> 写报告到指定路径,报告内容含死 key 列表
 *   ⑥ zh-CN.json 不存在 → 跳过 exit 0
 *   ⑦ 翻译不完整 → 报告含"翻译不完整"章节
 *   ⑧ 多 scanTargets 目录(entrypoints + src + lib)都被扫描
 *
 *   用 Node.js 内置 test runner,无第三方依赖。
 */
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ORIGINAL_CWD = process.cwd()

// extension 端配置(对应 scripts/scan-extension-dead-i18n-keys.mjs)
// 注:scanTargets 含 3 个目录,验证多目录扫描能力
const END_CONFIG = {
  name: 'extension',
  messagesPath: 'packages/i18n/messages/extension/zh-CN.json',
  scanTargets: ['apps/extension/entrypoints', 'apps/extension/src', 'apps/extension/lib'],
  outputPattern: '.trae-cn/tmp/i18n-extension-dead-keys-{date}.md',
}

let tmpDir
let runScan

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-extension-scan-'))
  process.chdir(tmpDir)
  // 关键:chdir 后再 dynamic import,使模块顶层 const ROOT = process.cwd() 锁定为 tmpDir
  const mod = await import('../_i18n-scan-helpers.mjs')
  runScan = mod.main
})

after(() => {
  process.chdir(ORIGINAL_CWD)
  try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* 清理失败不影响结果 */ }
})

// 每个测试前清空临时目录内容(保留目录本身),保证隔离
beforeEach(() => {
  for (const entry of fs.readdirSync(tmpDir, { withFileTypes: true })) {
    fs.rmSync(path.join(tmpDir, entry.name), { recursive: true, force: true })
  }
})

/**
 * 在临时目录创建 i18n 文件 + 代码文件 fixture
 * @param {Object} opts
 * @param {Object} opts.zhCN
 * @param {Object} [opts.otherLocales]
 * @param {Object<string, string>} [opts.codeFiles] - 多文件路径,键为相对 tmpDir 的路径
 */
function setupFixture({ zhCN, otherLocales = {}, codeFiles = {} }) {
  const localeDir = path.dirname(END_CONFIG.messagesPath)
  fs.mkdirSync(localeDir, { recursive: true })
  fs.writeFileSync(END_CONFIG.messagesPath, JSON.stringify(zhCN, null, 2), 'utf8')
  for (const [lang, content] of Object.entries(otherLocales)) {
    fs.writeFileSync(path.join(localeDir, `${lang}.json`), JSON.stringify(content, null, 2), 'utf8')
  }
  for (const [filePath, content] of Object.entries(codeFiles)) {
    const full = path.join(tmpDir, filePath)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content, 'utf8')
  }
}

// 静默 main() 的 console.log/warn 输出
function silenceConsole() {
  const origLog = console.log
  const origWarn = console.warn
  const origErr = console.error
  console.log = () => {}
  console.warn = () => {}
  console.error = () => {}
  return () => {
    console.log = origLog
    console.warn = origWarn
    console.error = origErr
  }
}

describe('extension 端 i18n 死 key 扫描器集成测试(main() 端到端)', () => {
  test('场景 1:所有 key 被引用 → exitOnDead=true 仍 exit 0', () => {
    setupFixture({
      zhCN: {
        about: { title: '关于', subtitle: '副标题' },
        home: { cta: '点击' },
      },
      codeFiles: {
        'apps/extension/src/page.tsx': [
          "import { useTranslations } from 'next-intl'",
          "const t = useTranslations('about')",
          "t('home.cta')",
        ].join('\n'),
      },
    })
    const restore = silenceConsole()
    try {
      const code = runScan({ ...END_CONFIG, dryRun: true, exitOnDead: true })
      assert.equal(code, 0, '所有 key 被引用(about namespace + home.cta 静态),应 exit 0')
    } finally { restore() }
  })

  test('场景 2:部分 key 死 + exitOnDead=true → exit 1', () => {
    setupFixture({
      zhCN: {
        about: { title: '关于', subtitle: '副标题' },
        unused: { dead: '死 key' },
      },
      codeFiles: {
        'apps/extension/src/page.tsx': [
          "import { useTranslations } from 'next-intl'",
          "const t = useTranslations('about')",
        ].join('\n'),
      },
    })
    const restore = silenceConsole()
    try {
      const code = runScan({ ...END_CONFIG, dryRun: true, exitOnDead: true })
      assert.equal(code, 1, 'unused.dead 未被引用,exitOnDead=true 应 exit 1')
    } finally { restore() }
  })

  test("场景 3:t('key', { args }) 带参数调用被识别(2026-07-26 STATIC_T_RE 增强,P2 关键验证)", () => {
    setupFixture({
      zhCN: { about: { title: '关于', count: '计数' } },
      codeFiles: {
        'apps/extension/src/page.tsx': [
          "import { useTranslations } from 'next-intl'",
          "const t = useTranslations('about')",
          "t('about.title', { name: 'xxx' })",
          "t('about.count', { count: 5 })",
        ].join('\n'),
      },
    })
    const restore = silenceConsole()
    try {
      const code = runScan({ ...END_CONFIG, dryRun: true, exitOnDead: true })
      assert.equal(code, 0, '带参数的 t() 调用应被 STATIC_T_RE 识别,所有 key 引用 → exit 0')
    } finally { restore() }
  })

  test('场景 4:dryRun=true 不写报告文件', () => {
    setupFixture({
      zhCN: { about: { title: '关于' } },
      codeFiles: {
        'apps/extension/src/page.tsx': "t('about.title')",
      },
    })
    const expectedReportPath = path.join(tmpDir, END_CONFIG.outputPattern.replace('{date}', new Date().toISOString().slice(0, 10)))
    const restore = silenceConsole()
    try {
      runScan({ ...END_CONFIG, dryRun: true, exitOnDead: false })
    } finally { restore() }
    assert.equal(fs.existsSync(expectedReportPath), false, 'dryRun=true 不应写报告文件')
  })

  test('场景 5:dryRun=false + out=<path> 写报告到指定路径,内容含死 key 列表', () => {
    setupFixture({
      zhCN: {
        used: { key: '已用' },
        dead: { key: '死 key' },
      },
      otherLocales: {
        en: { used: { key: 'used' }, dead: { key: 'dead' } },
        ja: { used: { key: '使用済み' }, dead: { key: 'デッド' } },
        ko: { used: { key: '사용됨' }, dead: { key: '데드' } },
        'zh-TW': { used: { key: '已用' }, dead: { key: '死 key' } },
      },
      codeFiles: {
        'apps/extension/src/page.tsx': "t('used.key')",
      },
    })
    const customOut = path.join(tmpDir, 'custom-report.md')
    const restore = silenceConsole()
    try {
      const code = runScan({ ...END_CONFIG, dryRun: false, exitOnDead: false, out: customOut })
      assert.equal(code, 0, 'exitOnDead=false 即使有死 key 也 exit 0')
    } finally { restore() }
    assert.equal(fs.existsSync(customOut), true, '报告应写入 out 指定路径')
    const report = fs.readFileSync(customOut, 'utf8')
    assert.match(report, /死 key 列表/, '报告应含"死 key 列表"章节')
    assert.match(report, /dead\.key/, '报告应列出死 key "dead.key"')
    assert.doesNotMatch(report, /- `used\.key`/, 'used.key 被引用,不应以死 key 列表项格式出现')
  })

  test('场景 6:zh-CN.json 不存在 → 跳过 exit 0(端无独立 i18n)', () => {
    const restore = silenceConsole()
    try {
      const code = runScan({ ...END_CONFIG, dryRun: true, exitOnDead: true })
      assert.equal(code, 0, '基准语言文件不存在应跳过 exit 0')
    } finally { restore() }
  })

  test('场景 7:翻译不完整(en 缺 key)→ 报告含"翻译不完整"章节', () => {
    setupFixture({
      zhCN: { about: { title: '关于', subtitle: '副标题' } },
      otherLocales: {
        en: { about: { title: 'About' } }, // 缺 subtitle
        ja: { about: { title: 'について', subtitle: 'サブタイトル' } },
        ko: { about: { title: '정보', subtitle: '부제' } },
        'zh-TW': { about: { title: '關於', subtitle: '副標題' } },
      },
      codeFiles: {
        'apps/extension/src/page.tsx': [
          "import { useTranslations } from 'next-intl'",
          "const t = useTranslations('about')",
        ].join('\n'),
      },
    })
    const customOut = path.join(tmpDir, 'incomplete-report.md')
    const restore = silenceConsole()
    try {
      runScan({ ...END_CONFIG, dryRun: false, exitOnDead: false, out: customOut })
    } finally { restore() }
    const report = fs.readFileSync(customOut, 'utf8')
    assert.match(report, /翻译不完整/, '报告应含"翻译不完整"章节')
    assert.match(report, /about\.subtitle/, '报告应列出 about.subtitle 为翻译不完整')
  })

  test('场景 8:多 scanTargets 目录(entrypoints + src + lib)都被扫描', () => {
    // 在 3 个不同 scanTargets 目录各放一个文件,引用不同 key,验证多目录都被扫描
    setupFixture({
      zhCN: {
        entry: { key: '入口' },
        src: { key: '源码' },
        lib: { key: '库' },
      },
      otherLocales: {
        en: { entry: { key: 'entry' }, src: { key: 'src' }, lib: { key: 'lib' } },
        ja: { entry: { key: 'エントリ' }, src: { key: 'ソース' }, lib: { key: 'ライブラリ' } },
        ko: { entry: { key: '엔트리' }, src: { key: '소스' }, lib: { key: '라이브러리' } },
        'zh-TW': { entry: { key: '入口' }, src: { key: '源碼' }, lib: { key: '庫' } },
      },
      codeFiles: {
        'apps/extension/entrypoints/background.ts': "t('entry.key')",
        'apps/extension/src/popup.tsx': "t('src.key')",
        'apps/extension/lib/util.ts': "t('lib.key')",
      },
    })
    const restore = silenceConsole()
    try {
      const code = runScan({ ...END_CONFIG, dryRun: true, exitOnDead: true })
      assert.equal(code, 0, '3 个目录的 key 都被引用,应 exit 0(验证多 scanTargets 都被扫描)')
    } finally { restore() }
  })
})
