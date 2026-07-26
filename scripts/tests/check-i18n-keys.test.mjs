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
    assert.equal(r.status, 0, `--help 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
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
test('JSON 解析失败: ko.json 损坏(非基准)→ ko 被跳过,parity 不检查 ko', () => {
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
    // ko 解析失败 → ko 不在 langs 中 → parity 不检查 ko → exit 0(zh-TW/ja/en 都 OK)
    assert.equal(r.status, 0, `ko 解析失败应跳过 ko,parity 仍 OK,实际 ${r.status}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. JSON 重复 key(JSON.parse 静默取最后一个值) ─────
test('JSON 重复 key: JSON.parse 静默取最后一个值(脚本未显式检测重复 key)', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    // 手写 JSON 字符串含重复 key(save 出现两次)
    // JSON.parse 解析后 save = "저장2"(最后一个),与其他语言 parity 一致
    writeFileSync(
      join(dir, 'ko.json'),
      '{"common":{"save":"저장1","save":"저장2","cancel":"취소"},"nav":{"home":"홈"}}',
    )
    for (const lang of ['zh-CN', 'zh-TW', 'ja', 'en']) {
      writeFileSync(join(dir, `${lang}.json`), JSON.stringify(PARITY_OK[lang]))
    }
    const r = runScript(['--parity-only'], { cwd: root })
    // JSON.parse 静默处理重复 key,parity 校验基于解析后的对象 → exit 0
    // 注:脚本未显式检测重复 key,这是已知行为(AGENTS.md §19 要求手动 Grep 确认)
    assert.equal(r.status, 0, `重复 key 被 JSON.parse 静默处理,parity OK`)
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
    assert.equal(r.status, 0, `完整 5 语言 fixture parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
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
    assert.equal(r.status, 0, `shared+web 合并 parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
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
    assert.equal(r.status, 0, `staged JSON + parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
