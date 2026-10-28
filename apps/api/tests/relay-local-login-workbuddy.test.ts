// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy「登录本机」API 层单测(2026-10-28 立,2026-10-29 按统一脚本契约重写)。
 *
 * 契约口径:九平台自 2026-10-28 起同构 —— 执行端统一为 `scripts/local-login.mjs`
 * (`--provider <code> --stdin --json`,凭证经 stdin,最后一行 stdout JSON,
 * stderr `❌ [code] message`)。**WorkBuddy 专属脚本 `workbuddy-login-local.mjs`
 * 在任何一次提交里都不存在**(见 relay-local-login-script-targets.test.ts),
 * 因此本档不再断言"专属脚本路径",改钉统一落点。
 *
 * 本档不跑真实脚本:vi.mock db / crypto / scheduler + mock child_process.spawn。判据:
 * - workbuddy 不在 unsupported 矩阵(loomy 同样已归脚本写回);
 * - 派发参数带 `--provider workbuddy --stdin --json`,payload 键集固定、secrets 整包透传;
 * - stdout → LocalLoginResult 字段映射(workbuddy 一律不主动刷新,refreshed 恒 false);
 * - 脚本非零退出按 `statusOf` 映射:no-template 归 409,未登记的码(如 not-running)归 502。
 *
 * 派生形态两种:win32 且 helper 在盘 ⇒ 经 `run-as-user` 包一层(pwsh -File … -ArgJson […]);
 * 其余平台 node 直跑。两种形态都必须解析出同一组脚本参数,故断言走 `scriptInvocation()`。
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

const TARGET_FILE = 'C:\\Users\\me\\AppData\\Roaming\\WorkBuddy\\Local Storage\\session.json'
const BACKUP_FILE = `${TARGET_FILE}.bak`

const OK_STDOUT = JSON.stringify({
  ok: true,
  uid: 'wb-uid-1',
  targetFile: TARGET_FILE,
  backupFile: BACKUP_FILE,
  replacedUid: 'wb-uid-old',
  clientProduct: 'WorkBuddy',
  clientWasRunning: true,
  clientClosed: true,
  clientForced: false,
  clientRestarted: true,
  restartHint: '重启 WorkBuddy 后生效',
  notes: ['已按池内模板重建本机会话'],
})

const SECRETS = { sessionTemplate: TEMPLATE, sealedPaths: SEALED, edition: 'workbuddy' }

function fakeRow(over: Record<string, unknown> = {}): any {
  return {
    id: 'row-1',
    providerCode: 'workbuddy',
    uid: 'wb-uid-1',
    name: '19269350269',
    tokenEnc: 'enc:ACCESS-TOKEN',
    refreshTokenEnc: 'enc:REFRESH-TOKEN',
    cookiesEnc: null,
    secretsEnc: `enc:${JSON.stringify(SECRETS)}`,
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    refreshExpiresAt: new Date(Date.now() + 86_400_000),
    deviceId: null,
    ...over,
  }
}

/**
 * 抹平两种派生形态,取出真正交给写回脚本的 (落点, 参数)。
 * - win32 + helper 在盘:`pwsh -File run-as-user.ps1 -ArgJson "[script, ...args]" …`
 * - 其余:`node <script> ...args`
 */
function scriptInvocation(): { script: string; args: string[] } {
  const args = spawnState.args
  const at = args.indexOf('-ArgJson')
  if (at >= 0) {
    const inner = JSON.parse(args[at + 1] ?? '[]') as string[]
    return { script: inner[0] ?? '', args: inner.slice(1) }
  }
  return { script: args[0] ?? '', args: args.slice(1) }
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
  it('矩阵不含 workbuddy / loomy(两者均已归脚本写回),仍含 lingma / grokbot', () => {
    expect(LOCAL_LOGIN_UNSUPPORTED_REASONS).not.toHaveProperty('workbuddy')
    // loomy 与 workbuddy 同期归位脚本写回,同为"可一键登录本机"的平台
    expect(LOCAL_LOGIN_UNSUPPORTED_REASONS).not.toHaveProperty('loomy')
    // 真不能离线重建的两平台仍在(摘掉它们会让 409 变静默成功)
    expect(LOCAL_LOGIN_UNSUPPORTED_REASONS).toHaveProperty('lingma')
    expect(LOCAL_LOGIN_UNSUPPORTED_REASONS).toHaveProperty('grokbot')
  })

  it('loginAccountLocal(workbuddy) 走统一写回脚本,不抛 unsupported-provider', async () => {
    const r = await loginAccountLocal(fakeRow())
    expect(r.ok).toBe(true)
    expect(r.providerCode).toBe('workbuddy')
  })
})

describe('统一脚本派发契约', () => {
  it('落点 = scripts/local-login.mjs,参数带 --provider workbuddy --stdin --json', async () => {
    await loginAccountLocal(fakeRow())
    expect(mockSpawn).toHaveBeenCalledTimes(1)
    const { script, args } = scriptInvocation()
    expect(script).toMatch(/[\\/]scripts[\\/]local-login\.mjs$/)
    expect(args).toEqual(['--provider', 'workbuddy', '--stdin', '--json'])
  })

  it('payload 键集固定:secrets 整包透传,不在 API 层拆模板', async () => {
    const row = fakeRow()
    await loginAccountLocal(row)
    const payload = JSON.parse(spawnState.payloadText)
    expect(Object.keys(payload).sort()).toEqual(
      ['cookies', 'expiresAt', 'refreshExpiresAt', 'refreshToken', 'secrets', 'token', 'uid'].sort(),
    )
    expect(payload.uid).toBe('wb-uid-1')
    expect(payload.token).toBe('ACCESS-TOKEN')
    expect(payload.refreshToken).toBe('REFRESH-TOKEN')
    // 模板三键整包交给脚本:拆字段就会漏掉 sealedPaths/edition(脚本按 sealedPaths 挑加密字段)
    expect(payload.secrets).toEqual(SECRETS)
    expect(payload.cookies).toEqual([])
    expect(payload.expiresAt).toBe(row.tokenExpiresAt.toISOString())
    expect(payload.refreshExpiresAt).toBe(row.refreshExpiresAt.toISOString())
  })

  it('到期时刻为 null ⇒ payload 不带该键(不写 null 让脚本侧误判为"已过期")', async () => {
    await loginAccountLocal(fakeRow({ tokenExpiresAt: null, refreshExpiresAt: null }))
    const payload = JSON.parse(spawnState.payloadText)
    expect(payload).not.toHaveProperty('expiresAt')
    expect(payload).not.toHaveProperty('refreshExpiresAt')
  })
})

describe('结果映射', () => {
  it('stdout → LocalLoginResult(workbuddy 不主动刷新,refreshed 恒 false)', async () => {
    const r = await loginAccountLocal(fakeRow())
    expect(r.ok).toBe(true)
    expect(r.providerCode).toBe('workbuddy')
    expect(r.uid).toBe('wb-uid-1')
    expect(r.replacedUid).toBe('wb-uid-old')
    expect(r.targetFile).toBe(TARGET_FILE)
    expect(r.backupFile).toBe(BACKUP_FILE)
    expect(r.tokenNearExpiry).toBe(false)
    expect(r.refreshed).toBe(false)
    expect(r.restartHint).toBe('重启 WorkBuddy 后生效')
    expect(r.clientProduct).toBe('WorkBuddy')
    expect(r.clientWasRunning).toBe(true)
    expect(r.clientClosed).toBe(true)
    expect(r.clientForced).toBe(false)
    expect(r.clientRestarted).toBe(true)
  })

  it('关过客户端 ⇒ notes 说明"先关后写"(内存态会覆写登录态)', async () => {
    const r = await loginAccountLocal(fakeRow())
    const notes = r.notes.join('\n')
    expect(notes).toContain('WorkBuddy')
    expect(notes).toContain('先关后写')
  })

  it('临期票 ⇒ tokenNearExpiry=true,但仍不主动刷新(防顶号)', async () => {
    const row = fakeRow({ tokenExpiresAt: new Date(Date.now() + 10_000) })
    const r = await loginAccountLocal(row)
    expect(r.tokenNearExpiry).toBe(true)
    expect(r.refreshed).toBe(false)
  })
})

describe('脚本失败映射', () => {
  it('非零退出 + ❌ [no-template] → LocalLoginError 409 no-template', async () => {
    spawnState.exitCode = 1
    spawnState.stdoutText = ''
    spawnState.stderrText = '❌ [no-template] 池内无会话模板\n'
    const err = await loginAccountLocal(fakeRow()).catch((e) => e)
    expect(err).toBeInstanceOf(LocalLoginError)
    expect(err.code).toBe('no-template')
    expect(err.status).toBe(409)
    expect(err.message).toContain('池内无会话模板')
  })

  it('非零退出 + ❌ [not-running] → 码直透,statusOf 未登记 ⇒ 502', async () => {
    spawnState.exitCode = 1
    spawnState.stdoutText = ''
    spawnState.stderrText = '❌ [not-running] 未发现运行中的 WorkBuddy 主进程\n'
    const err = await loginAccountLocal(fakeRow()).catch((e) => e)
    expect(err).toBeInstanceOf(LocalLoginError)
    expect(err.code).toBe('not-running')
    // not-running 不在 statusOf 的 409 名单里 ⇒ 按"脚本侧故障"给 502,不假称"改环境重试"
    expect(err.status).toBe(502)
    expect(err.message).toContain('未发现运行中的 WorkBuddy 主进程')
  })

  it('stdout 缺 targetFile → 502 bad-output(未判定不冒绿)', async () => {
    spawnState.stdoutText = JSON.stringify({ ok: true, uid: 'wb-uid-1' })
    const err = await loginAccountLocal(fakeRow()).catch((e) => e)
    expect(err).toBeInstanceOf(LocalLoginError)
    expect(err.code).toBe('bad-output')
    expect(err.status).toBe(502)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
