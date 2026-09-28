#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。


/**
 * API Key 泄露检查 pre-commit 守门脚本。
 *
 * 检查所有暂存文件 + .example 文件 + memory 文件,确保真实 API key 不被提交。
 *
 * 触发条件(任一即拒绝提交):
 * 1. .example 文件含疑似真实 key(非 <your-xxx> 占位符的实际 key 值)
 * 2. 任何文件含已知 key 前缀(sk-irJTb1 / 5iFfF0dl 等)
 * 3. memory 文件含真实 key 值
 *
 * 用法:node scripts/check-api-key-leak.mjs [--staged|--worktree]
 *   --staged: 判**索引 blob**(提交链用;盘上随后改对不算修好)
 *   无参数:判 **HEAD blob** 的 .example 文件(手动验证用,与守门 70/77/83/98/118 同口径)
 *   --worktree: 判磁盘(人工逃生舱,不得作为提交门禁)
 * 取材走 face-reader 统一层(守门 118:引了层却自己读盘 = 半接线);取不到输入 ⇒ exit 2 无法判定。
 */
import { execSync } from 'node:child_process'
import { createLogger } from './lib/logger.mjs'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const log = createLogger()

const ROOT = process.cwd()
const { face, error: faceError } = selectFace({
  staged: process.argv.includes('--staged'),
  worktree: process.argv.includes('--worktree'),
})

// 已知 key 前缀(真实 key 的前 8 字符,用于检测泄露)
const KNOWN_KEY_PREFIXES = [
  'sk-irJTb1', // Agnes AI key 前缀
  '5iFfF0dl', // StepFun key 前缀
  // Cloudflared tunnel token 前缀(account ID 段固定,rotate 后 s-field 变但前缀不变)
  // 2026-08-05 立:曾发生旧 token 硬编码进 scripts/start-cloudflared-tunnel.ps1 提交事件
  'eyJhIjoiNDhkY2Q1MDcyNGI1ZmVkMjFlOGRkNmNj',
]

// 通用 API key 正则(sk- 开头 + 32+ 字符,或 64 位十六进制)
const API_KEY_PATTERNS = [
  /sk-[A-Za-z0-9]{32,}/, // OpenAI/Agnes 风格
  /\b[A-Za-z0-9]{64}\b/, // StepFun 风格(64 位字母数字)
]

// 允许的占位符模式(不视为泄露)
const PLACEHOLDER_PATTERNS = [
  /<your-[^>]+-api-key>/,
  /<your-[^>]+>/,
  /\$\{.*API_KEY.*\}/, // docker-compose 变量引用
  /\$\{.*_KEY:-\}/, // docker-compose 带默认值
  /^API_KEY=$/m, // 空值
  /^.*_API_KEY=$/m, // 空值
]

/** 收集需检查的**相对路径**清单(枚举是 git 事实,内容一律另走 face-reader) */
function collectFiles() {
  // 跳过本检测脚本自身与其镜像测试(两者都内嵌 key 前缀作为检测子/断言夹具,非泄露)。
  // 镜像测试豁免是 2026-09-27 补的:该测试文件一旦进暂存区(G-284 迁移当天实测),
  // --staged 档会把夹具里的已知前缀当真泄露判红,导致这道门自己的测试永远提不进去。
  // 豁免按精确路径点名,不给 scripts/tests/ 开目录口子(反向对照见镜像测试 T24)。
  // 注意:git 输出的路径分隔符恒为 `/`,这里必须用正斜杠字面量 —— 用 join 在 Windows 上
  // 会生成反斜杠,豁免集合与枚举清单对不上,门就会把自己的源文件判成泄露(2026-09-27 实测)。
  const SELF_FILES = new Set([
    'scripts/check-api-key-leak.mjs',
    'scripts/tests/check-api-key-leak.test.mjs',
  ])
  if (face === 'staged') {
    try {
      const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
        encoding: 'utf8',
        cwd: ROOT,
        // 防 Windows 弹可见控制台窗口
        windowsHide: true,
      })
      return output
        .split('\n')
        .map((f) => f.replace(/\r$/, ''))
        .filter((f) => f && !SELF_FILES.has(f))
    } catch {
      return []
    }
  }
  // head/worktree 面:检查所有 .example 文件 + memory
  return [
    '.env.production.example',
    '.env.example',
    'apps/ai-service/.env.example',
    'apps/api/.env.example',
  ]
}

/** 检查单行是否含真实 key(非占位符) */
function isRealKey(line) {
  // 先检查是否是占位符
  for (const p of PLACEHOLDER_PATTERNS) {
    if (p.test(line)) return false
  }
  // 检查已知 key 前缀
  for (const prefix of KNOWN_KEY_PREFIXES) {
    if (line.includes(prefix)) return true
  }
  // 检查通用 key 模式(仅在 KEY= 赋值行检查,避免误报)
  if (/^[A-Z_]*API_KEY[A-Z_]*\s*=\s*\S+/.test(line) || /^[A-Z_]*_KEY\s*=\s*\S+/.test(line)) {
    const value = line.split('=')[1]?.trim() || ''
    // 空值或占位符已排除,这里检查是否有真实 key 模式
    if (value.length >= 32 && !value.startsWith('<') && !value.startsWith('$')) {
      for (const p of API_KEY_PATTERNS) {
        if (p.test(value)) return true
      }
    }
  }
  return false
}

if (faceError) {
  log.error(`❌ ${faceError}`)
  process.exit(2)
}

const files = collectFiles()
const violations = []

try {
  assertRepoRoot(ROOT, 'API key 泄露检查')
  // 清单与内容同面同轮:一次 catBatch 读满,不在读取时偷偷补派生(守门 118/98 同一纪律)。
  const specs = files.map((p) => (face === 'staged' ? `:${p}` : `HEAD:${p}`))
  const map = face === 'worktree' ? null : catBatch(ROOT, specs)
  files.forEach((rel, i) => {
    let content
    if (face === 'worktree') {
      content = readWorktreeFile(ROOT, rel)
      if (content === null) return // 盘上不存在 = 少扫一个,不是取不到
    } else {
      content = map.get(specs[i])
      // 该面无此文件(未跟踪/缺席)= 少扫一个,不是取不到;catBatch 对 missing 给 null、对未预给规格留 undefined
      if (content === undefined || content === null) return
    }
    content.split('\n').forEach((line, idx) => {
      if (isRealKey(line)) {
        violations.push(`${rel}:${idx + 1}: ${line.trim().substring(0, 80)}...`)
      }
    })
  })
} catch (e) {
  if (e instanceof Undetermined) {
    log.error(`⚠️ [API Key 泄露检查] 无法判定(取材面不可用): ${e.message}`)
    process.exit(2)
  }
  throw e
}

if (violations.length > 0) {
  log.error('\x1b[31m[API Key 泄露检查] 检测到真实 API key,拒绝提交!\x1b[0m')
  log.error('')
  log.error('\x1b[31m泄露位置:\x1b[0m')
  violations.forEach((v) => log.error(`  ${v}`))
  log.error('')
  log.error('\x1b[33m修复方法:\x1b[0m')
  log.error('  1. .example 文件必须用 <your-xxx-api-key> 占位符')
  log.error('  2. 真实 key 只允许写入 .env / .env.production / apps/ai-service/.env(在 .gitignore)')
  log.error('  3. memory 文件禁止记录真实 key 值')
  log.error('')
  process.exit(1)
}

log.info('\x1b[32m[API Key 泄露检查] 通过,未检测到真实 key 泄露\x1b[0m')
process.exit(0)
