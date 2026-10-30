// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applySwitch,
  assertNoSecretLeak,
  closeClientAndWait,
  fmtTarget,
  listSwitchTargets,
  main,
  planSwitch,
  resolveClientExe,
  rollbackAuth,
  runLinkedSessionSwap,
  type SwitchPaths,
} from '../scripts/relay-account-switch.js'
import { readOpsAll, type MovePaths } from '../scripts/relay-session-move.js'

const FAKE_TOKEN = 'eyJfakeJWTtokenFORLEAKTEST1234567890abcdef'
const FAKE_REFRESH = 'rt_fake_refresh_secret_0123456789'

let root: string
let paths: SwitchPaths

function authBody(
  nickname: string,
  opts: { expired?: boolean; domain?: string; uid?: string } = {},
): string {
  const exp = new Date(Date.now() + (opts.expired ? -3600_000 : 86_400_000)).toISOString()
  return JSON.stringify({
    account: { nickname, phoneNumber: '13812345678', uid: opts.uid ?? 'u-1' },
    accounts: [],
    allAccounts: [],
    auth: {
      accessToken: FAKE_TOKEN,
      refreshToken: FAKE_REFRESH,
      domain: opts.domain ?? 'workbuddy.cn',
      expiresAt: exp,
      tokenType: 'bearer',
    },
  })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'relay-switch-'))
  paths = {
    authFile: join(root, 'auth', 'workbuddy-desktop.info'),
    backupsDir: join(root, 'backups'),
  }
  mkdirSync(paths.backupsDir, { recursive: true })
})

afterEach(() => {
  // root 留给 OS 临时目录清理;测试内已断言无泄漏
})

const sha12 = (p: string): string =>
  createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12)

function seedSnapshot(name: string, body: string): string {
  writeFileSync(join(paths.backupsDir, name), body)
  return join(paths.backupsDir, name)
}

describe('listSwitchTargets', () => {
  it('枚举快照(新→旧)+当前文件,元数据脱敏(手机号打码,无 token 字段)', () => {
    seedSnapshot('workbuddy-desktop.20261026T110000Z.info', authBody('甲'))
    seedSnapshot('workbuddy-desktop.20261027T090000Z.info', authBody('乙', { expired: true }))
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前号'))

    const { current, targets } = listSwitchTargets(paths)
    expect(current?.nickname).toBe('当前号')
    expect(current?.isCurrent).toBe(true)
    expect(targets.map((t) => t.name)).toEqual([
      'workbuddy-desktop.20261027T090000Z.info',
      'workbuddy-desktop.20261026T110000Z.info',
    ])
    expect(targets[1]!.expired).toBe(false)
    expect(targets[0]!.expired).toBe(true)
    expect(targets[0]!.phoneMasked).toBe('138****5678')
    for (const t of [current, ...targets]) {
      const json = JSON.stringify(t)
      expect(json).not.toContain(FAKE_TOKEN)
      expect(json).not.toContain(FAKE_REFRESH)
      expect(json).not.toContain('13812345678')
    }
  })

  it('非快照命名与坏 JSON 文件被忽略', () => {
    writeFileSync(join(paths.backupsDir, 'random.txt'), 'x')
    writeFileSync(join(paths.backupsDir, 'workbuddy-desktop.bad.info'), '{not json')
    const { targets } = listSwitchTargets(paths)
    expect(targets).toHaveLength(0)
  })

  it('实机形态兼容:epoch 数字 expiresAt + $wbEncrypted 信封对象 token', () => {
    const body = JSON.stringify({
      account: { nickname: '实机形态' },
      auth: {
        accessToken: { $wbEncrypted: 'xx', iv: 'yy' },
        expiresAt: Date.now() + 86_400_000, // 数字时间戳
        domain: 'copilot.tencent.com',
      },
    })
    seedSnapshot('workbuddy-desktop.live-shape.info', body)
    const { targets } = listSwitchTargets(paths)
    const t = targets.find((x) => x.name.includes('live-shape'))!
    expect(t.tokenShape).toBe('envelope')
    expect(t.expired).toBe(false)
    expect(t.authExpiresAt).toBeDefined()
    expect(JSON.stringify(t)).not.toContain('xx') // 信封载荷不外泄
  })
})

describe('planSwitch', () => {
  beforeEach(() => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前号'))
    seedSnapshot('workbuddy-desktop.20261026T110000Z.info', authBody('甲'))
  })

  it('生成计划:备份落点 + 告警;dry-run 不写任何盘', () => {
    const before = readdirSync(paths.backupsDir)
    const plan = planSwitch(paths, 'workbuddy-desktop.20261026T110000Z.info')
    expect(plan.targetPath).toContain('workbuddy-desktop.20261026T110000Z.info')
    expect(plan.backupPath).toMatch(/pre-switch\.info$/)
    expect(plan.warnings.some((w) => w.includes('重启'))).toBe(true)
    expect(plan.warnings.some((w) => w.includes('relay:session-move swap --to u-1'))).toBe(true)
    expect(readdirSync(paths.backupsDir)).toEqual(before)
  })

  it('目标与当前逐字节相同 ⇒ 拒绝', () => {
    seedSnapshot('workbuddy-desktop.same.info', readFileSync(paths.authFile, 'utf8'))
    expect(() => planSwitch(paths, 'workbuddy-desktop.same.info')).toThrow(/逐字节相同/)
  })

  it('快照不存在 ⇒ 报错并给可用清单', () => {
    expect(() => planSwitch(paths, 'nope.info')).toThrow(
      /快照不存在.*workbuddy-desktop\.20261026T110000Z\.info/s,
    )
  })

  it('过期快照给明确告警', () => {
    seedSnapshot('workbuddy-desktop.old.info', authBody('过期号', { expired: true }))
    const plan = planSwitch(paths, 'workbuddy-desktop.old.info')
    expect(plan.warnings.some((w) => w.includes('已过期'))).toBe(true)
  })
})

describe('applySwitch', () => {
  beforeEach(() => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前号'))
    seedSnapshot(
      'workbuddy-desktop.target.info',
      authBody('目标号', { domain: 'global.workbuddy.ai' }),
    )
  })

  it('切换成功:authFile 变为目标内容,当前态备份成新快照,sha 对账一致', () => {
    const plan = planSwitch(paths, 'workbuddy-desktop.target.info')
    const out = applySwitch(plan)
    expect(out.ok).toBe(true)
    expect(existsSync(plan.backupPath)).toBe(true)
    expect(sha12(paths.authFile)).toBe(out.newSha12)
    // 回滚闭环:备份内容 = 切换前的当前号
    expect(JSON.parse(readFileSync(plan.backupPath, 'utf8')).account.nickname).toBe('当前号')
    expect(JSON.parse(readFileSync(paths.authFile, 'utf8')).account.nickname).toBe('目标号')
  })

  it('切回旧快照即恢复(备份本身在快照库,构成可逆闭环)', () => {
    const preSwitchBody = readFileSync(paths.authFile, 'utf8')
    seedSnapshot('workbuddy-desktop.pre.info', preSwitchBody)
    const plan = planSwitch(paths, 'workbuddy-desktop.target.info')
    applySwitch(plan)
    const back = planSwitch(paths, 'workbuddy-desktop.pre.info')
    const out = applySwitch(back)
    expect(out.ok).toBe(true)
    expect(sha12(paths.authFile)).toBe(sha12(join(paths.backupsDir, 'workbuddy-desktop.pre.info')))
  })

  it('目标缺失/当前缺失都失败且不留半写', () => {
    const plan = planSwitch(paths, 'workbuddy-desktop.target.info')
    const r1 = applySwitch({ ...plan, targetPath: join(paths.backupsDir, 'ghost.info') })
    expect(r1.ok).toBe(false)
    const noAuth: SwitchPaths = { ...paths, authFile: join(root, 'auth', 'missing.info') }
    const plan2 = planSwitch(noAuth, 'workbuddy-desktop.target.info')
    const r2 = applySwitch(plan2)
    expect(r2.ok).toBe(false)
    expect(r2.error).toContain('不存在')
  })
})

describe('main CLI', () => {
  it('列表输出零泄漏(埋雷 token/refresh/手机号全不出现)', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前号'))
    seedSnapshot('workbuddy-desktop.20261026T110000Z.info', authBody('甲'))
    const lines: string[] = []
    const orig = console.log
    console.log = (s: string) => lines.push(s)
    const code = main([], paths)
    console.log = orig
    expect(code).toBe(0)
    assertNoSecretLeak(lines, [FAKE_TOKEN, FAKE_REFRESH, '13812345678'])
    expect(lines.join('\n')).toContain('138****5678')
  })

  it('dry-run 计划输出含备份落点且不写盘', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前号'))
    seedSnapshot('workbuddy-desktop.20261026T110000Z.info', authBody('甲'))
    const before = readdirSync(paths.backupsDir)
    const lines: string[] = []
    const orig = console.log
    console.log = (s: string) => lines.push(s)
    const code = main(['--to', 'workbuddy-desktop.20261026T110000Z.info'], paths)
    console.log = orig
    expect(code).toBe(0)
    expect(lines.join('\n')).toContain('dry-run')
    expect(readdirSync(paths.backupsDir)).toEqual(before)
  })

  it('fmtTarget 展示行零泄漏', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前号'))
    const { current } = listSwitchTargets(paths)
    const line = fmtTarget(current!)
    assertNoSecretLeak([line], [FAKE_TOKEN, FAKE_REFRESH, '13812345678'])
    expect(line).toContain('138****5678')
  })
})

// ── --with-sessions 一键联动换桶(第⑦刀收口) ──────────────────────────────
// 所有会话面都是临时目录夹具,绝不碰真实登录态/会话库。

const OLD_UID = 'u-old'
const NEW_UID = 'u-new'

function moveFixture(): MovePaths {
  return {
    sessionsRoot: join(root, 'sess'),
    projectsRoot: join(root, 'proj'),
    bucketsRoot: join(root, 'buckets'),
    backupsSessionsDir: join(root, 'bs'),
    opsLogFile: join(root, 'relay', 'move_ops.jsonl'),
    ledgerFile: join(root, 'relay', 'session_links.json'),
  }
}

function writeManifest(mp: MovePaths, now: Date): void {
  const dir = join(mp.backupsSessionsDir, 'snap-1')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({
      createdAt: now.toISOString(),
      source: { sessionsRoot: mp.sessionsRoot, projectsRoot: mp.projectsRoot },
      files: [],
    }),
  )
}

function writeLedger(mp: MovePaths, accounts: string[], links: Record<string, string>): void {
  mkdirSync(join(mp.ledgerFile, '..'), { recursive: true })
  writeFileSync(
    mp.ledgerFile,
    JSON.stringify({
      version: 1,
      accounts: accounts.map((a) => ({ accountId: a, label: a, since: '' })),
      links: Object.fromEntries(
        Object.entries(links).map(([c, a]) => [
          c,
          { accountId: a, linkedAt: 'x', linkedBy: 'auto-since' },
        ]),
      ),
    }),
  )
}

/** 造一个可换桶的会话库:当前账号会话在活库(projects),目标账号会话在其桶 */
function seedSwapStore(mp: MovePaths, now: Date, currentUid: string, targetUid: string): void {
  mkdirSync(mp.sessionsRoot, { recursive: true })
  mkdirSync(join(mp.projectsRoot, 'ws1'), { recursive: true })
  writeFileSync(join(mp.projectsRoot, 'ws1', 'conv-old.jsonl'), '{"line":1}')
  writeLedger(mp, [currentUid, targetUid], { 'conv-old': currentUid, 'conv-new': targetUid })
  writeManifest(mp, now)
  mkdirSync(join(mp.bucketsRoot, targetUid, 'workspace', 'sessions', 'conv-new'), {
    recursive: true,
  })
  writeFileSync(
    join(mp.bucketsRoot, targetUid, 'workspace', 'sessions', 'conv-new', 'meta.json'),
    '{"bucket":true}',
  )
}

function runCapture(fn: () => number): { code: number; out: string; err: string } {
  const o: string[] = []
  const e: string[] = []
  const lo = console.log
  const le = console.error
  console.log = (s?: unknown) => {
    o.push(String(s))
  }
  console.error = (s?: unknown) => {
    e.push(String(s))
  }
  let code = 0
  try {
    code = fn()
  } finally {
    console.log = lo
    console.error = le
  }
  return { code, out: o.join('\n'), err: e.join('\n') }
}

describe('main --with-sessions 联动换桶', () => {
  it('成功: auth 切换 + 会话换桶,各记 ops(一 move 一 restore)', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前', { uid: OLD_UID }))
    const snap = seedSnapshot(
      'workbuddy-desktop.target-new.info',
      authBody('目标', { uid: NEW_UID, domain: 'global.workbuddy.ai' }),
    )
    const mp = moveFixture()
    const now = new Date()
    seedSwapStore(mp, now, OLD_UID, NEW_UID)
    const origSha = sha12(paths.authFile)

    const r = runCapture(() =>
      main(['--to', 'workbuddy-desktop.target-new.info', '--apply', '--with-sessions'], paths, {
        movePaths: mp,
        now,
        runningProcs: [],
      }),
    )
    expect(r.code).toBe(0)
    expect(r.out).toContain('会话已联动换桶')
    assertNoSecretLeak([r.out, r.err], [FAKE_TOKEN, FAKE_REFRESH, '13812345678'])

    // auth 切到目标(不等于切换前)
    expect(sha12(paths.authFile)).toBe(sha12(snap))
    expect(sha12(paths.authFile)).not.toBe(origSha)
    // outbound:当前账号会话从活库搬进其桶
    expect(existsSync(join(mp.projectsRoot, 'ws1', 'conv-old.jsonl'))).toBe(false)
    expect(existsSync(join(mp.bucketsRoot, OLD_UID, 'projects', 'ws1', 'conv-old.jsonl'))).toBe(
      true,
    )
    // inbound:目标账号桶会话搬回活库
    expect(existsSync(join(mp.sessionsRoot, 'conv-new', 'meta.json'))).toBe(true)
    expect(
      existsSync(join(mp.bucketsRoot, NEW_UID, 'workspace', 'sessions', 'conv-new', 'meta.json')),
    ).toBe(false)
    // ops 记两条(换桶写面继承 move 的记账)
    const { ops } = readOpsAll(mp.opsLogFile)
    expect(ops).toHaveLength(2)
    expect(ops.map((op) => op.type).sort()).toEqual(['move', 'restore'])
  })

  it('换桶失败(planSwap 抛) → auth 用 pre-switch 回滚到切换前 sha,会话未换', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前', { uid: OLD_UID }))
    const snap = seedSnapshot(
      'workbuddy-desktop.t.info',
      authBody('目标', { uid: NEW_UID, domain: 'global.workbuddy.ai' }),
    )
    const origSha = sha12(paths.authFile)
    const mp = moveFixture() // 无台账/无当日快照 ⇒ planSwap 抛 ⇒ 回滚

    const r = runCapture(() =>
      main(['--to', 'workbuddy-desktop.t.info', '--apply', '--with-sessions'], paths, {
        movePaths: mp,
        now: new Date(),
        runningProcs: [],
      }),
    )
    expect(r.code).toBe(1)
    expect(r.err).toContain('auth 已回滚')
    // 会话面一条未记
    expect(readOpsAll(mp.opsLogFile).ops).toHaveLength(0)
    // auth 回到切换前内容(而非目标内容)
    expect(sha12(paths.authFile)).toBe(origSha)
    expect(sha12(paths.authFile)).not.toBe(sha12(snap))
  })

  it('客户端在跑 → 放弃换桶并回滚 auth', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前', { uid: OLD_UID }))
    seedSnapshot(
      'workbuddy-desktop.run.info',
      authBody('目标', { uid: NEW_UID, domain: 'global.workbuddy.ai' }),
    )
    const origSha = sha12(paths.authFile)
    const mp = moveFixture()
    const r = runCapture(() =>
      main(['--to', 'workbuddy-desktop.run.info', '--apply', '--with-sessions'], paths, {
        movePaths: mp,
        now: new Date(),
        runningProcs: ['WorkBuddy.exe,1234,Console'],
      }),
    )
    expect(r.code).toBe(1)
    expect(r.err).toContain('客户端仍在运行')
    expect(r.err).toContain('auth 已回滚')
    expect(sha12(paths.authFile)).toBe(origSha)
    expect(readOpsAll(mp.opsLogFile).ops).toHaveLength(0)
  })

  it('目标与当前同账号 → 不换桶(auth 保留切换结果)', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前', { uid: OLD_UID }))
    // 同 uid、不同内容(昵称不同 ⇒ 字节不同,planSwitch 不拒)
    const snap = seedSnapshot('workbuddy-desktop.sameacct.info', authBody('别名', { uid: OLD_UID }))
    const mp = moveFixture()
    const r = runCapture(() =>
      main(['--to', 'workbuddy-desktop.sameacct.info', '--apply', '--with-sessions'], paths, {
        movePaths: mp,
        now: new Date(),
        runningProcs: [],
      }),
    )
    expect(r.code).toBe(0)
    expect(r.out).toContain('会话无需换桶')
    // auth 停在切换后的目标内容(同账号无需换桶,也不回滚)
    expect(sha12(paths.authFile)).toBe(sha12(snap))
    expect(readOpsAll(mp.opsLogFile).ops).toHaveLength(0)
  })

  it('dry-run(--to 不带 --apply)带旗也绝不动 auth、不动会话', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前', { uid: OLD_UID }))
    seedSnapshot(
      'workbuddy-desktop.t2.info',
      authBody('目标', { uid: NEW_UID, domain: 'global.workbuddy.ai' }),
    )
    const origSha = sha12(paths.authFile)
    const beforeBackups = readdirSync(paths.backupsDir)
    const mp = moveFixture()
    const r = runCapture(() =>
      main(['--to', 'workbuddy-desktop.t2.info', '--with-sessions'], paths, {
        movePaths: mp,
        now: new Date(),
        runningProcs: [],
      }),
    )
    expect(r.code).toBe(0)
    expect(r.out).toContain('dry-run')
    expect(r.out).toContain('联动')
    expect(sha12(paths.authFile)).toBe(origSha)
    expect(readdirSync(paths.backupsDir)).toEqual(beforeBackups)
    expect(existsSync(mp.opsLogFile)).toBe(false)
    expect(existsSync(mp.sessionsRoot)).toBe(false)
  })

  it('不带 --with-sessions: 仅切 auth,会话面零触碰(回归)', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前', { uid: OLD_UID }))
    const snap = seedSnapshot(
      'workbuddy-desktop.noflag.info',
      authBody('目标', { uid: NEW_UID, domain: 'global.workbuddy.ai' }),
    )
    // deps 里放一个"一旦被动就会留下痕迹"的 movePaths,证明无旗时根本不调用
    const mp = moveFixture()
    const r = runCapture(() =>
      main(['--to', 'workbuddy-desktop.noflag.info', '--apply'], paths, {}),
    )
    expect(r.code).toBe(0)
    expect(r.out).toContain('已切换')
    expect(r.out).not.toContain('会话联动')
    expect(sha12(paths.authFile)).toBe(sha12(snap))
    // 现有逻辑:切换前当前态自动备份成 pre-switch 快照
    expect(readdirSync(paths.backupsDir).some((n) => /pre-switch\.info$/.test(n))).toBe(true)
    // 会话面完全没被碰(无旗 ⇒ 连 movePaths 都不会被读取)
    expect(existsSync(mp.opsLogFile)).toBe(false)
    expect(existsSync(mp.sessionsRoot)).toBe(false)
    expect(existsSync(mp.ledgerFile)).toBe(false)
  })
})

describe('rollbackAuth / runLinkedSessionSwap 单元', () => {
  it('rollbackAuth 用 pre-switch 快照原子还原到切换前内容', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('原'))
    seedSnapshot('workbuddy-desktop.rb.info', authBody('目标'))
    const plan = planSwitch(paths, 'workbuddy-desktop.rb.info')
    applySwitch(plan)
    const preSwitchSha = sha12(plan.backupPath)
    const rb = rollbackAuth(plan)
    expect(rb.ok).toBe(true)
    expect(rb.sha12).toBe(preSwitchSha)
    expect(sha12(paths.authFile)).toBe(preSwitchSha)
  })

  it('runLinkedSessionSwap: 目标缺 uid → no-target-uid(不换桶、不回滚)', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前', { uid: OLD_UID }))
    const noUid = JSON.stringify({ account: { nickname: '匿' }, auth: { accessToken: 'tok' } })
    seedSnapshot('workbuddy-desktop.nouid.info', noUid)
    const plan = planSwitch(paths, 'workbuddy-desktop.nouid.info')
    expect(plan.targetAccountId).toBeUndefined()
    applySwitch(plan)
    const res = runLinkedSessionSwap(plan, {
      movePaths: moveFixture(),
      now: new Date(),
      runningProcs: [],
    })
    expect(res.status).toBe('no-target-uid')
  })
})

// ── 客户端生命周期(桌面一键启动器:关 → 切 → 开) ─────────────────────────
// 判据全部注入:绝不真的关闭/拉起本机程序,也不落到真实 ~/.wb-switch。
describe('client lifecycle', () => {
  it('closeClientAndWait:本来没开 ⇒ 不执行关闭、零等待', () => {
    let closeCalls = 0
    const r = closeClientAndWait({
      probe: () => [],
      close: () => {
        closeCalls += 1
      },
    })
    expect(r).toEqual({ runningBefore: 0, ok: true, waitedMs: 0 })
    expect(closeCalls).toBe(0)
  })

  it('closeClientAndWait:优雅关闭后轮询到全部退出', () => {
    let alive = ['WorkBuddy.exe', 'WorkBuddy.exe']
    const seen: string[] = []
    const r = closeClientAndWait({
      probe: () => alive,
      close: (image) => {
        seen.push(image)
        alive = []
      },
      intervalMs: 1,
      gracefulMs: 50,
    })
    expect(r.ok).toBe(true)
    expect(r.runningBefore).toBe(2)
    expect(seen).toEqual(['WorkBuddy.exe'])
  })

  it('closeClientAndWait:关不掉 ⇒ 超时判失败(调用方据此中止,不动登录态)', () => {
    const r = closeClientAndWait({
      probe: () => ['WorkBuddy.exe'],
      close: () => {},
      intervalMs: 1,
      gracefulMs: 5,
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('仍有')
  })

  it('closeClientAndWait:优雅不退 ⇒ 强制关闭兜底并回报 forced(真机:WorkBuddy 托盘常驻)', () => {
    let alive = ['WorkBuddy.exe']
    const forcedCalls: string[] = []
    const r = closeClientAndWait({
      probe: () => alive,
      close: () => {},
      forceClose: (img) => {
        forcedCalls.push(img)
        alive = []
      },
      intervalMs: 1,
      gracefulMs: 3,
      forceWaitMs: 20,
    })
    expect(forcedCalls).toEqual(['WorkBuddy.exe'])
    expect(r.ok).toBe(true)
    expect(r.forced).toBe(true)
  })

  it('closeClientAndWait:关闭命令抛错 ⇒ 立即失败且带原因', () => {
    const r = closeClientAndWait({
      probe: () => ['WorkBuddy.exe'],
      close: () => {
        throw new Error('boom')
      },
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('boom')
  })

  it('resolveClientExe:env > registry > candidate > not-found', () => {
    expect(
      resolveClientExe({
        env: { IHUI_WORKBUDDY_EXE: 'D:/env/workbuddy.exe', LOCALAPPDATA: 'C:/LA' },
        exists: () => true,
        queryRegistry: () => 'R:/wb.exe',
      }),
    ).toEqual({ path: 'D:/env/workbuddy.exe', source: 'env:IHUI_WORKBUDDY_EXE' })

    expect(
      resolveClientExe({ env: {}, exists: () => true, queryRegistry: () => 'R:/wb.exe' }),
    ).toEqual({ path: 'R:/wb.exe', source: 'registry' })

    const candidate = join('C:/LA', 'Programs', 'WorkBuddy', 'WorkBuddy.exe')
    expect(
      resolveClientExe({
        env: { LOCALAPPDATA: 'C:/LA' },
        exists: (p) => p === candidate,
        queryRegistry: () => undefined,
      }),
    ).toEqual({ path: candidate, source: 'candidate' })

    expect(
      resolveClientExe({ env: {}, exists: () => false, queryRegistry: () => undefined }),
    ).toEqual({ source: 'not-found' })
  })

  it('main --close-client:关不掉 ⇒ exit 1 且登录态一个字节都没改', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前号'))
    seedSnapshot('workbuddy-desktop.target.info', authBody('目标号', { uid: NEW_UID }))
    const before = sha12(paths.authFile)

    const r = runCapture(() =>
      main(
        ['--one-click', '--to', 'workbuddy-desktop.target.info', '--apply', '--close-client'],
        paths,
        {
          clientLifecycle: {
            probe: () => ['WorkBuddy.exe'],
            close: () => {},
            intervalMs: 1,
            gracefulMs: 5,
          },
        },
      ),
    )
    expect(r.code).toBe(1)
    expect(r.err).toContain('关闭 WorkBuddy 失败')
    expect(sha12(paths.authFile)).toBe(before)
  })

  it('main --close-client --restart-client:关 → 切 → 换桶 → 重启客户端', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前号', { uid: OLD_UID }))
    seedSnapshot('workbuddy-desktop.target.info', authBody('目标号', { uid: NEW_UID }))
    const mp = moveFixture()
    const now = new Date()
    seedSwapStore(mp, now, OLD_UID, NEW_UID)
    const home = join(root, 'fake-home')
    mkdirSync(home, { recursive: true })

    const launched: string[] = []
    const closed: string[] = []
    let alive = ['WorkBuddy.exe']

    const r = runCapture(() =>
      main(
        [
          '--one-click',
          '--to',
          'workbuddy-desktop.target.info',
          '--apply',
          '--close-client',
          '--restart-client',
        ],
        paths,
        {
          home,
          now,
          movePaths: mp,
          runningProcs: [],
          clientLifecycle: {
            probe: () => alive,
            close: (img) => {
              closed.push(img)
              alive = []
            },
            resolveExe: () => ({ path: 'X:/WorkBuddy.exe', source: 'test' }),
            launch: (exe) => {
              launched.push(exe)
              return { ok: true }
            },
          },
        },
      ),
    )
    expect(r.code).toBe(0)
    expect(closed).toEqual(['WorkBuddy.exe'])
    expect(launched).toEqual(['X:/WorkBuddy.exe'])
    expect(r.out).toContain('已重新启动 WorkBuddy')
    expect(r.out).toContain('会话已联动换桶')
    // 会话库快照落在注入的 home 下,绝不写真实 ~/.wb-switch
    expect(existsSync(join(home, '.wb-switch', 'backups', 'sessions'))).toBe(true)
  })

  it('main dry-run + --close-client:不探测也不关客户端', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前号'))
    seedSnapshot('workbuddy-desktop.target.info', authBody('目标号', { uid: NEW_UID }))
    let probes = 0

    const r = runCapture(() =>
      main(['--one-click', '--to', 'workbuddy-desktop.target.info', '--close-client'], paths, {
        clientLifecycle: {
          probe: () => {
            probes += 1
            return ['WorkBuddy.exe']
          },
        },
      }),
    )
    expect(r.code).toBe(0)
    expect(probes).toBe(0)
  })

  it('ensureSessionBackup 与换桶同一判据:昨天有 manifest 仍必须建当日快照', () => {
    mkdirSync(join(paths.authFile, '..'), { recursive: true })
    writeFileSync(paths.authFile, authBody('当前号', { uid: OLD_UID }))
    seedSnapshot('workbuddy-desktop.target.info', authBody('目标号', { uid: NEW_UID }))
    const mp = moveFixture()
    const now = new Date()
    seedSwapStore(mp, now, OLD_UID, NEW_UID)

    const home = join(root, 'fake-home-stale')
    const sessionsRoot = join(home, '.workbuddy', 'workspace', 'sessions')
    const projectsRoot = join(home, '.workbuddy', 'projects')
    mkdirSync(sessionsRoot, { recursive: true })
    mkdirSync(projectsRoot, { recursive: true })
    // 昨天的一份 manifest:旧口径("任意 manifest 即就绪")会据此跳过备份,
    // 切完 auth 才被 planSwap 以"当日快照缺失"拒绝 ⇒ 白忙一场再回滚。
    const oldDir = join(home, '.wb-switch', 'backups', 'sessions', 'old')
    mkdirSync(oldDir, { recursive: true })
    writeFileSync(
      join(oldDir, 'manifest.json'),
      JSON.stringify({
        createdAt: new Date(now.getTime() - 86_400_000).toISOString(),
        source: { sessionsRoot, projectsRoot },
        files: [],
      }),
    )

    const r = runCapture(() =>
      main(['--one-click', '--to', 'workbuddy-desktop.target.info', '--apply'], paths, {
        home,
        now,
        movePaths: mp,
        runningProcs: [],
      }),
    )
    expect(r.code).toBe(0)
    const dirs = readdirSync(join(home, '.wb-switch', 'backups', 'sessions'))
    expect(dirs).toContain('old')
    expect(dirs.length).toBe(2) // 旧的还在 + 当日新建的那份
    expect(r.out).toContain('会话库快照已就绪')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
