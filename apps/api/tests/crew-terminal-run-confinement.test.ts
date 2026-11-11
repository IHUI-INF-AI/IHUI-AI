// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * terminal_run 的**参数面**收敛(2026-11-01 安全强化)。
 *
 * 缺陷不是 shell 注入(2026-07-21 已改 execFile),而是"白名单只挑进程、不挑参数,
 * 且 execFile 不带 cwd":`cat`/`head`/`tail`/`find`/`grep` 全在合法进程清单里,而进程
 * 继承 API 的工作目录 = 仓库根,根里的 `.env` 装着数据库口令与各厂商模型密钥。
 * 于是任务文本里一句 `cat .env` 就是"命令合法、路径越权"的密钥外泄。
 *
 * 本文件钉三件事:①越界形态一律**根本不 spawn 进程**;②放行路径的 cwd 必须是沙箱根
 * (不是 process.cwd());③沙箱根拿不到时 terminal_run 停用,而不是回落仓库根。
 */
import { execFile } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

const execFileMock = vi.mocked(execFile)

/** 让 execFile 立刻以空输出收尾,只用于"确实走到了 spawn 那一步"的判定。 */
function stubExecFileOk() {
  execFileMock.mockImplementation(((
    _bin: string,
    _args: string[],
    opts: { cwd?: string },
    cb: (err: null, stdout: string, stderr: string) => void,
  ) => {
    spawnCalls.push({ bin: _bin, args: _args, cwd: opts?.cwd })
    cb(null, '', '')
    return undefined as never
  }) as never)
}

const spawnCalls: Array<{ bin: string; args: string[]; cwd?: string }> = []

let sandboxRoot = ''
const previousSandboxEnv = process.env.CREW_SANDBOX_ROOT

async function runTerminal(command: string) {
  const { executeCrewTool } = await import('../src/services/crew-tools.js')
  return (await executeCrewTool('terminal_run', { command })) as {
    success: boolean
    error?: string
  }
}

beforeEach(() => {
  spawnCalls.length = 0
  sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-crew-sandbox-test-'))
  process.env.CREW_SANDBOX_ROOT = sandboxRoot
  stubExecFileOk()
})

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  if (previousSandboxEnv === undefined) delete process.env.CREW_SANDBOX_ROOT
  else process.env.CREW_SANDBOX_ROOT = previousSandboxEnv
  fs.rmSync(sandboxRoot, { recursive: true, force: true })
})

describe('terminal_run 参数不得越出沙箱根', () => {
  it.each([
    ['cat .env', '点文件(密钥落点)'],
    ['cat /etc/passwd', '绝对路径'],
    ['cat ../../windows/win.ini', '逐级逃逸'],
    ['head --file=../.ssh/id_rsa x', '旗标值里焊路径'],
    ['find / -name secret', '根路径递归外泄'],
  ])('拒绝 %s —— %s,并且根本不 spawn 进程', async (command) => {
    const out = await runTerminal(command)
    expect(out.success).toBe(false)
    expect(out.error).toContain('被拒')
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('正向对照:沙箱内裸文件名照常执行,且 cwd 被钉成沙箱根(不是 process.cwd)', async () => {
    const out = await runTerminal('ls notes.txt')
    expect(out.success).toBe(true)
    expect(spawnCalls).toHaveLength(1)
    const call = spawnCalls[0]!
    expect(call.bin).toBe('ls')
    expect(call.args).toEqual(['notes.txt'])
    expect(path.resolve(call.cwd ?? '')).toBe(fs.realpathSync(sandboxRoot))
    expect(call.cwd).not.toBe(process.cwd())
  })

  it('反向牙:沙箱根不可用时停用,而不是回落到 API 的 cwd', async () => {
    // 指向一枚"无法创建"的路径(已存在的普通文件当目录用)⇒ crewSandboxRoot() 返回 null
    const blocker = path.join(sandboxRoot, 'blocker-file')
    fs.writeFileSync(blocker, 'x', 'utf-8')
    process.env.CREW_SANDBOX_ROOT = path.join(blocker, 'cannot-be-created')
    const out = await runTerminal('ls notes.txt')
    expect(out.success).toBe(false)
    expect(out.error).toContain('拒绝执行')
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('白名单外的进程仍然一律不起(参数收敛不替代进程收敛)', async () => {
    const out = await runTerminal('rm -rf /tmp/x')
    expect(out.success).toBe(false)
    expect(out.error).toContain('不在白名单内')
    expect(execFileMock).not.toHaveBeenCalled()
  })
})

/**
 * SDB-51:白名单里的 `git status` 是多项条目,旧实现只拿首个 token 与整条字符串全等比较,
 * 于是 `git status` 永远被拒,而错误信息仍把它列为允许。
 * 这里钉住"按 token 序列逐项全等"的匹配语义,同时确认参数面收敛与元字符拒收没被放宽。
 */
describe('terminal_run 白名单按 token 序列匹配(SDB-51)', () => {
  it('① 多项条目 `git status` 放行,args 原样交给 execFile', async () => {
    const out = await runTerminal('git status')
    expect(out.success).toBe(true)
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0]!.bin).toBe('git')
    expect(spawnCalls[0]!.args).toEqual(['status'])
  })

  it('② 多项条目 + 额外参数 `git status --short` 放行', async () => {
    const out = await runTerminal('git status --short')
    expect(out.success).toBe(true)
    expect(spawnCalls[0]!.bin).toBe('git')
    expect(spawnCalls[0]!.args).toEqual(['status', '--short'])
  })

  it('③ 未列入的二进制/子命令仍被拒,且不 spawn', async () => {
    for (const command of ['rm -rf tmp', 'git push origin main', 'node index.js']) {
      const out = await runTerminal(command)
      expect(out.success, command).toBe(false)
      expect(out.error, command).toContain('不在白名单内')
    }
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('④ 含 shell 元字符的输入一律被拒(不因多项条目命中而放行)', async () => {
    for (const command of [
      'git status; rm -rf /',
      'git status && rm -rf /',
      'git status | cat',
      'git status > out.txt',
      'ls $(whoami)',
    ]) {
      const out = await runTerminal(command)
      expect(out.success, command).toBe(false)
      expect(out.error, command).toContain('非法 shell 字符')
    }
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('⑤ 单 token 条目行为与改前一致:`ls` 与 `ls 参数` 均放行', async () => {
    const bare = await runTerminal('ls')
    expect(bare.success).toBe(true)
    expect(spawnCalls[0]!.bin).toBe('ls')
    expect(spawnCalls[0]!.args).toEqual([])

    spawnCalls.length = 0
    const withArg = await runTerminal('ls notes.txt')
    expect(withArg.success).toBe(true)
    expect(spawnCalls[0]!.args).toEqual(['notes.txt'])
  })

  it('多项条目不给额外参数开后门:越界路径仍按参数面拒绝', async () => {
    const out = await runTerminal('git status ../../etc/passwd')
    expect(out.success).toBe(false)
    expect(out.error).toContain('被拒')
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('伪造前缀不算命中:`git statusx` 被拒', async () => {
    const out = await runTerminal('git statusx')
    expect(out.success).toBe(false)
    expect(out.error).toContain('不在白名单内')
    expect(execFileMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
