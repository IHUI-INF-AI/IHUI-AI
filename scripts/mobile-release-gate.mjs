#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-rn 出包前置门链(2026-11-03 立,唯一实现)。
 *
 * 立因(现读,非推测):`scripts/build-mobile-rn-release.ps1` 与
 * `.github/workflows/mobile-apk-build.yml` 都直接跑 gradle 打包,而
 * `scripts/check-mobile-version-code.mjs` 在所有 workflow 里零引用、typecheck / RN 测试
 * 也不在出包路径上 —— 「门是绿的」与「发出去的包是那套门判过的」之间没有绑定关系。
 * 本脚本把这条链收成一份实现,本地脚本与 CI 都调它,避免两处清单各自漂移。
 *
 * 门链(顺序固定,任一非零即中止,不产出可交付产物):
 *   1. typecheck      `pnpm --filter "@ihui/mobile-rn..." run typecheck`(RN 依赖闭包全量 TS;
 *                     不跑全仓 turbo typecheck —— web/api 的 TS 错误与这个包无关,拿它掐手机出包是假耦合)
 *   2. rn-tests       `pnpm --filter "@ihui/mobile-rn..." run test`(RN 闭包测试)
 *   3. version-code   `node scripts/check-mobile-version-code.mjs`
 *   4. base-bake      `node scripts/check-mobile-api-base-bake.mjs`
 *
 * 失败信息点名是哪道门 + 退出码;exit 2 是「未判定」,同样按失败处理(不记绿)。
 *
 * 用法:
 *   node scripts/mobile-release-gate.mjs            # CI:HEAD 面(干净 checkout)
 *   node scripts/mobile-release-gate.mjs --worktree # 本地出包:工作树面(将要构建的那份)
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const GATE = 'mobile-release-gate'

/**
 * 纯函数:构造门链。本地传 worktree ⇒ 版本号/基址两道门审「将要构建的那份」;
 * CI 保持缺省 HEAD 面(clean checkout 下两面相同,但口径不混用)。
 */
export function planGates({ face = 'head' } = {}) {
  const faceArgs = face === 'worktree' ? ['--worktree'] : []
  return [
    {
      id: 'typecheck',
      name: 'mobile-rn dependency closure typecheck',
      cmd: 'pnpm',
      args: ['--filter', '@ihui/mobile-rn...', 'run', 'typecheck'],
    },
    {
      id: 'rn-tests',
      name: 'mobile-rn dependency closure tests',
      cmd: 'pnpm',
      args: ['--filter', '@ihui/mobile-rn...', 'run', 'test'],
    },
    {
      id: 'version-code',
      name: 'mobile versionCode gate',
      cmd: 'node',
      args: ['scripts/check-mobile-version-code.mjs', ...faceArgs],
    },
    {
      id: 'base-bake',
      name: 'mobile API base bake gate',
      cmd: 'node',
      args: ['scripts/check-mobile-api-base-bake.mjs', ...faceArgs],
    },
  ]
}

function runGate(g) {
  const opts = { cwd: ROOT, stdio: 'inherit', windowsHide: true, env: process.env }
  const r =
    g.cmd === 'node'
      ? spawnSync(process.execPath, g.args, opts)
      : spawnSync(g.cmd, g.args, { ...opts, shell: true })
  return r.status === null ? -1 : r.status
}

function main() {
  const argv = process.argv.slice(2)
  const face = argv.includes('--worktree') ? 'worktree' : 'head'
  if (argv.includes('--help')) {
    console.info('用法:node scripts/mobile-release-gate.mjs [--worktree]')
    return 0
  }
  const gates = planGates({ face })
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i]
    const n = `${i + 1}/${gates.length}`
    console.info(`\n[${GATE}] ${n} ${g.id} (${g.name}) —— ${g.cmd} ${g.args.join(' ')}`)
    const code = runGate(g)
    if (code !== 0) {
      const why = code === 2 ? '未判定(exit 2,按失败处理)' : code < 0 ? '进程启动失败/被环境终止' : `exit ${code}`
      console.error(`[${GATE}] ❌ 门失败:${g.id} (${g.name}) ${why} —— 出包中止,不产出可发布产物`)
      return code === 2 || code < 0 ? 1 : code
    }
    console.info(`[${GATE}] ✅ ${n} ${g.id} 通过`)
  }
  console.info(`\n[${GATE}] ✅ 门链全部通过(${gates.length}/${gates.length},取材面:${face})`)
  return 0
}

// §22d
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main())

export const __test__ = { planGates, GATE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
