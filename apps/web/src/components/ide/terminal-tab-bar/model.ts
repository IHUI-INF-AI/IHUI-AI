// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { formatDateByTemplate } from '@ihui/shared'
import type { TerminalSshParams, TerminalSession } from '@ihui/types'

export type SshAuthMethod = 'password' | 'privateKey'

/** 可选 shell 列表(Windows 优先,仅本地会话时显示) */
export const SHELL_OPTIONS = [
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'CMD' },
  { value: 'bash', label: 'Bash' },
  { value: 'wsl', label: 'WSL' },
] as const

/** SSH 校验错误字段 → i18n key(terminalTabBar 命名空间内) */
export function sshFieldErrorKey(field: SshValidationError['error']): string {
  const map: Record<SshValidationError['error'], string> = {
    host: 'terminalTabBar.errHostRequired',
    port: 'terminalTabBar.errPortRange',
    username: 'terminalTabBar.errUsernameRequired',
    password: 'terminalTabBar.errPasswordRequired',
    privateKey: 'terminalTabBar.errPrivateKeyRequired',
  }
  return map[field]
}

export interface SshFormValues {
  host: string
  port: string
  username: string
  authMethod: SshAuthMethod
  password: string
  privateKey: string
  passphrase: string
}

export interface SshValidationError {
  error: 'host' | 'port' | 'username' | 'password' | 'privateKey'
}

export const emptySshForm: SshFormValues = {
  host: '',
  port: '22',
  username: '',
  authMethod: 'password',
  password: '',
  privateKey: '',
  passphrase: '',
}

export function buildSshParams(values: SshFormValues): TerminalSshParams | SshValidationError {
  const host = values.host.trim()
  const username = values.username.trim()
  if (!host) return { error: 'host' }
  const port = Number.parseInt(values.port, 10)
  if (!Number.isFinite(port) || port < 1 || port > 65535) return { error: 'port' }
  if (!username) return { error: 'username' }
  if (values.authMethod === 'password' && !values.password) return { error: 'password' }
  if (values.authMethod === 'privateKey' && !values.privateKey) return { error: 'privateKey' }

  const params: TerminalSshParams = { host, port, username }
  if (values.authMethod === 'password') params.password = values.password
  else {
    params.privateKey = values.privateKey
    if (values.passphrase) params.passphrase = values.passphrase
  }
  return params
}

export function getTerminalTabLabel(session: TerminalSession, index: number): string {
  return session.name ?? `Terminal ${index + 1}`
}

export function getTerminalSessionSubtitle(session: TerminalSession): string {
  if (session.kind !== 'ssh') return session.cwd.split(/[\\/]/).pop() || session.cwd
  return (session.sshUser ? `${session.sshUser}@` : '') + (session.sshHost ?? session.cwd)
}

export function formatRecordingDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

export function formatRecordingStartedAt(timestamp: number): string {
  return formatDateByTemplate(timestamp, 'MM-DD HH:mm')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
