#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 生成器为 CLI 工具,需 console 输出诊断信息 */
/**
 * sync-miniapp-chrome.mjs — 把 packages/design-tokens/src/styles/tokens.css 的设计真值**原位写回**
 * 小程序端两份原生 chrome 副本:
 *   - apps/miniapp-taro/src/theme.json (微信 darkmode 配置;app.config.ts 以 @变量 引用它,是编译期唯一源)
 *   - apps/miniapp-taro/src/lib/theme.ts 的 THEME_CHROME 块 (运行期 setNavigationBarColor/setTabBarStyle)
 *
 * 为什么必须存在(AGENTS §4「端内 CSS/色值副本一律是派生态,禁止手改、也禁止只拦红不写回」):
 * 这两份副本此前**没有任何生成器写它、也没有任何守门看它**(`grep -rl "theme.json" scripts/*.mjs`
 * 立项时零命中)。theme.json 必须是字面 hex —— 那是微信对原生 chrome 的硬性要求,不是豁免的理由:
 * 字面量应当由生成器从 tokens.css 派生,而不是由人抄。
 *
 * 三条从本仓事故学来的写法(同族见 scripts/sync-rn-global-css.mjs 头注):
 * 1. **取源只有一份实现**:走 `scripts/lib/design-token-blocks.mjs` 的 collectVars
 *    (light = @theme + **全部** :root 块按文档顺序合并;dark = light ∪ 全部 .dark,cascade 回退,
 *    与 sync-extension-tokens.mjs 的 sourceTables 同形);hsl→hex 归一与容差比对复用
 *    `scripts/check-cross-end-tokens.mjs` 的 normalizeColor / colorsAgree(该模块有 §22d 守卫,
 *    import 无副作用;sync-rn-tokens.mjs:54 与 sync-extension-tokens.mjs:56 是同形先例),
 *    **不得写第三份转换器**。
 * 2. **原位写回**:注释、@变量引用、非色枚举(navTxtStyle / tabBorder 等)、块外一切逐字节不动。
 *    "同色不同字节"(如 `#A3A3A3` vs 派生的小写 `#a3a3a3`)时**保留文件原字节** —— 大小写不是色值
 *    差异,改写它会让首次运行凭空产出一笔与真值无关的 diff(本票验收:今日对真仓 = 0 字节改动)。
 * 3. **派生与登记分流,且判定与写回共用同一个遍历**:有 tokens.css 对应档的字段一律派生;
 *    没有对应档的进 CHROME_DECLARED_DIVERGENCE 并写明可复核依据,`nearToken` 让依据本身可机判 ——
 *    登记值与源头重新同值 ⇒ 登记表腐烂,大声红(与 sync-extension-tokens.mjs 的 DECLARED_DIVERGENCE
 *    同形)。**删掉一条登记会让该字段同时脱离两张表 ⇒ unregistered 红**,登记表不可能被静默摘除。
 *
 * 用法:
 *   node scripts/sync-miniapp-chrome.mjs            原位写回两份副本(幂等)
 *   node scripts/sync-miniapp-chrome.mjs --check    只校验不写盘(漂移则 exit 1)
 *   node scripts/sync-miniapp-chrome.mjs --quiet    一致时不出声(喊红仍然出声)
 *   node scripts/sync-miniapp-chrome.mjs --self-test 判据自检(纯内存夹具,不碰真仓文件)
 *   node scripts/sync-miniapp-chrome.mjs --help     帮助
 * 退出码:0 = 一致 / 写回成功;1 = 漂移、第三个值、未登记色键、登记表腐烂;
 *        2 = 无法判定(取不到文件、结构不认识、源头档缺失或归一后不是 #rrggbb)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collectVars, maskComments } from './lib/design-token-blocks.mjs'
import { __test__ as crossEnd } from './check-cross-end-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const TOKENS_SOURCE_REL = 'packages/design-tokens/src/styles/tokens.css'
export const THEME_JSON_REL = 'apps/miniapp-taro/src/theme.json'
export const THEME_TS_REL = 'apps/miniapp-taro/src/lib/theme.ts'

const args = process.argv.slice(2)
const isCheck = args.includes('--check')
const isHelp = args.includes('--help')
const isQuiet = args.includes('--quiet')
const isSelfTest = args.includes('--self-test')

if (isHelp) {
  console.info(
    `sync-miniapp-chrome.mjs — tokens.css → miniapp 原生 chrome(theme.json + lib/theme.ts THEME_CHROME)原位写回

  node scripts/sync-miniapp-chrome.mjs            写回(幂等)
  node scripts/sync-miniapp-chrome.mjs --check    只校验
  node scripts/sync-miniapp-chrome.mjs --self-test 判据自检
源: ${TOKENS_SOURCE_REL}
目标: ${THEME_JSON_REL} / ${THEME_TS_REL}`
  )
  process.exit(0)
}

/** THEME_CHROME 的六个"色值字段"(两份副本共用这套语义键;JSON 键名经 JSON_KEY_TO_FIELD 映射)。 */
export const CHROME_FIELDS = ['navBg', 'navFront', 'windowBg', 'tabColor', 'tabSelected', 'tabBg']

/** theme.json 的微信键名 → chrome 字段。本表之外的键:非色枚举只计数,色值键判未登记红。 */
export const JSON_KEY_TO_FIELD = {
  navBgColor: 'navBg',
  bgColor: 'windowBg',
  tabColor: 'tabColor',
  tabSelectedColor: 'tabSelected',
  tabBgColor: 'tabBg',
}

/**
 * 派生面:每个 chrome 字段在其主题档对应 tokens.css 的哪个变量。
 * 每格映射依据(2026-09-25 实测:normalizeColor 归一后与两份副本现值逐字节同):
 * - navBg / tabBg(light)← --color-card(light #ffffff):原生栏是浮在页面底之上的表面档;
 *   navBg 的 dark 侧**不在派生面**(见登记表),tabBg 的 dark 侧与 .dark --color-card(#1a1a1a)逐位吻合。
 * - navFront ← --color-primary:AGENTS §4 明文 primary 在 web 端兼任墨色(亮 hsl(0 0% 0%) /
 *   暗 hsl(0 0% 100%)),与两份副本现值逐位同。
 * - windowBg(light)← --color-background:theme.ts 头注原文即「background hsl(0 0% 96.1%) = #f5f5f5」。
 * - tabColor(light)← --color-text-tertiary(#a3a3a3)、tabColor(dark)← .dark --color-muted-foreground
 *   (hsl(0 0% 63.9%) = #a3a3a3):两侧现值同为灰 400 但**语义不同档** —— 亮档"三级文字"、暗档
 *   "弱化前景",这正是 theme.ts 注释各自写明的一侧;不得并成一个 token(亮 muted-foreground=#666666、
 *   暗 text-tertiary=#737373,任选一边都会改掉一份在端上的色)。
 * - tabSelected ← --color-brand-accent:亮 #8fb8cc / 暗 #a3c4d6,即 2026-09-14 用户定稿的全项目
 *   统一强调色(commit 861ea43e27「跨端强调色定稿高级灰蓝(#8fb8cc/#a3c4d6)」)。
 */
export const CHROME_DERIVATION = {
  light: {
    navBg: '--color-card',
    navFront: '--color-primary',
    windowBg: '--color-background',
    tabColor: '--color-text-tertiary',
    tabSelected: '--color-brand-accent',
    tabBg: '--color-card',
  },
  dark: {
    navFront: '--color-primary',
    tabColor: '--color-muted-foreground',
    tabSelected: '--color-brand-accent',
    tabBg: '--color-card',
  },
}

/**
 * 登记面:tokens.css 没有对应档(或副本刻意不等于它)的 chrome 色。依据必须可复核:
 * `nearToken` = "本来最接近的那个源头档",登记值一旦与它重新同值,这条就不再是分歧
 * (登记表腐烂)⇒ 生成器与守门都大声红,逼人把字段挪回派生面。
 */
export const CHROME_DECLARED_DIVERGENCE = {
  light: {},
  dark: {
    navBg: {
      value: '#262626',
      nearToken: '--color-background',
      reason:
        'commit d2d80c1b23(2026-09-06「细微相近色统一归入现有 token」)明示:「miniapp 原生 chrome 色(theme.ts/theme.json):#242424→#262626(深灰面),对齐 rn gray.800」。源头 .dark --color-background 现值 hsl(0 0% 14%) 归一 = #242424,与 #262626 每通道差 2(colorsAgree 容差 ±1 之外)⇒ 记录在案的刻意分歧,不是漂移;派生它会把深色导航栏改回 #242424,等于回滚那枚决策。若源头将来真的落到 #262626,nearToken 判据会喊腐烂,届时删本条、把 navBg 挪进 CHROME_DERIVATION。',
    },
    windowBg: {
      value: '#262626',
      nearToken: '--color-background',
      reason:
        '同一枚 commit(d2d80c1b23)把 navBg 与 windowBg 一起 #242424→#262626;theme.ts 头注当时特意把「background hsl(0 0% 14%) = #242424」改写成「background ≈ #262626」—— 那个 ≈ 就是"刻意不对齐"的原文自证。依据与 nearToken 同 navBg(.dark --color-background)。',
    },
  },
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/
const CANON_HEX_RE = /^#[0-9a-f]{6}$/

/** 取源:light = @theme + 全部 :root;dark = light ∪ 全部 .dark(cascade 回退)。 */
export function sourceTables(tokensCssText) {
  const asValues = (m) => new Map([...m].map(([k, d]) => [k, d.value]))
  const light = asValues(collectVars(tokensCssText, ['@theme', ':root']))
  return { light, dark: new Map([...light, ...asValues(collectVars(tokensCssText, ['.dark']))]) }
}

/**
 * 一个 chrome 字段的"应有值"(纯函数,吃 tables):
 *   derive         从源头档派生,hex = canonical 小写 #rrggbb
 *   registered     登记表持有 value;nearValue = nearToken 现值归一(undefined ⇒ 判不了腐烂)
 *   undeclared     字段在 CHROME_FIELDS 里却两张表都不覆盖(登记表被静默摘除的落点)⇒ 红
 *   undetermined   源头缺档 / 归一后不是 #rrggbb(原生表达不了,绝不静默写坏)
 */
export function planField(theme, field, tables) {
  const derivedTok = CHROME_DERIVATION[theme]?.[field]
  if (derivedTok) {
    const raw = tables[theme].get(derivedTok)
    if (raw === undefined)
      return { kind: 'undetermined', why: `tokens.css 取不到 ${derivedTok}(${theme} 档,字段 ${field})` }
    const hex = crossEnd.normalizeColor(raw)
    if (!CANON_HEX_RE.test(hex))
      return {
        kind: 'undetermined',
        why: `${derivedTok}(${theme})归一后 = "${hex}",不是 #rrggbb —— 原生 chrome 表达不了,不得静默写入`,
      }
    return { kind: 'derive', hex, token: derivedTok }
  }
  const reg = CHROME_DECLARED_DIVERGENCE[theme]?.[field]
  if (reg) {
    const raw = tables[theme].get(reg.nearToken)
    const nearValue = raw === undefined ? undefined : crossEnd.normalizeColor(raw)
    return { kind: 'registered', value: reg.value, near: reg.nearToken, nearValue }
  }
  return { kind: 'undeclared' }
}

/** 单字段判定:undefined = 绿;否则 {kind, info}。判据与写回共用它,不分两套。 */
export function judgeField(plan, current) {
  if (plan.kind === 'derive') {
    if (crossEnd.colorsAgree(current, plan.hex)) return undefined
    return { kind: 'drifted', info: { want: plan.hex, token: plan.token } }
  }
  if (plan.kind === 'registered') {
    const rot = plan.nearValue !== undefined && crossEnd.colorsAgree(plan.value, plan.nearValue)
    if (rot)
      return {
        kind: 'rot',
        info: { registered: plan.value, nearToken: plan.near, nearValue: plan.nearValue, why: '登记值已与源头档同值 ⇒ 这条"刻意分歧"已失效,删登记、挪回派生面' },
      }
    if (crossEnd.colorsAgree(current, plan.value)) return undefined
    if (plan.nearValue === undefined)
      return { kind: 'undeterminedInfo', info: { why: `登记项 nearToken ${plan.near} 在 tokens.css 取不到 ⇒ 无法判定腐烂` } }
    return {
      kind: 'thirdValue',
      info: { registered: plan.value, nearToken: plan.near, why: '副本被改成登记值与源头值之外的第三个值 —— 改副本必须同时改登记与理由,不得静默择一' },
    }
  }
  if (plan.kind === 'undetermined') return { kind: 'undeterminedInfo', info: { why: plan.why } }
  // undeclared:字段存在、值是 hex、却没有任何表覆盖它
  return { kind: 'unregistered', info: { why: '既不在 CHROME_DERIVATION,也不在 CHROME_DECLARED_DIVERGENCE —— 新字段(或被摘走的登记)必须显式归类' } }
}

// ─────────────────────────── 遍历(判定与写回共用这一个 walker) ───────────────────────────

/** 从 text[openIdx] 的 `{` 起平衡括号,返回内容区间 [start, end)。抛错=结构不认识,绝不猜。 */
function balancedObjectBody(text, openIdx) {
  if (text[openIdx] !== '{') throw new Error('内部错误:锚点不是 {')
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return [openIdx + 1, i]
    }
  }
  throw new Error('平衡括号扫描未闭合(副本结构不认识,拒绝猜测)')
}

/**
 * 从一条 `"key": "value"` / `key: 'value'` 命中原文里定位**值本体**的字节区间(相对 raw)。
 * 键是标识符、值是颜色/枚举,都不含冒号与引号,所以 冒号后首个引号 ~ 最后一个引号 是唯一的。
 */
function valueSpan(raw) {
  const colon = raw.indexOf(':')
  const openQ = raw.indexOf('"', colon + 1)
  const closeQ = raw.lastIndexOf('"')
  if (openQ < 0 || closeQ <= openQ) throw new Error(`无法在 ${JSON.stringify(raw.slice(0, 40))} 里定位值`)
  return [openQ + 1, closeQ]
}

/**
 * 走一遍 theme.json:对两个顶层主题对象内每条 `"key": "string"` 调 visit。
 * visit(theme, jsonKey, field|null, current, isHex) 返回**新值字符串或 undefined**(=保留原字节)。
 * 返回 { text(若有改写), fields: 访问记录 }。
 */
export function walkThemeJson(jsonText, visit) {
  const edits = []
  // 同 walkThemeTs:两个顶层对象的 edits 一律按 jsonText 原文坐标收集,最后倒序应用。
  // 中途重写会让第二个主题块的坐标全体错位(写门时的自造缺陷类,由 S4/S7 幂等例钉死)。
  for (const theme of ['light', 'dark']) {
    const keyAt = new RegExp(`"${theme}"\\s*:\\s*\\{`).exec(jsonText)
    if (!keyAt) throw new Error(`theme.json 找不到顶层 "${theme}" 对象`)
    const braceAt = keyAt.index + keyAt[0].lastIndexOf('{')
    const [bStart, bEnd] = balancedObjectBody(jsonText, braceAt)
    const body = jsonText.slice(bStart, bEnd)
    const masked = maskComments(body) // 等长遮罩:注释里的 "x": "y" 散文不当声明(§"注释被当数据"已翻车多次)
    for (const m of masked.matchAll(/"([A-Za-z][\w]*)"\s*:\s*"([^"]*)"/g)) {
      const jsonKey = m[1]
      const current = m[2]
      const field = JSON_KEY_TO_FIELD[jsonKey] ?? null
      const next = visit(theme, jsonKey, field, current, HEX_RE.test(current))
      if (next === undefined || next === current) continue
      const raw = body.slice(m.index, m.index + m[0].length)
      const [vs, ve] = valueSpan(raw)
      edits.push({ start: bStart + m.index + vs, end: bStart + m.index + ve, text: next })
    }
  }
  if (!edits.length) return { text: jsonText, rewritten: [] }
  edits.sort((a, b) => b.start - a.start)
  let text = jsonText
  for (const e of edits) text = text.slice(0, e.start) + e.text + text.slice(e.end)
  try {
    JSON.parse(text)
  } catch (err) {
    throw new Error(`theme.json 写回后不是合法 JSON,拒绝落盘: ${err.message}`)
  }
  return { text, rewritten: edits.map((e) => `${e.start}`) }
}

/**
 * 走一遍 theme.ts 的 THEME_CHROME:只进对象字面量,块外(§5c 横幅、注释、其余导出)一字节不碰 ——
 * sync-miniapp-tokens.mjs 重铸整文件抹掉横幅那一课的同形防线。visit 签名同 walkThemeJson。
 */
export function walkThemeTs(tsText, visit) {
  const decl = /\bconst THEME_CHROME\b[^=]*=\s*\{/.exec(tsText)
  if (!decl) throw new Error('lib/theme.ts 找不到 `const THEME_CHROME ... = {`')
  const [rootStart, rootEnd] = balancedObjectBody(tsText, decl.index + decl[0].length - 1)
  const root = tsText.slice(rootStart, rootEnd)
  const edits = []
  // 两个子对象的 edits 一律按 root 原文坐标收集(light/dark 区间不重叠),最后倒序应用 ⇒ 遍历中途
  // 绝不重写 out(中途重写会让第二个主题块的坐标全体错位 —— 写门时的自造缺陷,由 S4/S7 幂等例钉死)。
  for (const theme of ['light', 'dark']) {
    const keyAt = new RegExp(`(^|[\\s,{])${theme}\\s*:\\s*\\{`).exec(root)
    if (!keyAt) throw new Error(`THEME_CHROME 找不到 ${theme} 子对象`)
    const braceAt = keyAt.index + keyAt[0].lastIndexOf('{')
    const [bStart, bEnd] = balancedObjectBody(root, braceAt)
    const body = root.slice(bStart, bEnd)
    const masked = maskComments(body)
    for (const m of masked.matchAll(/\b([A-Za-z][\w]*)\s*:\s*'([^']*)'/g)) {
      const field = m[1]
      const current = m[2]
      const next = visit(theme, field, CHROME_FIELDS.includes(field) ? field : null, current, HEX_RE.test(current))
      if (next === undefined || next === current) continue
      const raw = body.slice(m.index, m.index + m[0].length)
      const colon = raw.indexOf(':')
      const openQ = raw.indexOf("'", colon + 1)
      const closeQ = raw.lastIndexOf("'")
      edits.push({ start: bStart + m.index + openQ + 1, end: bStart + m.index + closeQ, text: next })
    }
  }
  let text = root
  for (const e of edits.sort((a, b) => b.start - a.start))
    text = text.slice(0, e.start) + e.text + text.slice(e.end)
  return { text: tsText.slice(0, rootStart) + text + tsText.slice(rootEnd), rewritten: edits.map((e) => `${e.start}`) }
}

// ─────────────────────────── 判定入口(守门 import 这个) ───────────────────────────

/** failures 的唯一分诊:四类红 vs 无法判定。门与生成器 main 共用,不得各写一遍 filter。 */
const RED_KINDS = new Set(['drifted', 'thirdValue', 'rot', 'unregistered'])
export function classifyFailures(failures) {
  return {
    red: failures.filter((f) => RED_KINDS.has(f.kind)),
    undetermined: failures.filter((f) => f.kind === 'undeterminedInfo'),
  }
}

/**
 * 纯判据:两份副本对 tokens.css 的一致性。全部吃字符串 ⇒ 可喂夹具。
 * failures 四类红:drifted(派生字段≠源头)/ thirdValue(登记字段≠登记值且≠源头)/
 * rot(登记表腐烂)/ unregistered(映射表与登记表都盖不住的色值键)/ undeclared 走同一红种;
 * undeterminedInfo(无法判定)由调用方判 exit 2,不记红也不记绿;nonColor 只计数。
 */
export function checkChrome({ tokensCss, themeJson, themeTs }) {
  const tables = sourceTables(tokensCss)
  const failures = []
  const counts = { derived: 0, registered: 0, nonColor: 0, undetermined: 0 }
  const visit = (target) => (theme, key, field, current, isHex) => {
    if (!field) {
      if (isHex)
        failures.push({ kind: 'unregistered', target, where: `${theme}.${key}`, value: current })
      else counts.nonColor++
      return undefined
    }
    const plan = planField(theme, field, tables)
    const verdict = judgeField(plan, current)
    if (!verdict) counts[plan.kind === 'derive' ? 'derived' : 'registered']++
    else if (verdict.kind === 'undeterminedInfo') counts.undetermined++
    failures.push(
      ...(verdict ? [{ kind: verdict.kind, target, where: `${theme}.${key}`, value: current, ...verdict.info }] : [])
    )
    return undefined
  }
  walkThemeJson(themeJson, visit(THEME_JSON_REL))
  walkThemeTs(themeTs, visit(THEME_TS_REL))
  return { failures, counts }
}

// ─────────────────────────── 写回入口(生成器 main 用) ───────────────────────────

/** 对两份副本跑判定并生成新文本:能靠写回修的(drifted/thirdValue)修,不能的进 blocking/undetermined。 */
export function syncCopies({ tokensCss, themeJson, themeTs }) {
  const tables = sourceTables(tokensCss)
  const blocking = []
  const undetermined = []
  const jsonRewrites = []
  const tsRewrites = []
  const mkVisit = (target, rewrites) => (theme, key, field, current, isHex) => {
    if (!field) {
      if (isHex)
        blocking.push({ kind: 'unregistered', target, where: `${theme}.${key}`, value: current })
      return undefined
    }
    const plan = planField(theme, field, tables)
    const verdict = judgeField(plan, current)
    if (!verdict) return undefined
    if (verdict.kind === 'drifted') {
      rewrites.push(`${theme}.${key}:${current}→${verdict.info.want}`)
      return verdict.info.want
    }
    if (verdict.kind === 'thirdValue') {
      rewrites.push(`${theme}.${key}:${current}→${verdict.info.registered}(登记值)`)
      return verdict.info.registered
    }
    const row = { kind: verdict.kind, target, where: `${theme}.${key}`, value: current, ...verdict.info }
    ;(verdict.kind === 'undeterminedInfo' ? undetermined : blocking).push(row)
    return undefined
  }
  const j = walkThemeJson(themeJson, mkVisit(THEME_JSON_REL, jsonRewrites))
  const t = walkThemeTs(themeTs, mkVisit(THEME_TS_REL, tsRewrites))
  return { nextJson: j.text, nextTs: t.text, jsonRewrites, tsRewrites, blocking, undetermined }
}

// ─────────────────────────── CLI ───────────────────────────

function readOrExit(rel) {
  const abs = resolve(ROOT, rel)
  if (!existsSync(abs)) {
    console.error(`[sync-miniapp-chrome] 文件不存在: ${rel} ⇒ 无法判定(不记为通过)`)
    process.exit(2)
  }
  return readFileSync(abs, 'utf8')
}

function main() {
  const tokensCss = readOrExit(TOKENS_SOURCE_REL)
  const themeJson = readOrExit(THEME_JSON_REL)
  const themeTs = readOrExit(THEME_TS_REL)
  const tables = sourceTables(tokensCss)
  if (tables.light.size === 0 || tables.dark.size === 0) {
    console.error('[sync-miniapp-chrome] tokens.css 取到 0 个档 ⇒ 无法判定(不记为通过)')
    process.exit(2)
  }
  let synced
  try {
    synced = syncCopies({ tokensCss, themeJson, themeTs })
  } catch (e) {
    console.error(`[sync-miniapp-chrome] ${e.message} ⇒ 无法判定`)
    process.exit(2)
  }
  const { blocking, undetermined, jsonRewrites, tsRewrites, nextJson, nextTs } = synced
  if (undetermined.length) {
    for (const f of undetermined)
      console.error(`[sync-miniapp-chrome] ⚠️ 无法判定 ${f.target}${f.where ? ` ${f.where}` : ''}: ${f.why ?? f.value}`)
    console.error('[sync-miniapp-chrome] 源头缺档或原生表达不了的形态 —— 不记红也不记绿,先修源(或改映射表)。')
    process.exit(2)
  }
  if (blocking.length) {
    for (const f of blocking)
      console.error(
        `[sync-miniapp-chrome] ❌ ${f.kind} ${f.target}${f.where ? ` ${f.where}` : ''} 现值 ${f.value}${f.why ? ` —— ${f.why}` : ''}`
      )
    console.error('[sync-miniapp-chrome] 登记表/结构层面的问题,生成器无权替你归类 —— 见上方逐条。')
    process.exit(1)
  }
  const changed = nextJson !== themeJson || nextTs !== themeTs
  if (!changed) {
    if (!isQuiet) {
      const v = checkChrome({ tokensCss, themeJson, themeTs })
      console.info(
        `[sync-miniapp-chrome] ✅ 两份 chrome 副本与 tokens.css 一致(派生比对 ${v.counts.derived} / 登记核对 ${v.counts.registered} / 非色字段 ${v.counts.nonColor} 不判)`
      )
    }
    process.exit(0)
  }
  for (const r of [...jsonRewrites.map((x) => `${THEME_JSON_REL} ${x}`), ...tsRewrites.map((x) => `${THEME_TS_REL} ${x}`)])
    console[isCheck ? 'error' : 'info'](`[sync-miniapp-chrome] ${isCheck ? '❌ 漂移' : '✏️ 写回'} ${r}`)
  if (isCheck) {
    console.error('[sync-miniapp-chrome] 修复:node scripts/sync-miniapp-chrome.mjs(原位写回,幂等)')
    process.exit(1)
  }
  writeFileSync(resolve(ROOT, THEME_JSON_REL), nextJson, 'utf8')
  writeFileSync(resolve(ROOT, THEME_TS_REL), nextTs, 'utf8')
  console.info('[sync-miniapp-chrome] ✅ 已原位写回 theme.json 与 lib/theme.ts 的 THEME_CHROME')
}

// ─────────────────────────── --self-test(纯内存夹具,成对正反) ───────────────────────────

function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') =>
    results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)

  const tokens = `@theme {
  /* 注释里的 --color-card: 散文不算声明 */
  --color-card: hsl(0 0% 100%);
  --color-primary: hsl(0 0% 0%);
  --color-background: hsl(0 0% 96.1%);
  --color-text-tertiary: #a3a3a3;
  --color-brand-accent: #8fb8cc;
}
:root { --color-late-later: #101010; }
.dark {
  --color-card: hsl(0 0% 10%);
  --color-primary: hsl(0 0% 100%);
  --color-background: hsl(0 0% 14%);
  --color-muted-foreground: hsl(0 0% 63.9%);
  --color-brand-accent: #a3c4d6;
}`
  const themeJson = `{
  "light": {
    "navBgColor": "#ffffff",
    "navTxtStyle": "black",
    "bgColor": "#f5f5f5",
    "bgTxtStyle": "light",
    "tabColor": "#A3A3A3",
    "tabSelectedColor": "#8fb8cc",
    "tabBgColor": "#ffffff",
    "tabBorderStyle": "white"
  },
  "dark": {
    "navBgColor": "#262626",
    "navTxtStyle": "white",
    "bgColor": "#262626",
    "bgTxtStyle": "dark",
    "tabColor": "#a3a3a3",
    "tabSelectedColor": "#a3c4d6",
    "tabBgColor": "#1a1a1a",
    "tabBorderStyle": "black"
  }
}`
  const themeTs = `const THEME_CHROME: Record<
  'light' | 'dark',
  { navBg: string; navFront: string; windowBg: string; tabColor: string; tabSelected: string; tabBg: string; tabBorder: 'white' | 'black' }
> = {
  light: {
    navBg: '#ffffff',
    navFront: '#000000',
    windowBg: '#f5f5f5',
    tabColor: '#A3A3A3',
    tabSelected: '#8fb8cc',
    tabBg: '#ffffff',
    tabBorder: 'white',
  },
  dark: {
    navBg: '#262626',
    navFront: '#ffffff',
    windowBg: '#262626',
    tabColor: '#a3a3a3',
    tabSelected: '#a3c4d6',
    tabBg: '#1a1a1a',
    tabBorder: 'black',
  },
}`

  // S1 现状必须全绿(反恒红:夹具就是真仓形状)
  const base = checkChrome({ tokensCss: tokens, themeJson, themeTs })
  ok('S1 真仓形状的夹具必须判绿', base.failures.length === 0, JSON.stringify(base.failures.slice(0, 3)))
  ok('S2 非色字段只计数(theme.json 枚举 6 + theme.ts tabBorder 2)', base.counts.nonColor === 8, JSON.stringify(base.counts))
  ok('S3 派生 18 处 / 登记 4 处(JSON 色键 5+3 面、TS 6+6 面)', base.counts.derived + base.counts.registered === 22, `derived=${base.counts.derived} registered=${base.counts.registered}`)

  // S4 阳性对照:改一个 token ⇒ 两份副本都该跟着改(syncCopies 精确点名)
  const movedTokens = tokens.replace('--color-brand-accent: #8fb8cc;', '--color-brand-accent: #135799;')
  const s4 = syncCopies({ tokensCss: movedTokens, themeJson, themeTs })
  ok(
    'S4 改 --color-brand-accent 后两份副本各恰 1 处待写回',
    s4.jsonRewrites.length === 1 && s4.tsRewrites.length === 1 && s4.blocking.length === 0,
    JSON.stringify(s4.jsonRewrites) + JSON.stringify(s4.tsRewrites)
  )
  ok('S5 写回只动那一个 hex,其余逐字节原位', s4.nextJson.includes('"tabColor": "#A3A3A3"') && s4.nextJson.includes('#135799') && s4.nextJson.includes('"navTxtStyle": "black"'))
  const s5 = checkChrome({ tokensCss: movedTokens, themeJson: s4.nextJson, themeTs: s4.nextTs })
  ok('S6 写回后必须归绿(生成器与门同判据的装车证明)', s5.failures.length === 0, JSON.stringify(s5.failures))
  const s6 = syncCopies({ tokensCss: movedTokens, themeJson: s4.nextJson, themeTs: s4.nextTs })
  ok('S7 幂等:对已同步副本再跑一次 = 0 字节改动', s6.nextJson === s4.nextJson && s6.nextTs === s4.nextTs)

  // S8 大小写保留:真仓副本今天若被判"改写",就是首次运行凭空产 diff(本票明令禁止的形态)
  ok('S8 #A3A3A3 vs 派生 #a3a3a3:同色不同字节 ⇒ 保留原字节,首次运行 0 改动', s_base_noop(s4, themeJson, themeTs, tokens))

  // S9 手改副本 ⇒ drifted 点名文件与字段
  const tampered = themeJson.replace('"tabSelectedColor": "#8fb8cc"', '"tabSelectedColor": "#ff0000"')
  const s9 = checkChrome({ tokensCss: tokens, themeJson: tampered, themeTs })
  ok('S9 手改 theme.json 派生字段 ⇒ 判漂移且点名文件+字段', s9.failures.length === 1 && s9.failures[0].kind === 'drifted' && s9.failures[0].target === THEME_JSON_REL && s9.failures[0].where === 'light.tabSelectedColor', JSON.stringify(s9.failures))

  // S10 登记面:第三个值 ⇒ thirdValue;等于 nearToken 源头值 ⇒ 也判 thirdValue 逼归类(副本对齐源头却不删登记)
  const tsReg = themeTs.replace("navBg: '#262626',", "navBg: '#2a2a2a',")
  const s10 = checkChrome({ tokensCss: tokens, themeJson, themeTs: tsReg })
  ok('S10 登记字段被改成第三个值 ⇒ thirdValue 点名', s10.failures.length === 1 && s10.failures[0].kind === 'thirdValue' && s10.failures[0].where === 'dark.navBg', JSON.stringify(s10.failures))
  const tsReg2 = themeTs.replace("navBg: '#262626',", "navBg: '#242424',")
  const s10b = checkChrome({ tokensCss: tokens, themeJson, themeTs: tsReg2 })
  ok('S10b 登记字段被手改成源头值而登记未删 ⇒ 仍判 thirdValue(归类必须显式)', s10b.failures.length === 1 && s10b.failures[0].kind === 'thirdValue', JSON.stringify(s10b.failures))

  // S11 登记表腐烂:源头 .dark background 落到 #262626 ⇒ rot 大声红
  const converged = tokens.replace('--color-background: hsl(0 0% 14%);', '--color-background: #262626;')
  const s11 = checkChrome({ tokensCss: converged, themeJson, themeTs })
  ok('S11 登记值与 nearToken 重新同值 ⇒ 腐烂红,两份副本各点名两条(2 字段 × 2 文件 = 4)', s11.failures.length === 4 && s11.failures.every((f) => f.kind === 'rot'), JSON.stringify(s11.failures.map((f) => f.kind + f.where)))

  // S12 摘掉登记 ⇒ 字段落进"无表覆盖"= unregistered 红(登记表不可能被静默摘除)
  const savedReg = CHROME_DECLARED_DIVERGENCE.dark.windowBg
  delete CHROME_DECLARED_DIVERGENCE.dark.windowBg
  const s12 = checkChrome({ tokensCss: tokens, themeJson, themeTs })
  ok('S12 删除一条登记 ⇒ 两份副本各判 unregistered', s12.failures.length === 2 && s12.failures.every((f) => f.kind === 'unregistered'), JSON.stringify(s12.failures.map((f) => f.kind + f.where)))
  CHROME_DECLARED_DIVERGENCE.dark.windowBg = savedReg
  const s12back = checkChrome({ tokensCss: tokens, themeJson, themeTs })
  ok('S12b 放回登记 ⇒ 立刻归绿(夹具自洁)', s12back.failures.length === 0)

  // S13 结构卫生:注释里的色值散文不得被当声明(两侧都走等长遮罩)
  const withBait = themeTs.replace('  dark: {', '  /* 旧值备忘 navBg: \'#123456\', */\n  dark: {')
  const s13 = checkChrome({ tokensCss: tokens, themeJson, themeTs: withBait })
  ok('S13 注释里的 navBg: 散文不得进判定面', s13.failures.length === 0, JSON.stringify(s13.failures))

  // S14 未登记的新色键 ⇒ 红(两份文件同一判据)
  const jsonExtra = themeJson.replace('"tabBgColor": "#1a1a1a",', '"tabBgColor": "#1a1a1a",\n    "searchBgColor": "#abcdef",')
  const s14 = checkChrome({ tokensCss: tokens, themeJson: jsonExtra, themeTs })
  ok('S14 theme.json 冒出新色键 ⇒ unregistered 点名', s14.failures.length === 1 && s14.failures[0].kind === 'unregistered' && s14.failures[0].where === 'dark.searchBgColor', JSON.stringify(s14.failures))

  // S15 源头缺档 ⇒ 无法判定(undetermined 计数,不冒红也不记绿)
  const starved = tokens.replace('--color-text-tertiary: #a3a3a3;', '')
  const s15 = checkChrome({ tokensCss: starved, themeJson, themeTs })
  ok('S15 源头档缺失 ⇒ undetermined 而非静默通过', s15.failures.some((f) => f.kind === 'undeterminedInfo') && s15.counts.undetermined >= 1, JSON.stringify(s15.failures.map((f) => f.kind)))

  // S16 rgba 类不可表达 ⇒ undetermined(原生 chrome 只能 #rrggbb)
  const rgba = tokens.replace('--color-brand-accent: #8fb8cc;', '--color-brand-accent: rgba(143, 184, 204, 0.5);')
  const s16 = checkChrome({ tokensCss: rgba, themeJson, themeTs })
  ok('S16 归一后不是 #rrggbb ⇒ undetermined,绝不静默写入', s16.failures.some((f) => f.kind === 'undeterminedInfo'), JSON.stringify(s16.failures.map((f) => f.kind)))

  // S17 后续 :root 块必须并入(light 档取源)—— design-token-blocks 的那一课
  const lateRoot = tokens + '\n:root { --color-card: hsl(0 0% 100%); }'
  const s17 = checkChrome({ tokensCss: lateRoot, themeJson, themeTs })
  ok('S17 追加的 :root 块参与取源且不破坏判定', s17.failures.length === 0)

  for (const r of results) console.log(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  console.log(failed ? `self-test 失败 ${failed} 条` : `✅ self-test 全通过(${results.length} 条)`)
  process.exit(failed ? 1 : 0)
}

/** S8 辅助:以真表为源跑一次 syncCopies,确认两份副本 0 字节改动(首跑不产伪 diff)。 */
function s_base_noop(s4, themeJson, themeTs, tokens) {
  const baseSync = syncCopies({ tokensCss: tokens, themeJson, themeTs })
  return baseSync.nextJson === themeJson && baseSync.nextTs === themeTs && baseSync.jsonRewrites.length === 0 && baseSync.tsRewrites.length === 0
}

// §22d:CLI 直接执行才跑主流程;被镜像测试 import 时不得有写盘副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    if (isSelfTest) selfTest()
    else main()
  } catch (error) {
    console.error('[sync-miniapp-chrome] 执行失败:', error?.message ?? error)
    process.exit(2)
  }
}

export const __test__ = {
  sourceTables,
  planField,
  judgeField,
  classifyFailures,
  checkChrome,
  syncCopies,
  walkThemeJson,
  walkThemeTs,
  CHROME_FIELDS,
  CHROME_DERIVATION,
  CHROME_DECLARED_DIVERGENCE,
  JSON_KEY_TO_FIELD,
  TOKENS_SOURCE_REL,
  THEME_JSON_REL,
  THEME_TS_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
