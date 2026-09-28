#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 容器圆角守门 — 防止新增 rounded-full / rounded-pill / 9999px / 50% 用于容器。
 *
 * 依据 AGENTS.md 第 4 节"前端 UI 约束"(强制):任何承载内容或交互的容器
 * (卡片 / 面板 / 按钮 / 输入框 / 弹窗 / 标签条 / 侧栏项 / 操作行 / 列表项 /
 *  气泡 / 工具栏 / 浮层 / 徽章容器 等)一律不得使用纯圆 / 胶囊圆角。
 *  只允许规范圆角档位(唯一真相源 packages/design-tokens/src/radius.js,2026-09-23 起按 web
 *  Tailwind v4 语义统一):rounded-xs(2px)/ rounded-sm(4px)/ rounded-md(6px)/
 *  rounded-lg(8px)/ rounded-xl(12px)/ rounded-2xl(16px)。裸 rounded 与 lg 同值(8px)。
 *  档位引用面由守门 77 scripts/check-radius-single-source.mjs 管,本脚本只管容器纯圆/胶囊。
 *
 * 唯一豁免(仅限非容器装饰元素,不承载主要内容/交互):
 *   1. <img> 标签上的 rounded-full(头像图片本身)
 *   2. SwitchPrimitives.Thumb 或 data-[state=checked]:translate-x 上下文(Switch 拇指)
 *   3. 极小尺寸纯装饰状态点(w-2 h-2 / h-1.5 w-1.5 等,<= 8px 装饰)
 *   4. 未读红点底(bg-red-500 + min-w-[16px] h-4 上下文)
 *   5. 进度环 / LoadingSpinner 的 border + animate-spin(纯装饰动画)
 *
 * 用法:
 *   node scripts/check-rounded-full.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-rounded-full.mjs             (全量扫描报告, exit 0)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { boxShape, boxDims, constsForLines } from './lib/box-geometry.mjs'
import { radiusLookup, radiusPxInLine } from './lib/radius-tokens.mjs'
import { catBatch } from './lib/face-reader.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')

const SCAN_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss']

/** 违规模式 */
const VIOLATION_PATTERNS = [
  { re: /rounded-full\b/, label: 'rounded-full' },
  { re: /rounded-pill\b/, label: 'rounded-pill' },
  { re: /border-radius\s*:\s*9999px/i, label: 'border-radius:9999px' },
  { re: /border-radius\s*:\s*50%/i, label: 'border-radius:50%' },
]

/**
 * 豁免判定 — 返回 true 表示该行可豁免(不算违规)。
 * 严格按 AGENTS.md 第 4 节"唯一豁免"清单 + Radix UI primitives 通用圆形控件特征。
 *
 * @param {string} line - 当前行内容
 * @param {string} [file] - 当前文件路径(用于上下文豁免)
 * @param {string[]} [allLines] - 文件全部行(用于前向注释豁免)
 * @param {number} [idx] - 当前行在 allLines 中的索引
 */
function isExempt(line, file, allLines, idx) {
  const trimmed = line.trim()

  // 豁免 0: 纯注释行(// 或 /* 或 * 开头,提到 rounded-full 只是在说明规则)
  // 同步支持 JSX 块注释 {/* ... */}
  if (/^\s*(\/\/|\/\*|\*|\{)/.test(trimmed)) return true

  /**
   * **几何硬规则优先于任何豁免通道**(用户 2026-09-27 定档:本项目不允许出现胶囊型,
   * 且不允许有任何豁免)。元素的宽高都能从自身或紧邻上下文量出来、而两者不近似等值 ⇒
   * 这就是胶囊/横幅,任何标记、任何族豁免都不放行 —— 旧秩序里"写了带原因的标记就能免检"
   * 意味着一条胶囊可以永久留在码上,而那正是本门要根除的东西。
   * 量不到宽高时不猜(交给下面各条几何/语义判据),判据失效的方向是"少放一条豁免",
   * 不是"多放一条形状"。
   */
  if (file && allLines) {
    const hard = boxShape(allLines, idx)
    /**
     * 几何是**规则**,不是豁免:`rounded-full` 落在量得出"宽高近似等值"的盒子上,得到的就是正圆
     * (头像 / 装饰点 / 加载环 / 骨架圆),这属项目允许的形态;落在宽扁盒上就是胶囊,任何标记救不了;
     * 量不到形状时不猜,继续往下走语义判据(缩略图蒙版、Switch 拇指、Radio、animate-spin 环、
     * 显式 <=14px 装饰点),都对不上就是违规。
     */
    if (hard === 'square') return true
    if (hard === 'wide') return false
  }

  // 豁免 0b: 从被点行往上、到**该元素自身的起始行为止**,找带原因的豁免标记。
  //
  // 为什么固定 5 行不够(2026-09-27 实测):JSX 的属性区**不能放注释**,所以人唯一能写标记的位置
  // 是元素起始行之外的那一行 —— 而元素的属性块常常拉得很长。实测 `LoginPopUp.tsx`:`<Button`
  // 开在 141 行,被点的 `className="… rounded-full …"` 在 165 行(中间是一整段多行
  // onChooseAvatar 回调),差 24 行。于是"请你补豁免理由"这条出路**在语法上不存在**,
  // 而报告把这一族算成未清存量 —— 门给出的出路跑不通,是本仓记过多次的那一类(参照
  // 守门 102 的 `nav-chrome-exempt` 因"错误是页面配置 × 页面渲染的组合、不落在某一行上"
  // 而开文件级通道,同一族理由)。
  //
  // 窗口边界取自**元素起始行**而不是任意常数:再往上的注释与当前元素无关,放了也算豁免就成了
  // 一个标记救整棵子树。起始行的认法 = 往上第一行缩进严格小于被点行、且开着 JSX 标签;
  // 找不到就退回 5 行的旧窗口(不放大成无限回溯)。
  if (file && allLines) {
    const indentOf = (s) => (s || '').match(/^\s*/)[0].length
    const myIndent = indentOf(allLines[idx])
    let bound = 5
    for (let back = 1; idx - back >= 0 && back <= 30; back++) {
      const l = allLines[idx - back] || ''
      if (!l.trim()) continue
      if (indentOf(l) < myIndent && /<[A-Za-z][\w.]*/.test(l)) {
        bound = back + 1
        /**
         * 起始行**之上**连着写的注释行一并算进窗口:JSX 属性区不能放注释,人唯一能写标记的
         * 位置就是元素上面那一行(children 位的花括号注释同理)。只认起始行以内的话,这条出路
         * 在语法上仍然不存在 —— 那等于没有这条豁免。
         */
        for (let up = bound; idx - up >= 0 && up <= 30; up++) {
          const p = (allLines[idx - up] || '').trim()
          if (!p) continue
          if (!/^(\/\/|\/\*|\*|\{\/\*)/.test(p)) break
          bound = up + 1
        }
        break
      }
    }
    for (let back = 1; back <= bound && idx - back >= 0; back++) {
      const prev = (allLines[idx - back] || '').trim()
      // 仅看单行注释(//, /*, *, 或 JSX 块注释开头 {)
      if (!/^\s*(\/\/|\/\*|\*|\{)/.test(prev)) continue
      // 必须同时有"豁免说明标记" + "理由关键词"。`radius-exempt` 是守门 77 的真圆标记,
      // 一并认 —— 同一处几何豁免有两套词汇,就会一边认一边判红(两处算同一件事必漂移)。
      const hasExemptMarker =
        /豁免\s*\d+[a-z]?\s*[:：]/.test(prev) ||
        /\bexempt\b/i.test(prev) ||
        /@allow-rounded-full/.test(prev)
      // 理由判据 = **冒号后有实际内容**,不是命中一张关键词表:白名单必然腐烂 ——
      // 写了合规理由而词不在表里,标记就不生效(本次实测就栽在"拇指"没进表),而人会以为是自己的
      // 写法错了。守门 108 对豁免族的要求同样是"必须带原因",不是"必须用某个词"。
      const hasReason = /[:：]\s*\S{2,}/.test(prev)
      /**
       * **标记不再是出路(用户 2026-09-27 定档:本项目不允许出现胶囊型,也不允许有任何豁免)**。
       * 旧行为是"找到带原因的豁免标记 ⇒ 本行免检",那等于一条胶囊可以靠一行注释永久留在码上,
       * 而且写标记的人与读代码的人都以为"这里被审过了"。现在标记一律被忽略,继续往下按
       * **几何与语义**判(方形装饰件/加载环/缩略图蒙版等是真圆,不是豁免;宽高可量而不等值的
       * 一律是胶囊,上面已直接判死)。
       */
      void hasReason
      void hasExemptMarker
    }
  }


  // 豁免 1: <img> / AvatarImage / next/image 上的 rounded-full(头像图片本身)
  if (/<img\b[^>]*\brounded-full\b/.test(trimmed)) return true
  if (/<Image\b[^>]*\brounded-full\b/.test(trimmed)) return true
  if (/AvatarImage\b[^>]*\brounded-full\b/.test(trimmed)) return true

  // 豁免 1b: mobile-rn / Taro <Image>/<View> 头像容器(width/height 设定的容器型头像)
// 例: <Image source={...} className="rounded-full" style={{ width: 60, height: 60 }} />
// 关键: 标签可能跨多行(Image 在 line N, className 在 line N+1, style 在 line N+2)
// 检测窗口: 当前行 + 上下 5 行
if (allLines) {
  const window = allLines.slice(Math.max(0, idx - 5), Math.min(allLines.length, idx + 5)).join('\n')
  // 头像族三条**共用同一把方形尺**(= boxShape,几何硬规则也用它,判据只有一份):
  // 旧写法只看"出现 w-[NNrpx] 与 h-[NNrpx]"就放过,于是 690×220 的宽扁容器被当成头像免检。
  if (boxShape(allLines, idx) === 'square') {
    // 检测 <Image> 或 <View> 标签 + rounded-full + 后续 width/height
    if (/<(?:Image|View)\b[^>]*\brounded-full\b/.test(window) && /\b(?:width|height)\s*:\s*\d{2,3}/.test(window)) return true
    // Taro rpx: w-[140rpx] h-[140rpx]
    if (/<(?:Image|View)\b[^>]*\brounded-full\b/.test(window) && /\b(?:w|h)-\[(\d{2,3})rpx\]/.test(window)) return true
    // Taro className 含 w-[140rpx] h-[140rpx]
    if (/\b(?:w|h)-\[\d{2,3}rpx\]/.test(window) && /\bh-\[\d{2,3}rpx\]/.test(window)) return true
  }
}

  // 豁免 2: Switch(Radix Switch Root/Thumb 特征)
  // Thumb 特征: block rounded-full bg-background shadow-lg ring-0 transition-transform
  if (/block\s+rounded-full\s+bg-background\s+shadow-lg/.test(trimmed)) return true
  if (/data-\[state=checked\]:translate-x/.test(trimmed)) return true
  if (/data-\[state=unchecked\]:translate-x/.test(trimmed)) return true
  if (/SwitchPrimitives\.Thumb/.test(trimmed)) return true
  if (/SwitchThumb\b/.test(trimmed)) return true
  // Root track 特征: inline-flex shrink-0 items-center rounded-full border-2 border-transparent
  if (/inline-flex\s+shrink-0\s+items-center\s+rounded-full\s+border-2\s+border-transparent/.test(trimmed)) return true

  // 豁免 3: Radio 圆形单选按钮(Radix RadioGroup Indicator 特征)
  // 模式: flex h-4 w-4 items-center justify-center rounded-full border border-input
  if (/flex\s+h-4\s+w-4\s+items-center\s+justify-center\s+rounded-full\s+border\s+border-input/.test(trimmed)) return true
  if (/RadioPrimitive/.test(trimmed)) return true
  if (/RadioGroupPrimitive/.test(trimmed)) return true
  if (/<input[^>]*type="radio"[^>]*\brounded-full\b/.test(trimmed)) return true

  // 豁免 4: Avatar 组件内部 shape=circle 的 conditional
  if (/===\s*['"]circle['"]\s*\?[^)]*rounded-full/.test(trimmed)) return true
  if (/shape\s*===\s*['"]circle['"]/.test(trimmed) && /rounded-full/.test(trimmed)) return true

  // 豁免 5: 极小尺寸纯装饰状态点(<= 14px,w-1/h-1/w-1.5/h-1.5/w-2/h-2/w-2.5/h-2.5/w-3/h-3/w-3.5/h-3.5)
  // 仅当:rounded-full + 小尺寸 + 不含大容器特征(flex-1, px-3+, py-3+, p-[3-9], p-\d{2}, text-base+)
  if (/\brounded-full\b/.test(trimmed)) {
    const smallSize = /\b(?:w|h)-(?:1(?:\.5)?|2(?:\.5)?|3(?:\.5)?)\b/.test(trimmed)
    const bothDims =
      /\bw-(?:1(?:\.5)?|2(?:\.5)?|3(?:\.5)?)\b/.test(trimmed) &&
      /\bh-(?:1(?:\.5)?|2(?:\.5)?|3(?:\.5)?)\b/.test(trimmed)
    const noLargeContainer = !/\b(?:flex-1|px-[3-9]|px-\d{2}|py-[3-9]|py-\d{2}|p-[3-9]|p-\d{2}|text-base|text-lg|text-xl)\b/.test(trimmed)
    if (smallSize && bothDims && noLargeContainer) return true
    // w-0.5 / h-0.5 极窄装饰条(2px,语音波形等)
    if (/\b(?:w|h)-0\.5\b/.test(trimmed)) return true
    // 竖向装饰指示器(分页指示器 active 胶囊):width <= 8px 且 height >= 12px
    // 例: PageIndicator active 态 h-4 w-1.5 (16x6)、h-5 w-2 (20x8)、h-6 w-2 (24x8,2026-08-13 v10)
    // 规则来源:用户 2026-07-20 v5 明确要求"竖向胶囊",不视作违规
    if (
      /\bw-(?:0\.5|1|1\.5|2)\b/.test(trimmed) &&
      /\bh-(?:3|3\.5|4|4\.5|5|6|7|8)\b/.test(trimmed) &&
      noLargeContainer
    ) {
      return true
    }
  }

  // 豁免 6: 未读红点底(bg-red-500/bg-destructive + 小尺寸 + px-1 或绝对定位 -top/-right)
  // 同步支持 Taro rpx 单位(w-[28rpx], w-[32rpx] 等 <= 64 rpx 装饰点)
  if (/\bbg-(?:red-500|destructive)\b/.test(trimmed) && /\brounded-full\b/.test(trimmed)) {
    if (/\b(?:min-w-\[?\d+r?px?\]?|h-\[?\d+r?px?\]?|w-\[?\d+r?px?\]?|h-4|w-4|h-5|min-w-5|min-h-5)\b/.test(trimmed)) return true
    if (/\bpx-1\b/.test(trimmed) && /\b(?:absolute|top|right|left|bottom)/.test(trimmed)) return true
    // Taro: -top-1 / -top-[8rpx] + w-[28rpx] 装饰红点
    if (/(?:min-w-\[\d+rpx\]|w-\[\d+rpx\]|h-\[\d+rpx\])/.test(trimmed) && /absolute/.test(trimmed)) return true
  }

  // 豁免 6b: 通用小尺寸绝对定位装饰点(<= 64px 或 <= 64rpx,任意背景色)
  // 装饰点典型: 绝对定位 top-right + 圆形背景 + 尺寸小(通知红点/状态徽章)
  if (
    /\brounded-full\b/.test(trimmed) &&
    /\babsolute\b/.test(trimmed) &&
    (/\b(?:min-w-\[?\d+r?px?\]?|w-\[?\d+r?px?\]?|h-\[?\d+r?px?\]?|h-4|w-4|h-5|min-w-5|min-h-5)\b/.test(trimmed))
  ) {
    // 尺寸 <= 64 rpx 或 <= 64 px
    const sizeMatch = trimmed.match(/(?:min-w-|w-|h-|min-h-)(\[\d+rpx\]|\[?\d+px?\]?|4|5|6|7|8|9|10|12|14|16|20|24|28|32|40|48|56|64)/)
    if (sizeMatch) {
      const raw = sizeMatch[1]
      const numMatch = raw.match(/\d+/)
      if (numMatch && parseInt(numMatch[0]) <= 64) return true
    }
  }

  // 豁免 7: 纯装饰动画(border + animate-spin / animate-bounce / animate-ping / animate-pulse + rounded-full)
  if (/\banimate-(?:spin|bounce|ping|pulse)\b/.test(trimmed) && /\brounded-full\b/.test(trimmed)) return true

  // 豁免 8: 进度环 / LoadingSpinner 的 border + animate-spin(纯装饰动画)
  if (/\banimate-spin\b/.test(trimmed) && /\bborder\b/.test(trimmed)) return true

  return false
}

/**
 * CSS/SCSS 上下文感知豁免 — 返回 true 表示该 50% 行可豁免。
 * 仅对 .css/.scss 文件生效,基于选择器名 + 块内属性判断。
 * 覆盖:小装饰点(≤14px/rpx)、装饰动画(pulse/spin/ping/bounce)、
 *       ::before/::after 伪元素(≤20 或有动画)、头像图片选择器。
 */
function isCssExempt(lines, idx, file) {
  if (!file.endsWith('.css') && !file.endsWith('.scss')) return false
  const cur = lines[idx].trim()
  if (!/border-radius\s*:\s*50%/i.test(cur)) return false

  // 定位当前块边界:向上找最近的 {,向下找匹配的 }
  let blockStart = -1
  let depth = 0
  for (let i = idx; i >= 0; i--) {
    const t = lines[i]
    if (t.includes('}')) depth++
    if (t.includes('{')) {
      depth--
      if (depth <= 0) { blockStart = i; break }
    }
  }
  if (blockStart === -1) return false
  let blockEnd = lines.length - 1
  depth = 1
  for (let i = blockStart + 1; i < lines.length; i++) {
    if (lines[i].includes('{')) depth++
    if (lines[i].includes('}')) {
      depth--
      if (depth === 0) { blockEnd = i; break }
    }
  }
  const selectorLine = (lines[blockStart] || '').trim()
  const blockText = lines.slice(blockStart, blockEnd + 1).join('\n')

  const wMatch = blockText.match(/width\s*:\s*(\d+(?:\.\d+)?)\s*(px|rpx)?/i)
  const hMatch = blockText.match(/height\s*:\s*(\d+(?:\.\d+)?)\s*(px|rpx)?/i)
  const w = wMatch ? parseFloat(wMatch[1]) : Infinity
  const h = hMatch ? parseFloat(hMatch[1]) : Infinity

  // 规则 1: 纯装饰小点(width AND height <= 14 px/rpx)
  if (w <= 14 && h <= 14) return true

  // 规则 2: 装饰动画(animate pulse/spin/ping/bounce)
  if (/animation\s*:[^;]*(?:pulse|spin|ping|bounce)/i.test(blockText)) return true

  // 规则 3: ::before / ::after 伪元素(小尺寸 <=20 或有装饰动画)
  if (/::(?:before|after)/.test(selectorLine)) {
    if (w <= 20 && h <= 20) return true
    if (/animation\s*:[^;]*(?:pulse|spin|ping|bounce)/i.test(blockText)) return true
  }

  // 规则 4: 头像图片选择器(.avatar / .card-avatar / .agent-avatar / .user-avatar / .profile-img / .photo)
  // 同步支持 Taro/小程序的 .cp-member-avatar, .member-avatar, .user-avatar 等驼峰类名
  if (/(?:\.avatar|language-\.avatar|[\w-]*avatar|profile-img|profile-photo|profile-image)\b/i.test(selectorLine)) return true

  // 规则 5: 装饰点/红点底选择器(.dot / .badge / .unread / .notice / .indicator / .marker)
  // 红点底典型: 8-32 px/rpx,绝对定位,圆形
  if (/(?:\.dot|\.badge|\.unread|\.notice|\.indicator|\.marker|\.bubble)\b/.test(selectorLine)) {
    if (/\bposition\s*:\s*absolute\b/i.test(blockText)) return true
  }

  // 规则 6: rpx 物理小尺寸(<= 64 rpx 装饰点,约 21 物理像素,iPhone 1.5px 比例适配)
  // 排除容器型选择器(无具体尺寸 = 容器/卡片,不豁免)
  if (w <= 64 && h <= 64 && w !== Infinity && h !== Infinity) return true

  return false
}

// collectFiles 已随全量档枚举迁到 git ls-tree HEAD 后失去调用方,故删除(不留 _ 前缀糊 lint)。
function getStagedAddedLines() {
  const result = new Map()
  let output
  try {
    output = execSync('git diff --cached -U0 --diff-filter=ACM --no-color', {
      encoding: 'utf8',
      cwd: ROOT,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
  } catch {
    return result
  }
  if (!output) return result

  let curFile = null
  let curLine = 0
  for (const raw of output.split('\n')) {
    // 修复:`+++ b/path` 是 diff 输出中的独立行(紧跟 `diff --git` 后),
    // 必须单独判断;原来错误地放在 `diff --git` 块内匹配导致 curFile 始终为 null。
    if (raw.startsWith('+++ b/')) {
      const m = raw.match(/^\+\+\+\s+b\/(.+)$/)
      curFile = m ? join(ROOT, m[1]) : null
      curLine = 0
      continue
    }
    if (raw.startsWith('diff --git')) {
      // `diff --git a/x b/x` 行仅作分隔符,文件路径在下一行 `+++ b/` 上
      curFile = null
      curLine = 0
      continue
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(/@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/)
      curLine = m ? parseInt(m[1], 10) : 0
      continue
    }
    if (curFile && curLine > 0) {
      if (raw.startsWith('+') && !raw.startsWith('+++')) {
        if (!result.has(curFile)) result.set(curFile, new Set())
        result.get(curFile).add(curLine)
        curLine++
      } else if (raw.startsWith('-') && !raw.startsWith('---')) {
        // 删除行,不推进 curLine
      } else {
        curLine++
      }
    }
  }
  return result
}

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    return output
      .split('\n')
      .filter(Boolean)
      .filter((f) => SCAN_EXTS.some((e) => f.endsWith(e)))
      .filter((f) => !isExcludedDirName(f.split('/')[0]))
      .map((f) => join(ROOT, f))
      .filter((f) => existsSync(f))
  } catch {
    return []
  }
}

console.log(
  `${C.cyan}${C.bold}[容器圆角守门] 扫描 rounded-full / rounded-pill / 9999px / 50% 违规...${C.reset}`,
)
console.log(
  `${C.dim}规则: AGENTS.md 第 4 节 — 容器禁用纯圆/胶囊, 豁免 img/Switch/Radio/Avatar shape/<=14px 装饰点/红点底/animate-spin${C.reset}`,
)
console.log(
  `${C.dim}模式: ${isStaged ? 'staged (新增违规阻塞 commit)' : '全量 (warn-only, exit 0)'}${C.reset}`,
)
console.log('')

let files = []
let addedLinesMap = new Map()

if (isStaged) {
  addedLinesMap = getStagedAddedLines()
  files = getStagedFiles().filter((f) => addedLinesMap.has(f))
  if (files.length === 0) {
    console.log(`${C.green}✅ 暂存区无 .ts/.tsx/.js/.jsx/.css/.scss 变更,跳过${C.reset}`)
    process.exit(0)
  }
} else {
  /**
   * 全量:清单也从**被审面**枚举(`git ls-tree HEAD`),不再 `readdirSync` 磁盘。
   * 实测按磁盘枚举 + 按 HEAD 取内容会撞上 153 个"盘上有、面里没有"的 gitignore 产物
   * (`apps/web/public/vs/*.js`、`tw-check.config.js` 等)⇒ 整门 exit 2 无法判定。
   * 清单与内容必须同面同轮 —— 否则产出的不是"少扫几个文件",而是"这一轮什么都没判"。
   */
  let listing
  try {
    listing = execSync('git ls-tree -r --name-only HEAD', {
    encoding: 'utf8',
    cwd: ROOT,
    maxBuffer: 1 << 27,
    windowsHide: true,
    timeout: 120000,
  })
  } catch (e) {
    /**
     * git 问不到 ⇒ **"无法判定"**,不是"通过"。旧写法让未捕获异常直接 crash 并把整段
     * 调用栈喷到 stderr(隔离检出/无 .git 的目录实测如此),而崩溃在账面与"扫过且干净"
     * 长得很像 —— 调用方只看退出码就会把一次没判当成一次通过。口径同守门 77/94/99/101。
     */
    console.error(`⚠️ 无法判定:全量档枚举取不到(本目录不在可判定的 git 提交面内)`)
    console.error(`   原因:${String(e?.stderr || e?.message || e).split('\n')[0]}`)
    console.error(`   这不是"通过",也不是"没有胶囊" —— 请在被审面(有 HEAD 的检出)里重跑。`)
    process.exit(2)
  }
  files = listing
    .split('\n')
    .filter(Boolean)
    .filter((p) => /^(apps|packages)\//.test(p))
    .filter((p) => SCAN_EXTS.some((e) => p.endsWith(e)))
    .filter((p) => !p.split('/').some((seg) => isExcludedDirName(seg)))
    .map((p) => join(ROOT, p))
}

/**
 * 内容一律从**被审面**取(全量 = HEAD blob,`--staged` = 索引 blob),不再 `readFileSync` 磁盘:
 * 共享工作树常年滞后 HEAD,按磁盘判会在"恒红"与"假绿"之间来回跳(守门 77/83/118 同一条口径);
 * 更要紧的是 `--staged` 判的是**将要提交的那份内容**,磁盘上别人未提交的半编辑态不该替它背锅。
 * 清单与内容同面同轮:一次 catBatch 读满,不得"清单来自盘、内容来自 git"。
 */
const facePrefix = isStaged ? ':' : 'HEAD:'
const isWorktree = process.argv.includes('--worktree')
const safeRead = (p) => {
  try {
    return readFileSync(join(ROOT, p), 'utf8')
  } catch {
    return null
  }
}
/**
 * `--worktree` 只是**人工逃生舱**(与守门 77 / 83 / 118 同一约定):要证明"刚写下去的标记真被
 * 读到"而没有别的通道 —— 全量档判 HEAD、暂存档只看新增行,两者都看不见"未提交但对已有行的
 * 上方新增注释"这一格。它绝不进提交链。
 */
const relPaths = files
  .map((f) => relative(ROOT, f).replace(/\\/g, '/'))
  .filter((p) => (isStaged || isWorktree ? true : !p.startsWith('apps/web/public/vs/')))
/**
 * 测试/规范面排除:`expect(cls).not.toContain('rounded-full')` 是**门在执行自己那条规矩**,
 * 不是界面有胶囊。实测 33 处"违规"里 11 处(33%)是这一类 —— 一座会把自己立规矩的动作判成
 * 违规的门,读数没人敢信,也就没人去修真的那批。口径同守门 70 / 102。
 * 排除必须**如实报数**,静默排除与看不见在账面上同形。
 */
const isTestPath = (p) =>
  /(^|\/)(tests?|__tests__|e2e)(\/|$)/.test(p) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p)
const keptRel = []
let skippedTestFiles = 0
for (const p of relPaths) {
  if (isTestPath(p)) {
    skippedTestFiles++
    continue
  }
  keptRel.push(p)
}
const got = isWorktree
  ? new Map(keptRel.map((p) => [facePrefix + p, safeRead(p)]))
  : catBatch(
      ROOT,
      keptRel.map((p) => facePrefix + p),
      { maxBuffer: 1 << 28 },
    )
const undetermined = []
const contents = []
for (const p of keptRel) {
  const t = got.get(facePrefix + p)
  if (t === null || t === undefined) {
    undetermined.push(p)
    contents.push(null)
  } else contents.push(t)
}
if (isWorktree)
  console.log(`${C.yellow}⚠ 人工档 --worktree:判的是磁盘副本,不是 HEAD/索引 —— 只用于自验标记是否被读到,不得进提交链${C.reset}`)
if (undetermined.length) {
  console.log(
    `${C.red}❌ ${facePrefix === 'HEAD:' ? 'HEAD' : '索引'}面取不到 ${undetermined.length} 个文件 ⇒ 无法判定(不记绿也不记红):${undetermined.slice(0, 5).join(', ')}${undetermined.length > 5 ? ' …' : ''}${C.reset}`,
  )
  process.exit(2)
}

let totalViolations = 0
/**
 * C2 需要的档位表 —— 与守门 77 / 128 / 150 同一份 `radius.js`(经 `radiusLookup` 展开成
 * 档名与 `role:<角色>` 两类键)。取不到 ⇒ **整门无法判定**:少了表就是"这一维没判",
 * 而门继续对其它四种写法报绿,账面与"扫过且干净"同形。
 */
const TABLE_REL = 'packages/design-tokens/src/radius.js'
const tableSrc = isWorktree
  ? safeRead(TABLE_REL)
  : catBatch(ROOT, [facePrefix + TABLE_REL], { maxBuffer: 1 << 26 }).get(facePrefix + TABLE_REL)
const RADIUS_TABLE = tableSrc ? radiusLookup(tableSrc) : null
if (!RADIUS_TABLE) {
  /**
   * 表取不到 ⇒ **C2 那一维未判定**,但本门主判据(`rounded-full` / `pill` / `9999px` / `50%`)
   * 与它无关,照旧判 —— 因为 C2 现在只报名不判红,为一维报数而让整门 exit 2 会把"其实判过了"
   * 也一起抹掉(镜像夹具就是被这一条打成 17 例红的:夹具里没有档位表)。
   * 若哪天 C2 升级成判据,这里必须同时升成 exit 2 —— 判红用的输入取不到,不配出任何结论。
   */
  console.log(`${C.yellow}⚠ C2 未判定:${facePrefix === 'HEAD:' ? 'HEAD' : '索引'}面取不到档位表 ${TABLE_REL}(其余四判据照判)${C.reset}`)
}
const fileReports = []
/**
 * C2 的三个计数(**只报名,不判红** —— 判红在守门 150,那里才量得出"这是哪一类元素"):
 * 正方真圆(允许的形态)/ 半径取到短边一半的宽扁盒 / 量不到。
 */
const c2 = { circle: 0, capsule: 0, undetermined: 0, tierChecked: 0 }

for (let fi = 0; fi < keptRel.length; fi++) {
  const rel = keptRel[fi]
  const file = files[relPaths.indexOf(rel)]
  const src = contents[fi]
  const lines = src.split('\n')
  const findings = []

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    // staged 模式只检查新增行
    if (isStaged) {
      const allowed = addedLinesMap.get(file)
      if (!allowed || !allowed.has(lineNumber)) return
    }
    if (isExempt(line, file, lines, idx)) return
    if (isCssExempt(lines, idx, file)) return
    /**
     * **不再查标记**(用户 2026-09-27:「不允许有任何豁免 本项目就是不允许有胶囊型」)。
     * 这里曾经是第二条免检通道(与 isExempt 里那条同族),专门放行"radius-exempt: 原因"
     * 写在同行或上一行的站点 —— 排障实测:同一枚宽扁胶囊,不带注释判红、带注释判绿。
     * 判据现在只认形状量算:方形盒 = 正圆(允许的形态),宽扁盒 = 胶囊(无出路)。
     */
    for (const { re, label } of VIOLATION_PATTERNS) {
      const m = re.exec(line)
      if (m) {
        findings.push({
          line: lineNumber,
          col: m.index + 1,
          label,
          snippet: line.trim().slice(0, 140),
        })
      }
    }
    /**
     * C2 · 档位半径取到短边一半 = 与胶囊同形(票⑲ 登记的那格"没有判据",本条补上)。
     * 上面那四条只认 `rounded-full` / `9999px` / `50%` 这类**显式全圆**写法,而真实站点是把
     * 档位表里的最大档取到一个矮盒上:`height: 32` + `rnRadius['2xl']`(=16) 在屏幕上就是一枚
     * 药丸,账面却一条"全圆"字样都没有。三处已入库站点就是这么活着并挂着豁免标记的。
     * 判据只认几何量算(与旧那条 `radius-exempt` 免检通道同一条理由:**标记不是出路**),
     * 量不到宽高 ⇒ 计入"未判定"并如实报数,绝不静默算通过。
     */
    if (VIOLATION_PATTERNS.some(({ re }) => re.test(line))) return
    if (!RADIUS_TABLE) return
    const radii = radiusPxInLine(line, RADIUS_TABLE, constsForLines(lines))
    if (!radii.length) return
    c2.tierChecked++
    const dims = boxDims(lines, idx)
    const short = Math.min(dims.w || Infinity, dims.h || Infinity)
    const r = Math.max(...radii)
    if (!Number.isFinite(short) || short === Infinity) {
      c2.undetermined++
      return
    }
    if (r < short / 2) return
    if (dims.shape === 'square') c2.circle++
    else if (dims.shape === 'wide') c2.capsule++
    else c2.undetermined++
  })

  if (findings.length > 0) {
    totalViolations += findings.length
    fileReports.push({ file: relative(ROOT, file), findings })
  }
}

console.log(
  `${C.dim}  C2 档位半径 vs 盒形(只报名,问责在守门 150):量得出的取用 ${c2.tierChecked} 处 ⇒ 正方真圆(允许形态)${c2.circle} / ` +
    `半径≥短边一半的宽扁盒 ${c2.capsule} / 量不到 ${c2.undetermined}${C.reset}`,
)
console.log(
  `${C.dim}  本门不据此判红的理由:"胶囊"是**角色件**的错档(输入框/按钮/徽章取了半高半径),而按几何量还会` +
    `把 4px 骨架条、进度条这类无角色证据的装饰线段一起卷进来,并对 StyleSheet 对象 blead 邻行尺寸` +
    `(实测把 8×8 圆点量成 40×8)。类别由守门 150 五级证据判,形状由本门判 — 两台尺子各量一段。${C.reset}`,
)
console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  扫描文件: ${files.length} 个`)
console.log(`  违规数:   ${totalViolations} 处`)
console.log(
  `${C.dim}  已排除:   测试/规范面 ${skippedTestFiles} 个文件(门在测试里的反向断言不是界面有胶囊)、` +
    `构建/取证副本目录见 lib/exclude-dirs${C.reset}`,
)
console.log('')

if (totalViolations === 0) {
  console.log(
    `${C.green}${C.bold}✅ 容器圆角守门通过${C.reset}`,
  )
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处违规:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.red}${file}${C.reset}`)
  for (const f of findings) {
    console.log(
      `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${C.red}[${f.label}]${C.reset} ${f.snippet}`,
    )
  }
  console.log('')
}
console.log(`${C.dim}修复方法:${C.reset}`)
/**
 * 档位数字**从 radius.js 现读**,不得写死在这里:本行曾长期写着 `rounded-sm(2px) / rounded(4px)`,
 * 而 2026-09-23 档位表收口把 sm 改成 4px、裸 rounded 改成 8px —— 门自己的修复提示在教一套已作废的
 * 数字,照它改就偏一档。头注写对了、提示没跟着改,正是 AGENTS §4 记过的"散文与判据两边一起漏"那一型。
 */
let tierHint = 'rounded-xs / sm / md / lg / xl / 2xl(取值见 packages/design-tokens/src/radius.js)'
try {
  const { radiusLookup } = await import('./lib/radius-tokens.mjs')
  const t = radiusLookup(readFileSync(join(ROOT, 'packages/design-tokens/src/radius.js'), 'utf8'))
  if (t)
    tierHint = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']
      .map((s) => `rounded-${s}(${t[s]}px)`)
      .join(' / ')
} catch {
  /* 取不到表就用档名列(不改判据,只改提示;静默降级不得影响退出码) */
}
console.log(`  1. 容器改用规范圆角: ${tierHint}`)
console.log(
  `     哪类元素取哪档见 radius.js 的 RADIUS_ROLES(卡片 = lg);胶囊/正圆容器一律不得用 rounded-full 表达`,
)
console.log(
  `  2. 确认是否属于豁免(img/Switch Thumb/<=8px 装饰点/红点底/animate-spin),若是请保留 rounded-full`,
)
console.log(
  `  3. 详细规则见 AGENTS.md 第 4 节"前端 UI 约束"`,
)
console.log('')

if (isStaged) {
  console.log(`${C.red}${C.bold}❌ 容器圆角守门失败 — 提交已阻止${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 0)${C.reset}`)
  process.exit(0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠