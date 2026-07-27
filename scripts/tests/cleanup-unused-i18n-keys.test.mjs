/**
 * @file cleanup-unused-i18n-keys.mjs 回归测试
 * @description 覆盖 scripts/cleanup-unused-i18n-keys.mjs 核心规则:
 *   1. CLI 入口:--target=value / --target value(默认 web)/ --dry-run 预览不写
 *   2. 退出码:成功 → exit 0;缺失语言文件 → exit 1(readFileSync 抛错)
 *   3. WEB_DELETE_RULES:
 *      - ['audit', null]:subPath=null → 删除整个顶层命名空间,deleted += countLeaves(sub)
 *      - ['help', 'faq']:deepDelete(data, 'help.faq'),deleted += 1(不论 faq 内 leaf 数)
 *      - ['chat', 'permission.autoRevertedDesc']:deepDelete,deleted += 1
 *   4. MINIAPP_DELETE_RULES:7 个 subPath 规则(common.search / nav.{chat,agents,orders,wallet,settings} / chat.newConversation)
 *   5. deepDelete 规则:
 *      - 中间段非对象 → 返回 false,不删除
 *      - lastKey 不存在 → 返回 false
 *      - 成功删除 → 返回 true
 *   6. countLeaves 规则:数组/null/原始值计为 1,空对象 {} 计为 1,对象递归
 *   7. 跳过日志:顶层不存在 → "跳过:顶层 X 不存在";子路径不存在 → "跳过:X 不存在"
 *   8. 写回格式:JSON.stringify(obj, null, 2) + '\n',UTF-8 无 BOM(非 dry-run)
 *   9. 汇总输出:[target=X] [DRY-RUN] 共删除 N 个 key,5 语言 leaf 总数 X → Y
 *  10. 幂等性:第二次运行全部跳过,deleted=0
 *
 * 与 cleanup-i18n-unused-keys.mjs 的差异:本脚本用硬编码 DELETE_RULES(无需清单文件),
 *    按 --target 切换 WEB/MINIAPP 规则;cleanup-i18n-unused-keys.mjs 用 --list 清单文件。
 * 与 cleanup-orphan-i18n-keys.mjs 的差异:本脚本只删 web/miniapp-taro 2 端,
 *    cleanup-orphan-i18n-keys.mjs 删 web 1 端的固定 27 个 key。
 *
 * 测试策略:脚本用 __dirname 推导 ROOT(无法用 cwd 重定向),
 * 把源脚本 copy 到 tmpRoot/scripts/ 下运行,fixture 完全隔离不污染项目。
 * 路径推导用 import.meta.url(AGENTS.md §15)。
 */
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ORIGINAL_SCRIPT = path.resolve(__dirname, '..', 'cleanup-unused-i18n-keys.mjs')

const LOCALES = ['zh-CN', 'zh-TW', 'ko', 'ja', 'en']

let tmpRoot

// ─── 辅助:创建临时项目根目录,copy 源脚本到 tmpRoot/scripts/(只读不改源) ───
function createTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cleanup-unused-i18n-'))
  const tmpScriptsDir = path.join(root, 'scripts')
  fs.mkdirSync(tmpScriptsDir, { recursive: true })
  fs.copyFileSync(ORIGINAL_SCRIPT, path.join(tmpScriptsDir, 'cleanup-unused-i18n-keys.mjs'))
  return root
}

// ─── 辅助:为指定 target 写入 5 语言文件(默认所有 lang 同内容) ───
function writeAllLangs(root, target, baseObj, langOverrides = {}) {
  const dir = path.join(root, 'packages', 'i18n', 'messages', target)
  fs.mkdirSync(dir, { recursive: true })
  for (const lang of LOCALES) {
    const obj = langOverrides[lang] !== undefined ? langOverrides[lang] : baseObj
    fs.writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify(obj, null, 2), 'utf8')
  }
}

// ─── 辅助:仅写入指定 target 的指定 lang 文件 ───
function writeLang(root, target, lang, obj) {
  const dir = path.join(root, 'packages', 'i18n', 'messages', target)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify(obj, null, 2), 'utf8')
}

// ─── 辅助:运行脚本(子进程,cwd=tmpRoot) ───
function runCli(args = []) {
  const scriptPath = path.join(tmpRoot, 'scripts', 'cleanup-unused-i18n-keys.mjs')
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: tmpRoot,
    encoding: 'utf8',
    timeout: 30000,
  })
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

// ─── 辅助:读取 target 的 lang 文件(对象) ───
function readLang(root, target, lang) {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'packages', 'i18n', 'messages', target, `${lang}.json`), 'utf8'),
  )
}

// ─── 辅助:读取 target 的 lang 文件原始字符串 ───
function readLangRaw(root, target, lang) {
  return fs.readFileSync(path.join(root, 'packages', 'i18n', 'messages', target, `${lang}.json`), 'utf8')
}

before(() => {
  tmpRoot = createTempProject()
})

after(() => {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch { /* 清理失败不影响结果 */ }
})

// 每个测试前清空 packages/ 内容,保证隔离
beforeEach(() => {
  const pkgsDir = path.join(tmpRoot, 'packages')
  if (fs.existsSync(pkgsDir)) {
    fs.rmSync(pkgsDir, { recursive: true, force: true })
  }
})

// ─── 完整 WEB fixture(audit 2 leaves + help.faq 2 数组 + chat.permission.autoRevertedDesc) ───
function fullWebFixture() {
  return {
    audit: { a: 'v1', b: 'v2' },
    help: {
      faq: { account: ['q1', 'q2'], payment: ['p1'] },
      title: 'keep-title',
      subtitle: 'keep-sub',
    },
    chat: {
      permission: { autoRevertedDesc: 'del', autoRevertedDescWithDuration: 'keep' },
    },
    other: 'keep',
  }
}

// ─── 完整 MINIAPP fixture(7 个待删 key + 兄弟保留) ───
function fullMiniappFixture() {
  return {
    common: { search: 'del', keep: 'k' },
    nav: { chat: 'del', agents: 'del', orders: 'del', wallet: 'del', settings: 'del', keep: 'k' },
    chat: { newConversation: 'del', keep: 'k' },
  }
}

describe('CLI 入口与退出码', () => {
  test('场景 1:默认 web + 5 语言齐全 + 完整规则 → exit 0,删除 audit/help.faq/chat.permission.autoRevertedDesc', () => {
    writeAllLangs(tmpRoot, 'web', fullWebFixture())
    const r = runCli()
    assert.equal(r.status, 0, '成功处理应 exit 0')
    // audit 整体删除(2 leaves)
    assert.match(r.stdout, /\[zh-CN\] 删除顶层 "audit" \(2 个 leaf key\)/, '应删除 audit 顶层(2 leaves)')
    // help.faq 子对象删除
    assert.match(r.stdout, /\[zh-CN\] 删除 "help\.faq"/, '应删除 help.faq')
    // chat.permission.autoRevertedDesc 单 key 删除
    assert.match(r.stdout, /\[zh-CN\] 删除 "chat\.permission\.autoRevertedDesc"/, '应删除 chat.permission.autoRevertedDesc')
    // 每语言 deleted=4(2 audit + 1 help.faq + 1 chat.permission.autoRevertedDesc)
    assert.match(r.stdout, /\[zh-CN\] 删除 4 个 key/, 'zh-CN 应删除 4 个 key')
    // 汇总:5 语言 × 4 = 20
    assert.match(r.stdout, /汇总:\[target=web\] 共删除 20 个 key/, '汇总应为 5×4=20')
    // 5 语言结果一致
    for (const lang of LOCALES) {
      assert.deepEqual(
        readLang(tmpRoot, 'web', lang),
        {
          help: { title: 'keep-title', subtitle: 'keep-sub' },
          chat: { permission: { autoRevertedDescWithDuration: 'keep' } },
          other: 'keep',
        },
        `${lang} 结果应正确(audit 删,help.faq 删,chat.permission.autoRevertedDesc 删)`,
      )
    }
  })

  test('场景 2:--target=miniapp-taro(等号形式)→ exit 0,MINIAPP 规则删 7 个 key', () => {
    writeAllLangs(tmpRoot, 'miniapp-taro', fullMiniappFixture())
    const r = runCli(['--target=miniapp-taro'])
    assert.equal(r.status, 0, '--target= 等号形式应 exit 0')
    // 7 个 key 各打印一条删除日志
    assert.match(r.stdout, /\[zh-CN\] 删除 "common\.search"/, '应删除 common.search')
    assert.match(r.stdout, /\[zh-CN\] 删除 "nav\.chat"/, '应删除 nav.chat')
    assert.match(r.stdout, /\[zh-CN\] 删除 "nav\.agents"/, '应删除 nav.agents')
    assert.match(r.stdout, /\[zh-CN\] 删除 "nav\.orders"/, '应删除 nav.orders')
    assert.match(r.stdout, /\[zh-CN\] 删除 "nav\.wallet"/, '应删除 nav.wallet')
    assert.match(r.stdout, /\[zh-CN\] 删除 "nav\.settings"/, '应删除 nav.settings')
    assert.match(r.stdout, /\[zh-CN\] 删除 "chat\.newConversation"/, '应删除 chat.newConversation')
    // 每语言 deleted=7
    assert.match(r.stdout, /\[zh-CN\] 删除 7 个 key/, 'zh-CN 应删除 7 个 key')
    // 汇总:5 × 7 = 35
    assert.match(r.stdout, /汇总:\[target=miniapp-taro\] 共删除 35 个 key/, '汇总应为 5×7=35')
    // 结果验证:每个父对象保留 keep
    for (const lang of LOCALES) {
      assert.deepEqual(
        readLang(tmpRoot, 'miniapp-taro', lang),
        {
          common: { keep: 'k' },
          nav: { keep: 'k' },
          chat: { keep: 'k' },
        },
        `${lang} miniapp-taro 结果应只剩 keep`,
      )
    }
  })

  test('场景 3:--target miniapp-taro(空格形式)→ 等价于等号形式,exit 0', () => {
    writeAllLangs(tmpRoot, 'miniapp-taro', fullMiniappFixture())
    const r = runCli(['--target', 'miniapp-taro'])
    assert.equal(r.status, 0, '--target 空格形式应 exit 0')
    assert.match(r.stdout, /汇总:\[target=miniapp-taro\] 共删除 35 个 key/, '空格形式应与等号形式等价')
  })

  test('场景 4:--dry-run → exit 0,文件不被修改,stdout 含 [DRY-RUN]', () => {
    const initial = fullWebFixture()
    writeAllLangs(tmpRoot, 'web', initial)
    const r = runCli(['--dry-run'])
    assert.equal(r.status, 0, '--dry-run 应 exit 0')
    assert.match(r.stdout, /\[DRY-RUN\]/, 'stdout 应含 [DRY-RUN] 标记')
    assert.match(r.stdout, /汇总:\[target=web\] \[DRY-RUN\] 共删除 20 个 key/, '汇总行应含 [DRY-RUN] 前缀')
    // 文件未被修改(5 语言均保持原样)
    for (const lang of LOCALES) {
      assert.deepEqual(readLang(tmpRoot, 'web', lang), initial, `${lang} 文件不应被修改`)
    }
  })

  test('场景 5:缺失某语言文件 → exit 1(readFileSync 抛错)', () => {
    // 只写 4 个语言,缺 en.json
    for (const lang of ['zh-CN', 'zh-TW', 'ko', 'ja']) {
      writeLang(tmpRoot, 'web', lang, fullWebFixture())
    }
    const r = runCli()
    assert.equal(r.status, 1, '缺失语言文件应 exit 1')
    assert.match(r.stderr, /ENOENT/, 'stderr 应含 ENOENT 错误')
    assert.match(r.stderr, /en\.json/, 'stderr 应提及 en.json')
  })
})

describe('WEB 删除规则(WEB_DELETE_RULES)', () => {
  test('场景 6:audit 整体删除(subPath=null)→ deleted += countLeaves(audit sub-tree)', () => {
    // audit 含 3 个 leaf(a/b/c),应为整体删除并计 3
    writeAllLangs(tmpRoot, 'web', { audit: { a: 'v1', b: 'v2', c: 'v3' }, keep: 'k' })
    const r = runCli()
    assert.equal(r.status, 0)
    assert.match(r.stdout, /\[zh-CN\] 删除顶层 "audit" \(3 个 leaf key\)/, '应删除 audit 3 个 leaf')
    assert.match(r.stdout, /\[zh-CN\] 删除 3 个 key,leaf 总数 4 → 1/, 'leaf 总数应 4 → 1')
    // help / chat 不存在 → 跳过日志
    assert.match(r.stdout, /\[zh-CN\] 跳过:顶层 "help" 不存在/, 'help 不存在应跳过')
    assert.match(r.stdout, /\[zh-CN\] 跳过:顶层 "chat" 不存在/, 'chat 不存在应跳过')
    // 结果:audit 整体删除,keep 保留
    for (const lang of LOCALES) {
      assert.deepEqual(readLang(tmpRoot, 'web', lang), { keep: 'k' }, `${lang} 应只剩 keep`)
    }
  })

  test('场景 7:help.faq 子对象删除 + help 其他 key 保留(title/subtitle)', () => {
    writeAllLangs(tmpRoot, 'web', {
      help: {
        faq: { account: ['q1'], payment: ['p1'], project: ['x'] },
        title: 'keep-title',
        subtitle: 'keep-sub',
      },
    })
    const r = runCli()
    assert.equal(r.status, 0)
    assert.match(r.stdout, /\[zh-CN\] 删除 "help\.faq"/, '应删除 help.faq')
    // help.faq 规则 deleted += 1(不论 faq 内有多少 leaf)
    assert.match(r.stdout, /\[zh-CN\] 删除 1 个 key/, 'zh-CN deleted 应为 1')
    // help.title / help.subtitle 保留
    for (const lang of LOCALES) {
      assert.deepEqual(
        readLang(tmpRoot, 'web', lang),
        { help: { title: 'keep-title', subtitle: 'keep-sub' } },
        `${lang} help 应保留 title/subtitle`,
      )
    }
  })

  test('场景 8:chat.permission.autoRevertedDesc 单 key 删除 + 兄弟 key 保留', () => {
    writeAllLangs(tmpRoot, 'web', {
      chat: {
        permission: {
          autoRevertedDesc: 'del',
          autoRevertedDescWithDuration: 'keep-duration',
          other: 'keep-other',
        },
      },
    })
    const r = runCli()
    assert.equal(r.status, 0)
    assert.match(r.stdout, /\[zh-CN\] 删除 "chat\.permission\.autoRevertedDesc"/, '应删除单 key')
    assert.match(r.stdout, /\[zh-CN\] 删除 1 个 key/, 'zh-CN deleted 应为 1')
    // 兄弟 key 保留,chat.permission 不被 over-prune(本脚本不 prune 空父)
    for (const lang of LOCALES) {
      assert.deepEqual(
        readLang(tmpRoot, 'web', lang),
        {
          chat: {
            permission: {
              autoRevertedDescWithDuration: 'keep-duration',
              other: 'keep-other',
            },
          },
        },
        `${lang} 应保留 chat.permission 兄弟 key`,
      )
    }
  })

  test('场景 9:顶层 audit 不存在 → 日志 "跳过:顶层 audit 不存在"', () => {
    // 只有 keep,无 audit/help/chat
    writeAllLangs(tmpRoot, 'web', { keep: 'k' })
    const r = runCli()
    assert.equal(r.status, 0)
    assert.match(r.stdout, /\[zh-CN\] 跳过:顶层 "audit" 不存在/, 'audit 不存在应跳过')
    assert.match(r.stdout, /\[zh-CN\] 跳过:顶层 "help" 不存在/, 'help 不存在应跳过')
    assert.match(r.stdout, /\[zh-CN\] 跳过:顶层 "chat" 不存在/, 'chat 不存在应跳过')
    assert.match(r.stdout, /\[zh-CN\] 删除 0 个 key,leaf 总数 1 → 1/, 'deleted=0,leaf 不变')
    // 文件未被修改(只重新序列化,内容应仍是 { keep: 'k' })
    for (const lang of LOCALES) {
      assert.deepEqual(readLang(tmpRoot, 'web', lang), { keep: 'k' }, `${lang} 不应被修改`)
    }
  })

  test('场景 10:help 存在但 help.faq 不存在 → "跳过 help.faq 不存在"(deepDelete 返回 false)', () => {
    // help 存在但无 faq 子键;chat 存在且 chat.permission.autoRevertedDesc 存在
    writeAllLangs(tmpRoot, 'web', {
      audit: { a: 'v1' },
      help: { title: 'no-faq-here' },
      chat: { permission: { autoRevertedDesc: 'del' } },
    })
    const r = runCli()
    assert.equal(r.status, 0)
    // audit 删除成功
    assert.match(r.stdout, /\[zh-CN\] 删除顶层 "audit" \(1 个 leaf key\)/, 'audit 应删除 1 leaf')
    // help.faq 不存在 → 跳过
    assert.match(r.stdout, /\[zh-CN\] 跳过:"help\.faq" 不存在/, 'help.faq 不存在应跳过')
    // chat.permission.autoRevertedDesc 删除成功
    assert.match(r.stdout, /\[zh-CN\] 删除 "chat\.permission\.autoRevertedDesc"/, 'chat.permission.autoRevertedDesc 应删除')
    // deleted = 2(audit 1 + chat.permission.autoRevertedDesc 1;help.faq 跳过不计)
    assert.match(r.stdout, /\[zh-CN\] 删除 2 个 key/, 'zh-CN deleted 应为 2')
    // 结果:audit 删,help 保留 title,chat.permission.autoRevertedDesc 删(permission 变空对象但不 prune)
    for (const lang of LOCALES) {
      assert.deepEqual(
        readLang(tmpRoot, 'web', lang),
        { help: { title: 'no-faq-here' }, chat: { permission: {} } },
        `${lang} 应正确删除`,
      )
    }
  })
})

describe('MINIAPP 删除规则(MINIAPP_DELETE_RULES)', () => {
  test('场景 11:7 个 key 全删 + 兄弟 key 保留(common.keep / nav.keep / chat.keep)', () => {
    writeAllLangs(tmpRoot, 'miniapp-taro', fullMiniappFixture())
    const r = runCli(['--target=miniapp-taro'])
    assert.equal(r.status, 0)
    // 7 条删除日志
    const expectedDeletes = [
      'common.search', 'nav.chat', 'nav.agents', 'nav.orders',
      'nav.wallet', 'nav.settings', 'chat.newConversation',
    ]
    for (const k of expectedDeletes) {
      assert.match(r.stdout, new RegExp(`\\[zh-CN\\] 删除 "${k.replace(/\./g, '\\.')}"`), `应删除 ${k}`)
    }
    // 每语言 deleted=7
    assert.match(r.stdout, /\[zh-CN\] 删除 7 个 key/, 'zh-CN deleted 应为 7')
    // 汇总 5×7=35
    assert.match(r.stdout, /汇总:\[target=miniapp-taro\] 共删除 35 个 key/, '汇总应为 35')
    // 兄弟 key 保留
    for (const lang of LOCALES) {
      assert.deepEqual(
        readLang(tmpRoot, 'miniapp-taro', lang),
        { common: { keep: 'k' }, nav: { keep: 'k' }, chat: { keep: 'k' } },
        `${lang} 应保留所有 keep 兄弟`,
      )
    }
  })
})

describe('countLeaves 行为与写回格式', () => {
  test('场景 12:数组 leaf 计为 1(help.faq 含 2 个数组,leaf 总数按数组数计)', () => {
    // help.faq 含 2 个数组(account 3 元素 / payment 2 元素),countLeaves 各计 1
    writeAllLangs(tmpRoot, 'web', {
      help: {
        faq: { account: ['q1', 'q2', 'q3'], payment: ['a', 'b'] },
        title: 'keep',
      },
    })
    const r = runCli()
    assert.equal(r.status, 0)
    // help.faq 规则 deleted += 1(不论数组有多少元素)
    assert.match(r.stdout, /\[zh-CN\] 删除 1 个 key/, 'help.faq 规则 deleted 应为 1')
    // leaf 总数:before = title(1) + faq.account(1) + faq.payment(1) = 3
    //          after  = title(1) = 1
    assert.match(r.stdout, /\[zh-CN\] 删除 1 个 key,leaf 总数 3 → 1/, 'leaf 应 3 → 1(数组计 1)')
  })

  test('场景 13:写回 JSON 2 空格缩进 + 末尾换行 + 无 BOM', () => {
    writeAllLangs(tmpRoot, 'web', { audit: { a: 'v1' }, keep: 'k' })
    const r = runCli()
    assert.equal(r.status, 0)
    const raw = readLangRaw(tmpRoot, 'web', 'zh-CN')
    // 末尾换行
    assert.equal(raw.endsWith('\n'), true, '应以换行结尾')
    // 无 BOM(首字符应为 {,ASCII 123)
    assert.equal(raw.charCodeAt(0), 123, '首字符应为 { (ASCII 123),无 BOM')
    // 2 空格缩进:应含 '\n  "keep"'(2 空格)
    assert.match(raw, /\n  "keep"/, '应使用 2 空格缩进 keep')
    // 内容正确:audit 已删,keep 保留
    assert.deepEqual(readLang(tmpRoot, 'web', 'zh-CN'), { keep: 'k' }, '内容应为 keep 保留')
  })

  test('场景 14:幂等性 — 第二次运行全部跳过,deleted=0', () => {
    writeAllLangs(tmpRoot, 'web', fullWebFixture())
    // 第一次运行
    const r1 = runCli()
    assert.equal(r1.status, 0)
    assert.match(r1.stdout, /\[zh-CN\] 删除 4 个 key/, '第一次应删除 4 个 key')
    // 第二次运行(幂等)
    const r2 = runCli()
    assert.equal(r2.status, 0, '幂等运行应仍 exit 0')
    // audit 已删 → 跳过
    assert.match(r2.stdout, /\[zh-CN\] 跳过:顶层 "audit" 不存在/, '第二次 audit 应跳过')
    // help.faq 已删 → deepDelete 返回 false → 跳过
    assert.match(r2.stdout, /\[zh-CN\] 跳过:"help\.faq" 不存在/, '第二次 help.faq 应跳过')
    // chat.permission.autoRevertedDesc 已删 → 跳过
    assert.match(r2.stdout, /\[zh-CN\] 跳过:"chat\.permission\.autoRevertedDesc" 不存在/, '第二次 chat.permission.autoRevertedDesc 应跳过')
    // deleted=0
    assert.match(r2.stdout, /\[zh-CN\] 删除 0 个 key/, '第二次 deleted 应为 0')
    assert.match(r2.stdout, /汇总:\[target=web\] 共删除 0 个 key/, '汇总应为 0')
  })
})
