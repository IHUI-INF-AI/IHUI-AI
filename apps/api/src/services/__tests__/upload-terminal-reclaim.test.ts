// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-381 回归(2026-11-08):分片上传失败终态(checksum_mismatch/content_rejected)的
 * 分片目录必须按短 TTL 回收,且不得继续计入 2GiB 全局暂存预算。
 *
 * 改前必红口径:旧实现把所有终态视作"永不回收",且 measureStagedBytes 无会话状态过滤,
 * 断言 selectReapableUploadIds 命中终态行、cleanup 真删目录、预算只统计活跃会话时全部失败。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('../../db/index.js', () => ({ db: {} }))

import {
  PROTOCOL_UPLOAD_LIMITS,
  cleanupExpiredUploadSessions,
  isUploadSessionExpired,
  measureStagedBytes,
  selectReapableUploadIds,
  type ExpirableUploadSession,
  type UploadReapPort,
} from '../upload-integrity.js'
import { UPLOAD_SESSION_STATUS } from '@ihui/database'

const NOW = new Date('2026-11-08T12:00:00Z')
const TWO_HOURS_AGO = new Date('2026-11-08T10:00:00Z')

function row(status: string, updatedAt: Date): ExpirableUploadSession {
  return { uploadId: '00000000-0000-4000-8000-000000000001', status, updatedAt, expiresAt: null }
}

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'f381-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('F-381 终态会话短 TTL 回收', () => {
  it('checksum_mismatch/content_rejected 按 terminalTtlMs 过期,completed/cancelled 不回收', () => {
    expect(
      isUploadSessionExpired(row(UPLOAD_SESSION_STATUS.checksumMismatch, TWO_HOURS_AGO), NOW),
    ).toBe(true)
    expect(
      isUploadSessionExpired(row(UPLOAD_SESSION_STATUS.contentRejected, TWO_HOURS_AGO), NOW),
    ).toBe(true)
    expect(
      isUploadSessionExpired(row(UPLOAD_SESSION_STATUS.completed, TWO_HOURS_AGO), NOW),
    ).toBe(false)
    expect(
      isUploadSessionExpired(row(UPLOAD_SESSION_STATUS.cancelled, TWO_HOURS_AGO), NOW),
    ).toBe(false)
    expect(PROTOCOL_UPLOAD_LIMITS.terminalTtlMs).toBeGreaterThan(0)
    expect(PROTOCOL_UPLOAD_LIMITS.terminalTtlMs).toBeLessThan(PROTOCOL_UPLOAD_LIMITS.ttlMs)
  })

  it('cleanupExpiredUploadSessions 真删失败终态的分片目录与行', async () => {
    const failed = row(UPLOAD_SESSION_STATUS.checksumMismatch, TWO_HOURS_AGO)
    const dir = join(root, failed.uploadId)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '1.part'), 'chunk')

    const removed: string[][] = []
    const port: UploadReapPort = {
      listOpenSessions: async () => [failed],
      removeSessions: async (ids) => {
        removed.push([...ids])
      },
    }

    const result = await cleanupExpiredUploadSessions(port, NOW, root)
    expect(result.sessions).toBe(1)
    expect(result.dirs).toBe(1)
    expect(existsSync(dir)).toBe(false)
    expect(removed[0]).toEqual([failed.uploadId])
  })

  it('selectReapableUploadIds 把过期失败终态列入回收清单', () => {
    const ids = selectReapableUploadIds(
      [
        row(UPLOAD_SESSION_STATUS.checksumMismatch, TWO_HOURS_AGO),
        row(UPLOAD_SESSION_STATUS.completed, TWO_HOURS_AGO),
      ],
      NOW,
    )
    expect(ids).toHaveLength(1)
  })
})

describe('F-381 预算只统计活跃会话', () => {
  it('measureStagedBytes 传入活跃会话白名单时,终态目录字节不计入', () => {
    const activeId = '11111111-1111-4111-8111-111111111111'
    const terminalId = '22222222-2222-4222-8222-222222222222'
    for (const [id, size] of [
      [activeId, 300],
      [terminalId, 500],
    ] as const) {
      const dir = join(root, id)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, '1.part'), Buffer.alloc(size))
    }

    const all = measureStagedBytes(root)
    expect(all).toBe(800)

    const activeOnly = measureStagedBytes(root, new Set([activeId]))
    expect(activeOnly).toBe(300)
  })
})
