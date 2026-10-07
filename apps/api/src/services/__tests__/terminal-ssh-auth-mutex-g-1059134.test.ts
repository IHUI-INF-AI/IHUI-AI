// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1059134:TerminalSshParams.password?/privateKey? 类型层保持平铺可选(REST 连接
 * 入参,机主拍板不改 wire、不引入 kind 字面量),"至少其一"由消费面 terminal-service
 * 的运行时守卫补齐。拍板@2026-10-07 定稿语义:运行时要求 password/privateKey 至少
 * 其一,二者同给合法(私钥+口令并存,ssh2 按认证方式依次尝试);上一轮 86d8d9a3ad
 * 的互斥读法(同给 ⇒ 400)与之相反,本文件连同守卫一并翻转。文件名沿用首轮的
 * mutex 命名(旁路落地器不支持路径删除,重命名会留旧路径死文件),语义以本头注与
 * 用例为准。判据三条:
 *
 *   ① 两个凭证均缺(空串同缺)⇒ 400 类错误(errorCode='ssh_auth_missing'),且
 *      createSession 在建立 SSH 客户端/连接之前就拒绝 —— 会话不得被登记(否则守卫等于没拦);
 *   ② 同给两个凭证 / 单给 password / 单给 privateKey 三种合法形态不得误伤;
 *   ③ 有牙:守卫调用若被摘除,①的 createSession 用例必红(ssh2 缺位时落在
 *      501/ssh2_not_installed,过不了 statusCode=400 + errorCode='ssh_auth_missing'
 *      的精确断言);同给若被重新误判为非法,②的集成用例同样必红。
 */
import { describe, it, expect } from 'vitest'
import type { TerminalSession, TerminalSshParams } from '@ihui/types'
import {
  createSession,
  listSessions,
  closeSession,
  assertSshAuthPresent,
} from '../terminal-service.js'

const HOST = '127.0.0.1'
const USERNAME = 'g-1059134'
const PRIVATE_KEY =
  '-----BEGIN OPENSSH PRIVATE KEY-----\nZmFrZQ==\n-----END OPENSSH PRIVATE KEY-----\n'

const BOTH: TerminalSshParams = {
  host: HOST,
  username: USERNAME,
  password: 'p4ssw0rd',
  privateKey: PRIVATE_KEY,
}
const ONLY_PASSWORD: TerminalSshParams = { host: HOST, username: USERNAME, password: 'p4ssw0rd' }
const ONLY_KEY: TerminalSshParams = {
  host: HOST,
  username: USERNAME,
  privateKey: PRIVATE_KEY,
  passphrase: 'pp',
}
const NEITHER: TerminalSshParams = { host: HOST, username: USERNAME }

/** 全缺时抛出的错误形状断言(400 类 + 专属 errorCode,排除 501/限额等其他抛点冒名)。 */
function expectAuthMissing(thrown: unknown): void {
  expect(thrown).toBeInstanceOf(Error)
  const err = thrown as Error & { statusCode?: number; errorCode?: string }
  expect(err.statusCode).toBe(400)
  expect(err.errorCode).toBe('ssh_auth_missing')
  expect(err.message).toContain('至少提供其一')
}

/**
 * 合法形态走 createSession 集成:认证门先于能力检查 ⇒ 过门后的落点要么登记成功
 * (ssh2 在位,连接异步发起,登记后立即回收),要么 ssh2 缺位降级 501 —— 唯独不得
 * 被认证门以 400 拒下。
 */
function expectPassesAuthGate(userId: string, ssh: TerminalSshParams): void {
  let session: TerminalSession | null = null
  let thrown: unknown
  try {
    session = createSession(userId, { ssh })
  } catch (e) {
    thrown = e
  }
  if (session) {
    const created = session
    expect(listSessions(userId).some((s) => s.id === created.id)).toBe(true)
    closeSession(created.id, userId)
    return
  }
  const err = thrown as Error & { statusCode?: number; errorCode?: string }
  expect(err).toBeInstanceOf(Error)
  expect(err.statusCode).toBe(501)
  expect(err.errorCode).toBe('ssh2_not_installed')
}

describe('G-1059134 · SSH 凭证至少其一运行时守卫(password × privateKey)', () => {
  it('守卫:两个凭证均缺 ⇒ 400 类错误(ssh_auth_missing)', () => {
    let thrown: unknown
    try {
      assertSshAuthPresent({ ...NEITHER })
    } catch (e) {
      thrown = e
    }
    expectAuthMissing(thrown)
  })

  it('守卫:空串凭证按缺处理 ⇒ 同样 400(与 connectOpts truthy 装配语义一致)', () => {
    let thrown: unknown
    try {
      assertSshAuthPresent({ ...NEITHER, password: '', privateKey: '' })
    } catch (e) {
      thrown = e
    }
    expectAuthMissing(thrown)
  })

  it('createSession 集成:全缺 ⇒ 连接建立之前 400 拒绝,且会话未被登记', () => {
    const userId = 'g-1059134-missing-user'
    let thrown: unknown
    try {
      createSession(userId, { ssh: { ...NEITHER } })
    } catch (e) {
      thrown = e
    }
    expectAuthMissing(thrown)
    expect(listSessions(userId)).toEqual([])
  })

  it.each(
    [
      ['两者齐给(私钥+口令并存)', BOTH],
      ['仅 password', ONLY_PASSWORD],
      ['仅 privateKey(含 passphrase)', ONLY_KEY],
    ] as ReadonlyArray<readonly [string, TerminalSshParams]>,
  )('守卫:合法形态(%s)不得误伤', (_label, ssh) => {
    expect(() => assertSshAuthPresent(ssh)).not.toThrow()
  })

  it.each(
    [
      ['两者齐给(私钥+口令并存)', BOTH],
      ['仅 password', ONLY_PASSWORD],
      ['仅 privateKey(含 passphrase)', ONLY_KEY],
    ] as ReadonlyArray<readonly [string, TerminalSshParams]>,
  )('createSession 集成:合法形态(%s)通过认证门(过门后至多 501 降级,不得 400)', (_label, ssh) => {
    expectPassesAuthGate('g-1059134-pass-user', ssh)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
