// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAsyncHighlightCache,
  createRawCodeTokens,
  shouldBypassSyntaxHighlighting,
  type AsyncHighlightLoader,
} from './async-highlight-cache'

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function makeLoader(overrides?: Partial<AsyncHighlightLoader>): AsyncHighlightLoader & {
  loadHighlighter: ReturnType<typeof vi.fn>
  tokenize: ReturnType<typeof vi.fn>
} {
  const loadHighlighter = vi.fn(async (language: string) => ({ language }))
  const tokenize = vi.fn((_highlighter: unknown, code: string) => ({
    fg: '#000000',
    tokens: code.split('\n').map((line) => [{ content: line, color: '#ff0000' }]),
  }))
  return { loadHighlighter, tokenize, ...overrides } as AsyncHighlightLoader & {
    loadHighlighter: typeof loadHighlighter
    tokenize: typeof tokenize
  }
}

describe('shouldBypassSyntaxHighlighting', () => {
  it('纯文本/日志语言直判', () => {
    expect(shouldBypassSyntaxHighlighting('log')).toBe(true)
    expect(shouldBypassSyntaxHighlighting(' text ')).toBe(true)
    expect(shouldBypassSyntaxHighlighting('plaintext')).toBe(true)
    expect(shouldBypassSyntaxHighlighting('')).toBe(true)
    expect(shouldBypassSyntaxHighlighting('ts')).toBe(false)
  })
})

describe('createAsyncHighlightCache', () => {
  let loader: ReturnType<typeof makeLoader>

  beforeEach(() => {
    loader = makeLoader()
  })

  it('同代码二次渲染命中缓存:loader/tokenize 只调一次,二次同步返回结果', async () => {
    const cache = createAsyncHighlightCache(loader)
    const first: Array<unknown> = []
    expect(cache.highlight('const a = 1', 'ts', undefined, (r) => first.push(r))).toBeNull()
    await flush()
    expect(first).toHaveLength(1)
    expect(loader.loadHighlighter).toHaveBeenCalledTimes(1)
    expect(loader.tokenize).toHaveBeenCalledTimes(1)

    const second: Array<unknown> = []
    const sync = cache.highlight('const a = 1', 'ts', undefined, (r) => second.push(r))
    expect(sync).not.toBeNull()
    expect(second).toHaveLength(0) // cache hit 的回调也不允许同步触发
    await flush()
    expect(second).toHaveLength(1)
    expect(loader.loadHighlighter).toHaveBeenCalledTimes(1)
    expect(loader.tokenize).toHaveBeenCalledTimes(1)
  })

  it('cache hit 回调经微任务送达(不嵌套同步 setState)', async () => {
    const cache = createAsyncHighlightCache(loader)
    cache.highlight('code', 'ts', undefined)
    await flush()

    const delivered: Array<unknown> = []
    cache.highlight('code', 'ts', undefined, (r) => delivered.push(r))
    expect(delivered).toHaveLength(0)
    await Promise.resolve()
    await Promise.resolve()
    expect(delivered).toHaveLength(1)
  })

  it('text/log 语言直接 raw tokens,不走 loader', () => {
    const cache = createAsyncHighlightCache(loader)
    const raw = cache.highlight('plain log text\nsecond line', 'log', undefined, () => {
      throw new Error('纯文本语言不应回调')
    })
    expect(raw).toEqual(createRawCodeTokens('plain log text\nsecond line'))
    expect(loader.loadHighlighter).not.toHaveBeenCalled()
    expect(loader.tokenize).not.toHaveBeenCalled()
    expect(cache.getTokensCacheSize()).toBe(0)
  })

  it('isSupportedLanguage 为 false 的语言走 raw tokens', () => {
    const cache = createAsyncHighlightCache({
      ...loader,
      isSupportedLanguage: (lang) => lang === 'ts',
    })
    const raw = cache.highlight('x', 'nope', undefined)
    expect(raw).toEqual(createRawCodeTokens('x'))
    expect(loader.loadHighlighter).not.toHaveBeenCalled()
  })

  it('loader 失败停在 rawTokens 不重试:同 lang:theme 后续请求不再触发加载', async () => {
    const failing = makeLoader({
      loadHighlighter: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    const cache = createAsyncHighlightCache(failing)

    const got: Array<unknown> = []
    expect(cache.highlight('a', 'ts', undefined, (r) => got.push(r))).toBeNull()
    await flush()
    expect(got).toHaveLength(0)
    expect(failing.loadHighlighter).toHaveBeenCalledTimes(1)
    expect(failing.tokenize).not.toHaveBeenCalled()

    // 第二次请求同 lang:theme:失败的 promise 已粘住,不再触发 loadHighlighter
    expect(cache.highlight('b', 'ts', undefined, (r) => got.push(r))).toBeNull()
    await flush()
    expect(got).toHaveLength(0)
    expect(failing.loadHighlighter).toHaveBeenCalledTimes(1)
    expect(failing.tokenize).not.toHaveBeenCalled()
  })

  it('并发同 key 请求共享一次 tokenize,全部回调各送达一次', async () => {
    const cache = createAsyncHighlightCache(loader)
    const gotA: Array<unknown> = []
    const gotB: Array<unknown> = []
    expect(cache.highlight('same', 'ts', undefined, (r) => gotA.push(r))).toBeNull()
    expect(cache.highlight('same', 'ts', undefined, (r) => gotB.push(r))).toBeNull()
    await flush()
    expect(gotA).toHaveLength(1)
    expect(gotB).toHaveLength(1)
    expect(loader.tokenize).toHaveBeenCalledTimes(1)
  })

  it('tokens 缓存超界 FIFO 淘汰最早条目', async () => {
    const cache = createAsyncHighlightCache({ ...loader, tokensCacheLimit: 2 })
    cache.highlight('A', 'ts', undefined)
    cache.highlight('B', 'ts', undefined)
    await flush()
    expect(cache.getTokensCacheSize()).toBe(2)

    cache.highlight('C', 'ts', undefined)
    await flush()
    expect(cache.getTokensCacheSize()).toBe(2)

    // A 已被淘汰:再次请求重新 tokenize(共 4 次:A,B,C,A)
    const got: Array<unknown> = []
    cache.highlight('A', 'ts', undefined, (r) => got.push(r))
    await flush()
    expect(got).toHaveLength(1)
    expect(loader.tokenize).toHaveBeenCalledTimes(4)
    expect(cache.getTokensCacheSize()).toBe(2)
  })

  it('不同 lang/theme 各自建缓存键,不互相命中', async () => {
    const cache = createAsyncHighlightCache(loader)
    cache.highlight('x', 'ts', 'dark')
    cache.highlight('x', 'ts', 'light')
    cache.highlight('x', 'js', 'dark')
    await flush()
    expect(loader.tokenize).toHaveBeenCalledTimes(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
