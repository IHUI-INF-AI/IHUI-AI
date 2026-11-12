#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-shadow-single-source.mjs — 投影(阴影)唯一数值源守门
 *
 * 唯一数值源:`packages/design-tokens/src/elevation.ts`
 *   · ELEVATION_STEPS  → RN 四元组(shadowColor/Offset/Opacity/Radius + elevation)
 *   · ELEVATION_CSS    → CSS box-shadow 字符串
 *   · ELEVATION_CSS_VAR→ web/小程序引用形式 `var(--shadow-elevation-*)`
 * 派生态:`packages/design-tokens/src/styles/tokens.css` 的受管块(scripts/sync-css-tokens.mjs 生成)
 * 与小程序的 `apps/miniapp-taro/src/app.css` / 扩展的派生块。派生态禁止手改。
 *
 * 判据(按行 / 规则块抽取 box-shadow 值):
 *   1. 违规:值中出现 `rgba(` / `rgb(` / `#` / 具体 px 模糊半径,且不属于下面四类豁免。
 *   2. 豁免(**必须在同一规则/对象上带中文豁免注释**,关键词「豁免」或「效果」):
 *      · @keyframes 内的发光/脉冲;
 *      · `inset` 内阴影;
 *      · 焦点环 `0 0 0 <n>px` / 无模糊硬阴影(模糊半径为 0);
 *      · 颜色部分已用 `var(--color-*)` / `color-mix(` 的效果光。
 *   3. RN:出现 `shadowOpacity` / `shadowRadius` 的样式对象,若不是 `...ELEVATION_STEPS.` 展开
 *      且无豁免注释 ⇒ 违规;安卓 `elevation: <数字>` 必须写成 `ELEVATION_STEPS.<step>.elevation`,
 *      效果性特例要在同一对象上方写「豁免类别:…」。
 *   4. 反向断言(2026-11-11 收口):`--shadow-premium*` / `--global-box-shadow` /
 *      Tailwind 默认档 `--shadow-{2xs,xs,sm,md,lg,xl,2xl}` 在 tokens.css **与小程序派生的
 *      app.css** 里一个定义都不准留(不是"必须是 var() 别名",是整族删除);
 *      全仓不得重新定义 `--lift-shadow`。
 *   5. 类名:全仓只准 `shadow-elevation-*`。Tailwind 默认档类名 `shadow-{2xs,xs,sm,md,lg,xl,2xl}`
 *      与裸 `shadow` 一律违规(裸 shadow 只在 className/cn(/clsx(/@apply 行上判),改法见 fix 字段。
 *      任意值 `shadow-[...]` 的逃生口也判:值必须是纯 `var(--shadow-elevation-*)`,否则命中行
 *      上方 5 行内须有「豁免类别:…」中文注释。
 *      这一族是投影的唯一尺子,浮起门(287)不再重复判 shadow。
 *
 * 取材面(照 AGENTS §0.4,统一走 scripts/lib/face-reader.mjs):
 *   默认 = 盘上现读(worktree)。样式门判的是"当前源码",工作树里正是待提交的那份内容;
 *   `--staged` 判索引面,`--head` 判 HEAD 面。取不到面 ⇒ exit 2,绝不回落另一面。
 *
 * 用法:
 *   node scripts/check-shadow-single-source.mjs            # 盘上现读(默认,等价 --check)
 *   node scripts/check-shadow-single-source.mjs --staged   # 索引面
 *   node scripts/check-shadow-single-source.mjs --head     # HEAD 面
 *   node scripts/check-shadow-single-source.mjs --json     # 机器可读
 * 注册:package.json `check:shadow-single-source`;聚合入口 `pnpm check:all`
 *   (scripts/all-checks-runner.mjs,与 check:cross-end-tokens 同一条)与
 *   scripts/run-8end-consistency-cert.mjs(CI 认证维度)。
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName, withExcludes } from './lib/exclude-dirs.mjs'
import { Undetermined, assertRepoRoot, selectFace } from './lib/face-reader.mjs'
import { readSources, sourceCandidates } from './lib/face-scan.mjs'
import { maskComments } from './lib/code-mask.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 源码扩展名白名单:只判样式/组件源码,不判文档与压缩产物。 */
const CODE_EXT_RE = /\.(css|scss|sass|less|ts|tsx|js|jsx|mjs|cjs|vue)$/i
/** 产物/快照类文件名后缀(生成的档表不算手写散写)。 */
const GENERATED_RE = /\.(generated|gen)\.[^./]+$|\.snap$/i

const SCAN_PATHSPECS = ['apps', 'packages']
/** 预筛:git grep 走 POSIX ERE(不支持前瞻),故用最宽的子串 `shadow`,
 *  真判据(档名/裸类名/四元组/别名族)全部在 judgeFile / judgeTokensCss 内。 */
const PREFILTER_RE = 'shadow'

const SKIP_DIRS = withExcludes([
  'tests',
  '__tests__',
  'e2e',
  'public',
  'snapshots',
  '__snapshots__',
  'storybook-static',
])

const TOKENS_CSS = 'packages/design-tokens/src/styles/tokens.css'
/** 小程序派生 CSS:同样不得回填第二族命名(--shadow-sm 等别名 2026-11-11 已出账)。 */
const MINIAPP_CSS = 'apps/miniapp-taro/src/app.css'

/** 中文豁免注释关键词(必须同规则/同对象上)。 */
const EXEMPT_COMMENT_RE = /豁免|效果/

/**
 * 显式豁免台账。每条:文件 + 行 + 类别 + 理由。
 * `line: 1` 表示**整文件**登记(只给唯一源本体/适配层用)。
 * 这些是**确认合理**的残留(非层级投影),不是"待修债务";新增条目必须写明理由。
 */
export const ALLOWLIST = Object.freeze([
  // ─── 唯一源本体 / 适配层(整文件) ─────────────────────────────
  {
    file: 'packages/design-tokens/src/elevation.ts',
    line: 1,
    category: 'single-source',
    reason: '唯一数值源本体:ELEVATION_STEPS 四元组就是被派生的那一份,自身不适用"必须展开"判据',
  },
  {
    file: 'apps/miniapp-taro/src/rn-compat/style.ts',
    line: 1,
    category: 'adapter',
    reason: '小程序 RN 兼容层:把 CSS box-shadow 解析成 RN 四元组的转换器实现,不是消费点',
  },
  // ─── 效果光 / 内阴影(带中文豁免注释,但颜色为定档字面量,不在四类自动豁免内) ───
  {
    file: 'apps/web/app/globals.css',
    // 行号随文件演化会漂(2026-11-12 删 update 卡片发光族 -83 行后由 1221 落到 1147)。
    // 判据按 file+line 精确匹配 ⇒ 挪动插删行后必须同步;改这里前先确认该行仍是下面理由描述的那一条。
    line: 1147,
    category: 'focus-glow',
    reason: 'AI 输入框 focus-within 的科技紫双层辉光:令牌无可用紫色,2026-11-11 用户定档单点字面量',
  },
  {
    file: 'apps/miniapp-taro/src/components/VipBenefitsPopup.tsx',
    line: 413,
    category: 'inset-glow',
    reason: 'elevation-lg 之上叠两条 inset 高光(白色 70%),是拟物高光不是第二套投影',
  },
  {
    file: 'apps/web/src/components/ai/overflow-shadow.tsx',
    line: 116,
    category: 'inset-glow',
    reason: '横向溢出线索的 inset 实体边(AGENTS §4):暗示可滚动,不参与 elevation 档',
  },
  {
    file: 'apps/web/src/components/ai/overflow-shadow.tsx',
    line: 125,
    category: 'inset-glow',
    reason: '横向溢出线索的 inset 实体边(AGENTS §4):暗示可滚动,不参与 elevation 档',
  },
  // ─── 容器/控件固有投影(非业务卡片) ───────────────────────────
  {
    file: 'apps/mobile-rn/src/lib/web-shell.web.ts',
    line: 32,
    category: 'shell-chrome',
    reason: 'RN Web 手机壳 #root 的屏幕外扩投影:是 web 预览容器的外壳描边,RN 真机不消费 CSS elevation',
  },
  {
    file: 'packages/ui-native/src/switch.tsx',
    line: 93,
    category: 'hard-shadow',
    reason: 'Switch 拨杆硬边阴影(shadowRadius 0):控件本身的立体描边,不是卡片层级投影',
  },
  {
    file: 'packages/ui-native/src/switch.tsx',
    line: 94,
    category: 'hard-shadow',
    reason: 'Switch 拨杆硬边阴影(shadowRadius 0):控件本身的立体描边,不是卡片层级投影',
  },
])

/** 逐 token 取长度(排除 var()/color 函数内部),返回数值序列。 */
const LENGTH_RE = /-?\d*\.?\d+(px|rpx|rem|em)?/g

function stripFunctions(value) {
  let out = value
  // 去掉 var(...) / rgba(...) / rgb(...) / hsl(...) / color-mix(...) 等括号内容,避免把色值里的数字读成模糊半径
  for (let i = 0; i < 6; i += 1) {
    const next = out.replace(/\b[a-zA-Z-]+\([^()]*\)/g, ' ')
    if (next === out) break
    out = next
  }
  return out
}

/** 抽取 box-shadow 值的几何档:offset-x / offset-y / blur / spread。 */
export function geometryOf(value) {
  const bare = stripFunctions(String(value))
  const lengths = []
  LENGTH_RE.lastIndex = 0
  for (const m of bare.matchAll(LENGTH_RE)) {
    const n = Number.parseFloat(m[0])
    if (Number.isFinite(n)) lengths.push({ n, unit: m[1] || '', raw: m[0] })
  }
  return {
    blur: lengths.length >= 3 ? lengths[2].n : 0,
    hasBlurLength: lengths.length >= 3,
  }
}

/** 值里是否含字面色值。 */
const LITERAL_COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/

/** 值是否为"纯 var(--shadow-elevation-*) 消费"(单源形态)。 */
export function isTokenOnly(value) {
  const v = String(value).trim()
  if (!v) return false
  const stripped = v
    .replace(/var\(--shadow-elevation-[a-z]+\)/g, '')
    .replace(/\b(none|inherit|initial|unset|revert)\b/g, '')
    .replace(/[\s,]/g, '')
  return stripped.length === 0 && /var\(--shadow-elevation-/.test(v)
}

/** @keyframes 块的行区间(含起止行)。 */
export function keyframesRanges(text) {
  const ranges = []
  const re = /@keyframes\s+[\w-]+\s*\{/g
  for (const m of text.matchAll(re)) {
    let depth = 0
    let end = -1
    for (let i = m.index + m[0].length - 1; i < text.length; i += 1) {
      const ch = text[i]
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end < 0) end = text.length - 1
    ranges.push({
      start: text.slice(0, m.index).split('\n').length,
      end: text.slice(0, end).split('\n').length,
    })
  }
  return ranges
}

const inRanges = (line, ranges) => ranges.some((r) => line >= r.start && line <= r.end)

/** 取命中行前 n 行 + 本行的原文(用于识别中文豁免注释)。 */
function contextAround(lines, line, before = 5) {
  const from = Math.max(0, line - 1 - before)
  return lines.slice(from, line).join('\n')
}

/**
 * CSS 的豁免注释通常写在**规则上方**(可能隔 1~6 行),
 * 因此从命中声明回溯到所在规则块的 `{`,再连同其上方 6 行一起作为上下文。
 */
function cssContext(masked, lines, index, line) {
  const open = masked.lastIndexOf('{', index)
  if (open < 0) return contextAround(lines, line)
  const ruleLine = masked.slice(0, open).split('\n').length
  const from = Math.max(0, ruleLine - 1 - 6)
  return lines.slice(from, line).join('\n')
}

/**
 * 单文件判据(纯函数)。
 * @param {string} rel 相对路径
 * @param {string} text 原文(与 maskComments 等长)
 * @returns {{violations:Array, hits:number}}
 */
export function judgeFile(rel, text) {
  const masked = maskComments(text)
  const lines = text.split('\n')
  const kf = keyframesRanges(masked)
  const violations = []
  let hits = 0

  const judgeValue = (line, rawValue, kind, ctxText) => {
    const value = rawValue.replace(/\s+/g, ' ').trim()
    if (!value) return
    if (/^(none|inherit|initial|unset|revert)$/i.test(value)) return
    if (isTokenOnly(value)) return
    hits += 1

    const isInset = /\binset\b/.test(value)
    const literalColor = LITERAL_COLOR_RE.test(value)
    const colorTokenized = /var\(--color-[a-z0-9-]+\)|color-mix\(/i.test(value)
    const { blur } = geometryOf(value)
    const blurLiteral = blur > 0
    if (!literalColor && !blurLiteral) return // 无色值且零模糊:不是投影数值散写

    const inKeyframes = kind === 'css' && inRanges(line, kf)
    const kfRange = inKeyframes ? kf.find((r) => line >= r.start && line <= r.end) : null
    // @keyframes 的豁免注释写在 @keyframes 上方,而命中点可能在内层 50%/100% 步骤里,
    // 故此时从 @keyframes 起始行上方 8 行起算上下文。
    const ctx = kfRange
      ? lines.slice(Math.max(0, kfRange.start - 1 - 8), line).join('\n')
      : ctxText || contextAround(lines, line)
    const commented = EXEMPT_COMMENT_RE.test(ctx)

    let category = null
    if (commented && inKeyframes) category = 'keyframes'
    else if (commented && isInset) category = 'inset'
    else if (commented && blur === 0) category = 'hard-shadow'
    else if (commented && colorTokenized) category = 'effect-light'

    if (category) return

    const reasons = []
    if (blurLiteral) reasons.push(`含具体模糊半径 ${blur}px`)
    if (literalColor) reasons.push('含字面色值')
    if (inKeyframes) reasons.push('@keyframes 内但缺中文豁免注释')
    violations.push({
      file: rel,
      line,
      kind,
      value: value.slice(0, 120),
      reason: reasons.join(' + ') || '未归类',
      fix: '改用 var(--shadow-elevation-*) / ELEVATION_STEPS.*;效果光请在同一规则上加「豁免类别:…」中文注释',
    })
  }

  // ── CSS / SCSS:box-shadow: <value>; ──
  const cssRe = /box-shadow\s*:\s*([^;{}]*)/g
  for (const m of masked.matchAll(cssRe)) {
    const line = masked.slice(0, m.index).split('\n').length
    judgeValue(line, m[1], 'css', cssContext(masked, lines, m.index, line))
  }

  // ── JS/TS:boxShadow: '...' / boxShadow: <expr> / el.style.boxShadow = '...' ──
  const jsRe = /boxShadow\s*:\s*(['"`])([^'"`]*)\1|boxShadow\s*:\s*([^,\n}]+)/g
  for (const m of masked.matchAll(jsRe)) {
    const line = masked.slice(0, m.index).split('\n').length
    const value = m[2] !== undefined ? m[2] : m[3]
    judgeValue(line, value, 'js')
  }
  const jsAssignRe = /boxShadow\s*=\s*(['"`])([^'"`]*)\1/g
  for (const m of masked.matchAll(jsAssignRe)) {
    const line = masked.slice(0, m.index).split('\n').length
    judgeValue(line, m[2], 'js')
  }

  // ── RN:shadowOpacity / shadowRadius 必须来自 ...ELEVATION_STEPS. ──
  const rnRe = /\bshadow(?:Opacity|Radius)\s*:/g
  for (const m of masked.matchAll(rnRe)) {
    const line = masked.slice(0, m.index).split('\n').length
    hits += 1
    // 向上找最近的 `{`,取该对象字面量窗口判是否展开唯一源
    const before = masked.slice(Math.max(0, m.index - 1200), m.index)
    const open = before.lastIndexOf('{')
    const window = open >= 0 ? before.slice(open) + masked.slice(m.index, m.index + 200) : masked.slice(m.index, m.index + 200)
    const spread = /\.\.\.\s*ELEVATION_STEPS\s*\./.test(window) || /\.\.\.\s*ELEVATION_STEPS\s*\[/.test(window)
    const ctx = contextAround(lines, line)
    const commented = EXEMPT_COMMENT_RE.test(ctx)
    if (spread || commented) continue
    violations.push({
      file: rel,
      line,
      kind: 'rn',
      value: (lines[line - 1] || '').trim().slice(0, 120),
      reason: 'RN shadowOpacity/shadowRadius 未展开唯一源 ELEVATION_STEPS',
      fix: '改为 { ...ELEVATION_STEPS.md },不要再写死四元组',
    })
  }

  // ── RN:安卓 elevation 数字必须来自 ELEVATION_STEPS.*.elevation(或带豁免注释) ──
  const rnElevRe = /\belevation:\s*(\d+)\b/g
  for (const m of masked.matchAll(rnElevRe)) {
    const line = masked.slice(0, m.index).split('\n').length
    hits += 1
    if (EXEMPT_COMMENT_RE.test(contextAround(lines, line))) continue
    violations.push({
      file: rel,
      line,
      kind: 'rn',
      value: `elevation: ${m[1]}`,
      reason: '安卓高程写死数字,未走 ELEVATION_STEPS 档位',
      fix: '改为 ELEVATION_STEPS.<step>.elevation;特殊用途请在同一对象上加「豁免类别:…」中文注释',
    })
  }

  // ── 类名:统一只准 shadow-elevation-*(Tailwind 默认档名与裸 shadow 均已清零) ──
  const classRe = /(?<![\w.$-])shadow-(2xs|xs|sm|md|lg|xl|2xl)\b(?![\w-])/g
  for (const m of masked.matchAll(classRe)) {
    const line = masked.slice(0, m.index).split('\n').length
    hits += 1
    violations.push({
      file: rel,
      line,
      kind: 'class',
      value: m[0],
      reason: 'Tailwind 默认阴影档名不在唯一源命名空间内',
      fix: '按档位换 shadow-elevation-{sm,md,lg,xl};不要再用 shadow-sm/md/lg/xl',
    })
  }
  // 裸 shadow:只在 className / cn( / clsx( / @apply 行上判,避免误伤 'shadow' 枚举与注释
  const bareRe = /(?<![\w.$/-])shadow(?![\w[(-])(?=[ "\'`;])/g
  for (const m of masked.matchAll(bareRe)) {
    const line = masked.slice(0, m.index).split('\n').length
    const textLine = lines[line - 1] || ''
    if (!/className|cn\(|clsx\(|@apply/.test(textLine)) continue
    hits += 1
    violations.push({
      file: rel,
      line,
      kind: 'class',
      value: 'shadow',
      reason: '裸 shadow 走 Tailwind 默认档,不属唯一源',
      fix: '改为 shadow-elevation-md(卡片档),按语义选 sm/md/lg/xl',
    })
  }

  // 任意值投影 shadow-[...]:Tailwind 的逃生口,值必须只消费 var(--shadow-elevation-*);
  // 效果光 / 零模糊硬边 / 方向性边缘影必须在命中行上方 5 行内带「豁免/效果」中文注释。
  const arbRe = /(?<![\w.$/-])(?:[a-zA-Z-]+:)*shadow-\[([^\]]+)\]/g
  for (const m of masked.matchAll(arbRe)) {
    const line = masked.slice(0, m.index).split('\n').length
    const value = m[1].replace(/_/g, ' ')
    if (isTokenOnly(value)) continue
    hits += 1
    const ctx = lines.slice(Math.max(0, line - 1 - 4), line).join('\n')
    if (EXEMPT_COMMENT_RE.test(ctx)) continue
    const { blur } = geometryOf(value)
    const blurb =
      blur === 0
        ? '零模糊硬边'
        : /var\(--color-[a-z0-9-]+\)|color-mix\(/i.test(value)
          ? '取色令牌的效果光'
          : '含具体模糊半径'
    violations.push({
      file: rel,
      line,
      kind: 'arbitrary',
      value: value.slice(0, 120),
      reason: `任意值投影绕过唯一档位表(${blurb})`,
      fix: '改用 shadow-elevation-*;确属效果光/硬边/方向性边缘影的,在命中行上方 5 行内写「豁免类别:…」中文注释',
    })
  }

  return { violations, hits }
}

/** 全仓不得重新定义 --lift-shadow(浮起阴影已并入 elevation 阶梯)。 */
export function findLiftShadowRedefinition(rel, text) {
  const masked = maskComments(text)
  const out = []
  const re = /--lift-shadow[\w-]*\s*:/g
  for (const m of masked.matchAll(re)) {
    out.push({
      file: rel,
      line: masked.slice(0, m.index).split('\n').length,
      kind: 'reverse',
      value: m[0].trim(),
      reason: '--lift-shadow 已并入 --shadow-elevation-*(不得重新定义第二套阴影数值)',
      fix: '删掉该定义,消费方改用 var(--shadow-elevation-lg) / .ui-lift',
    })
  }
  return out
}

/** 反向断言:--shadow-premium* / --global-box-shadow / Tailwind 默认档
 *  (--shadow-2xs|xs|sm|md|lg|xl|2xl)在 tokens.css 与小程序派生的 app.css 里
 *  **一个都不准再定义**(2026-11-11 起只保留 --shadow-elevation-* 一个族)。 */
export function judgeTokensCss(rel, text) {
  const masked = maskComments(text)
  const out = []
  const re =
    /(--shadow-premium[\w-]*|--global-box-shadow|--shadow-(?:2xs|xs|sm|md|lg|xl|2xl))\s*:/g
  for (const m of masked.matchAll(re)) {
    const line = masked.slice(0, m.index).split('\n').length
    out.push({
      file: rel,
      line,
      kind: 'reverse',
      value: m[1],
      reason: '该阴影族已删除,投影只保留 --shadow-elevation-* 一个命名空间',
      fix: '删掉定义,消费方改用 var(--shadow-elevation-*);改值只能改 packages/design-tokens/src/elevation.ts',
    })
  }
  return out
}

function readFaceTexts(top, face) {
  const candidates = sourceCandidates(top, face, {
    prefilterRe: PREFILTER_RE,
    pathspecs: SCAN_PATHSPECS,
    skipSegmentTest: (seg) => SKIP_DIRS.has(seg) || isExcludedDirName(seg),
  }).filter((rel) => CODE_EXT_RE.test(rel) && !GENERATED_RE.test(rel))

  // tokens.css / 小程序 app.css 的反向断言是确定性的,必须始终在场(即使预筛没命中)。
  let files = candidates
  for (const must of [TOKENS_CSS, MINIAPP_CSS]) {
    if (!files.includes(must)) files = [...files, must]
  }
  const { texts, skippedMissing } = readSources(top, face, files)
  return { texts, skippedMissing, files: files.filter((f) => texts.has(f)) }
}

export async function run({ staged = false, head = false, worktree = false, json = false } = {}) {
  const top = assertRepoRoot(ROOT, '投影唯一源守门')
  const picked = selectFace({ staged, worktree: worktree || (!staged && !head), def: 'worktree' })
  if (picked.error) {
    console.log(`${C.yellow}⚠️  未判定:${picked.error}${C.reset}`)
    return 2
  }
  const face = picked.face
  const faceLabel = face === 'staged' ? '索引面' : face === 'head' ? 'HEAD 面' : '盘上现读(worktree)'

  const { texts, skippedMissing, files } = readFaceTexts(top, face)

  const violations = []
  let hitTotal = 0
  let exemptTotal = 0
  for (const rel of files) {
    const text = texts.get(rel)
    const judged = judgeFile(rel, text)
    hitTotal += judged.hits
    for (const v of judged.violations) violations.push(v)
    if (rel === TOKENS_CSS || rel === MINIAPP_CSS) violations.push(...judgeTokensCss(rel, text))
    violations.push(...findLiftShadowRedefinition(rel, text))
  }

  const allowed = new Set()
  const realViolations = []
  for (const v of violations) {
    const entry = ALLOWLIST.find(
      (a) => a.file === v.file && (a.line === v.line || a.line === 1 || a.line === 0),
    )
    if (entry) {
      allowed.add(entry)
      exemptTotal += 1
      continue
    }
    realViolations.push(v)
  }
  realViolations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

  if (json) {
    console.log(
      JSON.stringify(
        {
          face,
          scannedFiles: files.length,
          hits: hitTotal,
          allowlist: ALLOWLIST.length,
          allowedHits: exemptTotal,
          violations: realViolations,
        },
        null,
        2,
      ),
    )
    return realViolations.length === 0 ? 0 : 1
  }

  for (const v of realViolations) {
    console.log(`${C.red}❌ ${v.file}:${v.line}${C.reset} [${v.kind}] ${v.reason}`)
    console.log(`   值:${v.value}`)
    console.log(`   修复:${v.fix}`)
  }
  if (skippedMissing.length > 0) {
    console.log(
      `${C.yellow}   · 盘上跳过缺失文件 ${skippedMissing.length} 个(机器态,不是业务结论)${C.reset}`,
    )
  }

  console.log(
    `投影唯一源守门:面=${faceLabel} | 扫描 ${files.length} 文件 | 阴影命中 ${hitTotal} 处 | ` +
      `allowlist ${ALLOWLIST.length} 条(本次命中豁免 ${exemptTotal} 处) | 违规 ${realViolations.length} 处` +
      (realViolations.length === 0 ? ' ⇒ 通过' : ' ⇒ 不通过'),
  )
  return realViolations.length === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

/**
 * 自检(2026-11-12 补):本门此前没有自检档 ⇒ guardian `--self-test` 只能标"无自检档",
 * 等于没人证明这把尺子**有牙**。下面每组都是"正例必须绿 / 反例必须红",并对豁免类做
 * **变异验证**(删掉中文豁免注释后必须由绿转红)——只断言"写了注释就绿"而不验"没注释该红",
 * 判据可以被随手加注释满足,尺子就废了(2026-11-12 在号池守门上踩过同型坑)。
 */
export function runSelfTest() {
  const count = (text) => judgeFile('__fixture__.tsx', text).violations.length
  const cases = [
    ['正例:CSS 结构投影消费唯一源', count('.a{box-shadow: var(--shadow-elevation-md);}') === 0],
    ['反例:具体模糊半径 + 字面色值必须判红', count('.a{box-shadow: 0 2px 8px rgba(0,0,0,.08);}') === 1],
    ['正例:类名用 shadow-elevation-lg', count('const a = "rounded-lg shadow-elevation-lg"') === 0],
    ['反例:Tailwind 默认档类名判红', count('const a = "rounded-lg shadow-lg"') === 1],
    ['反例:裸 shadow 走默认档判红', count('const a = className="p-2 shadow"') === 1],
    [
      '正例:取色令牌效果光 + 中文豁免注释 → 绿',
      count('/* 豁免类别:状态点辉光 */\n.a{box-shadow: 0 0 8px color-mix(in srgb, var(--color-info) 80%, transparent);}') === 0,
    ],
    [
      '变异:同一效果光删掉豁免注释必须转红(证明判据不是被注释以外的原因满足)',
      count('.a{box-shadow: 0 0 8px color-mix(in srgb, var(--color-info) 80%, transparent);}') === 1,
    ],
    [
      '正例:inset 内阴影 + 豁免注释 → 绿',
      count('/* 豁免类别:横向溢出提示的 inset 实体边 */\n.a{box-shadow: inset -12px 0 12px -12px rgba(0,0,0,.2);}') === 0,
    ],
    ['反例:inset 无注释判红', count('.a{box-shadow: inset -12px 0 12px -12px rgba(0,0,0,.2);}') === 1],
    ['正例:RN spread 唯一源', count('const s = { ...ELEVATION_STEPS.md }') === 0],
    ['反例:RN 写死 shadowOpacity 判红', count('const s = { shadowOpacity: 0.12, shadowRadius: 8 }') === 1],
    ['正例:安卓高程引用档位', count('const s = { elevation: ELEVATION_STEPS.md.elevation }') === 0],
    ['反例:安卓高程写死数字判红', count('const s = { elevation: 3 }') === 1],
    ['正例:任意值只消费令牌', count('const a = "shadow-[var(--shadow-elevation-lg)]"') === 0],
    ['反例:任意值自造投影判红', count('const a = "shadow-[0_4px_24px_rgba(0,0,0,0.06)]"') === 1],
    ['正例:@keyframes 内发光 + 豁免注释 → 绿', count('/* 豁免类别:呼吸光晕关键帧 */\n@keyframes p{0%{box-shadow:0 0 0 0 rgba(16,185,129,.6);}100%{box-shadow:0 0 0 3px rgba(16,185,129,0);}}') === 0],
    ['变异:@keyframes 内发光删注释必须转红', count('@keyframes p{0%{box-shadow:0 0 0 0 rgba(16,185,129,.6);}100%{box-shadow:0 0 0 3px rgba(16,185,129,0);}}') === 1],
    ['反例:已删阴影族别名重新定义判红', judgeTokensCss('__tokens__.css', ':root{--shadow-premium: 0 2px 8px rgba(0,0,0,.08);}').length === 1],
    ['反例:--lift-shadow 全仓不得重定义', findLiftShadowRedefinition('__x__.css', ':root{--lift-shadow: 0 4px 12px rgba(0,0,0,.1);}').length === 1],
  ]
  let bad = 0
  for (const [name, ok] of cases) {
    if (typeof ok !== 'boolean') {
      console.log(`❌ ${name} —— 条件不是布尔,断言从未求值`)
      bad += 1
      continue
    }
    if (!ok) bad += 1
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n投影唯一源守门 self-test:${cases.length - bad}/${cases.length} 通过`)
  return bad === 0 ? 0 : 1
}

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exit(runSelfTest())
  }
  run({
    staged: argv.includes('--staged'),
    head: argv.includes('--head'),
    worktree: argv.includes('--worktree'),
    json: argv.includes('--json'),
  })
    .then((code) => process.exit(code))
    .catch((e) => {
      const undetermined = e instanceof Undetermined
      console.log(
        `${undetermined ? C.yellow : C.red}${undetermined ? '⚠️  未判定(取材失败)' : '❌ 守门异常'}: ${e?.message ?? e}${C.reset}`,
      )
      process.exit(2)
    })
}

export const __test__ = {
  ALLOWLIST,
  EXEMPT_COMMENT_RE,
  judgeFile,
  judgeTokensCss,
  findLiftShadowRedefinition,
  geometryOf,
  isTokenOnly,
  keyframesRanges,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
