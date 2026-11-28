// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui mcp discover <domain-or-url>` — AI Catalog 的用户入口。
 *
 * 库里 `discoverMcpServerCards()` 早已能拉 `.well-known/ai-catalog.json` 并逐条验卡，
 * 但此前没有任何 CLI 面，等于能力只对内部调用方存在。本命令只做「发现 + 打印」：
 *   · 不写配置、不建连接，避免把一次探测变成隐式安装；
 *   · `--json` 输出与库返回同构，方便脚本接管；
 *   · catalog 拉取失败退 1；目录合法但零卡片退 0（空目录是合法状态，不是错误）。
 */

import type { Command } from 'commander'
import chalk from 'chalk'

import { t } from '../i18n/index.js'
import { printJson } from './http-utils.js'
import {
  discoverMcpServerCards,
  type DiscoverMcpServerCardsResult,
} from '../tools/mcp-server-card.js'

/** 单次最多验几张卡：防止一个超大目录把 CLI 拖成批量抓取器。 */
export const MCP_DISCOVER_MAX_CARDS_LIMIT = 100

/** 解析 `--max-cards`；非法值在发请求前就拒，避免"先抓一半再报错"。 */
export function parseMcpDiscoverMaxCards(raw: string | undefined): number {
  if (raw === undefined) return 10
  if (!/^\d+$/.test(raw)) throw new Error(t('cliEntry.mcpDiscoverMaxCardsInvalid'))
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0 || value > MCP_DISCOVER_MAX_CARDS_LIMIT) {
    throw new Error(t('cliEntry.mcpDiscoverMaxCardsInvalid'))
  }
  return value
}

/** 人类可读行；纯函数便于单测，不着色（着色留给 action）。 */
export function formatMcpDiscovery(result: DiscoverMcpServerCardsResult): string[] {
  const lines: string[] = [t('cliEntry.mcpDiscoverCatalog', { url: result.catalogUrl })]
  if (!result.catalogOk) {
    for (const error of result.errors) {
      lines.push(t('cliEntry.mcpDiscoverCatalogError', { error }))
    }
    return lines
  }
  for (const error of result.errors) {
    lines.push(t('cliEntry.mcpDiscoverCatalogError', { error }))
  }
  if (result.cards.length === 0) {
    lines.push(t('cliEntry.mcpDiscoverEmpty'))
    return lines
  }
  lines.push(t('cliEntry.mcpDiscoverHeader', { count: result.cards.length }))
  for (const entry of result.cards) {
    if (entry.ok && entry.card) {
      lines.push(
        t('cliEntry.mcpDiscoverCard', {
          identifier: entry.identifier,
          name: entry.card.name,
          version: entry.card.version,
        }),
      )
      if (entry.card.description) {
        lines.push(t('cliEntry.mcpDiscoverCardDesc', { description: entry.card.description }))
      }
      continue
    }
    lines.push(
      t('cliEntry.mcpDiscoverCardError', {
        identifier: entry.identifier,
        error: entry.errors.join('; ') || 'invalid server card',
      }),
    )
  }
  return lines
}

/** 注册 `mcp discover`；挂在既有 `mcp` 命令组下，不新开顶层命名。 */
export function registerMcpDiscoverCommand(parent: Command): void {
  parent
    .command('discover <target>')
    .description(t('cliEntry.mcpDiscoverDesc'))
    .option('--json', t('cliEntry.mcpDiscoverJsonDesc'))
    .option('--max-cards <n>', t('cliEntry.mcpDiscoverMaxCardsDesc'))
    .action(async (target: string, options: { json?: boolean; maxCards?: string }) => {
      try {
        const maxCards = parseMcpDiscoverMaxCards(options.maxCards)
        const result = await discoverMcpServerCards(target, { maxCards })
        if (options.json) {
          printJson(result)
          if (!result.catalogOk) process.exitCode = 1
          return
        }
        const lines = formatMcpDiscovery(result)
        for (const line of lines) {
          // 只给失败行上色；成功行保持可直接管道给 grep 的纯文本。
          if (line.startsWith('✗') || !result.catalogOk) {
            console.error(chalk.red(line))
          } else {
            console.info(line)
          }
        }
        if (!result.catalogOk) process.exitCode = 1
      } catch (err) {
        console.error(
          chalk.red(
            t('cliEntry.mcpDiscoverError', {
              error: err instanceof Error ? err.message : String(err),
            }),
          ),
        )
        process.exitCode = 1
      }
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
