#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


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
 *  - 检测 8801 端口是否有 next-server 进程在跑(只有 dev server 在跑时,提示才相关)
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
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const MESSAGES_DIR = join(root, 'apps/web/messages')
const WEB_PORT = 8801

// 1. 检测 staged 中是否有 messages JSON 改动
function getStagedMessagesFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf-8',
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return out
      .split('\n')
      .filter((p) => p && p.startsWith('apps/web/messages/') && p.endsWith('.json'))
  } catch {
    return []
  }
}

// 2. 检测 dev server 是否在跑(端口 8801)
function isWebDevServerRunning() {
  // 跨平台:Windows 用 netstat,Unix 用 lsof
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${WEB_PORT} | findstr LISTENING`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      })
      return out.trim().length > 0
    } else {
      const out = execSync(`lsof -i :${WEB_PORT} -sTCP:LISTEN -P -n 2>/dev/null || true`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      })
      return out.trim().length > 0
    }
  } catch {
    return false
  }
}

async function main() {
  if (!existsSync(MESSAGES_DIR)) {
    console.log('[messages-dev-restart] messages 目录不存在,跳过')
    return 0
  }

  const staged = getStagedMessagesFiles()
  if (staged.length === 0) {
    console.log('[messages-dev-restart] 无 messages JSON 改动,跳过')
    return 0
  }

  console.log(`[messages-dev-restart] 检测到 ${staged.length} 个 messages JSON 改动:`)
  for (const f of staged) console.log(`  - ${f}`)

  if (!isWebDevServerRunning()) {
    console.log('[messages-dev-restart] dev server 未在跑,无需重启')
    return 0
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
  console.log('  2) 在 IDE 终端面板先 Ctrl+C 杀掉旧 next-server,再重新 dev')
  console.log('')
  console.log('  历史教训:2026-07-21 协议通知窗曾因 i18n chunk 缓存导致')
  console.log('           auth.agreementNotice* 键直接渲染,见 PROJECT_PLAN.md。')
  console.log('')
  console.log('  本检查为 warn-only,不阻塞 commit。')
  return 0
}

// ── §22d 双形态入口守卫(G-1058651)────────────────────────────────
// 改前本门顶层是裸 `main()`:任何 import 本门的进程都会在 import 期真的跑一遍
// existsSync + `git diff --cached` + netstat 探测并往 stdout 打印(实测 1 行输出)
// ⇒ 镜像测试拿不到判据,只能整族走黑盒 spawnSync,§22c 的"改调生产入口"结构性不可达。
// 现在:CLI 直跑才执行 main();被 import 时零副作用,判据单元经 __test__ 单点导出(§22c)。
// 必须经 pathToFileURL():Windows 下 process.argv[1] 带反斜杠,手拼 file:/// 永不相等。
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ check-messages-dev-restart 脚本异常:${e?.message ?? e}`)
      console.error(e?.stack ?? '(no stack)')
      process.exit(2) // 2 = 脚本自身异常,1 = 业务判定失败(§22b/§22d 档位约定)
    })
}

// §22c:判据单元经 __test__ 单点暴露给镜像测试
// (scripts/tests/check-messages-dev-restart.test.mjs),测试禁止再抄一份端口探测/端口号。
export const __test__ = {
  getStagedMessagesFiles,
  isWebDevServerRunning,
  MESSAGES_DIR,
  WEB_PORT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
