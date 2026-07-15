import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { eduLessonTopics, lessons } from '@ihui/database'
import { topicRoutes } from '../src/routes/topic.js'

async function createTopic(data: {
  title: string
  coverImage?: string
  description?: string
  lessonIds?: string[]
  isPublished?: boolean
  sort?: number
  status?: number
}) {
  const [row] = await db
    .insert(eduLessonTopics)
    .values({
      title: data.title,
      coverImage: data.coverImage,
      description: data.description,
      lessonIds: data.lessonIds,
      isPublished: data.isPublished ?? false,
      sort: data.sort ?? 0,
      status: data.status ?? 1,
    })
    .returning()
  return row
}

async function createLesson(data: {
  title: string
  status?: number
  isFree?: boolean
  price?: string
}) {
  const [row] = await db
    .insert(lessons)
    .values({
      title: data.title,
      status: data.status ?? 1,
      isFree: data.isFree ?? false,
      price: data.price ?? '0',
    })
    .returning()
  return row
}

describe('topic-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(topicRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM edu_lesson_topics`)
    await db.execute(sql`DELETE FROM lessons`)
  })

  it('GET /api/topics — 空表返回空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/topics' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
  })

  it('GET /api/topics — 仅返回 isPublished=true + status=1', async () => {
    await createTopic({ title: '已发布', isPublished: true, status: 1 })
    await createTopic({ title: '未发布', isPublished: false, status: 1 })
    await createTopic({ title: '已发布但下线', isPublished: true, status: 0 })
    const res = await server.inject({ method: 'GET', url: '/api/topics' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('已发布')
  })

  it('GET /api/topics — title 模糊搜索', async () => {
    await createTopic({ title: 'React 专题', isPublished: true, status: 1 })
    await createTopic({ title: 'Vue 专题', isPublished: true, status: 1 })
    const res = await server.inject({ method: 'GET', url: '/api/topics?title=React' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('React 专题')
  })

  it('GET /api/topics — 按 sort 升序排序', async () => {
    await createTopic({ title: 'B', sort: 2, isPublished: true, status: 1 })
    await createTopic({ title: 'A', sort: 1, isPublished: true, status: 1 })
    await createTopic({ title: 'C', sort: 3, isPublished: true, status: 1 })
    const res = await server.inject({ method: 'GET', url: '/api/topics' })
    const body = res.json()
    expect(body.data.list.map((t: { title: string }) => t.title)).toEqual(['A', 'B', 'C'])
  })

  it('GET /api/topics — 分页 (page/pageSize)', async () => {
    for (let i = 0; i < 5; i++) {
      await createTopic({ title: `专题${i}`, isPublished: true, status: 1, sort: i })
    }
    const res = await server.inject({
      method: 'GET',
      url: '/api/topics?page=2&pageSize=2',
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(5)
    expect(body.data.page).toBe(2)
    expect(body.data.pageSize).toBe(2)
    expect(body.data.list[0].title).toBe('专题2')
  })

  it('GET /api/topics/:id — 返回详情', async () => {
    const topic = await createTopic({
      title: '专题详情',
      description: '专题介绍',
      isPublished: true,
      status: 1,
    })
    const res = await server.inject({ method: 'GET', url: `/api/topics/${topic.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.topic.title).toBe('专题详情')
    expect(body.data.topic.description).toBe('专题介绍')
    expect(body.data.topic.lessons).toEqual([])
  })

  it('GET /api/topics/:id — 不存在返回 404', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/topics/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
    expect(body.message).toBe('专题不存在')
  })

  it('GET /api/topics/:id — 未发布专题返回 404', async () => {
    const topic = await createTopic({
      title: '未发布',
      isPublished: false,
      status: 1,
    })
    const res = await server.inject({ method: 'GET', url: `/api/topics/${topic.id}` })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/topics/:id — status !== 1 返回 404', async () => {
    const topic = await createTopic({
      title: '已下线',
      isPublished: true,
      status: 0,
    })
    const res = await server.inject({ method: 'GET', url: `/api/topics/${topic.id}` })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/topics/:id — 返回关联课程列表', async () => {
    const lesson1 = await createLesson({ title: '课程1' })
    const lesson2 = await createLesson({ title: '课程2' })
    const topic = await createTopic({
      title: '含课程专题',
      isPublished: true,
      status: 1,
      lessonIds: [lesson1.id, lesson2.id],
    })
    const res = await server.inject({ method: 'GET', url: `/api/topics/${topic.id}` })
    const body = res.json()
    expect(body.data.topic.lessons).toHaveLength(2)
    expect(body.data.topic.lessons[0].title).toBe('课程1')
    expect(body.data.topic.lessons[1].title).toBe('课程2')
  })

  it('GET /api/topics/:id — 关联课程按 lessonIds 顺序返回', async () => {
    const lesson1 = await createLesson({ title: '第一' })
    const lesson2 = await createLesson({ title: '第二' })
    const lesson3 = await createLesson({ title: '第三' })
    const topic = await createTopic({
      title: '顺序专题',
      isPublished: true,
      status: 1,
      lessonIds: [lesson3.id, lesson1.id, lesson2.id],
    })
    const res = await server.inject({ method: 'GET', url: `/api/topics/${topic.id}` })
    const body = res.json()
    expect(body.data.topic.lessons.map((l: { title: string }) => l.title)).toEqual([
      '第三',
      '第一',
      '第二',
    ])
  })

  it('GET /api/topics/:id — status !== 1 的关联课程不返回', async () => {
    const lesson1 = await createLesson({ title: '已上线', status: 1 })
    const lesson2 = await createLesson({ title: '已下线', status: 0 })
    const topic = await createTopic({
      title: '过滤专题',
      isPublished: true,
      status: 1,
      lessonIds: [lesson1.id, lesson2.id],
    })
    const res = await server.inject({ method: 'GET', url: `/api/topics/${topic.id}` })
    const body = res.json()
    expect(body.data.topic.lessons).toHaveLength(1)
    expect(body.data.topic.lessons[0].title).toBe('已上线')
  })

  it('GET /api/topics/:id — lessonIds 引用不存在的课程被过滤', async () => {
    const lesson = await createLesson({ title: '存在课程' })
    const topic = await createTopic({
      title: '含无效引用',
      isPublished: true,
      status: 1,
      lessonIds: [lesson.id, '00000000-0000-0000-0000-000000000000'],
    })
    const res = await server.inject({ method: 'GET', url: `/api/topics/${topic.id}` })
    const body = res.json()
    expect(body.data.topic.lessons).toHaveLength(1)
    expect(body.data.topic.lessons[0].title).toBe('存在课程')
  })

  it('GET /api/topics/:id — 非法 UUID 返回 400', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/topics/not-a-uuid' })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
  })

  it('GET /api/topics/:id — 关联课程字段完整 (TopicLessonBrief)', async () => {
    const lesson = await createLesson({
      title: '完整字段',
      isFree: true,
      price: '99.99',
    })
    const topic = await createTopic({
      title: '字段专题',
      isPublished: true,
      status: 1,
      lessonIds: [lesson.id],
    })
    const res = await server.inject({ method: 'GET', url: `/api/topics/${topic.id}` })
    const body = res.json()
    const l = body.data.topic.lessons[0]
    expect(l.id).toBe(lesson.id)
    expect(l.title).toBe('完整字段')
    expect(l.isFree).toBe(true)
    expect(l.price).toBe('99.99')
    expect(l.lessonCount).toBe(0)
    expect(l.viewCount).toBe(0)
    expect(l.signupCount).toBe(0)
  })

  it('响应格式符合 { code, message, data } 规范', async () => {
    const topic = await createTopic({
      title: '格式校验',
      isPublished: true,
      status: 1,
    })
    for (const url of ['/api/topics', `/api/topics/${topic.id}`]) {
      const res = await server.inject({ method: 'GET', url })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('data')
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
    }
  })
})
