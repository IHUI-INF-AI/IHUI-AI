// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * D20 留尾:服务端源「清空全部」的判序测试。
 *
 * 四个"错法"各自的判据:
 *   ① 确认:文案必须带"当前已加载的 N 条"的条数插值(服务端可能有未加载完的更多页,
 *      不能把"已加载"谎报成"全部")—— 五语言包 + 页面接线双层验证;
 *   ② 执行:并发有界(默认 3 路)、逐条按 deleteServerConversation 的三条判序落桶
 *      (不抛 ∧ success ∧ deleted===true)、进度 (done,total) 逐条回吐;
 *   ③ 结果:全成 ⇒ 列表清空;有失败 ⇒ 失败行原样保留、幸存行顺序不变;
 *   ④ 反向锁:兜底态(local)清空路径结构上不碰服务端删除,服务端清空不写本机快照。
 * 夹具里的 mock 只用于切断平台依赖,不改变被测判序本身。
 */

vi.mock('@tarojs/taro', () => {
  const Taro = {
    getStorageSync: () => '',
    setStorageSync: () => {},
    showToast: vi.fn(),
    showModal: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    navigateTo: vi.fn(),
    useDidShow: vi.fn(),
  }
  return { default: Taro, ...Taro }
})

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Comp = (props: Record<string, unknown>) => createElement(tag, props)
    Comp.displayName = `TaroStub_${tag}`
    return Comp
  }
  return {
    View: make('div'),
    Text: make('span'),
    Image: make('img'),
    Button: make('button'),
    ScrollView: make('div'),
  }
})

vi.mock('@ihui/api-client', () => ({
  listConversations: vi.fn(),
  setConversationPinned: vi.fn(),
  deleteConversation: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tList: () => [],
    locale: 'zh-CN',
    setLocale: () => {},
  }),
  t: (key: string) => key,
  useTt: () => (key: string, fb: string) => fb,
}))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: Record<string, unknown>) =>
    createElement('div', { className: props.className as string }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})
vi.mock('@/components/SearchBar', () => {
  const Stub = () => createElement('input')
  Stub.displayName = 'SearchBarStub'
  return { default: Stub }
})
vi.mock('@/components/ConversationHistoryItem', () => {
  const Stub = () => createElement('div')
  Stub.displayName = 'ConversationHistoryItemStub'
  return { default: Stub }
})
vi.mock('@/constants/remote-icons', () => ({
  REMOTE_ICONS: {
    message: 'message.png',
    imageOr: 'image.png',
    aimusic: 'voice.png',
    jiqiren: 'agent.png',
    search: 'search.png',
  },
}))

import { createElement } from 'react'
import {
  clearServerConversations,
  applyServerClearResult,
  SERVER_CLEAR_CONCURRENCY,
  type HistoryItem,
} from '../src/pkg-ai/ai/history'
import type { ApiResult } from '@ihui/types'

function ok(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return Promise.resolve({ success: true, data: { deleted: true, id } } as ApiResult<{
    deleted: boolean
  }>)
}

function item(id: string): HistoryItem {
  return { id, title: id, time: '', messages: [] }
}

/* ================================================================== *
 * ② 执行器:clearServerConversations —— 有界并发 + 判序落桶 + 进度
 * ================================================================== */

describe('② clearServerConversations —— 有界并发', () => {
  it('默认并发上界就是 3(常量被页面和测试共用,不许各自口说)', () => {
    expect(SERVER_CLEAR_CONCURRENCY).toBe(3)
  })

  it('同时在途不超过 3 路,且确实并行(峰值 = 3)', async () => {
    let inFlight = 0
    let peak = 0
    const ids = Array.from({ length: 10 }, (_, i) => `c-${i}`)
    const out = await clearServerConversations({
      ids,
      remove: async () => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight -= 1
        return { success: true, data: { deleted: true } } as ApiResult<{ deleted: boolean }>
      },
    })
    expect(out.okIds).toHaveLength(10)
    expect(out.failedIds).toEqual([])
    expect(peak).toBe(SERVER_CLEAR_CONCURRENCY)
  })

  it('concurrency:1 ⇒ 串行(峰值 1),给调用方留收紧的口子', async () => {
    let inFlight = 0
    let peak = 0
    const out = await clearServerConversations({
      ids: ['a', 'b', 'c'],
      concurrency: 1,
      remove: async () => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 2))
        inFlight -= 1
        return { success: true, data: { deleted: true } } as ApiResult<{ deleted: boolean }>
      },
    })
    expect(out.okIds).toEqual(['a', 'b', 'c'])
    expect(peak).toBe(1)
  })
})

describe('② clearServerConversations —— 判序落桶(与 deleteServerConversation 同一口径)', () => {
  it('success:true ∧ deleted:true ⇒ 成功桶', async () => {
    const out = await clearServerConversations({
      ids: ['a'],
      remove: () => ok('a'),
    })
    expect(out).toEqual({ okIds: ['a'], failedIds: [] })
  })

  it('success:false(401/403)⇒ 失败桶 —— 后端没确认就是没删掉', async () => {
    const out = await clearServerConversations({
      ids: ['a'],
      remove: async () =>
        ({ success: false, error: 'forbidden', status: 403 }) as ApiResult<{ deleted: boolean }>,
    })
    expect(out.okIds).toEqual([])
    expect(out.failedIds).toEqual(['a'])
  })

  it('success:true 但 deleted !== true ⇒ 失败桶(后端回了别的载荷不能当成功)', async () => {
    const out = await clearServerConversations({
      ids: ['a'],
      remove: async () =>
        ({ success: true, data: { deleted: false } }) as ApiResult<{ deleted: boolean }>,
    })
    expect(out.failedIds).toEqual(['a'])
  })

  it('抛错(网络故障 / 5xx)⇒ 失败桶,且不冒泡中断其它条目', async () => {
    const out = await clearServerConversations({
      ids: ['a', 'b', 'c'],
      remove: async (id) => {
        if (id === 'b') throw new Error('HttpError: 502')
        return { success: true, data: { deleted: true } } as ApiResult<{ deleted: boolean }>
      },
    })
    expect(out.okIds.sort()).toEqual(['a', 'c'])
    expect(out.failedIds).toEqual(['b'])
  })

  it('混合批次:成功/失败各落各桶,一条失败不拖垮整批', async () => {
    const out = await clearServerConversations({
      ids: ['a', 'b', 'c', 'd', 'e'],
      remove: async (id) => {
        if (id === 'b')
          return { success: false, error: 'conflict' } as ApiResult<{ deleted: boolean }>
        if (id === 'd') throw new Error('offline')
        return { success: true, data: { deleted: true } } as ApiResult<{ deleted: boolean }>
      },
    })
    expect(out.okIds.sort()).toEqual(['a', 'c', 'e'])
    expect(out.failedIds.sort()).toEqual(['b', 'd'])
  })
})

describe('② clearServerConversations —— 进度回吐', () => {
  it('每落定一条回吐一次 (done,total),done 逐条 +1 收在 (total,total)', async () => {
    const calls: Array<[number, number]> = []
    const out = await clearServerConversations({
      ids: ['a', 'b', 'c', 'd'],
      remove: async () => {
        await new Promise((r) => setTimeout(r, 3))
        return { success: true, data: { deleted: true } } as ApiResult<{ deleted: boolean }>
      },
      onProgress: (done, total) => calls.push([done, total]),
    })
    expect(out.okIds).toHaveLength(4)
    expect(calls).toHaveLength(4)
    expect(calls.map((c) => c[0])).toEqual([1, 2, 3, 4])
    for (const [, total] of calls) expect(total).toBe(4)
    expect(calls[calls.length - 1]).toEqual([4, 4])
  })

  it('空列表 ⇒ 不打任何请求、进度零回吐', async () => {
    let called = 0
    const progress = await clearServerConversations({
      ids: [],
      remove: async () => {
        called += 1
        return { success: true, data: { deleted: true } } as ApiResult<{ deleted: boolean }>
      },
      onProgress: () => {
        called += 100
      },
    })
    expect(progress).toEqual({ okIds: [], failedIds: [] })
    expect(called).toBe(0)
  })
})

/* ================================================================== *
 * ③ 结果诚实:applyServerClearResult —— 失败行保留、幸存行顺序不变
 * ================================================================== */

describe('③ applyServerClearResult', () => {
  const prev = ['a', 'b', 'c', 'd', 'e'].map(item)

  it('部分失败:成功行摘掉,失败行原样保留,幸存行保持原有相对顺序', () => {
    const got = applyServerClearResult(prev, { okIds: ['a', 'c'], failedIds: ['b', 'd', 'e'] })
    expect(got.items.map((x) => x.id)).toEqual(['b', 'd', 'e'])
    expect(got.allCleared).toBe(false)
  })

  it('全部成功:列表清空', () => {
    const got = applyServerClearResult(prev, {
      okIds: ['a', 'b', 'c', 'd', 'e'],
      failedIds: [],
    })
    expect(got.items).toEqual([])
    expect(got.allCleared).toBe(true)
  })

  it('全部失败:列表一字不动(不得把"没删掉"渲染成"已清空")', () => {
    const got = applyServerClearResult(prev, { okIds: [], failedIds: ['a', 'b', 'c', 'd', 'e'] })
    expect(got.items.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(got.allCleared).toBe(false)
  })

  it('入参列表不被改写(纯函数,页面可安全拿快照喂它)', () => {
    const src = [item('a'), item('b')]
    applyServerClearResult(src, { okIds: ['a'], failedIds: [] })
    expect(src.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

/* ================================================================== *
 * ①⑤ 源码级 + 语言包:确认文案含条数、接线不越界
 * ================================================================== */

describe('① 五语言包:服务端清空文案齐备且带插值占位', () => {
  const LANGS = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
  // 各语言确认框里必须出现"不可恢复"的同义措辞 —— 只验条数不验强措辞,确认框会退化成弱提示
  const IRREVERSIBLE: Record<(typeof LANGS)[number], string> = {
    'zh-CN': '不可恢复',
    en: 'cannot be undone',
    ja: '元に戻せません',
    ko: '되돌릴 수 없습니다',
    'zh-TW': '無法復原',
  }
  for (const lang of LANGS) {
    it(`${lang}:确认带 {n} 与强措辞、进度带 {done}/{n}、结果带 {n} 与 {ok}/{fail}`, () => {
      const pack = JSON.parse(
        readFileSync(
          resolve(__dirname, `../../../packages/i18n/messages/miniapp-taro/${lang}.json`),
          'utf8',
        ),
      ) as { ai: { historyPage: Record<string, string> } }
      const hp = pack.ai.historyPage
      expect(hp.clearServerConfirm).toContain('{n}')
      expect(hp.clearServerConfirm).toContain(IRREVERSIBLE[lang])
      expect(hp.clearServerProgress).toContain('{done}')
      expect(hp.clearServerProgress).toContain('{n}')
      expect(hp.clearServerDone).toContain('{n}')
      expect(hp.clearServerPartial).toContain('{ok}')
      expect(hp.clearServerPartial).toContain('{fail}')
    })
  }
})

describe('④ 源码级反向锁:history.tsx 的清空接线', () => {
  const historySrc = readFileSync(resolve(__dirname, '../src/pkg-ai/ai/history.tsx'), 'utf8')
  // 反向锁只认代码不认注释:剥离块注释与行注释,免得 JSDoc 里的说明文字被当成接线证据
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

  it('确认框必须用 clearServerConfirm 且把当前已加载行数 n 传进去', () => {
    expect(historySrc).toContain("t('ai.historyPage.clearServerConfirm', { n: total })")
  })

  it('进度/结果文案接线齐全(showLoading 逐条刷新 + 两种结局各一个 toast)', () => {
    expect(historySrc).toContain("t('ai.historyPage.clearServerProgress', { done: 0, n: total })")
    expect(historySrc).toContain("t('ai.historyPage.clearServerProgress', { done, n: total })")
    expect(historySrc).toContain("t('ai.historyPage.clearServerDone', { n: total })")
    expect(historySrc).toContain("t('ai.historyPage.clearServerPartial'")
  })

  it('服务端清空:必须有 server 守卫、走 clearServerConversations、不写本机快照', () => {
    const start = historySrc.indexOf('const onClearServerAll')
    expect(start).toBeGreaterThan(0)
    const body = strip(historySrc.slice(start, historySrc.indexOf('const isFiltered', start)))
    expect(body).toContain("source !== 'server'")
    expect(body).toContain('clearServerConversations')
    expect(body).toContain('deleteConversation(')
    expect(body).not.toContain('setStorageSync')
  })

  it('兜底态(local)清空路径结构上不触发服务端删除 —— 只写本机快照', () => {
    const start = historySrc.indexOf('const onClearAll = useCallback')
    expect(start).toBeGreaterThan(0)
    const end = historySrc.indexOf('const onClearServerAll', start)
    const body = strip(historySrc.slice(start, end))
    expect(body).toContain('Taro.setStorageSync(HISTORY_KEY, [])')
    expect(body).not.toContain('deleteConversation')
    expect(body).not.toContain('clearServerConversations')
  })

  it('入口按源分发:server 走 onClearServerAll,local 保持原 onClearAll', () => {
    expect(historySrc).toContain("source === 'server' ? () => void onClearServerAll() : onClearAll")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
