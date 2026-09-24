// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-i18n-keys.mjs')

// ─── 辅助:创建临时项目根目录 ─────────────────────────────
function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'ihui-i18n-'))
}

// 辅助:写入 web messages(packages/i18n/messages/web/<lang>.json)
function writeWebMessages(root, msgs) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'web')
  mkdirSync(dir, { recursive: true })
  for (const [lang, content] of Object.entries(msgs)) {
    writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
  }
}

// 辅助:写入 shared messages
function writeSharedMessages(root, msgs) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'shared')
  mkdirSync(dir, { recursive: true })
  for (const [lang, content] of Object.entries(msgs)) {
    writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
  }
}

// 辅助:写入 extension messages
function writeExtensionMessages(root, msgs) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'extension')
  mkdirSync(dir, { recursive: true })
  for (const [lang, content] of Object.entries(msgs)) {
    writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
  }
}

// 辅助:创建空的 apps/web/src 目录(让 collectSourceFiles 找到 .ts 文件)
function createEmptyWebSource(root) {
  const dir = join(root, 'apps', 'web', 'src')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.ts'), 'export const x = 1\n')
}

// 辅助:初始化 git 仓库
function initGitRepo(root) {
  execSync('git init -b main', { cwd: root, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: root, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: root, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: root, stdio: 'pipe' })
}

// 辅助:运行 check-i18n-keys.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// 5 语言一致的 key 集合(zh-CN 为基准)
const PARITY_OK = {
  'zh-CN': { common: { save: '保存', cancel: '取消' }, nav: { home: '首页' } },
  'zh-TW': { common: { save: '儲存', cancel: '取消' }, nav: { home: '首頁' } },
  ko: { common: { save: '저장', cancel: '취소' }, nav: { home: '홈' } },
  ja: { common: { save: '保存', cancel: 'キャンセル' }, nav: { home: 'ホーム' } },
  en: { common: { save: 'Save', cancel: 'Cancel' }, nav: { home: 'Home' } },
}

// ─── 1. CLI --help ───────────────────────────────────────
test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const root = createTempProject()
  try {
    // 无 messages 目录 → 脚本输出 "messages 文件不存在或不完整,跳过" 并 exit 0
    const r = runScript(['--help'], { cwd: root })
    assert.equal(
      r.status,
      0,
      `--help 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 2. CLI --staged 模式(无 staged 文件 → 跳过) ────────
test('CLI: --staged 模式(无 staged 文件 → 跳过 exit 0)', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeWebMessages(root, PARITY_OK)
    // 不 stage 任何文件 → "无源文件变更,跳过"
    const r = runScript(['--staged'], { cwd: root })
    assert.equal(r.status, 0, `--staged 无 staged 文件应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /无源文件变更|跳过/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. CLI 无参数运行(默认全量检查) ───────────────────
test('CLI: 无参数运行(有 apps/web 源码 + parity OK → exit 0)', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK)
    createEmptyWebSource(root)
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `默认模式 parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /parity OK/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. 5 语言 parity 校验(一致 → 通过) ─────────────────
test('parity: 5 语言 key 集合一致 → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 0, `5 语言 parity 一致应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /parity OK/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. zh-CN 是基准语言 ────────────────────────────────
test('基准: zh-CN 是基准语言(其他 4 语言对比 zh-CN)', () => {
  const root = createTempProject()
  try {
    // ko 缺失 common.save(zh-CN 有)→ base-only 命中
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    delete msgs.ko.common.save
    writeWebMessages(root, msgs)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 1, `ko 缺失 zh-CN 的 key 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /zh-CN 有但 ko 缺失/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. 缺失 key 检测(zh-CN 有,ko 缺失) ────────────────
test('缺失 key: zh-CN 有 common.save,ko 缺失 → exit 1 (base-only)', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    delete msgs.ko.common.save
    writeWebMessages(root, msgs)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 1)
    assert.match(r.stdout, /base-only|zh-CN 有但 ko 缺失/)
    assert.match(r.stdout, /common\.save/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. 多余 key 检测(ko 有,zh-CN 没有) ────────────────
test('多余 key: ko 有 common.extra,zh-CN 没有 → exit 1 (lang-only)', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    msgs.ko.common.extra = '추가'
    writeWebMessages(root, msgs)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 1)
    assert.match(r.stdout, /lang-only|ko 有但 zh-CN 无/)
    assert.match(r.stdout, /common\.extra/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. 白名单机制(脚本无白名单,parity 严格检查) ───────
test('白名单: 脚本无白名单机制,所有 key 严格 parity 检查', () => {
  const root = createTempProject()
  try {
    // 即使是 "common.technical" 这种看起来像技术术语的 key,也必须 parity
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    msgs['zh-CN'].common.technical = '技术'
    // ko 不加这个 key → 应该报 base-only(无白名单跳过)
    writeWebMessages(root, msgs)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 1, `无白名单机制,任何 key 缺失都应 exit 1`)
    assert.match(r.stdout, /common\.technical/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. JSON 解析失败(zh-CN 基准损坏 → 跳过) ───────────
test('JSON 解析失败: zh-CN.json 损坏 → exit 0(messages 不完整,跳过)', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    // zh-CN.json 是损坏的 JSON(trailing comma)
    writeFileSync(join(dir, 'zh-CN.json'), '{ "common": { "save": "保存", } }')
    for (const lang of ['zh-TW', 'ko', 'ja', 'en']) {
      writeFileSync(join(dir, `${lang}.json`), JSON.stringify(PARITY_OK[lang]))
    }
    const r = runScript(['--parity-only'], { cwd: root })
    // zh-CN 解析失败 → messages[BASE_LANG] 不存在 → exit 0 "messages 文件不存在或不完整,跳过"
    assert.equal(r.status, 0, `zh-CN 解析失败应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /不存在或不完整|跳过/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9b. JSON 解析失败(非基准语言损坏 → 该语言被跳过) ──
test('JSON 解析失败: ko.json 损坏(非基准)⇒ 判红并点名(旧政策"跳过该语言"就是假绿)', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'zh-CN.json'), JSON.stringify(PARITY_OK['zh-CN']))
    // ko 损坏
    writeFileSync(join(dir, 'ko.json'), '{ broken json }')
    for (const lang of ['zh-TW', 'ja', 'en']) {
      writeFileSync(join(dir, `${lang}.json`), JSON.stringify(PARITY_OK[lang]))
    }
    const r = runScript(['--parity-only'], { cwd: root })
    // 本门在 2026-09-24 把"读不出即跳过"改成"读不出即判红"(脚本第 213 行注释记着变异实测:
    // 一个拼错的 revspec 让五语言变四语言而全绿)。旧断言"exit 0 + 跳过 ko"编码的正是
    // 那个被堵掉的假绿 —— 少一门就少一门的漏检,绝不能算通过。
    assert.equal(r.status, 1, `ko 读不出必须判红,实际 ${r.status}\n${r.stdout}`)
    const out = `${r.stdout}\n${r.stderr}`
    assert.match(out, /读不出来/, '应说明是"读不出"而非普通 parity 差异')
    assert.match(out, /拒绝当作通过/, '结论行必须明写不记为通过')
    assert.match(out, /ko/, '必须点名是哪一门')
    // 变异对照:把 ko 修好即应绿 ⇒ 证明上面那枚红确实是"读不出"造成的,不是夹具恒红
    writeFileSync(join(dir, 'ko.json'), JSON.stringify(PARITY_OK['ko']))
    const ok = runScript(['--parity-only'], { cwd: root })
    assert.equal(ok.status, 0, `ko 修好后应通过(否则本用例是空判据):\n${ok.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. JSON 重复 key(AGENTS.md §18 禁止;2026-09-20 起本脚本显式检测) ─────
test('JSON 重复 key: 同层两个同名 key → exit 1(前值被 JSON.parse 静默遮蔽)', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    // 手写 JSON 字符串含重复 key(save 出现两次)
    // JSON.parse 解析后 save = "저장2"(最后一个),flatten 式 parity 看起来"一致",
    // 但 저장1 已经静默丢失 —— 这正是 §18 禁止重复 key 的原因,故必须显式拦。
    writeFileSync(
      join(dir, 'ko.json'),
      '{"common":{"save":"저장1","save":"저장2","cancel":"취소"},"nav":{"home":"홈"}}',
    )
    for (const lang of ['zh-CN', 'zh-TW', 'ja', 'en']) {
      writeFileSync(join(dir, `${lang}.json`), JSON.stringify(PARITY_OK[lang]))
    }
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 1, `同层重复 key 应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /重复 key/, `应报告重复 key 问题,stdout: ${r.stdout}`)
    assert.match(r.stdout, /common\.save/, `应点名重复键路径,stdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. 空 JSON 文件({}) ──────────────────────────────
test('空 JSON: {} → 无 leaf key,5 语言一致 → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, {
      'zh-CN': {},
      'zh-TW': {},
      ko: {},
      ja: {},
      en: {},
    })
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 0, `空 JSON 5 语言一致应 exit 0,实际 ${r.status}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. 完整 5 语言文件 fixture(嵌套结构) ──────────────
test('fixture: 完整 5 语言文件(zh-CN/zh-TW/ko/ja/en)嵌套 parity OK', () => {
  const root = createTempProject()
  try {
    // 嵌套结构,多命名空间
    const msgs = {
      'zh-CN': {
        common: { save: '保存', cancel: '取消', delete: '删除' },
        nav: { home: '首页', settings: '设置' },
        models: { user: { name: '用户名', email: '邮箱' } },
      },
      'zh-TW': {
        common: { save: '儲存', cancel: '取消', delete: '刪除' },
        nav: { home: '首頁', settings: '設定' },
        models: { user: { name: '使用者名稱', email: '電子郵件' } },
      },
      ko: {
        common: { save: '저장', cancel: '취소', delete: '삭제' },
        nav: { home: '홈', settings: '설정' },
        models: { user: { name: '사용자 이름', email: '이메일' } },
      },
      ja: {
        common: { save: '保存', cancel: 'キャンセル', delete: '削除' },
        nav: { home: 'ホーム', settings: '設定' },
        models: { user: { name: 'ユーザー名', email: 'メール' } },
      },
      en: {
        common: { save: 'Save', cancel: 'Cancel', delete: 'Delete' },
        nav: { home: 'Home', settings: 'Settings' },
        models: { user: { name: 'Username', email: 'Email' } },
      },
    }
    writeWebMessages(root, msgs)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(
      r.status,
      0,
      `完整 5 语言 fixture parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
    assert.match(r.stdout, /parity OK/)
    // 验证检查了 5 语言
    assert.match(r.stdout, /5 语言/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. --target=extension 切换到 extension messages ──
test('--target=extension: 切换到 extension messages 目录', () => {
  const root = createTempProject()
  try {
    // 创建 extension messages(不创建 web messages)
    writeExtensionMessages(root, PARITY_OK)
    // --target=extension → 读 extension 目录,不读 web
    const r = runScript(['--target=extension', '--parity-only'], { cwd: root })
    assert.equal(r.status, 0, `extension target parity OK 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /\[extension\]/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. --target=shared 切换到 shared messages ─────────
test('--target=shared: 切换到 shared messages 目录', () => {
  const root = createTempProject()
  try {
    writeSharedMessages(root, PARITY_OK)
    const r = runScript(['--target=shared', '--parity-only'], { cwd: root })
    assert.equal(r.status, 0, `shared target parity OK 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /\[shared\]/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 15. shared + web 合并(方案 A) ────────────────────
test('合并: shared 有 common.save,web 无 → 合并后 parity OK', () => {
  const root = createTempProject()
  try {
    // shared 有 common.save
    writeSharedMessages(root, {
      'zh-CN': { common: { save: '保存' } },
      'zh-TW': { common: { save: '儲存' } },
      ko: { common: { save: '저장' } },
      ja: { common: { save: '保存' } },
      en: { common: { save: 'Save' } },
    })
    // web 有 nav.home(shared 没有)
    writeWebMessages(root, {
      'zh-CN': { nav: { home: '首页' } },
      'zh-TW': { nav: { home: '首頁' } },
      ko: { nav: { home: '홈' } },
      ja: { nav: { home: 'ホーム' } },
      en: { nav: { home: 'Home' } },
    })
    // web 模式:shared + web 合并 → common.save + nav.home 都在合并集中
    // 5 语言合并集一致 → parity OK
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(
      r.status,
      0,
      `shared+web 合并 parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 16. --staged + staged JSON 文件触发 parity ─────────
test('--staged: staged messages JSON → 触发 parity 检查', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeWebMessages(root, PARITY_OK)
    // stage JSON 文件
    execSync('git add packages/i18n/messages/web/', { cwd: root, stdio: 'pipe' })
    const r = runScript(['--staged'], { cwd: root })
    // staged JSON → messagesChanged = true → 跑 parity → exit 0
    assert.equal(
      r.status,
      0,
      `staged JSON + parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 17. 源码引用缺失键 → blocking(2026-08-20 收紧为硬性契约) ─
test('缺失键阻塞: 源码 useTranslations 引用未定义 key → exit 1', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK)
    // 创建源码文件,引用 common.tools 命名空间下未定义的 key
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "const t = useTranslations('common.tools')\nt('categoryEfficiency')\n",
    )
    // 全量模式: 扫描到缺失键 → 应 exit 1(此前只 warning exit 0)
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `源码引用缺失键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /categoryEfficiency/)
    assert.match(r.stdout, /拒绝提交|缺失键问题/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 18. 源码缺键补齐后 → 通过(防回归:补齐即恢复绿色) ────
test('缺失键通关: 补齐消息定义后同源码 → exit 0', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    for (const lang of Object.keys(msgs)) {
      msgs[lang].common.tools = { categoryEfficiency: '효율' }
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "const t = useTranslations('common.tools')\nt('categoryEfficiency')\n",
    )
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `补齐消息定义后应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 19. 含点键检测(next-intl 按 "." 解析路径,字面含点 key 永不渲染) ───
// 真实事故:web 语言包 84 个含点键,en/ko 各 22 个在 UI 上回显成原始键名(subAgentFeed.lane.*
// / agentHooks.event.* / integrations.event.*),而 flatten 式 parity 守门全绿看不出问题。
test('含点键: 顶层含点 key → exit 1 且提示改写为嵌套', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    for (const lang of Object.keys(msgs)) {
      msgs[lang].common['lane.architect'] = 'Architect'
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "const t = useTranslations('common')\nt('lane.architect')\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 1, `含点键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /含点键/, `应报告含点键问题,stdout: ${r.stdout}`)
    assert.match(r.stdout, /lane\.architect/, `应点名具体键,stdout: ${r.stdout}`)
    assert.match(r.stdout, /改写为嵌套/, `应给出修复方法,stdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('含点键: 等价的嵌套结构 → exit 0(不误报)', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    for (const lang of Object.keys(msgs)) {
      msgs[lang].common.lane = { architect: 'Architect' }
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "const t = useTranslations('common')\nt('lane.architect')\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `嵌套写法不应误报,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 22. 同层重复 key(AGENTS.md §18:JSON.parse 静默保留最后一个,§18 此前无闸门)─────
// 真实触发场景:给含点键补嵌套时,同层若已有真身嵌套块就会造出重复 key,
// flatten 式 parity 检查按路径集合比对看不出"前面的值被后面覆盖"。
test('同层重复 key: 同一对象内两个同名 key → exit 1 并点名路径与行号', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    // 手写原文(不能用 JSON.stringify 生成,它无法产出重复 key)
    const withDup = {
      'zh-CN': {
        common: { save: '保存', cancel: '取消' },
        nav: { home: '首页' },
      },
      'zh-TW': PARITY_OK['zh-TW'],
      ko: PARITY_OK.ko,
      ja: PARITY_OK.ja,
      en: PARITY_OK.en,
    }
    for (const [lang, content] of Object.entries(withDup)) {
      if (lang === 'zh-CN') {
        writeFileSync(
          join(dir, 'zh-CN.json'),
          '{\n  "common": {\n    "save": "保存",\n    "cancel": "取消"\n  },\n  "nav": {\n    "home": "首页",\n    "home": "首頁"\n  }\n}\n',
        )
      } else {
        writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
      }
    }
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(srcDir, 'page.tsx'), "const t = useTranslations('nav')\nt('home')\n")
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 1, `同层重复 key 应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /重复 key/, `应报告重复 key 问题,stdout: ${r.stdout}`)
    assert.match(r.stdout, /nav\.home/, `应点名重复键路径,stdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('同层重复 key: 不同层的同名 key 不算重复(不误报)', () => {
  const root = createTempProject()
  try {
    // PARITY_OK 里 zh-CN/zh-TW/ja 的 save/cancel 值相同但分层不同;这里显式构造跨层同名
    const msgs = {}
    for (const lang of Object.keys(PARITY_OK)) {
      msgs[lang] = {
        common: { save: PARITY_OK[lang].common.save, cancel: PARITY_OK[lang].common.cancel },
        nav: { home: PARITY_OK[lang].nav.home, common: { save: 'sub' } },
      }
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(srcDir, 'page.tsx'), "const t = useTranslations('nav')\nt('home')\n")
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `跨层同名 key 不应误报,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('动态键: 点分隔前缀在某语言不是对象 → exit 1(今晚 44 处回显键名的那一类)', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    for (const lang of Object.keys(PARITY_OK)) {
      const msgs = JSON.parse(JSON.stringify(PARITY_OK[lang]))
      // 4 种语言给正确的嵌套 lane,en 故意只留扁平含点键(即缺陷原貌)
      if (lang === 'en') msgs.common['lane.architect'] = 'Architect'
      else msgs.common.lane = { architect: 'A' }
      writeFileSync(join(dir, `${lang}.json`), JSON.stringify(msgs, null, 2))
    }
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'feed.tsx'),
      "const t = useTranslations('common')\n{t(`lane.${k}`)}\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 1, `前缀不可达应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /静态前缀/, `应报告静态前缀问题,stdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('动态键: 点分隔前缀在五语言都是对象 → exit 0(不误报)', () => {
  const root = createTempProject()
  try {
    const msgs = {}
    for (const lang of Object.keys(PARITY_OK)) {
      msgs[lang] = {
        ...PARITY_OK[lang],
        common: { ...PARITY_OK[lang].common, lane: { architect: 'A' } },
      }
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'feed.tsx'),
      "const t = useTranslations('common')\n{t(`lane.${k}`)}\n{t('lane.architect')}\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `前缀可达不应误报,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// 全仓实测:10 处"疑似违规"全部来自 JSDoc 注释里的历史说明
// ("i18n 静态映射表 — 用于消除 t(`status.${var}`) 动态拼接"),必须先去注释再判定,
// 否则这条 blocking 规则会全线误拦。
test('动态键: 仅出现在注释里的拼接示例不得报警(去注释回归)', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "/** i18n 静态映射表 — 用于消除 `t(`status.${var}`)` 动态拼接 */\nconst t = useTranslations('common')\nt('save')\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `注释里的示例不应触发,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(!/静态前缀/.test(r.stdout), `不应报静态前缀,stdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── miniapp-taro 端 hook 形态识别(2026-09-21 补盲)─────────────────
// 背景:extractHookKeys 旧版只匹配"解构且 `{` 后紧跟 t|tt 且立刻 `}`",
// 于是 `const tt = useTt()`(实测 miniapp-taro 155 文件)和
// `const { t, tList } = useI18n()`(实测 14 处)整体不匹配 —— 这些文件的
// 引用键一个都没被查过。useTt 在"值===键"时回退内联简体中文,所以缺键在
// en/ko/ja/zh-TW 下恒显示简体,是真实用户可见缺陷(非洁癖问题)。
function writeTaroMessages(root, msgs) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'miniapp-taro')
  mkdirSync(dir, { recursive: true })
  for (const [lang, content] of Object.entries(msgs)) {
    writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
  }
}

function writeTaroSource(root, name, body) {
  const dir = join(root, 'apps', 'miniapp-taro', 'src', 'pages', 'login')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), body)
}

// 5 语言 key 集合一致、且只含 login.save / login.title 的基准词典
const TARO_OK = {
  'zh-CN': { login: { save: '保存', title: '登录' } },
  'zh-TW': { login: { save: '儲存', title: '登入' } },
  ko: { login: { save: '저장', title: '로그인' } },
  ja: { login: { save: 'ストック', title: 'ログイン' } },
  en: { login: { save: 'Save', title: 'Login' } },
}

test('useTt: const tt = useTt() 的缺键必须检出(旧版整文件漏检)', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const { t } = useI18n()\nconst tt = useTt()\n{tt('login.email', '邮箱')}\n{tt('login.save', '保存')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 1, `tt() 引用缺键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /login\.email/, `报告应点名 login.email,stdout: ${r.stdout}`)
    assert.ok(!/login\.save/.test(r.stdout), '已存在的 login.save 不该被列为缺失')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('useTt: 键齐全时 exit 0(补齐即转绿,不放宽规则)', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const { t } = useI18n()\nconst tt = useTt()\n{tt('login.save', '保存')}\n{tt('login.title', '登录')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 0, `键齐全应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /miniapp-taro/, `应实际扫描 miniapp-taro,stdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('多键解构: const { t, tList } = useI18n() 的 t() 引用不得漏检', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const { t, tList } = useI18n()\n{t('login.ghost')}\n{tList('login.save')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 1, `多键解构的缺键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /login\.ghost/, `报告应点名 login.ghost,stdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// 补齐即转绿:同一多键解构文件把 login.ghost 补进 5 语言词典 → exit 0。
// (与上一条配对,证明"检出"不是靠放宽规则凑出来的红。)
test('多键解构: 补齐缺失键后 exit 0', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(TARO_OK))
    for (const lang of Object.keys(msgs)) msgs[lang].login.ghost = '幽灵键'
    writeTaroMessages(root, msgs)
    writeTaroSource(
      root,
      'login.tsx',
      "const { t, tList } = useI18n()\n{t('login.ghost')}\n{tList('login.save')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 0, `补齐后应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// tf 别名:miniapp-taro 端把 useTt() 的返回值命名为 tt 之外的名字(实测 tf / tx 变体)。
// 直接赋值形态必须按"任意变量名"识别,否则该文件整体漏检 —— 与 tt 同构的锁死用例。
test('tf 别名: const tf = useTt() 的缺键必须检出', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const tf = useTt()\n{tf('login.email', '邮箱')}\n{tf('login.save', '保存')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 1, `tf() 引用缺键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /login\.email/, `报告应点名 login.email,stdout: ${r.stdout}`)
    assert.ok(!/login\.save\b/.test(r.stdout), '已存在的 login.save 不该被列为缺失')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('tf 别名: 键齐全时 exit 0(补齐即转绿,不放宽规则)', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const tf = useTt()\n{tf('login.save', '保存')}\n{tf('login.title', '登录')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 0, `tf() 键齐全应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// 扩视野必须"只扩真翻译函数":useTts 是 text-to-speech,不是翻译 hook。
// 若被当成 t/tt 绑定,全仓 web 端相关写法会被误扫 → 该用例锁死不误报。
test('不误报: const tts = useTts() 不得被识别为翻译函数绑定', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const tts = useTts()\n{tts('login.notAKey')}\n{tt('login.save')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 0, `useTts 不应产生缺失键,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(!/login\.notAKey/.test(r.stdout), `useTts 的参数不该被查,stdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// 扩视野后 miniapp-taro 受检文件从 91 涨到 212,注释里的示例也会被扫到。
// 真实事故形态:并行会话在源码里写了
//   // 禁止 "…后重" + tt('p1','发') 这种把词劈成两半的拼接
// 该 `tt('p1', …)` 是文档注释,不是引用 → 必须先去注释再提键,否则 blocking 规则误拦。
test('不误报: tt() 仅出现在注释里的示例键不得被检出(去注释回归)', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const tt = useTt()\n// 禁止劈词拼接 tt('login.ghost', '发')\n/* 块注释里也不查 tt('login.phantom') */\n{tt('login.save', '保存')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 0, `注释里的键不该触发缺失,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(!/login\.ghost/.test(r.stdout), `行注释示例不该被检出,stdout: ${r.stdout}`)
    assert.ok(!/login\.phantom/.test(r.stdout), `块注释示例不该被检出,stdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('含点键: 深层嵌套内部含点 key 也要检出(递归覆盖)', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    for (const lang of Object.keys(msgs)) {
      // 真实事故形态:ai.subAgentFeed 之下再挂含点键
      msgs[lang].common.deep = { event: { 'tool.before': 'Before tool call' }, list: ['a', 'b'] }
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "const t = useTranslations('common.deep')\nt('event.tool.before')\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 1, `深层含点键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /common\.deep/, `报告应带父路径,stdout: ${r.stdout}`)
    assert.match(r.stdout, /tool\.before/, `应点名深层含点键,stdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
