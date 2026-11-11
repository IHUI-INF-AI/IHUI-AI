// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-40:沙箱路径闸必须覆盖 `ls/dir/wc/stat/test`。
 *
 * 修复前这几个命令只在 SANDBOX_BINARY_WHITELIST,不在 SANDBOX_FILE_TOOL_BINARIES,
 * 于是逐参数路径收敛整段被跳过:`ls -R C:/Users`、`wc -l /etc/passwd`、
 * `stat <外部路径>`、`test -f <外部路径>` 直接 execFile 执行,把工作区外的
 * 目录树/存在性/行数字节数回传给调用方。本档钉住:越界参数一律 126、
 * 工作区内相对路径照常放行、开关项不被误判为路径。
 *
 * 平台无关:拒绝用例在闸内被拦(不会走到 execFile);放行用例只断言"没被闸拒"。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { sandboxExecutor } from '../src/services/workspace-ai-service.js'

/** 根外绝对路径:与 scratchRoot 同父(tmpdir),两平台都是绝对路径。 */
function outsideRootFwd(): string {
  return join(tmpdir(), 'ihui-sdb40-outside').split(String.fromCharCode(92)).join('/')
}

function fwd(p: string): string {
  return p.split(String.fromCharCode(92)).join('/')
}

let scratchRoot: string
let savedRootsEnv: string | undefined

beforeEach(() => {
  scratchRoot = mkdtempSync(join(tmpdir(), 'ihui-sdb40-'))
  savedRootsEnv = process.env.IHUI_WORKSPACE_ROOTS
  process.env.IHUI_WORKSPACE_ROOTS = scratchRoot
  mkdirSync(join(scratchRoot, 'sub'), { recursive: true })
  writeFileSync(join(scratchRoot, 'a.txt'), 'line1\nline2\n', 'utf-8')
})

afterEach(() => {
  if (savedRootsEnv === undefined) delete process.env.IHUI_WORKSPACE_ROOTS
  else process.env.IHUI_WORKSPACE_ROOTS = savedRootsEnv
  rmSync(scratchRoot, { recursive: true, force: true })
})

describe('SDB-40:ls/dir/wc/stat/test 参数路径必须收敛在登记根内', () => {
  it('① ls -R 绝对路径越界 ⇒ 126 拒绝', async () => {
    const r = await sandboxExecutor.execute({
      command: `ls -R ${outsideRootFwd()}`,
      workspacePath: scratchRoot,
      mode: 'read-only',
    })
    expect(r.exitCode).toBe(126)
    expect(r.stderr).toContain('参数路径越界')
  })

  it('② ls 工作区内相对路径 ⇒ 不被闸拒(正向对照)', async () => {
    const r = await sandboxExecutor.execute({
      command: 'ls ./sub',
      workspacePath: scratchRoot,
      mode: 'read-only',
    })
    expect(r.exitCode).not.toBe(126)
    expect(r.stderr).not.toContain('参数路径越界')
    // 有真实 ls 的平台应确实执行成功(Windows 无 ls 时不强求退出码)
    if (process.platform !== 'win32') expect(r.exitCode).toBe(0)
  })

  it('③ wc/stat/test/[ 越界参数 ⇒ 126 拒绝', async () => {
    const cases = [
      `wc -l ${outsideRootFwd()}/a.txt`,
      `stat ${outsideRootFwd()}`,
      `test -f ${outsideRootFwd()}/a.txt`,
      `test -e ${outsideRootFwd()}`,
      `[ -e ${outsideRootFwd()} ]`,
    ]
    for (const command of cases) {
      const r = await sandboxExecutor.execute({
        command,
        workspacePath: scratchRoot,
        mode: 'read-only',
      })
      expect(r.exitCode, command).toBe(126)
      expect(r.stderr, command).toContain('参数路径越界')
    }
  })

  it('④ 开关项(以 - 开头)不被误判为路径', async () => {
    const cases = [
      'ls -la ./sub',
      'ls --color=never ./sub',
      'wc -l -c ./a.txt',
      'stat -c %s ./a.txt',
      'test -f ./a.txt',
    ]
    for (const command of cases) {
      const r = await sandboxExecutor.execute({
        command,
        workspacePath: scratchRoot,
        mode: 'read-only',
      })
      expect(r.exitCode, command).not.toBe(126)
      expect(r.stderr, command).not.toContain('参数路径越界')
    }
  })

  it('工作区内绝对路径同样放行(闸只判根内外,不判参数形态)', async () => {
    const r = await sandboxExecutor.execute({
      command: `wc -l ${fwd(join(scratchRoot, 'a.txt'))}`,
      workspacePath: scratchRoot,
      mode: 'read-only',
    })
    expect(r.exitCode).not.toBe(126)
    expect(r.stderr).not.toContain('参数路径越界')
  })
})
