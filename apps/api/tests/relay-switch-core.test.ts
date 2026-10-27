// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  applySwitch,
  captureCurrent,
  checkCoherence,
  collectSecretLiterals,
  listSnapshots,
  loadExternalTargets,
  planSwitch,
  readCurrentState,
  type SwitchTarget,
} from '../scripts/relay-switch-core.js'
import { resolveTargets } from '../scripts/relay-switch-profiles.js'
import { loadCatalog, main } from '../scripts/relay-switch.js'

const SECRET_A = 'iCubeAuthSecretPayloadForLeakTest0123456789'
const SECRET_B = 'qoderEncryptedDatPayloadLeakTest9876543210abc'

const sha12 = (p: string): string =>
  createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12)

/** 临时目录根(全部用例都跑在 os.tmpdir() 下,绝不触碰真实 ~/.minimax / ~/.zcode / ~/.codex / AppData) */
function tmpRoot(tag: string): string {
  return mkdtempSync(join(tmpdir(), `relay-switch-${tag}-`))
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2))
}

/** 造一个 file 型目标(content-scan 口径) */
function fileTarget(root: string, id: string, hints: string[]): SwitchTarget {
  const baseDir = join(root, id)
  return {
    id,
    label: id,
    kind: 'desktop',
    baseDirCandidates: [baseDir],
    files: ['auth.json'],
    snapRoot: join(root, 'snaps', id),
    loginHints: hints,
    hintMode: 'content-scan',
    requiresStoppedApp: true,
  }
}

/** 造一个 file-count 口径目标(命中数 = 已存在文件数) */
function filesetTarget(root: string, id: string): SwitchTarget {
  const baseDir = join(root, id)
  return {
    id,
    label: id,
    kind: 'ide',
    baseDirCandidates: [baseDir],
    files: ['a.dat', 'b.dat', 'c.dat'],
    snapRoot: join(root, 'snaps', id),
    loginHints: ['a.dat'],
    hintMode: 'file-count',
    requiresStoppedApp: true,
  }
}

describe('外部 profile 装载(只当数据读,非法逐条跳过不整体崩)', () => {
  it('合法文件生效;id/字段/JSON 各类非法逐条跳过并如实报错', () => {
    const root = tmpRoot('ext')
    const dir = join(root, 'profiles')
    mkdirSync(dir, { recursive: true })

    // 合法
    writeJson(join(dir, 'my-client.json'), {
      id: 'my-client',
      label: '我的客户端',
      kind: 'desktop',
      baseDirCandidates: [join(root, 'my-client')],
      files: ['auth.json'],
      snapRoot: join(root, 'snaps', 'my-client'),
      loginHints: ['accessToken'],
      hintMode: 'content-scan',
      requiresStoppedApp: true,
      notes: ['可选说明'],
    })
    // 非法 id(大写 / 空格 / 超长)
    writeJson(join(dir, 'bad-id.json'), {
      id: 'Bad ID',
      label: 'x',
      baseDirCandidates: [root],
      files: ['auth.json'],
      snapRoot: join(root, 's'),
      loginHints: [],
      hintMode: 'content-scan',
    })
    // 缺字段(files 空)
    writeJson(join(dir, 'missing-files.json'), {
      id: 'missing-files',
      label: 'x',
      baseDirCandidates: [root],
      files: [],
      snapRoot: join(root, 's'),
      loginHints: [],
      hintMode: 'content-scan',
    })
    // 缺字段(baseDirCandidates 空)
    writeJson(join(dir, 'missing-base.json'), {
      id: 'missing-base',
      label: 'x',
      baseDirCandidates: [],
      files: ['auth.json'],
      snapRoot: join(root, 's'),
      loginHints: [],
      hintMode: 'content-scan',
    })
    // files 越界(绝对路径 / ..)
    writeJson(join(dir, 'unsafe-files.json'), {
      id: 'unsafe-files',
      label: 'x',
      baseDirCandidates: [root],
      files: ['../escape.json'],
      snapRoot: join(root, 's'),
      loginHints: [],
      hintMode: 'content-scan',
    })
    // 非法 JSON
    writeFileSync(join(dir, 'broken.json'), '{ this is not json ')
    // 非法 hintMode
    writeJson(join(dir, 'bad-mode.json'), {
      id: 'bad-mode',
      label: 'x',
      baseDirCandidates: [root],
      files: ['auth.json'],
      snapRoot: join(root, 's'),
      loginHints: [],
      hintMode: 'regex',
    })

    const res = loadExternalTargets(dir)
    expect(res.targets.map((t) => t.id)).toEqual(['my-client'])
    expect(res.targets[0]!.label).toBe('我的客户端')
    expect(res.targets[0]!.files).toEqual(['auth.json'])
    expect(res.targets[0]!.notes).toEqual(['可选说明'])

    // 6 个非法文件全部逐条报错,整体不崩
    expect(res.errors).toHaveLength(6)
    const joined = res.errors.map((e) => `${e.file}:${e.error}`).join('\n')
    expect(joined).toContain('bad-id.json')
    expect(joined).toContain('id 非法')
    expect(joined).toContain('missing-files.json')
    expect(joined).toContain('files 必须是非空字符串数组')
    expect(joined).toContain('missing-base.json')
    expect(joined).toContain('baseDirCandidates 必须是非空字符串数组')
    expect(joined).toContain('unsafe-files.json')
    expect(joined).toContain('非法路径')
    expect(joined).toContain('broken.json')
    expect(joined).toContain('非法 JSON')
    expect(joined).toContain('bad-mode.json')
    expect(joined).toContain('hintMode 非法')
  })

  it('id 与内置冲突:外部跳过并报错,不覆盖内置', () => {
    const root = tmpRoot('conflict')
    const dir = join(root, 'profiles')
    mkdirSync(dir, { recursive: true })
    writeJson(join(dir, 'qoder.json'), {
      id: 'qoder',
      label: '冒牌 Qoder',
      baseDirCandidates: [join(root, 'fake')],
      files: ['auth.json'],
      snapRoot: join(root, 's'),
      loginHints: [],
      hintMode: 'content-scan',
    })
    const res = loadExternalTargets(dir, { reservedIds: ['qoder'] })
    expect(res.targets).toHaveLength(0)
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0]!.error).toContain('id 与内置目标冲突')
    expect(res.errors[0]!.error).toContain('qoder')
  })

  it('profile 目录不存在 ⇒ 空结果不报错', () => {
    const res = loadExternalTargets(join(tmpRoot('nodir'), 'not-exist'))
    expect(res.targets).toEqual([])
    expect(res.errors).toEqual([])
  })

  it('外部 profile 只当数据读:含可执行载荷的内容不会被执行', () => {
    const root = tmpRoot('noexec')
    const dir = join(root, 'profiles')
    mkdirSync(dir, { recursive: true })
    // 文件里塞一段"若被执行就会炸"的字符串;装载后不得有任何副作用
    writeJson(join(dir, 'payload.json'), {
      id: 'payload',
      label: 'x',
      baseDirCandidates: [root],
      files: ['auth.json'],
      snapRoot: join(root, 's'),
      loginHints: [],
      hintMode: 'content-scan',
      notes: ['__proto__ polluted'],
    })
    const res = loadExternalTargets(dir)
    expect(res.targets).toHaveLength(1)
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })
})

describe('hintMode 两分支', () => {
  it('content-scan:主文件文本里搜特征串,只报命中数', () => {
    const root = tmpRoot('scan')
    const t = fileTarget(root, 'scan-app', ['accessToken', 'refreshToken', 'notThere'])
    mkdirSync(join(root, 'scan-app'), { recursive: true })
    writeFileSync(
      join(root, 'scan-app', 'auth.json'),
      JSON.stringify({ accessToken: SECRET_A, refreshToken: SECRET_B }),
    )
    const st = readCurrentState(t)
    expect(st.installed).toBe(true)
    expect(st.complete).toBe(true)
    expect(st.hintHits).toBe(2)
    expect(JSON.stringify(st)).not.toContain(SECRET_A)
  })

  it('file-count:文件存在即命中,不读内容', () => {
    const root = tmpRoot('count')
    const t = filesetTarget(root, 'count-app')
    mkdirSync(join(root, 'count-app'), { recursive: true })
    writeFileSync(join(root, 'count-app', 'a.dat'), 'x')
    writeFileSync(join(root, 'count-app', 'b.dat'), 'y')
    const st = readCurrentState(t)
    expect(st.hintHits).toBe(2) // 只数存在文件数
    expect(st.complete).toBe(false)
    expect(st.missingFiles).toEqual(['c.dat'])
  })
})

describe('capture / list / plan / apply 全流程(临时目录)', () => {
  it('登记快照 → 改当前态 → dry-run 计划 → apply → pre-switch 备份 + sha 对账', () => {
    const root = tmpRoot('flow')
    const t = fileTarget(root, 'flow-app', ['accessToken'])
    const baseDir = join(root, 'flow-app')
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(join(baseDir, 'auth.json'), JSON.stringify({ accessToken: SECRET_A }))
    const paths = { target: t, snapDir: t.snapRoot }

    // capture
    const captured = captureCurrent(paths, 'acct-a')
    expect(captured.ok).toBe(true)
    expect(existsSync(join(t.snapRoot, 'acct-a', 'auth.json'))).toBe(true)

    // 模拟用户切到另一账号
    writeFileSync(join(baseDir, 'auth.json'), JSON.stringify({ accessToken: SECRET_B }))
    const captured2 = captureCurrent(paths, 'acct-b')
    expect(captured2.ok).toBe(true)

    // list
    const snaps = listSnapshots(paths)
    expect(snaps.map((s) => s.name).sort()).toEqual(['acct-a', 'acct-b'])
    expect(snaps.find((s) => s.name === 'acct-b')!.sameAsCurrent).toBe(true)

    // plan(dry-run 计划本身不落盘)
    const plan = planSwitch(paths, 'acct-a')
    expect(plan.warnings.some((w) => w.includes('关闭'))).toBe(true)
    expect(existsSync(plan.preSwitchBackupDir)).toBe(false)

    // apply
    const out = applySwitch(paths, plan)
    expect(out.ok).toBe(true)
    // pre-switch 备份已生成(acct-b 态)
    expect(existsSync(plan.preSwitchBackupDir)).toBe(true)
    expect(readFileSync(join(plan.preSwitchBackupDir, 'auth.json'), 'utf8')).toContain(SECRET_B)
    // sha256 对账:当前文件与快照逐字节一致
    expect(sha12(join(baseDir, 'auth.json'))).toBe(sha12(join(t.snapRoot, 'acct-a', 'auth.json')))
    // 返回值零凭据
    expect(JSON.stringify(out)).not.toContain(SECRET_A)
    expect(JSON.stringify(out)).not.toContain(SECRET_B)
  })

  it('supported === false 的目标:capture 与 plan 都直接拒绝并说明原因', () => {
    const root = tmpRoot('unsupported')
    const t: SwitchTarget = {
      ...filesetTarget(root, 'sqlite-app'),
      supported: false,
      unsupportedReason: 'sqlite SecretStorage 提取器未实现,仅探测',
    }
    const baseDir = join(root, 'sqlite-app')
    mkdirSync(baseDir, { recursive: true })
    for (const f of t.files) writeFileSync(join(baseDir, f), 'x')
    const paths = { target: t, snapDir: t.snapRoot }

    const cap = captureCurrent(paths, 'nope')
    expect(cap.ok).toBe(false)
    expect(cap.error).toContain('未支持')
    expect(cap.error).toContain('sqlite SecretStorage 提取器未实现')

    expect(() => planSwitch(paths, 'nope')).toThrow(/未支持/)
  })
})

describe('一致性规则(minimax generation 不一致 ⇒ 计划阶段拒绝)', () => {
  it('generation 交集为空 ⇒ 判不一致并拒绝切换', () => {
    const root = tmpRoot('coherence')
    const baseDir = join(root, 'minimax')
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(
      join(baseDir, 'auth.json'),
      JSON.stringify({ records: { 'acct-a': { generation: 111, accessToken: SECRET_A } } }),
    )
    writeFileSync(join(baseDir, 'auth-state.json'), JSON.stringify({ generation: 222 }))
    const t: SwitchTarget = {
      id: 'minimax-code',
      label: 'MiniMax Code',
      kind: 'desktop',
      baseDirCandidates: [baseDir],
      files: ['auth.json', 'auth-state.json'],
      snapRoot: join(root, 'snaps', 'minimax'),
      loginHints: ['accessToken', 'refreshToken'],
      hintMode: 'content-scan',
      requiresStoppedApp: true,
      coherence: { files: ['auth.json', 'auth-state.json'], field: 'generation' },
    }
    const coh = checkCoherence(t, baseDir)
    expect(coh.ok).toBe(false)
    expect(coh.detail).toContain('generation')

    // 登记一个不一致的快照 ⇒ plan 阶段拒绝(防半切换态)
    const paths = { target: t, snapDir: t.snapRoot }
    const cap = captureCurrent(paths, 'half')
    expect(cap.ok).toBe(true)
    expect(() => planSwitch(paths, 'half')).toThrow(/一致性校验未通过/)
  })

  it('generation 一致 ⇒ 允许切换', () => {
    const root = tmpRoot('coherence-ok')
    const baseDir = join(root, 'minimax')
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(
      join(baseDir, 'auth.json'),
      JSON.stringify({ records: { 'acct-a': { generation: 432, accessToken: SECRET_A } } }),
    )
    writeFileSync(join(baseDir, 'auth-state.json'), JSON.stringify({ generation: 432 }))
    const t: SwitchTarget = {
      id: 'minimax-code',
      label: 'MiniMax Code',
      kind: 'desktop',
      baseDirCandidates: [baseDir],
      files: ['auth.json', 'auth-state.json'],
      snapRoot: join(root, 'snaps', 'minimax'),
      loginHints: ['accessToken', 'refreshToken'],
      hintMode: 'content-scan',
      requiresStoppedApp: true,
      coherence: { files: ['auth.json', 'auth-state.json'], field: 'generation' },
    }
    expect(checkCoherence(t, baseDir).ok).toBe(true)
    const paths = { target: t, snapDir: t.snapRoot }
    expect(captureCurrent(paths, 'good').ok).toBe(true)
    // 当前态与快照相同 ⇒ 报"逐字节相同";改过当前态后即允许切换
    expect(() => planSwitch(paths, 'good')).toThrow(/逐字节相同/)
    writeFileSync(
      join(baseDir, 'auth.json'),
      JSON.stringify({ records: { 'acct-b': { generation: 432, accessToken: SECRET_B } } }),
    )
    expect(() => planSwitch(paths, 'good')).not.toThrow()
  })
})

describe('relay-switch.ts CLI(注入临时目录)', () => {
  function setupCli(): { root: string; target: SwitchTarget; logs: string[]; errs: string[] } {
    const root = tmpRoot('cli')
    const target = fileTarget(root, 'cli-app', ['accessToken'])
    mkdirSync(join(root, 'cli-app'), { recursive: true })
    writeFileSync(join(root, 'cli-app', 'auth.json'), JSON.stringify({ accessToken: SECRET_A }))
    return { root, target, logs: [], errs: [] }
  }

  function withCapture(fn: (logs: string[], errs: string[]) => number): {
    code: number
    logs: string[]
    errs: string[]
  } {
    const logs: string[] = []
    const errs: string[] = []
    const origLog = console.log
    const origErr = console.error
    console.log = (s: string) => logs.push(s)
    console.error = (s: string) => errs.push(s)
    let code = 0
    try {
      code = fn(logs, errs)
    } finally {
      console.log = origLog
      console.error = origErr
    }
    return { code, logs, errs }
  }

  it('list:输出目标现状且零凭据回显', () => {
    const { target } = setupCli()
    const { code, logs } = withCapture(() => main(['list'], { targets: [target] }))
    expect(code).toBe(0)
    const text = logs.join('\n')
    expect(text).toContain('cli-app')
    expect(text).not.toContain(SECRET_A)
  })

  it('targets:输出定义(路径/形态/是否支持),零凭据', () => {
    const { target } = setupCli()
    const { code, logs } = withCapture(() => main(['targets'], { targets: [target] }))
    expect(code).toBe(0)
    const text = logs.join('\n')
    expect(text).toContain('kind=desktop')
    expect(text).toContain('hintMode=content-scan')
    expect(text).not.toContain(SECRET_A)
  })

  it('capture → --to(dry-run) → --to --apply 全链路', () => {
    const { root, target, logs } = setupCli()
    const baseDir = join(root, 'cli-app')

    const cap = withCapture(() =>
      main(['capture', '--target', 'cli-app', '--name', 'w1'], { targets: [target] }),
    )
    expect(cap.code).toBe(0)
    expect(existsSync(join(target.snapRoot, 'w1', 'auth.json'))).toBe(true)

    // 换成另一账号
    writeFileSync(join(baseDir, 'auth.json'), JSON.stringify({ accessToken: SECRET_B }))

    const dry = withCapture(() =>
      main(['--target', 'cli-app', '--to', 'w1'], { targets: [target] }),
    )
    expect(dry.code).toBe(0)
    expect(dry.logs.join('\n')).toContain('dry-run')
    // dry-run 不写盘
    expect(readFileSync(join(baseDir, 'auth.json'), 'utf8')).toContain(SECRET_B)

    const applied = withCapture(() =>
      main(['--target', 'cli-app', '--to', 'w1', '--apply'], { targets: [target] }),
    )
    expect(applied.code).toBe(0)
    expect(readFileSync(join(baseDir, 'auth.json'), 'utf8')).toContain(SECRET_A)
    // 全链路输出零凭据
    expect(logs.join('\n')).not.toContain(SECRET_A)
    expect(logs.join('\n')).not.toContain(SECRET_B)
  })

  it('supported === false 的目标:capture / --to 直接拒绝并说明原因', () => {
    const root = tmpRoot('cli-unsupported')
    const target: SwitchTarget = {
      ...filesetTarget(root, 'sqlite-app'),
      supported: false,
      unsupportedReason: 'sqlite SecretStorage 提取器未实现,仅探测',
    }
    mkdirSync(join(root, 'sqlite-app'), { recursive: true })
    for (const f of target.files) writeFileSync(join(root, 'sqlite-app', f), 'x')

    const cap = withCapture(() =>
      main(['capture', '--target', 'sqlite-app', '--name', 'x'], { targets: [target] }),
    )
    expect(cap.code).toBe(2)
    expect(cap.errs.join('\n')).toContain('未支持')
    expect(cap.errs.join('\n')).toContain('sqlite SecretStorage 提取器未实现')

    const to = withCapture(() =>
      main(['--target', 'sqlite-app', '--to', 'x'], { targets: [target] }),
    )
    expect(to.code).toBe(2)
    expect(to.errs.join('\n')).toContain('未支持')
  })

  it('未知 --target ⇒ 退出码 2', () => {
    const { target } = setupCli()
    const { code, errs } = withCapture(() =>
      main(['--target', 'ghost', '--to', 'x'], { targets: [target] }),
    )
    expect(code).toBe(2)
    expect(errs.join('\n')).toContain('未知 --target')
  })
})

describe('内置目标注册表与外部目录装载(注入临时目录)', () => {
  it('resolveTargets:9 个内置目标齐备,路径形态符合一手取证', () => {
    const root = tmpRoot('builtins')
    const targets = resolveTargets(root, join(root, 'AppData', 'Roaming'))
    const ids = targets.map((t) => t.id)
    expect(ids).toEqual([
      'trae',
      'trae-solo',
      'qoder',
      'minimax-code',
      'zcode',
      'codearts-agent',
      'qianfan',
      'codex',
      'opencode',
    ])

    const minimax = targets.find((t) => t.id === 'minimax-code')!
    expect(minimax.baseDirCandidates[0]).toBe(
      join(root, '.minimax', 'auth', 'prod', 'cn', 'mcode-public'),
    )
    expect(minimax.files).toEqual(['auth.json', 'auth-state.json'])
    expect(minimax.hintMode).toBe('content-scan')
    expect(minimax.coherence?.field).toBe('generation')

    const zcode = targets.find((t) => t.id === 'zcode')!
    expect(zcode.baseDirCandidates[0]).toBe(join(root, '.zcode', 'v2'))
    expect(zcode.files).toEqual(['credentials.json'])
    expect(zcode.auxFiles?.length).toBeGreaterThan(0)
    expect(zcode.loginHints).toEqual(['enc:v1:'])

    const codearts = targets.find((t) => t.id === 'codearts-agent')!
    expect(codearts.supported).toBe(false)
    expect(codearts.unsupportedReason).toContain('sqlite SecretStorage 提取器未实现')

    const codex = targets.find((t) => t.id === 'codex')!
    expect(codex.kind).toBe('cli')
    expect(codex.requiresStoppedApp).toBe(false)
    expect(codex.notes?.join('')).toContain('非平台 OAuth 登录态')

    const opencode = targets.find((t) => t.id === 'opencode')!
    expect(opencode.baseDirCandidates[0]).toBe(join(root, '.local', 'share', 'opencode'))

    const qianfan = targets.find((t) => t.id === 'qianfan')!
    expect(qianfan.files).toEqual(['auth.json', '.cookie-key'])
    expect(qianfan.baseDirCandidates[0]).toBe(
      join(root, 'AppData', 'Roaming', 'qianfan-desktop-app'),
    )
  })

  it('loadCatalog:内置 + 外部合并,外部 id 冲突如实报错', () => {
    const root = tmpRoot('catalog')
    const profileDir = join(root, '.wb-switch', 'switch-profiles')
    mkdirSync(profileDir, { recursive: true })
    writeJson(join(profileDir, 'mine.json'), {
      id: 'mine',
      label: '我的',
      baseDirCandidates: [join(root, 'mine')],
      files: ['auth.json'],
      snapRoot: join(root, 'snaps', 'mine'),
      loginHints: [],
      hintMode: 'content-scan',
    })
    writeJson(join(profileDir, 'dupe.json'), {
      id: 'trae',
      label: '冒牌',
      baseDirCandidates: [join(root, 'fake')],
      files: ['storage.json'],
      snapRoot: join(root, 'snaps', 'fake'),
      loginHints: [],
      hintMode: 'content-scan',
    })

    const cat = loadCatalog({
      home: root,
      profileDir,
      appDataRoaming: join(root, 'AppData', 'Roaming'),
    })
    expect(cat.builtinCount).toBe(9)
    expect(cat.externalCount).toBe(1)
    expect(cat.targets.map((t) => t.id)).toContain('mine')
    expect(cat.errors).toHaveLength(1)
    expect(cat.errors[0]!.error).toContain('id 与内置目标冲突')
    // 内置 trae 未被外部覆盖
    const trae = cat.targets.find((t) => t.id === 'trae')!
    expect(trae.label).toBe('Trae CN')
  })

  it('collectSecretLiterals:只取长字面量,且可排除路径串', () => {
    const root = tmpRoot('secrets')
    const baseDir = join(root, 'app')
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(
      join(baseDir, 'auth.json'),
      JSON.stringify({ accessToken: SECRET_A, short: 'tiny', path: baseDir }),
    )
    const t = fileTarget(root, 'app', ['accessToken'])
    const literals = collectSecretLiterals(t, baseDir, [baseDir])
    expect(literals).toContain(SECRET_A)
    expect(literals).not.toContain('tiny')
    expect(literals.some((l) => l.includes(baseDir))).toBe(false)
  })

  it('collectSecretLiterals:二进制文件(sqlite 等)跳过取材,避免键名被当凭据误报', () => {
    const root = tmpRoot('binary')
    const baseDir = join(root, 'sqlite-app')
    mkdirSync(baseDir, { recursive: true })
    // 模拟 sqlite:含 NUL 字节 + 一段像 JSON 长字面量的键名
    writeFileSync(
      join(baseDir, 'state.vscdb'),
      Buffer.from([0x00, 0x01, 0x02, ...Buffer.from('"huaweicloud.authentication"', 'utf8')]),
    )
    const t: SwitchTarget = {
      ...fileTarget(root, 'sqlite-app', ['state.vscdb']),
      files: ['state.vscdb'],
      hintMode: 'file-count',
    }
    expect(collectSecretLiterals(t, baseDir)).toEqual([])
  })

  it('readCurrentState:旁证文件命中数去重(同址候选不重复计数)', () => {
    const root = tmpRoot('aux-dedup')
    const baseDir = join(root, 'aux-app')
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(join(baseDir, 'auth.json'), JSON.stringify({ accessToken: SECRET_A }))
    const keyFile = join(baseDir, 'Local State')
    writeFileSync(keyFile, 'key-material')
    const t: SwitchTarget = {
      ...fileTarget(root, 'aux-app', ['accessToken']),
      auxFiles: [keyFile, join(baseDir, 'Local State')],
    }
    const st = readCurrentState(t)
    expect(st.auxPresent).toEqual([keyFile])
    expect(st.auxPresent).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
