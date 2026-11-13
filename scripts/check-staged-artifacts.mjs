#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * Pre-commit 守门:暂存区「生成物 / 垃圾文件」阻断(2026-11-12 立)。
 *
 * 背景:2026-11-12 一次 `git add -A` 把 9038 个生成物(架构提取沙箱 `.archify/verify/snapshot-backfill`
 *       的 33 份隔离实验目录、`.agent_tmp/` 代理临时目录、迁移目录副本 `drizzle-copy*`、
 *       逆向抓包副本 `*.keep.ts`、编译日志)一起纳入提交面。生成物入库会永久加重仓库历史、
 *       淹没真实代码改动,并让"这次到底改了哪些真实代码"无从判断。
 *
 * 判据(任一命中即阻断,exit 1):
 *   - 路径段命中生成物目录名(.archify / .agent_tmp / archify-work / node_modules /
 *     drizzle-copy* / .next / coverage / .screenshots / .box-agent-scratch / _itmp_* / iso-*)
 *   - 文件名命中一次性产物名(.commit-msg.txt / *.keep.ts / *.log / 对话导出 md)
 *   - 仓库根目录出现媒体/压缩包(.png/.jpg/.zip/... )或错位源文件(非 *.config.ts 的 .ts)
 *
 * 不拦的情况:
 *   - 删除(D)与重命名中的删除侧:清垃圾本身是正确操作,必须放行
 *   - 已跟踪文件的小改:即使名字像日志,只要是 A/M 且此前就入库(判据只作用于新增面)
 *
 * 出口(三态,AGENTS.md §0.3):
 *   - 真 0:暂存区无生成物 → exit 0,并打印「本次提交画像」(源码/文档/配置/其他 各几件)
 *   - 真违规:命中生成物 → exit 1 + 逐条列出走法与放行出路
 *   - 未判定:取不到索引面(git 失败)→ exit 2 点名,不得报绿
 *
 * 用法:
 *   node scripts/check-staged-artifacts.mjs             # 守门(默认)
 *   node scripts/check-staged-artifacts.mjs --report    # 只画像不拦(提交前自查)
 *   node scripts/check-staged-artifacts.mjs --quiet     # 正常时不输出
 *   HUSKY_SKIP_STAGED_ARTIFACTS=1 git commit ...        # 应急跳过(慎用)
 *
 * 集成位置:.husky/pre-commit → scripts/lib/pre-commit-hook.js 第 0c 步(阻塞)。
 */
import { gitRaw } from './lib/face-reader.mjs'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/** 生成物目录名(任一路径段命中即算) */
const ARTIFACT_DIRS = new Set([
  '.archify',
  '.agent_tmp',
  'archify-work',
  'node_modules',
  'drizzle-copy',
  'drizzle-copy2',
  '.next',
  '.turbo',
  'coverage',
  '.screenshots',
  '.box-agent-scratch',
  '.ghidra',
  'ghidra-proj',
])

/** 路径段前缀形态的沙箱目录(_itmp_xxxxxx / iso-0371+372 这类一次性实验目录) */
const ARTIFACT_SEGMENT_PREFIX = [/^_itmp/, /^iso-/]

/** 生成物文件名形态 */
const ARTIFACT_NAME_RES = [
  [/^\.commit-msg\.txt$/, '提交信息草稿'],
  [/^\.commit-files\.txt$/, '提交文件清单草稿'],
  [/\.keep\.(ts|js|mjs|cjs)$/, '逆向抓包副本'],
  [/\.log$/, '运行/编译日志'],
]

/** 根目录不允许出现的媒体/压缩包(交付物应放 docs/ 或对应 app 资源目录) */
const ROOT_BINARY_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.zip',
  '.7z',
  '.tar',
  '.gz',
  '.mp4',
  '.mov',
  '.sqlite',
  '.db',
])

/** 根目录允许的工程配置文件形态(根目录错位源文件判据的豁免面) */
const ROOT_CONFIG_ALLOW = /(\.config\.(ts|js|mjs|cjs)|\.d\.ts|\.setup\.(ts|js)|\.mjs|\.cjs)$/

const SRC_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql', '.css', '.scss', '.vue', '.svelte', '.kt', '.swift', '.java', '.rs', '.go', '.sh', '.ps1'])
const DOC_EXTS = new Set(['.md', '.mdx', '.txt', '.rst'])
const CFG_EXTS = new Set(['.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.env', '.lock'])

/** 判据单元:单条路径是否生成物(纯函数,零副作用) */
function judgePath(file) {
  const norm = file.replace(/\\/g, '/')
  const segments = norm.split('/')
  const basename = segments[segments.length - 1] ?? ''

  for (const seg of segments.slice(0, -1)) {
    if (ARTIFACT_DIRS.has(seg)) return `生成物目录 ${seg}/`
    if (ARTIFACT_SEGMENT_PREFIX.some((re) => re.test(seg))) return `一次性实验目录 ${seg}/`
  }

  for (const [re, label] of ARTIFACT_NAME_RES) {
    if (re.test(basename)) return `${label} ${basename}`
  }

  if (segments.length === 1) {
    const lower = basename.toLowerCase()
    const dot = lower.lastIndexOf('.')
    const ext = dot >= 0 ? lower.slice(dot) : ''
    if (ROOT_BINARY_EXTS.has(ext)) return `根目录媒体/压缩包 ${basename}`
    if (ext === '.ts' && !ROOT_CONFIG_ALLOW.test(basename)) {
      return `根目录错位源文件 ${basename}(应放回对应 app/package)`
    }
  }

  return null
}

/** 判据单元:提交画像分桶(纯函数) */
function bucketOf(file) {
  const dot = file.lastIndexOf('.')
  const ext = dot >= 0 ? file.slice(dot).toLowerCase() : ''
  if (SRC_EXTS.has(ext)) return '源码'
  if (DOC_EXTS.has(ext)) return '文档'
  if (CFG_EXTS.has(ext)) return '配置'
  return '其他'
}

/** 判据单元:取索引面(name-status,含新增/修改/重命名;删除侧已由 --diff-filter 排除) */
function readStagedEntries() {
  const out = gitRaw(['diff', '--cached', '--name-status', '--diff-filter=ACMR'], ROOT)
  const entries = []
  for (const raw of out.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (!line.trim()) continue
    const parts = line.split('\t')
    const status = (parts[0] ?? '').trim()
    // 重命名形态 `R100\t旧\t新`:取新路径
    const file = (parts[parts.length - 1] ?? '').replace(/\\/g, '/')
    if (!file) continue
    entries.push({ status: status[0], file })
  }
  return entries
}

/** 判据单元:总体裁定(纯函数) */
function judgeStaged(entries) {
  const violations = []
  const buckets = { 源码: 0, 文档: 0, 配置: 0, 其他: 0 }
  for (const e of entries) {
    const reason = judgePath(e.file)
    if (reason) violations.push({ ...e, reason })
    buckets[bucketOf(e.file)] += 1
  }
  return { violations, buckets, total: entries.length }
}

function printProfile({ buckets, total }) {
  console.log(
    `${C.dim}本次提交画像:共 ${total} 件 · 源码 ${buckets.源码} · 文档 ${buckets.文档} · 配置 ${buckets.配置} · 其他 ${buckets.其他}${C.reset}`,
  )
}

async function main() {
  const args = process.argv.slice(2)
  if (process.env.HUSKY_SKIP_STAGED_ARTIFACTS === '1') {
    console.log(`${C.dim}⏭ 生成物拦截(HUSKY_SKIP_STAGED_ARTIFACTS=1 应急跳过)${C.reset}`)
    return 0
  }
  const reportOnly = args.includes('--report')
  const quiet = args.includes('--quiet')

  let entries
  try {
    entries = readStagedEntries()
  } catch (e) {
    console.error(
      `❌ check-staged-artifacts:取不到暂存区索引(git diff --cached 失败)—— 未判定(exit 2):${e?.message ?? e}`,
    )
    return 2
  }

  if (entries.length === 0) {
    if (!quiet) console.log(`${C.dim}✅ 生成物拦截(暂存区为空)${C.reset}`)
    return 0
  }

  const { violations, buckets, total } = judgeStaged(entries)

  if (reportOnly) {
    printProfile({ buckets, total })
    for (const v of violations) {
      console.log(`${C.yellow}  ⚠ ${v.file}${C.reset} ${C.dim}(${v.reason})${C.reset}`)
    }
    return 0
  }

  if (violations.length === 0) {
    if (!quiet) {
      console.log(`${C.green}✅ 生成物拦截:0 件${C.reset}`)
      printProfile({ buckets, total })
    }
    return 0
  }

  console.log('')
  console.log(`${C.red}${C.bold}❌ 生成物拦截:暂存区含 ${violations.length} 件不该入库的生成物${C.reset}`)
  console.log(`${C.dim}(这些文件不是产品代码,是实验沙箱 / 日志 / 副本;入库会永久加重历史并淹没真实改动)${C.reset}`)
  console.log('')
  const preview = violations.slice(0, 20)
  for (const v of preview) {
    console.log(`  ${C.cyan}${v.file}${C.reset} ${C.dim}← ${v.reason}${C.reset}`)
  }
  if (violations.length > preview.length) {
    console.log(`${C.dim}  ... 还有 ${violations.length - preview.length} 件${C.reset}`)
  }
  console.log('')
  console.log(`${C.bold}出路(二选一):${C.reset}`)
  console.log(`  ${C.dim}1) 撤出暂存区:git restore --staged <上面的路径>   (工作区文件保留)${C.reset}`)
  console.log(`  ${C.dim}2) 确认是一次性产物 ⇒ 删掉或登记进 .gitignore${C.reset}`)
  console.log(
    `${C.dim}自查本次到底改了什么:node scripts/check-staged-artifacts.mjs --report${C.reset}`,
  )
  console.log('')
  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  ARTIFACT_DIRS,
  ARTIFACT_SEGMENT_PREFIX,
  ARTIFACT_NAME_RES,
  ROOT_BINARY_EXTS,
  judgePath,
  bucketOf,
  judgeStaged,
  readStagedEntries,
  main,
}
