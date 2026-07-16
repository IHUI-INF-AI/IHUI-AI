/**
 * P0-MIG-3 数据迁移 E2E 验证。
 *
 * 验证完整迁移流程:导入样本数据 → 验证关联完整性 → 验证业务可查询 → 断点续传 → 数据一致性。
 *
 * mock 策略:
 * - LegacyFetcher 注入:按 SQL 关键字返回预设样本数据(模拟 Java 历史库)
 * - db mock:复用 migrate-legacy.test.ts 的 chain 模式,队列驱动 select/insert 结果
 * - node:crypto mock:randomUUID 返回序号化 UUID,使外键映射可断言
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const mockState = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  insertCalls: [] as unknown[],
  uuidCounter: 0,
}))

vi.mock('node:crypto', () => ({
  randomUUID: () => {
    mockState.uuidCounter++
    return `00000000-0000-4000-8000-${String(mockState.uuidCounter).padStart(12, '0')}`
  },
}))

vi.mock('../../db/index.js', () => {
  interface Chain {
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise<unknown>
    from: () => Chain
    where: () => Chain
    orderBy: () => Chain
    limit: () => Chain
    offset: () => Chain
    values: (v: unknown) => Chain
    set: () => Chain
    returning: () => Chain
    onConflictDoUpdate: () => Chain
    onConflictDoNothing: () => Chain
  }
  function createChain(result: unknown[]): Chain {
    const chain: Chain = {
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: (v: unknown) => {
        mockState.insertCalls.push(v)
        return chain
      },
      set: () => chain,
      returning: () => chain,
      onConflictDoUpdate: () => chain,
      onConflictDoNothing: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => {
        const result = mockState.selectQueue.shift() ?? []
        return createChain(result)
      }),
      insert: vi.fn(() => {
        const result = mockState.insertQueue.shift() ?? []
        return createChain(result)
      }),
      update: vi.fn(() => createChain([])),
      delete: vi.fn(() => createChain([])),
    },
  }
})

import {
  runMigration,
  importUsers,
  importCourses,
  importChapters,
  importEnrollments,
  importAnswers,
  importWrongQuestions,
  importPointRecords,
  setLegacyFetcher,
  type LegacyMember,
  type LegacyCourse,
  type LegacyChapter,
  type LegacyEnrollment,
  type LegacyExamRecord,
  type LegacyWrongQuestion,
  type LegacyPointRecord,
  type LegacyFetcher,
} from '../../scripts/migrate-legacy-data.js'

const BATCH = 'e2e-test'

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

const EXAM_UUID_500 = 'eeee0000-0000-4000-8000-000000000500'
const EXAM_UUID_501 = 'eeee0000-0000-4000-8000-000000000501'
const QUESTION_UUID_600 = 'qqqq0000-0000-4000-8000-000000000600'
const QUESTION_UUID_601 = 'qqqq0000-0000-4000-8000-000000000601'
const PAPER_UUID_500 = 'pppp0000-0000-4000-8000-000000000500'

const T0 = new Date('2026-01-01')
const members: LegacyMember[] = [
  { id: 1, username: 'u1', mobile: '13800000001', email: 'u1@e.com', name: 'User1', avatar: '', birthday: null, password: 'hash1', gender: '男', status: 'normal', create_time: T0 },
  { id: 2, username: 'u2', mobile: '13800000002', email: 'u2@e.com', name: 'User2', avatar: '', birthday: null, password: 'hash2', gender: '女', status: 'normal', create_time: T0 },
]
const courses: LegacyCourse[] = [
  { id: 10, name: 'Course A', image: '', introduction: 'Intro A', phrase: '', price: '99.00', original_price: '199.00', create_user_id: 1, status: 'normal', create_time: T0 },
  { id: 11, name: 'Course B', image: '', introduction: 'Intro B', phrase: '', price: '0', original_price: '0', create_user_id: 2, status: 'normal', create_time: T0 },
]
const chapters: LegacyChapter[] = [
  { id: 100, lesson_id: 10, title: 'Ch1', phrase: '', sort_order: 1, create_time: T0 },
  { id: 101, lesson_id: 10, title: 'Ch2', phrase: '', sort_order: 2, create_time: T0 },
  { id: 102, lesson_id: 11, title: 'Ch3', phrase: '', sort_order: 1, create_time: T0 },
  { id: 103, lesson_id: 11, title: 'Ch4', phrase: '', sort_order: 2, create_time: T0 },
]
const enrollments: LegacyEnrollment[] = [
  { id: 200, member_id: 1, lesson_id: 10, status: 'completed', completed_time: T0, create_time: T0 },
  { id: 201, member_id: 2, lesson_id: 11, status: 'normal', completed_time: null, create_time: T0 },
]
const examRecords: LegacyExamRecord[] = [
  { id: 300, member_id: 1, exam_id: 500, start_time: T0, end_time: T0, score: '85', status: 'completed', answer: '{"q1":"A"}', create_time: T0 },
  { id: 301, member_id: 2, exam_id: 500, start_time: T0, end_time: T0, score: '55', status: 'completed', answer: '{"q1":"B"}', create_time: T0 },
  { id: 302, member_id: 1, exam_id: 501, start_time: T0, end_time: T0, score: '90', status: 'completed', answer: '{"q2":"C"}', create_time: T0 },
  { id: 303, member_id: 2, exam_id: 501, start_time: T0, end_time: T0, score: '40', status: 'completed', answer: '{"q2":"D"}', create_time: T0 },
]
const wrongQuestions: LegacyWrongQuestion[] = [
  { id: 400, question_id: 600, title: 'Q1', type: 'single_choice', member_id: 1, score: '5', scored: '0', result: 0, answer: 'A', create_time: T0 },
  { id: 401, question_id: 601, title: 'Q2', type: 'multi_choice', member_id: 2, score: '10', scored: '0', result: 0, answer: 'B,C', create_time: T0 },
]
const pointRecords: LegacyPointRecord[] = [
  { id: 700, point_id: 1, channel_id: 1, point_num: 10, type: 'earn', member_id: 1, mobile: '13800000001', remark: 'sign', topic_id: 0, topic_type: '', create_time: T0 },
  { id: 701, point_id: 2, channel_id: 1, point_num: 20, type: 'earn', member_id: 2, mobile: '13800000002', remark: 'course', topic_id: 10, topic_type: 'course', create_time: T0 },
  { id: 702, point_id: 3, channel_id: 2, point_num: -5, type: 'spend', member_id: 1, mobile: '13800000001', remark: 'redeem', topic_id: 0, topic_type: '', create_time: T0 },
  { id: 703, point_id: 4, channel_id: 1, point_num: 15, type: 'earn', member_id: 2, mobile: '13800000002', remark: 'exam', topic_id: 500, topic_type: 'exam', create_time: T0 },
]

const newIdLookup: Record<string, string> = {
  'member:1': uuid(1), 'member:2': uuid(2),
  'course:10': uuid(3), 'course:11': uuid(4),
  'chapter:100': uuid(5), 'chapter:101': uuid(6), 'chapter:102': uuid(7), 'chapter:103': uuid(8),
  'enrollment:200': uuid(9), 'enrollment:201': uuid(10),
  'exam_record:300': uuid(11), 'exam_record:301': uuid(12), 'exam_record:302': uuid(13), 'exam_record:303': uuid(14),
  'wrong_question:400': uuid(15), 'wrong_question:401': uuid(16),
  'point_record:700': uuid(17), 'point_record:701': uuid(18), 'point_record:702': uuid(19), 'point_record:703': uuid(20),
}

interface MappingRow { legacyTable: string; legacyId: number; newId: string; migrationBatch: string }
interface UserRow { id: string; phone: string | null; username: string | null; nickname: string | null; gender: number }
interface LessonRow { id: string; title: string; lecturerId: string | null; price: string; isFree: boolean }
interface ChapterRow { id: string; lessonId: string; title: string; sortOrder: number }
interface SignUpRow { id: string; lessonId: string; userId: string; status: number; progress: number }
interface ExamRecRow { id: string; paperId: string; userId: string; score: string; isPassed: boolean; status: string }
interface WrongQRow { id: string; userId: string; questionId: string; paperId: string; wrongCount: number }
interface PointRecRow { id: string; memberId: string; point: number; type: string }

interface ParsedInserts {
  mappings: MappingRow[]
  users: UserRow[]
  lessons: LessonRow[]
  chapters: ChapterRow[]
  signups: SignUpRow[]
  examRecs: ExamRecRow[]
  wrongQs: WrongQRow[]
  pointRecs: PointRecRow[]
}

function parseInserts(calls: unknown[]): ParsedInserts {
  const r: ParsedInserts = { mappings: [], users: [], lessons: [], chapters: [], signups: [], examRecs: [], wrongQs: [], pointRecs: [] }
  for (const c of calls) {
    const o = c as Record<string, unknown>
    if ('legacyTable' in o && 'newId' in o) r.mappings.push(o as unknown as MappingRow)
    else if ('phone' in o) r.users.push(o as unknown as UserRow)
    else if ('lecturerId' in o) r.lessons.push(o as unknown as LessonRow)
    else if ('sortOrder' in o) r.chapters.push(o as unknown as ChapterRow)
    else if ('progress' in o) r.signups.push(o as unknown as SignUpRow)
    else if ('wrongCount' in o) r.wrongQs.push(o as unknown as WrongQRow)
    else if ('answers' in o) r.examRecs.push(o as unknown as ExamRecRow)
    else if ('memberId' in o && 'point' in o) r.pointRecs.push(o as unknown as PointRecRow)
  }
  return r
}

function mappingRow(table: string, legacyId: number, newId: string): MappingRow[] {
  return [{ legacyTable: table, legacyId, newId, migrationBatch: BATCH }]
}

function createFetcher(): LegacyFetcher {
  return async (sql: string) => {
    if (sql.includes('t_member')) return members as unknown as Record<string, unknown>[]
    if (sql.includes('learn_lesson_chapter')) return chapters as unknown as Record<string, unknown>[]
    if (sql.includes('learn_lesson')) return courses as unknown as Record<string, unknown>[]
    if (sql.includes('learn_sign_up')) return enrollments as unknown as Record<string, unknown>[]
    if (sql.includes('exam_wrong_question')) return wrongQuestions as unknown as Record<string, unknown>[]
    if (sql.includes('exam_record')) return examRecords as unknown as Record<string, unknown>[]
    if (sql.includes('point_record')) return pointRecords as unknown as Record<string, unknown>[]
    return []
  }
}

function buildFirstRunQueues(): { selectQueue: unknown[][]; insertQueue: unknown[][] } {
  const selectQueue: unknown[][] = []
  const insertQueue: unknown[][] = []
  const lookup = (key: string): string => newIdLookup[key]!

  for (const m of members) {
    selectQueue.push([])
    insertQueue.push([])
    insertQueue.push(mappingRow('member', m.id, lookup(`member:${m.id}`)))
  }
  for (const c of courses) {
    selectQueue.push([])
    selectQueue.push([{ newId: lookup(`member:${c.create_user_id}`) }])
    insertQueue.push([])
    insertQueue.push(mappingRow('course', c.id, lookup(`course:${c.id}`)))
  }
  for (const ch of chapters) {
    selectQueue.push([])
    selectQueue.push([{ newId: lookup(`course:${ch.lesson_id}`) }])
    insertQueue.push([])
    insertQueue.push(mappingRow('chapter', ch.id, lookup(`chapter:${ch.id}`)))
  }
  for (const e of enrollments) {
    selectQueue.push([])
    selectQueue.push([{ newId: lookup(`member:${e.member_id}`) }])
    selectQueue.push([{ newId: lookup(`course:${e.lesson_id}`) }])
    insertQueue.push([])
    insertQueue.push(mappingRow('enrollment', e.id, lookup(`enrollment:${e.id}`)))
  }
  for (const er of examRecords) {
    selectQueue.push([])
    selectQueue.push([{ newId: lookup(`member:${er.member_id}`) }])
    selectQueue.push([{ newId: er.exam_id === 500 ? EXAM_UUID_500 : EXAM_UUID_501 }])
    insertQueue.push([])
    insertQueue.push(mappingRow('exam_record', er.id, lookup(`exam_record:${er.id}`)))
  }
  for (const wq of wrongQuestions) {
    selectQueue.push([])
    selectQueue.push([{ newId: lookup(`member:${wq.member_id}`) }])
    selectQueue.push([{ newId: wq.question_id === 600 ? QUESTION_UUID_600 : QUESTION_UUID_601 }])
    selectQueue.push([{ paperId: PAPER_UUID_500 }])
    insertQueue.push([])
    insertQueue.push(mappingRow('wrong_question', wq.id, lookup(`wrong_question:${wq.id}`)))
  }
  for (const pr of pointRecords) {
    selectQueue.push([])
    selectQueue.push([{ newId: lookup(`member:${pr.member_id}`) }])
    insertQueue.push([])
    insertQueue.push(mappingRow('point_record', pr.id, lookup(`point_record:${pr.id}`)))
  }
  return { selectQueue, insertQueue }
}

function buildSecondRunQueues(): { selectQueue: unknown[][]; insertQueue: unknown[][] } {
  const total = members.length + courses.length + chapters.length + enrollments.length + examRecords.length + wrongQuestions.length + pointRecords.length
  const selectQueue: unknown[][] = Array.from({ length: total }, () => [{ id: 'existing' }])
  return { selectQueue, insertQueue: [] }
}

describe('P0-MIG-3 数据迁移 E2E 验证', () => {
  let parsed: ParsedInserts

  beforeAll(async () => {
    mockState.uuidCounter = 0
    mockState.insertCalls = []
    const { selectQueue, insertQueue } = buildFirstRunQueues()
    mockState.selectQueue = selectQueue
    mockState.insertQueue = insertQueue
    setLegacyFetcher(createFetcher())
    await runMigration({ dryRun: false, batch: BATCH })
    parsed = parseInserts(mockState.insertCalls)
  })

  afterAll(() => {
    setLegacyFetcher(null)
  })

  describe('准备阶段 + 执行迁移', () => {
    it('样本数据完整: 2 用户 + 2 课程 + 4 章节 + 2 报名 + 4 答题 + 2 错题 + 4 积分', () => {
      expect(members).toHaveLength(2)
      expect(courses).toHaveLength(2)
      expect(chapters).toHaveLength(4)
      expect(enrollments).toHaveLength(2)
      expect(examRecords).toHaveLength(4)
      expect(wrongQuestions).toHaveLength(2)
      expect(pointRecords).toHaveLength(4)
    })

    it('执行迁移: 7 步全部完成, 产生 20 条目标记录 + 20 条映射', () => {
      expect(parsed.users).toHaveLength(2)
      expect(parsed.lessons).toHaveLength(2)
      expect(parsed.chapters).toHaveLength(4)
      expect(parsed.signups).toHaveLength(2)
      expect(parsed.examRecs).toHaveLength(4)
      expect(parsed.wrongQs).toHaveLength(2)
      expect(parsed.pointRecs).toHaveLength(4)
      expect(parsed.mappings).toHaveLength(20)
      expect(mockState.insertCalls).toHaveLength(40)
    })
  })

  describe('关联完整性', () => {
    it('id_mapping: 20 条映射, 覆盖 7 种 legacyTable', () => {
      const byTable = new Map<string, number>()
      for (const m of parsed.mappings) {
        byTable.set(m.legacyTable, (byTable.get(m.legacyTable) ?? 0) + 1)
      }
      expect(byTable.get('member')).toBe(2)
      expect(byTable.get('course')).toBe(2)
      expect(byTable.get('chapter')).toBe(4)
      expect(byTable.get('enrollment')).toBe(2)
      expect(byTable.get('exam_record')).toBe(4)
      expect(byTable.get('wrong_question')).toBe(2)
      expect(byTable.get('point_record')).toBe(4)
    })

    it('目标表记录数: users=2, lessons=2, lesson_chapters=4, lesson_sign_ups=2, exam_records=4, exam_wrong_question=2, edu_point_records=4', () => {
      expect(parsed.users).toHaveLength(2)
      expect(parsed.lessons).toHaveLength(2)
      expect(parsed.chapters).toHaveLength(4)
      expect(parsed.signups).toHaveLength(2)
      expect(parsed.examRecs).toHaveLength(4)
      expect(parsed.wrongQs).toHaveLength(2)
      expect(parsed.pointRecs).toHaveLength(4)
    })

    it('所有目标表记录 id 非空且唯一', () => {
      const allIds = [
        ...parsed.users.map(u => u.id),
        ...parsed.lessons.map(l => l.id),
        ...parsed.chapters.map(c => c.id),
        ...parsed.signups.map(s => s.id),
        ...parsed.examRecs.map(e => e.id),
        ...parsed.wrongQs.map(w => w.id),
        ...parsed.pointRecs.map(p => p.id),
      ]
      expect(allIds.every(id => typeof id === 'string' && id.length > 0)).toBe(true)
      expect(new Set(allIds).size).toBe(allIds.length)
    })
  })

  describe('外键正确性', () => {
    it('lessons.lecturerId 正确映射到 users.id', () => {
      const userIds = new Set(parsed.users.map(u => u.id))
      for (const lesson of parsed.lessons) {
        expect(lesson.lecturerId).not.toBeNull()
        expect(userIds.has(lesson.lecturerId!)).toBe(true)
      }
      expect(parsed.lessons[0]!.lecturerId).toBe(newIdLookup['member:1'])
      expect(parsed.lessons[1]!.lecturerId).toBe(newIdLookup['member:2'])
    })

    it('lesson_chapters.lessonId 正确映射到 lessons.id', () => {
      const lessonIds = new Set(parsed.lessons.map(l => l.id))
      for (const ch of parsed.chapters) {
        expect(lessonIds.has(ch.lessonId)).toBe(true)
      }
      expect(parsed.chapters[0]!.lessonId).toBe(newIdLookup['course:10'])
      expect(parsed.chapters[1]!.lessonId).toBe(newIdLookup['course:10'])
      expect(parsed.chapters[2]!.lessonId).toBe(newIdLookup['course:11'])
      expect(parsed.chapters[3]!.lessonId).toBe(newIdLookup['course:11'])
    })

    it('lesson_sign_ups.userId + lessonId 正确映射', () => {
      const userIds = new Set(parsed.users.map(u => u.id))
      const lessonIds = new Set(parsed.lessons.map(l => l.id))
      for (const su of parsed.signups) {
        expect(userIds.has(su.userId)).toBe(true)
        expect(lessonIds.has(su.lessonId)).toBe(true)
      }
      expect(parsed.signups[0]!.userId).toBe(newIdLookup['member:1'])
      expect(parsed.signups[0]!.lessonId).toBe(newIdLookup['course:10'])
      expect(parsed.signups[1]!.userId).toBe(newIdLookup['member:2'])
      expect(parsed.signups[1]!.lessonId).toBe(newIdLookup['course:11'])
    })

    it('exam_records.userId + paperId 正确映射, isPassed 业务逻辑正确', () => {
      const userIds = new Set(parsed.users.map(u => u.id))
      for (const er of parsed.examRecs) {
        expect(userIds.has(er.userId)).toBe(true)
        expect(er.paperId).toMatch(/^eeee0000/)
      }
      expect(parsed.examRecs[0]!.score).toBe('85')
      expect(parsed.examRecs[0]!.isPassed).toBe(true)
      expect(parsed.examRecs[1]!.score).toBe('55')
      expect(parsed.examRecs[1]!.isPassed).toBe(false)
      expect(parsed.examRecs[2]!.score).toBe('90')
      expect(parsed.examRecs[2]!.isPassed).toBe(true)
      expect(parsed.examRecs[3]!.score).toBe('40')
      expect(parsed.examRecs[3]!.isPassed).toBe(false)
    })

    it('exam_wrong_question.userId + questionId + paperId 正确映射', () => {
      const userIds = new Set(parsed.users.map(u => u.id))
      for (const wq of parsed.wrongQs) {
        expect(userIds.has(wq.userId)).toBe(true)
        expect(wq.questionId).toMatch(/^qqqq0000/)
        expect(wq.paperId).toBe(PAPER_UUID_500)
        expect(wq.wrongCount).toBe(1)
      }
      expect(parsed.wrongQs[0]!.userId).toBe(newIdLookup['member:1'])
      expect(parsed.wrongQs[0]!.questionId).toBe(QUESTION_UUID_600)
      expect(parsed.wrongQs[1]!.userId).toBe(newIdLookup['member:2'])
      expect(parsed.wrongQs[1]!.questionId).toBe(QUESTION_UUID_601)
    })

    it('edu_point_records.memberId 正确映射, point 正负数保留', () => {
      const userIds = new Set(parsed.users.map(u => u.id))
      for (const pr of parsed.pointRecs) {
        expect(userIds.has(pr.memberId)).toBe(true)
      }
      expect(parsed.pointRecs[0]!.memberId).toBe(newIdLookup['member:1'])
      expect(parsed.pointRecs[0]!.point).toBe(10)
      expect(parsed.pointRecs[2]!.point).toBe(-5)
      expect(parsed.pointRecs[1]!.memberId).toBe(newIdLookup['member:2'])
      expect(parsed.pointRecs[1]!.point).toBe(20)
    })
  })

  describe('业务可查询', () => {
    it('用户 1 登录后能看到历史课程(lecturerId = user1.id)', () => {
      const user1Courses = parsed.lessons.filter(l => l.lecturerId === newIdLookup['member:1'])
      expect(user1Courses).toHaveLength(1)
      expect(user1Courses[0]!.title).toBe('Course A')
    })

    it('用户 1 能看到历史积分(edu_point_records WHERE memberId = user1.id)', () => {
      const user1Points = parsed.pointRecs.filter(p => p.memberId === newIdLookup['member:1'])
      expect(user1Points).toHaveLength(2)
      const total = user1Points.reduce((s, p) => s + p.point, 0)
      expect(total).toBe(5)
    })

    it('用户 1 能看到历史错题(exam_wrong_question WHERE userId = user1.id)', () => {
      const user1WrongQs = parsed.wrongQs.filter(w => w.userId === newIdLookup['member:1'])
      expect(user1WrongQs).toHaveLength(1)
      expect(user1WrongQs[0]!.questionId).toBe(QUESTION_UUID_600)
    })

    it('用户 1 能看到历史答题记录(exam_records WHERE userId = user1.id)', () => {
      const user1ExamRecs = parsed.examRecs.filter(e => e.userId === newIdLookup['member:1'])
      expect(user1ExamRecs).toHaveLength(2)
      const passed = user1ExamRecs.filter(e => e.isPassed)
      expect(passed).toHaveLength(2)
    })

    it('用户 2 能看到历史报名(lesson_sign_ups WHERE userId = user2.id)', () => {
      const user2Signups = parsed.signups.filter(s => s.userId === newIdLookup['member:2'])
      expect(user2Signups).toHaveLength(1)
      expect(user2Signups[0]!.lessonId).toBe(newIdLookup['course:11'])
    })
  })

  describe('断点续传', () => {
    let secondRunInsertCount: number

    beforeAll(async () => {
      mockState.insertCalls = []
      const { selectQueue, insertQueue } = buildSecondRunQueues()
      mockState.selectQueue = selectQueue
      mockState.insertQueue = insertQueue
      setLegacyFetcher(createFetcher())
      await runMigration({ dryRun: false, batch: BATCH })
      secondRunInsertCount = mockState.insertCalls.length
    })

    it('第二次运行: 所有记录 shouldSkip=true, 0 条 insert', () => {
      expect(secondRunInsertCount).toBe(0)
    })

    it('不会产生重复记录(insert 调用次数为 0)', () => {
      expect(mockState.insertCalls).toHaveLength(0)
    })
  })

  describe('数据一致性', () => {
    it('源表行数 = 目标表行数(每步 migrated + skipped = total)', async () => {
      mockState.uuidCounter = 100
      mockState.insertCalls = []
      const { selectQueue, insertQueue } = buildFirstRunQueues()
      mockState.selectQueue = selectQueue
      mockState.insertQueue = insertQueue
      setLegacyFetcher(createFetcher())

      const r1 = await importUsers(BATCH, false)
      expect(r1.total).toBe(2)
      expect(r1.migrated + r1.skipped + r1.failed).toBe(r1.total)
      expect(r1.migrated).toBe(2)

      const r2 = await importCourses(BATCH, false)
      expect(r2.total).toBe(2)
      expect(r2.migrated + r2.skipped + r2.failed).toBe(r2.total)

      const r3 = await importChapters(BATCH, false)
      expect(r3.total).toBe(4)
      expect(r3.migrated + r3.skipped + r3.failed).toBe(r3.total)

      const r4 = await importEnrollments(BATCH, false)
      expect(r4.total).toBe(2)
      expect(r4.migrated + r4.skipped + r4.failed).toBe(r4.total)

      const r5 = await importAnswers(BATCH, false)
      expect(r5.total).toBe(4)
      expect(r5.migrated + r5.skipped + r5.failed).toBe(r5.total)

      const r6 = await importWrongQuestions(BATCH, false)
      expect(r6.total).toBe(2)
      expect(r6.migrated + r6.skipped + r6.failed).toBe(r6.total)

      const r7 = await importPointRecords(BATCH, false)
      expect(r7.total).toBe(4)
      expect(r7.migrated + r7.skipped + r7.failed).toBe(r7.total)

      setLegacyFetcher(null)
    })

    it('所有 newId 在 id_mapping 中可查(外键完整性)', () => {
      const mappingNewIds = new Set(parsed.mappings.map(m => m.newId))
      const targetIds = [
        ...parsed.users.map(u => u.id),
        ...parsed.lessons.map(l => l.id),
        ...parsed.chapters.map(c => c.id),
        ...parsed.signups.map(s => s.id),
        ...parsed.examRecs.map(e => e.id),
        ...parsed.wrongQs.map(w => w.id),
        ...parsed.pointRecs.map(p => p.id),
      ]
      for (const id of targetIds) {
        expect(mappingNewIds.has(id)).toBe(true)
      }
      expect(targetIds).toHaveLength(20)
      expect(mappingNewIds.size).toBe(20)
    })

    it('映射表 legacyId 唯一(同 legacyTable 内无重复)', () => {
      const seen = new Set<string>()
      for (const m of parsed.mappings) {
        const key = `${m.legacyTable}:${m.legacyId}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
      expect(seen.size).toBe(20)
    })
  })
})
