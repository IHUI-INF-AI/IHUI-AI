// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { CheckpointManager } from '../src/checkpoints/index.js'
import { HunkCheckpointManager } from '../src/checkpoints/hunks.js'

/**
 * G-671(2026-10-01)checkpoint manifest 损坏隔离 —— 票面验收:
 * "坏 JSON ⇒ 隔离件在、账面有名字"。覆盖 parse-failed / shape-invalid /
 * schemaVersion 不识别 / ENOENT 分流 / get() 同出口 / hunk 版同出口。
 * 用独立 sessionId + afterEach 整目录清除,不与既有用例的 test-session-1 互相污染。
 */
describe('G-671 checkpoint manifest 损坏隔离', () => {
  let sid: string
  let workspaceDir: string
  let baseDir: string
  let mgr: CheckpointManager
  let warnSpy: ReturnType<typeof vi.fn>

  const makeCpDir = (id: string, manifestContent: string | null) => {
    const dir = path.join(baseDir, id)
    fs.mkdirSync(dir, { recursive: true })
    if (manifestContent !== null) {
      fs.writeFileSync(path.join(dir, 'manifest.json'), manifestContent, 'utf-8')
    }
    return dir
  }

  beforeEach(() => {
    sid = `g671-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    baseDir = path.join(os.homedir(), '.ihui', 'checkpoints', sid)
    fs.mkdirSync(baseDir, { recursive: true })
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-g671-'))
    warnSpy = vi.fn()
    mgr = new CheckpointManager({
      sessionId: sid,
      workspacePath: workspaceDir,
      onCorruptManifest: warnSpy,
    })
  })

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true })
    fs.rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('坏 JSON ⇒ 隔离件在、账面有名字(票面验收)', () => {
    makeCpDir('cp_bad', '{ this is not json')
    const metas = mgr.list()
    expect(metas).toHaveLength(0)
    const q = mgr.getQuarantinedManifests()
    expect(q).toHaveLength(1)
    expect(q[0]!.checkpointId).toBe('cp_bad')
    expect(q[0]!.reason).toBe('parse-failed')
    // 隔离件真的在盘上,且原 manifest 已改名
    expect(q[0]!.quarantinePath).toBeTruthy()
    expect(fs.existsSync(q[0]!.quarantinePath!)).toBe(true)
    expect(fs.existsSync(path.join(baseDir, 'cp_bad', 'manifest.json'))).toBe(false)
    // 到人出口收到同一条
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]![0].reason).toBe('parse-failed')
    // 隔离后再次扫描不再重复报警(原文件已改名)
    expect(mgr.list()).toHaveLength(0)
    expect(mgr.getQuarantinedManifests()).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('合法 JSON 但形状非法 ⇒ shape-invalid 隔离', () => {
    makeCpDir(
      'cp_shape',
      JSON.stringify({
        id: 'cp_shape',
        sessionId: sid,
        createdAt: new Date().toISOString(),
        reason: 'x',
        files: { 'a.txt': 'WILD' },
      }),
    )
    expect(mgr.list()).toHaveLength(0)
    const q = mgr.getQuarantinedManifests()
    expect(q[0]!.reason).toBe('shape-invalid')
    expect(fs.existsSync(q[0]!.quarantinePath!)).toBe(true)
  })

  it('schemaVersion 不识别 ⇒ shape-invalid;无 schemaVersion(legacy)与 =1 放行', () => {
    makeCpDir(
      'cp_v99',
      JSON.stringify({
        id: 'cp_v99',
        sessionId: sid,
        createdAt: new Date().toISOString(),
        reason: 'x',
        files: {},
        schemaVersion: 99,
      }),
    )
    expect(mgr.list()).toHaveLength(0)
    expect(mgr.getQuarantinedManifests()[0]!.reason).toBe('shape-invalid')

    makeCpDir(
      'cp_ok',
      JSON.stringify({
        id: 'cp_ok',
        sessionId: sid,
        createdAt: new Date().toISOString(),
        reason: 'x',
        files: {},
      }),
    )
    makeCpDir(
      'cp_v1',
      JSON.stringify({
        id: 'cp_v1',
        sessionId: sid,
        createdAt: new Date().toISOString(),
        reason: 'x',
        files: {},
        schemaVersion: 1,
      }),
    )
    const metas = mgr.list()
    expect(metas.map((m) => m.id).sort()).toEqual(['cp_ok', 'cp_v1'])
    expect(mgr.getQuarantinedManifests()).toHaveLength(0)
  })

  it('清单读不到时不改名,也不把它说成没有检查点', () => {
    const dir = makeCpDir('cp_unread', null)
    fs.mkdirSync(path.join(dir, 'manifest.json'))
    expect(() => mgr.list()).toThrow(/读不到/)
    expect(fs.existsSync(path.join(dir, 'manifest.json'))).toBe(true)
    expect(warnSpy).not.toHaveBeenCalled()
    expect(() => mgr.get('cp_unread')).toThrow(/读不到/)
  })

  it('ENOENT(目录无 manifest)⇒ 不隔离不警告不进账,半成品目录原样保留', () => {
    makeCpDir('cp_empty', null)
    expect(mgr.list()).toHaveLength(0)
    expect(mgr.getQuarantinedManifests()).toHaveLength(0)
    expect(warnSpy).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(baseDir, 'cp_empty'))).toBe(true)
  })

  it('get() 对坏 manifest ⇒ null 且同样隔离报名', () => {
    makeCpDir('cp_getbad', 'not-json-at-all')
    expect(mgr.get('cp_getbad')).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(
      fs
        .readdirSync(path.join(baseDir, 'cp_getbad'))
        .some((f) => f.startsWith('manifest.corrupt-')),
    ).toBe(true)
  })

  it('回滚或比对坏清单时不说成不存在', async () => {
    makeCpDir('cp_badrestore', 'not-json-at-all')
    await expect(mgr.restore('cp_badrestore')).rejects.toThrow(/不能把它说成不存在/)
    makeCpDir('cp_baddiff', '{')
    expect(() => mgr.diff('cp_baddiff')).toThrow(/不能把它说成不存在/)
    await expect(mgr.restore('cp_absent')).rejects.toThrow('检查点 cp_absent 不存在')
  })

  it('hunk 回滚坏清单时不说成不存在', () => {
    const hm = new HunkCheckpointManager({
      sessionId: sid,
      workspacePath: workspaceDir,
      onCorruptManifest: warnSpy,
    })
    makeCpDir('hunk_badrestore', 'not-json')
    const restored = hm.restoreHunk('hunk_badrestore', 0)
    expect(restored.restored).toBe(false)
    expect(restored.reason).toContain('不能把它说成不存在')
    makeCpDir('hunk_baddiff', '{')
    expect(() => hm.diffHunks('hunk_baddiff')).toThrow(/不能把它说成不存在/)
    expect(hm.restoreHunk('hunk_absent', 0).reason).toBe('检查点 hunk_absent 不存在')
  })

  it('hunk 版:坏 JSON ⇒ 隔离件在、账面有名字', () => {
    const hm = new HunkCheckpointManager({
      sessionId: sid,
      workspacePath: workspaceDir,
      onCorruptManifest: warnSpy,
    })
    makeCpDir('hunk_bad', '{broken')
    expect(hm.list()).toHaveLength(0)
    const q = hm.getQuarantinedManifests()
    expect(q).toHaveLength(1)
    expect(q[0]!.checkpointId).toBe('hunk_bad')
    expect(q[0]!.reason).toBe('parse-failed')
    expect(fs.existsSync(q[0]!.quarantinePath!)).toBe(true)
  })

  it('hunk 版:形状非法(range 非整数/hunks 非数组)⇒ shape-invalid', () => {
    const hm = new HunkCheckpointManager({
      sessionId: sid,
      workspacePath: workspaceDir,
      onCorruptManifest: warnSpy,
    })
    makeCpDir(
      'hunk_shape',
      JSON.stringify({
        id: 'hunk_shape',
        sessionId: sid,
        createdAt: new Date().toISOString(),
        reason: 'x',
        file: 'a.ts',
        hunks: [{ range: { start: '1', end: 2 }, originalLines: [] }],
      }),
    )
    expect(hm.list()).toHaveLength(0)
    expect(hm.getQuarantinedManifests()[0]!.reason).toBe('shape-invalid')
  })

  // goal-b49 S3:两类检查点同居 ~/.ihui/checkpoints/<sid>/ 一层。旧实现 CheckpointManager.list()
  // 无命名空间地把所有子目录都按 isCheckpointMeta 校验,于是把 hunk 清单判 shape-invalid 并改名隔离
  // (实测:隔离件 manifest.corrupt-*.json 出现、hunk manifest.json 消失 ⇒ hunk 回滚静默失效)。
  // 现只扫自己的命名空间(版本序列 `<uuid>@vN` 与历史 cp_ 前缀),别处的清单一概不碰。
  it('命名空间隔离:CheckpointManager.list() 不再隔离 hunk_* 清单(成对正例:cp_ 坏件照旧隔离)', () => {
    const hm = new HunkCheckpointManager({ sessionId: sid, workspacePath: workspaceDir, onCorruptManifest: warnSpy })
    const hunkMeta = hm.snapshotHunks(
      (() => {
        const f = path.join(workspaceDir, 'h.ts')
        fs.writeFileSync(f, 'l1\nl2\n', 'utf-8')
        return f
      })(),
      [{ start: 1, end: 1 }],
      'probe',
    )
    makeCpDir('cp_stillbad', '{broken')
    mgr.list()
    expect(fs.existsSync(path.join(baseDir, hunkMeta.id, 'manifest.json'))).toBe(true)
    expect(mgr.getQuarantinedManifests().map((c) => c.checkpointId)).toEqual(['cp_stillbad'])
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
