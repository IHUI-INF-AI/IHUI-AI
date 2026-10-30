// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 可用模型清单点查脚本(2026-10-27 立;CLI 桥通路)。
 *
 * 调 listQoderModels(spawn 本机 Qoder CLI `--list-models`,取证:
 * docs/RELAY_QODER_LISTMODELS_EVIDENCE.md —— 上游无 models HTTP 端点,CLI 是
 * 唯一客户端同源通路)。人读输出 official/custom 分组;custom 模型的 id 被 CLI
 * 写死截断(末尾 …,完整 id 无一手来源),转发请用名称或 auto。
 *
 * 清单语义 = 本机 CLI 登录态的当前用户(不是号池任意账号),scope 如实标注。
 *
 * 用法(先进入 apps/api):
 *   pnpm exec tsx scripts/relay-qoder-models.ts
 *   可选:--cli <qoderclicn.exe 路径> / --timeout <毫秒,默认 30000>
 *
 * 退出码:0 成功 / 1 失败(CLI 缺失/非零退出/超时/解析为空,如实打印 error)。
 */
import {
  resolveQoderModelsCliPath,
  listQoderModels,
} from '../src/services/upstream-adapters/qoder-models.js'

// 带值旗标取值口径(G-322):紧邻 token 必须非空且不以 `-` 开头(与
// relay-workbuddy-models.ts 的本地副本逐字同源,语义变更须两处同改)。
function isFlagValueToken(token: unknown): boolean {
  return typeof token === 'string' && token !== '' && !token.startsWith('-')
}

function parseArgs(argv: string[]): { cli: string | null; timeoutMs: number | null } {
  let cli: string | null = null
  let timeoutMs: number | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--cli') {
      const tok = argv[i + 1]
      if (!isFlagValueToken(tok)) {
        process.stderr.write(
          `--cli 需要一个 CLI 路径 —— 紧邻的 token 实得:${tok === undefined ? '(其后没有任何参数)' : JSON.stringify(tok)}(不得吞掉相邻旗标)\n`,
        )
        process.exit(2)
      }
      cli = tok
      i++
    } else if (a === '--timeout') {
      const tok = argv[i + 1]
      if (!isFlagValueToken(tok)) {
        process.stderr.write(
          `--timeout 需要一个毫秒数 —— 紧邻的 token 实得:${tok === undefined ? '(其后没有任何参数)' : JSON.stringify(tok)}(不得吞掉相邻旗标)\n`,
        )
        process.exit(2)
      }
      const n = Number(tok)
      if (!Number.isFinite(n) || n <= 0) {
        process.stderr.write(`--timeout 需要正数毫秒,实得:${tok}\n`)
        process.exit(2)
      }
      timeoutMs = Math.trunc(n)
      i++
    } else if (a === '--help' || a === '-h') {
      process.stdout.write(
        '用法: tsx scripts/relay-qoder-models.ts [--cli <qoderclicn.exe 路径>] [--timeout <毫秒>]\n',
      )
      process.exit(0)
    } else {
      process.stderr.write(`未知参数: ${a}\n`)
      process.exit(2)
    }
  }
  return { cli, timeoutMs }
}

function main(): number {
  const opts = parseArgs(process.argv.slice(2))
  const result = listQoderModels({
    cliPath: opts.cli ?? undefined,
    timeoutMs: opts.timeoutMs ?? undefined,
  })
  if (!result.ok) {
    process.stderr.write(`❌ ${result.error}\n`)
    return 1
  }
  const lines: string[] = []
  lines.push(`Qoder 可用模型清单(scope=${result.scope},source=${result.source})`)
  lines.push('注:清单语义 = 本机 CLI 登录态的当前用户,不是号池任意账号。')
  lines.push('')
  if (result.auto) {
    lines.push('[auto]')
    lines.push('  auto(自动路由)')
    lines.push('')
  }
  lines.push(`[official] 共 ${result.official.length} 个`)
  for (const name of result.official) lines.push(`  ${name}`)
  lines.push('')
  lines.push(`[custom] 共 ${result.custom.length} 个`)
  if (result.custom.length === 0) {
    lines.push('  (无自定义模型)')
  } else {
    for (const c of result.custom) {
      lines.push(`  ${c.name}`)
      lines.push(`    id 前缀: ${c.idPrefix}`)
      lines.push('    注:ID 截断(CLI 显示上限),转发请用名称或 auto')
    }
  }
  process.stdout.write(`${lines.join('\n')}\n`)
  return 0
}

process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
