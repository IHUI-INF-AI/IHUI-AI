// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// A9R12-G1 · 分片上传完整性账判据(净室:按本仓规格自写,不复用上游实现)
//
// 三缺各自的可判定方式:
//  ① 集合式进度 —— 重传同一片两次 + 漏一片,集合判据必点名缺失片;
//     并保留一条**计数语义阳性对照**(received.length 与集合基数不同形),
//     否则"改判据"这件事本身无法被机器发现。
//  ② 摘要兑现 —— hashFile 实算值必须等于同内容独立算出的值;声明被改动一位
//     即判不符(变异对照:把校验摘掉、把红洗成绿,会在这里翻红)。
//  ③ TTL 回收 —— 判据 + **消费者装车证明**(调度器清单与 worker 分发都必须点名
//     该任务)。本仓最高频失效型就是"清理函数写了但零调用方"(守门 121 判同一族)。
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PROTOCOL_UPLOAD_LIMITS,
  countUniqueReceivedChunks,
  findMissingChunkNumbers,
  listReceivedChunkNumbers,
  hashFile,
  digestMatches,
  normalizeDeclaredDigest,
  isUploadSessionExpired,
  selectReapableUploadIds,
  isUploadSessionId,
  cleanupExpiredUploadSessions,
  type ExpirableUploadSession,
  type UploadReapPort,
} from '../src/services/upload-integrity.js'

const EXPIRED_ID = '3f2a1b4c-5d6e-4f70-8a9b-c1d2e3f40506'
const OPEN_ID = '9a8b7c6d-5e4f-4a1b-9c8d-7e6f5a4b3c2d'
const BOGUS_ID = '../../outside'
const OLD_MS = Date.parse('2026-01-01T00:00:00Z')
const NOW = new Date(Date.parse('2026-06-01T00:00:00Z'))

function session(over: Partial<ExpirableUploadSession>): ExpirableUploadSession {
  return {
    uploadId: EXPIRED_ID,
    status: 'uploading',
    expiresAt: null,
    updatedAt: new Date(OLD_MS),
    ...over,
  }
}

let scratch = ''

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'ihui-upload-integrity-'))
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

describe('① 进度是集合不是计数', () => {
  it('重传同一片 + 漏一片:集合判据点名缺失片,绝不提前判定收齐', () => {
    // 磁盘上出现过 5 次写入(1,2,3,4,4),但唯一分片只有 4 片,总片数 5。
    const received = [1, 2, 3, 4, 4]
    // 阳性对照:旧计数语义下这就是"5/5 已齐" —— 判据必须与它不同形,否则本用例什么都没测。
    expect(received.length).toBe(5)
    expect(countUniqueReceivedChunks(received, 5)).toBe(4)
    expect(findMissingChunkNumbers(received, 5)).toEqual([5])
  })

  it('全片到齐时 missing 为空(判据不得对正常路径误伤)', () => {
    expect(findMissingChunkNumbers([1, 2, 3], 3)).toEqual([])
    expect(countUniqueReceivedChunks([1, 2, 3], 3)).toBe(3)
  })

  it('同一 chunkNumber 重复落盘只覆盖文件、不增加集合基数', () => {
    const dir = mkdtempSync(join(scratch, 'chunks-'))
    writeFileSync(join(dir, '1.part'), 'a')
    writeFileSync(join(dir, '2.part'), 'b')
    writeFileSync(join(dir, '2.part'), 'b-retry') // 重试同一片 = 覆盖同一个文件
    const received = listReceivedChunkNumbers(dir)
    expect(received.sort((x, y) => x - y)).toEqual([1, 2])
    expect(countUniqueReceivedChunks(received, 2)).toBe(2)
    expect(findMissingChunkNumbers(received, 2)).toEqual([])
  })

  it('越界编号不计入进度', () => {
    expect(countUniqueReceivedChunks([0, 1, 6, 7], 5)).toBe(1)
    expect(findMissingChunkNumbers([0, 1, 6, 7], 5)).toEqual([2, 3, 4, 5])
  })

  it('目录不存在时返回空集合而不是抛出', () => {
    expect(listReceivedChunkNumbers(join(scratch, 'no-such-dir'))).toEqual([])
    expect(findMissingChunkNumbers(listReceivedChunkNumbers(join(scratch, 'nope')), 2)).toEqual([
      1, 2,
    ])
  })
})

describe('② 声明的摘要必须被兑现', () => {
  const CONTENT = 'ihui-upload-integrity-probe-2026-09-26'

  it('hashFile 实算值等于同内容独立算出的 md5/sha256', async () => {
    const file = join(scratch, 'artifact.bin')
    writeFileSync(file, CONTENT)
    const actual = await hashFile(file)
    expect(actual.md5).toBe(createHash('md5').update(CONTENT).digest('hex'))
    expect(actual.sha256).toBe(createHash('sha256').update(CONTENT).digest('hex'))
  })

  it('声明值与实算一致 → 放过;改动一位 → 判不符(变异对照)', () => {
    const real = createHash('md5').update(CONTENT).digest('hex')
    expect(digestMatches(real, real)).toBe(true)
    // 变异:把声明的最后一位翻掉 —— 校验必须翻红,否则"校验"是装饰
    const tampered = real.slice(0, -1) + (real.endsWith('0') ? '1' : '0')
    expect(tampered).not.toBe(real)
    expect(digestMatches(tampered, real)).toBe(false)
  })

  it('md5:<hex> 前缀与大小写同视', () => {
    expect(normalizeDeclaredDigest('MD5:dAAdbeef')).toBe('daadbeef')
    expect(digestMatches(`md5:${'AA'.repeat(16)}`, 'aa'.repeat(16))).toBe(true)
  })

  it('未声明摘要 → 无可验证项,放过(schema 上是 optional 字段,不得凭空要求)', () => {
    expect(digestMatches(undefined, 'anything')).toBe(true)
    expect(digestMatches(null, 'anything')).toBe(true)
    expect(digestMatches('   ', 'anything')).toBe(true)
  })
})

describe('③ TTL 回收:判据 + 生产者 + 消费者', () => {
  it('expiresAt 过期 → 回收;未过期 → 保留', () => {
    expect(isUploadSessionExpired(session({ expiresAt: new Date(OLD_MS) }), NOW)).toBe(true)
    expect(
      isUploadSessionExpired(session({ expiresAt: new Date(NOW.getTime() + 60_000) }), NOW),
    ).toBe(false)
  })

  it('expiresAt 缺失的旧行退回 updatedAt + ttl(存量数据不得永久占盘)', () => {
    expect(isUploadSessionExpired(session({ expiresAt: null }), NOW)).toBe(true)
    expect(
      isUploadSessionExpired(session({ updatedAt: new Date(NOW.getTime() - 1000) }), NOW),
    ).toBe(false)
  })

  it('终态行(completed / cancelled)永不回收', () => {
    expect(isUploadSessionExpired(session({ status: 'completed' }), NOW)).toBe(false)
    expect(isUploadSessionExpired(session({ status: 'cancelled' }), NOW)).toBe(false)
    expect(selectReapableUploadIds([session({ status: 'completed' })], NOW)).toEqual([])
  })

  it('ttl 档位真实决定判据结果(常量不是装饰)', () => {
    expect(PROTOCOL_UPLOAD_LIMITS.maxChunkBytes).toBeGreaterThan(0)
    expect(PROTOCOL_UPLOAD_LIMITS.ttlMs).toBeGreaterThan(500)
    const fresh = session({ expiresAt: null, updatedAt: new Date(NOW.getTime() - 1000) })
    expect(isUploadSessionExpired(fresh, NOW)).toBe(false)
    expect(isUploadSessionExpired(fresh, NOW, 500)).toBe(true)
  })

  it('reaper:过期目录被删、未过期原样保留、非本表 uuid 形态一律拒删并计数', async () => {
    const root = mkdtempSync(join(scratch, 'chunks-root-'))
    for (const id of [EXPIRED_ID, OPEN_ID, BOGUS_ID]) {
      mkdirSync(join(root, id), { recursive: true })
    }
    expect(existsSync(join(root, EXPIRED_ID))).toBe(true)

    const removed: string[] = []
    const port: UploadReapPort = {
      async listOpenSessions() {
        return [
          session({ uploadId: EXPIRED_ID, expiresAt: new Date(OLD_MS) }),
          session({ uploadId: OPEN_ID, expiresAt: new Date(NOW.getTime() + 3_600_000) }),
          session({ uploadId: BOGUS_ID, expiresAt: new Date(OLD_MS) }),
        ]
      },
      async removeSessions(ids) {
        removed.push(...ids)
      },
    }

    const result = await cleanupExpiredUploadSessions(port, NOW, root)

    expect(isUploadSessionId(EXPIRED_ID)).toBe(true)
    expect(isUploadSessionId(BOGUS_ID)).toBe(false)
    // 删了过期两行的 id(含不可删的 bogus),但绝不碰未过期那条
    expect(removed.sort()).toEqual([BOGUS_ID, EXPIRED_ID].sort())
    expect(removed).not.toContain(OPEN_ID)
    expect(result.sessions).toBe(2)
    expect(result.dirs).toBe(1)
    expect(result.dirsRejected).toBe(1)
    // 磁盘事实:过期目录已消失,未过期目录仍在,非法 id 对应的目录没被顺带删掉
    expect(existsSync(join(root, EXPIRED_ID))).toBe(false)
    expect(existsSync(join(root, OPEN_ID))).toBe(true)
    expect(existsSync(join(root, BOGUS_ID))).toBe(true)
  })

  it('消费者装车证明:调度清单与 worker 分发都真点名该任务', () => {
    const apiRoot = fileURLToPath(new URL('..', import.meta.url))
    const schedulerSrc = readFileSync(join(apiRoot, 'src/plugins/scheduler.ts'), 'utf8')
    const workerSrc = readFileSync(join(apiRoot, 'src/workers/scheduler-worker.ts'), 'utf8')
    expect(schedulerSrc).toContain("'upload-session-reap-hourly'")
    expect(workerSrc).toContain("case 'upload-session-reap-hourly'")
    expect(workerSrc).toContain('cleanupExpiredUploadSessions(')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
