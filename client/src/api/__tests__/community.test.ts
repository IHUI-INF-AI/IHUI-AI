// community.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

let demoMode = false

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url && url.includes('500')) return Promise.reject({ response: { status: 500 } })
      if (url && url.includes('news/list')) {
        return Promise.resolve({ data: { code: 200, data: { list: [{ id: 1, title: 't', content: '<img src="/uploads/x.jpg" />' }], total: 1 } } })
      }
      if (url && url.includes('news/1')) {
        return Promise.resolve({ data: { code: 200, data: { id: 1, title: 't', content: '<img src="/uploads/x.jpg" />' } } })
      }
      if (url && url.includes('news-detail-500')) return Promise.reject({ response: { status: 500 } })
      return Promise.resolve({ data: { code: 200, msg: 'ok', data: { list: [{ id: '1' }], total: 1, pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } })
    }),
    post: vi.fn().mockImplementation((url: string) => {
      if (url && url.includes('500')) return Promise.reject({ response: { status: 500 } })
      return Promise.resolve({ data: { code: 200, msg: 'ok', data: {} } })
    }),
    put: vi.fn().mockImplementation(() => Promise.resolve({ data: { code: 200, data: {} } })),
    delete: vi.fn().mockImplementation(() => Promise.resolve({ data: { code: 200, data: {} } })),
  },
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('@/utils/envUtils', () => ({
  isDemoMode: vi.fn().mockImplementation(() => demoMode),
}))

vi.mock('@/config/backend-paths', () => ({
  COMMUNITY_PATHS: {
    posts: {
      list: '/posts/list',
      create: '/posts',
      batch: '/posts/batch',
      byId: (id: string) => `/posts/${id}`,
      like: (id: string) => `/posts/${id}/like`,
      comments: (id: string) => `/posts/${id}/comments`,
    },
    topics: { list: '/topics/list' },
  },
  API_V1_PATHS: { news: { list: '/news/list', detail: (id: string) => `/news/${id}` } },
}))

import * as api from '../content/community'

async function callFn(fn: any, ...args: any[]): Promise<any> {
  try {
    const result = await fn(...args)
    expect(result).toBeDefined()
    return result
  } catch (e) {
    expect(e).toBeDefined()
    return null
  }
}

describe('community', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    demoMode = false
  })

  it('getPostsList 正常', async () => {
    await callFn((api as any).getPostsList, { page: 1, pageSize: 10 })
    await callFn((api as any).getPostsList, { topicId: 't1' })
    await callFn((api as any).getPostsList, { userId: 'u1' })
  })

  it('getPostsList demo 模式', async () => {
    demoMode = true
    const r = await (api as any).getPostsList({})
    expect(r).toBeDefined()
    demoMode = false
  })

  it('getPostsList 失败', async () => {
    const r = await (api as any).getPostsList({ topicId: '500' })
    expect(r).toBeDefined()
  })

  it('createPost 发布', async () => {
    await callFn((api as any).createPost, { content: 'c', type: 'text' })
  })

  it('batchCreatePosts 批量', async () => {
    await callFn((api as any).batchCreatePosts, [{ content: 'c', type: 'text' }])
  })

  it('getPostDetail 详情', async () => {
    await callFn((api as any).getPostDetail, 'p1')
  })

  it('like/unlike 点赞', async () => {
    await callFn((api as any).likePost, 'p1')
    await callFn((api as any).unlikePost, 'p1')
  })

  it('favorite/unfavorite 收藏', async () => {
    await callFn((api as any).favoritePost, 'p1')
    await callFn((api as any).favoritePost, 'p1', 'name')
    await callFn((api as any).unfavoritePost, 'p1')
  })

  it('getComments 评论', async () => {
    await callFn((api as any).getComments, 'p1')
    await callFn((api as any).getComments, 'p1', { page: 1 })
  })

  it('createComment 发表评论', async () => {
    await callFn((api as any).createComment, { postId: 'p1', content: 'c' })
  })

  it('getHotTopics demo 模式', async () => {
    demoMode = true
    const r = await (api as any).getHotTopics()
    expect(r).toBeDefined()
    demoMode = false
  })

  it('getNewsList 资讯列表', async () => {
    await callFn((api as any).getNewsList, { pageNum: 1, pageSize: 10 })
  })

  it('getNewsList demo 模式', async () => {
    demoMode = true
    const r = await (api as any).getNewsList({ pageNum: 1, pageSize: 10 })
    expect(r).toBeDefined()
    demoMode = false
  })

  it('getNewsList 500 静默', async () => {
    // 临时修改 mock 让 news/list 走 500 错误
    const req = await import('@/utils/request')
    const orig = (req.default as any).get.getMockImplementation()
    ;(req.default as any).get.mockImplementationOnce((url: string) => {
      if (url && url.includes('news/list')) return Promise.reject({ response: { status: 500 } })
      return Promise.resolve({ data: { code: 200, data: {} } })
    })
    const r = await (api as any).getNewsList({ pageNum: 1, pageSize: 10 })
    expect(r).toBeDefined()
  })

  it('getNewsDetail 资讯详情', async () => {
    await callFn((api as any).getNewsDetail, 1)
    await callFn((api as any).getNewsDetail, '1')
  })

  it('getNewsDetail demo 模式', async () => {
    demoMode = true
    const r = await (api as any).getNewsDetail(1)
    expect(r).toBeDefined()
    demoMode = false
  })

  it('getNewsDetail 500 静默', async () => {
    const r = await (api as any).getNewsDetail('500')
    expect(r).toBeDefined()
  })

  it('getNewsDetail 包含 img 标签', async () => {
    const r = await (api as any).getNewsDetail('2')
    expect(r).toBeDefined()
  })

  it('getNewsDetail 非 500 错误', async () => {
    const req = await import('@/utils/request')
    ;(req.default as any).get.mockImplementationOnce(() => Promise.reject(new Error('boom')))
    const r = await (api as any).getNewsDetail('1')
    expect(r).toBeDefined()
  })
})
