#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 同步 apps/web 静态导出产物 → www/(Capacitor webDir)。
 *
 * 前置:apps/web 已执行 pnpm --filter @ihui/web build:static(产出 out/)。
 * 本脚本只做纯复制,不触发构建;缺失 out/ 时直接报错退出,
 * 防止把陈旧/空目录打进 APK(与 build-static.mjs 的"拒绝陈旧产物"策略一致)。
 */
import { cpSync, existsSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const capRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(capRoot, '..', 'web', 'out')
const wwwDir = path.join(capRoot, 'www')

if (!existsSync(path.join(outDir, 'index.html'))) {
  console.error('[sync-web] 错误: apps/web/out/index.html 不存在。')
  console.error('[sync-web] 请先执行: pnpm --filter @ihui/web build:static')
  process.exit(1)
}

rmSync(wwwDir, { recursive: true, force: true })
cpSync(outDir, wwwDir, { recursive: true })
console.log('[sync-web] apps/web/out → www/ 同步完成')
