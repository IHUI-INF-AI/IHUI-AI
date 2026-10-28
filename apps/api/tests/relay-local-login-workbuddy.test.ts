// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy「登录本机」API 层单测(2026-10-28 立)。
 *
 * 契约口径:执行端 = scripts/workbuddy-login-local.mjs(stdin JSON,最后一行 stdout JSON,
 * stderr `❌ [code] message`,退出码 0/1/2)。本测试不跑真实脚本:
 * - vi.mock db / crypto(对齐 relay-workbuddy-import.test.ts)+ mock child_process.spawn;
 * - workbuddy 不再命中 unsupported-provider;
 * - 无模板 → 409 no-template;无 refreshToken → 409 refresh-missing;
 * - 正常路径逐键断言 spawn 收到的 payload 形状 + stdout → LocalLoginResult 字段映射;
 * - 脚本非零退出(not-running)→ LocalLoginError 409。
 * 票据策略:workbuddy 一律不主动刷新(防顶号),refreshed 恒 false。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSpawn, spawnState } = vi.hoisted(() => {
  const state = {
    exitCode: 0 as number | null,
    stdoutText: '',
    stderrText: '',
    payloadText: '',
    command: '',
    args: [] as string[],
  }
  const makeStream = () => {
    const listeners: Array<(c: Buffer) => void> = []
    const s = {
      on: (ev: string, cb: (c: Buffer) => void) => {
        if (ev === 'data') listeners.push(cb)
        return s
      },
      write: (text: string) => {
        for (const cb of listeners) cb(Buffer.from(text, 'utf8'))
      },
      end: () => s,
    }
    return s
  }
  const spawnMock = vi.fn((command?: string, args?: string[]) => {
    state.command = typeof command === 'string' ? command : ''
    state.args = Array.isArray(args) ? args : []
    const closeListeners: Array<(code: number | null) => void> = []
    const stdout = makeStream()
    const stderr = makeStream()
    const child = {
      stdout,
      stderr,
      stdin: {
        end: (chunk?: unknown) => {
          if (typeof chunk === 'string') state.payloadText = chunk
          setImmediate(() => {
            if (state.stdoutText) stdout.write(state.stdoutText)
            if (state.stderrText) stderr.write(state.stderrText)
            for (const cb of closeListeners) cb(state.exitCode)
          })
        },
      },
      on: (ev: string, cb: (arg: any) => void) => {
        if (ev === 'close') closeListeners.push(cb)
      },
      kill: () => true,
    }
    return child
  })
  return { mockSpawn: spawnMock, spawnState: state }
})

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
  dbRead: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
  dbClient: {},
}))

vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (s: string) => `enc:${s}`,
  decryptField: (s: string) => (s.startsWith('enc:') ? s.slice(4) : s),
}))

/** 票据策略不走 scheduler(workbuddy 一律不刷新);mock 掉避免拉起刷新链 */
vi.mock('../src/services/relay-account-pool-scheduler.js', () => ({
  refreshOne: vi.fn(async () => false),
}))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, spawn: mockSpawn }
})

import {
  LOCAL_LOGIN_UNSUPPORTED_REASONS,
  LocalLoginError,
  loginAccountLocal,
} from '../src/services/relay-local-login.js'

const TEMPLATE = {
  account: { uid: 'wb-uid-1', nickname: 'x' },
  device: { deviceId: 'dev-1' },
}
const SEALED = ['auth.accessToken', 'auth.refreshToken', 'account.phone']

const OK_STDOUT = JSON.stringify({
  ok: true,
  uid: 'wb-uid-1',
  edition: 'workbuddy',
  targetFile: 'C:\\Users\\me\\AppData\\Roaming\\WorkBuddy\\Local Storage\\session.json',
  backupFile: 'C:\\Users\\me\\AppData\\Roaming\\WorkBuddy\\Local Storage\\session.json.bak',
  replacedUid: 'wb-uid-old',
  clientWasRunning: true,
  clientClosed: true,
  clientForced: false,
  clientRestarted: true,
  restartHint: '重启 WorkBuddy 后生效',
})

function fakeRow(over: Record<string, unknown> = {}): any {
  return {
    id: 'row-1',
    providerCode: 'workbuddy',
    uid: 'wb-uid-1',
    name: '19269350269',
    tokenEnc: 'enc:ACCESS-TOKEN',
    refreshTokenEnc: 'enc:REFRESH-TOKEN',
    cookiesEnc: null,
    secretsEnc: `enc:${JSON.stringify({ sessionTemplate: TEMPLATE, sealedPaths: SEALED, edition: 'workbuddy' })}`,
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    refreshExpiresAt: new Date(Date.now() + 86_400_000),
    deviceId: null,
    ...over,
  }
}

function rowWithout(overrides: Record<string, unknown>): any {
  const secrets = {
    sessionTemplate: TEMPLATE,
    sealedPaths: SEALED,
    edition: 'workbuddy',
    ...overrides,
  }
  return fakeRow({ secretsEnc: `enc:${JSON.stringify(secrets)}` })
}

beforeEach(() => {
  mockSpawn.mockClear()
  spawnState.exitCode = 0
  spawnState.stdoutText = OK_STDOUT
  spawnState.stderrText = ''
  spawnState.payloadText = ''
  spawnState.command = ''
  spawnState.args = []
})

describe('workbuddy 已移出本机不支持矩阵', () => {
  it('LOCAL_LOGIN_UNSUPPORTED_REASONS 不再包含 workbuddy', () => {
    expect(LOCAL_LOGIN_UNSUPPORTED_REASONS).not.toHaveProperty('workbuddy')
    // 其余平台不动
    expect(LOCAL_LOGIN_UNSUPPORTED_REASONS).toHaveProperty('loomy')
  })

  it('loginAccountLocal(workbuddy) 不再抛 unsupported-provider,走写回脚本', async () => {
    const r = await loginAccountLocal(fakeRow())
    expect(r.ok).toBe(true)
    expect(r.providerCode).toBe('workbuddy')
  })
})

describe('模板/凭证前置校验(不起子进程)', () => {
  it('secrets 无 sessionTemplate → 409 no-template', async () => {
    await expect(
      loginAccountLocal(rowWithout({ sessionTemplate: undefined })),
    ).rejects.toMatchObject({ name: 'LocalLoginError', code: 'no-template', status: 409 })
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('sessionTemplate 空对象 → 409 no-template', async () => {
    await expect(loginAccountLocal(rowWithout({ sessionTemplate: {} }))).rejects.toMatchObject({
      code: 'no-template',
      status: 409,
    })
  })

  it('sealedPaths 缺失/空数组 → 409 no-template', async () => {
    await expect(loginAccountLocal(rowWithout({ sealedPaths: undefined }))).rejects.toMatchObject({
      code: 'no-template',
      status: 409,
    })
    await expect(loginAccountLocal(rowWithout({ sealedPaths: [] }))).rejects.toMatchObject({
      code: 'no-template',
      status: 409,
    })
  })

  it('池内无 refreshToken → 409 refresh-missing', async () => {
    await expect(loginAccountLocal(fakeRow({ refreshTokenEnc: null }))).rejects.toMatchObject({
      name: 'LocalLoginError',
      code: 'refresh-missing',
      status: 409,
    })
    expect(mockSpawn).not.toHaveBeenCalled()
  })
})

describe('正常路径:payload 契约 + 结果映射', () => {
  it('spawn 收到的脚本路径/参数与 payload 逐键符合契约', async () => {
    const row = fakeRow()
    await loginAccountLocal(row)
    expect(mockSpawn).toHaveBeenCalledTimes(1)
    /**
     * workbuddy 必须经 run-as-user 身份 helper(2026-10-28 立):IHUI-API 以 LocalSystem
     * 服务运行时 %LOCALAPPDATA% 指向 systemprofile ⇒ 会话文件路径只有以桌面用户身份执行才对;
     * 非服务身份时 helper 原样直跑,行为等价。
     */
    expect(spawnState.command).toMatch(/(pwsh|powershell)\.exe$/i)
    expect(spawnState.args).toContain('-File')
    const argJsonAt = spawnState.args.indexOf('-ArgJson')
    expect(argJsonAt).toBeGreaterThan(-1)
    const inner = JSON.parse(spawnState.args[argJsonAt + 1] ?? '[]') as string[]
    expect(inner[0]).toMatch(/[\\/]workbuddy-login-local\.mjs$/)
    expect(inner.slice(1)).toEqual(['--stdin', '--json'])

    const payload = JSON.parse(spawnState.payloadText)
    expect(Object.keys(payload).sort()).toEqual(
      [
        'credentials',
        'edition',
        'expiry',
        'restartClient',
        'sealedPaths',
        'sessionTemplate',
        'uid',
      ].sort(),
    )
    expect(payload.uid).toBe('wb-uid-1')
    expect(payload.edition).toBe('workbuddy')
    expect(payload.sessionTemplate).toEqual(TEMPLATE)
    expect(payload.sealedPaths).toEqual(SEALED)
    expect(payload.credentials).toEqual({
      accessToken: 'ACCESS-TOKEN',
      refreshToken: 'REFRESH-TOKEN',
    })
    expect(payload.expiry).toEqual({
      expiresAt: row.tokenExpiresAt.toISOString(),
      refreshExpiresAt: row.refreshExpiresAt.toISOString(),
    })
    expect(payload.restartClient).toBe(true)
  })

  it('stdout JSON 映射到 LocalLoginResult(不主动刷新,refreshed=false)', async () => {
    const row = fakeRow()
    const r = await loginAccountLocal(row)
    expect(r.ok).toBe(true)
    expect(r.providerCode).toBe('workbuddy')
    expect(r.uid).toBe('wb-uid-1')
    expect(r.replacedUid).toBe('wb-uid-old')
    expect(r.targetFile).toBe(
      'C:\\Users\\me\\AppData\\Roaming\\WorkBuddy\\Local Storage\\session.json',
    )
    expect(r.backupFile).toBe(
      'C:\\Users\\me\\AppData\\Roaming\\WorkBuddy\\Local Storage\\session.json.bak',
    )
    expect(r.tokenNearExpiry).toBe(false)
    expect(r.refreshed).toBe(false)
    expect(r.restartHint).toBe('重启 WorkBuddy 后生效')
    expect(r.clientProduct).toBe('WorkBuddy')
    expect(r.clientWasRunning).toBe(true)
    expect(r.clientClosed).toBe(true)
    expect(r.clientForced).toBe(false)
    expect(r.clientRestarted).toBe(true)
    expect(r.notes.join('\n')).toContain('关闭并重新打开 WorkBuddy 客户端')
  })

  it('edition 缺失默认 workbuddy 并加 notes;临期票标注自行续期', async () => {
    const now = Date.now()
    const row = rowWithout({ edition: undefined })
    row.tokenExpiresAt = new Date(now + 10_000) // 10s 后过期 ⇒ 临期
    const r = await loginAccountLocal(row)
    const payload = JSON.parse(spawnState.payloadText)
    expect(payload.edition).toBe('workbuddy')
    expect(r.tokenNearExpiry).toBe(true)
    expect(r.refreshed).toBe(false)
    expect(r.notes.join('\n')).toContain('写入的是临期/过期票,客户端启动后会自行续期')
    expect(r.notes.join('\n')).toContain('池内未记录 edition')
  })

  it('expiry 无到期时刻回报 null', async () => {
    const row = fakeRow({ tokenExpiresAt: null, refreshExpiresAt: null })
    await loginAccountLocal(row)
    const payload = JSON.parse(spawnState.payloadText)
    expect(payload.expiry).toEqual({ expiresAt: null, refreshExpiresAt: null })
  })
})

describe('脚本失败映射', () => {
  it('非零退出 + stderr ❌ [not-running] → LocalLoginError 409', async () => {
    spawnState.exitCode = 1
    spawnState.stdoutText = ''
    spawnState.stderrText = '❌ [not-running] 未发现运行中的 WorkBuddy 主进程\n'
    const err = await loginAccountLocal(fakeRow()).catch((e) => e)
    expect(err).toBeInstanceOf(LocalLoginError)
    expect(err.code).toBe('not-running')
    expect(err.status).toBe(409)
    expect(err.message).toContain('未发现运行中的 WorkBuddy 主进程')
  })

  it('stdout 缺 targetFile → 502 bad-output', async () => {
    spawnState.stdoutText = JSON.stringify({ ok: true, uid: 'wb-uid-1' })
    const err = await loginAccountLocal(fakeRow()).catch((e) => e)
    expect(err).toBeInstanceOf(LocalLoginError)
    expect(err.code).toBe('bad-output')
    expect(err.status).toBe(502)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
