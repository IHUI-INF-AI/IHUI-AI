// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 问答创建页共享段/共享钩子形制锁(2026-11-07)。
 *  ① 选图:剩余张数决定 count、取消/失败不追加、满额只提示;
 *  ② 草稿:读/写/清都落在注入端口上,空草稿不恢复;
 *  ③ 阴性对照:摘掉注入的 media / draft ⇒ 必抛 `[host-port] missing <name>`;
 *  ④ 源码锁:小程序页必须 import 共享段/钩子且不得再出现 Taro 平台 API,
 *     RN 宿主必须 import expo-image-picker + AsyncStorage 并把 media/draft 真传给共享屏。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

/**
 * 渲染口径(与既有 chat-*-contract 同法):共享段位于 packages/app,其 JSX 由该包自带
 * react@19 的 jsx-runtime 编译;miniapp 测试侧 alias 把裸 react-dom 钉到 react@18,
 * react-dom@18 不认 react19 元素(Objects are not valid)。故用 packages/app 自己的
 * react-dom@19 做 SSR,react-native 桩也换成同源 react@19 宿主元素 ——
 * 只收口在本测试文件,不改 vitest.config(改全局 alias 会把 chat-*-contract 反向打红)。
 */
const appRequire = createRequire(import.meta.url)
const React19 = appRequire('../../../packages/app/node_modules/react/index.js')
const ReactDOMServer19 = appRequire('../../../packages/app/node_modules/react-dom/server.js')

vi.mock('react-native', () => {
  const React = createRequire(import.meta.url)('../../../packages/app/node_modules/react/index.js')
  const make = (tag: string) => {
    const Host = (props: Record<string, unknown>) => {
      const { resizeMode: _resizeMode, accessibilityRole: _role, ...rest } = props
      return React.createElement(tag, rest)
    }
    Host.displayName = `RNStub_${tag}`
    return Host
  }
  const makeImage = () => {
    const Img = (props: Record<string, unknown>) => {
      const { source, resizeMode: _resizeMode, accessibilityRole: _role, ...rest } = props
      return React.createElement('img', {
        ...rest,
        src: (source as { uri?: string } | undefined)?.uri,
      })
    }
    Img.displayName = 'RNStub_img'
    return Img
  }
  return {
    View: make('div'),
    Text: make('span'),
    Image: makeImage(),
    TouchableOpacity: make('button'),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      flatten: (styles: unknown) => styles,
      hairlineWidth: 1,
    },
  }
})

import {
  AskImageField,
  ASK_IMAGE_MAX,
  pickAskImages,
} from '@ihui/rn-app/features/ask-create/AskImageField'
import {
  ASK_DRAFT_KEY,
  clearAskDraft,
  normalizeAskDraft,
  readAskDraft,
  writeAskDraft,
} from '@ihui/rn-app/features/ask-create/ask-draft'
import type { AsyncKvPort, MediaPort, OnToast } from '@ihui/types'

const maxToast = '最多 3 张'

const renderStatic = (props: Record<string, unknown>): string =>
  ReactDOMServer19.renderToStaticMarkup(React19.createElement(AskImageField, props))

function makeMedia(uris: string[]): MediaPort & { pickImages: ReturnType<typeof vi.fn> } {
  return {
    pickImage: vi.fn(async () => null),
    pickImages: vi.fn(async () => uris.map((uri) => ({ uri }))),
    previewImage: vi.fn(async () => {}),
  }
}

function makeKv(initial: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(initial))
  const port: AsyncKvPort = {
    get: async <T,>(key: string) => (store.has(key) ? (store.get(key) as T) : null),
    set: async (key: string, value: unknown) => {
      store.set(key, value)
    },
    remove: async (key: string) => {
      store.delete(key)
    },
  }
  return { port, store }
}

describe('pickAskImages:选图只走注入端口', () => {
  it('按剩余张数取 count,并把 URI 交回 onAdd', async () => {
    const media = makeMedia(['new-1', 'new-2'])
    const onAdd = vi.fn()
    const onToast = vi.fn()
    const result = await pickAskImages({
      media,
      images: ['old-1'],
      maxCount: 3,
      maxToast,
      onToast,
      onAdd,
    })
    expect(media.pickImages).toHaveBeenCalledWith({ count: 2, source: 'album' })
    expect(onAdd).toHaveBeenCalledWith(['new-1', 'new-2'])
    expect(onToast).not.toHaveBeenCalled()
    expect(result.status).toBe('added')
  })

  it('满额不再调端口,只提示', async () => {
    const media = makeMedia(['x'])
    const onAdd = vi.fn()
    const onToast = vi.fn()
    const result = await pickAskImages({
      media,
      images: ['a', 'b', 'c'],
      maxCount: ASK_IMAGE_MAX,
      maxToast,
      onToast,
      onAdd,
    })
    expect(media.pickImages).not.toHaveBeenCalled()
    expect(onAdd).not.toHaveBeenCalled()
    expect(onToast).toHaveBeenCalledWith(maxToast, { kind: 'info' })
    expect(result.status).toBe('limited')
  })

  it('用户取消(空数组)不追加', async () => {
    const media = makeMedia([])
    const onAdd = vi.fn()
    const result = await pickAskImages({
      media,
      images: [],
      maxCount: ASK_IMAGE_MAX,
      maxToast,
      onToast: vi.fn(),
      onAdd,
    })
    expect(onAdd).not.toHaveBeenCalled()
    expect(result.status).toBe('cancelled')
  })

  it('端口抛错按失败处理,不追加也不弹错', async () => {
    const media: MediaPort = {
      pickImage: vi.fn(async () => null),
      pickImages: vi.fn(async () => {
        throw new Error('boom')
      }),
      previewImage: vi.fn(async () => {}),
    }
    const onAdd = vi.fn()
    const onToast = vi.fn()
    const result = await pickAskImages({
      media,
      images: [],
      maxCount: ASK_IMAGE_MAX,
      maxToast,
      onToast,
      onAdd,
    })
    expect(onAdd).not.toHaveBeenCalled()
    expect(onToast).not.toHaveBeenCalled()
    expect(result.status).toBe('failed')
  })

  it('阴性对照:摘掉 media 注入 ⇒ 必抛 [host-port] missing media', async () => {
    await expect(
      pickAskImages({
        media: undefined,
        images: [],
        maxToast,
        onToast: vi.fn(),
        onAdd: vi.fn(),
      }),
    ).rejects.toThrow('[host-port] missing media')
  })
})

describe('AskImageField:images prop 是有图/无图的唯一判据', () => {
  const onToast: OnToast = vi.fn()

  it('2 张图 ⇒ 两个缩略图 + 两个删除按钮 + 一个添加入口', () => {
    const html = renderStatic({
      images: ['a.png', 'b.png'],
      media: makeMedia([]),
      maxToast,
      onToast,
      onAdd: vi.fn(),
      onRemove: vi.fn(),
    })
    expect((html.match(/<img/g) ?? []).length).toBe(2)
    expect((html.match(/<button/g) ?? []).length).toBe(3)
  })

  it('满额 ⇒ 不再渲染添加入口', () => {
    const html = renderStatic({
      images: ['a.png', 'b.png', 'c.png'],
      media: makeMedia([]),
      maxToast,
      onToast,
      onAdd: vi.fn(),
      onRemove: vi.fn(),
    })
    expect((html.match(/<img/g) ?? []).length).toBe(3)
    expect((html.match(/<button/g) ?? []).length).toBe(3)
  })

  it('阴性对照:images=[] ⇒ 一个缩略图都不渲染', () => {
    const html = renderStatic({
      images: [],
      media: makeMedia([]),
      maxToast,
      onToast,
      onAdd: vi.fn(),
      onRemove: vi.fn(),
    })
    expect(html.includes('<img')).toBe(false)
  })
})

describe('草稿共享钩子:读/写/清只走注入端口', () => {
  it('标题或内容为空一律不算草稿', () => {
    expect(normalizeAskDraft(null)).toBeNull()
    expect(normalizeAskDraft({ title: '', content: '' })).toBeNull()
    expect(normalizeAskDraft({ title: '', content: '正文' })).toEqual({
      title: '',
      content: '正文',
    })
  })

  it('读取注入端口里的同 key 草稿', async () => {
    const { port } = makeKv({ [ASK_DRAFT_KEY]: { title: 't', content: 'c' } })
    await expect(readAskDraft(port)).resolves.toEqual({ title: 't', content: 'c' })
  })

  it('写入/清除落在同一 key 上', async () => {
    const { port, store } = makeKv()
    await writeAskDraft(port, { title: 't', content: 'c' })
    expect(store.get(ASK_DRAFT_KEY)).toEqual({ title: 't', content: 'c' })
    await clearAskDraft(port)
    expect(store.has(ASK_DRAFT_KEY)).toBe(false)
  })

  it('阴性对照:摘掉 draft 注入 ⇒ 读 / 写 / 清都必抛 [host-port] missing draft', async () => {
    await expect(readAskDraft(undefined)).rejects.toThrow('[host-port] missing draft')
    await expect(writeAskDraft(undefined, { title: 't' })).rejects.toThrow(
      '[host-port] missing draft',
    )
    await expect(clearAskDraft(undefined)).rejects.toThrow('[host-port] missing draft')
  })
})

describe('两端真消费源码锁', () => {
  const root = resolve(__dirname, '../../..')

  /**
   * 判的是"代码里有没有平台调用",不是"注释里提没提平台名":
   * 段/钩子的文件头与页注释会说明端口由谁实现(Taro / expo / AsyncStorage),
   * 那些说明是溯源与接线指引,不能当违规。先剥注释再断言。
   */
  function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  }

  it('小程序页必须消费共享段/钩子,且不得再出现 Taro.chooseImage / Taro.*StorageSync', () => {
    const page = stripComments(
      readFileSync(resolve(root, 'apps/miniapp-taro/src/pages/ask/create.tsx'), 'utf8'),
    )
    expect(page).toContain('@ihui/rn-app/features/ask-create/AskImageField')
    expect(page).toContain('@ihui/rn-app/features/ask-create/ask-draft')
    expect(page).toContain('createAskMediaPort')
    expect(page).toContain('createAskDraftPort')
    expect(page).not.toMatch(/Taro\.chooseImage/)
    expect(page).not.toMatch(/Taro\.(get|set|remove)StorageSync/)
  })

  it('小程序宿主适配器必须真调 Taro 平台 API', () => {
    const adapter = stripComments(
      readFileSync(resolve(root, 'apps/miniapp-taro/src/host/ask-create-ports.ts'), 'utf8'),
    )
    expect(adapter).toMatch(/Taro\.chooseImage/)
    expect(adapter).toMatch(/Taro\.getStorageSync/)
    expect(adapter).toMatch(/Taro\.setStorageSync/)
    expect(adapter).toMatch(/Taro\.removeStorageSync/)
  })

  it('RN 宿主必须真传 media/draft,且由 expo-image-picker + AsyncStorage 实现', () => {
    const screen = stripComments(
      readFileSync(resolve(root, 'apps/mobile-rn/src/screens/AskCreateScreen.tsx'), 'utf8'),
    )
    expect(screen).toContain('expo-image-picker')
    expect(screen).toContain('@react-native-async-storage/async-storage')
    expect(screen).toContain('media={media}')
    expect(screen).toContain('draft={draft}')
  })

  it('共享层不得出现平台 API', () => {
    for (const file of ['AskImageField.tsx', 'ask-draft.tsx', 'AskCreateScreen.tsx']) {
      const src = stripComments(
        readFileSync(resolve(root, 'packages/app/src/features/ask-create', file), 'utf8'),
      )
      expect(src).not.toMatch(/@tarojs\/taro/)
      expect(src).not.toMatch(/expo-image-picker/)
      expect(src).not.toMatch(/@react-native-async-storage/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
