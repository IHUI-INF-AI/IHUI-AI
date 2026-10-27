// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话备份腿测试(⑦第二刀)。fixture 注入临时目录,断言:
 * - 源目录零写入(备份前后源内容逐字节一致,且无任何新路径);
 * - 默认 dry-run,--apply 才拷贝;
 * - 产物逐文件 sha256 与 manifest 对账一致;
 * - 输出零内容回显(消息正文埋雷不出现)。
 */

import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  applyBackup,
  computeBackupPlan,
  formatPlan,
  relToSourceAbs,
  type BackupPlan,
} from '../scripts/relay-session-backup.js'

const SECRET_SENTINEL = 'TOPSECRET-CONVERSATION-BODY-9f3a'

function makeFixture(): { root: string; sessionsRoot: string; projectsRoot: string } {
  const root = mkdtempSync(join(tmpdir(), 'wb-backup-test-'))
  const sessionsRoot = join(root, 'sessions')
  const projectsRoot = join(root, 'projects')
  mkdirSync(join(sessionsRoot, 'sess-1'), { recursive: true })
  writeFileSync(join(sessionsRoot, 'sess-1', 'state.json'), '{"v":1}')
  writeFileSync(join(sessionsRoot, 'sess-1', 'transcript.jsonl'), `${SECRET_SENTINEL}\nline2\n`)
  mkdirSync(join(sessionsRoot, 'sess-2', 'nested'), { recursive: true })
  writeFileSync(join(sessionsRoot, 'sess-2', 'nested', 'a.json'), '{}')
  mkdirSync(join(projectsRoot, 'ws-a'), { recursive: true })
  writeFileSync(join(projectsRoot, 'ws-a', 'conv.jsonl'), 'hello\n')
  return { root, sessionsRoot, projectsRoot }
}

function snapshotDir(root: string): Map<string, string> {
  const out = new Map<string, string>()
  if (!existsSync(root)) return out
  const walk = (dir: string, base: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      const rel = base ? `${base}/${name}` : name
      if (statSync(p).isDirectory()) walk(p, rel)
      else out.set(rel, createHash('sha256').update(readFileSync(p)).digest('hex'))
    }
  }
  walk(root, '')
  return out
}

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

describe('computeBackupPlan', () => {
  it('收集两个源根全部文件,rel 用 POSIX 斜杠,workspace 前缀归会话库', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const plan = computeBackupPlan(
      fx.sessionsRoot,
      fx.projectsRoot,
      new Date('2026-10-27T02:15:00Z'),
      join(fx.root, 'dest'),
    )
    expect(plan.sourcePresent).toBe(true)
    expect(plan.files.map((f) => f.rel).sort()).toEqual([
      'workspace/sess-1/state.json',
      'workspace/sess-1/transcript.jsonl',
      'workspace/sess-2/nested/a.json',
      'ws-a/conv.jsonl',
    ])
    const transcript = plan.files.find((f) => f.rel === 'workspace/sess-1/transcript.jsonl')!
    expect(transcript.bytes).toBe(
      readFileSync(join(fx.sessionsRoot, 'sess-1', 'transcript.jsonl')).length,
    )
    expect(plan.totalBytes).toBe(plan.files.reduce((s, f) => s + f.bytes, 0))
  })

  it('relToSourceAbs:workspace/ 前缀映射回会话库,其余映射回 projects', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    expect(relToSourceAbs('workspace/sess-1/state.json', fx.sessionsRoot, fx.projectsRoot)).toBe(
      join(fx.sessionsRoot, 'sess-1', 'state.json'),
    )
    expect(relToSourceAbs('ws-a/conv.jsonl', fx.sessionsRoot, fx.projectsRoot)).toBe(
      join(fx.projectsRoot, 'ws-a', 'conv.jsonl'),
    )
  })

  it('源不存在时返回空计划但 sourcePresent=false(空快照合法)', () => {
    const plan = computeBackupPlan(
      'G:/definitely-missing-a',
      'G:/definitely-missing-b',
      new Date(),
      'G:/definitely-missing-dest',
    )
    expect(plan.files).toEqual([])
    expect(plan.sourcePresent).toBe(false)
  })
})

describe('formatPlan(零内容回显)', () => {
  it('预览文本含路径与字节,但绝不包含消息正文埋雷', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const plan = computeBackupPlan(
      fx.sessionsRoot,
      fx.projectsRoot,
      new Date(),
      join(fx.root, 'dest'),
    )
    const text = formatPlan(plan, true)
    expect(text).toContain('dry-run')
    expect(text).toContain('transcript.jsonl')
    expect(text).not.toContain(SECRET_SENTINEL)
  })
})

describe('applyBackup', () => {
  it('拷贝后源目录逐字节未变(零写入源),产物 sha256 与 manifest 全对账', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const before = {
      sessions: snapshotDir(fx.sessionsRoot),
      projects: snapshotDir(fx.projectsRoot),
    }
    const dest = join(fx.root, 'dest')
    const plan = computeBackupPlan(fx.sessionsRoot, fx.projectsRoot, new Date(), dest)

    const manifest = applyBackup(plan, {
      sessionsRoot: fx.sessionsRoot,
      projectsRoot: fx.projectsRoot,
    })

    // 源零写入:两个源根的文件快照与备份前逐字节一致,且源侧无新增路径
    expect(snapshotDir(fx.sessionsRoot)).toEqual(before.sessions)
    expect(snapshotDir(fx.projectsRoot)).toEqual(before.projects)

    // 产物对账:每文件 sha256 一致且 manifest 完整
    expect(manifest.files).toHaveLength(plan.files.length)
    for (const f of manifest.files) {
      const dstAbs = join(dest, ...f.rel.split('/'))
      expect(existsSync(dstAbs)).toBe(true)
      expect(createHash('sha256').update(readFileSync(dstAbs)).digest('hex')).toBe(f.sha256)
    }
    expect(existsSync(join(dest, 'manifest.json'))).toBe(true)
    // 无残留临时文件
    const leftovers = readdirSync(dest, { recursive: true }).filter((n) =>
      String(n).includes('.copying-'),
    )
    expect(leftovers).toEqual([])
  })

  it('sha 漂移(计划后源被改)→ 整批拒绝且不写漂移文件', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const dest = join(fx.root, 'dest2')
    const plan: BackupPlan = computeBackupPlan(fx.sessionsRoot, fx.projectsRoot, new Date(), dest)
    // 计划后篡改源内容(模拟漂移)
    writeFileSync(join(fx.sessionsRoot, 'sess-1', 'state.json'), '{"v":2}')
    expect(() =>
      applyBackup(plan, { sessionsRoot: fx.sessionsRoot, projectsRoot: fx.projectsRoot }),
    ).toThrow(/sha256 漂移/)
    // 漂移文件未被写入目的地
    expect(existsSync(join(dest, 'workspace', 'sess-1', 'state.json'))).toBe(false)
    // 未篡改的兄弟文件已成功保留(可重跑补齐语义)
    expect(existsSync(join(dest, 'ws-a', 'conv.jsonl'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
