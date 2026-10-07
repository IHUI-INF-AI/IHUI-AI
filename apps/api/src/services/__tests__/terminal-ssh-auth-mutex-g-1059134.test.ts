// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1059134:TerminalSshParams.password?/privateKey? 类型层保持平铺二选一(REST 连接
 * 入参,机主拍板不改 wire、不引入 kind 字面量),互斥性由消费面 terminal-service 的
 * 运行时守卫补齐。判据三条:
 *
 *   ① 同给两个凭证 ⇒ 400 类错误(errorCode='ssh_auth_conflict'),且 createSession 在
 *      建立 SSH 客户端/连接之前就拒绝 —— 会话不得被登记(否则守卫等于没拦);
 *   ② 单给 password / 单给 privateKey / 都不给 三种合法形态不得误伤;
 *   ③ 有牙:守卫调用若被摘除,①的 createSession 用例必红 —— 要么一路走到 ssh2 connect
 *      不再同步抛错,要么落在 ssh2 未安装的 501/ssh2_not_installed 上,都过不了
 *      statusCode=400 + errorCode='ssh_auth_conflict' 的精确断言。
 */
import { describe, it, expect } from 'vitest'
import type { TerminalSshParams } from '@ihui/types'
import { createSession, listSessions, assertSshAuthExclusive } from '../terminal-service.js'

const USER_ID = 'g-1059134-mutex-user'

const BOTH: TerminalSshParams = {
  host: '127.0.0.1',
  username: 'g-1059134',
  password: 'p4ssw0rd',
  privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nZmFrZQ==\n-----END OPENSSH PRIVATE KEY-----\n',
}

/** 同给凭证时抛出的错误形状断言(400 类 + 专属 errorCode,排除 501/限额等其他抛点冒名)。 */
function expectAuthConflict(thrown: unknown): void {
  expect(thrown).toBeInstanceOf(Error)
  const err = thrown as Error & { statusCode?: number; errorCode?: string }
  expect(err.statusCode).toBe(400)
  expect(err.errorCode).toBe('ssh_auth_conflict')
  expect(err.message).toContain('二选一')
}

describe('G-1059134 · SSH 凭证二选一运行时互斥(password × privateKey)', () => {
  it('守卫:同给两个凭证 ⇒ 400 类错误(ssh_auth_conflict)', () => {
    let thrown: unknown
    try {
      assertSshAuthExclusive({ ...BOTH })
    } catch (e) {
      thrown = e
    }
    expectAuthConflict(thrown)
  })

  it('createSession 集成:同给凭证 ⇒ 连接建立之前 400 拒绝,且会话未被登记', () => {
    let thrown: unknown
    try {
      createSession(USER_ID, { ssh: { ...BOTH } })
    } catch (e) {
      thrown = e
    }
    expectAuthConflict(thrown)
    expect(listSessions(USER_ID)).toEqual([])
  })

  it.each(
    [
      ['仅 password', { host: BOTH.host, username: BOTH.username, password: BOTH.password }],
      [
        '仅 privateKey(含 passphrase)',
        {
          host: BOTH.host,
          username: BOTH.username,
          privateKey: BOTH.privateKey,
          passphrase: 'pp',
        },
      ],
      ['都不给(agent 认证形态)', { host: BOTH.host, username: BOTH.username }],
    ] as ReadonlyArray<readonly [string, TerminalSshParams]>,
  )('合法形态(%s)不得误伤', (_label, ssh) => {
    expect(() => assertSshAuthExclusive(ssh)).not.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
