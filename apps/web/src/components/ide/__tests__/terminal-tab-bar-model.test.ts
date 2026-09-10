// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import type { TerminalSession } from '@ihui/types'
import {
  buildSshParams,
  emptySshForm,
  formatRecordingDuration,
  getTerminalSessionSubtitle,
  getTerminalTabLabel,
} from '../terminal-tab-bar-model'

describe('terminal-tab-bar-model', () => {
  it('builds SSH params from valid password values', () => {
    expect(
      buildSshParams({
        ...emptySshForm,
        host: ' example.com ',
        username: ' root ',
        password: 'secret',
      }),
    ).toEqual({ host: 'example.com', port: 22, username: 'root', password: 'secret' })
  })

  it('builds SSH params with private key and passphrase', () => {
    expect(
      buildSshParams({
        ...emptySshForm,
        host: 'example.com',
        username: 'root',
        authMethod: 'privateKey',
        privateKey: 'key',
        passphrase: 'phrase',
      }),
    ).toEqual({
      host: 'example.com',
      port: 22,
      username: 'root',
      privateKey: 'key',
      passphrase: 'phrase',
    })
  })

  it('validates all SSH form errors in order', () => {
    expect(buildSshParams(emptySshForm)).toEqual({ error: 'host' })
    expect(
      buildSshParams({ ...emptySshForm, host: 'a', port: '0', username: 'u', password: 'p' }),
    ).toEqual({ error: 'port' })
    expect(buildSshParams({ ...emptySshForm, host: 'a', port: '22', password: 'p' })).toEqual({
      error: 'username',
    })
    expect(buildSshParams({ ...emptySshForm, host: 'a', port: '22', username: 'u' })).toEqual({
      error: 'password',
    })
    expect(
      buildSshParams({
        ...emptySshForm,
        host: 'a',
        port: '22',
        username: 'u',
        authMethod: 'privateKey',
      }),
    ).toEqual({ error: 'privateKey' })
  })

  it('derives tab labels and local subtitles', () => {
    const named = {
      id: '1',
      kind: 'local',
      cwd: 'G:\\repo\\apps\\web',
      name: 'Build',
    } as TerminalSession
    const unnamed = { id: '2', kind: 'local', cwd: '/repo/apps/api' } as TerminalSession
    expect(getTerminalTabLabel(named, 0)).toBe('Build')
    expect(getTerminalTabLabel(unnamed, 2)).toBe('Terminal 3')
    expect(getTerminalSessionSubtitle(unnamed)).toBe('api')
  })

  it('formats SSH subtitles and recording durations', () => {
    const ssh = {
      id: '3',
      kind: 'ssh',
      cwd: '/home/u',
      sshUser: 'u',
      sshHost: 'example.com',
    } as TerminalSession
    expect(getTerminalSessionSubtitle(ssh)).toBe('u@example.com')
    expect(formatRecordingDuration(0)).toBe('0s')
    expect(formatRecordingDuration(59_900)).toBe('59s')
    expect(formatRecordingDuration(65_000)).toBe('1m 5s')
    expect(formatRecordingDuration(120_000)).toBe('2m')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
