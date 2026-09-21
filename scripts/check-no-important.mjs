#!/usr/bin/env node
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 样式规范守门 —— 禁止 !important(CSS 感知版)。
 *
 * 背景(2026-09-10 根因修复):
 *   原 CI 步骤用 `grep -rnE '!important'` 直接扫文本,有两个缺陷:
 *     1) 无法区分「声明」与「注释」——注释里提到 !important 也被判违规(纯误报);
 *     2) 无法表达合法例外,只能一刀切。
 *   本脚本改为解析式检查:先剥离注释,再判断是否落在豁免区间内。
 *
 * 豁免(仅此两类,均需在代码中写明理由):
 *   - @media (prefers-reduced-motion: reduce) 块:W3C / MDN / Tailwind 一致推荐的
 *     无障碍写法。该块选择器是 `*`(特异度 0),必须用 !important 才能压过
 *     未被 @layer 包裹的动画类(如 .animate-* 的 animation-duration),否则
 *     「减少动画」偏好失效,属真实无障碍回归。
 *   - 行内 `!important` 后紧跟 `-- ihui-allow-important: <理由>` 注释的声明。
 *
 * 用法: node scripts/check-no-important.mjs
 * 退出码: 0 = 通过,1 = 存在违规。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const TARGET_DIRS = ['apps/web/app', 'apps/web/src', 'apps/web/components']
const EXTS = ['.css', '.scss', '.tsx', '.ts']
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', 'coverage'])

/** 豁免规则 1:prefers-reduced-motion 块 */
const REDUCED_MOTION_RE = /@media[^{]*prefers-reduced-motion[^{]*\{/
/** 豁免规则 2:显式行内豁免标记 */
const INLINE_ALLOW_RE = /--\s*ihui-allow-important\s*:/

/** 递归收集目标文件 */
function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(join(dir, entry.name), out)
    } else if (entry.isFile() && EXTS.some((e) => entry.name.endsWith(e))) {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

/**
 * 把源码按行切分,并为每行标注:
 *   - code: 剥离注释后的可匹配文本
 *   - inReducedMotion: 该行是否落在 prefers-reduced-motion 块内
 * 注释剥离覆盖 /* *\/ 块注释(css + jsx)与 // 行注释(js/ts)。
 */
function analyze(source) {
  const lines = source.split('\n')
  const result = []
  let inBlockComment = false
  let braceDepth = 0
  let reducedMotionStartDepth = -1

  for (const raw of lines) {
    let visible = ''
    let hasLineComment = false
    for (let i = 0; i < raw.length; i++) {
      if (inBlockComment) {
        if (raw[i] === '*' && raw[i + 1] === '/') {
          inBlockComment = false
          i++
        }
        continue
      }
      if (raw[i] === '/' && raw[i + 1] === '*') {
        inBlockComment = true
        i++
        continue
      }
      if (raw[i] === '/' && raw[i + 1] === '/') {
        hasLineComment = true
        break
      }
      visible += raw[i]
    }

    const allowInline = INLINE_ALLOW_RE.test(raw)
    const opens = (visible.match(/\{/g) ?? []).length
    const closes = (visible.match(/\}/g) ?? []).length

    if (REDUCED_MOTION_RE.test(visible)) {
      reducedMotionStartDepth = braceDepth
    }
    const inReducedMotion = reducedMotionStartDepth >= 0

    result.push({ raw, visible, inReducedMotion, allowInline, hasLineComment })

    braceDepth += opens - closes
    if (reducedMotionStartDepth >= 0 && braceDepth <= reducedMotionStartDepth) {
      reducedMotionStartDepth = -1
    }
  }
  return result
}

const violations = []
let exempted = 0

for (const dir of TARGET_DIRS) {
  for (const file of walk(resolve(ROOT, dir))) {
    const source = readFileSync(file, 'utf-8')
    if (!source.includes('!important')) continue
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    for (const { raw, visible, inReducedMotion, allowInline } of analyze(source)) {
      if (!visible.includes('!important')) continue
      // 必须落在声明位置(属性: 值 !important),排除字符串字面量里的说明文本
      if (!/:\s*[^;{}]*!important/.test(visible)) continue
      if (inReducedMotion || allowInline) {
        exempted++
        continue
      }
      violations.push({ file: rel, line: raw.trim() })
    }
  }
}

if (violations.length > 0) {
  console.error(`::error::检测到 ${violations.length} 处未豁免的 !important,请移除:`)
  for (const v of violations) {
    console.error(`::error::${v.file}: ${v.line}`)
  }
  console.error(
    '\n说明:仅 @media (prefers-reduced-motion: reduce) 块与带 ' +
      '`-- ihui-allow-important: <理由>` 的声明可豁免。',
  )
  process.exit(1)
}

console.info(`✅ 未检测到违规 !important(豁免 ${exempted} 处:无障碍 reduced-motion / 已标注例外)`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
