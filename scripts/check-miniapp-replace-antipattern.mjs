#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-replace-antipattern.mjs — miniapp-taro ICU 反模式静态扫描
 *
 * 背景(2026-07-28 立):
 *   miniapp-taro 端 i18n 历史上多次出现 `t('key', '...{{n}}...').replace('{{n}}', val)`
 *   反模式(典型案例:apps/miniapp-taro/src/pages/ai/history.tsx:271-274)。
 *   危险点:next-intl SSR 渲染时会把 `{{n}}` 当 ICU placeholder 走 ICU 通道,
 *   开发者用 `.replace()` 替换后再让 next-intl 解析,会出现 ① 二次替换冲突
 *   ② 英文/日文/韩文版本的 ICU 语法不兼容(`{{n}}` 实际是 next-intl 自定义非标语法,
 *   应传 variables:`t('key', { n: val })`) ③ 翻译 key 缺失时 fallback 字符串里
 *   的 `{{n}}` 被替换后,首次渲染和服务端 hydration 不一致。
 *
 *   截至 2026-07-28,已修复 11 处 miniapp-taro 端反模式 + 1 处 web 端
 *   (apps/web/src/components/ai/context-usage-ring.tsx:256-261, :282-287)。
 *   修复统一模式:`t('key', { n: val })` 走 next-intl ICU 通道。
 *
 * 双层防护(本任务对应第 2 层):
 *   - 第 1 层:subagent C 写的 vitest 单测(运行期断言)
 *   - 第 2 层:本脚本(静态扫描,可在 pre-commit 阶段拦截)
 *   静态扫描的独特价值:修复后被人改回去时立即拦截,比单测更前置。
 *
 * 命中规则(任一即报):
 *   - Pattern A(最危险,SSR 必崩):
 *     `t(tt?)\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]*\{\{[a-zA-Z_]+\}\}[^'"]*['"]\s*\)\s*\.replace`
 *     例:`tt('streak.continuousDays', '连续 {{n}} 天').replace('{{n}}', val)`
 *
 *   - Pattern B:
 *     `t\(\s*['"][^'"]+['"]\s*\)\s*\.replace\s*\(\s*['"]\{\{`
 *     例:`t('key').replace('{{n}}', val)`(t 应该传 {n} 才对)
 *
 *   - Pattern C(兜底):
 *     任何字符串含 `{{xxx}}` 后接 `.replace`,更宽泛
 *
 * 安全模式(白名单,即使命中也不报):
 *   - t('key', { xxx: ... }) 传 variables 走 ICU 通道 — 合法
 *   - t('key', { n: x, m: y }) 多 variables — 合法
 *   - t('key', params ?? {}) 条件 fallback — 合法
 *   - t(`key_${id}`) 模板字符串 dynamic key — 合法
 *   - .replace(/regex/g, ...) 正则 — 合法(非 next-intl ICU)
 *
 * 退出码:
 *   0 — 通过(无命中)
 *   1 — 阻断(存在反模式,需修复)
 *
 * 用法:
 *   node scripts/check-miniapp-replace-antipattern.mjs                  # 扫全部(默认报告模式,exit 0/1 取决于命中)
 *   node scripts/check-miniapp-replace-antipattern.mjs --staged         # 只扫 staged 文件(给 pre-commit 用)
 *   node scripts/check-miniapp-replace-antipattern.mjs --quiet          # 只输出命中行,不输出进度
 *   node scripts/check-miniapp-replace-antipattern.mjs --json           # 输出 JSON 格式(给 CI 用)
 *
 * 集成位置: 后续 P1 任务 — 集成到 .husky/pre-commit(本任务只创建脚本)
 * 历史案例: .trae-cn/archive/AGENTS_history.md
 */
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { withExcludes } from './lib/exclude-dirs.mjs'
import { COLORS as C, createLogger } from './lib/logger.mjs'

const ROOT = resolve(process.cwd())
const log = createLogger()

// ── CLI 参数 ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const isStaged = argv.includes('--staged')
const isJson = argv.includes('--json')

// ── 扫描配置 ──────────────────────────────────────────────────────────────
const SCAN_ROOT = join(ROOT, 'apps', 'miniapp-taro', 'src')
const SCAN_EXTS = ['.ts', '.tsx', '.js', '.jsx']

// 排除目录(基于共享 EXCLUDE_DIRS,追加 miniapp-taro 特有归档目录)
const EXCLUDE_DIRS = withExcludes([
  '__tests__',
  'tests',
  'e2e',
  'migration-2025-12-i18n',
  'migration-2026-01-i18n',
  'migration-2026-02-i18n',
  'migration-2026-03-i18n',
  'migration-2026-04-i18n',
  'migration-2026-05-i18n',
  'migration-2026-06-i18n',
  'migration-2026-07-i18n',
])

// ── 命中规则(3 模式) ─────────────────────────────────────────────────────
const HIT_PATTERNS = [
  {
    id: 'A',
    label: 'tt(key, "...{{var}}...").replace',
    severity: 'block',
    reason: 'SSR 必崩 — ICU placeholder 被 .replace 替换后,next-intl 二次解析会冲突',
    re: /tt?\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]*\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}[^'"]*['"]\s*\)\s*\.replace/g,
  },
  {
    id: 'B',
    label: 't(key).replace("{{n}}", val)',
    severity: 'block',
    reason: 't() 未传 ICU variables,应改为 t(key, { n: val })',
    re: /\bt\(\s*['"][^'"]+['"]\s*\)\s*\.replace\s*\(\s*['"]\{\{/g,
  },
  {
    id: 'C',
    label: '"...{{var}}...").replace',
    severity: 'block',
    reason: '字符串含 ICU placeholder 但走 .replace 通道(兜底规则)',
    re: /['"][^'"]*\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}[^'"]*['"]\s*\)\s*\.replace/g,
  },
]

// ── 白名单(命中规则后,在该 match 上下文中检测白名单,任一命中即放行) ────
const WHITELIST_PATTERNS = [
  // W1: t(key, { xxx: ... }) — 传 ICU variables(对象字面量)
  { id: 'W1', label: 't(key, { variables })', re: /\bt\(\s*['"][^'"]+['"]\s*,\s*\{/ },
  // W2: tt(key, fb, { n: x }) — tt 带 params 第三参
  { id: 'W2', label: 'tt(key, fb, { variables })', re: /\btt\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]*['"]\s*,\s*\{/ },
  // W3: t(key, params ?? {}) — 条件 fallback
  { id: 'W3', label: 't(key, params ?? {})', re: /\bt\(\s*['"][^'"]+['"]\s*,\s*[^,)\s]+\s*\?\?/ },
  // W4: t(`key_${id}`) — 模板字符串 dynamic key
  { id: 'W4', label: 't(`template_string`)', re: /\bt\(\s*`/ },
  // W5: .replace(/regex/g, ...) — 正则替换(非 ICU)
  { id: 'W5', label: '.replace(/regex/g, ...)', re: /\.replace\s*\(\s*\// },
]

// ── 工具函数 ──────────────────────────────────────────────────────────────

/** 递归收集扫描根下的所有 .ts/.tsx/.js/.jsx 文件 */
function collectFiles(dir, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFiles(full, result)
    } else if (SCAN_EXTS.some((e) => entry.endsWith(e))) {
      result.push(full)
    }
  }
  return result
}

/** 获取 staged 文件列表(仅返回属于 SCAN_ROOT 的 .ts/.tsx/.js/.jsx) */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output
      .split('\n')
      .filter(Boolean)
      .map((f) => f.replace(/\\/g, '/'))
      .filter((f) => f.startsWith('apps/miniapp-taro/src/'))
      .filter((f) => SCAN_EXTS.some((e) => f.endsWith(e)))
      .filter((f) => {
        // 排除归档/测试目录
        const parts = f.split('/')
        return !parts.some((p) => EXCLUDE_DIRS.has(p))
      })
      .map((f) => join(ROOT, f))
      .filter((f) => existsSync(f))
  } catch {
    return []
  }
}

/** 从 git diff --cached -U0 输出中提取每个文件的新增行号集合 */
function getStagedAddedLines(files) {
  const result = new Map()
  let output
  try {
    output = execSync('git diff --cached -U0 --diff-filter=ACM --no-color', {
      encoding: 'utf8',
      cwd: ROOT,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    return result
  }
  if (!output) return result

  let curFile = null
  let curLine = 0
  for (const raw of output.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      const m = raw.match(/^\+\+\+\s+b\/(.+)$/)
      const abs = m ? join(ROOT, m[1].replace(/\\/g, '/')) : null
      curFile = files.includes(abs) ? abs : null
      curLine = 0
      continue
    }
    if (raw.startsWith('diff --git')) {
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
        // 删除行不推进
      } else {
        curLine++
      }
    }
  }
  return result
}

/** 计算 file position → (line, col),1-based */
function posToLineCol(src, pos) {
  const before = src.slice(0, pos)
  const line = (before.match(/\n/g) || []).length + 1
  const lastNl = before.lastIndexOf('\n')
  const col = lastNl === -1 ? pos + 1 : pos - lastNl
  return { line, col }
}

/** 取 match 在文件源码中的简短上下文(单行,最多 160 字符) */
function buildSnippet(src, matchStart, matchEnd) {
  // 截取 match 自身,合并空白
  const raw = src.slice(matchStart, matchEnd).replace(/\s+/g, ' ').trim()
  if (raw.length <= 160) return raw
  return `${raw.slice(0, 80)}…${raw.slice(-72)}`
}

/** 判定 match 是否被白名单覆盖:在 match 周边 ±80 字符内检测白名单 */
function getWhitelistHit(context) {
  for (const w of WHITELIST_PATTERNS) {
    if (w.re.test(context)) return w
  }
  return null
}

// ── 扫描主逻辑 ────────────────────────────────────────────────────────────

/** Pattern 优先级:A > B > C(A 最具体)
 *  同 file+line 的多次命中,只保留优先级最高的那条,避免重复报告 */
function dedupFindings(findings) {
  const PRIORITY = { A: 3, B: 2, C: 1 }
  const dedup = new Map()
  for (const f of findings) {
    const key = `${f.file}:${f.line}`
    const cur = dedup.get(key)
    if (!cur || (PRIORITY[f.pattern] ?? 0) > (PRIORITY[cur.pattern] ?? 0)) {
      dedup.set(key, f)
    }
  }
  return [...dedup.values()].sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file)
    return a.line - b.line
  })
}

// ── 报告输出 ──────────────────────────────────────────────────────────────

function printHumanReport(findings, scannedCount) {
  log.info(`${C.cyan}${C.bold}[scan] miniapp-taro ICU 反模式扫描...${C.reset} 扫描 ${scannedCount} 个文件`)
  log.info(`${C.dim}命中规则: 3 模式 (A: tt(key,fallback).replace | B: t(key).replace | C: 兜底 .replace) × 5 白名单豁免${C.reset}`)
  log.info(`${C.dim}扫描模式: ${isStaged ? 'staged (新增行命中阻塞)' : '全量'}${C.reset}`)
  log.info('')

  if (findings.length === 0) {
    log.info(`${C.green}${C.bold}✅ 未命中反模式${C.reset}`)
    return
  }

  // 主报告(❌ 阻断)→ error 通道,--quiet 不影响(始终输出,便于 CI/agent 读取)
  log.error(`${C.red}${C.bold}❌ 命中 ${findings.length} 处反模式:${C.reset}`)
  for (const f of findings) {
    log.error(
      `  ${C.red}-${C.reset} ${C.bold}${f.file}:${f.line}${C.reset}  ${C.dim}[${f.pattern}]${C.reset}  ${f.snippet}`,
    )
  }
  log.info('')
  log.info(`${C.bold}修复模式:${C.reset} 把 ${C.cyan}tt('key', '...{{n}}...').replace('{{n}}', val)${C.reset} 改为 ${C.cyan}t('key', { n: val })${C.reset} 走 next-intl ICU 通道`)
  log.info(`${C.bold}参考案例:${C.reset} apps/web/src/components/ai/context-usage-ring.tsx:256-261, :282-287 已修复`)
  log.info(`${C.bold}白名单豁免:${C.reset} t('key', { n: x }) / t('key', params ?? {}) / t(\`key_${'$'}{id}\`) / .replace(/regex/g, ...) / tt(key, fb, { n: x })`)
}

function printJsonReport(findings, scannedCount) {
  const report = {
    tool: 'check-miniapp-replace-antipattern',
    version: '1.0.0',
    scannedAt: new Date().toISOString(),
    scanMode: isStaged ? 'staged' : 'full',
    scannedCount,
    hitCount: findings.length,
    status: findings.length > 0 ? 'fail' : 'pass',
    findings,
  }
  console.log(JSON.stringify(report, null, 2))
}

// ── 入口 ──────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(SCAN_ROOT)) {
    console.error(`${C.red}❌ 扫描根不存在:${C.reset} ${SCAN_ROOT}`)
    process.exit(2)
  }

  let files = []
  if (isStaged) {
    files = getStagedFiles()
    if (files.length === 0 && !isJson) {
      log.info(`${C.green}✅ staged 无 miniapp-taro 源码变更,跳过${C.reset}`)
      process.exit(0)
    }
  } else {
    files = collectFiles(SCAN_ROOT)
  }

  // staged 模式下,只检查新增行(按行号过滤)
  let addedLinesMap = new Map()
  if (isStaged) {
    addedLinesMap = getStagedAddedLines(files)
  }

  const findings = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const rel = relative(ROOT, file).split(/[\\/]/).join('/')
    const allowed = addedLinesMap.get(file)
    for (const pat of HIT_PATTERNS) {
      const re = new RegExp(pat.re.source, pat.re.flags)
      let m
      while ((m = re.exec(src)) !== null) {
        const matchStart = m.index
        const matchEnd = m.index + m[0].length
        const { line } = posToLineCol(src, matchStart)

        // staged 模式:只检查新增行
        if (isStaged && (!allowed || !allowed.has(line))) {
          if (m.index === re.lastIndex) re.lastIndex++
          continue
        }

        // 白名单检测
        const ctxStart = Math.max(0, matchStart - 120)
        const ctxEnd = Math.min(src.length, matchEnd + 120)
        const context = src.slice(ctxStart, ctxEnd)
        const wl = getWhitelistHit(context)
        if (wl) {
          if (m.index === re.lastIndex) re.lastIndex++
          continue
        }

        const { col } = posToLineCol(src, matchStart)
        findings.push({
          file: rel,
          line,
          col,
          pattern: pat.id,
          patternLabel: pat.label,
          reason: pat.reason,
          snippet: buildSnippet(src, matchStart, matchEnd),
        })
        if (m.index === re.lastIndex) re.lastIndex++
      }
    }
  }

  // 同 file+line 多次命中 → 仅保留优先级最高的,避免重复报告
  const finalFindings = dedupFindings(findings)

  if (isJson) {
    printJsonReport(finalFindings, files.length)
  } else {
    printHumanReport(finalFindings, files.length)
  }

  process.exit(finalFindings.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
