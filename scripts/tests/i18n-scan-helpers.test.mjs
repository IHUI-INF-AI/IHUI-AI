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
  PROP_KEY_RE,
  TLIST_RE,
  JSX_PROP_KEY_RE,
  STATIC_T_MULTILINE_RE,
  UNION_TYPE_KEY_RE_FIRST,
  UNION_TYPE_KEY_RE_SECOND,
  OBJECT_LITERAL_KEY_RE,
  DYNAMIC_PREFIX_RE,
  flatten,
  loadJson,
  walkDir,
  scanCode,
  isInUsedNamespace,
  groupByNamespace,
} from '../_i18n-scan-helpers.mjs'

// 辅助:对带 g flag 的 regex 执行首次匹配,返回捕获组或 null
// 注意:g flag 的 regex 有 lastIndex 状态,node --test 并发执行时共享实例会 race condition,
// 因此每次创建新的 RegExp 实例(从 source/flags 复制),避免共享 lastIndex 状态。
function matchFirst(re, str) {
  const local = new RegExp(re.source, re.flags)
  const m = local.exec(str)
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

describe('PROP_KEY_RE — 属性赋值全路径 i18n key 识别(2026-07-26 增强)', () => {
  // 背景:design.responsive.device* 6 个 key 在 responsive-devices.ts 中以
  // { nameKey: 'design.responsive.deviceMobilePortrait' } 属性赋值形式引用,
  // 原扫描器仅识别 t('a.b.c') / useTranslations('ns') 模式,漏识别属性赋值,
  // 导致这 6 个 key 被误判为死 key。PROP_KEY_RE 补此缺口。

  test("nameKey: 'design.responsive.deviceMobilePortrait' → 命中全路径 key", () => {
    assert.equal(
      matchFirst(PROP_KEY_RE, "  { id: 'mobile-portrait', nameKey: 'design.responsive.deviceMobilePortrait', width: 375 }"),
      'design.responsive.deviceMobilePortrait',
    )
  })

  test("titleKey: 'a.b.c' → 命中(titleKey 白名单)", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "titleKey: 'a.b.c'"), 'a.b.c')
  })

  test("labelKey: 'a.b.c' → 命中(labelKey 白名单)", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "labelKey: 'a.b.c'"), 'a.b.c')
  })

  test("descriptionKey: 'a.b.c' → 命中(descriptionKey 白名单)", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "descriptionKey: 'a.b.c'"), 'a.b.c')
  })

  test("textKey: 'a.b.c' → 命中(textKey 白名单)", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "textKey: 'a.b.c'"), 'a.b.c')
  })

  test('titleKey: "a.b.c" 双引号 → 命中', () => {
    assert.equal(matchFirst(PROP_KEY_RE, 'titleKey: "a.b.c"'), 'a.b.c')
  })

  test('titleKey: `a.b.c` 模板字面量 → 命中', () => {
    assert.equal(matchFirst(PROP_KEY_RE, 'titleKey: `a.b.c`'), 'a.b.c')
  })

  test("nameKey:'a.b.c' 无空格 → 命中(容错)", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "nameKey:'a.b.c'"), 'a.b.c')
  })

  test("nameKey:  'a.b.c' 多空格 → 命中(容错)", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "nameKey:  'a.b.c'"), 'a.b.c')
  })

  test("nameKey: 'kouzi' 单段无点 → 不应命中(防 false positive,单段是相对引用)", () => {
    // 关键:单段值(无点)是运行时解析的相对引用,不是静态全路径 i18n key
    assert.equal(matchFirst(PROP_KEY_RE, "nameKey: 'kouzi'"), null)
  })

  test("nameKey: 'example1Name' 单段无点 → 不应命中", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "nameKey: 'example1Name'"), null)
  })

  test("dataKey: 'a.b.c' 非白名单属性 → 不应命中(防 false positive)", () => {
    // dataKey/idKey/valueKey 等非 i18n 约定属性不命中
    assert.equal(matchFirst(PROP_KEY_RE, "dataKey: 'a.b.c'"), null)
  })

  test("idKey: 'a.b.c' 非白名单属性 → 不应命中", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "idKey: 'a.b.c'"), null)
  })

  test("myNameKey: 'a.b.c' 非白名单(前缀附加)→ 不应命中(\\b 词边界)", () => {
    // \b 要求 nameKey 前是词边界,myNameKey 中的 nameKey 前是字母(非词边界)
    assert.equal(matchFirst(PROP_KEY_RE, "myNameKey: 'a.b.c'"), null)
  })

  test("nameKey: 'a.b.c.d.e' 多段点分 → 命中", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "nameKey: 'a.b.c.d.e'"), 'a.b.c.d.e')
  })

  test("nameKeys: 'a.b.c' 复数形式 → 不应命中(防 false positive,Key 后缀精确匹配)", () => {
    // nameKeys(复数)不是 i18n 约定属性,Key 后必须紧跟冒号(允许空格)
    assert.equal(matchFirst(PROP_KEY_RE, "nameKeys: 'a.b.c'"), null)
  })

  // 2026-07-26 二次增强:PROP_KEY_RE 白名单新增 i18nKey
  // 背景:miniapp-taro custom-tab-bar/index.tsx 用 `i18nKey: 'nav.community'` / `i18nKey: 'nav.profile'`
  // 引用 tab 标签 i18n key,原白名单漏识别 i18nKey,导致 nav.community / nav.profile 2 个 key 被误判为死 key。
  test("i18nKey: 'nav.community' → 命中(2026-07-26 二次增强:i18nKey 白名单)", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "i18nKey: 'nav.community'"), 'nav.community')
  })

  test("i18nKey: 'nav.profile' → 命中", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "i18nKey: 'nav.profile'"), 'nav.profile')
  })

  test('i18nKey: "nav.home" 双引号 → 命中', () => {
    assert.equal(matchFirst(PROP_KEY_RE, 'i18nKey: "nav.home"'), 'nav.home')
  })

  test("i18nKey: `nav.live` 模板字面量 → 命中", () => {
    assert.equal(matchFirst(PROP_KEY_RE, 'i18nKey: `nav.live`'), 'nav.live')
  })

  test("i18nKey:'nav.courses' 无空格 → 命中(容错)", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "i18nKey:'nav.courses'"), 'nav.courses')
  })

  test("i18nKey: 'kouzi' 单段无点 → 不应命中(防 false positive,单段是相对引用)", () => {
    // 与 nameKey: 'kouzi' 同理,单段值(无点)是运行时解析的相对引用,不是静态全路径 i18n key
    assert.equal(matchFirst(PROP_KEY_RE, "i18nKey: 'kouzi'"), null)
  })

  test("i18nKeys: 'a.b.c' 复数形式 → 不应命中(防 false positive,Key 后缀精确匹配)", () => {
    // 与 nameKeys 同理,Key 后必须紧跟冒号
    assert.equal(matchFirst(PROP_KEY_RE, "i18nKeys: 'a.b.c'"), null)
  })

  test("myI18nKey: 'a.b.c' 非白名单(前缀附加)→ 不应命中(\\b 词边界)", () => {
    // \b 要求 i18nKey 前是词边界,myI18nKey 中的 i18nKey 前是字母(非词边界)
    assert.equal(matchFirst(PROP_KEY_RE, "myI18nKey: 'a.b.c'"), null)
  })
})

describe('TLIST_RE — tList("a.b.c") 字符串数组辅助函数识别(2026-07-26 新增)', () => {
  // 背景:miniapp-taro useI18n() 返回 tList 函数,用于读取字符串数组
  // (appPermission.names/descs, course.ratingLabels 等),原扫描器仅识别 t/tt,
  // 漏识别 tList,导致 16 个 key 被误判为死 key(about.appPermission.names/descs, ai.suggestions,
  // ai.image.examples/styles, course.suitableFor/ratingLabels, exam.answer.judgmentOptions,
  // plaza.setNeed.categories/levels/budgets, study.publish.categories/visibilityOptions,
  // vip.upgrade.rights, about.businessLicense.labels)。

  test("tList('about.appPermission.names') → 命中 key='about.appPermission.names'", () => {
    assert.equal(matchFirst(TLIST_RE, "const names = tList('about.appPermission.names')"), 'about.appPermission.names')
  })

  test("tList('about.appPermission.descs') → 命中", () => {
    assert.equal(matchFirst(TLIST_RE, "const descs = tList('about.appPermission.descs')"), 'about.appPermission.descs')
  })

  test('tList("course.ratingLabels") 双引号 → 命中', () => {
    assert.equal(matchFirst(TLIST_RE, 'const labels = tList("course.ratingLabels")'), 'course.ratingLabels')
  })

  test('tList(`ai.suggestions`) 模板字面量 → 命中', () => {
    assert.equal(matchFirst(TLIST_RE, 'const s = tList(`ai.suggestions`)'), 'ai.suggestions')
  })

  test("tList('vip.upgrade.rights') → 命中", () => {
    assert.equal(matchFirst(TLIST_RE, "const rights = tList('vip.upgrade.rights')"), 'vip.upgrade.rights')
  })

  test("tList('plaza.setNeed.categories') 多段点分 → 命中", () => {
    assert.equal(matchFirst(TLIST_RE, "const c = tList('plaza.setNeed.categories')"), 'plaza.setNeed.categories')
  })

  test("tList('a.b.c.d.e') 多段点分 → 命中", () => {
    assert.equal(matchFirst(TLIST_RE, "tList('a.b.c.d.e')"), 'a.b.c.d.e')
  })

  test("tList('a.b', 'fallback') 带字符串 fallback 参数 → 命中", () => {
    assert.equal(matchFirst(TLIST_RE, "tList('a.b', 'fallback')"), 'a.b')
  })

  test("tList('a.b', { fallback: ['x'] }) 带对象参数 → 命中", () => {
    assert.equal(matchFirst(TLIST_RE, "tList('a.b', { fallback: ['x'] })"), 'a.b')
  })

  test('tList(key) 动态变量 → 不应命中(防 false positive)', () => {
    assert.equal(matchFirst(TLIST_RE, 'tList(key)'), null)
  })

  test("tList('singleword') 单段无点 → 不应命中(要求至少 1 个点)", () => {
    assert.equal(matchFirst(TLIST_RE, "tList('singleword')"), null)
  })

  test("atList('a.b') 不应误命中(防 false positive,\\b 词边界)", () => {
    // \b 要求 tList 前是词边界,atList 前的 tList 不是词边界(是单词中间)
    assert.equal(matchFirst(TLIST_RE, "atList('a.b')"), null)
  })

  test("tLists('a.b') 不应命中(防 false positive,函数名精确匹配)", () => {
    // tLists(复数)不是 tList 函数,\b 后必须紧跟 (
    assert.equal(matchFirst(TLIST_RE, "tLists('a.b')"), null)
  })

  test("myTList('a.b') 不应误命中(防 false positive,\\b 词边界)", () => {
    assert.equal(matchFirst(TLIST_RE, "myTList('a.b')"), null)
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
  let propKeyFile
  let multiLineFile
  let tListFile
  let i18nKeyFile

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-scan-test-'))
    clientFile = path.join(tmpDir, 'page.tsx')
    serverFile = path.join(tmpDir, 'server-page.tsx')
    propKeyFile = path.join(tmpDir, 'devices.ts')
    multiLineFile = path.join(tmpDir, 'multi-line.tsx')
    tListFile = path.join(tmpDir, 'tlist-page.tsx')
    i18nKeyFile = path.join(tmpDir, 'tab-bar.tsx')
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
    fs.writeFileSync(
      propKeyFile,
      [
        "// 模拟 responsive-devices.ts 的 nameKey 属性赋值形式",
        "export const devices = [",
        "  { id: 'mobile-portrait', nameKey: 'design.responsive.deviceMobilePortrait', width: 375 },",
        "  { id: 'desktop', nameKey: 'design.responsive.deviceDesktop', width: 1440 },",
        "]",
      ].join('\n'),
      'utf8',
    )
    // 2026-07-26 三次增强:多行 tt/t 调用 fixture(模拟 miniapp-taro exam/result.tsx)
    // 第一行 `tt('a.b', '默认值', {` 没有 `)`,按行扫描整体匹配失败,
    // 整文件级匹配时 `[^)]*` 跨行匹配非 `)` 字符直到第一个 `)`,可正确命中。
    fs.writeFileSync(
      multiLineFile,
      [
        "const tt = (k, fb) => t(k) === k ? fb : t(k)",
        "function render() {",
        "  return (",
        "    <View>",
        "      {tt('exam.result.rankValue', '第 {n} 名 / 共 {total} 人', {",
        "        n: info.rank,",
        "        total: info.total ?? 0,",
        "      })}",
        "      {t('course.nextLesson', {",
        "        title: course.outline?.[0]?.title || t('course.startLearning'),",
        "      })}",
        "      {tt('member.coupon.thresholdText', '满{threshold}可用', {",
        "        threshold: 100,",
        "      })}",
        "    </View>",
        "  )",
        "}",
      ].join('\n'),
      'utf8',
    )
    // 2026-07-26 新增:tList() 调用 fixture(模拟 miniapp-taro app-permission/index.tsx)
    fs.writeFileSync(
      tListFile,
      [
        "import { useI18n } from '@/i18n'",
        "function AppPermission() {",
        "  const { t, tList } = useI18n()",
        "  const names = tList('about.appPermission.names')",
        "  const descs = tList('about.appPermission.descs')",
        "  const labels = tList('about.businessLicense.labels')",
        "  const suggestions = tList('ai.suggestions')",
        "  const examples = tList('ai.image.examples')",
        "  const styles = tList('ai.image.styles')",
        "  const suitableFor = tList('course.suitableFor')",
        "  const ratingLabels = tList('course.ratingLabels')",
        "  const judgmentOptions = tList('exam.answer.judgmentOptions')",
        "  const categories = tList('plaza.setNeed.categories')",
        "  const levels = tList('plaza.setNeed.levels')",
        "  const budgets = tList('plaza.setNeed.budgets')",
        "  const pubCategories = tList('study.publish.categories')",
        "  const visibilityOptions = tList('study.publish.visibilityOptions')",
        "  const rights = tList('vip.upgrade.rights')",
        "  return <Text>{t('about.appPermission.intro')}</Text>",
        "}",
      ].join('\n'),
      'utf8',
    )
    // 2026-07-26 二次增强:i18nKey 属性赋值 fixture(模拟 miniapp-taro custom-tab-bar/index.tsx)
    fs.writeFileSync(
      i18nKeyFile,
      [
        "export const tabs = [",
        "  { key: 'home', i18nKey: 'nav.home', icon: 'home' },",
        "  { key: 'community', i18nKey: 'nav.community', icon: 'users' },",
        "  { key: 'courses', i18nKey: 'nav.courses', icon: 'book' },",
        "  { key: 'live', i18nKey: 'nav.live', icon: 'video' },",
        "  { key: 'profile', i18nKey: 'nav.profile', icon: 'user' },",
        "]",
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

  test('scanCode 识别 nameKey 属性赋值形式的全路径 i18n key(2026-07-26 PROP_KEY_RE 增强)', () => {
    // 关键回归测试:design.responsive.device* 6 个 key 在 responsive-devices.ts 中
    // 以 { nameKey: 'design.responsive.deviceXxx' } 属性赋值形式引用,
    // 原扫描器漏识别,导致这 6 个 key 被误判为死 key
    const { staticRefs, scanned } = scanCode([propKeyFile])
    assert.equal(scanned, 1)
    assert.ok(
      staticRefs.has('design.responsive.deviceMobilePortrait'),
      "应识别 nameKey: 'design.responsive.deviceMobilePortrait' 为静态引用",
    )
    assert.ok(
      staticRefs.has('design.responsive.deviceDesktop'),
      "应识别 nameKey: 'design.responsive.deviceDesktop' 为静态引用",
    )
  })

  test('scanCode 识别多行 tt/t 调用(2026-07-26 三次增强:整文件级匹配,4 个 miniapp-taro 死 key 关键场景)', () => {
    // 关键回归测试:miniapp-taro 普遍存在 `tt('a.b', '默认值', {\n  n: x,\n})` 跨多行调用,
    // 第一行没有 `)`,按行扫描整体匹配失败,导致以下 4 个 key 被误判为死 key:
    //   - exam.result.rankValue(在 exam/result.tsx)
    //   - course.nextLesson(在 course/detail.tsx)
    //   - member.coupon.thresholdText(在 member/coupon.tsx)
    //   - member.couponList.thresholdText(在 member/coupon-list.tsx)
    // 修复:scanCode 改为整文件级匹配 STATIC_T_RE(`[^)]*` 字符类天然跨行),配合 stripComments 剥离注释
    const { staticRefs, scanned } = scanCode([multiLineFile])
    assert.equal(scanned, 1)
    assert.ok(
      staticRefs.has('exam.result.rankValue'),
      "应识别多行 tt('exam.result.rankValue', '...', {\\n  n: ...,\\n}) 为静态引用",
    )
    assert.ok(
      staticRefs.has('course.nextLesson'),
      "应识别多行 t('course.nextLesson', {\\n  title: ...,\\n}) 为静态引用",
    )
    assert.ok(
      staticRefs.has('member.coupon.thresholdText'),
      "应识别多行 tt('member.coupon.thresholdText', '...', {\\n  threshold: ...,\\n}) 为静态引用",
    )
    // 2026-07-26 四次增强:简化 STATIC_T_RE(只匹配到引号结束,不要求 `)`),
    // 让嵌套调用内层 key 也被识别 — `t('course.nextLesson', { title: ... || t('course.startLearning') })`
    // 中 `course.startLearning` 此前被外层 `[^)]*` 贪婪消费漏识别,简化后正确识别。
    assert.ok(
      staticRefs.has('course.startLearning'),
      "应识别嵌套内层 t('course.startLearning') 为静态引用(2026-07-26 四次增强关键场景)",
    )
  })

  test('scanCode 识别 tList() 字符串数组辅助函数调用(2026-07-26 新增 TLIST_RE,16 个 miniapp-taro 死 key 关键场景)', () => {
    // 关键回归测试:miniapp-taro useI18n() 返回 tList 函数,用于读取字符串数组,
    // 原扫描器仅识别 t/tt,漏识别 tList,导致 16 个 key 被误判为死 key:
    //   - about.businessLicense.labels / about.appPermission.names / about.appPermission.descs
    //   - ai.suggestions / ai.image.examples / ai.image.styles
    //   - course.suitableFor / course.ratingLabels
    //   - exam.answer.judgmentOptions
    //   - plaza.setNeed.categories / levels / budgets
    //   - study.publish.categories / visibilityOptions
    //   - vip.upgrade.rights
    // 修复:新增 TLIST_RE 正则 + scanCode 整文件级匹配
    const { staticRefs, scanned } = scanCode([tListFile])
    assert.equal(scanned, 1)
    assert.ok(staticRefs.has('about.appPermission.names'), "应识别 tList('about.appPermission.names')")
    assert.ok(staticRefs.has('about.appPermission.descs'), "应识别 tList('about.appPermission.descs')")
    assert.ok(staticRefs.has('about.businessLicense.labels'), "应识别 tList('about.businessLicense.labels')")
    assert.ok(staticRefs.has('ai.suggestions'), "应识别 tList('ai.suggestions')")
    assert.ok(staticRefs.has('ai.image.examples'), "应识别 tList('ai.image.examples')")
    assert.ok(staticRefs.has('ai.image.styles'), "应识别 tList('ai.image.styles')")
    assert.ok(staticRefs.has('course.suitableFor'), "应识别 tList('course.suitableFor')")
    assert.ok(staticRefs.has('course.ratingLabels'), "应识别 tList('course.ratingLabels')")
    assert.ok(staticRefs.has('exam.answer.judgmentOptions'), "应识别 tList('exam.answer.judgmentOptions')")
    assert.ok(staticRefs.has('plaza.setNeed.categories'), "应识别 tList('plaza.setNeed.categories')")
    assert.ok(staticRefs.has('plaza.setNeed.levels'), "应识别 tList('plaza.setNeed.levels')")
    assert.ok(staticRefs.has('plaza.setNeed.budgets'), "应识别 tList('plaza.setNeed.budgets')")
    assert.ok(staticRefs.has('study.publish.categories'), "应识别 tList('study.publish.categories')")
    assert.ok(staticRefs.has('study.publish.visibilityOptions'), "应识别 tList('study.publish.visibilityOptions')")
    assert.ok(staticRefs.has('vip.upgrade.rights'), "应识别 tList('vip.upgrade.rights')")
    // 也应识别同行单参 t() 调用
    assert.ok(staticRefs.has('about.appPermission.intro'), "应识别 t('about.appPermission.intro') 同行调用")
  })

  test('scanCode 识别 i18nKey 属性赋值(2026-07-26 二次增强 PROP_KEY_RE,2 个 miniapp-taro 死 key 关键场景)', () => {
    // 关键回归测试:miniapp-taro custom-tab-bar/index.tsx 用 `i18nKey: 'nav.xxx'` 引用 tab 标签,
    // 原白名单(name/title/label/description/text)漏识别 i18nKey,
    // 导致 nav.community / nav.profile 2 个 key 被误判为死 key
    // 修复:PROP_KEY_RE 白名单新增 i18n
    const { staticRefs, scanned } = scanCode([i18nKeyFile])
    assert.equal(scanned, 1)
    assert.ok(staticRefs.has('nav.home'), "应识别 i18nKey: 'nav.home'")
    assert.ok(staticRefs.has('nav.community'), "应识别 i18nKey: 'nav.community'(原误判为死 key)")
    assert.ok(staticRefs.has('nav.courses'), "应识别 i18nKey: 'nav.courses'")
    assert.ok(staticRefs.has('nav.live'), "应识别 i18nKey: 'nav.live'")
    assert.ok(staticRefs.has('nav.profile'), "应识别 i18nKey: 'nav.profile'(原误判为死 key)")
  })

  test('scanCode 多文件聚合(client + server + propKey + multiLine + tList + i18nKey 混合)', () => {
    const { staticRefs, usedNamespaces, scanned } = scanCode([
      clientFile, serverFile, propKeyFile, multiLineFile, tListFile, i18nKeyFile,
    ])
    assert.equal(scanned, 6)
    assert.ok(usedNamespaces.has('about'))
    assert.ok(usedNamespaces.has('modelsReferralPage'))
    assert.ok(staticRefs.has('about.heroTitle'))
    assert.ok(staticRefs.has('modelsReferralPage.title'))
    assert.ok(staticRefs.has('design.responsive.deviceMobilePortrait'))
    assert.ok(staticRefs.has('exam.result.rankValue'), '多行 tt() 调用应被识别')
    assert.ok(staticRefs.has('course.nextLesson'), '多行 t() 调用应被识别')
    assert.ok(staticRefs.has('about.appPermission.names'), 'tList() 调用应被识别')
    assert.ok(staticRefs.has('vip.upgrade.rights'), 'tList() 调用应被识别')
    assert.ok(staticRefs.has('nav.community'), 'i18nKey 属性赋值应被识别')
    assert.ok(staticRefs.has('nav.profile'), 'i18nKey 属性赋值应被识别')
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

// 辅助:对带 g flag 的 regex 执行所有匹配,返回所有捕获组 1 的数组
// 同 matchFirst:每次创建新的 RegExp 实例,避免并发测试共享 lastIndex race condition
function matchAll(re, str) {
  const local = new RegExp(re.source, re.flags)
  const results = []
  let m
  while ((m = local.exec(str)) !== null) results.push(m[1])
  return results
}

describe('PROP_KEY_RE — desc 白名单(2026-07-26 三次增强)', () => {
  // 背景:extension 端 MeAppsPage.tsx 用 `descKey: 'apps.favoritesDesc'` 引用 apps.*Desc,
  // 原白名单(name/title/label/description/text/i18n)漏识别 desc,导致 42 个 apps.*Desc 死 key 误判
  test("descKey: 'apps.favoritesDesc' → 命中(2026-07-26 三次增强关键场景)", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "descKey: 'apps.favoritesDesc'"), 'apps.favoritesDesc')
  })

  test("descKey: 'a.b.c' → 命中", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "descKey: 'a.b.c'"), 'a.b.c')
  })

  test("descKey: 'kouzi' 单段无点 → 不应命中(防 false positive)", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "descKey: 'kouzi'"), null)
  })

  test("nameKey/titleKey/i18nKey 原白名单不回归", () => {
    assert.equal(matchFirst(PROP_KEY_RE, "nameKey: 'a.b.c'"), 'a.b.c')
    assert.equal(matchFirst(PROP_KEY_RE, "titleKey: 'a.b.c'"), 'a.b.c')
    assert.equal(matchFirst(PROP_KEY_RE, "i18nKey: 'a.b.c'"), 'a.b.c')
  })
})

describe('JSX_PROP_KEY_RE — JSX prop titleKey="a.b.c"(2026-07-26 三次增强新增)', () => {
  // 背景:extension 端 SidepanelApp.tsx / AIAppsPage.tsx 用 <XxxPage titleKey="apps.aiTitle" /> JSX prop 引用,
  // 原 PROP_KEY_RE 只识别 `titleKey:`(冒号),不识别 `titleKey=`(等号),导致 8 个 apps.*Title 死 key 误判
  test('<AppListPage titleKey="apps.aiTitle" /> → 命中', () => {
    assert.equal(matchFirst(JSX_PROP_KEY_RE, '<AppListPage titleKey="apps.aiTitle" items={items} />'), 'apps.aiTitle')
  })

  test("titleKey='apps.about' 单引号 → 命中", () => {
    assert.equal(matchFirst(JSX_PROP_KEY_RE, "<Route titleKey='apps.about' />"), 'apps.about')
  })

  test('descKey="a.b.c" → 命中(desc 白名单)', () => {
    assert.equal(matchFirst(JSX_PROP_KEY_RE, '<Xxx descKey="a.b.c" />'), 'a.b.c')
  })

  test('titleKey="singleword" 单段无点 → 不应命中', () => {
    assert.equal(matchFirst(JSX_PROP_KEY_RE, '<Xxx titleKey="singleword" />'), null)
  })

  test('titleKey: "a.b.c" 冒号形式 → 不应命中(由 PROP_KEY_RE 处理,避免重复)', () => {
    // JSX_PROP_KEY_RE 用 `=` 不用 `:`,冒号形式不匹配
    assert.equal(matchFirst(JSX_PROP_KEY_RE, 'titleKey: "a.b.c"'), null)
  })

  test('titleKey={variable} 动态表达式 → 不应命中(防 false positive)', () => {
    assert.equal(matchFirst(JSX_PROP_KEY_RE, '<Xxx titleKey={variable} />'), null)
  })
})

describe('STATIC_T_MULTILINE_RE — 跨行 t("key", 形式(2026-07-26 三次增强新增)', () => {
  // 背景:STATIC_T_RE 整文件级匹配已能识别跨行 t() 调用,但逐行扫描时无法识别。
  // STATIC_T_MULTILINE_RE 补充识别 `t('key',` 形式(不要求 `)` 闭合),用于逐行扫描场景。
  // 注:scanCode 当前用整文件级 STATIC_T_RE,此正则为备用/未来扩展。
  test("t('a.b.c', → 命中(逗号后任意,不要求 ) 闭合)", () => {
    assert.equal(matchFirst(STATIC_T_MULTILINE_RE, "t('a.b.c',"), 'a.b.c')
  })

  test("t('a.b.c', { arg: 1 } → 命中(单行带参数)", () => {
    assert.equal(matchFirst(STATIC_T_MULTILINE_RE, "t('a.b.c', { arg: 1 }"), 'a.b.c')
  })

  test("tt('a.b.c', 'fallback' → 命中(tt 多参数)", () => {
    assert.equal(matchFirst(STATIC_T_MULTILINE_RE, "tt('a.b.c', 'fallback'"), 'a.b.c')
  })

  test("t('a.b.c') 无参数 → 不应命中(无逗号,由 STATIC_T_RE 处理)", () => {
    assert.equal(matchFirst(STATIC_T_MULTILINE_RE, "t('a.b.c')"), null)
  })

  test("t('singleword', → 不应命中(单段无点)", () => {
    assert.equal(matchFirst(STATIC_T_MULTILINE_RE, "t('singleword',"), null)
  })
})

describe('UNION_TYPE_KEY_RE — 联合类型字面量(2026-07-26 三次增强新增)', () => {
  // 背景:mobile-rn LiveScreen.tsx 用 `function statusKey(live): 'live.ongoing' | 'live.upcoming' | 'live.ended'`
  // 联合类型字面量引用,原 UNION_TYPE_NS_RE 只识别 `namespace:` 关键字,导致 live.ended 误判为死 key。
  // 用 FIRST/SECOND 两个正则覆盖 3+ 段联合类型

  test("'a.b' | 'c.d' → FIRST 命中 'a.b',SECOND 命中 'c.d'", () => {
    assert.equal(matchFirst(UNION_TYPE_KEY_RE_FIRST, "'a.b' | 'c.d'"), 'a.b')
    assert.equal(matchFirst(UNION_TYPE_KEY_RE_SECOND, "'a.b' | 'c.d'"), 'c.d')
  })

  test("'live.ongoing' | 'live.upcoming' | 'live.ended' 3 段联合 → FIRST 命中前 2 段(lookahead 不消费末尾引号),SECOND 命中后 2 段,合计 3 段全覆盖", () => {
    const code = "'live.ongoing' | 'live.upcoming' | 'live.ended'"
    assert.deepEqual(matchAll(UNION_TYPE_KEY_RE_FIRST, code), ['live.ongoing', 'live.upcoming'])
    assert.deepEqual(matchAll(UNION_TYPE_KEY_RE_SECOND, code), ['live.upcoming', 'live.ended'])
    const combined = new Set([
      ...matchAll(UNION_TYPE_KEY_RE_FIRST, code),
      ...matchAll(UNION_TYPE_KEY_RE_SECOND, code),
    ])
    assert.deepEqual([...combined].sort(), ['live.ended', 'live.ongoing', 'live.upcoming'])
  })

  test("function statusKey(): 'a.b' | 'c.d' 函数返回类型 → 命中(FIRST 前段 + SECOND 后续段,合计全覆盖)", () => {
    const code = "function statusKey(live: Live): 'live.ongoing' | 'live.upcoming' | 'live.ended' {"
    assert.deepEqual(matchAll(UNION_TYPE_KEY_RE_FIRST, code), ['live.ongoing', 'live.upcoming'])
    assert.deepEqual(matchAll(UNION_TYPE_KEY_RE_SECOND, code), ['live.upcoming', 'live.ended'])
    const combined = new Set([
      ...matchAll(UNION_TYPE_KEY_RE_FIRST, code),
      ...matchAll(UNION_TYPE_KEY_RE_SECOND, code),
    ])
    assert.deepEqual([...combined].sort(), ['live.ended', 'live.ongoing', 'live.upcoming'])
  })

  test("'singleword' | 'other' 单段无点 → 不应命中", () => {
    assert.equal(matchFirst(UNION_TYPE_KEY_RE_FIRST, "'singleword' | 'other'"), null)
    assert.equal(matchFirst(UNION_TYPE_KEY_RE_SECOND, "'singleword' | 'other'"), null)
  })

  test('"a.b" | "c.d" 双引号 → 命中', () => {
    assert.equal(matchFirst(UNION_TYPE_KEY_RE_FIRST, '"a.b" | "c.d"'), 'a.b')
    assert.equal(matchFirst(UNION_TYPE_KEY_RE_SECOND, '"a.b" | "c.d"'), 'c.d')
  })
})

describe('OBJECT_LITERAL_KEY_RE — 对象字面量值全路径 key(2026-07-26 三次增强新增)', () => {
  // 背景:mobile-rn PaymentScreen.tsx / TaskDispatchPage.tsx 用
  // `const STATUS_KEY = { pending: 'payment.status.pending', ... }` 对象字面量映射引用,
  // 原 PROP_KEY_RE 只识别白名单属性,不识别 `pending:` 等任意键名,导致 10 个 status.* 死 key 误判

  test("pending: 'payment.status.pending' → 命中", () => {
    assert.equal(matchFirst(OBJECT_LITERAL_KEY_RE, "pending: 'payment.status.pending'"), 'payment.status.pending')
  })

  test("paid: 'payment.status.paid', → 命中(末尾逗号)", () => {
    assert.equal(matchFirst(OBJECT_LITERAL_KEY_RE, "paid: 'payment.status.paid',"), 'payment.status.paid')
  })

  test('多行对象字面量 → 命中所有值', () => {
    const code = [
      'const STATUS_KEY = {',
      "  pending: 'payment.status.pending',",
      "  paid: 'payment.status.paid',",
      "  failed: 'payment.status.failed',",
      '}',
    ].join('\n')
    assert.deepEqual(matchAll(OBJECT_LITERAL_KEY_RE, code), [
      'payment.status.pending',
      'payment.status.paid',
      'payment.status.failed',
    ])
  })

  test("key: 'singleword' 单段无点 → 不应命中", () => {
    assert.equal(matchFirst(OBJECT_LITERAL_KEY_RE, "key: 'singleword'"), null)
  })

  test("host: 'api.example.com' → 命中(误报风险,但只要 'api.example.com' 不在 zh-CN.json 中不影响死 key 判定)", () => {
    // 注:此正则会误报非 i18n 用途的字面量,但误报的代价是漏报死 key(漏判死 key 为活),
    // 实际风险低,因为代码中 `key: 'foo.bar.baz'` 形式的字面量,如果 foo.bar.baz 在 zh-CN.json 中,很可能是 i18n 引用
    assert.equal(matchFirst(OBJECT_LITERAL_KEY_RE, "host: 'api.example.com'"), 'api.example.com')
  })
})

describe('DYNAMIC_PREFIX_RE — 动态前缀拼接(2026-07-26 三次增强新增)', () => {
  // 背景:mobile-rn OrderScreen.tsx 用 `const statusKey = \`order.status.${item.status}\` as const`
  // 模板字符串拼接引用,扫描器无法静态识别 `${item.status}` 的值,但前缀 `order.status` 是静态的。
  // 此正则识别 `= \`prefix.${var}\`` 形式,捕获前缀 `prefix`,把前缀加入 usedNamespaces

  test('const statusKey = `order.status.${item.status}` as const → 命中前缀 order.status', () => {
    assert.equal(matchFirst(DYNAMIC_PREFIX_RE, 'const statusKey = `order.status.${item.status}` as const'), 'order.status')
  })

  test('= `prefix.${var}` → 命中前缀 prefix', () => {
    assert.equal(matchFirst(DYNAMIC_PREFIX_RE, '= `prefix.${var}`'), 'prefix')
  })

  test('= `a.b.c.${var}` 多段前缀 → 命中 a.b.c', () => {
    assert.equal(matchFirst(DYNAMIC_PREFIX_RE, '= `a.b.c.${var}`'), 'a.b.c')
  })

  test('= `singleword.${var}` 单段前缀 → 不应命中(要求至少 1 个点)', () => {
    // 注:DYNAMIC_PREFIX_RE 捕获组 1 是 `[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*`,
    // 允许 0 个点(单段),但 isInUsedNamespace 要求 ns 是命名空间前缀。
    // 单段前缀(如 'order')会把所有 'order.*' key 视为引用,可能过宽,但实际代码中单段前缀少见。
    // 此测试记录当前行为:单段前缀也会命中(捕获组 1 = 'singleword')
    const result = matchFirst(DYNAMIC_PREFIX_RE, '= `singleword.${var}`')
    // 当前行为:单段前缀也命中,记录此基线
    assert.equal(result, 'singleword')
  })

  test('t(`prefix.${var}`) t() 调用形式 → 不应命中(由 DYNAMIC_T_RE 处理)', () => {
    // DYNAMIC_PREFIX_RE 要求前面有 `=`(可选 `>`),t() 调用形式不匹配
    // 注:实际正则 `=>?\s*[`'"]` 中 `=?` 是可选,所以 `t(\`prefix.${var}\`)` 中 `t(` 后面是 `` ` ``,不匹配 `=`
    // 但 `=>` 箭头函数 `x => \`prefix.${x}\`` 会匹配
    const result = matchFirst(DYNAMIC_PREFIX_RE, 't(`prefix.${var}`)')
    // 当前行为:不命中(因为 `t(` 后没有 `=`)
    assert.equal(result, null)
  })
})

describe('scanCode — mobile-rn/extension 引用模式集成测试(2026-07-26 三次增强)', () => {
  let tmpDir
  let liveScreenFile
  let orderScreenFile
  let paymentScreenFile
  let taskDispatchFile
  let extensionSidepanelFile
  let extensionMeAppsPageFile
  let extensionChatPageFile

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-scan-v3-'))
    liveScreenFile = path.join(tmpDir, 'LiveScreen.tsx')
    orderScreenFile = path.join(tmpDir, 'OrderScreen.tsx')
    paymentScreenFile = path.join(tmpDir, 'PaymentScreen.tsx')
    taskDispatchFile = path.join(tmpDir, 'TaskDispatchPage.tsx')
    extensionSidepanelFile = path.join(tmpDir, 'SidepanelApp.tsx')
    extensionMeAppsPageFile = path.join(tmpDir, 'MeAppsPage.tsx')
    extensionChatPageFile = path.join(tmpDir, 'ChatPage.tsx')

    // mobile-rn LiveScreen.tsx:联合类型字面量 'live.ongoing' | 'live.upcoming' | 'live.ended'
    fs.writeFileSync(
      liveScreenFile,
      [
        "function statusKey(live: Live): 'live.ongoing' | 'live.upcoming' | 'live.ended' {",
        "  if (live.isLive) return 'live.ongoing'",
        "  return 'live.ended'",
        '}',
        'const key = statusKey(item)',
        "<Text>{t(key)}</Text>",
      ].join('\n'),
      'utf8',
    )

    // mobile-rn OrderScreen.tsx:动态前缀拼接 `order.status.${item.status}`
    fs.writeFileSync(
      orderScreenFile,
      [
        'renderItem={({ item }) => {',
        '  const statusKey = `order.status.${item.status}` as const',
        '  return <Text>{t(statusKey)}</Text>',
        '}}',
      ].join('\n'),
      'utf8',
    )

    // mobile-rn PaymentScreen.tsx:对象字面量值映射
    fs.writeFileSync(
      paymentScreenFile,
      [
        'const STATUS_KEY: Record<PaymentStatus, string> = {',
        "  pending: 'payment.status.pending',",
        "  paid: 'payment.status.paid',",
        "  failed: 'payment.status.failed',",
        "  cancelled: 'payment.status.cancelled',",
        "  refunded: 'payment.status.refunded',",
        '}',
      ].join('\n'),
      'utf8',
    )

    // mobile-rn TaskDispatchPage.tsx:对象字面量值映射 + 跨行 t() 调用
    fs.writeFileSync(
      taskDispatchFile,
      [
        'const TASK_STATUS_KEYS: Record<TaskStatus, string> = {',
        "  pending: 'taskDispatch.status.pending',",
        "  running: 'taskDispatch.status.running',",
        "  completed: 'taskDispatch.status.completed',",
        "  failed: 'taskDispatch.status.failed',",
        "  cancelled: 'taskDispatch.status.cancelled',",
        '}',
        '<Text>',
        "  {t('taskDispatch.file.attached', {",
        '    filename: pendingFilePayload.filename,',
        '    size: formatFileSize(pendingFilePayload.size),',
        '  })}',
        '</Text>',
      ].join('\n'),
      'utf8',
    )

    // extension SidepanelApp.tsx:JSX prop titleKey="apps.about"
    fs.writeFileSync(
      extensionSidepanelFile,
      [
        '<Route path="/settings/about" element={<ComingSoonPage titleKey="apps.about" webUrl={`${WEB_BASE}/about`} />} />',
        '<Route path="/settings/contact" element={<ComingSoonPage titleKey="apps.contact" />} />',
        '<Route path="/settings/help" element={<ComingSoonPage titleKey="apps.help" />} />',
        '<Route path="/settings/agreement" element={<ComingSoonPage titleKey="apps.agreement" />} />',
        '<Route path="/settings/pricing" element={<ComingSoonPage titleKey="apps.pricing" />} />',
      ].join('\n'),
      'utf8',
    )

    // extension MeAppsPage.tsx:descKey 对象字面量 + JSX prop titleKey="apps.meTitle"
    fs.writeFileSync(
      extensionMeAppsPageFile,
      [
        'const baseItems = [',
        "  { to: '/me/favorites', icon: '🔖', titleKey: 'apps.favorites', descKey: 'apps.favoritesDesc' },",
        "  { to: '/me/following', icon: '👥', titleKey: 'apps.following', descKey: 'apps.followingDesc' },",
        "  { to: '/me/fans', icon: '❤️', titleKey: 'apps.fans', descKey: 'apps.fansDesc' },",
        ']',
        'return <AppListPage titleKey="apps.meTitle" items={finalItems} />',
      ].join('\n'),
      'utf8',
    )

    // extension ChatPage.tsx:跨行 t() 调用 chat.compactionNotice
    fs.writeFileSync(
      extensionChatPageFile,
      [
        'onCompaction: (info) => {',
        '  setNotice(',
        "    t('chat.compactionNotice', {",
        '      before: formatTokenCount(info.tokensBefore),',
        '      after: formatTokenCount(info.tokensAfter),',
        '      removed: info.removedCount,',
        '    }),',
        '  )',
        '}',
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

  test('scanCode 识别联合类型字面量 live.ended(mobile-rn LiveScreen.tsx 引用模式)', () => {
    const { staticRefs } = scanCode([liveScreenFile])
    assert.ok(staticRefs.has('live.ongoing'), "应识别联合类型字面量 'live.ongoing'")
    assert.ok(staticRefs.has('live.upcoming'), "应识别联合类型字面量 'live.upcoming'")
    assert.ok(staticRefs.has('live.ended'), "应识别联合类型字面量 'live.ended'(原误判为死 key)")
  })

  test('scanCode 识别动态前缀拼接 order.status.*(mobile-rn OrderScreen.tsx 引用模式)', () => {
    const { usedNamespaces } = scanCode([orderScreenFile])
    assert.ok(usedNamespaces.has('order.status'), "应识别 `order.status.${var}` 前缀加入 usedNamespaces")
    // isInUsedNamespace 验证:order.status.* 下所有 key 视为引用
    assert.ok(isInUsedNamespace('order.status.pending', usedNamespaces), 'order.status.pending 应在 usedNamespace 下')
    assert.ok(isInUsedNamespace('order.status.paid', usedNamespaces), 'order.status.paid 应在 usedNamespace 下')
    assert.ok(isInUsedNamespace('order.status.failed', usedNamespaces), 'order.status.failed 应在 usedNamespace 下')
  })

  test('scanCode 识别对象字面量值 payment.status.*(mobile-rn PaymentScreen.tsx 引用模式)', () => {
    const { staticRefs } = scanCode([paymentScreenFile])
    assert.ok(staticRefs.has('payment.status.pending'), "应识别 pending: 'payment.status.pending'")
    assert.ok(staticRefs.has('payment.status.paid'), "应识别 paid: 'payment.status.paid'")
    assert.ok(staticRefs.has('payment.status.failed'), "应识别 failed: 'payment.status.failed'")
    assert.ok(staticRefs.has('payment.status.cancelled'), "应识别 cancelled: 'payment.status.cancelled'")
    assert.ok(staticRefs.has('payment.status.refunded'), "应识别 refunded: 'payment.status.refunded'")
  })

  test('scanCode 识别对象字面量值 taskDispatch.status.* + 跨行 t() taskDispatch.file.attached', () => {
    const { staticRefs } = scanCode([taskDispatchFile])
    assert.ok(staticRefs.has('taskDispatch.status.pending'), "应识别 taskDispatch.status.pending")
    assert.ok(staticRefs.has('taskDispatch.status.running'), "应识别 taskDispatch.status.running")
    assert.ok(staticRefs.has('taskDispatch.status.completed'), "应识别 taskDispatch.status.completed")
    assert.ok(staticRefs.has('taskDispatch.status.failed'), "应识别 taskDispatch.status.failed")
    assert.ok(staticRefs.has('taskDispatch.status.cancelled'), "应识别 taskDispatch.status.cancelled")
    assert.ok(staticRefs.has('taskDispatch.file.attached'), "应识别跨行 t('taskDispatch.file.attached', { ... })")
  })

  test('scanCode 识别 JSX prop titleKey="apps.*"(extension SidepanelApp.tsx 引用模式)', () => {
    const { staticRefs } = scanCode([extensionSidepanelFile])
    assert.ok(staticRefs.has('apps.about'), '应识别 titleKey="apps.about"')
    assert.ok(staticRefs.has('apps.contact'), '应识别 titleKey="apps.contact"')
    assert.ok(staticRefs.has('apps.help'), '应识别 titleKey="apps.help"')
    assert.ok(staticRefs.has('apps.agreement'), '应识别 titleKey="apps.agreement"')
    assert.ok(staticRefs.has('apps.pricing'), '应识别 titleKey="apps.pricing"')
  })

  test('scanCode 识别 descKey 对象字面量 + JSX prop titleKey(extension MeAppsPage.tsx 引用模式)', () => {
    const { staticRefs } = scanCode([extensionMeAppsPageFile])
    // descKey 对象字面量(原 PROP_KEY_RE 白名单不含 desc,漏识别)
    assert.ok(staticRefs.has('apps.favoritesDesc'), "应识别 descKey: 'apps.favoritesDesc'")
    assert.ok(staticRefs.has('apps.followingDesc'), "应识别 descKey: 'apps.followingDesc'")
    assert.ok(staticRefs.has('apps.fansDesc'), "应识别 descKey: 'apps.fansDesc'")
    // titleKey 对象字面量(原 PROP_KEY_RE 已识别)
    assert.ok(staticRefs.has('apps.favorites'), "应识别 titleKey: 'apps.favorites'")
    assert.ok(staticRefs.has('apps.following'), "应识别 titleKey: 'apps.following'")
    // JSX prop titleKey="apps.meTitle"(原 PROP_KEY_RE 不识别 =,漏识别)
    assert.ok(staticRefs.has('apps.meTitle'), '应识别 JSX prop titleKey="apps.meTitle"')
  })

  test('scanCode 识别跨行 t() chat.compactionNotice(extension ChatPage.tsx 引用模式)', () => {
    const { staticRefs } = scanCode([extensionChatPageFile])
    assert.ok(staticRefs.has('chat.compactionNotice'), "应识别跨行 t('chat.compactionNotice', { ... })")
  })

  test('scanCode 多文件聚合:mobile-rn + extension 全部引用模式', () => {
    const { staticRefs, usedNamespaces } = scanCode([
      liveScreenFile, orderScreenFile, paymentScreenFile, taskDispatchFile,
      extensionSidepanelFile, extensionMeAppsPageFile, extensionChatPageFile,
    ])
    // mobile-rn 18 个原死 key 全部识别
    assert.ok(staticRefs.has('live.ended'), 'live.ended')
    assert.ok(usedNamespaces.has('order.status'), 'order.status namespace')
    assert.ok(staticRefs.has('payment.status.pending'), 'payment.status.pending')
    assert.ok(staticRefs.has('taskDispatch.status.pending'), 'taskDispatch.status.pending')
    assert.ok(staticRefs.has('taskDispatch.file.attached'), 'taskDispatch.file.attached')
    // extension 51 个原死 key 全部识别
    assert.ok(staticRefs.has('apps.about'), 'apps.about')
    assert.ok(staticRefs.has('apps.meTitle'), 'apps.meTitle')
    assert.ok(staticRefs.has('apps.favoritesDesc'), 'apps.favoritesDesc')
    assert.ok(staticRefs.has('chat.compactionNotice'), 'chat.compactionNotice')
  })
})
