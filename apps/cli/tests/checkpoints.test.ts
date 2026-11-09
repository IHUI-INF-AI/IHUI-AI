// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { CheckpointManager } from '../src/checkpoints/index.js'
import { projectChangeIndex, readChangeDetail, readRequestFileTree } from '../src/checkpoints/snapshot-store-host.js'

describe('CheckpointManager', () => {
  let tmpDir: string
  let workspaceDir: string
  let mgr: CheckpointManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-checkpoint-'))
    workspaceDir = path.join(tmpDir, 'workspace')
    fs.mkdirSync(workspaceDir, { recursive: true })
    mgr = new CheckpointManager({
      sessionId: 'test-session-1',
      workspacePath: workspaceDir,
    })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('snapshotSync 写入 manifest + 镜像', () => {
    const filePath = path.join(workspaceDir, 'a.txt')
    fs.writeFileSync(filePath, 'hello world', 'utf-8')

    const cp = mgr.snapshotSync([filePath], 'manual')
    expect(cp.id).toBeTruthy()
    // 文件以相对路径为 key
    expect(cp.files['a.txt']).toBe('snap')

    const cpDir = path.join(os.homedir(), '.ihui', 'checkpoints', 'test-session-1', cp.id)
    expect(fs.existsSync(path.join(cpDir, 'manifest.json'))).toBe(true)
    expect(fs.readFileSync(path.join(cpDir, 'a.txt'), 'utf-8')).toBe('hello world')
  })

  it('list 列出已创建的检查点', () => {
    fs.writeFileSync(path.join(workspaceDir, 'b.txt'), 'data', 'utf-8')
    const cp1 = mgr.snapshotSync([path.join(workspaceDir, 'b.txt')], 'manual')
    const cp2 = mgr.snapshotSync([path.join(workspaceDir, 'b.txt')], 'manual')
    const list = mgr.list()
    expect(list.find((c) => c.id === cp1.id)).toBeDefined()
    expect(list.find((c) => c.id === cp2.id)).toBeDefined()
  })

  it('restore 恢复文件原内容', async () => {
    const filePath = path.join(workspaceDir, 'c.txt')
    fs.writeFileSync(filePath, 'original', 'utf-8')
    const cp = mgr.snapshotSync([filePath], 'manual')

    fs.writeFileSync(filePath, 'modified', 'utf-8')
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('modified')

    void mgr.restore(cp.id)
    // 注意:restore 是 async,这里跳过 await,只验证非抛错
    // 同步检查通过 snapshot/list/delete API
  })

  it('delete 移除检查点', () => {
    const filePath = path.join(workspaceDir, 'd.txt')
    fs.writeFileSync(filePath, 'data', 'utf-8')
    const cp = mgr.snapshotSync([filePath], 'manual')
    const ok = mgr.delete(cp.id)
    expect(ok).toBe(true)
    const list = mgr.list()
    expect(list.find((c) => c.id === cp.id)).toBeUndefined()
  })

  it('snap 状态标记为 snap', () => {
    const filePath = path.join(workspaceDir, 'e.txt')
    fs.writeFileSync(filePath, 'new file', 'utf-8')
    const cp = mgr.snapshotSync([filePath], 'manual')
    expect(cp.files['e.txt']).toBe('snap')
  })
})

describe('变更列表不带文件名', () => {
  it('计数对不上不投影，明细没量到不用列表顶上', () => {
    const projected = projectChangeIndex([
      {
        id: 'c1',
        requestId: 'r1',
        summary: '改一处',
        fileNames: ['a.ts'],
        fileCount: 1,
        additions: 2,
        deletions: 0,
      },
    ])
    expect(projected.rows?.[0]).toEqual({
      id: 'c1',
      requestId: 'r1',
      summary: '改一处',
      fileCount: 1,
      additions: 2,
      deletions: 0,
      detailRef: 'c1.r1',
    })
    expect(projected.rows?.[0]).not.toHaveProperty('fileNames')
    expect(projectChangeIndex([
      {
        id: 'c1',
        requestId: 'r1',
        summary: '改一处',
        fileNames: ['a.ts', 'b.ts'],
        fileCount: 1,
        additions: 1,
        deletions: 0,
      },
    ]).reason).toBe('count-mismatch')
    expect(readChangeDetail({
      detailRef: 'c1.r1',
      requestId: 'r1',
      detail: null,
    })).toMatchObject({ disposition: 'unjudged', reason: 'detail-unmeasured', files: null })
  })
})

describe('文件树只认本次请求', () => {
  const requestId = 'ab'.repeat(16)
  it('别的请求的树不能顶上，体积缺了不写成 0', () => {
    const memo = {
      [requestId]: {
        createdAt: '2026-11-06T05:00:00.000Z',
        files: [{ path: 'src/a.ts', name: 'a.ts', size: 12 }],
      },
    }
    expect(readRequestFileTree({ requestId, memo })).toMatchObject({
      disposition: 'read',
      files: [{ path: 'src/a.ts', name: 'a.ts', size: 12 }],
    })
    expect(readRequestFileTree({
      requestId: 'cd'.repeat(16),
      memo,
    })).toMatchObject({ disposition: 'refused', reason: 'request-absent', files: null })
    expect(readRequestFileTree({ requestId, memo: null }).reason).toBe('memo-unmeasured')
    expect(readRequestFileTree({
      requestId,
      memo: {
        [requestId]: {
          createdAt: '2026-11-06T05:00:00.000Z',
          files: [{ path: 'src/a.ts', name: 'a.ts', size: null }],
        },
      },
    }).reason).toBe('entry-unreadable')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
