// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
// §22c:判据实现只此一份,测试直接 import,不复制
import {
  contractEntriesFor,
  verifyContractEntries,
  unknownContractTargets,
  loadContractFile,
} from '../_i18n-scan-helpers.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

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
    const expectedReport = path.join(tmpDir, `.ihui-agent/tmp/i18n-dead-keys-${today}.md`)
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
    const expectedReport = path.join(tmpDir, `.ihui-agent/tmp/i18n-dead-keys-${today}.md`)
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
    const expectedReport = path.join(tmpDir, `.ihui-agent/tmp/i18n-dead-keys-${today}-extension.md`)
    assert.equal(fs.existsSync(expectedReport), true, '非 web 输出路径应为 i18n-dead-keys-{date}-{target}.md')
  })

  test('场景 14:web target 扫描多目录(web/src + web/app + miniapp-taro/src + mobile-rn/src + packages/app/src)', () => {
    // web target 的 scanTargets 含 5 个目录,验证跨目录 key 引用都被识别
    // 2026-09-12 修复:commit a80496f6f8d 把 web scanTargets 的 apps/cli/src 换成 packages/app/src
    // (消除 865 个跨端共享 key 假阳性),但本场景未同步更新 → cli.src 引用不在扫描范围 → 存量失败
    setupFixture({
      target: 'web',
      zhCN: {
        web: { src: 'web/src', app: 'web/app' },
        miniapp: { src: 'miniapp/src' },
        appPkg: { src: 'packages/app/src' },
        mobile: { src: 'mobile/src' },
      },
      codeFiles: {
        'apps/web/src/web-src.ts': "t('web.src')",
        'apps/web/app/web-app.ts': "t('web.app')",
        'apps/miniapp-taro/src/miniapp.ts': "t('miniapp.src')",
        'packages/app/src/rn-app.ts': "t('appPkg.src')",
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

  // ── 场景 16-19:--target all 与"跨包消费方必须进 scanTargets"的装车证明 ──
  // 起因(2026-09-24 实测):CI 的 dead-key 步骤与根 check:all 都只跑 web 一端,
  // 于是 cli 端 76 枚 waiting.* 恒红数日无人执行它;而 waiting 键是 cli 把取词函数 t
  // 注入 shared 的 resolveWaitingText() 后,在 packages/shared/src/chat 里运行期拼出来的,
  // 端 scanTargets 不含该目录 ⇒ 幻影死键。两头(覆盖面 / 入口)各修一次。

  test('场景 16:--target all 逐端出结论,desktop 无 JS 面必须"如实报未计入"', () => {
    setupFixture({
      target: 'cli',
      zhCN: { waiting: { agent: { first: { 0: '正在准备' } } } },
      codeFiles: { 'apps/cli/src/waiting-text.ts': "t('waiting.agent.first.0')" },
    })
    setupFixture({
      target: 'extension',
      zhCN: { ext: { key: '扩展' } },
      codeFiles: { 'apps/extension/src/popup.tsx': "t('ext.key')" },
    })
    const { status, stdout } = runCli(['--target', 'all', '--dry-run', '--exit', '1'])
    assert.equal(status, 0, `两端均无死键应 exit 0,实际:\n${stdout}`)
    assert.match(stdout, /all →.*cli=ok/, '结论行必须逐端列出(只报总 exit 会让"某端没被扫"看着像全绿)')
    assert.match(stdout, /extension=ok/, 'extension 必须真被扫到并计入结论')
    assert.match(stdout, /未计入:desktop/, '无 JS 扫描面的端必须写明"未计入",不得静默')
  })

  test('场景 17:靠后的一端全绿不得吞掉前端的红(聚合取最大值)', () => {
    // cli 放一枚无人引用的死键,extension 干净;TARGETS 顺序里 cli 在 extension 之前,
    // 正是"最后一端覆盖前面结果"那种写法的反例(实测旧写法 worst 会被 extension 的 0 冲掉)。
    setupFixture({
      target: 'cli',
      zhCN: { waiting: { agent: { first: { 0: '正在准备' } } }, nobody: { reads: '没人取' } },
      codeFiles: { 'apps/cli/src/waiting-text.ts': "t('waiting.agent.first.0')" },
    })
    setupFixture({
      target: 'extension',
      zhCN: { ext: { key: '扩展' } },
      codeFiles: { 'apps/extension/src/popup.tsx': "t('ext.key')" },
    })
    const { status, stdout } = runCli(['--target', 'all', '--dry-run', '--exit', '1'])
    assert.match(stdout, /cli=exit 1/, '红端必须被点名')
    assert.equal(status, 1, `前端红不能被后端绿吞掉,实际 exit ${status}\n${stdout}`)
  })

  test('场景 18:--target all 与 --out 同时给出时必须声明忽略(防五端报告互相覆盖)', () => {
    setupFixture({
      target: 'cli',
      zhCN: { a: { b: 'x' } },
      codeFiles: { 'apps/cli/src/x.ts': "t('a.b')" },
    })
    const { stdout } = runCli(['--target', 'all', '--dry-run', '--out', 'merged.md'])
    assert.match(stdout, /忽略 --out|--out.*忽略/, '必须显式说明 --out 在 all 模式下不生效')
  })

  test('场景 19:装车证明 —— cli 的 scanTargets 必须含真正拼键的跨包消费方', () => {
    // 键在 packages/shared/src/chat 里运行期拼出,端内代码只有注入 t 的那一层;
    // 少了这个目录,76 枚 waiting.* 会被整族误判成死键(2026-09-24 实测)。
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8')
    const cliBlock = src.slice(src.indexOf('  cli: {'), src.indexOf('  extension: {'))
    assert.match(cliBlock, /packages\/shared\/src\/chat/, 'cli.scanTargets 必须含 packages/shared/src/chat')
    setupFixture({
      target: 'cli',
      zhCN: { waiting: { agent: { first: { 0: '正在准备' } } } },
      codeFiles: {
        // 照真实形态:命名空间写在常量里,键由模板拼出(scanCode 的声明式命名空间规则据此判活)
        'packages/shared/src/chat/waiting-pool.ts':
          "const WAITING_I18N_NAMESPACE = 'waiting'\nconst key = `${WAITING_I18N_NAMESPACE}.${q}.${p}.${i}`",
      },
    })
    const { status, stdout } = runCli(['--target', 'cli', '--dry-run', '--exit', '1'])
    assert.equal(status, 0, `跨包动态拼键应判活,实际:\n${stdout}`)
  })
})

/**
 * 契约键声明(scripts/i18n-contract-keys.json)
 *
 * 判据实现一律从 ../_i18n-scan-helpers.mjs import(AGENTS.md §22c:禁止在测试里复制判据实现)。
 * 取证分两层:
 *   ① 纯函数单例(注入假 readHead,零 git 依赖) —— 覆盖 6 类失效码 + 形状校验;
 *   ② 端到端(在 tmpDir 里 git init + commit 一个真仓库) —— 证明走**真实 HEAD 读取器**时
 *      「依据成立 ⇒ 免除死键」「依据漂移 ⇒ 判红且不免除」「真孤儿键照旧判红」三条都成立。
 */
describe('契约键声明:跨端词包契约键 / 被测试钉住的形状键', () => {
  const REPO_ROOT = path.resolve(__dirname, '../..')
  const REASON = '跨端词包契约键,本端无消费方是设计选择而非孤儿(测试用理由)'

  /** 构造 entries Map(复用被测的 contractEntriesFor,避免测试自己解释声明格式) */
  function entriesOf(targetBlock) {
    const { entries } = contractEntriesFor({ targets: { 'mobile-rn': targetBlock } }, 'mobile-rn')
    return entries
  }

  test('单元:依据全部可核验 + 键确为死键 → 免除死键判定', () => {
    const entries = entriesOf({
      'contract.key': { reason: REASON, evidence: [{ file: 'a.ts', line: 2, contains: 'contract.key' }] },
    })
    const { violations, exempted } = verifyContractEntries({
      entries,
      leafKeys: new Set(['contract.key']),
      deadKeys: new Set(['contract.key']),
      readHead: () => 'l1\n// contract.key\n',
      target: 'mobile-rn',
    })
    assert.deepEqual(violations, [])
    assert.deepEqual(exempted.map((e) => e.key), ['contract.key'])
  })

  test('单元:依据文件不在 HEAD → EVIDENCE_UNVERIFIED 且不免除', () => {
    const entries = entriesOf({
      'contract.key': { reason: REASON, evidence: [{ file: 'gone.ts', line: 1, contains: 'contract.key' }] },
    })
    const { violations, exempted } = verifyContractEntries({
      entries,
      leafKeys: new Set(['contract.key']),
      deadKeys: new Set(['contract.key']),
      readHead: () => null,
      target: 'mobile-rn',
    })
    assert.equal(exempted.length, 0, '依据不成立绝不能免除')
    assert.equal(violations[0].code, 'EVIDENCE_UNVERIFIED')
    assert.match(violations[0].msg, /HEAD 中不存在/)
  })

  test('单元:行号越界 / 该行不含标识符 → 各自点名', () => {
    const mk = (ev, head) =>
      verifyContractEntries({
        entries: entriesOf({ 'contract.key': { reason: REASON, evidence: [ev] } }),
        leafKeys: new Set(['contract.key']),
        deadKeys: new Set(['contract.key']),
        readHead: () => head,
        target: 'mobile-rn',
      })
    const range = mk({ file: 'a.ts', line: 99, contains: 'contract.key' }, 'l1\nl2\n')
    assert.equal(range.violations[0].code, 'EVIDENCE_UNVERIFIED')
    assert.match(range.violations[0].msg, /行号越界/)
    const drift = mk({ file: 'a.ts', line: 2, contains: 'moved.away' }, 'l1\n// contract.key\n')
    assert.match(drift.violations[0].msg, /依据已漂移/)
  })

  test('单元:声明的键不在本端语言包 → KEY_NOT_IN_PACK(防清单腐烂)', () => {
    const { violations } = verifyContractEntries({
      entries: entriesOf({
        'ghost.key': { reason: REASON, evidence: [{ file: 'a.ts', line: 1, contains: 'ghost.key' }] },
      }),
      leafKeys: new Set(['other.key']),
      deadKeys: new Set(),
      readHead: () => '// ghost.key\n',
      target: 'mobile-rn',
    })
    assert.equal(violations[0].code, 'KEY_NOT_IN_PACK')
  })

  test('单元:键已被本端静态引用(不再死) → DECLARATION_UNNEEDED', () => {
    const { violations, exempted } = verifyContractEntries({
      entries: entriesOf({
        'wired.key': { reason: REASON, evidence: [{ file: 'a.ts', line: 1, contains: 'wired.key' }] },
      }),
      leafKeys: new Set(['wired.key']),
      deadKeys: new Set(),
      readHead: () => '// wired.key\n',
      target: 'mobile-rn',
    })
    assert.equal(exempted.length, 0)
    assert.equal(violations[0].code, 'DECLARATION_UNNEEDED')
  })

  test('单元:reason 过短 / line 非整数 / evidence 空 → 形状不合法(不是静默跳过)', () => {
    const { entries, issues } = contractEntriesFor(
      {
        targets: {
          'mobile-rn': {
            'short.reason': { reason: '太短', evidence: [{ file: 'a.ts', line: 1, contains: 'x' }] },
            'bad.line': {
              reason: REASON,
              evidence: [{ file: 'a.ts', line: '1', contains: 'x' }],
            },
            'no.evidence': { reason: REASON, evidence: [] },
          },
        },
      },
      'mobile-rn',
    )
    assert.equal(entries.size, 0, '形状不合法的条目不得进入免除面')
    assert.equal(issues.length, 3)
    assert.deepEqual(issues.map((i) => i.key).sort(), ['bad.line', 'no.evidence', 'short.reason'])
  })

  test('单元:声明里出现未知 target → 点名(拼错的端名没有读者)', () => {
    const bogus = unknownContractTargets(
      { targets: { 'mobile-rn': {}, 'miniapp-ten': {} } },
      ['web', 'mobile-rn', 'cli'],
    )
    assert.deepEqual(bogus, ['miniapp-ten'])
  })

  /** 在**真仓**跑一次 CLI(cwd 即扫描器 ROOT);--dry-run 不写报告 */
  function runCliOnRealRepo(args) {
    const r = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 60000,
    })
    return `${r.stdout || ''}${r.stderr || ''}`
  }

  test('装车证明:真仓 scripts/i18n-contract-keys.json 形状合法且无未知端', () => {
    const file = loadContractFile(REPO_ROOT)
    assert.ok(file.exists, '契约声明文件必须入库(缺文件 = 该端重新恒红)')
    const knownTargets = ['web', 'miniapp-taro', 'mobile-rn', 'cli', 'extension', 'desktop']
    assert.deepEqual(unknownContractTargets(file.raw, knownTargets), [])
    for (const target of ['web', 'miniapp-taro', 'mobile-rn', 'cli', 'extension']) {
      const { issues } = contractEntriesFor(file.raw, target)
      assert.deepEqual(issues, [], `${target} 声明形状不合法:${JSON.stringify(issues)}`)
    }
  })

  /**
   * 这条取代了旧断言"清单里必须登记 permissionTier.label"。
   *
   * 那条把一枚**条目**当常量钉死,而清单的语义恰恰是"条目会过期"(硬约束四:键一旦被本端
   * 静态引用,豁免就成了无人复核的假保护)。2026-09-24 真出现这种情况 —— `ChatDisclosure.tsx`
   * 已直接 `t('permissionTier.label')`,扫描器判 DECLARATION_UNNEEDED、`--target all --exit 1`
   * 对全队恒红,而旧测试正要求把那条红着的豁免留在清单里。钉条目必然与判据对撞,
   * 所以改钉不变量:**凡真仓登记着的声明,必须被真仓扫描器认作成立**。
   * 清单为空时本条自然成立(不假装覆盖),三种失效码由上方单测 + 端到端用例分别钉住。
   */
  test('装车证明:真仓登记的每条契约声明都必须被真仓扫描器认作成立', () => {
    const file = loadContractFile(REPO_ROOT)
    const FAILURE_CODES = ['DECLARATION_UNNEEDED', 'EVIDENCE_UNVERIFIED', 'KEY_NOT_IN_PACK']
    let 有登记的面 = 0
    for (const target of ['web', 'miniapp-taro', 'mobile-rn', 'cli', 'extension']) {
      const { entries } = contractEntriesFor(file.raw, target)
      if (entries.size === 0) continue
      有登记的面 += 1
      const out = runCliOnRealRepo(['--target', target, '--dry-run', '--exit', '1'])
      for (const code of FAILURE_CODES) {
        assert.ok(!out.includes(code), `${target} 登记了 ${entries.size} 条契约声明,扫描器仍判 ${code}:\n${out}`)
      }
    }
    console.log(`   契约声明装车:有登记的端 ${有登记的面} 个(为 0 时本条只校验"清单不自红")`)
  })

  // ── 端到端:真 HEAD 读取器 ────────────────────────────────────────────────

  const GIT_IN_TESTS = process.env.IHUI_GIT_BIN || resolveGitBin() || 'git'

  function gitInRepo(args) {
    return spawnSync(GIT_IN_TESTS, ['-c', 'safe.directory=*', '-C', tmpDir, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
    })
  }

  /**
   * 写夹具 + git init + commit,使依据文件真的存在于 HEAD。
   * @param {Object<string, string|object>} files - 相对路径 → 内容(对象自动 stringify)
   */
  function setupCommittedFixture(files) {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(tmpDir, rel)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8')
    }
    const init = gitInRepo(['init', '-q'])
    assert.equal(init.status, 0, `git init 失败:${init.stderr}`)
    const add = gitInRepo(['add', '-A'])
    assert.equal(add.status, 0, `git add 失败:${add.stderr}`)
    const commit = gitInRepo([
      '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'fixture',
    ])
    assert.equal(commit.status, 0, `git commit 失败:${commit.stderr}${commit.stdout}`)
  }

  /** 五语齐备的本端语言包(避免"翻译不完整"混进退出码断言) */
  function packsFor() {
    const files = {}
    for (const locale of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']) {
      files[`packages/i18n/messages/mobile-rn/${locale}.json`] = {
        contract: { key: `${locale} 值` },
        used: { key: `${locale} 另一枚` },
      }
    }
    return files
  }

  const CONTRACT_FILE = 'scripts/i18n-contract-keys.json'

  function contractWith(evidence) {
    return { targets: { 'mobile-rn': { 'contract.key': { reason: REASON, evidence } } } }
  }

  test('端到端:依据在 HEAD 可核验 → 死键被免除,exit 0 且逐条打印理由与依据', () => {
    setupCommittedFixture({
      ...packsFor(),
      'apps/mobile-rn/src/screen.tsx': "t('used.key')",
      'packages/shared/src/chat/contract-owner.ts': '// 词表约定:\n//   contract.key\nexport const K = 1\n',
      [CONTRACT_FILE]: contractWith([
        { file: 'packages/shared/src/chat/contract-owner.ts', line: 2, contains: 'contract.key' },
      ]),
    })
    const { status, stdout, stderr } = runCli(['--target', 'mobile-rn', '--exit', '1'])
    assert.equal(status, 0, `应 exit 0,实际 ${status}\n${stdout}\n${stderr}`)
    assert.match(stdout, /契约键声明/, '必须逐条打印,不得静默')
    assert.match(stdout, /contract\.key/, '命中的键名必须可见')
    assert.match(stdout, /contract-owner\.ts:2/, '依据位置必须可见')
  })

  test('端到端:假依据(HEAD 里没有该文件)→ exit 1 点名,且该键照旧算死键', () => {
    setupCommittedFixture({
      ...packsFor({}),
      'apps/mobile-rn/src/screen.tsx': "t('other.key')",
      [CONTRACT_FILE]: contractWith([
        { file: 'packages/shared/src/chat/never-committed.ts', line: 2, contains: 'contract.key' },
      ]),
    })
    const { status, stderr } = runCli(['--target', 'mobile-rn', '--exit', '1'])
    assert.equal(status, 1, '依据不可核验必须判红')
    assert.match(stderr, /EVIDENCE_UNVERIFIED/)
    assert.match(stderr, /never-committed\.ts/, '必须点名是哪条依据')
    assert.match(stderr, /声明失效/, '必须明说豁免未生效')
  })

  test('端到端:真孤儿键不被契约声明波及(整端判据未被放宽)', () => {
    setupCommittedFixture({
      ...packsFor({}),
      'apps/mobile-rn/src/screen.tsx': "t('used.key')",
      'packages/shared/src/chat/contract-owner.ts': '// 词表约定:\n//   contract.key\nexport const K = 1\n',
      [CONTRACT_FILE]: contractWith([
        { file: 'packages/shared/src/chat/contract-owner.ts', line: 2, contains: 'contract.key' },
      ]),
    })
    // 额外往基准语言包里塞一枚没有任何引用的真孤儿键
    const zh = path.join(tmpDir, 'packages/i18n/messages/mobile-rn/zh-CN.json')
    const obj = JSON.parse(fs.readFileSync(zh, 'utf8'))
    obj.stranded = { orphan: '没人取' }
    fs.writeFileSync(zh, JSON.stringify(obj, null, 2), 'utf8')
    const { status, stdout } = runCli(['--target', 'mobile-rn', '--exit', '1'])
    assert.equal(status, 1, '有真孤儿键时必须仍判红 —— 豁免只能是键级的')
    assert.match(stdout, /契约键声明/, '声明那枚照样生效')
    const report = fs
      .readdirSync(path.join(tmpDir, '.ihui-agent/tmp'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => fs.readFileSync(path.join(tmpDir, '.ihui-agent/tmp', f), 'utf8'))
      .join('\n')
    assert.match(report, /stranded\.orphan/, '报告必须点名那枚真孤儿键')
    assert.doesNotMatch(report, /- `contract\.key`(?!\s*—)/m, '被声明的键不得出现在死键列表里')
  })

  test('端到端:声明只免除死键 —— 同键在 en.json 缺失时仍计入翻译不完整', () => {
    setupCommittedFixture({
      ...packsFor({}),
      'apps/mobile-rn/src/screen.tsx': "t('used.key')",
      'packages/shared/src/chat/contract-owner.ts': '// 词表约定:\n//   contract.key\nexport const K = 1\n',
      [CONTRACT_FILE]: contractWith([
        { file: 'packages/shared/src/chat/contract-owner.ts', line: 2, contains: 'contract.key' },
      ]),
    })
    const en = path.join(tmpDir, 'packages/i18n/messages/mobile-rn/en.json')
    const obj = JSON.parse(fs.readFileSync(en, 'utf8'))
    delete obj.contract.key
    fs.writeFileSync(en, JSON.stringify(obj, null, 2), 'utf8')
    const { stdout } = runCli(['--target', 'mobile-rn', '--exit', '1'])
    assert.match(stdout, /翻译不完整 key: 1/, '契约声明不得顺手免掉 parity 判据')
  })

  test('端到端:声明过期(键已被本端引用)→ exit 1 并点名多余条目', () => {
    setupCommittedFixture({
      ...packsFor({}),
      'apps/mobile-rn/src/screen.tsx': "t('contract.key')",
      'packages/shared/src/chat/contract-owner.ts': '// 词表约定:\n//   contract.key\nexport const K = 1\n',
      [CONTRACT_FILE]: contractWith([
        { file: 'packages/shared/src/chat/contract-owner.ts', line: 2, contains: 'contract.key' },
      ]),
    })
    const { status, stderr } = runCli(['--target', 'mobile-rn', '--exit', '1'])
    assert.equal(status, 1, '没有依据的豁免留在清单里就是腐烂,必须响')
    assert.match(stderr, /DECLARATION_UNNEEDED/)
  })

  test('端到端:声明里写了不存在的端名 → exit 1 点名(不会被任何判定读到)', () => {
    setupCommittedFixture({
      ...packsFor({}),
      'apps/mobile-rn/src/screen.tsx': "t('contract.key')",
      [CONTRACT_FILE]: {
        targets: { 'mobile-rn': {}, 'miniapp-ten': { 'contract.key': { reason: REASON, evidence: [{ file: 'x.ts', line: 1, contains: 'x' }] } } },
      },
    })
    const { status, stderr } = runCli(['--target', 'mobile-rn', '--exit', '1'])
    assert.equal(status, 1)
    assert.match(stderr, /miniapp-ten/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
