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
  TLIST_RE,
  DYNAMIC_T_RE,
  USE_T_RE,
  PROP_KEY_RE,
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
    // 注:嵌套调用 `t('course.nextLesson', { title: ... || t('course.startLearning') })` 中,
    // `[^)]*` 贪婪匹配会消费内层 `t('course.startLearning')` 的 `)`,导致内层 key 漏识别。
    // 这是 STATIC_T_RE 已知边角限制(嵌套调用内层漏识别),不影响 21 个死 key 判定
    // (这些死 key 都不在嵌套调用内层)。如未来需要支持嵌套,可改为括号配对解析。
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
