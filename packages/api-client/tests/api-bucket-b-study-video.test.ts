// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B 桶上提(study×4 + ai-video×2)的 URL / 方法 / 回包形状钉。
 *
 * 为什么要钉形状而不是只钉类型:2026-11-06 的 vip 那枚 `getVipLevels` 把泛型写成裸数组,
 * 而后端出口是 `success({ items })` —— 类型层静默、页面层恒空。本族逐条对着
 * apps/api 的 `success(...)` 实参写夹具,任何一侧改形即红。
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

import { setTransport, type Transport } from '../src/transport.js'
import {
  getStudyInfo,
  getStudyPlan,
  getStudyRank,
  getStudyVideoDetail,
} from '../src/endpoints/study.js'
import { generateVideoDashscope, generateVideoDoubao } from '../src/endpoints/ai-vendor-video.js'

/** 回包夹具:按各路由 `success(<这里>)` 的实参逐字写,不迁就端内旧声明。 */
function okTransport(payload: unknown) {
  const body = JSON.stringify({ code: 0, message: 'ok', data: payload })
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body),
  })) as unknown as Transport
}

function callsOf(transport: Transport) {
  const mock = transport as unknown as {
    mock: { calls: Array<[string, Record<string, unknown> | undefined]> }
  }
  return mock.mock.calls[0]!
}

describe('study 族端点', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('getStudyInfo 打 GET /api/study/info 并整份透传 6 列', async () => {
    const transport = okTransport({
      todayMinutes: 12,
      totalMinutes: 340,
      continuousDays: 3,
      courses: 5,
      totalLessons: 41,
      completedLessons: 20,
    })
    setTransport(transport)
    const res = await getStudyInfo()
    expect(res.success).toBe(true)
    // 后端多出的两列不能在路上丢:旧端内类型没声明它们,页面就永远读不到
    expect(res.data).toEqual({
      todayMinutes: 12,
      totalMinutes: 340,
      continuousDays: 3,
      courses: 5,
      totalLessons: 41,
      completedLessons: 20,
    })
    const [url, init] = callsOf(transport)
    expect(url).toBe('/api/study/info')
    expect(init?.method).toBeUndefined()
  })

  it('getStudyPlan 回 {list,todayMinutes} 对象,不是裸数组', async () => {
    const transport = okTransport({
      list: [
        {
          id: 'p1',
          title: '每日 30 分钟',
          target: 30,
          minutes: 12,
          progress: 40,
          createdAt: '2026-11-01T00:00:00.000Z',
        },
      ],
      todayMinutes: 12,
    })
    setTransport(transport)
    const res = await getStudyPlan()
    expect(res.success).toBe(true)
    expect(Array.isArray(res.data)).toBe(false)
    expect(res.data?.todayMinutes).toBe(12)
    expect(res.data?.list[0]?.progress).toBe(40)
    expect(callsOf(transport)[0]).toBe('/api/study/plan')
  })

  it('getStudyRank 列名保持后端 SQL 的蛇形 user_id(端内不得改名)', async () => {
    const transport = okTransport({
      list: [
        {
          user_id: 'u1',
          nickname: '张三',
          avatar: null,
          watch_duration: 1800,
          minutes: 30,
          completed_count: 4,
          progress: 66,
        },
      ],
    })
    setTransport(transport)
    const res = await getStudyRank({ limit: 20 })
    const row = res.data?.list[0]!
    expect(row.user_id).toBe('u1')
    expect('id' in row).toBe(false)
    expect(row.avatar).toBeNull()
    expect(callsOf(transport)[0]).toBe('/api/study/rank?limit=20')
  })

  it('getStudyVideoDetail 的 duration 是秒(number)、付费未报名给 null 播址', async () => {
    const transport = okTransport({
      id: 's1',
      title: '第 1 节',
      url: null,
      playUrl: null,
      duration: 305,
      content: null,
      isFree: false,
      chapterId: 'c1',
      courseId: 'l1',
      courseName: '入门课',
      coverUrl: null,
      description: null,
      teacher: null,
      tags: ['入门'],
      amount: 99,
      payType: 1,
      chapters: [{ id: 's1', title: '第 1 节', duration: '5:05' }],
    })
    setTransport(transport)
    const res = await getStudyVideoDetail('s 1')
    expect(res.success).toBe(true)
    expect(res.data?.duration).toBe(305)
    expect(res.data?.playUrl).toBeNull()
    expect(res.data?.chapters[0]?.duration).toBe('5:05')
    // id 必须被 encode,否则带空格的入参会拼坏路径
    expect(callsOf(transport)[0]).toBe('/api/study/videos/s%201')
  })
})

describe('ai 厂商文生视频端点', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('generateVideoDashscope 以 POST 打 /api/ai/dashscope/video 并回 {taskId,status,raw}', async () => {
    const transport = okTransport({ taskId: 't1', status: 'pending', raw: { output: {} } })
    setTransport(transport)
    const res = await generateVideoDashscope({ prompt: '猫', duration: 5, fps: 24 })
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ taskId: 't1', status: 'pending', raw: { output: {} } })
    const [url, init] = callsOf(transport)
    expect(url).toBe('/api/ai/dashscope/video')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ prompt: '猫', duration: 5, fps: 24 }))
  })

  it('generateVideoDoubao 以 POST 打 /api/ai/doubao/video,body 原样序列化', async () => {
    const transport = okTransport({ taskId: 't2', status: 'pending', raw: {} })
    setTransport(transport)
    const res = await generateVideoDoubao({ prompt: '狗', resolution: '1080p' })
    expect(res.data?.taskId).toBe('t2')
    const [url, init] = callsOf(transport)
    expect(url).toBe('/api/ai/doubao/video')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ prompt: '狗', resolution: '1080p' }))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
