/**
 * @file desktop 端 i18n 死 key 扫描器集成测试
 * @description desktop 端是 Tauri/Rust 包装,无 JS i18n 代码,messages 目录未建立。
 *   本测试覆盖 _i18n-scan-helpers.mjs 的 main() 入口在 desktop 配置下的行为:
 *   - 默认配置自动跳过(messagesPath 不存在 + scanTargets 空)→ exit 0
 *   - 各种 skip 组合(messagesPath 存在但 scanTargets 空 / messagesPath 不存在但 scanTargets 非空)
 *   - 假设性场景:模拟 desktop 端将来添加 i18n 时的扫描行为(所有 key 死/被引用/翻译不完整)
 *
 *   以及真实脚本 scripts/scan-desktop-dead-i18n-keys.mjs 的子进程行为:
 *   - 默认运行 → exit 0(messagesPath 不存在 → skip)
 *   - --exit 1 参数解析(skip 优先于 exitOnDead)
 *
 *   测试用临时 fixture(在 os.tmpdir() 下创建 + chdir 模拟项目根),
 *   不依赖项目真实 i18n 文件,符合 AGENTS.md §23(目录用 tests/)。
 *
 *   ⚠️ 关键实现:_i18n-scan-helpers.mjs 顶层 const ROOT = process.cwd() 在模块加载时锁定,
 *   所以必须在 chdir 到临时目录后再 dynamic import 模块,且所有测试共用同一 ROOT
 *   (即同一临时目录),通过 setupFixture 在每个测试前重置目录内容实现隔离。
 *
 *   用 Node.js 内置 test runner,无第三方依赖。
 *   路径推导用 import.meta.url(AGENTS.md §11 任务约束)。
 */
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ORIGINAL_CWD = process.cwd()

// 路径推导用 import.meta.url(不写硬编码绝对路径)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

// desktop 端配置(对应 scripts/scan-desktop-dead-i18n-keys.mjs)
// 注:scanTargets 为空数组,desktop 是 Rust 包装,无 JS 代码可扫描
const END_CONFIG = {
  name: 'desktop',
  messagesPath: 'packages/i18n/messages/desktop/zh-CN.json',
  scanTargets: [],
  outputPattern: '.trae-cn/tmp/i18n-desktop-dead-keys-{date}.md',
}

// 假设性场景:模拟 desktop 端将来添加 i18n 时的 scanTargets
// (默认 scanTargets=[],这里验证"如果将来 desktop 端添加 JS 代码可扫描"时的行为)
const HYPOTHETICAL_SCAN_TARGETS = ['apps/desktop/src']

let tmpDir
let runScan

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-desktop-scan-'))
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

// 静默 main() 的 console.log/warn/error 输出
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

describe('desktop 端 i18n 死 key 扫描器集成测试', () => {
  describe('默认配置(端无独立 i18n,自动跳过)', () => {
    test('场景 1:默认配置 messagesPath 不存在 + scanTargets 空 → exit 0', () => {
      const restore = silenceConsole()
      try {
        const code = runScan({ ...END_CONFIG, dryRun: false })
        assert.equal(code, 0, '默认配置应自动跳过 exit 0(端无独立 i18n)')
      } finally { restore() }
    })

    test('场景 2:dryRun=true + 默认配置 → exit 0', () => {
      const restore = silenceConsole()
      try {
        const code = runScan({ ...END_CONFIG, dryRun: true })
        assert.equal(code, 0, 'dryRun=true + 默认 skip 应 exit 0')
      } finally { restore() }
    })

    test('场景 3:exitOnDead=true + 默认配置 → exit 0(skip 优先于死 key 检查)', () => {
      const restore = silenceConsole()
      try {
        const code = runScan({ ...END_CONFIG, dryRun: true, exitOnDead: true })
        assert.equal(code, 0, '默认 skip 优先,exitOnDead=true 不应触发 exit 1')
      } finally { restore() }
    })

    test('场景 4:out=<path> + 默认配置 → exit 0,不创建 out 文件', () => {
      const customOut = path.join(tmpDir, 'should-not-exist.md')
      const restore = silenceConsole()
      try {
        const code = runScan({ ...END_CONFIG, dryRun: false, out: customOut })
        assert.equal(code, 0, '默认 skip 应 exit 0')
      } finally { restore() }
      assert.equal(fs.existsSync(customOut), false, '默认 skip 不应写 out 文件')
    })

    test('场景 5:默认配置不创建默认报告文件(基于 outputPattern)', () => {
      const expectedReportPath = path.join(
        tmpDir,
        END_CONFIG.outputPattern.replace('{date}', new Date().toISOString().slice(0, 10))
      )
      const restore = silenceConsole()
      try {
        runScan({ ...END_CONFIG, dryRun: false })
      } finally { restore() }
      assert.equal(fs.existsSync(expectedReportPath), false, '默认 skip 不应写默认报告文件')
    })
  })

  describe('skip 组合(部分跳过条件满足)', () => {
    test('场景 6:messagesPath 存在 + scanTargets 空 → exit 0(skip,因 scanTargets 空)', () => {
      setupFixture({
        zhCN: { about: { title: '关于' } },
      })
      const restore = silenceConsole()
      try {
        const code = runScan({ ...END_CONFIG, dryRun: false, exitOnDead: true })
        assert.equal(code, 0, 'scanTargets 空 → skip → exit 0(即使 messagesPath 存在)')
      } finally { restore() }
    })

    test('场景 7:messagesPath 不存在 + scanTargets 非空 → exit 0(skip,因 messagesPath 优先检查)', () => {
      // 不创建 messagesPath,但 scanTargets 非空(创建一个 scanTarget 目录 + 代码文件)
      fs.mkdirSync(path.join(tmpDir, 'apps/desktop/src'), { recursive: true })
      fs.writeFileSync(path.join(tmpDir, 'apps/desktop/src/main.ts'), "t('about.title')", 'utf8')
      const restore = silenceConsole()
      try {
        const code = runScan({
          ...END_CONFIG,
          scanTargets: HYPOTHETICAL_SCAN_TARGETS,
          dryRun: false,
          exitOnDead: true,
        })
        assert.equal(code, 0, 'messagesPath 不存在 → skip → exit 0(即使 scanTargets 非空,messagesPath 检查优先)')
      } finally { restore() }
    })
  })

  describe('假设性场景(模拟 desktop 端将来添加 i18n 时的扫描行为)', () => {
    test('场景 8:所有 key 死 + exitOnDead=true → exit 1', () => {
      setupFixture({
        zhCN: {
          about: { title: '关于', subtitle: '副标题' },
          unused: { dead: '死 key' },
        },
        codeFiles: {
          'apps/desktop/src/main.ts': '// 没有任何 t() 调用,所有 key 都死',
        },
      })
      const restore = silenceConsole()
      try {
        const code = runScan({
          ...END_CONFIG,
          scanTargets: HYPOTHETICAL_SCAN_TARGETS,
          dryRun: true,
          exitOnDead: true,
        })
        assert.equal(code, 1, '所有 key 死 + exitOnDead=true → exit 1(模拟 desktop 端将来添加 i18n)')
      } finally { restore() }
    })

    test('场景 9:所有 key 死 + exitOnDead=false → exit 0', () => {
      setupFixture({
        zhCN: { about: { title: '关于' } },
        codeFiles: {
          'apps/desktop/src/main.ts': '// 没有任何 t() 调用',
        },
      })
      const restore = silenceConsole()
      try {
        const code = runScan({
          ...END_CONFIG,
          scanTargets: HYPOTHETICAL_SCAN_TARGETS,
          dryRun: true,
          exitOnDead: false,
        })
        assert.equal(code, 0, '所有 key 死 + exitOnDead=false → exit 0')
      } finally { restore() }
    })

    test('场景 10:所有 key 被 useTranslations namespace 引用 → exit 0', () => {
      setupFixture({
        zhCN: { about: { title: '关于', subtitle: '副标题' } },
        codeFiles: {
          'apps/desktop/src/main.ts': [
            "import { useTranslations } from 'next-intl'",
            "const t = useTranslations('about')",
          ].join('\n'),
        },
      })
      const restore = silenceConsole()
      try {
        const code = runScan({
          ...END_CONFIG,
          scanTargets: HYPOTHETICAL_SCAN_TARGETS,
          dryRun: true,
          exitOnDead: true,
        })
        assert.equal(code, 0, '所有 key 被 namespace 引用 → exit 0')
      } finally { restore() }
    })

    test('场景 11:dryRun=true → exit 0,不写报告文件', () => {
      setupFixture({
        zhCN: { about: { title: '关于' } },
        codeFiles: {
          'apps/desktop/src/main.ts': '// 无 t() 调用,有死 key',
        },
      })
      const expectedReportPath = path.join(
        tmpDir,
        END_CONFIG.outputPattern.replace('{date}', new Date().toISOString().slice(0, 10))
      )
      const restore = silenceConsole()
      try {
        runScan({
          ...END_CONFIG,
          scanTargets: HYPOTHETICAL_SCAN_TARGETS,
          dryRun: true,
          exitOnDead: false,
        })
      } finally { restore() }
      assert.equal(fs.existsSync(expectedReportPath), false, 'dryRun=true 不应写报告文件')
    })

    test('场景 12:dryRun=false + out=<path> → 写报告,含"死 key 列表"和 target=desktop', () => {
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
          'apps/desktop/src/main.ts': "t('used.key')",
        },
      })
      const customOut = path.join(tmpDir, 'desktop-report.md')
      const restore = silenceConsole()
      try {
        const code = runScan({
          ...END_CONFIG,
          scanTargets: HYPOTHETICAL_SCAN_TARGETS,
          dryRun: false,
          exitOnDead: false,
          out: customOut,
        })
        assert.equal(code, 0, 'exitOnDead=false 即使有死 key 也 exit 0')
      } finally { restore() }
      assert.equal(fs.existsSync(customOut), true, '报告应写入 out 指定路径')
      const report = fs.readFileSync(customOut, 'utf8')
      assert.match(report, /死 key 列表/, '报告应含"死 key 列表"章节')
      assert.match(report, /dead\.key/, '报告应列出死 key "dead.key"')
      assert.match(report, /target=desktop/, '报告应标注 target=desktop')
      assert.doesNotMatch(report, /- `used\.key`/, 'used.key 被引用,不应以死 key 列表项格式出现')
    })

    test('场景 13:翻译不完整(en 缺 key)→ 报告含"翻译不完整"章节', () => {
      setupFixture({
        zhCN: { about: { title: '关于', subtitle: '副标题' } },
        otherLocales: {
          en: { about: { title: 'About' } }, // 缺 subtitle
          ja: { about: { title: 'について', subtitle: 'サブタイトル' } },
          ko: { about: { title: '정보', subtitle: '부제' } },
          'zh-TW': { about: { title: '關於', subtitle: '副標題' } },
        },
        codeFiles: {
          'apps/desktop/src/main.ts': [
            "import { useTranslations } from 'next-intl'",
            "const t = useTranslations('about')",
          ].join('\n'),
        },
      })
      const customOut = path.join(tmpDir, 'incomplete-report.md')
      const restore = silenceConsole()
      try {
        runScan({
          ...END_CONFIG,
          scanTargets: HYPOTHETICAL_SCAN_TARGETS,
          dryRun: false,
          exitOnDead: false,
          out: customOut,
        })
      } finally { restore() }
      const report = fs.readFileSync(customOut, 'utf8')
      assert.match(report, /翻译不完整/, '报告应含"翻译不完整"章节')
      assert.match(report, /about\.subtitle/, '报告应列出 about.subtitle 为翻译不完整')
    })
  })

  describe('真实脚本子进程测试(scripts/scan-desktop-dead-i18n-keys.mjs)', () => {
    // 在项目根目录运行真实脚本,验证默认 skip 行为 + 参数解析
    // 项目根目录的 packages/i18n/messages/desktop/zh-CN.json 不存在 → 默认 skip → exit 0
    test('场景 14:默认运行 → exit 0(messagesPath 不存在,自动 skip)', () => {
      const result = spawnSync('node', ['scripts/scan-desktop-dead-i18n-keys.mjs'], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        timeout: 15000,
      })
      // spawnSync 成功时 result.error 为 undefined(非 null);失败时 result.status 为 null
      assert.equal(result.status, 0, '默认运行应 exit 0(messagesPath 不存在 → skip)')
    })

    test('场景 15:--exit 1 → exit 0(skip 优先,exitOnDead 不生效)', () => {
      const result = spawnSync(
        'node',
        ['scripts/scan-desktop-dead-i18n-keys.mjs', '--exit', '1'],
        { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 15000 }
      )
      assert.equal(result.status, 0, '--exit 1 应 exit 0(skip 优先于 exitOnDead)')
    })
  })
})
