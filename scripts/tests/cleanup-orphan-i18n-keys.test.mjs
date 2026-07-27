/**
 * @file cleanup-orphan-i18n-keys.mjs 回归测试
 * @description 覆盖 scripts/cleanup-orphan-i18n-keys.mjs 核心规则:
 *   1. CLI 入口:--dry-run 预览不写 / 默认实际写入 / 缺失文件 warn 跳过不报错
 *   2. 退出码:脚本无 process.exit,正常完成始终 exit 0(缺失文件不 exit 1)
 *   3. deleteKey 规则:
 *      - 叶子 key 存在 → 删除并返回 true
 *      - key 不存在 → 返回 false(幂等跳过)
 *      - 中间段非对象 → 返回 false,不崩溃
 *   4. pruneEmptyParents 规则:
 *      - 删除后从最深层往上清理空父对象(到 root 上一层为止)
 *      - 兄弟节点非空时保留父对象(不 over-prune)
 *   5. 多语言 parity:5 语言(zh-CN/zh-TW/en/ja/ko)同结构 → 各删除 N 个
 *   6. 幂等性:第二次运行 deleted=0,所有语言 "无需删除"
 *   7. 写回格式:JSON.stringify(obj, null, 2) + '\n',UTF-8 无 BOM
 *
 * 测试策略:脚本用 path.resolve(cwd 相对)定位 i18n 目录,
 * 直接以 cwd=tmpRoot 运行原始脚本(只读不改源),fixture 完全隔离不污染项目。
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
const ORIGINAL_SCRIPT = path.resolve(__dirname, '..', 'cleanup-orphan-i18n-keys.mjs')

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
// 与源脚本 KEYS_TO_DELETE 完全一致(只读不改源,测试需用真实清单)
const KEYS_TO_DELETE = [
  'admin.edu.learn.records.type.label',
  'admin.edu.learn.ranking.period.label',
  'models.keys.statusLabels.disabled',
  'models.billing.transactions.statusLabels.failed',
  'models.billing.transactions.statusLabels.pending',
  'models.billing.transactions.types.withdraw',
  'models.channels.statusLabels.success',
  'models.channels.statusLabels.failed',
  'about.metaTitle',
  'about.metaDescription',
  'about.loading',
  'about.valueMissionTitle',
  'about.valueMissionDesc',
  'about.valueCommunityTitle',
  'about.valueCommunityDesc',
  'about.valuePromiseTitle',
  'about.valuePromiseDesc',
  'about.valueDirectionTitle',
  'about.valueDirectionDesc',
  'about.marketingBadge',
  'about.marketingHeroTitle',
  'about.marketingFallbackSiteName',
  'about.marketingFallbackDescription',
  'about.marketingCtaTitle',
  'about.marketingCtaDesc',
  'about.marketingJoinNow',
  'about.marketingViewPricing',
]

let tmpRoot

// ─── 辅助:从 dot-path 构建嵌套对象 {'a':{'b':'v'}} ───
function setPath(obj, keyPath, value) {
  const parts = keyPath.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

// ─── 辅助:构造包含全部 27 个孤儿 key 的对象 ───
function buildFullObj() {
  const obj = {}
  for (const k of KEYS_TO_DELETE) setPath(obj, k, 'orphan-val')
  return obj
}

// ─── 辅助:写 5 语言文件(默认所有 lang 同内容) ───
function writeAllLangs(root, baseObj, langOverrides = {}) {
  const dir = path.join(root, 'packages', 'i18n', 'messages', 'web')
  fs.mkdirSync(dir, { recursive: true })
  for (const lang of LOCALES) {
    const obj = langOverrides[lang] !== undefined ? langOverrides[lang] : baseObj
    fs.writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify(obj, null, 2), 'utf8')
  }
}

// ─── 辅助:仅写指定语言文件 ───
function writeLang(root, lang, obj) {
  const dir = path.join(root, 'packages', 'i18n', 'messages', 'web')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify(obj, null, 2), 'utf8')
}

// ─── 辅助:运行脚本(cwd=tmpRoot,直接运行原始脚本不改源) ───
function runCli(args = []) {
  const result = spawnSync(process.execPath, [ORIGINAL_SCRIPT, ...args], {
    cwd: tmpRoot,
    encoding: 'utf8',
    timeout: 30000,
  })
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' }
}

// ─── 辅助:读取语言文件(对象) ───
function readLang(root, lang) {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'packages', 'i18n', 'messages', 'web', `${lang}.json`), 'utf8'),
  )
}

// ─── 辅助:读取语言文件原始字符串 ───
function readLangRaw(root, lang) {
  return fs.readFileSync(path.join(root, 'packages', 'i18n', 'messages', 'web', `${lang}.json`), 'utf8')
}

before(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-orphan-i18n-'))
})

after(() => {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch { /* 清理失败不影响结果 */ }
})

// 每个测试前清空 packages/ 内容,保证隔离
beforeEach(() => {
  const pkgsDir = path.join(tmpRoot, 'packages')
  if (fs.existsSync(pkgsDir)) fs.rmSync(pkgsDir, { recursive: true, force: true })
})

describe('CLI 入口与退出码', () => {
  test('场景 1:5 语言齐全 + 全部 27 key 存在 → exit 0,总计 135', () => {
    writeAllLangs(tmpRoot, buildFullObj())
    const r = runCli()
    assert.equal(r.status, 0, '成功处理应 exit 0')
    assert.match(r.stdout, /总计删除 135 个 key \(27 × 5 = 135 期望值\)/, '总计应为 27×5=135')
    // 每个语言应删除 27 个
    for (const lang of LOCALES) {
      assert.match(r.stdout, new RegExp(`\\[${lang}\\] 删除 27 个孤儿 key`), `${lang} 应删除 27 个`)
    }
  })

  test('场景 2:--dry-run → exit 0,文件不被修改,stdout 含 "(dry-run)"', () => {
    const initial = buildFullObj()
    writeAllLangs(tmpRoot, initial)
    const r = runCli(['--dry-run'])
    assert.equal(r.status, 0, '--dry-run 应 exit 0')
    assert.match(r.stdout, /\(dry-run\)/, 'stdout 应含 (dry-run) 标记')
    assert.match(r.stdout, /\[dry-run\] 总计删除 135 个 key/, 'dry-run 总计行应含 [dry-run] 前缀')
    // 文件未被修改
    for (const lang of LOCALES) {
      assert.deepEqual(readLang(tmpRoot, lang), initial, `${lang} 不应被修改`)
    }
  })

  test('场景 3:缺失某语言文件 → exit 0,stderr 含 "跳过(文件不存在)",其他语言正常处理', () => {
    // 只写 4 个语言,缺 ja
    for (const lang of ['zh-CN', 'zh-TW', 'en', 'ko']) {
      writeLang(tmpRoot, lang, buildFullObj())
    }
    const r = runCli()
    assert.equal(r.status, 0, '缺失文件应 warn 不报错,exit 0')
    assert.match(r.stderr, /跳过\(文件不存在\)/, 'stderr 应含 "跳过(文件不存在)"')
    assert.match(r.stderr, /ja\.json/, 'stderr 应提及 ja.json')
    // 其他 4 语言各删 27,total = 108(期望值仍为 135)
    assert.match(r.stdout, /总计删除 108 个 key \(27 × 5 = 135 期望值\)/, '总计应为 27×4=108')
    for (const lang of ['zh-CN', 'zh-TW', 'en', 'ko']) {
      assert.match(r.stdout, new RegExp(`\\[${lang}\\] 删除 27 个孤儿 key`), `${lang} 应正常删除 27 个`)
    }
  })
})

describe('deleteKey + pruneEmptyParents 删除规则', () => {
  test('场景 4:2 层 key (about.metaTitle) 删除 + 清理空父 about', () => {
    // 只放 about.metaTitle,删后 about 应被 prune,根对象变 {}
    writeAllLangs(tmpRoot, { about: { metaTitle: 'v' } })
    const r = runCli()
    assert.equal(r.status, 0)
    for (const lang of LOCALES) {
      assert.deepEqual(readLang(tmpRoot, lang), {}, `${lang} 应被清空`)
    }
    assert.match(r.stdout, /总计删除 5 个 key \(27 × 5 = 135 期望值\)/, '总计应为 1×5=5')
  })

  test('场景 5:6 层深链 (admin.edu.learn.records.type.label) 删除 + 清理整个 admin 链', () => {
    // 只放 admin.edu.learn.records.type.label,删后整个 admin 链应被 prune 到根
    const obj = {}
    setPath(obj, 'admin.edu.learn.records.type.label', 'v')
    writeAllLangs(tmpRoot, obj)
    const r = runCli()
    assert.equal(r.status, 0)
    for (const lang of LOCALES) {
      assert.deepEqual(readLang(tmpRoot, lang), {}, `${lang} 应被清空`)
    }
    assert.match(r.stdout, /总计删除 5 个 key/, '总计应为 1×5=5')
  })

  test('场景 6:兄弟 key 保留 — about.metaTitle 删除,about.otherKey 保留', () => {
    writeAllLangs(tmpRoot, { about: { metaTitle: 'del', otherKey: 'keep' } })
    const r = runCli()
    assert.equal(r.status, 0)
    for (const lang of LOCALES) {
      assert.deepEqual(
        readLang(tmpRoot, lang),
        { about: { otherKey: 'keep' } },
        `${lang} 应保留 otherKey,about 不被 over-prune`,
      )
    }
  })

  test('场景 7:中间层有兄弟节点 — models.keys.statusLabels.disabled 删除,enabled 保留', () => {
    // models.keys.statusLabels 有 disabled(删除)+ enabled(保留),statusLabels 不应被 prune
    const obj = {}
    setPath(obj, 'models.keys.statusLabels.disabled', 'del')
    setPath(obj, 'models.keys.statusLabels.enabled', 'keep')
    writeAllLangs(tmpRoot, obj)
    const r = runCli()
    assert.equal(r.status, 0)
    for (const lang of LOCALES) {
      assert.deepEqual(
        readLang(tmpRoot, lang),
        { models: { keys: { statusLabels: { enabled: 'keep' } } } },
        `${lang} 应保留 statusLabels.enabled,中间层不 over-prune`,
      )
    }
  })

  test('场景 8:key 不存在 → deleted=0,stdout 含 "无需删除"', () => {
    // 空对象(仅含无关 key),所有 27 个孤儿 key 都不存在
    writeAllLangs(tmpRoot, { unrelated: 'keep' })
    const r = runCli()
    assert.equal(r.status, 0)
    for (const lang of LOCALES) {
      assert.match(r.stdout, new RegExp(`\\[${lang}\\] 无需删除`), `${lang} 应输出 "无需删除"`)
    }
    assert.match(r.stdout, /总计删除 0 个 key/, '总计应为 0')
    // 文件未被修改
    for (const lang of LOCALES) {
      assert.deepEqual(readLang(tmpRoot, lang), { unrelated: 'keep' }, `${lang} 不应被修改`)
    }
  })

  test('场景 9:中间段非对象 — about 是字符串,删 about.metaTitle 不崩溃', () => {
    // about 是字符串而非对象,deleteKey 应在最后段检查时返回 false,不抛错
    writeAllLangs(tmpRoot, { about: 'string-not-object' })
    const r = runCli()
    assert.equal(r.status, 0, '中间段非对象不应崩溃')
    for (const lang of LOCALES) {
      assert.deepEqual(readLang(tmpRoot, lang), { about: 'string-not-object' }, `${lang} 不应被修改`)
    }
    for (const lang of LOCALES) {
      assert.match(r.stdout, new RegExp(`\\[${lang}\\] 无需删除`), `${lang} 应输出 "无需删除"`)
    }
  })

  test('场景 10:部分 key 存在 — 27 个中只有 3 个存在 → deleted=3', () => {
    // 选 3 个 key:about.metaTitle / about.metaDescription(共享 about 父)/ models.keys.statusLabels.disabled
    const obj = {}
    setPath(obj, 'about.metaTitle', 'v1')
    setPath(obj, 'about.metaDescription', 'v2')
    setPath(obj, 'models.keys.statusLabels.disabled', 'v3')
    writeAllLangs(tmpRoot, obj)
    const r = runCli()
    assert.equal(r.status, 0)
    for (const lang of LOCALES) {
      assert.match(r.stdout, new RegExp(`\\[${lang}\\] 删除 3 个孤儿 key`), `${lang} 应删除 3 个`)
    }
    assert.match(r.stdout, /总计删除 15 个 key/, '总计应为 3×5=15')
    // 3 个 key 都是独占父对象 → 删完整个 about 和 models 链被 prune → {}
    for (const lang of LOCALES) {
      assert.deepEqual(readLang(tmpRoot, lang), {}, `${lang} 应被清空`)
    }
  })
})

describe('多语言 parity 与幂等性', () => {
  test('场景 11:5 语言结构一致 → 各删除 27 个,结果一致(parity)', () => {
    writeAllLangs(tmpRoot, buildFullObj())
    const r = runCli()
    assert.equal(r.status, 0)
    // 5 语言均删除 27 个
    for (const lang of LOCALES) {
      assert.match(r.stdout, new RegExp(`\\[${lang}\\] 删除 27 个孤儿 key`), `${lang} 应删除 27 个`)
    }
    // 5 语言结果一致(均空对象 {})
    const first = JSON.stringify(readLang(tmpRoot, 'zh-CN'))
    for (const lang of LOCALES) {
      assert.equal(JSON.stringify(readLang(tmpRoot, lang)), first, `${lang} 应与 zh-CN 结果一致`)
    }
  })

  test('场景 12:幂等性 — 第二次运行 deleted=0,所有语言 "无需删除"', () => {
    writeAllLangs(tmpRoot, buildFullObj())
    // 第一次运行
    const r1 = runCli()
    assert.equal(r1.status, 0)
    assert.match(r1.stdout, /总计删除 135 个 key/, '第一次应删除 135 个')
    // 第二次运行(幂等)
    const r2 = runCli()
    assert.equal(r2.status, 0, '幂等运行应仍 exit 0')
    for (const lang of LOCALES) {
      assert.match(r2.stdout, new RegExp(`\\[${lang}\\] 无需删除`), `${lang} 第二次应 "无需删除"`)
    }
    assert.match(r2.stdout, /总计删除 0 个 key/, '第二次总计应为 0')
  })
})

describe('写回文件格式', () => {
  test('场景 13:写回 JSON 为 2 空格缩进 + 末尾换行 + 无 BOM', () => {
    // 放一个有兄弟节点的对象,验证写回后的缩进格式
    writeAllLangs(tmpRoot, { about: { metaTitle: 'del', keep: 'k' } })
    const r = runCli()
    assert.equal(r.status, 0)
    const raw = readLangRaw(tmpRoot, 'zh-CN')
    // 末尾换行
    assert.equal(raw.endsWith('\n'), true, '应以换行结尾')
    // 无 BOM(首字符应为 {)
    assert.equal(raw.charCodeAt(0), 123, '首字符应为 { (ASCII 123),无 BOM')
    // 2 空格缩进:应包含 '\n  "about"'(2 空格)和 '\n    "keep"'(4 空格)
    assert.match(raw, /\n  "about"/, '应使用 2 空格缩进 about')
    assert.match(raw, /\n    "keep"/, '应使用 4 空格缩进 keep')
    // 内容正确(about.metaTitle 已删,about.keep 保留)
    assert.deepEqual(readLang(tmpRoot, 'zh-CN'), { about: { keep: 'k' } }, '内容应为 about.keep 保留')
  })
})
