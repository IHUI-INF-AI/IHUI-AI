#!/usr/bin/env node
/**
 * 清理 vite 临时缓存(2026-08-06 根治 .vite-temp 污染)
 *
 * 背景:vite 的 loadConfigFromBundledFile 把转译后的 TS 配置写入
 *   <node_modules>/.vite-temp/*.mjs,进程被中断时 unlink 不执行 → 残留损坏文件
 *   → 全量 vitest 偶发解析失败(空输出/假失败)。
 *
 * 根治组合:
 *   1. vitest.config.ts fileParallelism=false(测试串行,单 worker 写缓存,源头杜绝并发冲突)
 *   2. 本脚本在 vitest 每次运行前清掉残留(防御性,防上一次中断的脏数据)
 *
 * 用法: node scripts/clean-vite-temp.mjs
 */
import { rmSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// apps/web 目录(脚本在 apps/web/scripts/ 下)
const webRoot = resolve(here, '..')

// 候选路径:apps/web/node_modules/.vite-temp 与 monorepo 根 node_modules/.vite-temp
const candidates = [
  resolve(webRoot, 'node_modules/.vite-temp'),
  resolve(webRoot, '../../node_modules/.vite-temp'),
]

let cleaned = 0
for (const dir of candidates) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
    console.log(`[clean-vite-temp] removed ${dir}`)
    cleaned++
  }
}

if (cleaned === 0) {
  console.log('[clean-vite-temp] no .vite-temp found (clean)')
}
