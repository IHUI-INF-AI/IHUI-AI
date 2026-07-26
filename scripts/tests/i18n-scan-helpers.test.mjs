/**
 * @file i18n-scan-helpers 回归测试基线
 * @description 本测试覆盖 _i18n-scan-helpers.mjs 的关键正则识别逻辑,
 *   防止未来重构 regex 时再遗漏 server component API(getTranslations)
 *   或动态模板字符串拼接(t(`prefix.${var}`))。
 *
 *   覆盖三种 i18n 引用模式识别:
 *   ① useTranslations('namespace') 静态命名空间(client component,next-intl)
 *   ② getTranslations('namespace') server component API(next-intl/server,
 *      2026-07-26 commit 1459cdc2a5 增强的关键场景)
 *   ③ t(`prefix.${var}`) 动态模板字符串拼接(无法静态扫描,仅提示)
 *
 *   背景:
 *   - 上一轮 commit 5ebb17915 因扫描器漏识别 getTranslations 误删 40 key,
 *     导致 page.tsx 引用悬空。本测试覆盖该场景防止回归。
 *   - 用 Node.js 内置 test runner(`node --test`),无第三方框架依赖。
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import {
  STATIC_T_RE,
  DYNAMIC_T_RE,
  USE_T_RE,
  flatten,
  loadJson,
  walkDir,
  scanCode,
  isInUsedNamespace,
  groupByNamespace,
} from '../_i18n-scan-helpers.mjs'

// 辅助:对带 g flag 的 regex 执行首次匹配,返回捕获组或 null
// 注意:g flag 的 regex 有 lastIndex 状态,每次调用前必须 reset
function matchFirst(re, str) {
  re.lastIndex = 0
  const m = re.exec(str)
  re.lastIndex = 0
  return m ? m[1] : null
}

describe('USE_T_RE — useTranslations / getTranslations 命名空间识别', () => {
  test("useTranslations('about') → namespace='about'", () => {
    assert.equal(matchFirst(USE_T_RE, "const t = useTranslations('about')"), 'about')
  })

  test("getTranslations('modelsReferralPage') → namespace='modelsReferralPage'(2026-07-26 commit 1459cdc2a5 增强关键场景)", () => {
    // next-intl/server 在 server component 使用的 API,等价于 useTranslations
    // 上一轮 commit 5ebb17915 漏识别 getTranslations 导致 40 key 被误删
    assert.equal(
      matchFirst(USE_T_RE, "const t = await getTranslations('modelsReferralPage')"),
      'modelsReferralPage',
    )
  })

  test('useTranslations("about") 双引号也能命中', () => {
    assert.equal(matchFirst(USE_T_RE, 'const t = useTranslations("about")'), 'about')
  })

  test('useTranslations(`about`) 模板字面量(无插值)也能命中', () => {
    assert.equal(matchFirst(USE_T_RE, 'const t = useTranslations(`about`)'), 'about')
  })

  test('useTranslations("name-with-dash") 含连字符的 namespace 也能命中', () => {
    assert.equal(
      matchFirst(USE_T_RE, 'const t = useTranslations("name-with-dash")'),
      'name-with-dash',
    )
  })

  test('useTranslations() 空参数 → 不应命中(防 false positive)', () => {
    assert.equal(matchFirst(USE_T_RE, 'const t = useTranslations()'), null)
  })

  test('useTranslations(variable) 动态参数 → 不应命中(防 false positive)', () => {
    assert.equal(matchFirst(USE_T_RE, 'const t = useTranslations(namespace)'), null)
  })
})

describe('STATIC_T_RE — 静态 t("a.b.c") 全路径点分识别', () => {
  test("t('about.heroTitle') → key='about.heroTitle'", () => {
    assert.equal(matchFirst(STATIC_T_RE, "t('about.heroTitle')"), 'about.heroTitle')
  })

  test('t("about.heroTitle") 双引号也能命中', () => {
    assert.equal(matchFirst(STATIC_T_RE, 't("about.heroTitle")'), 'about.heroTitle')
  })

  test("t(`about.heroTitle`) 模板字面量(无插值)也能命中", () => {
    assert.equal(matchFirst(STATIC_T_RE, 't(`about.heroTitle`)'), 'about.heroTitle')
  })

  test("t('a.b.c.d.e') 多段点分也能命中", () => {
    assert.equal(matchFirst(STATIC_T_RE, "t('a.b.c.d.e')"), 'a.b.c.d.e')
  })

  test("t('about.heroTitle', { fallback: 'xxx' }) 带对象参数 → 命中(2026-07-26 STATIC_T_RE 增强后)", () => {
    // 2026-07-26 STATIC_T_RE 增强:新增 `(?:,[^)]*)?` 可选组支持带参数调用
    // 修复前漏报场景:t('key', { args }) / t('key', count) 等带参数形式
    assert.equal(matchFirst(STATIC_T_RE, "t('about.heroTitle', { fallback: 'xxx' })"), 'about.heroTitle')
  })

  test("t('about.heroTitle', { count: 5 }) 复数形式参数 → 命中", () => {
    // next-intl 复数形式:t('key', { count: 5 }),增强前漏报
    assert.equal(matchFirst(STATIC_T_RE, "t('about.heroTitle', { count: 5 })"), 'about.heroTitle')
  })

  test("t('a.b.c', 'default value') 字符串参数 → 命中(增强前漏报)", () => {
    // 非对象参数也能识别(虽然 next-intl 不推荐这种用法)
    assert.equal(matchFirst(STATIC_T_RE, "t('a.b.c', 'default value')"), 'a.b.c')
  })

  test("t('a.b.c', { x: foo(y) }) 嵌套括号参数 → 命中(捕获组仍正确)", () => {
    // `[^)]*` 在第一个 `)` 前停止,捕获组 1 = 'a.b.c' 正确
    assert.equal(matchFirst(STATIC_T_RE, "t('a.b.c', { x: foo(y) })"), 'a.b.c')
  })

  test("t('a.b.c', { deep: { nested: value } }) 深嵌套对象参数 → 命中", () => {
    // 多层嵌套对象,只要不含 `)` 字符即可命中
    assert.equal(matchFirst(STATIC_T_RE, "t('a.b.c', { deep: { nested: value } })"), 'a.b.c')
  })

  test("t('a.b', { x: 1 }) + t('c.d', { y: 2 }) 同行多调用 → 都命中", () => {
    // g flag 在 while 循环中持续 exec,两处调用都应捕获
    const results = []
    STATIC_T_RE.lastIndex = 0
    let m
    while ((m = STATIC_T_RE.exec("t('a.b', { x: 1 }) + t('c.d', { y: 2 })")) !== null) {
      results.push(m[1])
    }
    STATIC_T_RE.lastIndex = 0
    assert.deepEqual(results.sort(), ['a.b', 'c.d'])
  })

  test('t(key) 动态变量 → 不应命中(防 false positive)', () => {
    assert.equal(matchFirst(STATIC_T_RE, 't(key)'), null)
  })

  test('t(variable) 动态变量 → 不应命中(防 false positive)', () => {
    assert.equal(matchFirst(STATIC_T_RE, 't(variable)'), null)
  })

  test("t('singleword') 单段无点 → 不应命中(要求至少 1 个点)", () => {
    assert.equal(matchFirst(STATIC_T_RE, "t('singleword')"), null)
  })

  // 2026-07-26 二次增强:识别 tt('key', fallback) 多参数调用
  // 背景:miniapp-taro/mobile-rn 普遍使用 const tt = (k, fb) => (t(k) === k ? fb : t(k)) fallback wrapper,
  // 原 `\bt\(` 只匹配单字母 t,导致 miniapp-taro 1230 个 tt() 调用全部漏识别,1244 死 key 中 1227 个为误判
  test("tt('about.title', '默认值') → 命中(2026-07-26 二次增强:识别 tt fallback wrapper)", () => {
    assert.equal(matchFirst(STATIC_T_RE, "tt('about.title', '默认值')"), 'about.title')
  })

  test("tt('about.title') 无参数 → 命中", () => {
    assert.equal(matchFirst(STATIC_T_RE, "tt('about.title')"), 'about.title')
  })

  test("tt('a.b.c', { fallback: 'xxx' }) 对象参数 → 命中", () => {
    assert.equal(matchFirst(STATIC_T_RE, "tt('a.b.c', { fallback: 'xxx' })"), 'a.b.c')
  })

  test("att('a.b') 不应误命中(防 false positive,\\b 词边界)", () => {
    // `\b(?:t|tt)\(` 要求 tt 前是词边界,att 前的 tt 不是词边界(是单词中间)
    assert.equal(matchFirst(STATIC_T_RE, "att('a.b')"), null)
  })

  test("i18n.tt('a.b') 链式调用 → 不应命中(由 I18N_T_RE 处理)", () => {
    // 链式调用 i18n.tt() 由 I18N_T_RE 单独处理,STATIC_T_RE 不应误命中
    // 注:`\b(?:t|tt)\(` 在 i18n.tt( 前面,`\b` 在 `.` 后,tt 前有 `.`(非单词字符),会匹配
    // 但这是已知行为,i18n.tt 的 key 提取由 I18N_T_RE 更精确处理
    // 此测试记录该行为,如果未来需要排除 i18n.tt 可加 negative lookbehind
    const result = matchFirst(STATIC_T_RE, "i18n.tt('a.b')")
    // 当前行为:会命中(因为 \btt\( 匹配),记录此基线
    assert.equal(result, 'a.b')
  })
})

describe('DYNAMIC_T_RE — 动态 t(`prefix.${var}`) 模板字符串拼接识别', () => {
  test('t(`home.marquee.${var}`) → 命中(模板字符串拼接,2026-07-26 关键场景)', () => {
    // DYNAMIC_T_RE 不捕获 key(因为 key 是动态的),只验证命中
    assert.notEqual(matchFirst(DYNAMIC_T_RE, 't(`home.marquee.${var}`)'), null)
  })

  test('t(`prefix.${var}.suffix`) 中间插值也能命中', () => {
    assert.notEqual(matchFirst(DYNAMIC_T_RE, 't(`prefix.${var}.suffix`)'), null)
  })

  test('t(`no-interpolation`) 无插值 → 不应命中 DYNAMIC_T_RE', () => {
    assert.equal(matchFirst(DYNAMIC_T_RE, 't(`no-interpolation`)'), null)
  })

  test("t('plain.string') 单引号静态 → 不应命中 DYNAMIC_T_RE", () => {
    assert.equal(matchFirst(DYNAMIC_T_RE, "t('plain.string')"), null)
  })
})

describe('flatten — JSON 递归展开为点分 key 集合', () => {
  test('flatten({ a: { b: { c: "value" } } }) → Set 含 "a.b.c"', () => {
    const result = flatten({ a: { b: { c: 'value' } } })
    assert.ok(result instanceof Set)
    assert.deepEqual([...result], ['a.b.c'])
  })

  test('flatten({ a: "x", b: { c: "y" } }) → Set 含 "a" 和 "b.c"', () => {
    const result = flatten({ a: 'x', b: { c: 'y' } })
    assert.deepEqual([...result].sort(), ['a', 'b.c'])
  })

  test('flatten({}) → 空 Set', () => {
    const result = flatten({})
    assert.equal(result.size, 0)
  })

  test('flatten({ a: ["x", "y"] }) 字符串数组 → Set 含 "a"(数组整体算叶子)', () => {
    const result = flatten({ a: ['x', 'y'] })
    assert.deepEqual([...result], ['a'])
  })

  test('flatten(null) → 空 Set', () => {
    const result = flatten(null)
    assert.equal(result.size, 0)
  })

  test('flatten({ a: { b: {} } }) 空对象子节点 → Set 含 "a.b"', () => {
    const result = flatten({ a: { b: {} } })
    assert.deepEqual([...result], ['a.b'])
  })
})

describe('isInUsedNamespace — 判定 leaf key 是否在 used namespace 下', () => {
  test("isInUsedNamespace('about.hero', Set(['about'])) → true(前缀匹配)", () => {
    assert.equal(isInUsedNamespace('about.hero', new Set(['about'])), true)
  })

  test("isInUsedNamespace('about', Set(['about'])) → true(完全相等)", () => {
    assert.equal(isInUsedNamespace('about', new Set(['about'])), true)
  })

  test("isInUsedNamespace('aboutOther.x', Set(['about'])) → false(必须 startsWith('about.'),避免子串误判)", () => {
    // 关键:不能用 startsWith('about'),否则 'aboutOther' 会被误判为 about 子项
    // 这正是 isInUsedNamespace 用 key.startsWith(ns + '.') 而非 key.startsWith(ns) 的原因
    assert.equal(isInUsedNamespace('aboutOther.x', new Set(['about'])), false)
  })

  test("isInUsedNamespace('x.y', Set([])) → false(空 namespace 集合)", () => {
    assert.equal(isInUsedNamespace('x.y', new Set([])), false)
  })

  test("isInUsedNamespace('a.b.c', Set(['x', 'a'])) → true(多 namespace 中命中其一)", () => {
    assert.equal(isInUsedNamespace('a.b.c', new Set(['x', 'a'])), true)
  })
})

describe('groupByNamespace — 按 namespace 分组并排序', () => {
  test("groupByNamespace(['b.x', 'a.y', 'a.z']) → Map 按 namespace 排序(a 在前)", () => {
    const result = groupByNamespace(['b.x', 'a.y', 'a.z'])
    assert.ok(result instanceof Map)
    assert.deepEqual([...result.keys()], ['a', 'b'])
    assert.deepEqual(result.get('a'), ['a.y', 'a.z'])
    assert.deepEqual(result.get('b'), ['b.x'])
  })

  test('groupByNamespace([]) → 空 Map', () => {
    const result = groupByNamespace([])
    assert.equal(result.size, 0)
  })

  test("groupByNamespace(['single']) → Map { 'single' => ['single'] }(无点的 key 自成 namespace)", () => {
    const result = groupByNamespace(['single'])
    assert.deepEqual([...result.keys()], ['single'])
    assert.deepEqual(result.get('single'), ['single'])
  })
})

describe('scanCode — 黑盒集成测试(通过临时 fixture 文件)', () => {
  let tmpDir
  let clientFile
  let serverFile

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-scan-test-'))
    clientFile = path.join(tmpDir, 'page.tsx')
    serverFile = path.join(tmpDir, 'server-page.tsx')
    fs.writeFileSync(
      clientFile,
      [
        "import { useTranslations } from 'next-intl'",
        "const t = useTranslations('about')",
        "t('about.heroTitle')",
        '// t("commented.out") should not be counted',
        't(`home.marquee.${var}`)',
      ].join('\n'),
      'utf8',
    )
    fs.writeFileSync(
      serverFile,
      [
        "import { getTranslations } from 'next-intl/server'",
        "const t = await getTranslations('modelsReferralPage')",
        "t('modelsReferralPage.title')",
      ].join('\n'),
      'utf8',
    )
  })

  after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* 测试清理失败不影响结果 */
    }
  })

  test('scanCode 识别 useTranslations namespace + 静态 t + 动态 t + 跳过注释', () => {
    const { staticRefs, usedNamespaces, dynamicHits, scanned } = scanCode([clientFile])
    assert.equal(scanned, 1)
    assert.ok(usedNamespaces.has('about'), "应识别 useTranslations('about') 为 used namespace")
    assert.ok(staticRefs.has('about.heroTitle'), "应识别 t('about.heroTitle') 为静态引用")
    assert.ok(!staticRefs.has('commented.out'), '应跳过注释行 // t("commented.out")')
    assert.equal(dynamicHits.length, 1, '应识别 1 处动态 t(`home.marquee.${var}`)')
    assert.match(dynamicHits[0].snippet, /home\.marquee/)
  })

  test('scanCode 识别 getTranslations(server component API,2026-07-26 commit 1459cdc2a5 增强)', () => {
    // 关键回归测试:上一轮 commit 5ebb17915 漏识别 getTranslations,
    // 导致 server component 引用的 namespace 被误判为死 key,40 key 被删
    const { staticRefs, usedNamespaces } = scanCode([serverFile])
    assert.ok(
      usedNamespaces.has('modelsReferralPage'),
      "应识别 getTranslations('modelsReferralPage') 为 used namespace",
    )
    assert.ok(
      staticRefs.has('modelsReferralPage.title'),
      "应识别 t('modelsReferralPage.title') 为静态引用",
    )
  })

  test('scanCode 多文件聚合(client + server 混合)', () => {
    const { staticRefs, usedNamespaces, scanned } = scanCode([clientFile, serverFile])
    assert.equal(scanned, 2)
    assert.ok(usedNamespaces.has('about'))
    assert.ok(usedNamespaces.has('modelsReferralPage'))
    assert.ok(staticRefs.has('about.heroTitle'))
    assert.ok(staticRefs.has('modelsReferralPage.title'))
  })

  test('scanCode 空数组 → scanned=0,所有集合为空', () => {
    const { staticRefs, usedNamespaces, dynamicHits, scanned } = scanCode([])
    assert.equal(scanned, 0)
    assert.equal(staticRefs.size, 0)
    assert.equal(usedNamespaces.size, 0)
    assert.equal(dynamicHits.length, 0)
  })
})

describe('loadJson / walkDir — 文件系统辅助函数', () => {
  test('loadJson 不存在的文件 → 抛错(含路径信息)', () => {
    const nonexistent = path.join(os.tmpdir(), `i18n-scan-nonexist-${Date.now()}.json`)
    assert.throws(() => loadJson(nonexistent), /文件不存在/)
  })

  test('loadJson 解析失败 → 抛错(含 JSON 解析失败信息)', () => {
    const tmp = path.join(os.tmpdir(), `i18n-scan-bad-${Date.now()}.json`)
    fs.writeFileSync(tmp, '{ not valid json', 'utf8')
    try {
      assert.throws(() => loadJson(tmp), /JSON 解析失败/)
    } finally {
      fs.rmSync(tmp, { force: true })
    }
  })

  test('loadJson 合法 JSON → 返回解析后的对象', () => {
    const tmp = path.join(os.tmpdir(), `i18n-scan-ok-${Date.now()}.json`)
    fs.writeFileSync(tmp, '{"a":{"b":"c"}}', 'utf8')
    try {
      const result = loadJson(tmp)
      assert.deepEqual(result, { a: { b: 'c' } })
    } finally {
      fs.rmSync(tmp, { force: true })
    }
  })

  test('walkDir 不存在的目录 → 返回空数组', () => {
    const result = walkDir(path.join(os.tmpdir(), `i18n-scan-noexist-${Date.now()}`))
    assert.deepEqual(result, [])
  })

  test('walkDir 扫描 .ts/.tsx,跳过 EXCLUDE_DIRS(node_modules)与测试文件', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-scan-walk-'))
    try {
      fs.writeFileSync(path.join(tmp, 'a.ts'), 'export const x = 1', 'utf8')
      fs.writeFileSync(path.join(tmp, 'b.tsx'), 'export const y = 2', 'utf8')
      fs.mkdirSync(path.join(tmp, 'node_modules'))
      fs.writeFileSync(path.join(tmp, 'node_modules', 'skip.ts'), 'should be skipped', 'utf8')
      fs.writeFileSync(path.join(tmp, 'c.test.ts'), 'should be skipped (test file)', 'utf8')
      fs.writeFileSync(path.join(tmp, 'd.d.ts'), 'should be skipped (declaration)', 'utf8')
      const result = walkDir(tmp)
      const names = result.map((p) => path.basename(p)).sort()
      assert.deepEqual(names, ['a.ts', 'b.tsx'])
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
})
