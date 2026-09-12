#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * createPortal 定位守门 — portal div 必须显式 position: fixed(2026-09-07 立)。
 *
 * 根因案例(2026-09-07 实修 4 处):自写 createPortal popover 把
 * style={{ top, left }} 挂在 portal div 上但缺 position: fixed ——
 * div 被 portal 到 document.body 后是 static 定位,top/left 被静默忽略,
 * 症状表现为"弹层位置漂移/点击没反应",且极难排查。
 *
 * 规则(依据 AGENTS.md 样式守门):凡 createPortal(<div ...>) 渲染的
 * 定位容器,必须满足以下其一:
 *   1. style 中含 position: 'fixed'(或 'absolute'——已知相对定位容器)
 *   2. className 含 Tailwind fixed / absolute 类
 *   3. style 引用外部变量(如 style={panelStyle}),允许——变量定义处
 *      无法静态可靠追踪,降级为人工 review 责任(WARN 不阻塞)
 *
 * 豁免:createPortal 的第二参(document/body 等)行、非 JSX 元素首行。
 *
 * 用法:
 *   node scripts/check-portal-fixed.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-portal-fixed.mjs             (全量扫描报告, exit 0)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { withExcludes } from './lib/exclude-dirs.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const EXCLUDE_DIRS = withExcludes(['.ihui-agent', 'tests', '__tests__', 'e2e'])
const SCAN_EXTS = ['.tsx', '.jsx']

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (EXCLUDE_DIRS.has(name) || name === 'node_modules') continue
      walk(full, out)
    } else if (SCAN_EXTS.some((e) => name.endsWith(e))) {
      out.push(full)
    }
  }
  return out
}

function listStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    })
    return out.split('\n').filter((f) => f && SCAN_EXTS.some((e) => f.endsWith(e)))
  } catch {
    return []
  }
}

/** 判断 createPortal(<div 开始于 lineIdx) 的该元素是否显式定位 */
function checkPortalElement(lines, startIdx, relPath, findings) {
  // 在 createPortal( 之后的 12 行内寻找首个 <div(或 <section 等容器)
  for (let i = startIdx; i < Math.min(startIdx + 12, lines.length); i++) {
    const line = lines[i]
    if (!line || !line.includes('<div')) continue
    // 自该行向后收集 10 行内的元素属性(含跨行 JSX)
    const snippet = lines.slice(i, i + 18).join('\n')
    const hasFixedClass = /\b(?:fixed|absolute)\b/.test(
      (snippet.match(/className=\{?[`'"]([^`'"]*)/)?.[1] ?? '')
    )
    const hasInlinePosition = /position:\s*['"](fixed|absolute)['"]/.test(snippet)
    const styleRefOnly =
      /style=\{[A-Za-z_][\w.]*\}/.test(snippet) && !hasFixedClass && !hasInlinePosition
    if (!hasFixedClass && !hasInlinePosition) {
      findings.push({
        file: relPath,
        line: i + 1,
        level: styleRefOnly ? 'WARN' : 'FAIL',
        msg: styleRefOnly
          ? 'portal 容器 style 引用外部变量,无法静态确认 position —— 请人工确认已含 fixed'
          : 'createPortal 容器缺显式 position: fixed —— portal 到 body 后 top/left 静默失效',
      })
    }
    return // 只检查首个容器元素
  }
}

function scanFile(absPath, relPath, findings) {
  let content
  try {
    content = readFileSync(absPath, 'utf8')
  } catch {
    return
  }
  const lines = content.split('\n')
  lines.forEach((line, idx) => {
    if (/createPortal\(/.test(line) && !/^\s*\/\//.test(line)) {
      // 第一参为变量引用(如 createPortal(overlay, ...))时跳过:
      // overlay 定义处与 createPortal 调用相距太远,静态追踪不可靠(人工 review)
      if (/createPortal\(\s*[A-Za-z_$][\w$]*\s*,/.test(line)) return
      checkPortalElement(lines, idx, relPath, findings)
    }
  })
}

function main() {
  let files
  if (isStaged) {
    files = listStagedFiles().map((f) => join(ROOT, f))
  } else {
    files = walk(join(ROOT, 'apps', 'web', 'src'))
  }
  const findings = []
  for (const f of files) {
    if (!existsSync(f)) continue
    scanFile(f, relative(ROOT, f).replace(/\\/g, '/'), findings)
  }
  const fails = findings.filter((x) => x.level === 'FAIL')
  const warns = findings.filter((x) => x.level === 'WARN')
  if (warns.length) {
    console.log(`\n${C.yellow}WARN${C.reset} (需人工确认,不阻塞):`)
    for (const w of warns) console.log(`  ${w.file}:${w.line} — ${w.msg}`)
  }
  if (fails.length) {
    console.log(`\n${C.red}FAIL${C.reset} — createPortal 定位守门(${fails.length} 处):`)
    for (const f of fails) console.log(`  ${f.file}:${f.line} — ${f.msg}`)
    console.log(
      `\n修复:portal 容器加 ${C.cyan}position: 'fixed'${C.reset}(style)或 ${C.cyan}fixed${C.reset} 类。`,
    )
    process.exit(1)
  }
  if (!warns.length) console.log(`${C.green}✓ createPortal 定位守门通过${C.reset}`)
}

main()
