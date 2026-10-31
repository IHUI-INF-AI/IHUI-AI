// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sandbox/execute 容纳性单测(2026-10-31 安全强化第 10 批)。
 *
 * 修复前该端点对任意登录用户等价于"整台服务器凭据外传通道":
 *   ① workspacePath/cwd 全是客户端自报字符串,无登记根闸 ⇒ workspacePath="C:/"
 *      让白名单内的 cat/cp/tee 直指服务器任意文件;
 *   ② mode=danger-full-access 时 cleanEnv 回传全量 process.env ⇒ JWT_SECRET/
 *      DATABASE_URL/上游 API Key 整袋随 stdout 端走;
 *   ③ 路由缺 assertWorkspacePermission(同文件 /fs/run 有)。
 *
 * 钉住四条:根未登记 fail-closed / 路径越界拒绝 / cwd 单独过闸 / 敏感键任何
 * 模式不进子进程 env(带非敏感键正向对照,证明闸没有把整个 env 削空)。
 * 隔离:真实 mkdtemp 目录(既有先例同形态),不连 PG/Redis,零网络。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { sandboxExecutor } from '../src/services/workspace-ai-service.js'

let scratchRoot: string
let savedRootsEnv: string | undefined

beforeEach(() => {
  scratchRoot = mkdtempSync(join(tmpdir(), 'ihui-sbx-'))
  savedRootsEnv = process.env.IHUI_WORKSPACE_ROOTS
  process.env.IHUI_WORKSPACE_ROOTS = scratchRoot
})

afterEach(() => {
  if (savedRootsEnv === undefined) delete process.env.IHUI_WORKSPACE_ROOTS
  else process.env.IHUI_WORKSPACE_ROOTS = savedRootsEnv
  rmSync(scratchRoot, { recursive: true, force: true })
})

describe('sandbox/execute 登记根闸', () => {
  it('IHUI_WORKSPACE_ROOTS 未登记任何根 ⇒ fail-closed 一律拒绝', async () => {
    delete process.env.IHUI_WORKSPACE_ROOTS
    await expect(
      sandboxExecutor.execute({ command: 'node -p 1', workspacePath: scratchRoot }),
    ).rejects.toThrow(/未启用/)
  })

  it('workspacePath 在登记根外 ⇒ 拒绝', async () => {
    await expect(
      sandboxExecutor.execute({
        command: 'node -p 1',
        workspacePath: join(scratchRoot, '..'),
      }),
    ).rejects.toThrow(/未在服务端登记/)
  })

  it('cwd 在登记根外(workspacePath 合法)⇒ 单独过闸拒绝', async () => {
    await expect(
      sandboxExecutor.execute({
        command: 'node -p 1',
        workspacePath: scratchRoot,
        cwd: 'C:/',
      }),
    ).rejects.toThrow(/执行目录未在服务端登记/)
  })
})

describe('sandbox/execute 环境净化', () => {
  it('danger-full-access 模式下敏感键不进子进程 env,非敏感键照常传递(正向对照)', async () => {
    process.env.IHUI_SBX_SECRET_TEST = 'top-secret-value'
    process.env.IHUI_SBX_PLAIN_TEST = 'plain-ok'
    try {
      // danger-full-access 放行网络命令 ⇒ 用 node 直证 env 净化(修复前该模式回传全量 env)
      const result = await sandboxExecutor.execute({
        command: 'node -p process.env.IHUI_SBX_SECRET_TEST',
        workspacePath: scratchRoot,
        mode: 'danger-full-access',
      })
      expect(result.exitCode).toBe(0)
      expect(result.stdout).not.toContain('top-secret-value')
      expect(result.stdout).toContain('undefined')

      const plain = await sandboxExecutor.execute({
        command: 'node -p process.env.IHUI_SBX_PLAIN_TEST',
        workspacePath: scratchRoot,
      })
      expect(plain.exitCode).toBe(0)
      expect(plain.stdout).toContain('plain-ok')
    } finally {
      delete process.env.IHUI_SBX_SECRET_TEST
      delete process.env.IHUI_SBX_PLAIN_TEST
    }
  })

  it('workspace-write 模式在登记根内照常执行(闸不削合法能力)', async () => {
    const result = await sandboxExecutor.execute({
      command: 'node -p process.version',
      workspacePath: scratchRoot,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/^v\d/)
  })
})
