// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

import { applyUpdateAndRestart } from '../src/commands/update.js'
import { RestartCoordinator } from '../src/daemon/graceful-restart.js'
import {
  handoffFromInstall,
  installNpmPlan,
  planNpmInstall,
  type NpmInstallPlan,
  type NpmInstallResult,
} from '../src/update-installer.js'

function fakeChild(): EventEmitter & {
  stdout: PassThrough
  stderr: PassThrough
  kill: () => void
} {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough
    stderr: PassThrough
    kill: () => void
  }
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.kill = vi.fn()
  return child
}

describe('B4-05 更新 apply → 优雅重启', () => {
  it('只有严格更高的三段版本才生成安装计划', () => {
    expect(planNpmInstall({ currentVersion: '1.0.0', latestVersion: '1.0.1' })).toMatchObject({
      disposition: 'install',
      reason: 'install',
      args: ['install', '-g', 'ihui-cli@1.0.1'],
    })
    expect(planNpmInstall({ currentVersion: '1.0.0', latestVersion: '1.0.0' })).toMatchObject({
      disposition: 'refused',
      reason: 'no-update',
    })
    expect(planNpmInstall({ currentVersion: '1.0.1', latestVersion: '1.0.0' })).toMatchObject({
      disposition: 'refused',
      reason: 'current-not-older',
    })
    expect(planNpmInstall({ currentVersion: '1.0.0', latestVersion: '1.0.0-beta' })).toMatchObject({
      disposition: 'unjudged',
      reason: 'version-unparsed',
    })
  })

  it('真实 spawn 参数数组无 shell 拼接，exit 0 才算 installed', async () => {
    const plan = planNpmInstall({ currentVersion: '1.0.0', latestVersion: '1.0.1' })
    const calls: unknown[] = []
    const child = fakeChild()
    const result = await installNpmPlan(plan, {
      platform: 'win32',
      timeoutMs: 1000,
      spawn: ((command: string, args: readonly string[], options: unknown) => {
        calls.push({ command, args, options })
        setTimeout(() => child.emit('close', 0), 10)
        return child
      }) as never,
    })
    expect(calls[0]).toMatchObject({
      command: 'npm.cmd',
      args: ['install', '-g', 'ihui-cli@1.0.1'],
      options: { shell: true, windowsHide: true },
    })
    expect(result).toMatchObject({ disposition: 'install', reason: 'installed', exitCode: 0 })
    expect(handoffFromInstall(result)).toMatchObject({
      disposition: 'apply',
      action: 'apply',
      reason: 'install-verified',
    })
  })

  it('安装失败不排重启', async () => {
    const plan: NpmInstallPlan = {
      disposition: 'install',
      reason: 'install',
      packageName: 'ihui-cli',
      version: '1.0.1',
      command: 'npm.cmd',
      args: ['install', '-g', 'ihui-cli@1.0.1'],
    }
    const install = async (): Promise<NpmInstallResult> => ({
      disposition: 'refused',
      reason: 'exit-nonzero',
      command: plan.command,
      args: plan.args,
      exitCode: 1,
      stdout: '',
      stderr: 'boom',
    })
    const outcome = await applyUpdateAndRestart(plan, { install, skipRestart: false })
    expect(outcome.handoff).toMatchObject({ disposition: 'refused', action: 'stay', reason: 'install-failed' })
    expect(outcome.restart).toBeNull()
  })

  it('安装成功后真的拉起新进程并由旧进程退出', async () => {
    const plan: NpmInstallPlan = {
      disposition: 'install',
      reason: 'install',
      packageName: 'ihui-cli',
      version: '1.0.1',
      command: 'npm.cmd',
      args: ['install', '-g', 'ihui-cli@1.0.1'],
    }
    const install = async (): Promise<NpmInstallResult> => ({
      disposition: 'install',
      reason: 'installed',
      command: plan.command,
      args: plan.args,
      exitCode: 0,
      stdout: '',
      stderr: '',
    })
    const spawned: Array<{ command: string; args: readonly string[]; options: unknown }> = []
    const exit = vi.fn()
    const coordinator = new RestartCoordinator()
    const outcome = await applyUpdateAndRestart(plan, {
      install,
      coordinator,
      restartDeps: {
        spawn: ((command: string, args: readonly string[], options: unknown) => {
          spawned.push({ command, args, options })
          const child = new EventEmitter()
          setTimeout(() => child.emit('spawn'), 0)
          return child
        }) as never,
        exit,
        argv: ['/opt/ihui/dist/index.js'],
      },
    })
    expect(outcome.restart).toMatchObject({ action: 'spawned' })
    expect(spawned[0].args).toEqual(['/opt/ihui/dist/index.js'])
    expect(spawned[0].options).toMatchObject({ detached: true, stdio: 'ignore', windowsHide: true })
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('skipRestart 只交付安装与交接，不拉起进程', async () => {
    const plan = planNpmInstall({ currentVersion: '1.0.0', latestVersion: '1.0.1' })
    const install = async (): Promise<NpmInstallResult> => ({
      disposition: 'install',
      reason: 'installed',
      command: plan.command,
      args: plan.args,
      exitCode: 0,
      stdout: '',
      stderr: '',
    })
    const outcome = await applyUpdateAndRestart(plan, { install, skipRestart: true })
    expect(outcome.handoff.reason).toBe('install-verified')
    expect(outcome.restart).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
