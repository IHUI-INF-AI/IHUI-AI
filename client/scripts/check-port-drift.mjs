#!/usr/bin/env node
/**
 * 端口漂移检测 (Port Drift Detector)
 *
 * 目的: 防止 vite.config.ts / playwright.config.ts / e2e / CI / 脚本中再次出现
 *       硬编码的端口字面量 (8000/8888/4173/18000), 所有端口必须从
 *       client/config/ports.ts 单点读取.
 *
 * 用法: node scripts/check-port-drift.mjs
 *
 * 退出码:
 *   0 - 通过
 *   1 - 发现端口字面量
 *
 * 匹配规则 (避免 timeout: 8000 / 其它数字误报):
 *   - URL 中的端口:        http(s)://host:8000, ws://host:8888
 *   - Vite proxy target:   target: 'http://host:8000'
 *   - 命令行参数:          --port 8000, --PORT 8000
 *   - 配置项赋值:          port = 8000, port: 8000, "port": 8000
 *   - PowerShell 变量:     [int]$BackendPort = 8000, $env:PORT=8000
 *   - 端口协议前缀:        :8000/api (路由前缀, 但 :8000 必须紧跟在 / 之前)
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')

const EXPECTED = {
  BACKEND: 8000,
  FRONTEND: 8888,
  PREVIEW: 4173,
  DEPRECATED: [18000],
  PROMETHEUS: 9090,
}
const ALL_PORTS = [...new Set([EXPECTED.BACKEND, EXPECTED.FRONTEND, EXPECTED.PREVIEW, ...EXPECTED.DEPRECATED, EXPECTED.PROMETHEUS])]

/** 端口上下文匹配规则: 数组中每项是一个正则, 必须匹配且不被豁免 */
const PATTERNS = [
  // URL: http(s)://host:PORT
  new RegExp(`https?://[^\\s'"\\)\\]\\}]+:(${ALL_PORTS.join('|')})\\b`, 'g'),
  // WebSocket: ws(s)://host:PORT
  new RegExp(`wss?://[^\\s'"\\)\\]\\}]+:(${ALL_PORTS.join('|')})\\b`, 'g'),
  // Vite target: 'http://...:PORT'
  new RegExp(`target:\\s*['"]https?://[^'"]+:(${ALL_PORTS.join('|')})\\b`, 'g'),
  // 命令行: --port PORT 或 --PORT PORT
  new RegExp(`--port[=\\s]+(${ALL_PORTS.join('|')})\\b`, 'gi'),
  new RegExp(`--(PORT)\\s+(${ALL_PORTS.join('|')})\\b`, 'g'),
  // 配置: port = PORT / port: PORT / "port": PORT
  new RegExp(`['"]?port['"]?\\s*[:=]\\s*(${ALL_PORTS.join('|')})\\b`, 'gi'),
  // PowerShell 变量: $XxxPort = PORT
  new RegExp(`\\$\\w*[Pp]ort\\s*=\\s*(${ALL_PORTS.join('|')})\\b`, 'g'),
  // PowerShell 环境变量: $env:PORT=PORT
  new RegExp(`\\$env:\\w*[Pp]ort\\s*=\\s*(${ALL_PORTS.join('|')})\\b`, 'g'),
  // 路由前缀: /api:PORT/api 之类 (少见, 但 :PORT 必须紧跟非字母)
  // 端口:8000/api/health 形式
  new RegExp(`:(${ALL_PORTS.join('|')})/(api|health|cozeZhsApi|docs|metrics)`, 'g'),
]

/** 允许出现端口字面量的白名单 (本文件自身 / 唯一来源 / 文档) */
const WHITELIST_FILES = new Set([
  path.join(clientRoot, 'config/ports.ts'),
  __filename,
  path.join(clientRoot, 'docs/DEV_PORTS.md'),
  path.join(clientRoot, 'README.md'),
  path.join(projectRoot, 'README.md'),
])

const WHITELIST_PATTERNS = [
  /[\/\\]docs[\/\\].*\.md$/,
  /[\/\\]README\.md$/,
  /[\/\\]PROJECT_HANDOFF\.md$/,
]

/** 扫描配置: (路径, 是否单文件, 文件扩展名, 允许行内豁免函数) */
const SCAN_TARGETS = [
  {
    root: path.join(clientRoot, 'vite.config.ts'),
    isFile: true,
    label: 'client/vite.config.ts',
    allowIn: (line) => {
      if (/from\s+['"][^'"]*config\/ports['"]/.test(line)) return true
      if (/\b(BACKEND_URL|FRONTEND_URL|PREVIEW_URL|BACKEND_PORT|FRONTEND_PORT|PREVIEW_PORT|DEPRECATED_PORTS)\b/.test(line)) return true
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return true
      return false
    },
  },
  {
    root: path.join(clientRoot, 'playwright.config.ts'),
    isFile: true,
    label: 'client/playwright.config.ts',
    allowIn: (line) => {
      if (/from\s+['"][^'"]*config\/ports['"]/.test(line)) return true
      if (/\b(BACKEND_URL|FRONTEND_URL|PREVIEW_URL|BACKEND_PORT|FRONTEND_PORT|PREVIEW_PORT|DEPRECATED_PORTS)\b/.test(line)) return true
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return true
      if (/\bPW_(BASE|BACKEND)_URL\b/.test(line)) return true
      return false
    },
  },
  {
    root: path.join(clientRoot, 'scripts'),
    isFile: false,
    label: 'client/scripts/**',
    ext: ['.ts', '.js', '.mjs'],
    allowIn: (line) => {
      if (/from\s+['"][^'"]*config\/ports['"]/.test(line)) return true
      if (/\b(BACKEND_URL|FRONTEND_URL|PREVIEW_URL|BACKEND_PORT|FRONTEND_PORT|PREVIEW_PORT|DEPRECATED_PORTS)\b/.test(line)) return true
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return true
      return false
    },
  },
  // ==== 不参与字面量严格扫描的文件类型 ====
  // client/e2e/**  : e2e 测试中硬编码 baseURL 'http://localhost:8888' 与后端直连 'http://127.0.0.1:8000'
  //                  是常见模式 (Playwright baseURL 已在 playwright.config.ts 统一管理), 不会引发端口漂移
  // .github/workflows/*.yml : yml 文件无法 import TS, 端口必须以字面量形式出现 (命令行参数)
  // scripts/*.ps1 / *.sh / *.bat : 同 yml, PowerShell 变量默认值必须以字面量形式出现
  // 例外约束: 18000 出现仍需专项检查 (见下方)
  //
  // 注意: dev-up.ps1 / ci-env-setup.ps1 中 $DEFAULT_XXX_PORT = N 形式 (建议 2 增强) 是单一来源声明, 允许
  // 完整豁免规则在 deprecatedTarget 检查下方定义
]

let totalViolations = 0

function walk(dir, ext) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'test-results', 'logs', 'pw-output'].includes(entry.name)) continue
      out.push(...walk(p, ext))
    } else if (!ext || ext.some((e) => entry.name.endsWith(e))) {
      out.push(p)
    }
  }
  return out
}

function isWhitelisted(filePath) {
  if (WHITELIST_FILES.has(filePath)) return true
  return WHITELIST_PATTERNS.some((re) => re.test(filePath))
}

function scanFile(filePath, allowIn) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split(/\r?\n/)
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    // 跳过纯注释行
    const trimmed = raw.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('#')) continue
    // 行内注释: 只在 // 后无 URL 时截断. 这里保守处理, 不截断 // 注释 (URL 中的 // 不算)
    const line = raw
    if (allowIn(line)) continue
    for (const pat of PATTERNS) {
      pat.lastIndex = 0
      let m
      while ((m = pat.exec(line)) !== null) {
        const port = m[1] || m[2]
        hits.push({ line: i + 1, port, text: raw.trim(), rule: pat.source.slice(0, 40) })
      }
    }
  }
  return hits
}

for (const target of SCAN_TARGETS) {
  const files = target.isFile ? [target.root] : walk(target.root, target.ext)
  for (const f of files) {
    if (isWhitelisted(f)) continue
    const hits = scanFile(f, target.allowIn)
    if (hits.length === 0) continue
    totalViolations += hits.length
    console.error(`\n[VIOLATION] ${target.label}`)
    for (const h of hits) {
      console.error(`  ${path.relative(projectRoot, f)}:${h.line}  port=${h.port}  rule=${h.rule}`)
      console.error(`    ${h.text}`)
    }
  }
}

const portsTs = fs.readFileSync(path.join(clientRoot, 'config/ports.ts'), 'utf-8')
for (const [key, value] of Object.entries(EXPECTED)) {
  if (key === 'DEPRECATED') {
    const arrayMatch = portsTs.match(/DEPRECATED_PORTS:\s*number\[\]\s*=\s*\[([^\]]+)\]/)
    if (!arrayMatch) {
      console.error(`\n[VIOLATION] config/ports.ts 缺 DEPRECATED_PORTS 定义`)
      totalViolations++
      continue
    }
    const nums = [...arrayMatch[1].matchAll(/\b(\d+)\b/g)].map((m) => Number(m[1]))
    if (JSON.stringify(nums) !== JSON.stringify(value)) {
      console.error(`\n[VIOLATION] config/ports.ts DEPRECATED_PORTS=${JSON.stringify(nums)} 与期望 ${JSON.stringify(value)} 不一致`)
      totalViolations++
    }
  } else {
    // 兼容两种形式:
    //   export const X_PORT = 8000
    //   export const X_PORT = envPort('X_PORT', 8000)
    const re1 = new RegExp(`\\b${key}_PORT\\s*=\\s*${value}\\b`)
    const re2 = new RegExp(`\\b${key}_PORT\\s*=\\s*envPort\\(\\s*['"]${key}_PORT['"]\\s*,\\s*${value}\\s*\\)`)
    if (!re1.test(portsTs) && !re2.test(portsTs)) {
      console.error(`\n[VIOLATION] config/ports.ts 中找不到 ${key}_PORT = ${value} (直接赋值或 envPort 形式)`)
      totalViolations++
    }
  }
}

/** 18000 残留专项检查: 全项目范围 (含 e2e/yml/ps1) 任何 18000 出现都视为可疑, 仅"清理"上下文豁免 */
const deprecatedTarget = [
  { root: path.join(projectRoot, '.github/workflows'), ext: ['.yml', '.yaml'], label: '.github/workflows/**' },
  { root: path.join(projectRoot, 'scripts'), ext: ['.ps1', '.sh', '.bat'], label: 'scripts/**' },
  { root: path.join(clientRoot, 'scripts'), ext: ['.ps1', '.sh', '.bat'], label: 'client/scripts/**' },
  { root: path.join(clientRoot, 'e2e'), ext: ['.ts', '.js', '.mjs'], label: 'client/e2e/**' },
]
for (const t of deprecatedTarget) {
  for (const f of walk(t.root, t.ext)) {
    const lines = fs.readFileSync(f, 'utf-8').split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const trimmed = raw.trim()
      if (!/\b18000\b/.test(raw)) continue
      // 豁免纯注释行
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('#')) continue
      // 豁免 JSDoc 中的 18000 提及 (上下文含"废弃/历史/legacy/deprecated")
      if (/(废弃|历史|legacy|deprecated|绝不能|不应|不得|绝不可)/i.test(raw)) continue
      // 豁免"清理"上下文
      if (/(清理|clean|killing|Stop)/i.test(raw)) continue
      // 豁免 PowerShell $DEFAULT_DEPRECATED_PORT = 18000 形式 (单一来源常量赋值, 建议 2 增强)
      if (/\$\s*DEFAULT_DEPRECATED_PORT\s*=\s*18000/.test(raw)) continue
      // 豁免 PowerShell env 变量 fallback 形式
      if (/\$env:DEPRECATED_PORT/.test(raw)) continue
      // 豁免 PowerShell 算术表达式 if (... -gt 18000) 等
      if (/\b18000\b/.test(raw) && /(18000\s*[-+*/><=]|[-+*/><=]\s*18000)/.test(raw)) continue
      totalViolations++
      console.error(`\n[VIOLATION-18000] ${t.label}`)
      console.error(`  ${path.relative(projectRoot, f)}:${i + 1}  18000 出现但非"清理/注释/常量"上下文`)
      console.error(`    ${raw.trim()}`)
    }
  }
}

if (totalViolations > 0) {
  console.error(`\n[FAIL] 共发现 ${totalViolations} 处端口漂移违规`)
  console.error(`修复: 把端口字面量替换为从 client/config/ports.ts import (BACKEND_URL/FRONTEND_URL/PREVIEW_URL/DEPRECATED_PORTS)`)
  console.error(`例外: ports.ts 自身、文档 README/DEV_PORTS.md、注释行`)
  process.exit(1)
}

console.log('[OK] 端口配置统一, 无漂移')
console.log(`  BACKEND=${EXPECTED.BACKEND}  FRONTEND=${EXPECTED.FRONTEND}  PREVIEW=${EXPECTED.PREVIEW}  DEPRECATED=${JSON.stringify(EXPECTED.DEPRECATED)}`)
process.exit(0)
