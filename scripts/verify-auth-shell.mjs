#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-auth-shell.mjs — 已迁移到 verify-shared-auth.mjs (2026-07-26)
 *
 * 本脚本自 2026-07-26 起仅作为兼容层存在, 不再执行 7 项 AuthShell 守门检查。
 * 新的统一守门脚本 (覆盖 AuthShell 共享 7 项 + LoginForm 共享 4 项 = 11 项) 见:
 *
 *     node scripts/verify-shared-auth.mjs
 *
 * 迁移原因:
 *   2026-07-26 用户反馈"扩展端登录界面与 web 端视觉/功能不一致 (4 tab + 8 三方登录
 *   缺失, 为什么没共用)" → 需要把 AuthShell 共享 + LoginForm 共享两层静态守门合并
 *   到同一脚本, 接入 .husky/pre-commit (经 guardian-runner.mjs 第 31 项, warn-only)。
 *
 * 历史: 本脚本自 2026-07-26 起仅打印迁移提示 + exit 0, 不阻塞 commit。
 *       保留文件本身 (而非 hard delete) 是因为 AGENTS.md §7 删除安全规则要求:
 *       任何 git 对象 (文件/分支) 删除前必须确认 monorepo 内是否有等价实现 + 迁移替代。
 *       这里保留 shim 是为了不破坏任何外部脚本对 verify-auth-shell.mjs 的引用 +
 *       旧 commit 历史可追溯。
 */
console.log(
  `\x1b[36m[verify-auth-shell]\x1b[0m \x1b[1m此脚本已迁移到 \x1b[36mverify-shared-auth.mjs\x1b[0m\x1b[1m (2026-07-26 升级, 覆盖 AuthShell + LoginForm 共用, 共 11 项)\x1b[0m`,
)
console.log(
  `\x1b[2m  请运行: \x1b[0m\x1b[1mnode scripts/verify-shared-auth.mjs\x1b[0m`,
)
console.log(
  `\x1b[2m  接入位置: scripts/guardian-runner.mjs 第 31 项 (warn-only, .husky/pre-commit)\x1b[0m`,
)
console.log(
  `\x1b[32m[verify-auth-shell] ✅ 软迁移完成, exit 0 (不阻塞 commit)\x1b[0m`,
)
process.exit(0)
