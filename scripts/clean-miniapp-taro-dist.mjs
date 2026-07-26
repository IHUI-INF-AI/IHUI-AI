#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * MiniApp Taro 编译产物清理脚本(2026-07-26 立)
 *
 * 背景:
 *   Taro 4 多端编译时,支付宝小程序产物输出到 `dist-alipay/`,微信小程序输出到 `dist/`。
 *   但本地开发常因以下场景导致产物混淆:
 *     ① IDE(微信开发者工具 / 支付宝小程序 IDE)缓存的 `./dist` 仍指向对方平台产物
 *     ② 上次编译残留,本次 `taro build --type alipay` 不会自动清理 `./dist`
 *     ③ `.swc` / `.turbo` 缓存命中旧 config,导致产物路径未及时切换
 *   结果:用户打开 IDE 看到的是 5 分钟前的 weapp 产物,误判 alipay 编译到 wechat dist。
 *
 * 功能:
 *   - 删除 `apps/miniapp-taro/dist/` + `dist-alipay/`
 *   - 删除 `apps/miniapp-taro/.swc/` + `.turbo/`(Taro 4 + Vite runner 缓存)
 *   - 支持 `--dry-run` 预览将被删除的路径
 *
 * 用法:
 *   node scripts/clean-miniapp-taro-dist.mjs              # 实际清理
 *   node scripts/clean-miniapp-taro-dist.mjs --dry-run   # 预览
 *   pnpm --filter @ihui/miniapp-taro clean                # 通过 package.json clean 脚本调用
 *
 * 集成:
 *   - `apps/miniapp-taro/package.json` 的 `clean` 脚本
 *   - `.husky/pre-commit` 第 16d 条件守门:仅当 staged 涉及 miniapp-taro 配置时提示运行
 *
 * 退出码:
 *   0 = 成功(无论是否实际删除)
 *   1 = 错误(路径不存在等异常)
 */
import { existsSync, rmSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const TARO_PKG = join(ROOT, 'apps', 'miniapp-taro')

const TARGETS = [
  { name: 'dist', path: join(TARO_PKG, 'dist'), desc: '微信小程序产物目录' },
  { name: 'dist-alipay', path: join(TARO_PKG, 'dist-alipay'), desc: '支付宝小程序产物目录' },
  { name: '.swc', path: join(TARO_PKG, '.swc'), desc: 'SWC 编译器缓存' },
  { name: '.turbo', path: join(TARO_PKG, '.turbo'), desc: 'Turborepo 缓存' },
]

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`
}

function dirSize(p) {
  // 简易递归大小统计(仅用于展示,实际删除由 rmSync recursive 完成)
  try {
    const { readdirSync } = require('node:fs') // eslint-disable-line @typescript-eslint/no-require-imports
    let total = 0
    const stack = [p]
    while (stack.length) {
      const cur = stack.pop()
      try {
        const st = statSync(cur)
        if (st.isFile()) total += st.size
        else if (st.isDirectory()) stack.push(...readdirSync(cur).map((n) => join(cur, n)))
      } catch {}
    }
    return total
  } catch {
    return 0
  }
}

console.log(
  `\n${C.cyan}🧹 MiniApp Taro 编译产物清理${dryRun ? ' (--dry-run 预览)' : ''}${C.reset}\n`,
)

let removedCount = 0
let totalBytes = 0
let skipCount = 0

for (const t of TARGETS) {
  if (!existsSync(t.path)) {
    console.log(`${C.dim}  ⏭  ${t.name.padEnd(14)} ${t.path}  (不存在,跳过)${C.reset}`)
    skipCount++
    continue
  }
  const size = dirSize(t.path)
  totalBytes += size
  if (dryRun) {
    console.log(
      `${C.yellow}  🔍 ${t.name.padEnd(14)} ${t.path}  (${fmtSize(size)},${t.desc})${C.reset}`,
    )
  } else {
    try {
      rmSync(t.path, { recursive: true, force: true })
      console.log(
        `${C.green}  ✅ ${t.name.padEnd(14)} ${t.path}  (已删除 ${fmtSize(size)})${C.reset}`,
      )
      removedCount++
    } catch (e) {
      console.error(`${C.red}  ❌ ${t.name} 删除失败: ${e.message}${C.reset}`)
      process.exit(1)
    }
  }
}

console.log(
  `\n${dryRun ? '🔍 预览完成' : '✨ 清理完成'}:${
    dryRun ? ` 将删除 ${TARGETS.length - skipCount} 个目录` : ` 删除 ${removedCount} 个目录`
  },释放 ${fmtSize(totalBytes)},跳过 ${skipCount} 个不存在路径\n`,
)
