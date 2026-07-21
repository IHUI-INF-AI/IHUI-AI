#!/usr/bin/env node
/**
 * i18n messages 修改后 dev server 重启提醒脚本 (2026-07-21 立)
 *
 * 根因:Next.js dev server 的 messages chunk 在 server 启动时被静态嵌入,
 * 修改 `apps/web/messages/*.json` 后浏览器拿到的是旧 chunk,导致
 * `useTranslations('auth')` 找不到新 key,直接渲染 `auth.xxx` i18n key 字符串。
 * 历史上 2026-07-21 协议通知窗事故就是这个原因。
 *
 * 检测:
 *  - staged 文件包含 `apps/web/messages/*.json` → 提醒"如 dev server 在跑,需重启加载新翻译"
 *  - 检测 3000 端口是否有 next-server 进程在跑(只有 dev server 在跑时,提示才相关)
 *  - warn-only(不阻塞 commit,只打印提醒)
 *
 * 用法:node scripts/check-messages-dev-restart.mjs [--staged]
 *
 * 输出:
 *  - 有 messages 改动 + dev server 在跑 → ⚠️ 提示 + 退出码 0 (warn-only)
 *  - 有 messages 改动 + dev server 没跑 → ✅ 跳过
 *  - 无 messages 改动 → ✅ 跳过
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const MESSAGES_DIR = join(root, 'apps/web/messages')
const WEB_PORT = 3000

// 1. 检测 staged 中是否有 messages JSON 改动
function getStagedMessagesFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf-8',
    })
    return out
      .split('\n')
      .filter((p) => p && p.startsWith('apps/web/messages/') && p.endsWith('.json'))
  } catch {
    return []
  }
}

// 2. 检测 dev server 是否在跑(端口 3000)
function isWebDevServerRunning() {
  // 跨平台:Windows 用 netstat,Unix 用 lsof
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${WEB_PORT} | findstr LISTENING`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return out.trim().length > 0
    } else {
      const out = execSync(`lsof -i :${WEB_PORT} -sTCP:LISTEN -P -n 2>/dev/null || true`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return out.trim().length > 0
    }
  } catch {
    return false
  }
}

function main() {
  if (!existsSync(MESSAGES_DIR)) {
    console.log('[messages-dev-restart] messages 目录不存在,跳过')
    return
  }

  const staged = getStagedMessagesFiles()
  if (staged.length === 0) {
    console.log('[messages-dev-restart] 无 messages JSON 改动,跳过')
    return
  }

  console.log(`[messages-dev-restart] 检测到 ${staged.length} 个 messages JSON 改动:`)
  for (const f of staged) console.log(`  - ${f}`)

  if (!isWebDevServerRunning()) {
    console.log('[messages-dev-restart] dev server 未在跑,无需重启')
    return
  }

  console.log('')
  console.log('⚠️  ⚠️  ⚠️  Next.js dev server 已在跑,需要重启加载新翻译 ⚠️  ⚠️  ⚠️')
  console.log('')
  console.log('  根因:Next.js dev 模式 messages chunk 在 server 启动时静态嵌入,')
  console.log('       HMR 不会重新编译 messages JSON,浏览器拿到的是旧 chunk。')
  console.log('       表现:useTranslations("auth") 找不到新 key,直接渲染 i18n key 字符串。')
  console.log('')
  console.log('  修复方法(任选一种):')
  console.log('  1) 重启 web dev server:')
  console.log('     pnpm --filter @ihui/web dev')
  console.log('  2) 在 TRAE 终端面板先 Ctrl+C 杀掉旧 next-server,再重新 dev')
  console.log('')
  console.log('  历史教训:2026-07-21 协议通知窗曾因 i18n chunk 缓存导致')
  console.log('           auth.agreementNotice* 键直接渲染,见 PROJECT_PLAN.md。')
  console.log('')
  console.log('  本检查为 warn-only,不阻塞 commit。')
}

main()
