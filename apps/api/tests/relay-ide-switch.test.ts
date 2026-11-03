// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  applyIdeSwitch,
  assertNoSecretLeak,
  captureCurrent,
  listSnapshots,
  main,
  planIdeSwitch,
  resolveBaseDir,
  readCurrentState,
  resolveProfiles,
  type IdeId,
  type IdeProfile,
  type IdeSwitchPaths,
} from '../scripts/relay-ide-switch.js'

const SECRET_A = 'iCubeAuthSecretPayloadForLeakTest0123456789'
const SECRET_B = 'qoderEncryptedDatPayloadLeakTest9876543210abc'

function makeFileProfile(
  root: string,
  id: IdeId,
  label: string,
): { profile: IdeProfile; baseDir: string } {
  const baseDir = join(root, id, 'globalStorage')
  const snapRoot = join(root, 'snaps', id)
  return {
    profile: {
      id,
      label,
      baseDirCandidates: [baseDir],
      files: ['storage.json'],
      snapRoot,
      loginHints: [SECRET_A.slice(0, 20)],
    },
    baseDir,
  }
}

function makeFilesetProfile(root: string): { profile: IdeProfile; baseDir: string } {
  const baseDir = join(root, 'qoder-app')
  return {
    profile: {
      id: 'qoder',
      label: 'Qoder CN',
      baseDirCandidates: [baseDir],
      files: ['auth.v1.dat', 'auth.machine-id', join('.auth', 'machine_id')],
      snapRoot: join(root, 'snaps', 'qoder'),
      loginHints: ['auth.v1.dat'],
    },
    baseDir,
  }
}

const sha12 = (p: string): string =>
  createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12)

const pathsOf = (profile: IdeProfile): IdeSwitchPaths => ({ profile, snapDir: profile.snapRoot })

describe('file 型 profile(trae 形态)', () => {
  function setup(root: string): IdeSwitchPaths {
    const { profile, baseDir } = makeFileProfile(root, 'trae', 'Trae CN')
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(
      join(baseDir, 'storage.json'),
      JSON.stringify({ ['k-' + SECRET_A.slice(0, 20)]: SECRET_A }),
    )
    return pathsOf(profile)
  }

  it('readCurrentState: 完整性+登录特征命中(只报数不报值)', () => {
    const root = mkdtempSync(join(tmpdir(), 'ide-switch-'))
    const paths = setup(root)
    const st = readCurrentState(paths.profile)
    expect(st.installed).toBe(true)
    expect(st.complete).toBe(true)
    expect(st.hintHits).toBe(1)
    expect(JSON.stringify(st)).not.toContain(SECRET_A)
  })

  it('capture→list→plan→apply→切回 全闭环;切换前自动 pre-switch 备份', () => {
    const root = mkdtempSync(join(tmpdir(), 'ide-switch-'))
    const paths = setup(root)
    const cap = captureCurrent(paths, 'acct-a')
    expect(cap.ok).toBe(true)
    expect(existsSync(join(paths.snapDir, 'acct-a', 'storage.json'))).toBe(true)

    // 模拟用户在客户端登录了另一个账号(直接改当前文件)
    writeFileSync(
      join(resolveBaseDir(paths.profile), 'storage.json'),
      JSON.stringify({ other: SECRET_B }),
    )
    const cap2 = captureCurrent(paths, 'acct-b')
    expect(cap2.ok).toBe(true)

    const snaps = listSnapshots(paths)
    expect(snaps.map((s) => s.name).sort()).toEqual(['acct-a', 'acct-b'])
    expect(snaps.find((s) => s.name === 'acct-b')!.sameAsCurrent).toBe(true)

    // 切回 acct-a
    const plan = planIdeSwitch(paths, 'acct-a')
    expect(plan.warnings.some((w) => w.includes('关闭'))).toBe(true)
    const out = applyIdeSwitch(paths, plan)
    expect(out.ok).toBe(true)
    expect(existsSync(plan.preSwitchBackupDir)).toBe(true) // acct-b 态已自动备份
    expect(sha12(join(resolveBaseDir(paths.profile), 'storage.json'))).toBe(
      sha12(join(paths.snapDir, 'acct-a', 'storage.json')),
    )
    // 泄漏守卫:备份目录与快照内容含密,但 apply 返回值只含 sha 与路径
    expect(JSON.stringify(out)).not.toContain(SECRET_A)
    expect(JSON.stringify(out)).not.toContain(SECRET_B)
  })

  it('同内容拒绝/快照缺失报错/坏快照名拒绝', () => {
    const root = mkdtempSync(join(tmpdir(), 'ide-switch-'))
    const paths = setup(root)
    captureCurrent(paths, 'same')
    expect(() => planIdeSwitch(paths, 'same')).toThrow(/逐字节相同/)
    expect(() => planIdeSwitch(paths, 'ghost')).toThrow(/快照不存在/)
    expect(captureCurrent(paths, '../evil').ok).toBe(false)
  })
})

describe('fileset 型 profile(qoder 形态)', () => {
  function setup(root: string): IdeSwitchPaths {
    const { profile, baseDir } = makeFilesetProfile(root)
    mkdirSync(join(baseDir, '.auth'), { recursive: true })
    writeFileSync(join(baseDir, 'auth.v1.dat'), SECRET_B)
    writeFileSync(join(baseDir, 'auth.machine-id'), 'machine-uuid-aaaaaaaaaaaaaaaaaaaa')
    writeFileSync(join(baseDir, '.auth', 'machine_id'), 'inner-machine-uuid-bbbbbbbbbbbbbbbb')
    return pathsOf(profile)
  }

  it('四件套完整性判定;快照整集捕获整集恢复', () => {
    const root = mkdtempSync(join(tmpdir(), 'ide-switch-'))
    const paths = setup(root)
    const st = readCurrentState(paths.profile)
    expect(st.complete).toBe(true)
    expect(st.hintHits).toBe(3)

    captureCurrent(paths, 'q-acct1')
    // 改整套(模拟另一账号登录)
    writeFileSync(join(resolveBaseDir(paths.profile), 'auth.v1.dat'), SECRET_A)
    writeFileSync(
      join(resolveBaseDir(paths.profile), 'auth.machine-id'),
      'machine-uuid-cccccccccccccccccccc',
    )
    const plan = planIdeSwitch(paths, 'q-acct1')
    const out = applyIdeSwitch(paths, plan)
    expect(out.ok).toBe(true)
    // 整集恢复:三个文件全部回到快照态
    expect(readFileSync(join(resolveBaseDir(paths.profile), 'auth.v1.dat'), 'utf8')).toBe(SECRET_B)
    expect(readFileSync(join(resolveBaseDir(paths.profile), 'auth.machine-id'), 'utf8')).toBe(
      'machine-uuid-aaaaaaaaaaaaaaaaaaaa',
    )
    expect(existsSync(join(resolveBaseDir(paths.profile), 'auth.machine-id') + '.switching-')).toBe(
      false,
    )
    expect(JSON.stringify(out)).not.toContain(SECRET_B)
  })

  it('文件集不完整的当前态拒绝 capture', () => {
    const root = mkdtempSync(join(tmpdir(), 'ide-switch-'))
    const { profile, baseDir } = makeFilesetProfile(root)
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(join(baseDir, 'auth.v1.dat'), 'x') // 缺另外两件
    const r = captureCurrent(pathsOf(profile), 'incomplete')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('不完整')
  })
})

describe('main CLI(注入 profiles)', () => {
  it('无 --ide 列三 profile 现状,零泄漏', () => {
    const root = mkdtempSync(join(tmpdir(), 'ide-switch-'))
    const { profile, baseDir } = makeFileProfile(root, 'trae', 'Trae CN')
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(join(baseDir, 'storage.json'), JSON.stringify({ a: SECRET_A }))
    const profiles = resolveProfiles(root)
    profiles['trae'] = profile
    profiles['qoder'] = makeFilesetProfile(root).profile
    profiles['trae-solo'] = makeFileProfile(root, 'trae-solo', 'SOLO').profile
    const lines: string[] = []
    const orig = console.log
    console.log = (s: string) => lines.push(s)
    const code = main([], profiles)
    console.log = orig
    expect(code).toBe(0)
    assertNoSecretLeak(lines, [SECRET_A, SECRET_B])
  })

  it('capture/--to/--apply 全命令链', () => {
    const root = mkdtempSync(join(tmpdir(), 'ide-switch-'))
    const { profile, baseDir } = makeFileProfile(root, 'trae', 'Trae CN')
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(join(baseDir, 'storage.json'), JSON.stringify({ a: SECRET_A }))
    const profiles = { trae: profile, 'trae-solo': profile, qoder: profile }
    const origLog = console.log
    const lines: string[] = []
    console.log = (s: string) => lines.push(s)
    expect(main(['--ide', 'trae', 'capture', '--name', 'w1'], profiles)).toBe(0)
    writeFileSync(join(baseDir, 'storage.json'), JSON.stringify({ b: SECRET_B }))
    expect(main(['--ide', 'trae', '--to', 'w1'], profiles)).toBe(0) // dry-run
    expect(lines.join('\n')).toContain('dry-run')
    expect(main(['--ide', 'trae', '--to', 'w1', '--apply'], profiles)).toBe(0)
    console.log = origLog
    expect(readFileSync(join(baseDir, 'storage.json'), 'utf8')).toContain(SECRET_A.slice(0, 20))
    assertNoSecretLeak(lines, [SECRET_A, SECRET_B])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
