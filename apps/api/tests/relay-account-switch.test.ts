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
  fmtTarget,
  listSwitchTargets,
  main,
  planSwitch,
  type SwitchPaths,
} from '../scripts/relay-account-switch.js'

const FAKE_TOKEN = 'eyJfakeJWTtokenFORLEAKTEST1234567890abcdef'
const FAKE_REFRESH = 'rt_fake_refresh_secret_0123456789'

let root: string
let paths: SwitchPaths

function authBody(nickname: string, opts: { expired?: boolean; domain?: string } = {}): string {
  const exp = new Date(Date.now() + (opts.expired ? -3600_000 : 86_400_000)).toISOString()
  return JSON.stringify({
    account: { nickname, phoneNumber: '13812345678', uid: 'u-1' },
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
