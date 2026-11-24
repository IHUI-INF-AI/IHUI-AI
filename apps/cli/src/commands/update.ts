// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Command } from 'commander'

import { checkForUpdates, getCurrentVersion, type UpdateHandoffPlan } from '../updater.js'
import {
  handoffFromInstall,
  installNpmPlan,
  planNpmInstall,
  type NpmInstallPlan,
  type NpmInstallResult,
} from '../update-installer.js'
import { RestartCoordinator, type RestartAttemptResult, type RestartDeps } from '../daemon/graceful-restart.js'

export interface ApplyUpdateDeps {
  install?: (plan: NpmInstallPlan) => Promise<NpmInstallResult>
  coordinator?: RestartCoordinator
  restartDeps?: RestartDeps
  skipRestart?: boolean
  /** 旧进程退出前打印最终交接结果；只在重启已确认 spawn 时调用。 */
  beforeExit?: (outcome: Pick<ApplyUpdateOutcome, 'install' | 'handoff'>) => void
}

export interface ApplyUpdateOutcome {
  install: NpmInstallResult
  handoff: UpdateHandoffPlan
  restart: RestartAttemptResult | null
}

/**
 * 安装成功 → 交接计划 → 优雅重启的唯一生产编排。
 * 失败/超时在 `handoffFromInstall` 就落成 stay，`RestartCoordinator` 不放行。
 */
export async function applyUpdateAndRestart(
  plan: NpmInstallPlan,
  deps: ApplyUpdateDeps = {},
): Promise<ApplyUpdateOutcome> {
  const install = deps.install ?? ((p: NpmInstallPlan) => installNpmPlan(p))
  const result = await install(plan)
  const handoff = handoffFromInstall(result)
  if (deps.skipRestart || handoff.action !== 'apply') return { install: result, handoff, restart: null }
  const coordinator = deps.coordinator ?? new RestartCoordinator()
  coordinator.requestAfterUpdate(handoff, plan.version)
  const restart = await coordinator.begin(0, {
    ...deps.restartDeps,
    argv: deps.restartDeps?.argv ?? (process.argv[1] ? [process.argv[1]] : []),
    beforeExit: deps.beforeExit
      ? () => deps.beforeExit?.({ install: result, handoff })
      : undefined,
  })
  return { install: result, handoff, restart }
}

export function registerUpdateCommand(program: Command): void {
  const update = program.command('update').description('检查并安装 CLI 更新（安装成功后优雅重启）')

  update
    .command('check')
    .description('检查 registry 是否有新版本')
    .option('--json', '输出原始 JSON')
    .action(async (opts: { json?: boolean }) => {
      const result = await checkForUpdates('ihui-cli', { forceRefresh: true })
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
        return
      }
      process.stdout.write(
        `current=${result.currentVersion} latest=${result.latestVersion ?? 'unknown'} ` +
          `updateStatus=${result.updateStatus}\n`,
      )
    })

  update
    .command('apply')
    .description('安装最新版并在成功后优雅重启')
    .option('--yes', '确认执行真实安装')
    .option('--target-version <version>', '指定目标版本（默认取 registry 最新版）')
    .option('--dry-run', '只打印安装计划，不执行')
    .option('--no-restart', '安装成功后不重启')
    .action(
      async (opts: { yes?: boolean; targetVersion?: string; dryRun?: boolean; restart?: boolean }) => {
        let latest = opts.targetVersion
        if (!latest) {
          const checked = await checkForUpdates('ihui-cli', { forceRefresh: true })
          if (checked.updateStatus !== 'available' || !checked.latestVersion) {
            process.stdout.write(
              `no update: current=${checked.currentVersion} latest=${checked.latestVersion ?? 'unknown'} ` +
                `status=${checked.updateStatus}\n`,
            )
            return
          }
          latest = checked.latestVersion
        }
        const plan = planNpmInstall({ currentVersion: getCurrentVersion(), latestVersion: latest })
        if (plan.disposition !== 'install') {
          process.stdout.write(`update refused: ${plan.disposition}/${plan.reason}\n`)
          return
        }
        if (opts.dryRun) {
          process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
          return
        }
        if (!opts.yes) throw new Error('真实安装需要 --yes 确认')
        const format = (outcome: ApplyUpdateOutcome) =>
          `install=${outcome.install.disposition}/${outcome.install.reason} ` +
          `handoff=${outcome.handoff.disposition}/${outcome.handoff.reason} ` +
          `restart=${outcome.restart?.action ?? 'none'}`
        const outcome = await applyUpdateAndRestart(plan, {
          skipRestart: opts.restart === false,
          beforeExit: ({ install, handoff }) => {
            process.stdout.write(`${format({ install, handoff, restart: { action: 'spawned', detail: 'before-exit' } })}\n`)
          },
        })
        process.stdout.write(`${format(outcome)}\n`)
        if (outcome.install.reason !== 'installed') process.exitCode = 1
      },
    )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
