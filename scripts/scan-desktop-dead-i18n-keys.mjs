#!/usr/bin/env node
/**
 * desktop 端 i18n 死 key 审计器 — thin wrapper(2026-07-27 重构)
 *
 * 5 端独立脚本统一委托 scripts/scan-dead-i18n-keys.mjs --target=<端>,
 * 消除"一端一份"重复配置。本文件仅做参数转发,实际逻辑在统一入口。
 *
 * desktop 是 Rust/Tauri 包装,无 JS i18n 代码,messages 目录也未建立,
 * 统一入口会自动检测并跳过(exit 0,不输出报告)。
 *
 * 用法:
 *   node scripts/scan-desktop-dead-i18n-keys.mjs              # 等价 --target=desktop(自动跳过 exit 0)
 *   node scripts/scan-desktop-dead-i18n-keys.mjs --check       # 烟测模式
 *   node scripts/scan-desktop-dead-i18n-keys.mjs --dry-run    # 显式 dry-run
 *   node scripts/scan-desktop-dead-i18n-keys.mjs --out <path> # 自定义输出路径(若 messages 存在时生效)
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 路径推导用 import.meta.url(任务约束:不硬编码绝对路径)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const unifiedEntry = path.resolve(__dirname, 'scan-dead-i18n-keys.mjs')

const result = spawnSync(process.execPath, [unifiedEntry, '--target=desktop', ...process.argv.slice(2)], {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
