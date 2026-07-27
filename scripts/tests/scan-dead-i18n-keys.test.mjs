/**
 * @file scan-dead-i18n-keys.mjs CLI 入口测试
 * @description 端到端覆盖 scripts/scan-dead-i18n-keys.mjs 的 CLI 行为:
 *   --target 切换 / --help / --dry-run / --exit / --out / 退出码 / 输出路径模式。
 *
 *   本脚本与 4 端独立脚本(scan-extension/miniapp-taro/mobile-rn-dead-i18n-keys.mjs)
 *   的区别:本脚本是 web 兼容入口,通过 --target 切换 4 端配置,默认 target=web。
 *   _i18n-scan-helpers.mjs 的 main() 端到端逻辑已由 scan-{web,extension,miniapp-taro,mobile-rn}-dead-i18n-keys.test.mjs
 *   覆盖,本测试聚焦 CLI 入口特有行为(arg 解析 / target 路由 / 输出路径模式 / --help)。
 *
 *   测试方式:用 child_process.spawnSync 把脚本作为子进程跑,cwd=tmpDir,
 *   在 tmpDir 内创建 fixture(packages/i18n/messages/<target>/ + apps/<end>/src/),
 *   不依赖项目真实 i18n 文件,符合 AGENTS.md §23(目录用 tests/)。
 *   路径推导用 import.meta.url(任务约束)。
 *
 *   覆盖场景:
 *   ① --help → exit 0,stdout 含帮助文本
 *   ② 默认(无参)target=web → exit 0(所有 key 引用)
 *   ③ --target web 显式 → 与默认等价
 *   ④ --target miniapp-taro → 使用 miniapp-taro 配置扫描
 *   ⑤ --target mobile-rn → 使用 mobile-rn 配置扫描
 *   ⑥ --target extension → 使用 extension 配置扫描(3 个 scanTargets)
 *   ⑦ --target unknown → exit 1,stderr 含错误
 *   ⑧ --dry-run → 不写报告文件
 *   ⑨ --exit 1 + 有死 key → exit 1
 *   ⑩ 无 --exit(默认)+ 有死 key → exit 0
 *   ⑪ --out <path> → 报告写入自定义路径
 *   ⑫ web 默认输出路径模式 i18n-dead-keys-{date}.md(无 target 后缀)
 *   ⑬ 非 web 输出路径模式 i18n-dead-keys-{date}-{target}.md
 *   ⑭ web target 扫描多目录(web/src + web/app + miniapp-taro/src + cli/src + mobile-rn/src)
 *   ⑮ --target extension 路由到 extension messages(非 web messages)
 *
 *   用 Node.js 内置 test runner,无第三方依赖。
 */
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ORIGINAL_CWD = process.cwd()

// 路径推导用 import.meta.url(任务约束)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCRIPT_PATH = path.resolve(__dirname, '../scan-dead-i18n-keys.mjs')

let tmpDir

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-cli-scan-'))
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
 * 运行 scan-dead-i18n-keys.mjs CLI(子进程,cwd=tmpDir)
 * @param {string[]} args - CLI 参数
 * @returns {{ status: number|null, stdout: string, stderr: string }}
 */
function runCli(args = []) {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: tmpDir,
    encoding: 'utf8',
    timeout: 30000,
  })
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

/**
 * 在 tmpDir 创建 fixture(对应 scan-dead-i18n-keys.mjs TARGETS 配置)
 * @param {Object} opts
 * @param {string} opts.target - 'web' | 'miniapp-taro' | 'mobile-rn' | 'extension'
 * @param {Object} opts.zhCN - zh-CN.json 内容
 * @param {Object} [opts.otherLocales] - { en: {...}, ja: {...}, ... }
 * @param {Object<string, string>} [opts.codeFiles] - { 'apps/web/src/page.tsx': '...' }
 */
function setupFixture({ target, zhCN, otherLocales = {}, codeFiles = {} }) {
  const localeDir = path.join(tmpDir, 'packages/i18n/messages', target)
  fs.mkdirSync(localeDir, { recursive: true })
  fs.writeFileSync(path.join(localeDir, 'zh-CN.json'), JSON.stringify(zhCN, null, 2), 'utf8')
  for (const [lang, content] of Object.entries(otherLocales)) {
    fs.writeFileSync(path.join(localeDir, `${lang}.json`), JSON.stringify(content, null, 2), 'utf8')
  }
  for (const [filePath, content] of Object.entries(codeFiles)) {
    const full = path.join(tmpDir, filePath)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content, 'utf8')
  }
}

describe('scan-dead-i18n-keys.mjs CLI 入口测试', () => {
  test('场景 1:--help → exit 0,stdout 含帮助文本', () => {
    const { status, stdout } = runCli(['--help'])
    assert.equal(status, 0, '--help 应 exit 0')
    assert.match(stdout, /scan-dead-i18n-keys/, '帮助文本应含脚本名')
    assert.match(stdout, /--target/, '帮助文本应含 --target 选项')
    assert.match(stdout, /用法/, '帮助文本应含"用法"段')
  })

  test('场景 2:默认(无 --target)target=web → exit 0(所有 key 引用)', () => {
    setupFixture({
      target: 'web',
      zhCN: { about: { title: '关于' } },
      codeFiles: {
        'apps/web/src/page.tsx': "t('about.title')",
      },
    })
    const { status } = runCli(['--dry-run', '--exit', '1'])
    assert.equal(status, 0, '默认 target=web,所有 key 引用,--exit 1 应仍 exit 0')
  })

  test('场景 3:--target web 显式 → 与默认等价', () => {
    setupFixture({
      target: 'web',
      zhCN: { home: { cta: '点击' } },
      codeFiles: {
        'apps/web/src/page.tsx': "t('home.cta')",
      },
    })
    const { status } = runCli(['--target', 'web', '--dry-run', '--exit', '1'])
    assert.equal(status, 0, '显式 --target web 与默认等价,所有 key 引用 → exit 0')
  })

  test('场景 4:--target miniapp-taro → 使用 miniapp-taro 配置扫描', () => {
    setupFixture({
      target: 'miniapp-taro',
      zhCN: { about: { title: '关于' } },
      codeFiles: {
        'apps/miniapp-taro/src/page.tsx': "t('about.title')",
      },
    })
    const { status } = runCli(['--target', 'miniapp-taro', '--dry-run', '--exit', '1'])
    assert.equal(status, 0, 'miniapp-taro target 应扫描 apps/miniapp-taro/src,所有 key 引用 → exit 0')
  })

  test('场景 5:--target mobile-rn → 使用 mobile-rn 配置扫描', () => {
    setupFixture({
      target: 'mobile-rn',
      zhCN: { about: { title: '关于' } },
      codeFiles: {
        'apps/mobile-rn/src/page.tsx': "t('about.title')",
      },
    })
    const { status } = runCli(['--target', 'mobile-rn', '--dry-run', '--exit', '1'])
    assert.equal(status, 0, 'mobile-rn target 应扫描 apps/mobile-rn/src,所有 key 引用 → exit 0')
  })

  test('场景 6:--target extension → 使用 extension 配置扫描(3 个 scanTargets)', () => {
    setupFixture({
      target: 'extension',
      zhCN: {
        entry: { key: '入口' },
        src: { key: '源码' },
        lib: { key: '库' },
      },
      codeFiles: {
        'apps/extension/entrypoints/background.ts': "t('entry.key')",
        'apps/extension/src/popup.tsx': "t('src.key')",
        'apps/extension/lib/util.ts': "t('lib.key')",
      },
    })
    const { status } = runCli(['--target', 'extension', '--dry-run', '--exit', '1'])
    assert.equal(status, 0, 'extension target 3 个目录(entrypoints/src/lib)都被扫描,所有 key 引用 → exit 0')
  })

  test('场景 7:--target unknown → exit 1,stderr 含错误', () => {
    const { status, stderr } = runCli(['--target', 'unknown-target'])
    assert.equal(status, 1, '未知 target 应 exit 1')
    assert.match(stderr, /未知 target/, 'stderr 应含"未知 target"错误')
    assert.match(stderr, /unknown-target/, 'stderr 应含无效 target 名')
  })

  test('场景 8:--dry-run → 不写报告文件', () => {
    setupFixture({
      target: 'web',
      zhCN: { about: { title: '关于' } },
      codeFiles: {
        'apps/web/src/page.tsx': "t('about.title')",
      },
    })
    runCli(['--dry-run'])
    const today = new Date().toISOString().slice(0, 10)
    const expectedReport = path.join(tmpDir, `.trae-cn/tmp/i18n-dead-keys-${today}.md`)
    assert.equal(fs.existsSync(expectedReport), false, '--dry-run 不应写报告文件')
  })

  test('场景 9:--exit 1 + 有死 key → exit 1', () => {
    setupFixture({
      target: 'web',
      zhCN: {
        used: { key: '已用' },
        dead: { key: '死 key' },
      },
      codeFiles: {
        'apps/web/src/page.tsx': "t('used.key')",
      },
    })
    const { status } = runCli(['--dry-run', '--exit', '1'])
    assert.equal(status, 1, '有死 key + --exit 1 应 exit 1')
  })

  test('场景 10:无 --exit(默认)+ 有死 key → exit 0', () => {
    setupFixture({
      target: 'web',
      zhCN: {
        used: { key: '已用' },
        dead: { key: '死 key' },
      },
      codeFiles: {
        'apps/web/src/page.tsx': "t('used.key')",
      },
    })
    const { status } = runCli(['--dry-run'])
    assert.equal(status, 0, '默认 exitOnDead=false,有死 key 也 exit 0')
  })

  test('场景 11:--out <path> → 报告写入自定义路径,内容含死 key 列表', () => {
    setupFixture({
      target: 'web',
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
        'apps/web/src/page.tsx': "t('used.key')",
      },
    })
    const customOut = path.join(tmpDir, 'custom-report.md')
    const { status } = runCli(['--out', customOut])
    assert.equal(status, 0, '默认 exitOnDead=false,有死 key 也 exit 0')
    assert.equal(fs.existsSync(customOut), true, '报告应写入 --out 指定路径')
    const report = fs.readFileSync(customOut, 'utf8')
    assert.match(report, /死 key 列表/, '报告应含"死 key 列表"章节')
    assert.match(report, /dead\.key/, '报告应列出 dead.key')
    assert.doesNotMatch(report, /- `used\.key`/, 'used.key 被引用,不应以死 key 列表项格式出现')
  })

  test('场景 12:web 默认输出路径模式 i18n-dead-keys-{date}.md(无 target 后缀)', () => {
    setupFixture({
      target: 'web',
      zhCN: { about: { title: '关于' } },
      codeFiles: {
        'apps/web/src/page.tsx': "t('about.title')",
      },
    })
    runCli([]) // 无 --dry-run,无 --out,使用默认 outputPattern
    const today = new Date().toISOString().slice(0, 10)
    const expectedReport = path.join(tmpDir, `.trae-cn/tmp/i18n-dead-keys-${today}.md`)
    assert.equal(fs.existsSync(expectedReport), true, 'web 默认输出路径应为 i18n-dead-keys-{date}.md(无 target 后缀)')
  })

  test('场景 13:非 web 输出路径模式 i18n-dead-keys-{date}-{target}.md', () => {
    setupFixture({
      target: 'extension',
      zhCN: { about: { title: '关于' } },
      codeFiles: {
        'apps/extension/src/popup.tsx': "t('about.title')",
      },
    })
    runCli(['--target', 'extension'])
    const today = new Date().toISOString().slice(0, 10)
    const expectedReport = path.join(tmpDir, `.trae-cn/tmp/i18n-dead-keys-${today}-extension.md`)
    assert.equal(fs.existsSync(expectedReport), true, '非 web 输出路径应为 i18n-dead-keys-{date}-{target}.md')
  })

  test('场景 14:web target 扫描多目录(web/src + web/app + miniapp-taro/src + cli/src + mobile-rn/src)', () => {
    // web target 的 scanTargets 含 5 个目录,验证跨目录 key 引用都被识别
    setupFixture({
      target: 'web',
      zhCN: {
        web: { src: 'web/src', app: 'web/app' },
        miniapp: { src: 'miniapp/src' },
        cli: { src: 'cli/src' },
        mobile: { src: 'mobile/src' },
      },
      codeFiles: {
        'apps/web/src/web-src.ts': "t('web.src')",
        'apps/web/app/web-app.ts': "t('web.app')",
        'apps/miniapp-taro/src/miniapp.ts': "t('miniapp.src')",
        'apps/cli/src/cli.ts': "t('cli.src')",
        'apps/mobile-rn/src/mobile.ts': "t('mobile.src')",
      },
    })
    const { status } = runCli(['--dry-run', '--exit', '1'])
    assert.equal(status, 0, 'web target 5 个 scanTargets 都被扫描,所有 key 引用 → exit 0')
  })

  test('场景 15:--target extension 路由到 extension messages(非 web messages)', () => {
    // 验证 --target extension 读 packages/i18n/messages/extension/zh-CN.json(非 web 的)
    // 在 web messages 放死 key,验证 extension target 不读 web messages
    setupFixture({
      target: 'extension',
      zhCN: { ext: { key: '扩展专属' } },
      codeFiles: {
        'apps/extension/src/popup.tsx': "t('ext.key')",
      },
    })
    // 同时创建 web messages(含死 key),验证 extension target 不读它
    const webLocaleDir = path.join(tmpDir, 'packages/i18n/messages/web')
    fs.mkdirSync(webLocaleDir, { recursive: true })
    fs.writeFileSync(path.join(webLocaleDir, 'zh-CN.json'), JSON.stringify({ web: { dead: 'web 死 key' } }), 'utf8')
    const { status } = runCli(['--target', 'extension', '--dry-run', '--exit', '1'])
    assert.equal(status, 0, 'extension target 读 extension messages(非 web),所有 ext.* 引用 → exit 0')
  })
})
