import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  setLegacyFetcher,
  createLegacyFetcherFromEnv,
  MIGRATION_PLAN,
  runMigration,
  parseArgs,
  generateBatchId,
} from '../src/scripts/migrate-legacy-data.js'

describe('migrate-legacy-data.ts', () => {
  beforeEach(() => {
    setLegacyFetcher(null)
  })
  afterEach(() => {
    setLegacyFetcher(null)
    vi.restoreAllMocks()
  })

  describe('createLegacyFetcherFromEnv', () => {
    it('未配置 LEGACY_DATABASE_URL 时抛出清晰错误', async () => {
      const orig = process.env.LEGACY_DATABASE_URL
      delete process.env.LEGACY_DATABASE_URL
      await expect(createLegacyFetcherFromEnv()).rejects.toThrow('LEGACY_DATABASE_URL 未配置')
      if (orig) process.env.LEGACY_DATABASE_URL = orig
    })

    it('配置了 URL 但 mysql2 未安装时抛出安装提示', async () => {
      const orig = process.env.LEGACY_DATABASE_URL
      process.env.LEGACY_DATABASE_URL = 'mysql://user:pass@localhost:3306/legacy'
      // 动态 import 失败时抛出安装提示(mysql2 未安装)
      await expect(createLegacyFetcherFromEnv()).rejects.toThrow('mysql2 未安装')
      if (orig) process.env.LEGACY_DATABASE_URL = orig
      else delete process.env.LEGACY_DATABASE_URL
    })
  })

  describe('parseArgs', () => {
    it('解析 --dry-run', () => {
      expect(parseArgs(['--dry-run'])).toEqual({ dryRun: true, batch: null })
    })
    it('解析 --batch <id>', () => {
      expect(parseArgs(['--batch', 'mig-001'])).toEqual({ dryRun: false, batch: 'mig-001' })
    })
    it('无参数返回默认值', () => {
      expect(parseArgs([])).toEqual({ dryRun: false, batch: null })
    })
  })

  describe('generateBatchId', () => {
    it('生成 mig-YYYYMMDD-HHMMSS 格式', () => {
      const id = generateBatchId()
      expect(id).toMatch(/^mig-\d{8}-\d{6}$/)
    })
  })

  describe('MIGRATION_PLAN', () => {
    it('7 个 step,依赖顺序正确', () => {
      expect(MIGRATION_PLAN).toHaveLength(7)
      expect(MIGRATION_PLAN[0]!.legacyTable).toBe('member')
      expect(MIGRATION_PLAN[0]!.dependsOn).toEqual([])
      expect(MIGRATION_PLAN[1]!.legacyTable).toBe('course')
      expect(MIGRATION_PLAN[1]!.dependsOn).toEqual(['member'])
      expect(MIGRATION_PLAN[2]!.legacyTable).toBe('chapter')
      expect(MIGRATION_PLAN[2]!.dependsOn).toEqual(['course'])
      expect(MIGRATION_PLAN[3]!.legacyTable).toBe('enrollment')
      expect(MIGRATION_PLAN[3]!.dependsOn).toEqual(['member', 'course'])
      expect(MIGRATION_PLAN[4]!.legacyTable).toBe('exam_record')
      expect(MIGRATION_PLAN[4]!.dependsOn).toEqual(['member', 'exam'])
      expect(MIGRATION_PLAN[5]!.legacyTable).toBe('wrong_question')
      expect(MIGRATION_PLAN[5]!.dependsOn).toEqual(['member', 'question'])
      expect(MIGRATION_PLAN[6]!.legacyTable).toBe('point_record')
      expect(MIGRATION_PLAN[6]!.dependsOn).toEqual(['member'])
    })
  })

  describe('runMigration dry-run', () => {
    it('注入 mock fetcher 后 dry-run 成功执行 7 个 step', async () => {
      let callCount = 0
      const calls: string[] = []
      setLegacyFetcher(async (sql: string) => {
        callCount++
        calls.push(sql)
        return []
      })
      await runMigration({ dryRun: true, batch: 'test-dry-run' })
      expect(callCount).toBe(7)
      expect(calls[0]).toContain('t_member')
      expect(calls[1]).toContain('learn_lesson')
      expect(calls[2]).toContain('learn_lesson_chapter')
      expect(calls[3]).toContain('learn_sign_up')
      expect(calls[4]).toContain('exam_record')
      expect(calls[5]).toContain('exam_wrong_question')
      expect(calls[6]).toContain('point_record')
    })
  })
})
