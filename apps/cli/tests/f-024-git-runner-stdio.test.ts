// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-024 回归:`execGitCapped` 的 stdio 必须与仓库自家约定一致。
 *
 * 修前 `resolveGitSpawnOptions()` 给的是 `stdio: 'pipe'`(三管全开),而 `tools/git-shared.ts`
 * 明确用 `['ignore','pipe','pipe']` 规避 Windows 病会话下 spawnSync 建 stdin 管道的 EBUSY ——
 * 表现是安装/status 间歇随机失败。
 *
 * 判据(不是"读了一眼源码"):
 *   - 派生的**实参**必须带该 stdio 三元组(同步走 execFileSync、异步走 execFile);
 *   - stdin 一律 `ignore`,但 stdout/stderr 必须仍是 `pipe` —— 只把 stdin 改掉,
 *     输出采集与 maxBuffer 封顶不能一起丢;
 *   - 两条腿都必须把子进程输出原样交回调用方(采集没被忽略档吃掉)。
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type * as ChildProcessModule from 'node:child_process'
import { execFile, execFileSync } from 'node:child_process'
import { execGitCapped, execGitCappedAsync, resolveGitSpawnOptions } from '../src/plugins/git-runner.js'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>()
  return { ...actual, execFileSync: vi.fn(), execFile: vi.fn() }
})

/** 仓库统一口径:不喂 stdin ⇒ stdin=ignore,stdout/stderr 仍收 */
const EXPECTED_STDIO = ['ignore', 'pipe', 'pipe']

const execFileSyncMock = execFileSync as unknown as Mock
const execFileMock = execFile as unknown as Mock

beforeEach(() => {
  vi.clearAllMocks()
})

describe('F-024 派生的 stdio 口径', () => {
  it('resolveGitSpawnOptions 解析出的 stdio 是 [ignore, pipe, pipe],而不再是三管全开的 pipe', () => {
    const resolved = resolveGitSpawnOptions()
    expect(resolved.stdio).toEqual(EXPECTED_STDIO)
  })

  it('同步腿:execFileSync 实参带该 stdio,且 stdout 仍被交回(采集没丢)', () => {
    execFileSyncMock.mockReturnValue('ok-sync\n')
    const out = execGitCapped(['status', '--porcelain'], { binary: 'git', cwd: '/repo' })
    expect(out).toBe('ok-sync\n')

    const opts = execFileSyncMock.mock.calls[0]?.[2] as
      | { stdio?: string[]; encoding?: string; windowsHide?: boolean }
      | undefined
    expect(opts?.stdio).toEqual(EXPECTED_STDIO)
    // 只改 stdin:stdout/stderr 若非 pipe,输出采集与 maxBuffer 封顶就一起失效了
    expect(opts?.stdio?.[1]).toBe('pipe')
    expect(opts?.stdio?.[2]).toBe('pipe')
    expect(opts?.encoding).toBe('utf8')
    expect(opts?.windowsHide).toBe(true)
  })

  it('异步腿:execFile 实参带该 stdio(不显式给时 Node 默认三管全开),且 stdout 仍被交回', async () => {
    execFileMock.mockImplementation(((
      _file: string,
      _args: readonly string[],
      _opts: unknown,
      cb: (err: unknown, stdout: string, stderr: string) => void,
    ) => {
      cb(null, 'ok-async\n', '')
      return { pid: 1 }
    }) as unknown as typeof execFile)

    const out = await execGitCappedAsync(['rev-parse', 'HEAD'], { binary: 'git', cwd: '/repo' })
    expect(out).toBe('ok-async\n')

    const opts = execFileMock.mock.calls[0]?.[2] as
      | { stdio?: string[]; windowsHide?: boolean }
      | undefined
    expect(opts?.stdio).toEqual(EXPECTED_STDIO)
    expect(opts?.stdio?.[1]).toBe('pipe')
    expect(opts?.stdio?.[2]).toBe('pipe')
    // windowsHide 是硬约束,改 stdio 不得把它弄丢(AGENTS §5b:缺它 = 用户桌面反复弹窗)
    expect(opts?.windowsHide).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
