/**
 * 课程学习链路端到端真实联调测试（增强版）
 *
 * 与 v1-courses.spec.ts 的区别:
 * - 旧版只测 "查" (列表/详情), 不测 "学" (报名/进度/完成)
 * - 本文件测完整的课程学习流转, 验证数据真的写了/改了
 *
 * 测试链路（基于后端真实接口 /api/v1/courses/*）:
 *
 * A. 课程列表查询:
 *   1. 课程列表返回 records 数组
 *   2. 分类筛选只返回指定分类的课程
 *   3. 关键词搜索能搜到匹配的课程
 *
 * B. 课程详情与章节:
 *   4. 课程详情返回完整课程对象
 *   5. 查询不存在的课程返回 found:false
 *   6. 课程章节列表返回 chapters 数组
 *   7. 课程分类列表返回 categories 数组
 *
 * C. 报名流程:
 *   8. 报名课程返回 enrolled:true
 *   9. 重复报名返回 already:true
 *  10. 我的课程包含已报名课程
 *  11. 报名不存在的课程返回 enrolled:false
 *
 * D. 学习进度:
 *  12. 更新学习进度返回 progress 记录
 *  13. 更新进度后我的课程进度变化
 *
 * E. 完成课程:
 *  14. 完成已报名课程返回 finished:true
 *  15. 完成后 enrollment.finished=true 且 progress=1.0
 *  16. 完成未报名课程返回 finished:false
 *
 * F. 评论与推荐:
 *  17. 发表课程评论返回 commented:true
 *  18. 推荐课程按 students 降序排列
 *
 * 后端实现: server/app/api/v1_courses.py
 * 真实链路验证: 报名真的写入 _STORE_ENROLLMENTS, 进度真的更新
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 */

import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

/** 判断 code 是否为成功 (兼容 "0"/0/200/"200") */
function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

/** 判断是否被 WAF 限流 (403 + rate_limit) */
async function isWafBlocked(resp: APIResponse): Promise<boolean> {
  if (resp.status() !== 403) return false
  try {
    const body = await resp.json()
    return body?.blocked_by === 'rate_limit' || body?.message?.includes('速率限制')
  } catch {
    return false
  }
}

/** 统一 GET 请求, 遇到 WAF 限流自动 skip 测试 */
async function safeGet(
  request: APIRequestContext,
  path: string,
  testObj: { skip: (condition: boolean, message: string) => void }
): Promise<APIResponse> {
  const resp = await request.get(`${BACKEND}${path}`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  })
  if (await isWafBlocked(resp)) {
    testObj.skip(true, '被 WAF 限流, 跳过')
    throw new Error('WAF blocked')
  }
  return resp
}

/** 统一 POST 请求, 遇到 WAF 限流自动 skip 测试 */
async function safePost(
  request: APIRequestContext,
  path: string,
  data: unknown,
  testObj: { skip: (condition: boolean, message: string) => void }
): Promise<APIResponse> {
  const resp = await request.post(`${BACKEND}${path}`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    data,
  })
  if (await isWafBlocked(resp)) {
    testObj.skip(true, '被 WAF 限流, 跳过')
    throw new Error('WAF blocked')
  }
  return resp
}

/** 生成唯一用户ID (避免测试间数据冲突) */
function uniqueUserId(): string {
  return `e2e_user_${Date.now()}_${Math.floor(Math.random() * 10000)}`
}

test.describe('课程学习链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 课程列表查询 ==========

  test('A1. 课程列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/courses/list?page=1&size=10', test)
    expect(resp.status(), '课程列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThan(0)
    expect(data.page, 'page 应为 1').toBe(1)
    expect(data.size, 'size 应为 10').toBe(10)
    console.log(`[A1] 课程列表: total=${data.total}`)
  })

  test('A2. 分类筛选只返回指定分类的课程 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/courses/list?category_id=1&page=1&size=10', test)
    expect(resp.status(), '分类筛选应返回 200').toBe(200)
    const body = await resp.json()
    const data = body.data
    expect(data.total, 'AI 入门分类应至少有1门课').toBeGreaterThan(0)

    for (const course of data.records) {
      expect(course.category_id, `课程 ${course.title} 应属于分类 1`).toBe(1)
    }
    console.log(`[A2] 分类筛选生效: total=${data.total}`)
  })

  test('A3. 关键词搜索能搜到匹配的课程 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, `/api/v1/courses/list?keyword=${encodeURIComponent('大模型')}&page=1&size=10`, test)
    expect(resp.status(), '关键词搜索应返回 200').toBe(200)
    const body = await resp.json()
    const data = body.data
    expect(data.total, '搜索"大模型"应至少有1门课').toBeGreaterThan(0)
    expect(data.records.length, '搜索结果应至少有1条').toBeGreaterThan(0)

    const found = data.records.find(
      (c: { title: string; description: string }) =>
        c.title.includes('大模型') || c.description.includes('大模型')
    )
    expect(found, '搜索结果应包含"大模型"相关课程').toBeTruthy()
    console.log(`[A3] 关键词搜索生效: 找到 ${data.records.length} 条`)
  })

  // ========== B. 课程详情与章节 ==========

  test('B1. 课程详情返回完整课程对象 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/courses/detail?course_id=c1', test)
    expect(resp.status(), '课程详情应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `详情 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.found, '应找到课程').toBe(true)
    expect(data.course, '应返回 course 对象').toBeDefined()
    expect(data.course.id, 'course.id 应为 c1').toBe('c1')
    expect(data.course.title, '应返回 title').toBeTruthy()
    expect(data.course.instructor, '应返回 instructor').toBeTruthy()
    expect(data.course.price, '应返回 price').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 课程详情: title=${data.course.title}, instructor=${data.course.instructor}`)
  })

  test('B2. 查询不存在的课程返回 found:false - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/courses/detail?course_id=nonexistent_xyz', test)
    expect(resp.status(), '查询应返回 200').toBe(200)
    const body = await resp.json()
    expect(body.data.found, '不存在的课程应返回 found:false').toBe(false)
    expect(body.data.course_id, '应返回查询的 course_id').toBe('nonexistent_xyz')
    console.log(`[B2] 不存在课程正确返回 found:false`)
  })

  test('B3. 课程章节列表返回 chapters 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/courses/chapters?course_id=c1', test)
    expect(resp.status(), '章节列表应返回 200').toBe(200)
    const body = await resp.json()
    const data = body.data
    expect(data.chapters, '应返回 chapters 数组').toBeDefined()
    expect(Array.isArray(data.chapters), 'chapters 应为数组').toBe(true)
    expect(data.total, 'c1 应至少有1个章节').toBeGreaterThan(0)

    const ch = data.chapters[0]
    expect(ch.id, '章节应有 id').toBeTruthy()
    expect(ch.title, '章节应有 title').toBeTruthy()
    expect(ch.duration, '章节应有 duration').toBeGreaterThanOrEqual(0)
    console.log(`[B3] 章节列表: total=${data.total}, 第1章=${ch.title}`)
  })

  test('B4. 课程分类列表返回 categories 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/categories/list', test)
    expect(resp.status(), '分类列表应返回 200').toBe(200)
    const body = await resp.json()
    const data = body.data
    expect(data.categories, '应返回 categories 数组').toBeDefined()
    expect(Array.isArray(data.categories), 'categories 应为数组').toBe(true)
    expect(data.categories.length, '应至少有1个分类').toBeGreaterThan(0)

    const cat = data.categories[0]
    expect(cat.id, '分类应有 id').toBeTruthy()
    expect(cat.name, '分类应有 name').toBeTruthy()
    console.log(`[B4] 分类列表: ${data.categories.length} 个分类`)
  })

  // ========== C. 报名流程 ==========

  test('C1. 报名课程返回 enrolled:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const userId = uniqueUserId()

    const resp = await safePost(request, '/api/v1/courses/enroll', { course_id: 'c1', user_id: userId }, test)
    expect(resp.status(), '报名应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `报名 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.enrolled, '应返回 enrolled:true').toBe(true)
    expect(data.enrollment, '应返回 enrollment 对象').toBeDefined()
    expect(data.enrollment.user_id, 'enrollment.user_id 应匹配').toBe(userId)
    expect(data.enrollment.course_id, 'enrollment.course_id 应为 c1').toBe('c1')
    expect(data.enrollment.progress, '新报名 progress 应为 0').toBe(0)
    expect(data.enrollment.finished, '新报名 finished 应为 false').toBe(false)
    console.log(`[C1] 报名成功: user=${userId}, course=c1`)
  })

  test('C2. 重复报名返回 already:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const userId = uniqueUserId()

    // 第一次报名
    await safePost(request, '/api/v1/courses/enroll', { course_id: 'c1', user_id: userId }, test)

    // 第二次报名 (重复)
    const resp = await safePost(request, '/api/v1/courses/enroll', { course_id: 'c1', user_id: userId }, test)
    expect(resp.status(), '重复报名应返回 200').toBe(200)
    const body = await resp.json()
    expect(body.data.enrolled, '应返回 enrolled:true').toBe(true)
    expect(body.data.already, '应返回 already:true (已报名过)').toBe(true)
    console.log(`[C2] 重复报名正确返回 already:true`)
  })

  test('C3. 我的课程包含已报名课程 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const userId = uniqueUserId()

    // 先报名 c1
    await safePost(request, '/api/v1/courses/enroll', { course_id: 'c1', user_id: userId }, test)

    // 查我的课程
    const resp = await safeGet(request, `/api/v1/courses/my?user_id=${userId}`, test)
    expect(resp.status(), '我的课程应返回 200').toBe(200)
    const body = await resp.json()
    const data = body.data
    expect(data.total, '我的课程应至少有1门').toBeGreaterThanOrEqual(1)

    const found = data.records.find((c: { id: string }) => c.id === 'c1')
    expect(found, '我的课程应包含 c1').toBeTruthy()
    expect(found.enrollment, '应包含 enrollment 信息').toBeDefined()
    expect(found.enrollment.user_id, 'enrollment.user_id 应匹配').toBe(userId)
    console.log(`[C3] 我的课程: total=${data.total}, 包含 c1`)
  })

  test('C4. 报名不存在的课程返回 enrolled:false - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const userId = uniqueUserId()

    const resp = await safePost(request, '/api/v1/courses/enroll', { course_id: 'nonexistent_course', user_id: userId }, test)
    expect(resp.status(), '报名应返回 200').toBe(200)
    const body = await resp.json()
    expect(body.data.enrolled, '应返回 enrolled:false').toBe(false)
    expect(body.data.reason, '应返回原因').toBe('课程不存在')
    console.log(`[C4] 报名不存在课程正确返回 enrolled:false`)
  })

  // ========== D. 学习进度 ==========

  test('D1. 更新学习进度返回 progress 记录 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const userId = uniqueUserId()

    // 先报名
    await safePost(request, '/api/v1/courses/enroll', { course_id: 'c1', user_id: userId }, test)

    // 更新进度
    const resp = await safePost(request, '/api/v1/courses/progress', {
      course_id: 'c1',
      chapter_id: 'ch1',
      user_id: userId,
      watched_seconds: 1800,
    }, test)
    expect(resp.status(), '更新进度应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `更新进度 code 应为成功, 实际: ${body.code}`).toBe(true)

    const progress = body.data.progress
    expect(progress, '应返回 progress 对象').toBeDefined()
    expect(progress.user_id, 'progress.user_id 应匹配').toBe(userId)
    expect(progress.course_id, 'progress.course_id 应为 c1').toBe('c1')
    expect(progress.chapter_id, 'progress.chapter_id 应为 ch1').toBe('ch1')
    expect(progress.watched_seconds, 'watched_seconds 应为 1800').toBe(1800)
    console.log(`[D1] 更新进度成功: watched_seconds=1800`)
  })

  test('D2. 更新进度后我的课程进度变化 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const userId = uniqueUserId()

    // 先报名
    await safePost(request, '/api/v1/courses/enroll', { course_id: 'c1', user_id: userId }, test)

    // 报名后进度应为 0
    let resp = await safeGet(request, `/api/v1/courses/my?user_id=${userId}`, test)
    let body = await resp.json()
    let beforeProgress = body.data.records[0].enrollment.progress
    expect(beforeProgress, '报名后进度应为 0').toBe(0)
    console.log(`[D2] 报名后进度: ${beforeProgress}`)

    // 更新进度 (1800秒 = 0.5)
    await safePost(request, '/api/v1/courses/progress', {
      course_id: 'c1', chapter_id: 'ch1', user_id: userId, watched_seconds: 1800,
    }, test)

    // 再查我的课程, 进度应变为 0.5
    resp = await safeGet(request, `/api/v1/courses/my?user_id=${userId}`, test)
    body = await resp.json()
    const afterProgress = body.data.records[0].enrollment.progress
    expect(afterProgress, `更新后进度应为 0.5, 实际: ${afterProgress}`).toBe(0.5)
    console.log(`[D2] 更新后进度: ${afterProgress} (真的变了)`)
  })

  // ========== E. 完成课程 ==========

  test('E1. 完成已报名课程返回 finished:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const userId = uniqueUserId()

    // 先报名
    await safePost(request, '/api/v1/courses/enroll', { course_id: 'c1', user_id: userId }, test)

    // 完成课程
    const resp = await safePost(request, '/api/v1/courses/finish', { course_id: 'c1', user_id: userId }, test)
    expect(resp.status(), '完成课程应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `完成 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data.finished, '应返回 finished:true').toBe(true)
    console.log(`[E1] 完成课程成功`)
  })

  test('E2. 完成后 enrollment.finished=true 且 progress=1.0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const userId = uniqueUserId()

    // 先报名
    await safePost(request, '/api/v1/courses/enroll', { course_id: 'c1', user_id: userId }, test)

    // 完成课程
    const resp = await safePost(request, '/api/v1/courses/finish', { course_id: 'c1', user_id: userId }, test)
    const body = await resp.json()
    const enrollment = body.data.enrollment
    expect(enrollment.finished, 'enrollment.finished 应为 true').toBe(true)
    expect(enrollment.progress, `enrollment.progress 应为 1.0, 实际: ${enrollment.progress}`).toBe(1.0)
    expect(enrollment.finished_at, '应有 finished_at 时间').toBeTruthy()
    console.log(`[E2] 验证成功: finished=${enrollment.finished}, progress=${enrollment.progress}`)
  })

  test('E3. 完成未报名课程返回 finished:false - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const userId = uniqueUserId()

    const resp = await safePost(request, '/api/v1/courses/finish', { course_id: 'c1', user_id: userId }, test)
    expect(resp.status(), '完成应返回 200').toBe(200)
    const body = await resp.json()
    expect(body.data.finished, '应返回 finished:false').toBe(false)
    expect(body.data.reason, '应返回原因').toBe('未报名此课程')
    console.log(`[E3] 完成未报名课程正确返回 finished:false`)
  })

  // ========== F. 评论与推荐 ==========

  test('F1. 发表课程评论返回 commented:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const userId = uniqueUserId()
    const content = `e2e测试评论_${Date.now()}`

    const resp = await safePost(request, '/api/v1/courses/comment', {
      course_id: 'c1',
      user_id: userId,
      username: 'e2e_tester',
      rating: 5,
      content,
    }, test)
    expect(resp.status(), '评论应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `评论 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data.commented, '应返回 commented:true').toBe(true)

    const comment = body.data.comment
    expect(comment.content, `content 应匹配`).toBe(content)
    expect(comment.rating, 'rating 应为 5').toBe(5)
    expect(comment.username, 'username 应为 e2e_tester').toBe('e2e_tester')
    console.log(`[F1] 评论成功: id=${comment.id}, content=${content}`)
  })

  test('F2. 推荐课程按 students 降序排列 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/courses/recommend?limit=3', test)
    expect(resp.status(), '推荐应返回 200').toBe(200)
    const body = await resp.json()
    const data = body.data
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(data.records.length, '应返回最多3条').toBeLessThanOrEqual(3)

    for (let i = 1; i < data.records.length; i++) {
      const prev = data.records[i - 1].students
      const curr = data.records[i].students
      expect(curr, `第${i + 1}条 students 应 <= 第${i}条 (${curr} <= ${prev})`).toBeLessThanOrEqual(prev)
    }
    console.log(`[F2] 推荐课程: ${data.records.length} 条, 第1条 students=${data.records[0].students}`)
  })
})
