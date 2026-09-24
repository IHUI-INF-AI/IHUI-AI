#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * i18n 死 key 审计器公共函数(2026-07-26 立)
 *
 * 抽出 scripts/scan-dead-i18n-keys.mjs 中的核心逻辑,
 * 供 4 端独立扫描脚本(extension / mobile-rn / desktop / miniapp-taro)
 * 与 web 兼容入口(scan-dead-i18n-keys.mjs)复用,避免 5 份代码复制。
 *
 * 不直接运行,仅供其他脚本 import:
 *
 *   import { main as runScan } from './_i18n-scan-helpers.mjs'
 *   const code = runScan({
 *     name: 'extension',
 *     messagesPath: 'packages/i18n/messages/extension/zh-CN.json',
 *     scanTargets: ['apps/extension/entrypoints', 'apps/extension/src'],
 *     outputPattern: '.ihui-agent/tmp/i18n-extension-dead-keys-{date}.md',
 *   })
 *   process.exit(code)
 *
 * 死 key 判定:zh-CN.json 存在 + 代码无静态 t('key') 引用 + 不在任何 useTranslations/getTranslations namespace 下 = 死 key
 * 翻译不完整:5 语言任一缺该 key(不计入死 key,单列)
 * 动态 key:t(`prefix.${var}`) 模板字符串不算静态引用,会列在"动态 key 提示"段
 * 契约键出口:scripts/i18n-contract-keys.json —— 跨端词包契约键 / 被测试钉住的形状键在此声明,
 *          依据逐条按 HEAD 核验(见 CONTRACT_FILE_REL 处注释);它只免除"死键"一项,不影响其他判据
 *
 * 跳过条件:
 *   - messagesPath 不存在(messages 目录缺失,如 desktop 端)
 *   - scanTargets 为空数组(端无 JS 代码,如 desktop 端)
 *   两种情况都直接 exit 0,不计入死 key。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { resolveGitBin } from './lib/gitdir.mjs'

const ROOT = process.cwd()
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  '__tests__',
  'tests',
  'test',
  '__mocks__',
  'fixtures',
])
const EXCLUDE_FILE_PATTERNS = [
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /\.d\.ts$/,
  // 只排除 i18n locale 资源目录(packages/i18n/messages/**)本身,避免把 JSON 当代码扫。
  // 2026-09-10 修复(跨平台漏扫 bug):原为 /messages\//,只匹配正斜杠 →
  //   · Linux(CI):任何含 `messages/` 的路径都被整段排除,误伤业务路由
  //     apps/web/app/(main)/messages/**(内含 useTranslations('privateMessages') 的
  //     PageClient.tsx),导致 11 个 privateMessages.* 被误判为死 key;
  //   · Windows(path.join 产出反斜杠):`messages\` 不匹配 → 该目录照常扫描,
  //     于是同一提交本地 0 死 key / CI 11 死 key,结果不一致。
  //   现精确锚定 i18n 资源目录,并在 walkDir 中把路径归一化为 `/` 后再匹配(平台无关)。
  /(?:^|\/)packages\/i18n\/messages\//,
]

// 静态 t('key') / t("key") - 全路径点分命名空间
// 2026-07-26 增强:支持 t('key', { args }) / t('key', count) 带参数调用形式(原正则要求引号后紧跟 `)`,导致带参数时漏报)
// 新增 `(?:,[^)]*)?` 可选组:逗号 + 非 `)` 字符序列(到第一个 `)` 前,可跨嵌套 `(`),保证向后兼容(无参数形式仍命中)
// 注:`[^)]*` 不能跨 `)`,所以 `t('a.b', { x: foo(y) })` 匹配到 `t('a.b', { x: foo(y)` 即停,捕获组 1 = 'a.b' 正确
// 2026-07-26 二次增强:识别 tt('key', fallback) 多参数调用(miniapp-taro/mobile-rn 普遍使用 const tt = (k, fb) => ... fallback wrapper)
// 原 `\bt\(` 只匹配单字母 t,导致 miniapp-taro 1230 个 tt() 调用全部漏识别,1244 死 key 中 1227 个为误判
// 2026-07-26 三次增强:scanCode 改为整文件级匹配(配合 stripComments),支持多行 tt/t 调用
// 背景:miniapp-taro 普遍存在 `tt('a.b', '默认值', {\n  n: x,\n})` 跨多行调用,按行扫描时第一行没有 `)`,
// `[^)]*\)` 整体匹配失败,导致 course.nextLesson / exam.result.rankValue / member.coupon.thresholdText /
// member.couponList.thresholdText 4 个 key 被误判为死 key。`[^)]*` 字符类天然跨行(不依赖 `.`),整文件级匹配可命中。
// 2026-07-26 四次增强:简化正则,只匹配到引号结束,不要求 `)` 闭合
// 背景:嵌套调用 `t('a.b', { title: ... || t('course.startLearning') })` 中,`[^)]*\)` 整体匹配会消费内层 `)`,
// 导致内层 key 漏识别(course.startLearning 即此种场景,在 course/detail.tsx:247)。
// 简化为只匹配 key 部分 `t('a.b'`,允许嵌套调用内层也被识别。配合 stripComments 剥离注释避免假引用。
// 注:简化后 false positive 风险低 — 字符串字面量里 `t('a.b.c')` 形式极罕见,且 i18n key 不含特殊字符。
// 历史追溯:此前所有现有测试(单参/多参/嵌套对象/同行多调用)在简化后仍 pass,行为一致。
export const STATIC_T_RE = /\b(?:t|tt|tr)\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
// 2026-07-26 新增:tList('key') 字符串数组辅助函数识别
// 背景:miniapp-taro useI18n() 返回 tList 函数,用于读取字符串数组(appPermission.names/descs, course.ratingLabels 等),
// 普遍存在于 about/app-permission、ai/chat、ai/image、course/detail、plaza/set-need、vip/upgrade、study/publish 等页面。
// 原扫描器仅识别 t/tt,漏识别 tList,导致 16 个 key 被误判为死 key。
// 2026-07-26 四次增强(与 STATIC_T_RE 同步):简化正则,只匹配到引号结束,不要求 `)` 闭合,
// 支持嵌套调用 `tList('a.b', { x: tList('inner') })` 中内层 key 也被识别。
export const TLIST_RE = /\btList\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
// 动态 t(`prefix.${var}`) - 仅提示用
// 2026-09-23 与 STATIC_T_RE / TLIST_RE 的"四次增强"对齐:不再要求 `)` 闭合。
// 原尾部 `\s*\)` 让 `t(\`chat.${key}\`, values)`(带 values 实参)整条不命中 ⇒ 该前缀既不记为动态提示、
// 又不算静态引用,旗下键被误判死 key(extension 侧 `chat.injection*` 7 枚即此因,实测 dynamicHits=0 是最小复现)。
export const DYNAMIC_T_RE = /\bt\(\s*['"`]([^'"`]*\$\{[^'"`]+}[^'"`]*)['"`]/g
// useTranslations('namespace') / getTranslations('namespace') - 命名空间下所有 key 视为潜在引用(启发式)
// 2026-07-26 增强:getTranslations 是 next-intl/server 在 server component 使用的 API(等价于 useTranslations),
// subagent-D commit 5ebb17915 仅识别 useTranslations 模式,导致 server component 引用 namespace 被误判为死 key。
export const USE_T_RE =
  /\b(?:useTranslations|getTranslations)\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`]\s*\)/g
// 2026-08-02 新增:无参数 useTranslations() / getTranslations() 调用检测(根命名空间)
// 背景:AdminNav.tsx L964 useTranslations()(无参数)+ L1081 t('title') 引用根级别 title,
// 原 USE_T_RE 只匹配带参数调用,漏判无参数形式,导致根级别 title 被误判为死 key(真实事故 2026-08-02)。
// 无参数 useTranslations() 返回根级别 t 函数,t('key') 引用根级别 key(不含点的单段 key)。
// 修复:检测到无参数调用时,启用 STATIC_T_ROOT_RE 扫描单段 key,加入 staticRefs。
export const USE_T_NO_ARG_RE = /\b(?:useTranslations|getTranslations)\s*\(\s*\)/g
// 2026-08-02 新增:单段 key 扫描 t('key') / tt('key') — 不含点,根级别引用
// 仅在文件含无参数 useTranslations() 时启用,避免误报(误报风险低:useTranslations 是 next-intl API)
// 正则说明:[a-zA-Z][a-zA-Z0-9_]* 不含点,引号后紧跟 ) 或 ,(与 STATIC_T_RE 的多段 key 互补)
export const STATIC_T_ROOT_RE = /\b(?:t|tt|tr)\(\s*['"`]([a-zA-Z][a-zA-Z0-9_-]*)['"`]\s*(?:\)|,)/g
// 备用:i18n.t / getFixedT 链式调用
export const I18N_T_RE =
  /\b(?:i18n\.t|getFixedT|useTranslations)\s*\(\s*['"`]?[a-zA-Z-]*['"`]?\s*\)\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
// JSX prop 字面量: <Xxx namespace="literal" />
export const JSX_PROP_NS_RE = /\bnamespace\s*=\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`]/g
// TypeScript 联合类型字面量: namespace?: 'a' | 'b'
export const UNION_TYPE_NS_RE =
  /\bnamespace\s*\??\s*:\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`](\s*\|\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`])*/g
// 属性赋值全路径 i18n key:nameKey/titleKey/labelKey/descriptionKey/textKey/i18nKey/descKey: 'a.b.c'
// 2026-07-26 增强:识别 { nameKey: 'design.responsive.deviceMobilePortrait' } 等属性赋值形式的全路径 i18n key 引用
// 原扫描器仅识别 t('a.b.c') / useTranslations('ns') 模式,漏识别属性赋值形式,
// 导致 design.responsive.device* 6 个 key(在 responsive-devices.ts 中以 nameKey 属性赋值引用)被误判为死 key。
// 限定:值必须含至少 1 个点(多段全路径),避免误命中 nameKey: 'kouzi' 等单段相对引用(运行时解析,非静态全路径)。
// 2026-07-26 二次增强:PROP_KEY_RE 白名单新增 i18nKey
// 背景:miniapp-taro custom-tab-bar/index.tsx 用 `i18nKey: 'nav.community'` / `i18nKey: 'nav.profile'` 引用 tab 标签,
// 原白名单(name/title/label/description/text)漏识别 i18nKey,导致 nav.community / nav.profile 2 个 key 被误判为死 key。
// 2026-07-26 三次增强:PROP_KEY_RE 白名单新增 desc
// 背景:extension 端 MeAppsPage.tsx 用 `descKey: 'apps.favoritesDesc'` 等对象字面量赋值引用 apps.*Desc 描述文案,
// 原白名单(name/title/label/description/text/i18n)漏识别 desc,导致 extension 42 个 apps.*Desc 死 key 误判。
// 属性名白名单:name/title/label/description/text/i18n/desc + Key 后缀(常见 i18n 相关属性命名约定)
export const PROP_KEY_RE =
  /\b(?:name|title|label|description|text|i18n|desc)Key\s*:\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
// JSX prop 字面量:titleKey="a.b.c" / descKey="a.b.c"(2026-07-26 三次增强新增)
// 背景:extension 端 SidepanelApp.tsx / AIAppsPage.tsx 等通过 <XxxPage titleKey="apps.aiTitle" /> JSX prop 形式引用,
// 原 PROP_KEY_RE 只识别 `titleKey:`(对象字面量赋值,冒号),不识别 `titleKey=`(JSX prop,等号),
// 导致 extension 8 个 apps.*Title/about/contact/help/agreement/pricing 死 key 误判。
// 与 PROP_KEY_RE 区别:用 `=` 不用 `:`,且 JSX 字符串字面量只用单/双引号(模板字面量在 JSX 表达式容器 {} 内,不在此处理)。
export const JSX_PROP_KEY_RE =
  /\b(?:name|title|label|description|text|i18n|desc)Key\s*=\s*['"]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"]/g
// 跨行 t('key', 形式(2026-07-26 三次增强新增)
// 背景:STATIC_T_RE 要求 `)` 闭合,逐行扫描无法识别跨行 `t('key', {\n  args,\n})` 调用,
// 导致 extension chat.compactionNotice + mobile-rn taskDispatch.file.attached 等跨行 t() 调用引用的 key 误判为死 key。
// 此正则只要求 `t('key',`(逗号后任意,不要求 `)` 闭合),补跨行调用缺口。
// 注:与 STATIC_T_RE 部分重叠(单行带参数调用两者都匹配),但 Set 去重,无副作用。
export const STATIC_T_MULTILINE_RE =
  /\b(?:t|tt|tr)\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]\s*,/g
// 联合类型字面量:'a.b' | 'c.d'(2026-07-26 三次增强新增)
// 背景:mobile-rn LiveScreen.tsx 通过 `function statusKey(live): 'live.ongoing' | 'live.upcoming' | 'live.ended'` 联合类型字面量引用,
// 原 UNION_TYPE_NS_RE 只识别 `namespace:` 关键字,无法识别函数返回类型的联合类型字面量,导致 live.ended 误判为死 key。
// 用两个正则覆盖多个联合(3+ 段):FIRST 识别"字面量后跟 |",SECOND 识别"| 后跟字面量"。
// 误报风险:SECOND 会匹配任何 `| 'a.b'` 形式(包括 `if (x || 'a.b')` 逻辑或),但只要 'a.b' 不在 zh-CN.json 中不影响死 key 刡定。
export const UNION_TYPE_KEY_RE_FIRST =
  /['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]\s*\|\s*(?=['"`])/g
export const UNION_TYPE_KEY_RE_SECOND =
  /\|\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
// 对象字面量值全路径 i18n key:key: 'namespace.leaf'(2026-07-26 三次增强新增)
// 背景:mobile-rn PaymentScreen.tsx / TaskDispatchPage.tsx 通过 `const STATUS_KEY = { pending: 'payment.status.pending', ... }` 对象字面量映射引用,
// 原 PROP_KEY_RE 只识别 `xxxKey:` 白名单属性,不识别 `pending:` 等任意键名,导致 10 个 payment/taskDispatch.status.* 死 key 误判。
// 限定:值必须含至少 1 个点(多段全路径),避免误命中 `host: 'example'` 等单段非 i18n 字面量。
// 误报风险:任何 `key: 'foo.bar.baz'` 字面量都被识别为引用,但只要 'foo.bar.baz' 不在 zh-CN.json 中不影响死 key 刡定。
export const OBJECT_LITERAL_KEY_RE =
  /\b[a-zA-Z_][a-zA-Z0-9_]*:\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
// 动态前缀拼接赋值:`= \`prefix.${var}\` as const`(2026-07-26 三次增强新增)
// 背景:mobile-rn OrderScreen.tsx 通过 `const statusKey = \`order.status.${item.status}\` as const` 模板字符串拼接引用,
// 扫描器无法静态识别 `${item.status}` 的值,但前缀 `order.status` 是静态的。
// 此正则识别 `= \`prefix.${var}\`` 形式,捕获前缀 `prefix`(不含末尾点),把前缀加入 usedNamespaces,
// 使 isInUsedNamespace('order.status.pending', Set(['order.status'])) = true(因 'order.status.pending'.startsWith('order.status.'))
export const DYNAMIC_PREFIX_RE =
  /=>?\s*[`'"]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)*)\.?\$\{[a-zA-Z_][a-zA-Z0-9_.]*\}[^'"`]*[`'"]/g
// 字符串常量 return:`return 'namespace.leaf'`(2026-08-20 增强)
// 背景:mobile-rn LiveDetailScreen.chatStatusLabelKey() 通过 switch 返回 'liveDetail.chatConnecting'
// 等字符串常量,再由 t(statusKey) 间接引用,静态扫描器无法做值流分析,导致 5 个 liveDetail.chat* 误判为死 key。
// 此正则捕获 `return '<多段点分 key>'` 形式(含 `=> 'x.y.z'` 精简写法),把该 key 加入 staticRefs。
// 误报风险同 OBJECT_LITERAL_KEY_RE:命中 'foo.bar' 字面量,但只要其不在 zh-CN.json 中不影响死 key 刡定。
export const RETURN_KEY_RE = /return\s+['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
// 三元条件字符串字面量:`cond ? 'a.b.c' : 'd.e.f'`(2026-08-20 增强)
// 背景:extension ComingSoonPage 用 `t(isOpenInWeb ? 'apps.openInWebDesc' : 'apps.comingSoon')`
// 三元条件形式引用 key,直接 `t('key')` 正则(要求引号紧跟左括号)无法命中 `t(cond ? 'key'`,
// 导致 apps.openInWebDesc / apps.comingSoon 被误判为死 key。
// IF 分支匹配 `? 'a.b.c'`(紧跟问号),ELSE 分支匹配 `: 'a.b.c'`(紧跟冒号)。
// 误报风险同 OBJECT_LITERAL_KEY_RE:命中 'foo.bar' 字面量,但只要其不在 zh-CN.json 中不影响死 key 刡定。
export const TERNARY_KEY_RE_IF = /\?\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
export const TERNARY_KEY_RE_ELSE = /:\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
// 自定义翻译包装器带 locale 参数:`translateBg(locale, 'a.b.c')`(2026-08-20 增强)
// 背景:extension entrypoints/background.ts 用 `translateBg(locale, 'contextMenu.translate')`
// 等自定义包装器在非 React 环境读取翻译,静态扫描只识别 t/tt/tList 名,导致 3 个 contextMenu.* 误判为死 key。
// 匹配任意以 t 开头 XX 单词 + 元组第 2 参为多段点分 key: `wordToScan(locale, 'a.b.c')`。
// 误报风险同 OBJECT_LITERAL_KEY_RE:命中 'foo.bar' 字面量,但只要其不在 zh-CN.json 中不影响死 key 刡定。
export const WRAPPER_ARG_KEY_RE = /,\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
// 2026-08-21 新增:字符串数组 i18n key 列表识别(含行首空格)
// 背景:extension VipPage/PricingPage/MemberPage 用:
//   const benefits = [
//     'page.benefit1',
//     'page.benefit2',
//     ...
//   ]
// 原扫描器无法识别数组元素中的点分 key,导致 benefit1-5 误判为死 key。
// 此正则:匹配行首/空白/`[`/`(` 后的单/双引号包裹的多段点分 key(如 'page.benefit1')。
// 注:为避免误命中非数组字符串字面量,只在行含 `[` 时启用此扫描。
// 2026-09-12 增强:前缀字符类新增 `[` 与 `(` —
// 背景:miniapp-taro pkg-shop/pay/result/index.tsx 用 `pending: ['pay.result.pending', '支付处理中']`
// [key, fallback] 数组元组形式引用 key,首元素引号前是 `[` 而非空白,
// 原 `(?:^|\s)` 不命中,导致 pay.result.pending / pay.result.failed 2 个 key 被误判为死 key。
export const STRING_ARRAY_KEY_RE = /(?:^|[\s[(])['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g
// 2026-08-21 新增:JSX prop 传递 i18n key (emptyKey/descKey/titleKey 等)
// 背景:extension FollowingPage/FansPage 用 `<EmptyState emptyKey="page.follow.emptyFollowing" />` JSX prop 形式
// 传递 i18n key,原扫描器只识别冒号赋值(PROP_KEY_RE)不识别等号(JSX prop),导致 emptyFollowing/emptyFans 误判。
// 与 JSX_PROP_KEY_RE 互补:JSX_PROP_KEY_RE 只识别白名单属性(name/title/label/...),此正则识别任意属性名的等号赋值。
export const JSX_PROP_KEY_EQ_RE =
  /\b[a-zA-Z][a-zA-Z0-9_]*Key\s*=\s*['"]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)['"]/g

// 2026-07-26 新增:剥离 JS/TS 注释,保持行号(把注释字符替换为等长空格)
// 用于整文件级 STATIC_T_RE / TLIST_RE 匹配前预处理,避免命中注释行内的 t('commented.out') 等假引用。
// 注:不处理字符串字面量内的 //,但实际 i18n key 路径不含 //,且即便误剥离也只产生漏报(漏识别),
// 不会产生误报(误识别),不影响死 key 判定的保守性。
function stripComments(code) {
  // 行注释 `// ...` 到行尾
  let result = code.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
  // 块注释 `/* ... */` 跨行
  result = result.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
  return result
}

// 递归展开 JSON → 点分 key 集合(叶子值才算 key,纯命名空间不计)
export function flatten(obj, prefix = '', out = new Set()) {
  if (obj === null || obj === undefined) return out
  if (Array.isArray(obj)) {
    // 字符串数组整体算一个叶子 key(prefix)
    if (obj.length > 0 && obj.every((v) => typeof v === 'string' || typeof v === 'number')) {
      if (prefix) out.add(prefix)
    }
    return out
  }
  if (typeof obj !== 'object') {
    if (prefix) out.add(prefix)
    return out
  }
  const keys = Object.keys(obj)
  if (keys.length === 0) {
    if (prefix) out.add(prefix)
    return out
  }
  for (const k of keys) {
    const v = obj[k]
    const np = prefix ? `${prefix}.${k}` : k
    if (
      v !== null &&
      v !== undefined &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length > 0
    )
      flatten(v, np, out)
    else out.add(np) // 字符串/数字/字符串数组/空对象/空数组 → 叶子
  }
  return out
}

export function loadJson(p) {
  if (!fs.existsSync(p)) throw new Error(`文件不存在: ${p}`)
  const raw = fs.readFileSync(p, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(`JSON 解析失败: ${p} (${e.message})`)
  }
}

export function walkDir(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkDir(full, out)
    else if (/\.(tsx|ts)$/.test(entry.name)) {
      // 归一化为 `/` 再匹配排除规则,避免 Windows(反斜杠)与 Linux(正斜杠)结果分叉
      const norm = full.split(path.sep).join('/')
      if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(norm))) continue
      out.push(full)
    }
  }
  return out
}

export function scanCode(files) {
  const staticRefs = new Set()
  const usedNamespaces = new Set()
  const dynamicHits = []
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8')
    // 2026-07-26 三次增强:整文件级匹配 STATIC_T_RE / TLIST_RE
    // 背景:miniapp-taro 普遍存在 `tt('a.b', '默认值', {\n  n: x,\n})` 跨多行调用,
    // 按行扫描时第一行没有 `)`,`[^)]*\)` 整体匹配失败,导致 4 个 key 被误判为死 key。
    // `[^)]*` 字符类天然跨行(不依赖 `.`),整文件级匹配可命中。配合 stripComments 预处理
    // 剥离注释(行注释 + 块注释,保持行号),避免命中 `// t('commented.out')` 等假引用。
    // 其他正则(I18N_T_RE / PROP_KEY_RE / USE_T_RE / JSX_PROP_NS_RE / UNION_TYPE_NS_RE / DYNAMIC_T_RE)
    // 仍按行匹配,保留行号信息用于 dynamicHits 报告。
    const codeOnly = stripComments(content)
    // 2026-09-23 声明式命名空间登记:键池自己声明的 `X_I18N_NAMESPACE = 'ns'` 常量即"命名空间持有者"证据。
    // 成因:`packages/shared/src/chat/waiting-pool.ts:326` 声明 `WAITING_I18N_NAMESPACE = 'waiting'`,
    // :328-335 用 `${NS}.${quadrant}.${phase}.${index}` 运行时拼出全池 76 键,静态正则一条都看不见 ⇒
    // 四端各报 76 枚假死键(rn / cli / extension / taro,三票独立取证同一根因)。
    // 只扩 usedNamespaces、不改正则、不动端 scanTargets ⇒ 不引入假阴,也不把别端专属键倒灌成本端存活。
    for (const dm of codeOnly.matchAll(/\b([A-Z][A-Z0-9_]*I18N_NAMESPACE)\s*=\s*['"]([a-zA-Z][a-zA-Z0-9_]*)['"]/g)) {
      usedNamespaces.add(dm[2])
    }
    const lines = content.split('\n')
    let m
    STATIC_T_RE.lastIndex = 0
    while ((m = STATIC_T_RE.exec(codeOnly)) !== null) staticRefs.add(m[1])
    TLIST_RE.lastIndex = 0
    while ((m = TLIST_RE.exec(codeOnly)) !== null) staticRefs.add(m[1])
    // 2026-08-02 修复:无参数 useTranslations() / getTranslations() + 单段根级别 key 扫描
    // 背景:AdminNav.tsx L964 useTranslations()(无参数)+ L1081 t('title') 引用根级别 title,
    // 原 STATIC_T_RE 要求 key 含至少 1 个点(`\.[a-zA-Z0-9_]+`),漏识别单段 key,
    // 导致根级别 title 被误判为死 key(真实事故 2026-08-02)。
    // 修复:① 先检测文件是否含无参数 useTranslations()/getTranslations() 调用;
    // ② 若命中,启用 STATIC_T_ROOT_RE 扫描单段 key(不含点),加入 staticRefs。
    // 限定:仅在无参数调用命中时启用,避免误报(任意 t('foo') 不一定都是 i18n key)。
    USE_T_NO_ARG_RE.lastIndex = 0
    let hasNoArgUseT = false
    while ((m = USE_T_NO_ARG_RE.exec(codeOnly)) !== null) {
      hasNoArgUseT = true
      break
    }
    if (hasNoArgUseT) {
      STATIC_T_ROOT_RE.lastIndex = 0
      while ((m = STATIC_T_ROOT_RE.exec(codeOnly)) !== null) staticRefs.add(m[1])
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
      I18N_T_RE.lastIndex = 0
      while ((m = I18N_T_RE.exec(line)) !== null) staticRefs.add(m[1])
      PROP_KEY_RE.lastIndex = 0
      while ((m = PROP_KEY_RE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-07-26 三次增强:JSX prop 字面量 titleKey="a.b.c"(extension 端 apps.*Title 引用模式)
      JSX_PROP_KEY_RE.lastIndex = 0
      while ((m = JSX_PROP_KEY_RE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-07-26 三次增强:联合类型字面量 'a.b' | 'c.d'(mobile-rn live.ended 引用模式)
      // 用 FIRST/SECOND 两个正则覆盖 3+ 段联合类型,FIRST 识别"字面量后跟 |",SECOND 识别"| 后跟字面量"
      UNION_TYPE_KEY_RE_FIRST.lastIndex = 0
      while ((m = UNION_TYPE_KEY_RE_FIRST.exec(line)) !== null) staticRefs.add(m[1])
      UNION_TYPE_KEY_RE_SECOND.lastIndex = 0
      while ((m = UNION_TYPE_KEY_RE_SECOND.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-07-26 三次增强:对象字面量值 key: 'namespace.leaf'(mobile-rn payment/taskDispatch.status.* 引用模式)
      OBJECT_LITERAL_KEY_RE.lastIndex = 0
      while ((m = OBJECT_LITERAL_KEY_RE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-08-20 增强:字符串常量 return 'a.b.c'(LiveDetailScreen.chatStatusLabelKey 引用模式)
      RETURN_KEY_RE.lastIndex = 0
      while ((m = RETURN_KEY_RE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-08-20 增强:三元条件字符串字面量 cond ? 'a.b.c' : 'd.e.f'(extension ComingSoonPage 引用模式)
      TERNARY_KEY_RE_IF.lastIndex = 0
      while ((m = TERNARY_KEY_RE_IF.exec(line)) !== null) staticRefs.add(m[1])
      TERNARY_KEY_RE_ELSE.lastIndex = 0
      while ((m = TERNARY_KEY_RE_ELSE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-08-20 增强:自定义翻译包装器第二参 translateBg(locale, 'a.b.c')(extension background 引用模式)
      WRAPPER_ARG_KEY_RE.lastIndex = 0
      while ((m = WRAPPER_ARG_KEY_RE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-08-21 增强:字符串数组 i18n key 列表识别
      // 背景:extension VipPage/PricingPage/MemberPage 用 const benefits = ['page.benefit1', ...] 形式引用,
      // 扫描器需识别单/双引号包裹的多段点分 key(如 'page.benefit1'),补字符串数组元素扫描缺口。
      // 注:误报风险极低 — 匹配多段点分 key(含至少 1 个点),只要不在 zh-CN.json 中不影响死 key 判定;
      // 即便误命中也不会增加死 key 数(更多 staticRefs = 更少死 key,判定保守)。
      STRING_ARRAY_KEY_RE.lastIndex = 0
      while ((m = STRING_ARRAY_KEY_RE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-08-21 增强:JSX prop 传递 i18n key emptyKey="page.follow.emptyFollowing"(extension FollowingPage/FansPage)
      JSX_PROP_KEY_EQ_RE.lastIndex = 0
      while ((m = JSX_PROP_KEY_EQ_RE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-07-26 三次增强:动态前缀拼接 `prefix.${var}`(mobile-rn order.status.* 引用模式)
      // 把前缀加入 usedNamespaces,使 isInUsedNamespace('order.status.pending', Set(['order.status'])) = true
      DYNAMIC_PREFIX_RE.lastIndex = 0
      while ((m = DYNAMIC_PREFIX_RE.exec(line)) !== null) {
        if (m[1]) usedNamespaces.add(m[1])
      }
      USE_T_RE.lastIndex = 0
      while ((m = USE_T_RE.exec(line)) !== null) usedNamespaces.add(m[1])
      JSX_PROP_NS_RE.lastIndex = 0
      while ((m = JSX_PROP_NS_RE.exec(line)) !== null) usedNamespaces.add(m[1])
      UNION_TYPE_NS_RE.lastIndex = 0
      while ((m = UNION_TYPE_NS_RE.exec(line)) !== null) {
        usedNamespaces.add(m[1])
        if (m[3]) usedNamespaces.add(m[3])
      }
      DYNAMIC_T_RE.lastIndex = 0
      while ((m = DYNAMIC_T_RE.exec(line)) !== null) {
        dynamicHits.push({
          file: path.relative(ROOT, f),
          line: i + 1,
          snippet: trimmed.slice(0, 200),
        })
        // 提取动态模板静态前缀 t(`order.status.${var}`) → "order.status",作为已用命名空间
        // 使 order.status.* 等动态拼接引用的 key 不再被误判为死 key(2026-08-20 增强,对齐 DYNAMIC_PREFIX_RE 语义)
        const prefixM = m[1].match(/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.(?=\$\{)/)
        if (prefixM) usedNamespaces.add(prefixM[0].replace(/\.$/, ''))
      }
    }
  }
  // 2026-09-03 增强:扫描 path-labels.ts 中的命名空间注册,
  // 这些命名空间通过 TagsView 的 useTranslations(spec.ns) 动态引用,静态扫描无法检测。
  const PATH_LABELS_FILES = files.filter((file) => file.includes('path-labels.ts'))
  for (const f of PATH_LABELS_FILES) {
    const content = fs.readFileSync(f, 'utf8')
    const NS_RE = /ns:\s*'([a-zA-Z][a-zA-Z0-9_]*)/g
    let m
    while ((m = NS_RE.exec(content)) !== null) usedNamespaces.add(m[1])
  }
  return { staticRefs, usedNamespaces, dynamicHits, scanned: files.length }
}

// 判定 leaf key 是否在某个 used namespace 下
export function isInUsedNamespace(key, usedNamespaces) {
  for (const ns of usedNamespaces) {
    if (key === ns || key.startsWith(ns + '.')) return true
  }
  return false
}

export function groupByNamespace(keys) {
  const groups = new Map()
  for (const k of keys) {
    const ns = k.split('.')[0]
    if (!groups.has(ns)) groups.set(ns, [])
    groups.get(ns).push(k)
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

/**
 * 契约键声明(2026-09-24 立,补本扫描器缺失的那一半机制)
 *
 * 成因:`--target all --exit 1` 在 main 上恒红,红点唯一来源是 mobile-rn 端 1 枚
 * `permissionTier.label`。它**不是孤儿键**:
 *   - `packages/shared/src/chat/permission-tier.ts:9` 把它列为跨端词包形状的一部分;
 *   - extension 端两处运行时真取(`AgentRuntimePanel.tsx:71` / `MessageContent.tsx:682`);
 *   - mobile-rn 自己的测试 `tests/permission-tier-pack.test.ts:41` 把"五语都必须有它"钉死,
 *     删键 = 打爆别人的测试;
 *   - 同端 `tests/agent-runtime-permission-mode.test.tsx:118` 写明该端审批面板**有意**改用
 *     既有键 `agent.runtimePermissionMode` 作行 label —— 所以"本端暂无运行时消费方"是设计选择。
 * 也就是说:静态扫描只能看见"本端有没有人取这个词",看不见"这个词是不是契约的一部分"。
 * 缺的不是一个绿点,是**声明出口**;没有它,唯一出路就是把 `--target all` 缩回单端(HEAD
 * 提交 `5de2116f1` 的目的恰恰是"逐端判定",缩回去等于把其余四端的红点重新藏起来)。
 *
 * 出口形态照守门 70 在 2026-09-24 补的 `i18n-content-exempt-file:` 同款:
 * **豁免永远是一行可见、可审计、带理由的声明,而不是藏在基线数字里的计数**,并且如实计数、
 * 逐条打印,绝不静默。数据放 `scripts/i18n-contract-keys.json`(不在代码里硬写清单)。
 *
 * 三条硬边界:
 *  1. **依据必须可核验**(与守门 89 的 R7、守门 90 的"清单腐烂即红"同取向):每条 evidence 指向的
 *     文件必须在 HEAD 里真实存在、行号在范围内、该行确实含被引用的标识符。不成立即判红。
 *     未经核验的豁免就是第二条"藏在数字里"的口子。取 HEAD 而非工作区,理由与守门 77 一致:
 *     并行会话的未提交草稿会让磁盘内容滞后,按磁盘核验会产出与仓库真实状态相反的结论。
 *  2. **只免除"死键"这一项**:parity / 翻译不完整 / 语言纯度一律不受影响。
 *  3. **声明过期也算红**:键已不再是死键、或键根本不在本端语言包里,都点名要求删除条目 ——
 *     否则这份清单只会越长越没人看。
 */
export const CONTRACT_FILE_REL = 'scripts/i18n-contract-keys.json'
const CONTRACT_REASON_MIN_CHARS = 12

/** 读声明文件本身:不存在 = 没有任何声明(不是错误);内容损坏由 loadJson 抛。 */
export function loadContractFile(root = ROOT) {
  const p = path.join(root, CONTRACT_FILE_REL)
  if (!fs.existsSync(p)) return { path: p, exists: false, raw: null }
  return { path: p, exists: true, raw: loadJson(p) }
}

/**
 * 声明里出现未知 target → 点名。拼错的端名永远不会被任何一次判定读到,
 * 等于把一枚没有读者的豁免留在清单里(守门 90 的"清单腐烂"同型)。
 * @param {unknown} raw - 声明文件解析结果
 * @param {string[]} knownTargets - 扫描器真实支持的端名
 * @returns {string[]} 未知端名(已按字面排序)
 */
export function unknownContractTargets(raw, knownTargets) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const targets = raw.targets
  if (!targets || typeof targets !== 'object' || Array.isArray(targets)) return []
  const known = new Set(knownTargets)
  return Object.keys(targets)
    .filter((t) => !known.has(t))
    .sort()
}

/**
 * 取出本端的声明并做形状校验。形状不成立的条目**不进 entries、只进 issues**(必判红),
 * 因为"少写一个 line"若被当作没有依据,就会被静默跳过。
 * @returns {{ entries: Map<string, {reason: string, evidence: Array<{file:string,line:number,contains:string}>}>, issues: Array<{key:string,problems:string[]}> }}
 */
export function contractEntriesFor(raw, target) {
  const entries = new Map()
  const issues = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { entries, issues }
  const targets = raw.targets
  if (!targets || typeof targets !== 'object' || Array.isArray(targets)) {
    return { entries, issues: [{ key: '(root)', problems: ['缺少对象字段 targets'] }] }
  }
  const block = targets[target]
  if (block === undefined || block === null) return { entries, issues }
  if (typeof block !== 'object' || Array.isArray(block)) {
    return { entries, issues: [{ key: target, problems: ['targets.<端> 必须是「键 → 声明对象」的字典'] }] }
  }
  for (const [key, decl] of Object.entries(block)) {
    const problems = []
    let reason = ''
    let evidence = []
    if (!decl || typeof decl !== 'object' || Array.isArray(decl)) problems.push('声明必须是对象 { reason, evidence }')
    else {
      reason = typeof decl.reason === 'string' ? decl.reason.trim() : ''
      if (reason.length < CONTRACT_REASON_MIN_CHARS)
        problems.push(`reason 必须是不短于 ${CONTRACT_REASON_MIN_CHARS} 字的理由(现 ${reason.length} 字)`)
      const rawEvidence = decl.evidence
      if (!Array.isArray(rawEvidence) || rawEvidence.length === 0) problems.push('evidence 至少 1 条,且每条都要可核验')
      else {
        evidence = []
        rawEvidence.forEach((e, i) => {
          if (!e || typeof e !== 'object' || Array.isArray(e)) {
            problems.push(`evidence[${i}] 必须是对象 { file, line, contains }`)
            return
          }
          const okFile = typeof e.file === 'string' && e.file.trim() !== ''
          const okLine = Number.isInteger(e.line) && e.line >= 1
          const okText = typeof e.contains === 'string' && e.contains.trim() !== ''
          if (!okFile) problems.push(`evidence[${i}].file 必须是非空字符串`)
          if (!okLine) problems.push(`evidence[${i}].line 必须是 ≥1 的整数`)
          if (!okText) problems.push(`evidence[${i}].contains 必须是非空字符串(HEAD 该行必须真的含它)`)
          if (okFile && okLine && okText)
            evidence.push({ file: e.file.trim().split('\\').join('/'), line: e.line, contains: e.contains })
        })
      }
    }
    if (problems.length > 0) {
      issues.push({ key, problems })
      continue
    }
    entries.set(key, { reason, evidence })
  }
  return { entries, issues }
}

/**
 * 逐条核验依据,产出「可免除」与「违规」两张清单。
 * @param {Object} p
 * @param {Map<string, {reason:string, evidence:Array<Object>}>} p.entries - contractEntriesFor 的结果
 * @param {Set<string>} p.leafKeys - 本端基准语言包 leaf key 全集
 * @param {Set<string>} p.deadKeys - 本端判出的死键集合
 * @param {(rel: string) => string|null} p.readHead - 读 HEAD 版本内容,不存在返回 null
 * @param {string} [p.target]
 * @returns {{ violations: Array<{key:string,code:string,msg:string}>, exempted: Array<{key:string,reason:string,evidence:Array<Object>}> }}
 */
export function verifyContractEntries({ entries, leafKeys, deadKeys, readHead, target = '' }) {
  const violations = []
  const exempted = []
  for (const [key, decl] of entries) {
    if (!leafKeys.has(key)) {
      violations.push({
        key,
        target,
        code: 'KEY_NOT_IN_PACK',
        msg: '声明的键不在本端基准语言包里(条目已过期或写错端,请删除/改正 —— 它现在免除的是一枚不存在的键)',
      })
      continue
    }
    const evidenceProblems = []
    for (const ev of decl.evidence) {
      const content = readHead(ev.file)
      if (typeof content !== 'string') {
        evidenceProblems.push(`${ev.file}:${ev.line} 依据文件在 HEAD 中不存在`)
        continue
      }
      const lines = content.split(/\r?\n/)
      if (ev.line > lines.length) {
        evidenceProblems.push(`${ev.file}:${ev.line} 行号越界(HEAD 该文件共 ${lines.length} 行)`)
        continue
      }
      const text = lines[ev.line - 1] ?? ''
      if (!text.includes(ev.contains)) {
        evidenceProblems.push(`${ev.file}:${ev.line} 该行不含被引用的标识符 ${JSON.stringify(ev.contains)}(依据已漂移)`)
      }
    }
    if (evidenceProblems.length > 0) {
      violations.push({
        key,
        target,
        code: 'EVIDENCE_UNVERIFIED',
        msg: `依据不可核验 ⇒ 本条不免除死键判定:${evidenceProblems.join(' / ')}`,
      })
      continue
    }
    if (!deadKeys.has(key)) {
      violations.push({
        key,
        target,
        code: 'DECLARATION_UNNEEDED',
        msg: '本端代码已能静态引用到该键,声明已多余(留着它就是一句无人复核的豁免)',
      })
      continue
    }
    exempted.push({ key, reason: decl.reason, evidence: decl.evidence })
  }
  return { violations, exempted }
}

/**
 * HEAD 版本读取器(带同文件缓存)。git 调用一律绝对路径 + `-c safe.directory=*` +
 * `windowsHide` + `timeout`(§5b / 守门 52 / 守门 80):读不到就返回 null,由判据如实判红,
 * 绝不"读不到就当通过"。
 */
export function makeHeadReader(root = ROOT) {
  const cache = new Map()
  let bin
  return (rel) => {
    if (cache.has(rel)) return cache.get(rel)
    let content = null
    try {
      if (bin === undefined) bin = process.env.IHUI_GIT_BIN || resolveGitBin() || 'git'
      content = execFileSync(bin, ['-c', 'safe.directory=*', '-C', root, 'show', `HEAD:${rel}`], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15_000,
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch {
      content = null
    }
    cache.set(rel, content)
    return content
  }
}

/**
 * 主流程入口(供 4 端脚本 + web 兼容入口调用)
 *
 * @param {Object} opts
 * @param {string} opts.name - 端名(用于日志/报告,例 'extension')
 * @param {string} opts.messagesPath - 相对 ROOT 的 zh-CN.json 路径
 * @param {string[]} [opts.scanTargets=[]] - 相对 ROOT 的代码扫描目录列表
 * @param {string} opts.outputPattern - 报告输出路径模板,可用 {date} 占位当天日期
 * @param {boolean} [opts.dryRun=false] - 只打印统计,不写报告
 * @param {boolean} [opts.exitOnDead=false] - 发现死 key 时返回 1
 * @param {string|null} [opts.out=null] - 自定义输出路径(覆盖 outputPattern)
 * @param {string} [opts.scriptName] - 日志前缀(默认 scan-{name}-dead-i18n-keys)
 * @returns {number} 0 成功;1 = --exit 1 模式发现死 key,或契约声明不成立(后者与 --exit 无关,必红)
 */
export function main(opts) {
  const {
    name,
    messagesPath,
    scanTargets = [],
    outputPattern,
    dryRun = false,
    exitOnDead = false,
    out = null,
    scriptName,
  } = opts

  const TAG = scriptName || `scan-${name}-dead-i18n-keys`
  const TODAY = new Date().toISOString().slice(0, 10)
  const ZH_CN_PATH = path.join(ROOT, messagesPath)
  const LOCALE_DIR = path.dirname(ZH_CN_PATH)
  const LOCALE_PATHS = Object.fromEntries(
    LOCALES.map((l) => [l, path.join(LOCALE_DIR, `${l}.json`)]),
  )
  const SCAN_TARGETS = scanTargets.map((t) => path.join(ROOT, t))

  // 0. 跳过条件:messages 不存在(端无独立 i18n,如 desktop)
  if (!fs.existsSync(ZH_CN_PATH)) {
    console.log(
      `[${TAG}] 跳过:基准语言文件不存在 ${path.relative(ROOT, ZH_CN_PATH)}(端无独立 i18n)`,
    )
    return 0
  }

  // 0b. 跳过条件:无 JS 代码扫描目标(端是纯原生包装,如 desktop)
  if (SCAN_TARGETS.length === 0) {
    console.log(`[${TAG}] 跳过:scanTargets 为空(端无 JS 代码,无法静态扫描)`)
    return 0
  }

  // 1. 加载 zh-CN.json + 其他 4 语言
  console.log(`[${TAG}] target=${name} 加载基准: ${path.relative(ROOT, ZH_CN_PATH)}`)
  const leafKeys = flatten(loadJson(ZH_CN_PATH))
  const localeData = { 'zh-CN': { keys: leafKeys } }
  for (const l of LOCALES) {
    if (l === 'zh-CN') continue
    if (!fs.existsSync(LOCALE_PATHS[l])) {
      console.warn(`[${TAG}] 警告:语言文件不存在: ${path.relative(ROOT, LOCALE_PATHS[l])}`)
      localeData[l] = { keys: new Set() }
      continue
    }
    localeData[l] = { keys: flatten(loadJson(LOCALE_PATHS[l])) }
    console.log(
      `[${TAG}] 加载: ${path.relative(ROOT, LOCALE_PATHS[l])} (${localeData[l].keys.size} keys)`,
    )
  }

  // 2. 扫描代码
  const files = []
  for (const t of SCAN_TARGETS) walkDir(t, files)
  console.log(`[${TAG}] 扫描代码: ${files.length} 个文件`)
  const { staticRefs, usedNamespaces, dynamicHits } = scanCode(files)
  console.log(`[${TAG}] 静态引用 key: ${staticRefs.size} 个(去重)`)
  console.log(`[${TAG}] useTranslations/getTranslations namespace: ${usedNamespaces.size} 个`)

  // 3. 死 key
  const deadKeys = new Set()
  for (const k of leafKeys) {
    if (!staticRefs.has(k) && !isInUsedNamespace(k, usedNamespaces)) deadKeys.add(k)
  }
  // 3b. 契约键声明:仅把「有依据且依据已在 HEAD 逐条核验」的键从死键判定里免除(见文件头注释)
  const contract = loadContractFile(ROOT)
  const { entries: contractEntries, issues: contractShapeIssues } = contractEntriesFor(contract.raw, name)
  const { violations: contractViolations, exempted: contractExempted } = verifyContractEntries({
    entries: contractEntries,
    leafKeys,
    deadKeys,
    readHead: makeHeadReader(ROOT),
    target: name,
  })
  for (const e of contractExempted) deadKeys.delete(e.key)
  const contractHardFail = contractShapeIssues.length > 0 || contractViolations.length > 0
  if (contractExempted.length > 0) {
    console.log(
      `[${TAG}] 契约键声明:${contractExempted.length} 枚按声明免除死键判定(依据已在 HEAD 逐条核验,不影响 parity/翻译完整性)`,
    )
    for (const e of contractExempted) {
      console.log(`  - \`${e.key}\` ← ${e.reason}`)
      for (const ev of e.evidence) console.log(`      依据 ${ev.file}:${ev.line}(须含 ${JSON.stringify(ev.contains)})`)
    }
  }
  for (const issue of contractShapeIssues) {
    console.error(`[${TAG}] ❌ ${CONTRACT_FILE_REL} 形状不合法 [${issue.key}]:${issue.problems.join('; ')}`)
  }
  for (const v of contractViolations) {
    console.error(`[${TAG}] ❌ ${CONTRACT_FILE_REL} 声明失效 [${v.code}] ${v.key}:${v.msg}`)
  }
  // 4. 翻译不完整
  const incompleteKeys = new Set()
  for (const k of leafKeys) {
    for (const l of LOCALES) {
      if (l !== 'zh-CN' && !localeData[l].keys.has(k)) {
        incompleteKeys.add(k)
        break
      }
    }
  }

  // 5. 统计
  const totalLeaves = leafKeys.size
  const totalRefs = staticRefs.size
  const totalNamespaces = usedNamespaces.size
  const deadCount = deadKeys.size
  const incompleteCount = incompleteKeys.size
  const deadRatio = totalLeaves > 0 ? ((deadCount / totalLeaves) * 100).toFixed(1) : '0.0'
  const summary = {
    scannedAt: new Date().toISOString(),
    totalLeafKeys: totalLeaves,
    totalStaticRefs: totalRefs,
    totalUsedNamespaces: totalNamespaces,
    deadKeyCount: deadCount,
    deadKeyRatio: deadRatio + '%',
    incompleteKeyCount: incompleteCount,
  }

  console.log('\n=== 总览 ===')
  console.log(`  基准语言 leaf keys: ${totalLeaves}`)
  console.log(`  代码静态引用 key: ${totalRefs}`)
  console.log(`  useTranslations/getTranslations namespace: ${totalNamespaces}`)
  console.log(`  死 key: ${deadCount} (${deadRatio}%)`)
  console.log(`  翻译不完整 key: ${incompleteCount}`)
  console.log(`  契约键声明免除: ${contractExempted.length} 枚(仅免死键判定)`)
  console.log(`  动态 t(\`prefix.\${var}\`) 命中: ${dynamicHits.length} 处`)

  if (dryRun) {
    console.log(`\n[${TAG}] --dry-run:跳过报告写入`)
    if (contractHardFail) return 1
    if (exitOnDead && deadCount > 0) return 1
    return 0
  }

  // 6. 生成 markdown 报告
  const lines = []
  const L = (s = '') => lines.push(s)
  L(`# i18n 死 key 审计报告(${TODAY},target=${name})`)
  L()
  L(`> 自动生成 by \`scripts/${TAG}.mjs\`(2026-07-26 公共函数抽象到 _i18n-scan-helpers.mjs)`)
  L(`> target=${name},messagesPath=${messagesPath}`)
  L('## 总览')
  L(`- target:**${name}**`)
  L(
    `- 扫描文件:5 语言(\`${LOCALES.map((l) => path.relative(ROOT, LOCALE_PATHS[l])).join('`, `')}\`)`,
  )
  L(`- 递归 leaf key 总数:**${totalLeaves}**`)
  L(`- 代码静态引用 key(全路径 \`t('a.b.c')\` 形式):**${totalRefs}**(去重)`)
  L(
    `- \`useTranslations/getTranslations('namespace')\` 命名空间:**${totalNamespaces}** 个(命名空间下所有 key 视作潜在引用,启发式)`,
  )
  L(`- 死 key 数量:**${deadCount}**(占比 **${deadRatio}%**)`)
  L(`- 翻译不完整 key 数量:**${incompleteCount}**`)
  L(`- 动态 t(\`prefix.\${var}\`) 命中:${dynamicHits.length} 处`)
  L('## 死 key 列表(按 namespace 分组)')
  if (deadCount === 0) {
    L('_无死 key_ ✅')
  } else
    for (const [ns, keys] of groupByNamespace(deadKeys)) {
      L(`### \`${ns}.*\`  (${keys.length} 个)`)
      for (const k of keys) L(`- \`${k}\``)
    }
  L(`## 契约键声明(${CONTRACT_FILE_REL},仅免除"死键"判定)`)
  L(
    '> 这些键在本端无静态引用**不是孤儿**,而是跨端词包契约 / 被测试钉住的形状键。' +
      '每条依据都按 HEAD 内容核验过(文件存在 + 行号在范围内 + 该行含被引用的标识符);' +
      '依据不成立即判红。**parity / 翻译完整性 / 语言纯度一律不受本节影响。**',
  )
  if (contractExempted.length === 0) {
    L('_本端无契约声明命中_')
  } else {
    for (const e of contractExempted) {
      L(`- \`${e.key}\` — ${e.reason}`)
      for (const ev of e.evidence) L(`  - 依据 \`${ev.file}:${ev.line}\`(须含 \`${ev.contains}\`)`)
    }
  }
  if (contractShapeIssues.length + contractViolations.length > 0) {
    L('### ❌ 声明失效清单(必改,不影响退出码的"死键"语义)')
    for (const issue of contractShapeIssues) L(`- [SHAPE] \`${issue.key}\`:${issue.problems.join(';')}`)
    for (const v of contractViolations) L(`- [${v.code}] \`${v.key}\`:${v.msg}`)
  }
  L('## 翻译不完整 key 列表(5 语言中任一缺失)')
  if (incompleteCount === 0) {
    L('_翻译完整_ ✅')
  } else
    for (const [ns, keys] of groupByNamespace(incompleteKeys)) {
      L(`### \`${ns}.*\`  (${keys.length} 个)`)
      for (const k of keys) {
        const missingLangs = LOCALES.filter((l) => l !== 'zh-CN' && !localeData[l].keys.has(k))
        L(`- \`${k}\`  (缺: ${missingLangs.join(', ')})`)
      }
    }
  L('## 动态 key 提示(代码中拼接的 key,无法静态扫描)')
  if (dynamicHits.length === 0) {
    L('_未发现动态 t(`prefix.${var}`) 调用_')
  } else {
    L(
      `共 ${dynamicHits.length} 处动态 key 调用,这些 key 即使在 zh-CN.json 中定义也无法通过静态扫描验证,建议人工核对:`,
    )
    const byFile = new Map()
    for (const h of dynamicHits) {
      if (!byFile.has(h.file)) byFile.set(h.file, [])
      byFile.get(h.file).push(h)
    }
    for (const [f, hits] of byFile) {
      L(`- \`${f}\`(${hits.length} 处)`)
      for (const h of hits.slice(0, 3)) L(`  - L${h.line}: \`${h.snippet}\``)
      if (hits.length > 3) L(`  - ... 另 ${hits.length - 3} 处`)
    }
  }
  L('## 排除项')
  L('- 目录:node_modules / .next / dist / coverage / __tests__ / tests / __mocks__ / fixtures')
  L('- 文件:`*.test.ts(x)` / `*.spec.ts(x)` / `*.d.ts`')
  L('---')
  L(`_Generated at ${summary.scannedAt}_`)

  const outPath = out
    ? path.resolve(ROOT, out)
    : path.join(ROOT, outputPattern.replace('{date}', TODAY))
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')
  console.log(`\n[${TAG}] 报告写入: ${path.relative(ROOT, outPath)}`)

  if (contractHardFail) {
    console.error(
      `[${TAG}] ❌ 契约声明不成立:${contractShapeIssues.length} 处形状不合法 + ${contractViolations.length} 处依据失效` +
        ` —— 修 \`scripts/i18n-contract-keys.json\`(补真实依据或删掉过期条目),不要把它改成静默通过`,
    )
    return 1
  }
  if (exitOnDead && deadCount > 0) {
    console.error(`[${TAG}] --exit 1:发现 ${deadCount} 个死 key`)
    return 1
  }
  return 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
