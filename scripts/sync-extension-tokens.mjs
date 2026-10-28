#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本文件是 CLI 工具(判据 + 写回器),诊断信息就是它的输出面 */
/**
 * sync-extension-tokens.mjs — 把 `packages/design-tokens/src/styles/tokens.css` 的色值
 * **派生**进扩展注入样式里的那两处影子副本,并把**无法派生**的档收进带理由的登记表。
 *
 * 为什么必须有它(不是便利脚本):
 *   扩展的 content script 把样式注进**第三方页面**的 shadow DOM / 宿主要素内,拿不到本站的
 *   `:root`,所以那些 `--color-*: #hex` 必须自带字面量 —— 这是合法形态,不能删。但副本一旦与
 *   源头漂移,症状就是"web 改了扩展没改",而 2026-09-25 实测:守门「跨端色值 token 漂移对账」
 *   的 R1–R7 全部只看 RN `rn-tokens.ts` ↔ tokens.css 与 v3 端 alpha 面,**对这两处零覆盖**。
 *
 * 三条判据(缺一条就是没有):
 *   D1 **可派生档必须逐位同值**:该键在 tokens.css 存在、且不在任何登记表里 ⇒ 副本值必须等于
 *      源头值(按副本声明的档案取,见 COPY_PROFILE)。不等即红,修复出口 = 跑本脚本(不带 --check)。
 *   D2 **不跟源头走的档必须登记理由**:
 *        · EXTENSION_ONLY_KEYS = tokens.css 根本没有这一档(实测取不到),无从派生;
 *        · DECLARED_DIVERGENCE = 源头有同名档但语义不是一回事(证据写在每条 reason 里,
 *          全部来自副本文件的自身注释或用量位,不臆造)。
 *      副本里出现"既没登记、tokens.css 也没有"的新档 ⇒ 红(拦"端内自立一档"的入口)。
 *   D3 **登记表双向防腐烂**:登记项在副本里已不存在 ⇒ 红;登记的"与源头分歧"这一事实已不成立
 *      (有人对齐了却忘删登记)⇒ 红;登记值被改动却没同步登记 ⇒ 红。
 *
 * 另有一条**影子重定义面**(SHADOW_BLOCKS):`packages/ui-react/src/styles/auth-shell.css` 的
 * `.login-scope` / `.dark .login-scope` 在作用域内刻意改写 `--color-accent` / `--color-muted`,
 * 依据是该文件头注与 §1/§5 的视觉决策(登录栏 hover 要在白卡上"凸出")。**这类覆盖不得派生**
 * —— 派生等于把登录按钮的 hover 反馈改没了。所以它走登记,并额外支持 `deriveFrom`:登记的依据
 * 若是"等于源头另一个档",就把那条依据变成机判 —— 源头那个档一改,这里当场红。
 *
 * 取材口径与守门 70/77/83/94/98/101 同:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 只作人工排查逃生舱;源与副本**同一轮读同一个面**(混面会产出自洽但基准错位的绿)。
 * 写回模式(不带 --check)按定义只能作用于磁盘上的工作树。
 *
 * 用法:
 *   node scripts/sync-extension-tokens.mjs                 原位写回受管副本(幂等)
 *   node scripts/sync-extension-tokens.mjs --check         只判定(默认 HEAD 面),漂移即 exit 1
 *   node scripts/sync-extension-tokens.mjs --check --staged 判定索引面(pre-commit 用)
 *   node scripts/sync-extension-tokens.mjs --check --quiet 只出结论行
 *   node scripts/sync-extension-tokens.mjs --self-test     判据自检(不碰真仓文件)
 *   node scripts/sync-extension-tokens.mjs --help
 *
 * 退出码:0 = 一致/写回成功;1 = 判定失败(漂移、未登记、清单腐烂);2 = 无法判定(取不到源/副本、
 * git 不可用、脚本自身异常)。**2 既不冒红也绝不记绿。**
 */
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collectDecls, collectVars, extractAllBlocks, maskComments } from './lib/design-token-blocks.mjs'
import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
// 复用而非重写:①色值等值判定(hsl/rgb/hex 归一 + 单通道 ±1 容差)只在守门 93 里有一份实现;
// ②原位写回的实现只在 sync-rn-global-css 里有一份。两处各写一遍必然不同形 —— 那是本仓反复记录的成因。
import { colorsAgree } from './check-cross-end-tokens.mjs'
import { __test__ as RN_SYNC } from './sync-rn-global-css.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const SOURCE_REL = 'packages/design-tokens/src/styles/tokens.css'

/** 受管副本:扩展注入样式。副本是固定深色 chrome(注进任意站点都不反转),所以派生取 .dark。 */
export const COPY_PROFILE = 'dark'
export const COPY_FILES = [
  'apps/extension/entrypoints/content.ts',
  'apps/extension/entrypoints/content/content-toolbar.tsx',
]

/** 影子重定义面:作用域内刻意覆盖全局档 ⇒ 只登记、不派生。 */
export const SHADOW_BLOCKS = [
  { rel: 'packages/ui-react/src/styles/auth-shell.css', selector: '.login-scope', profile: 'light' },
  { rel: 'packages/ui-react/src/styles/auth-shell.css', selector: '.dark .login-scope', profile: 'dark' },
]

/**
 * D2 之一:tokens.css **没有**这一档,派生无门。
 * 理由必须是"取不到"这个可复算的事实(不是"我觉得"),所以每条都写明实测。
 */
export const EXTENSION_ONLY_KEYS = {
  '--color-accent-strong':
    'tokens.css 明暗两档均无 --color-accent-strong(collectVars 实测取不到)。扩展 toolbar 需要比 accent 更强的一档:默认描边(content-toolbar.tsx:230/:334)与 :active 底色(:284)。web 无对应变量,不得为过门去 tokens.css 凭空造一档 —— 那属 §4「真要新增品牌档」,须先落 tokens.css 再回来删掉本条。',
  '--color-info-muted':
    'tokens.css 无 --color-info-muted。它是 info(teal,见 DECLARED_DIVERGENCE)的 8% 透明衬底,只作 content.ts:189 翻译条背景;与 info/info-foreground 同进同退,单独派生它没有源头可对。',
}

/**
 * D2 之二:源头**有**同名档但两侧语义不是一回事,不得静默择一。
 * 每条 reason 的证据都必须是副本自己的注释行或使用位,不得臆造。
 * `value` = 登记当下的副本字面量;副本被改成第三个值 ⇒ 红(D3 第三条)。
 */
export const DECLARED_DIVERGENCE = {
  '--color-info': {
    value: '#14b8a6',
    reason:
      '副本注释原文(content.ts:182 / content-toolbar.tsx:261):「design-tokens 无 teal,content script 品牌强调色保留,借名 --color-info」。源头 --color-info 是蓝(亮 hsl(199 89% 48%) / 暗 hsl(199 80% 55%)),与 teal 不同色相。注:teal 在本仓并非不存在 —— packages/design-tokens/src/chart-colors.ts 有 CHART_TEAL = #14b8a6,只是没落进 tokens.css 的 CSS 变量面。真要收口,方向是"给 tokens.css 补一档 teal 再让两端一起指它",不是把扩展刷成蓝色。',
  },
  '--color-info-foreground': {
    value: '#0f766e',
    reason:
      '同族 teal。使用位是 content.ts:190 的 color:,其背景是上一档 info 的 8% 透明衬底(:189)⇒ 需要**深字浅底**;而源头 --color-info-foreground 的语义是"实心 info 底上的前景"(暗档 #fafafa,白字实心蓝底)。两个语义相反,强行配对等于白字压浅底。处置同守门 93 于 2026-09-17 移除「surface.inputBg ↔ --color-link-bg」那一对:语义不同则不配对。',
  },
  '--color-muted': {
    value: '#525252',
    reason:
      '副本里 --color-muted 的**唯一**使用位是 content-toolbar.tsx:281 的 border-color:(hover 描边)。源头 --color-muted 是背景档(暗 hsl(0 0% 14.9%) = #262626)。派生它会让 hover 描边从 #525252 掉到 #262626,而容器底色正是同批的 card #1a1a1a —— 描边与底色差 12% L,基本看不见。这是"边框档"借用了"背景档"的名字,属语义错配,不是漂移。',
  },
  '--color-secondary-foreground': {
    value: '#d4d4d4',
    reason:
      '副本使用位是 content-toolbar.tsx:323 的 color:(划词弹窗里的释义列表,刻意比正文暗一档)。源头暗档该值 = hsl(0 0% 98%) = 与 --color-foreground **逐位同值** —— shadcn 里它是"secondary 胶囊底上的前景",不是"次级文字色"。派生会把弹窗的正文/次级两级文字撞成同一颜色,层级直接消失。又一例语义错配。',
  },
  '--color-warning': {
    value: 'rgba(250, 204, 21, 0.45)',
    reason:
      '副本使用位是 content-toolbar.tsx:271 的 mark.ihui-hl 高亮底色 —— 荧光笔必须**半透明**,否则盖住第三方页面被标记的正文。登记值 = yellow-400 @45% alpha;源头 --color-warning 暗档是不透明 amber hsl(38 85% 55%),既不同色相也不同不透明度。副本里没有注释说明为什么取 yellow 而不是 amber,所以本条只登记为"未决视觉决策",**不得**为了过门把 alpha 抹掉或把色相改成 amber。若要收口:先定"高亮是否统一 amber",再考虑加一档"只派生通道、保留本地 alpha"的规则(那是新增机制,不在本票范围)。',
  },
}

/**
 * 影子重定义的登记表面。键 = `<选择器>|<CSS 变量名>`。
 * `value` = 该作用域内登记的字面量;`deriveFrom` = 依据若是"等于源头另一个档",
 * 填那个档名 —— 于是这条依据本身也进机判(源头那一档一改,这里立刻红)。
 */
export const SHADOW_DIVERGENCE = {
  '.login-scope|--color-accent': {
    value: 'hsl(0 0% 100%)',
    reason:
      'auth-shell.css 头注:20「浅色: --color-accent / --color-muted = 纯白,让 hover:bg-accent 凸出」+ §1 注释:31-34(M-70 增强版)。登录栏在白卡上靠纯白 hover 才有反馈,派生成源头的 hsl(0 0% 88%) 就没有"凸出"了。',
  },
  '.login-scope|--color-muted': {
    value: 'hsl(0 0% 100%)',
    reason: '同上(auth-shell.css:20 一句话管两档:accent 与 muted 在浅色登录栏内都提纯白)。',
  },
  '.login-scope|--color-accent-foreground': {
    value: 'hsl(0 0% 3.9%)',
    deriveFrom: '--color-foreground',
    reason:
      'auth-shell.css §1 注释:34-36「--color-accent-foreground 改为与 --color-foreground 一致,让 hover:text-accent-foreground 不改变文字颜色 → 与第三方按钮 icon 视觉一致」。依据可复算:这一档必须**始终等于** tokens.css 亮档的 --color-foreground,故登记 deriveFrom —— 源头改 foreground 时本登记立刻红,逼人跟着改,而不是悄悄失配。',
  },
  '.dark .login-scope|--color-accent': {
    value: 'hsl(0 0% 22%)',
    reason:
      'auth-shell.css §1 注释:37-39「暗色:.dark .login-scope 显式恢复默认 --color-accent / --color-muted,但 --color-accent 从默认 17% 提到 22%(14% bg-background → 22% hover,8% L 跳跃更明显)」。⚠️ 该注释写的"默认 17%"与 tokens.css 现值 .dark --color-accent = hsl(0 0% 24%) 已不符(注释滞后),登记依据取后半句"14% 背景上要 8% L 跳跃" —— 现值 22% 与源头 24% 差 5/255 通道,是真分歧不是舍入。',
  },
  '.dark .login-scope|--color-muted': {
    value: 'hsl(0 0% 22%)',
    reason: 'auth-shell.css §1 注释:39「muted 同理提到 22%,保持与 accent 同步」。',
  },
}

// ─────────────────────────── 纯判据层(全部吃字符串,可喂夹具) ───────────────────────────

/** tokens.css → { light, dark } 两张 name→value 表;dark 含 cascade 回退(未覆盖即用亮档)。 */
export function sourceTables(tokensCssText) {
  const asValues = (m) => new Map([...m].map(([k, d]) => [k, d.value]))
  const light = asValues(collectVars(tokensCssText, ['@theme', ':root']))
  return { light, dark: new Map([...light, ...asValues(collectVars(tokensCssText, ['.dark']))]) }
}

/**
 * 一份文本里的 `--color-*` 声明(按出现顺序,含同名多次)。
 * 取值一律走 `design-token-blocks`(先等长遮注释,再 collectDecls)—— 本文件**不得**出现第二份
 * CSS 取值正则;注释里的「--color-x: 说明」散文被当数据这一族已在本仓翻车过三次。
 */
export function colorDecls(text) {
  return collectDecls(maskComments(text)).filter((d) => d.name.startsWith('--color-'))
}

/** 非 --color- 的自定义属性(如扩展的 --shadow-*):本票不管,但如实计数,绝不静默略过。 */
export function otherCustomProps(text) {
  return collectDecls(maskComments(text)).filter((d) => !d.name.startsWith('--color-'))
}

/** 该文件里"归我派生"的那些档:在源头存在、且不在任何登记表里。 */
export function derivableDecls(text, tables, profile = COPY_PROFILE) {
  const src = tables[profile]
  const seen = new Set()
  const out = []
  for (const d of colorDecls(text)) {
    if (seen.has(d.name)) continue
    seen.add(d.name)
    if (!src.has(d.name)) continue
    if (d.name in EXTENSION_ONLY_KEYS || d.name in DECLARED_DIVERGENCE) continue
    out.push({ name: d.name, value: src.get(d.name) })
  }
  return out
}

/** 副本面的判定(D1 + D2 + D3)。texts = `[[rel, text]]`。 */
export function checkCopies({ texts, tables }) {
  const failures = []
  const present = new Set()
  let derived = 0
  let registered = 0
  let drifted = 0
  const src = tables[COPY_PROFILE]
  for (const [rel, text] of texts) {
    for (const d of colorDecls(text)) {
      present.add(d.name)
      if (d.name in EXTENSION_ONLY_KEYS) {
        registered++
        continue
      }
      if (!src.has(d.name)) {
        failures.push({
          tag: `D2 未登记的扩展自有档 ${d.name}`,
          detail: `${rel} 里有这一档,但 tokens.css 没有、EXTENSION_ONLY_KEYS 也没登记 ⇒ 它一旦与任何端漂移都无人看守。要么删掉改用源头已有档,要么进 EXTENSION_ONLY_KEYS 并写明"tokens.css 为何没有它"(须是可复算的事实,不是"就是这样")。`,
        })
        continue
      }
      const reg = DECLARED_DIVERGENCE[d.name]
      if (reg) {
        registered++
        if (!colorsAgree(d.value, reg.value))
          failures.push({
            tag: `D3 已登记分歧档被改成第三个值 ${d.name}`,
            detail: `${rel} 当前 = ${d.value},登记值 = ${reg.value},源头 = ${src.get(d.name)}。改了副本就必须同时改登记与理由(理由要能说明为什么仍不能对齐),不得静默择一。`,
          })
        if (colorsAgree(d.value, src.get(d.name)))
          failures.push({
            tag: `D3 登记表腐烂 ${d.name}`,
            detail: `${rel} 的 ${d.name} 已与源头 ${src.get(d.name)} 同值 ⇒ 这条"语义分歧"登记已失效,请从 DECLARED_DIVERGENCE 删除,交给 D1 派生看守。`,
          })
        continue
      }
      derived++
      if (!colorsAgree(d.value, src.get(d.name))) {
        drifted++
        failures.push({
          tag: `D1 副本与 tokens.css 漂移 ${d.name}`,
          detail: `${rel} 当前 = ${d.value},源头(${COPY_PROFILE})= ${src.get(d.name)}。修复:node scripts/sync-extension-tokens.mjs(原位写回,幂等)`,
        })
      }
    }
  }
  // 登记项在副本里已不存在 = 清单腐烂(§4 明文:豁免项若已不存在同样算红)
  for (const k of Object.keys(EXTENSION_ONLY_KEYS))
    if (!present.has(k))
      failures.push({
        tag: `D3 登记表腐烂(EXTENSION_ONLY_KEYS) ${k}`,
        detail: `登记的 ${k} 在两个受管副本里都已找不到 ⇒ 请删除该条,别让豁免清单继续膨胀。`,
      })
  for (const k of Object.keys(DECLARED_DIVERGENCE))
    if (!present.has(k))
      failures.push({
        tag: `D3 登记表腐烂(DECLARED_DIVERGENCE) ${k}`,
        detail: `登记的 ${k} 在两个受管副本里都已找不到 ⇒ 请删除该条(或它本就该由 D1 派生看守)。`,
      })
  return {
    failures,
    counts: { derived, registered, drifted, occurrences: present.size },
  }
}

/** 影子重定义面的判定(D2/D3 的影子版 + deriveFrom 的"依据跟着源头动")。 */
export function checkShadow({ texts, tables }) {
  const failures = []
  const present = new Set()
  let hit = 0
  for (const block of SHADOW_BLOCKS) {
    const text = texts.get(block.rel)
    if (text === undefined || text === null)
      throw new Undetermined(`影子面取不到 ${block.rel}(判定面 = ${block.profile})`)
    const blocks = extractAllBlocks(text, block.selector)
    // 块整条不见了 **不抛"无法判定"** —— 那是登记表腐烂的一种(作用域被改名/搬走而表没跟上),
    // 必须判红并点名。只有"文件取不到"才是取材失败(见上一行)。抛在这里会让这种腐烂伪装成
    // 环境问题,而环境问题的默认处置是"重试/忽略",腐烂的默认处置是"删登记或补块"。
    const decls = []
    for (const b of blocks) for (const d of collectDecls(maskComments(b))) if (d.name.startsWith('--color-')) decls.push(d)
    for (const d of decls) {
      const id = `${block.selector}|${d.name}`
      present.add(id) // 腐烂判据吃的是"这一轮真见过哪些档",所以必须在任何 continue 之前登记
      const src = tables[block.profile]
      if (!src.has(d.name)) {
        failures.push({
          tag: `D2 影子块里出现 tokens.css 不存在的档 ${id}`,
          detail: `${block.rel} 的 ${block.selector} 重定义了 ${d.name},而源头没有这一档 —— 作用域内造新档 = 第二个真相源。新增色档必须先落 tokens.css(§4)。`,
        })
        continue
      }
      const reg = SHADOW_DIVERGENCE[id]
      if (!reg) {
        if (colorsAgree(d.value, src.get(d.name))) continue // 与源头同值的冗余重声明:不改观感,不判红也不假装管住了
        failures.push({
          tag: `D2 未登记的影子重定义 ${id}`,
          detail: `${block.rel} 在 ${block.selector} 内把 ${d.name} 改成 ${d.value},源头(${block.profile})= ${src.get(d.name)},而 SHADOW_DIVERGENCE 里没有这条 ⇒ 局部覆盖必须有依据(注释原文/视觉规范),不得裸改。确属有意就登记并写 reason;不属有意就删这一行。`,
        })
        continue
      }
      hit++
      // 依据是"等于源头另一档"时,那一档一改本条立刻红 —— 登记不是免检,是换一根更准的尺子
      const expect = reg.deriveFrom ? src.get(reg.deriveFrom) : null
      if (reg.deriveFrom && expect === undefined)
        throw new Undetermined(`${id} 的 deriveFrom 指向 ${reg.deriveFrom},但源头 ${block.profile} 档里取不到它`)
      if (reg.deriveFrom && !colorsAgree(reg.value, expect))
        failures.push({
          tag: `D3 登记依据已失效 ${id}`,
          detail: `登记的依据是「始终等于源头 ${block.profile} 的 ${reg.deriveFrom}」,而源头现值 = ${expect} ≠ 登记值 ${reg.value} ⇒ 源头改了、这一档没跟上(这正是"web 改了 ui-react 影子档没改")。修法:把 ${d.name} 与登记值一起改成 ${expect}。`,
        })
      if (!colorsAgree(d.value, reg.value))
        failures.push({
          tag: `D3 影子档被改成第三个值 ${id}`,
          detail: `${block.rel} 当前 = ${d.value},登记值 = ${reg.value}。改局部覆盖必须同时改登记与依据。`,
        })
      if (colorsAgree(d.value, src.get(d.name)))
        failures.push({
          tag: `D3 影子登记表腐烂 ${id}`,
          detail: `${id} 已与源头同值,"刻意覆盖"这一登记理由已不成立 ⇒ 从 SHADOW_DIVERGENCE 删除该行(那一行本身也可以删了)。`,
        })
    }
  }
  for (const id of Object.keys(SHADOW_DIVERGENCE))
    if (!id.includes('|'))
      failures.push({ tag: '登记表形态错误', detail: `SHADOW_DIVERGENCE 的键必须是 "<选择器>|<变量名>",got ${id}` })
  for (const id of Object.keys(SHADOW_DIVERGENCE))
    if (!present.has(id))
      failures.push({
        tag: `D3 影子登记表腐烂(整条已不存在) ${id}`,
        detail: `登记的 ${id} 在 ${SHADOW_BLOCKS.map((b) => b.selector).join(' / ')} 里都找不到 ⇒ 删除该条。`,
      })
  return { failures, counts: { registered: Object.keys(SHADOW_DIVERGENCE).length, hit } }
}

// ─────────────────────────── 写回层 ───────────────────────────

/**
 * 把一份文本里**所有** `--color-*` 声明的值挖成同一个哨兵。
 * 刻意复用 `mergeBlockBody`(仓库唯一的一份原位写回实现)而不是再写一条 `--color-x:...;` 正则 ——
 * "同一判据两处不同形"正是本仓反复记录的事故成因,而这里要的"只挖声明、别的一个字不动"
 * 与写回器做的动作是同一个动作。
 */
function punchOutColorDecls(text) {
  return RN_SYNC.mergeBlockBody(
    text,
    colorDecls(text).map((d) => ({ name: d.name, value: '∅' }))
  )
}

/**
 * 证明"重生成不吞内容":三件事同时成立才算安全。
 *  ① 声明条数与名字序列逐位不变(没有键被删除/新增/改序)
 *  ② 把所有 `--color-*` 声明**挖成哨兵**后,前后文本逐字节相同(证明改动只发生在声明值内部)
 *  ③ 非 --color- 的自定义属性条数不变(扩展的 --shadow-* 等)
 * 第 ② 条是主力:它比"行数没变"强 —— 行数没变也可能把注释挪个位置。
 */
export function assertSafeRewrite(before, after) {
  const problems = []
  const b = colorDecls(before)
  const a = colorDecls(after)
  if (b.length !== a.length) problems.push(`声明条数 ${b.length} → ${a.length}`)
  const bs = b.map((d) => d.name).join('\n')
  const as = a.map((d) => d.name).join('\n')
  if (bs !== as) {
    const lost = b.map((d) => d.name).filter((n, i) => as.split('\n')[i] !== n)
    problems.push(`键序列变化(首个失配:${lost[0] ?? '?'})`)
  }
  if (otherCustomProps(before).length !== otherCustomProps(after).length)
    problems.push('非 --color- 自定义属性条数变化')
  if (punchOutColorDecls(before) !== punchOutColorDecls(after))
    problems.push('声明以外的文本发生过移动(注释/空行/宿主代码被动过)')
  return problems
}

/**
 * 计算每个受管副本的目标文本(不写盘)。
 *
 * **值已语义等价 ⇒ 一个字都不改**:被复用的 `mergeBlockBody` 判的是**字符串全等**,而副本用
 * `#fafafa`、源头用 `hsl(0 0% 98%)` —— 同一颜色的两种写法在它眼里是"要改"。真让它改,本票会
 * 多带 2 行纯格式化 diff(实测首版就是这样:报 4 档、diff 6 行),而这正是"能派生就别让人记命令"
 * 反面的噪音。故这里**自己先按 colorsAgree 过滤**:某档名的每一次出现都已等价 ⇒ 整档不进 decls,
 * `mergeBlockBody` 对不在表里的键是"原样留下,不删也不判红",于是原字节(含缩写 hex)保留。
 * 反过来,只要有一次出现不等价就整档交给它重写 —— 否则 `--check` 报了 D1 而写回器修不动,
 * 修复出口就是假出口。
 */
export function planRewrites({ copyTexts, tables }) {
  const plan = []
  for (const [rel, text] of copyTexts) {
    const derivable = derivableDecls(text, tables)
    const byName = new Map()
    for (const d of colorDecls(text)) {
      if (!byName.has(d.name)) byName.set(d.name, [])
      byName.get(d.name).push(d.value)
    }
    const wanted = derivable.filter(
      (d) => !byName.get(d.name).every((v) => colorsAgree(v, d.value))
    )
    const before = new Map(colorDecls(text).map((d) => [d.name, d.value]))
    const after = RN_SYNC.mergeBlockBody(text, wanted)
    const changes = wanted
      .map((d) => ({ name: d.name, from: before.get(d.name), to: d.value }))
      .filter((c) => !colorsAgree(c.from, c.to))
    plan.push({ rel, before: text, after, changes, managed: derivable.length, written: wanted.length })
  }
  return plan
}

// ─────────────────────────── 取材 ───────────────────────────

function readFace(paths, face) {
  if (face === 'worktree') return new Map(paths.map((p) => [p, readWorktreeFile(ROOT, p)]))
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const revs = paths.map((p) => prefix + p)
  const got = catBatch(ROOT, revs)
  return new Map(paths.map((p, i) => [p, got.get(revs[i])]))
}

function requireFace(texts, face) {
  const missing = [...texts].filter(([, t]) => t === null || t === undefined).map(([p]) => p)
  if (missing.length)
    throw new Undetermined(
      `${face === 'staged' ? '索引' : 'HEAD'} 面取不到 ${missing.join(', ')} —— 判据不扫空气,也不猜另一面`
    )
}

/** 一次判定:源与所有副本/影子面同面同轮。 */
export function runCheck({ face }) {
  const rels = [SOURCE_REL, ...COPY_FILES, ...new Set(SHADOW_BLOCKS.map((b) => b.rel))]
  const texts = readFace(rels, face)
  requireFace(texts, face)
  const tables = sourceTables(texts.get(SOURCE_REL))
  const copyTexts = COPY_FILES.map((r) => [r, texts.get(r)])
  const copies = checkCopies({ texts: copyTexts, tables })
  const shadow = checkShadow({
    texts: new Map(SHADOW_BLOCKS.map((b) => [b.rel, texts.get(b.rel)])),
    tables,
  })
  const failures = [...copies.failures, ...shadow.failures]
  return {
    failures,
    counts: { ...copies.counts, ...shadow.counts },
    undeterminedNonColor: copyTexts.reduce((n, [, t]) => n + otherCustomProps(t).length, 0),
    face,
  }
}

// ─────────────────────────── 自检 ───────────────────────────

function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') =>
    results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)

  // 夹具表必须**覆盖两张表用到的每一个键**:少一个键,判据就把它报成"tokens.css 不存在的档"
  // (D2),于是影子面那几条用例全在对着夹具的洞打分而不是对着判据打分 —— 第一版就是这么红的。
  const tables = {
    light: new Map([
      ['--color-card', 'hsl(0 0% 100%)'],
      ['--color-accent', 'hsl(0 0% 88%)'],
      ['--color-accent-foreground', 'hsl(0 0% 9%)'],
      ['--color-muted', 'hsl(0 0% 92%)'],
      ['--color-foreground', 'hsl(0 0% 3.9%)'],
    ]),
    dark: new Map([
      ['--color-card', 'hsl(0 0% 10%)'],
      ['--color-foreground', 'hsl(0 0% 98%)'],
      ['--color-border', 'hsl(0 0% 22%)'],
      ['--color-accent', 'hsl(0 0% 24%)'],
      ['--color-accent-foreground', 'hsl(0 0% 98%)'],
      ['--color-muted', 'hsl(0 0% 14.9%)'],
      ['--color-info', 'hsl(199 80% 55%)'],
    ]),
  }
  const C = (texts) => checkCopies({ texts, tables })
  const S = (texts) => checkShadow({ texts: new Map(texts), tables })

  // 夹具只写少数几个键,所以"其余登记项在夹具里不存在"必然判腐烂 —— 那是**登记表面向**的
  // 真结论,不是这一条用例要证的。故每条用例只数硬红(腐烂单独数)。
  const isRot = (f) => f.tag.includes('腐烂')
  const hard = (r) => r.failures.filter((f) => !isRot(f))
  const rotOf = (r) => r.failures.filter(isRot)

  // D1 有牙:落后的副本必须红(这正是本票立项的那个现实形态,不是编的)
  const lag = C([
    ['a.tsx', 'x { --color-card: #161616; --color-border: #262626; }'],
  ])
  ok('D1 副本落后于源头 → 必红且逐条点名', hard(lag).length === 2 && hard(lag).every((f) => f.tag.startsWith('D1')), `${hard(lag).length} 硬红`)
  // D1 反向:已派生态必须绿(恒红门 = 逼人 --no-verify = 全部守门作废)
  const aligned = C([['a.tsx', 'x { --color-card: hsl(0 0% 10%); }']])
  ok('D1 反向对照:与源头同值 → 零硬红', hard(aligned).length === 0, `${hard(aligned).length} 硬红`)
  // 等值判定走 ±1 通道容差(hsl↔hex 同色不得算漂移)—— 必须在**派生面**上验,
  // 拿登记档(--color-muted)验会先撞上"改值未同步登记",测的就不是容差了(第一版踩过)。
  const rounding2 = C([['a.tsx', 'x { --color-card: #1a1a1a; }']])
  ok(
    'D1 ±1 容差:源头 hsl(0 0% 10%) 与副本 #1a1a1a 是同一颜色,不得判漂移',
    hard(rounding2).length === 0 && rounding2.counts.derived === 1,
    JSON.stringify(hard(rounding2).map((f) => f.tag))
  )
  // D2:源头没有、又没登记
  const rogue = C([['a.tsx', 'x { --color-toolbar-glow: #123456; }']])
  ok('D2 源头无此档且未登记 → 必红', hard(rogue).length === 1 && hard(rogue)[0].tag.startsWith('D2'))
  // D2:登记过的扩展自有档 → 绿(accent-strong 就是这一型)
  const extOnly = C([['a.tsx', 'x { --color-accent-strong: #404040; }']])
  ok('D2 已登记的扩展自有档 → 零硬红', hard(extOnly).length === 0)
  // 已登记分歧档按登记值原样写 → 零硬红(它是"合法的不一致",不得被当漂移抹掉)
  const tealOk = C([['a.ts', 'x { --color-info: #14b8a6; }']])
  ok(
    'D2 已登记分歧档按登记值写 → 零硬红(不得为了过门把 teal 刷成源头的蓝)',
    hard(tealOk).length === 0 && tealOk.counts.registered >= 1,
    JSON.stringify(hard(tealOk).map((f) => f.tag))
  )
  // D2/D3:登记的 teal 分歧被改成源头蓝 → 既"改了没同步登记"又"该登记已腐烂"
  const quietlyAligned = C([['a.ts', 'x { --color-info: hsl(199 80% 55%); }']])
  ok(
    'D3 已登记分歧档被改成源头值 → 必红(改值未同步 + 该条登记腐烂)',
    quietlyAligned.failures.filter((f) => f.tag.includes('被改成第三个值 --color-info')).length === 1 &&
      quietlyAligned.failures.filter((f) => f.tag === 'D3 登记表腐烂 --color-info').length === 1,
    JSON.stringify(quietlyAligned.failures.map((f) => f.tag))
  )
  const thirdValue = C([['a.ts', 'x { --color-info: #ff0000; }']])
  ok(
    'D3 已登记分歧档被改成第三个值 → 必红',
    thirdValue.failures.filter((f) => f.tag.includes('被改成第三个值 --color-info')).length === 1
  )
  // D3 腐烂:登记的键在副本里全部消失
  const allGone = C([['a.ts', 'x { }']])
  ok(
    'D3 登记项已不存在 → 判腐烂且条数 = 登记表条数(防清单只增不减)',
    rotOf(allGone).length === Object.keys(EXTENSION_ONLY_KEYS).length + Object.keys(DECLARED_DIVERGENCE).length &&
      hard(allGone).length === 0,
    `${rotOf(allGone).length} 腐烂 / ${hard(allGone).length} 硬红`
  )
  // 散文不得当声明:注释里的 --color-x: 说明
  const comment = C([['a.tsx', '/* 借名 --color-info,值保留 */\nx { --color-card: hsl(0 0% 10%); }']])
  ok('注释里的 "--color-x: 散文" 不得被当声明', hard(comment).length === 0 && comment.counts.derived === 1)
  // 真仓形态:同名档出现多次时每一次都单独判(第一版夹具漏了 `;` —— 声明正则要求分号收尾,
  // 于是整个用例一条声明都没收到,判据"零红"是假的;这条教训与"扫到 0 先怀疑判据"同族)
  const dup = C([['a.tsx', 'x{--color-card:hsl(0 0% 10%);} y{--color-card:#161616;}']])
  ok(
    '同名档出现多次 → 每一次都单独判(否则第二处的漂移会隐身)',
    dup.counts.derived === 2 && dup.failures.filter((f) => f.tag.startsWith('D1')).length === 1,
    `派生比对 ${dup.counts.derived} 次 / D1 ${dup.failures.filter((f) => f.tag.startsWith('D1')).length} 条`
  )

  // ── 影子面 ──
  // 夹具必须用**登记表里那个真实路径**当键:第一版写成 'p.css',于是 checkShadow 查
  // SHADOW_BLOCKS[].rel 永远查不到 ⇒ 每条夹具都从"判据红"退化成"取不到抛异常",
  // 看着像有牙其实一口没咬(自检当场就炸在这条上,故留此注释)。
  const SH = SHADOW_BLOCKS[0].rel
  const LIGHT = '.login-scope'
  const DARK = '.dark .login-scope'
  const fullShadow = `${LIGHT} { --color-accent: hsl(0 0% 100%); --color-accent-foreground: hsl(0 0% 3.9%); --color-muted: hsl(0 0% 100%); }\n${DARK} { --color-accent: hsl(0 0% 22%); --color-muted: hsl(0 0% 22%); }`
  const shadowOk = S([[SH, fullShadow]])
  ok(
    '影子登记面按登记值写 → 零红且 5 条登记全部命中',
    shadowOk.failures.length === 0 && shadowOk.counts.hit === Object.keys(SHADOW_DIVERGENCE).length,
    JSON.stringify(shadowOk.failures.map((f) => f.tag))
  )
  const shadowRogue = S([[SH, `${fullShadow}\n${LIGHT} { --color-card: #123456; }`]])
  ok(
    'D2 未登记的影子重定义 → 必红并点名',
    hard(shadowRogue).length === 1 &&
      hard(shadowRogue)[0].tag.startsWith('D2') &&
      hard(shadowRogue)[0].tag.includes('--color-card'),
    JSON.stringify(shadowRogue.failures.map((f) => f.tag))
  )
  const shadowRedundant = S([[SH, `${fullShadow}\n${LIGHT} { --color-card: hsl(0 0% 100%); }`]])
  ok(
    'D2 反向对照:与源头同值的冗余重声明不得判红(只登记真分歧)',
    shadowRedundant.failures.length === 0,
    JSON.stringify(shadowRedundant.failures.map((f) => f.tag))
  )
  // deriveFrom 是本票给影子面装上的唯一"自动跟上"通道:源头 anchor 档一改就红
  const src2 = { light: new Map(tables.light), dark: tables.dark }
  src2.light.set('--color-foreground', 'hsl(0 0% 12%)')
  const afterMove = checkShadow({ texts: new Map([[SH, fullShadow]]), tables: src2 })
  ok(
    'D3 deriveFrom 有牙:源头 anchor 档一改,登记依据立刻红(同一夹具未改时必须零红)',
    shadowOk.failures.length === 0 &&
      afterMove.failures.some(
        (f) => f.tag.includes('登记依据已失效') && f.tag.includes('--color-accent-foreground')
      ),
    JSON.stringify(afterMove.failures.map((f) => f.tag))
  )
  // 影子块整条不见 = 登记表腐烂(判红点名),**不是**"无法判定" —— 抛异常会把腐烂伪装成环境问题
  const darkGone = S([[SH, `${LIGHT} { --color-accent: hsl(0 0% 100%); --color-accent-foreground: hsl(0 0% 3.9%); --color-muted: hsl(0 0% 100%); }`]])
  ok(
    'D3 影子块被整条删除 → 判该块下登记的腐烂,且不抛异常也不静默绿',
    hard(darkGone).length === 0 && rotOf(darkGone).length === 2,
    `硬红 ${hard(darkGone).length} / 腐烂 ${rotOf(darkGone).length}`
  )
  const shadowNewTier = S([[SH, `${fullShadow}\n${LIGHT} { --color-brand-new: #010101; }`]])
  ok(
    'D2 影子块里出现 tokens.css 没有的档 → 必红(新增档必须先落源头)',
    hard(shadowNewTier).length === 1 && hard(shadowNewTier)[0].tag.startsWith('D2')
  )
  let threwFile = false
  try {
    checkShadow({ texts: new Map(), tables })
  } catch (e) {
    threwFile = e instanceof Undetermined
  }
  ok('影子文件整个取不到 → 抛"无法判定"(不猜、不记绿)', threwFile)

  // ── 写回层:不吞内容 + 幂等 ──
  const srcReal = sourceTables(
    '@theme { --color-card: hsl(0 0% 10%); }\n:root { /* 说明 */ --color-border: hsl(0 0% 22%); }\n.dark { --color-card: hsl(0 0% 10%); }'
  )
  const before =
    'const s = `\n  /* design-tokens 无 teal,借名 --color-info */\n  #t { --color-card: #161616; --color-accent-strong: #404040; --shadow-toolbar: 0 4px 16px rgba(0,0,0,.18); }\n`\nexport const P = 1 // --color-info: 这句是散文'
  const plan = planRewrites({ copyTexts: [['x.tsx', before]], tables: srcReal })
  const after = plan[0].after
  ok('写回:落后的 --color-card 换成源头值', /--color-card: hsl\(0 0% 10%\);/.test(after))
  ok('写回:登记的扩展自有档逐字不动', after.includes('--color-accent-strong: #404040;'))
  ok('写回:非 --color- 的 --shadow-* 逐字不动', after.includes('--shadow-toolbar: 0 4px 16px rgba(0,0,0,.18);'))
  ok('写回:块注释与 JS 行注释逐字不动', after.includes('/* design-tokens 无 teal,借名 --color-info */') && after.includes('// --color-info: 这句是散文'))
  ok('写回:JS 宿主代码逐字不动', after.includes('export const P = 1'))
  ok('写回:不补档(mergeBlockBody 的"块尾补入"分支不得触发)', !/自动补入/.test(after))
  ok('安全断言:本轮改写判安全', assertSafeRewrite(before, after).length === 0, JSON.stringify(assertSafeRewrite(before, after)))
  const again = planRewrites({ copyTexts: [['x.tsx', after]], tables: srcReal })[0].after
  ok('幂等:第二次与第一次逐字节相同', again === after)
  // 「值已语义等价 ⇒ 保留原字节」成对证明。被复用的 mergeBlockBody 判的是**字符串全等**,
  // 而副本习惯写 hex、源头写 hsl —— 不自己先按 colorsAgree 过滤,本票就会多带纯格式化的 diff
  // (真仓首跑实测:该改 4 行、diff 6 行)。这一对就是那次纠错留下的锁。
  const fmt = 'z { --color-card: #1a1a1a; --color-border: #262626; }'
  const fmtPlan = planRewrites({ copyTexts: [['x.tsx', fmt]], tables: srcReal })[0]
  ok(
    '写回:与源头同值但写法不同(#1a1a1a vs hsl(0 0% 10%))必须保留原字节',
    fmtPlan.after.includes('--color-card: #1a1a1a;') && fmtPlan.changes.length === 1,
    `改动 ${fmtPlan.changes.length} 档(${fmtPlan.changes.map((c) => c.name).join(',')})`
  )
  ok(
    '写回:反向对照 —— 真漂移的那一档(#262626 vs hsl(0 0% 22%))不得被同一条过滤器放过',
    fmtPlan.after.includes('--color-border: hsl(0 0% 22%);')
  )
  // 反向对照:真吞内容必须被 assertSafeRewrite 抓到(四种各抓一次)
  const swallow = [
    ['删掉一个键', before.replace(/\s*--color-card:[^;]+;/, '')],
    ['改动块外文本', before.replace('#161616', '#161616 ').replace('export const P = 1', 'export const P  = 1')],
    ['把注释挪位', before.replace('/* design-tokens', '\n  /* design-tokens')],
    ['多塞一条声明', after + '\nconst extra = `#z{--color-card: red;}`'],
  ]
  for (const [name, mutated] of swallow)
    ok(`安全断言有牙:${name} 必须被抓到`, assertSafeRewrite(before, mutated).length > 0)

  // ── 真仓不变量(只读,不写盘) ──
  if (!existsSync(join(ROOT, SOURCE_REL))) {
    ok('真仓源文件在位', false, SOURCE_REL)
  } else {
    const real = runCheck({ face: 'worktree' })
    ok(
      '真仓(工作树):派生面全部已登记或已对齐 ⇒ 登记表与副本无缺口',
      real.failures.every((f) => !f.tag.startsWith('D2')),
      JSON.stringify(real.failures.map((f) => f.tag))
    )
    ok('真仓:受管键数 > 0(扫到 0 一律不记绿)', real.counts.occurrences > 0, `${real.counts.occurrences} 键`)
    ok('真仓:影子登记全部命中', real.counts.hit === Object.keys(SHADOW_DIVERGENCE).length, `命中 ${real.counts.hit}`)
    const p = planRewrites({
      copyTexts: COPY_FILES.map((r) => [r, readWorktreeFile(ROOT, r)]),
      tables: sourceTables(readWorktreeFile(ROOT, SOURCE_REL)),
    })
    ok(
      '真仓:写回计划逐文件通过安全断言',
      p.every((x) => assertSafeRewrite(x.before, x.after).length === 0),
      JSON.stringify(p.map((x) => `${x.rel}:${x.changes.length} 改`))
    )
  }

  for (const r of results) console.log(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  console.log(failed ? `❌ self-test 失败 ${failed}/${results.length}` : `✅ self-test 全通过(${results.length} 条)`)
  return failed ? 1 : 0
}

// ─────────────────────────── CLI ───────────────────────────

const argv = process.argv.slice(2)
const isCheck = argv.includes('--check')
const isQuiet = argv.includes('--quiet') || argv.includes('-q')

function usage() {
  console.info(
    `sync-extension-tokens.mjs — tokens.css →(派生)扩展注入样式;影子重定义 →(登记)双向核

  node scripts/sync-extension-tokens.mjs                  原位写回 ${COPY_FILES.join(' ')}
  node scripts/sync-extension-tokens.mjs --check [--staged]  只判定(漂移/未登记/腐烂即 exit 1)
  node scripts/sync-extension-tokens.mjs --self-test
源: ${SOURCE_REL}
影子面: ${SHADOW_BLOCKS.map((b) => `${b.rel}#${b.selector}`).join(' , ')}
派生档案: ${COPY_PROFILE}(扩展注入面是固定深色 chrome,不随站点主题反转)`
  )
}

async function cli() {
  if (argv.includes('--help') || argv.includes('-h')) {
    usage()
    return 0
  }
  if (argv.includes('--self-test')) return selfTest() ? 1 : 0

  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) throw new Undetermined(error)

  if (isCheck) {
    const r = runCheck({ face })
    if (!isQuiet)
      console.log(
        `[sync-extension-tokens] 口径 ${face} · 派生面 ${r.counts.derived} 处已比对(漂移 ${r.counts.drifted})/ 登记面 ${r.counts.registered} 处 · 影子登记 ${r.counts.hit}/${Object.keys(SHADOW_DIVERGENCE).length} 命中 · 非色档 ${r.undeterminedNonColor} 处不管(如实报数)`
      )
    if (r.failures.length === 0) {
      if (!isQuiet) console.log('[sync-extension-tokens] ✅ 扩展注入样式与影子档均已收口')
      return 0
    }
    console.error(`[sync-extension-tokens] 发现 ${r.failures.length} 处问题:`)
    for (const f of r.failures) console.error(`  ❌ ${f.tag}: ${f.detail}`)
    console.error('  修复出口:node scripts/sync-extension-tokens.mjs(派生面)/ 改登记表(确属有意时)')
    return 1
  }

  // 写回模式只能作用于工作树(它写盘),源按磁盘现值取。
  const texts = readFace([SOURCE_REL, ...COPY_FILES], 'worktree')
  requireFace(texts, 'worktree')
  const tables = sourceTables(texts.get(SOURCE_REL))
  const plan = planRewrites({ copyTexts: COPY_FILES.map((r) => [r, texts.get(r)]), tables })
  let touched = 0
  for (const step of plan) {
    const problems = assertSafeRewrite(step.before, step.after)
    if (problems.length) {
      console.error(`[sync-extension-tokens] ❌ 拒绝写回 ${step.rel}: ${problems.join(';')} —— 一条都没落盘`)
      return 2
    }
    if (step.after === step.before) {
      if (!isQuiet) console.log(`  · ${step.rel} 已是派生态(${step.managed} 档)`)
      continue
    }
    writeFileSync(join(ROOT, step.rel), step.after, 'utf8')
    touched++
    if (!isQuiet)
      console.log(
        `  ✅ ${step.rel} 原位写回 ${step.changes.length} 档:` +
          step.changes.map((c) => `${c.name} ${c.from}→${c.to}`).join(' / ')
      )
  }
  if (!isQuiet)
    console.log(
      `[sync-extension-tokens] ${touched ? `已写回 ${touched} 个文件` : '无改动(幂等)'};影子面 ${SHADOW_BLOCKS.length} 块不参与派生`
    )
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 刻意不用顶层 await(§22d 点名 eslint no-top-level-await);同步抛错的 selfTest 也被 cli() 的
  // await 链吞进同一个 catch。退出码 2 = 脚本自身异常或"无法判定",与"判据红 = 1"分开。
  cli().then(
    (code) => process.exit(code),
    (e) => {
      if (e instanceof Undetermined) console.error(`❌ 无法判定:${e?.message ?? e}`)
      else console.error(`❌ 本脚本自身异常(非"无法判定"路径):\n${e?.stack ?? e}`)
      process.exit(2)
    }
  )
}

export const __test__ = {
  SOURCE_REL,
  COPY_FILES,
  COPY_PROFILE,
  SHADOW_BLOCKS,
  EXTENSION_ONLY_KEYS,
  DECLARED_DIVERGENCE,
  SHADOW_DIVERGENCE,
  sourceTables,
  colorDecls,
  otherCustomProps,
  derivableDecls,
  checkCopies,
  checkShadow,
  assertSafeRewrite,
  planRewrites,
  runCheck,
  Undetermined,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
