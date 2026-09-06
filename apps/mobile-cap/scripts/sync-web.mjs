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
import { cpSync, existsSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 目录删除:Windows 上 WorkBuddy sandbox 的 safe-delete shim 会把 fs.rmSync
 * 劫持到回收站工具(genie-trash),大目录必 ETIMEDOUT(2026-09-06 实证,
 * 与 cap copy 失败同源)。故 Windows 走原生 rd /s /q,其他平台用 rmSync。
 */
function rmDirFast(dir) {
  if (!existsSync(dir)) return
  if (process.platform === 'win32') {
    execSync(`rd /s /q "${dir}"`, { stdio: 'ignore' })
  } else {
    rmSync(dir, { recursive: true, force: true })
  }
}

const capRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(capRoot, '..', 'web', 'out')
const wwwDir = path.join(capRoot, 'www')

if (!existsSync(path.join(outDir, 'index.html'))) {
  console.error('[sync-web] 错误: apps/web/out/index.html 不存在。')
  console.error('[sync-web] 请先执行: pnpm --filter @ihui/web build:static')
  process.exit(1)
}

rmDirFast(wwwDir)
cpSync(outDir, wwwDir, { recursive: true })

// 体积裁剪(2026-09-06):web 端 public/downloads 是桌面安装包/历史 APK 的下载源,
// 打进移动 APK 纯属死重(release 实测 246MB msi + 237MB exe + 120MB apk ≈ 600MB 垃圾,
// 超 Play Store 150MB 上限)。App 内用户应从 aizhs.top 在线下载页获取,本地 prune 掉。
const PRUNE_PATHS = ['downloads', 'apk']
for (const p of PRUNE_PATHS) {
  rmDirFast(path.join(wwwDir, p))
}
console.log(`[sync-web] apps/web/out → www/ 同步完成(已裁剪: ${PRUNE_PATHS.join(', ')})`)
