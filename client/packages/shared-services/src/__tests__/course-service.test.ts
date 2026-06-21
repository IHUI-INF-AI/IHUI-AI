import { describe, expect, it } from 'vitest'
import {
  createCourse,
  deleteCourse,
  getCourseDetail,
  getCourseList,
  getVideoDetail,
  getVideoList,
} from '../course-service'
import type { SharedRequestAdapter, SharedRequestConfig } from '../request-adapter'

function createAdapter(handler: (config: SharedRequestConfig) => unknown | Promise<unknown>): SharedRequestAdapter {
  return {
    async request<TResponse = unknown>(config: SharedRequestConfig): Promise<TResponse> {
      return handler(config) as Promise<TResponse>
    },
  }
}

describe('shared-services/course-service', () => {
  it('requests course list through the shared endpoint', async () => {
    let capturedConfig: SharedRequestConfig | undefined
    const adapter = createAdapter((config) => {
      capturedConfig = config
      return {
        code: 200,
        data: {
          list: [{ id: 1, title: 'Course 1' }],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      }
    })

    const response = await getCourseList(adapter, { page: 1, pageSize: 20 })

    expect(capturedConfig).toMatchObject({
      url: '/course/list',
      method: 'GET',
      base: 1,
      headers: { 'COURSE-PLATFORM': 'system_wechat' },
    })
    expect(response.data).toEqual({
      list: [{ id: 1, title: 'Course 1' }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })
  })

  it('requests course detail and video list', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: { id: 1, title: 'Course' } }
    })

    await getCourseDetail(adapter, 1)
    await getVideoList(adapter, { page: 1 })
    await getVideoDetail(adapter, 10)

    expect(requests[0]).toMatchObject({
      url: '/course/1',
      method: 'GET',
      base: 1,
    })
    expect(requests[1]).toMatchObject({
      url: '/courseVideo/list',
      method: 'GET',
      base: 1,
    })
    expect(requests[2]).toMatchObject({
      url: '/courseVideo/10',
      method: 'GET',
      base: 1,
    })
  })

  it('creates and deletes courses', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: null }
    })

    await createCourse(adapter, { title: 'New Course' })
    await deleteCourse(adapter, '5')

    expect(requests[0]).toMatchObject({
      url: '/course',
      method: 'POST',
      base: 1,
    })
    expect(requests[1]).toMatchObject({
      url: '/course/5',
      method: 'DELETE',
      base: 1,
    })
  })
})
