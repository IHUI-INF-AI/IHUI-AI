/**
 * @file cleanup-i18n-unused-keys.mjs 回归测试基线
 * @description 本测试覆盖 scripts/cleanup-i18n-unused-keys.mjs 的核心规则:
 *   1. CLI 入口:--list <path> 自定义清单 / --dry-run 预览不写 / 默认清单路径
 *   2. 退出码:清单文件不存在 → exit 1;i18n 文件不存在 → exit 1;成功 → exit 0
 *   3. parseList 规则:
 *      - 格式 base_file | key | namespace | value,parts.length < 4 跳过
 *      - 注释(#)与空行跳过
 *      - baseFile 必须以 .json 结尾,否则跳过
 *      - target 路由:/messages/{web,miniapp-taro,extension,mobile-rn}/
 *      - 未知 target 路径跳过(skippedMalformed++)
 *      - value 含 `|` 字符 → parts.slice(3).join('|') 正确合并
 *   4. deleteKeyPath 规则:
 *      - 递归删除叶子 key,返回 true
 *      - key 不存在返回 false(幂等跳过,计入 notFound)
 *      - 中间段非对象 → 返回 false,不删除
 *      - 删除后清理空父对象(支持 3 层及以上嵌套)
 *   5. 多端处理:web/miniapp-taro/extension/mobile-rn 4 端,各 5 语言(zh-CN/zh-TW/ko/ja/en)
 *   6. 空 target 跳过:target.keys.size === 0 时不读 i18n 文件直接 continue
 *   7. Parity 自检:5 语言 deleted 数应一致
 *   8. 写回格式:JSON.stringify(obj, null, 2) + '\n',UTF-8 无 BOM
 *
 * 测试策略:由于脚本用 __dirname 推导 ROOT(无法用 cwd 重定向),
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
const ORIGINAL_SCRIPT = path.resolve(__dirname, '..', 'cleanup-i18n-unused-keys.mjs')

const LANGS = ['zh-CN', 'zh-TW', 'ko', 'ja', 'en']
const TARGETS = ['web', 'miniapp-taro', 'extension', 'mobile-rn']

let tmpRoot

// ─── 辅助:创建临时项目根目录,copy 源脚本到 tmpRoot/scripts/(只读不改源) ───
function createTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cleanup-i18n-'))
  const tmpScriptsDir = path.join(root, 'scripts')
  fs.mkdirSync(tmpScriptsDir, { recursive: true })
  // copy 源脚本(不改源脚本),让 __dirname 解析到 tmpRoot
  fs.copyFileSync(ORIGINAL_SCRIPT, path.join(tmpScriptsDir, 'cleanup-i18n-unused-keys.mjs'))
  // 创建默认 .trae-cn/tmp 目录(默认清单路径)
  fs.mkdirSync(path.join(root, '.trae-cn', 'tmp'), { recursive: true })
  return root
}

// ─── 辅助:为指定 target 写入 5 语言文件(默认所有 lang 同内容) ───
function writeAllLangs(root, target, baseObj, langOverrides = {}) {
  const dir = path.join(root, 'packages', 'i18n', 'messages', target)
  fs.mkdirSync(dir, { recursive: true })
  for (const lang of LANGS) {
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

// ─── 辅助:写入删除清单 ───
function writeList(root, lines, name = 'i18n-deletion-list.txt') {
  const filePath = path.join(root, '.trae-cn', 'tmp', name)
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
  return filePath
}

// ─── 辅助:运行脚本(子进程,cwd=tmpRoot) ───
function runCli(args = []) {
  const scriptPath = path.join(tmpRoot, 'scripts', 'cleanup-i18n-unused-keys.mjs')
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

// ─── 辅助:读取 target 的 lang 文件 ───
function readLang(root, target, lang) {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'packages', 'i18n', 'messages', target, `${lang}.json`), 'utf8'),
  )
}

// ─── 辅助:读取 target 的 lang 文件原始字符串 ───
function readLangRaw(root, target, lang) {
  return fs.readFileSync(path.join(root, 'packages', 'i18n', 'messages', target, `${lang}.json`), 'utf8')
}

// ─── 辅助:构造清单行 ───
function line(target, key, ns = 'ns', value = 'val') {
  return `packages/i18n/messages/${target}/zh-CN.json|${key}|${ns}|${value}`
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
  // 同时清空 .trae-cn/tmp 下清单文件
  const tmpListDir = path.join(tmpRoot, '.trae-cn', 'tmp')
  if (fs.existsSync(tmpListDir)) {
    for (const entry of fs.readdirSync(tmpListDir, { withFileTypes: true })) {
      fs.rmSync(path.join(tmpListDir, entry.name), { recursive: true, force: true })
    }
  }
})

describe('CLI 入口与退出码', () => {
  test('场景 1:清单文件不存在 → exit 1,stderr 含 "清单文件不存在"', () => {
    const r = runCli(['--list', path.join(tmpRoot, '.trae-cn', 'tmp', 'no-such-list.txt')])
    assert.equal(r.status, 1, '清单文件不存在应 exit 1')
    assert.match(r.stderr, /清单文件不存在/, 'stderr 应含 "清单文件不存在"')
  })

  test('场景 2:--list 自定义路径 + 成功处理 → exit 0', () => {
    writeAllLangs(tmpRoot, 'web', { a: { b: 'val' } })
    const listFile = writeList(tmpRoot, [line('web', 'a.b', 'a', 'val')])
    const r = runCli(['--list', listFile])
    assert.equal(r.status, 0, '成功处理应 exit 0')
    assert.match(r.stdout, /模式: 实际删除/, '默认应为实际删除模式')
  })

  test('场景 3:--dry-run → exit 0,文件不被修改,stdout 含 "DRY-RUN"', () => {
    const initial = { a: { b: 'val' } }
    writeAllLangs(tmpRoot, 'web', initial)
    const listFile = writeList(tmpRoot, [line('web', 'a.b', 'a', 'val')])
    const r = runCli(['--list', listFile, '--dry-run'])
    assert.equal(r.status, 0, '--dry-run 应 exit 0')
    assert.match(r.stdout, /DRY-RUN/, 'stdout 应含 DRY-RUN 标记')
    assert.match(r.stdout, /\[Dry-run\] 未写入任何文件/, '应输出未写入提示')
    // 文件未被修改
    assert.deepEqual(readLang(tmpRoot, 'web', 'zh-CN'), initial, '--dry-run 不应修改文件')
  })

  test('场景 4:i18n 文件缺失 → exit 1,stderr 含 "文件不存在"', () => {
    // 只写 zh-CN,缺 en.json
    writeLang(tmpRoot, 'web', 'zh-CN', { a: 'val' })
    const listFile = writeList(tmpRoot, [line('web', 'a', 'a', 'val')])
    const r = runCli(['--list', listFile])
    assert.equal(r.status, 1, 'i18n 文件缺失应 exit 1')
    assert.match(r.stderr, /文件不存在/, 'stderr 应含 "文件不存在"')
  })
})

describe('parseList 清单解析规则', () => {
  test('场景 5:畸形行(parts < 4)→ skippedMalformed 计数,有效行正常处理', () => {
    writeAllLangs(tmpRoot, 'web', { valid: 'v' })
    const listFile = writeList(tmpRoot, [
      'only-one-part',                                  // parts=1 → 跳过
      'a|b|c',                                          // parts=3 → 跳过
      line('web', 'valid', 'ns', 'v'),                  // 有效
    ])
    const r = runCli(['--list', listFile, '--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /跳过畸形=2/, '应跳过 2 条畸形行')
    assert.match(r.stdout, /web=1/, '应解析 1 个有效 web key')
  })

  test('场景 6:注释行(#)与空行 → 跳过,不影响有效解析', () => {
    writeAllLangs(tmpRoot, 'web', { valid: 'v' })
    const listFile = writeList(tmpRoot, [
      '# 这是注释',
      '',
      '   ',
      line('web', 'valid', 'ns', 'v'),
      '# 另一条注释',
    ])
    const r = runCli(['--list', listFile, '--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /web=1/, '应只解析出 1 个有效 key')
    assert.match(r.stdout, /跳过畸形=0/, '注释/空行不计畸形')
  })

  test('场景 7:value 含 `|` 字符 → parts.slice(3).join("|") 正确合并', () => {
    writeAllLangs(tmpRoot, 'web', { pipe: 'a|b|c' })
    // 行尾 value 是 "a|b|c",parts.length = 6,但应正确取 slice(3).join('|') = "a|b|c"
    const listFile = writeList(tmpRoot, [
      `packages/i18n/messages/web/zh-CN.json|pipe|ns|a|b|c`,
    ])
    const r = runCli(['--list', listFile, '--dry-run'])
    assert.equal(r.status, 0, 'value 含 | 不应导致解析失败')
    assert.match(r.stdout, /web=1/, '应正常解析 1 个 key')
  })

  test('场景 8:baseFile 不以 .json 结尾 → skippedMalformed', () => {
    writeAllLangs(tmpRoot, 'web', { a: 'v' })
    const listFile = writeList(tmpRoot, [
      'packages/i18n/messages/web/zh-CN.txt|a|ns|v',  // .txt 后缀 → 跳过
      line('web', 'a', 'ns', 'v'),                    // 有效
    ])
    const r = runCli(['--list', listFile, '--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /跳过畸形=1/, '.txt 后缀应跳过')
    assert.match(r.stdout, /web=1/, '.json 后缀的行应正常解析')
  })

  test('场景 9:未知 target 路径(/messages/desktop/)→ skippedMalformed', () => {
    const listFile = writeList(tmpRoot, [
      'packages/i18n/messages/desktop/zh-CN.json|a|ns|v',  // 未知 target → 跳过
    ])
    const r = runCli(['--list', listFile, '--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /跳过畸形=1/, '未知 target 应跳过')
    assert.match(r.stdout, /web=0.*miniapp-taro=0.*extension=0.*mobile-rn=0/, '所有 target 均为空')
  })
})

describe('deleteKeyPath 删除规则', () => {
  test('场景 10:删除叶子 key + 自动清理空父对象(3 层嵌套)', () => {
    // 结构: { a: { b: { c: 'deep' } } },删 a.b.c 后 a.b 与 a 均空 → 全清
    writeAllLangs(tmpRoot, 'web', { a: { b: { c: 'deep' } } })
    const listFile = writeList(tmpRoot, [line('web', 'a.b.c', 'a.b', 'deep')])
    const r = runCli(['--list', listFile])
    assert.equal(r.status, 0)
    // 5 语言均应被清空成 {}
    for (const lang of LANGS) {
      assert.deepEqual(readLang(tmpRoot, 'web', lang), {}, `${lang} 应被清空`)
    }
    // zh-CN 基准删除总数应为 1(5 语言各删 1 个,每语言 deleted=1)
    assert.match(r.stdout, /zh-CN 基准删除总数: 1/, 'zh-CN 基准删除总数应为 1')
    // 表格每行 deleted 列应为 1(web | zh-CN | 1 | 1 | 0 | 0 | 1)
    assert.match(r.stdout, /web\s+\|\s+zh-CN\s+\|\s+\d+\s+\|\s+1\s+\|\s+0\s+\|/, 'web/zh-CN 行 deleted 应为 1')
  })

  test('场景 11:中间段非对象(a 是字符串,试图删 a.b)→ notFound,不删除', () => {
    // a 是字符串,a.b 路径中间非对象 → deleteKeyPath 返回 false
    writeAllLangs(tmpRoot, 'web', { a: 'string-value' })
    const listFile = writeList(tmpRoot, [line('web', 'a.b', 'a', 'string-value')])
    const r = runCli(['--list', listFile])
    assert.equal(r.status, 0)
    // zh-CN 基准删除总数应为 0(5 语言均未删除),notFound 总数为 1
    assert.match(r.stdout, /zh-CN 基准删除总数: 0/, 'zh-CN 基准删除总数应为 0')
    assert.match(r.stdout, /zh-CN 未找到\(notFound,幂等跳过\)总数: 1/, 'zh-CN notFound 总数应为 1')
    // unique 匹配应为 ❌(deleted=0 ≠ uniqueKeys=1)
    assert.match(r.stdout, /zh-CN deleted=0, unique 匹配=❌/, 'unique 匹配应为 ❌')
    // 文件未被修改
    for (const lang of LANGS) {
      assert.deepEqual(readLang(tmpRoot, 'web', lang), { a: 'string-value' }, `${lang} 应未被修改`)
    }
  })

  test('场景 12:幂等性 — 重复运行不报错,第二次 deleted=0 / notFound=1', () => {
    writeAllLangs(tmpRoot, 'web', { a: 'v' })
    const listFile = writeList(tmpRoot, [line('web', 'a', 'a', 'v')])
    // 第一次运行
    const r1 = runCli(['--list', listFile])
    assert.equal(r1.status, 0)
    assert.match(r1.stdout, /zh-CN 基准删除总数: 1/, '第一次应删除 1 个 zh-CN key')
    assert.match(r1.stdout, /zh-CN deleted=1, unique 匹配=✅/, '第一次 unique 匹配应为 ✅')
    // 第二次运行(幂等)
    const r2 = runCli(['--list', listFile])
    assert.equal(r2.status, 0, '幂等运行应仍 exit 0')
    assert.match(r2.stdout, /zh-CN 基准删除总数: 0/, '第二次 deleted 应为 0')
    assert.match(r2.stdout, /zh-CN 未找到\(notFound,幂等跳过\)总数: 1/, '第二次 notFound 应为 1')
    assert.match(r2.stdout, /zh-CN deleted=0, unique 匹配=❌/, '第二次 unique 匹配应为 ❌')
  })
})

describe('多端处理与统计输出', () => {
  test('场景 13:多 target 清单(web + miniapp-taro + extension + mobile-rn)→ 4 端各删 5 文件', () => {
    for (const target of TARGETS) {
      writeAllLangs(tmpRoot, target, { keep: 'k', remove: 'r' })
    }
    const listFile = writeList(tmpRoot, [
      line('web', 'remove', 'ns', 'r'),
      line('miniapp-taro', 'remove', 'ns', 'r'),
      line('extension', 'remove', 'ns', 'r'),
      line('mobile-rn', 'remove', 'ns', 'r'),
    ])
    const r = runCli(['--list', listFile])
    assert.equal(r.status, 0)
    // 各端 zh-CN 应只剩 keep
    for (const target of TARGETS) {
      assert.deepEqual(readLang(tmpRoot, target, 'zh-CN'), { keep: 'k' }, `${target} zh-CN 应只剩 keep`)
    }
    assert.match(r.stdout, /已写入 20 个 i18n 文件/, '4 target × 5 lang = 20 个文件')
  })

  test('场景 14:空 target(other target 无清单条目)→ 输出 "无待删除 key,跳过" 且不读其文件', () => {
    // 仅写 web 文件,不写 miniapp-taro/extension/mobile-rn 文件
    // 因 list 中只有 web key,其他 target.keys.size === 0 → 跳过,不报文件缺失
    writeAllLangs(tmpRoot, 'web', { a: 'v' })
    const listFile = writeList(tmpRoot, [line('web', 'a', 'ns', 'v')])
    const r = runCli(['--list', listFile])
    assert.equal(r.status, 0, '空 target 应跳过不报错')
    assert.match(r.stdout, /\[miniapp-taro\] 无待删除 key,跳过/, 'miniapp-taro 应被跳过')
    assert.match(r.stdout, /\[extension\] 无待删除 key,跳过/, 'extension 应被跳过')
    assert.match(r.stdout, /\[mobile-rn\] 无待删除 key,跳过/, 'mobile-rn 应被跳过')
  })

  test('场景 15:Parity 自检通过 → stdout 含 "parity 维护 OK"', () => {
    // 5 语言结构一致,删除同一 key → parity OK
    writeAllLangs(tmpRoot, 'web', { a: 'v', b: 'w' })
    const listFile = writeList(tmpRoot, [line('web', 'a', 'ns', 'v')])
    const r = runCli(['--list', listFile])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /5 语言 deleted 数一致, parity 维护 OK/, 'parity 应通过')
    // unique key 匹配检查
    assert.match(r.stdout, /unique 匹配=✅/, 'unique key 匹配应通过')
  })
})

describe('写回文件格式', () => {
  test('场景 16:写回 JSON 应为 2 空格缩进 + 末尾换行 + 无 BOM', () => {
    writeAllLangs(tmpRoot, 'web', { a: 'v' })
    const listFile = writeList(tmpRoot, [line('web', 'a', 'ns', 'v')])
    const r = runCli(['--list', listFile])
    assert.equal(r.status, 0)
    const raw = readLangRaw(tmpRoot, 'web', 'zh-CN')
    // 末尾换行
    assert.equal(raw.endsWith('\n'), true, '应以换行结尾')
    // 无 BOM
    assert.equal(raw.charCodeAt(0), 123, '首字符应为 { (ASCII 123),无 BOM')
    // 2 空格缩进(空对象 {} 无缩进,这里删完是 {})
    assert.equal(raw, '{}\n', '空对象应输出 "{}\\n"')
  })
})
