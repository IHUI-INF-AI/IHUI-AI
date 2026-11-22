// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  WORKER_ENV_ALLOWED_KEYS,
  WORKER_ENV_BLOCKED_KEYS,
  WORKER_GIT_ENV,
  WorkerGitConfigRejectedError,
  assertWorkerGitConfigSafe,
  buildWorkerDispatchEnv,
  type GitConfigProbe,
} from '../worker-dispatch-env.js'

function probeReturning(stdout: string, code = 0, stderr = ''): GitConfigProbe {
  return async () => ({ stdout, stderr, code })
}

describe('buildWorkerDispatchEnv', () => {
  it('只上行白名单键，并强制写死三道 git 隔离开关', () => {
    const env = buildWorkerDispatchEnv({
      PATH: '/usr/bin',
      HOME: '/home/worker',
      GH_TOKEN: 'ghp_secret',
      GITHUB_TOKEN: 'github_secret',
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_PARAMETERS: "'credential.helper'='store'",
      GIT_CONFIG_GLOBAL: '/tmp/evil-gitconfig',
      GIT_AUTHOR_NAME: 'spoofed',
      GIT_COMMITTER_EMAIL: 'spoofed@example.com',
      GIT_CONFIG_NOSYSTEM: '0',
      GIT_ASKPASS: '/tmp/askpass',
      GIT_TERMINAL_PROMPT: '1',
    })

    expect(Object.keys(env).sort()).toEqual([...WORKER_ENV_ALLOWED_KEYS].sort())
    expect(env).toEqual({ ...WORKER_GIT_ENV })
    for (const blocked of WORKER_ENV_BLOCKED_KEYS) {
      expect(env).not.toHaveProperty(blocked)
    }
    expect(JSON.stringify(env)).not.toContain('secret')
  })

  it('宿主没有相关变量时仍返回强制开关', () => {
    const env = buildWorkerDispatchEnv({})
    expect(env).toEqual({ ...WORKER_GIT_ENV })
    expect(env.GIT_CONFIG_NOSYSTEM).toBe('1')
    expect(env.GIT_ASKPASS).toBe('')
    expect(env.GIT_TERMINAL_PROMPT).toBe('0')
  })
})

describe('assertWorkerGitConfigSafe', () => {
  it('命中 credential.* 与 http.*extraheader 时拒绝启动，且只报告键名', async () => {
    const probe = probeReturning(
      [
        'user.name=worker',
        'credential.helper=store',
        'credential.http://example.com.provider=generic',
        'http.https://github.com/.extraheader=Authorization: Bearer TOPSECRET',
      ].join('\n'),
    )

    await expect(assertWorkerGitConfigSafe('/tmp/worker', probe)).rejects.toBeInstanceOf(
      WorkerGitConfigRejectedError,
    )
    const error = await assertWorkerGitConfigSafe('/tmp/worker', probe).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(WorkerGitConfigRejectedError)
    const message = (error as Error).message
    expect(message).toContain('credential.helper')
    expect(message).toContain('http.https://github.com/.extraheader')
    expect(message).not.toContain('TOPSECRET')
  })

  it('干净的本地配置放行', async () => {
    const probe = probeReturning('user.name=worker\nuser.email=worker@example.com\n')
    await expect(assertWorkerGitConfigSafe('/tmp/worker', probe)).resolves.toBeUndefined()
  })

  it.each([
    'fatal: not a git repository (or any of the parent directories): .git',
    'fatal: --local can only be used inside a git repository',
  ])('目标不是 git 仓库时视为无本地配置并放行（%s）', async (stderr) => {
    const probe = probeReturning('', 128, stderr)
    await expect(assertWorkerGitConfigSafe('/tmp/worker', probe)).resolves.toBeUndefined()
  })

  it('探针失败（非“非仓库”）时 fail-closed', async () => {
    const probe = probeReturning(
      '',
      128,
      'fatal: cannot change to /tmp/missing: No such file or directory',
    )
    await expect(assertWorkerGitConfigSafe('/tmp/missing', probe)).rejects.toThrow(/检查失败/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
