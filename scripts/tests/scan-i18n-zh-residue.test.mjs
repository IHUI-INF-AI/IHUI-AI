/**
 * @file scan-i18n-zh-residue.mjs 集成测试
 * @description 端到端覆盖 scripts/scan-i18n-zh-residue.mjs 的核心规则(AGENTS.md §19):
 *   - zh-TW (opencc 模式): 简→繁字形转换检测,简体字残留 → exit 1
 *   - ko (charRange 模式): 纯中文残留 → exit 1;半翻译(本地字符+汉字)→ warn exit 0
 *   - ja (warnOnly 模式): 任何汉字只 warn 不阻塞 → exit 0
 *   - 未配置 locale (如 vi): 无 localRe,任何汉字 → exit 1
 *   - 语言本名白名单(简体中文/日本語/繁體中文等)→ 跳过检测
 *   - --target=web|extension|shared 切换 JSON 路径
 *   - --readme 模式: 扫描 README.<locale>.md,跳过代码块/HTML 注释/图片/链接 URL/ICP 备案号
 *   - --staged 模式: 仅当 locale 文件在 git 暂存区时检查
 *
 *   测试用临时 fixture(在 os.tmpdir() 下创建项目结构 + spawnSync cwd 模拟项目根),
 *   不污染项目,符合 AGENTS.md §23(目录用 tests/)。
 *   用 Node.js 内置 test runner,无第三方依赖。路径推导用 import.meta.url(AGENTS.md §15)。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'scan-i18n-zh-residue.mjs')

// ─── 辅助:创建临时项目根目录 ─────────────────────────────
function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'ihui-scan-zh-residue-'))
}

// 辅助:写入 web 端 locale JSON(默认 target=web 路径)
function writeWebLocale(root, locale, obj) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'web')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${locale}.json`), JSON.stringify(obj, null, 2))
}

// 辅助:写入 extension 端 locale JSON
function writeExtensionLocale(root, locale, obj) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'extension')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${locale}.json`), JSON.stringify(obj, null, 2))
}

// 辅助:写入 README.<locale>.md
function writeReadme(root, locale, text) {
  writeFileSync(join(root, `README.${locale}.md`), text)
}

// 辅助:运行 scan-i18n-zh-residue.mjs(cwd 设为临时项目根)
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// 辅助:初始化 git 仓库(用于 --staged 测试)
function initGitRepo(root) {
  execSync('git init -b main', { cwd: root, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: root, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: root, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: root, stdio: 'pipe' })
}

describe('scan-i18n-zh-residue.mjs 集成测试', () => {

  // ─── 1. 用法:无 locale → exit 2 ─────────────────────────
  test('用法: 无 locale 参数 → exit 2 (用法错误)', () => {
    const root = createTempProject()
    try {
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 2, `无 locale 应 exit 2,实际 ${r.status}\nstderr: ${r.stderr}`)
      assert.match(r.stderr, /用法|<locale>/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 2. 文件不存在 → exit 1 ──────────────────────────────
  test('文件不存在: ko.json 未创建 → exit 1', () => {
    const root = createTempProject()
    try {
      const r = runScript(['ko'], { cwd: root })
      assert.equal(r.status, 1, `文件不存在应 exit 1,实际 ${r.status}`)
      assert.match(r.stderr, /文件不存在/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 3. ko (charRange): 纯韩文无中文 → exit 0 ─────────────
  test('ko: 纯韩文无中文 → exit 0', () => {
    const root = createTempProject()
    try {
      writeWebLocale(root, 'ko', { common: { save: '저장', cancel: '취소' } })
      const r = runScript(['ko'], { cwd: root })
      assert.equal(r.status, 0, `纯韩文应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
      assert.match(r.stdout, /✅.*无中文残留/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 4. ko (charRange): 纯中文残留 → exit 1 ──────────────
  test('ko: 纯中文残留(无韩文)→ exit 1', () => {
    const root = createTempProject()
    try {
      writeWebLocale(root, 'ko', { common: { save: '保存' } })
      const r = runScript(['ko'], { cwd: root })
      assert.equal(r.status, 1, `纯中文残留应 exit 1,实际 ${r.status}`)
      assert.match(r.stderr, /纯中文残留/)
      assert.match(r.stderr, /save/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 5. ko (charRange): 半翻译(韩文 + 中文)→ exit 0 (warn-only)
  test('ko: 半翻译(韩文 + 中文混合)→ exit 0 (warn-only)', () => {
    const root = createTempProject()
    try {
      writeWebLocale(root, 'ko', { common: { save: '저장 保存' } })
      const r = runScript(['ko'], { cwd: root })
      assert.equal(r.status, 0, `半翻译应 exit 0 (warn-only),实际 ${r.status}`)
      assert.match(r.stderr, /半翻译|warn/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 6. zh-TW (opencc): 全繁体无简体字残留 → exit 0 ───────
  test('zh-TW: 全繁体(時間/儲存)无简体字残留 → exit 0', () => {
    const root = createTempProject()
    try {
      writeWebLocale(root, 'zh-TW', { common: { time: '時間', save: '儲存' } })
      const r = runScript(['zh-TW'], { cwd: root })
      assert.equal(r.status, 0, `全繁体应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
      assert.match(r.stdout, /✅.*无中文残留/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 7. zh-TW (opencc): 含简体字 → exit 1 ────────────────
  test('zh-TW: 含简体字(时间 → 時間)→ exit 1 (简体字残留)', () => {
    const root = createTempProject()
    try {
      // "时间" 简体 → opencc 转 "時間" 繁体 → 字形变化 → 触发
      writeWebLocale(root, 'zh-TW', { common: { time: '时间' } })
      const r = runScript(['zh-TW'], { cwd: root })
      assert.equal(r.status, 1, `简体字残留应 exit 1,实际 ${r.status}`)
      assert.match(r.stderr, /简体字残留/)
      assert.match(r.stderr, /time/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 8. ja (warnOnly): 含日文汉字词 → exit 0 ─────────────
  test('ja: 含日文汉字词(登録)→ exit 0 (warnOnly,日文汉字词启发式不可靠)', () => {
    const root = createTempProject()
    try {
      writeWebLocale(root, 'ja', { common: { register: '登録' } })
      const r = runScript(['ja'], { cwd: root })
      assert.equal(r.status, 0, `ja warnOnly 应 exit 0,实际 ${r.status}`)
      assert.match(r.stderr, /warn-only|汉字残留/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 9. 默认 locale (未在 LOCALE_CONFIG): 无 localRe,任何汉字 → exit 1
  test('未配置 locale (vi): 含中文 → exit 1 (无 localRe,任何汉字视为纯残留)', () => {
    const root = createTempProject()
    try {
      writeWebLocale(root, 'vi', { common: { save: '保存' } })
      const r = runScript(['vi'], { cwd: root })
      assert.equal(r.status, 1, `未配置 locale 含汉字应 exit 1,实际 ${r.status}`)
      assert.match(r.stderr, /纯中文残留/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 10. 语言本名白名单:简体中文/日本語/繁體中文 → 跳过 ──
  test('白名单: 语言本名(简体中文/日本語/繁體中文)→ 跳过检测 exit 0', () => {
    const root = createTempProject()
    try {
      writeWebLocale(root, 'ko', {
        languages: {
          zhCN: '简体中文',
          ja: '日本語',
          zhTW: '繁體中文',
        },
      })
      const r = runScript(['ko'], { cwd: root })
      assert.equal(r.status, 0, `语言本名应跳过 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
      assert.match(r.stdout, /✅.*无中文残留/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 11. --target=extension 切换路径 ──────────────────────
  test('--target=extension: 切换到 extension/ko.json 路径(不扫 web/ko.json)', () => {
    const root = createTempProject()
    try {
      // extension/ko.json 含纯中文残留
      writeExtensionLocale(root, 'ko', { common: { save: '保存' } })
      // 同时写 web/ko.json 干净版本,验证不会被误扫
      writeWebLocale(root, 'ko', { common: { save: '저장' } })
      const r = runScript(['ko', '--target=extension'], { cwd: root })
      assert.equal(r.status, 1, `extension target 含中文应 exit 1,实际 ${r.status}`)
      assert.match(r.stderr, /纯中文残留/)
      assert.match(r.stderr, /extension\/ko\.json/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 12. --readme: 代码块(``` fence)内中文跳过 ──────────
  test('--readme: 代码块(``` fence)内中文跳过', () => {
    const root = createTempProject()
    try {
      writeReadme(root, 'ko', [
        '# README',
        '',
        '```js',
        'const x = "你好世界";', // 代码块内中文 → 跳过
        '```',
        '',
        'English text only.',
      ].join('\n'))
      const r = runScript(['ko', '--readme'], { cwd: root })
      assert.equal(r.status, 0, `代码块内中文应跳过 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
      assert.match(r.stdout, /✅.*无中文残留/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 13. --readme: ICP 备案号行级白名单跳过 ─────────────
  test('--readme: ICP 备案号行级白名单跳过', () => {
    const root = createTempProject()
    try {
      // ICP 备案号 "吉ICP备12345678号" 跨语言保留(简体/繁体均跳过)
      writeReadme(root, 'ko', [
        '# README',
        '',
        '吉ICP备12345678号',
        '',
        'English text only.',
      ].join('\n'))
      const r = runScript(['ko', '--readme'], { cwd: root })
      assert.equal(r.status, 0, `ICP 备案号应跳过 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
      assert.match(r.stdout, /✅.*无中文残留/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 14. --staged: 无 git repo → 跳过 exit 0 ─────────────
  test('--staged: 无 git repo → 跳过 exit 0', () => {
    const root = createTempProject()
    try {
      writeWebLocale(root, 'ko', { common: { save: '保存' } }) // 含违规
      // 无 git init → isFileStaged 返回 false → 跳过
      const r = runScript(['ko', '--staged'], { cwd: root })
      assert.equal(r.status, 0, `--staged 无 git 应跳过 exit 0,实际 ${r.status}`)
      assert.match(r.stdout, /跳过|未在暂存区/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 15. --staged: 文件已 staged → 触发扫描 exit 1 ───────
  test('--staged: ko.json 已 staged → 触发扫描 exit 1', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      writeWebLocale(root, 'ko', { common: { save: '保存' } }) // 纯中文残留
      execSync('git add packages/i18n/messages/web/ko.json', { cwd: root, stdio: 'pipe' })
      const r = runScript(['ko', '--staged'], { cwd: root })
      assert.equal(r.status, 1, `staged ko.json 含违规应 exit 1,实际 ${r.status}`)
      assert.match(r.stderr, /纯中文残留/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

})
