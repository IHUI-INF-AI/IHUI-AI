// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-desktop-shortcut 服务层契约测试(2026-11-15 立)。
 * 只测本层裁决与解析,不真起 pwsh:runner 注入假实现;
 * installer 存在性用真实仓库根(安装器 ps1 是入库件,不存在即本测试替全仓报警)。
 */
import { describe, expect, it } from 'vitest'
import {
  DesktopShortcutError,
  DesktopShortcutUnreachableError,
  installDesktopShortcut,
  parseInstallerOutput,
  planDesktopShortcutInstall,
  __test__ as svc,
} from '../src/services/relay-desktop-shortcut.js'

describe('planDesktopShortcutInstall — 同机边界 fail-closed', () => {
  it('非 win32 ⇒ 409 not-win32,点名出路', () => {
    expect(() => planDesktopShortcutInstall({ platform: 'linux' })).toThrowError(
      DesktopShortcutUnreachableError,
    )
    try {
      planDesktopShortcutInstall({ platform: 'linux' })
    } catch (e) {
      const err = e as DesktopShortcutError
      expect(err.code).toBe('not-win32')
      expect(err.status).toBe(409)
      expect(err.message).toContain('install-relay-shortcut.cmd')
    }
  })
  it('win32 但仓库里没有安装器 ⇒ 409 installer-missing(不猜路径)', () => {
    expect(svc.DEFAULT_REPO_ROOT).toBeTruthy()
    try {
      planDesktopShortcutInstall({ platform: 'win32', repoRoot: 'Z:\\no-such-repo-dir' })
      expect.unreachable('应当抛出 installer-missing')
    } catch (e) {
      const err = e as DesktopShortcutError
      expect(err.code).toBe('installer-missing')
      expect(err.status).toBe(409)
      expect(err.message).toContain('install-relay-shortcut.ps1')
    }
  })
  it('win32 + 真实仓库 ⇒ argv 固定:仅 -SkipOld、UTF8 前缀、退出码透传,零请求侧输入', () => {
    const { ps1Path, pwshArgs } = planDesktopShortcutInstall({ platform: 'win32' })
    expect(pwshArgs.slice(0, 4)).toEqual([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
    ])
    expect(pwshArgs[4]).toBe('-Command')
    const inner = pwshArgs[5] ?? ''
    expect(inner).toContain('-SkipOld')
    expect(inner).toContain('UTF8Encoding')
    expect(inner).toContain('exit $LASTEXITCODE')
    expect(inner).toContain(ps1Path)
  })
})

describe('parseInstallerOutput — ps1 输出行协议', () => {
  const stdout = [
    'OK E:\\桌面\\AI 客户端一键切号.lnk',
    '  Target=G:\\IHUI-AI\\scripts\\client-oneclick-switch.cmd',
    '  Icon=G:\\IHUI-AI\\apps\\desktop\\src-tauri\\icons\\icon.ico,0',
    '[extra] 随机行进 raw 不判失败',
  ].join('\r\n')
  it('OK/Target/Icon 逐段归位;未识别行只报数', () => {
    const r = parseInstallerOutput(stdout, '')
    expect(r.installed).toEqual([
      {
        link: 'E:\\桌面\\AI 客户端一键切号.lnk',
        target: 'G:\\IHUI-AI\\scripts\\client-oneclick-switch.cmd',
        icon: 'G:\\IHUI-AI\\apps\\desktop\\src-tauri\\icons\\icon.ico,0',
      },
    ])
    expect(r.rawOutput).toContain('[extra] 随机行进 raw 不判失败')
  })
  it('WARNING 行进 warnings 并剥前缀(不混进错误)', () => {
    const r = parseInstallerOutput('', 'WARNING: 跳过「WorkBuddy 一键切号」: 启动器缺失')
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('跳过')
    expect(r.rawOutput).toHaveLength(0)
  })
})

describe('installDesktopShortcut — runner 注入,退出码三态', () => {
  it('exit 0 ⇒ 结构化回执(installed/rawOutput/exitCode)', async () => {
    const r = await installDesktopShortcut({
      platform: 'win32',
      runner: async () => ({
        code: 0,
        stdout: 'OK D:\\x\\AI 客户端一键切号.lnk\n  Target=T\n  Icon=I',
        stderr: '',
      }),
      // repoRoot 走真实仓库(installer 存在性判据照跑)
    })
    expect(r.installed[0]?.link).toContain('AI 客户端一键切号')
    expect(r.installerExitCode).toBe(0)
  })
  it('exit 非 0 ⇒ 502 installer-failed,点名"未确认落档"+stderr 尾行', async () => {
    await expect(
      installDesktopShortcut({
        platform: 'win32',
        runner: async () => ({ code: 1, stdout: '', stderr: '桌面目录不存在: X:\\NoDesktop' }),
      }),
    ).rejects.toMatchObject({ code: 'installer-failed', status: 502 })
  })
  it('同机边界不成立时 runner 一次都不被派(失效方向 = 不执行,不是执行后补救)', async () => {
    let spawned = 0
    await expect(
      installDesktopShortcut({
        platform: 'darwin',
        runner: async () => {
          spawned += 1
          return { code: 0, stdout: '', stderr: '' }
        },
      }),
    ).rejects.toBeInstanceOf(DesktopShortcutError)
    expect(spawned).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
