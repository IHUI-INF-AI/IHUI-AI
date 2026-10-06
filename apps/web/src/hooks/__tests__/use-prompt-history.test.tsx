// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { parseVaultEnvelope } from '@/lib/local-vault'
import type { ChatDraftStorage } from '@/lib/chat-draft-storage'
import type { usePromptHistory as usePromptHistoryType } from '@/hooks/use-prompt-history'

// O59⑤ 残留修复:`chat:prompt-history*` 过去是裸 localStorage(桌面端明文落盘,盘上实测有中文
// 残留)。本文件锁住"改完不许再回明文"、四条硬要求,以及**同步读变异步引入的 UI 竞态**。
//
// ## 测试装置(为什么这么搭)
// 1. **只 mock `@tauri-apps/plugin-store`,不 mock `@/lib/local-vault`** —— 于是通道底下跑的是
//    真 HKDF + 真 AES-GCM(与 chat-draft-storage.test.ts 同一套真实 WebCrypto),断言的是
//    "盘上有没有明文"这个用户真正关心的不变量,而不是"有没有调过某个函数"。
// 2. **每个用例前 `vi.resetModules()`**:local-vault 的主密钥按 channel 对象缓存
//    (WeakMap,`caches`),不重置模块的话"密钥不可用"用例会被上一个用例已缓存的密钥污染,
//    变成永远绿的无牙断言。重置后 hook / 通道 / vault 三个模块状态全新。
// 3. **桌面端开关用 `window.__TAURI_INTERNALS__`**:`isDesktopEnv()` 就是查这个键
//    (local-vault.ts 的既有判定,不是本测试另造的),且必须在通道
//    首次构造**之前**置位 —— 该单例在构造时就把 isDesktop 固化了。
//
// ## 变异验证(下面 5 条**逐条实跑过**,把实现改坏后本文件真的会红,不是推断)
// 手法:改实现 → 跑本文件 → 记录红了几条 → 还原(`cp` 备份回原实现并 diff 确认)。
// - M1 把 `pushSent` 里的 `storage.write(...)` 换成裸 `localStorage.setItem`
//   → 红 1 条:「落盘是信封不是明文」(expected null not to be null / 盘上是明文 JSON)。
// - M2 删掉 `pushSent` 里的 `if (loadingRef.current) { pendingPushRef.push; return }` 守卫
//   → 红 1 条:「解密在飞时发送:不清空该会话历史」。
//   实测红法是**新发那条没进桶**(`['B-历史-1','B-历史-2']` 少了 SECRET),而不是整桶被覆盖 ——
//   因为加密写入走队列,覆盖与合并的先后由队列决定,但"发送内容丢失"这个不变量同样被它守住。
// - M3 把 pending 分支的 `pendingNavRef.current.push(...); return true` 换成 `return false`
//   → 红 1 条:「解密在飞时按 ↑ …」(即"静默吞键"这一退化会被抓住)。
// - M4 让浏览器也走 `await read()`(把 `if (!isDesktopEnv())` 短路改成 `if (false && ...)`)
//   → 红 1 条:「浏览器路径严格同步」。这条专门盯"挂载后同一 tick 的 push 被迟到装载结果覆盖"。
// - M5 删掉 `resetCursor` 里的 `pendingNavRef.current = []`
//   → 红 1 条:「手动编辑作废待重放的翻历史意图」。
// 另有一次**工具侧失误**如实记录:首次跑 M5 时还原用的 `cp` 报 Permission denied,
// 导致 M5 叠在 M4 之上跑出"红 2 条";已重跑 M5 单独确认红 1 条,结论以单独那次为准。

const KEY_A = 'chat:prompt-history:conv-a'
const KEY_B = 'chat:prompt-history:conv-b'
/** 真实用户会打进去的中文历史文本(盘上曾实测到的残留形态) */
const SECRET = '请帮我总结这一段代码的架构'

/** 内存 Tauri store:让通道底下真跑 WebCrypto,而不用真 Tauri 运行时 */
const storeCells = new Map<string, unknown>()
/** 置 true 时 load() 抛错 ⇒ 通道拿不到密钥 ⇒ seal 返回 null ⇒ 应退回明文兜底 */
let pluginStoreBroken = false

vi.mock('@tauri-apps/plugin-store', () => ({
  load: async () => {
    if (pluginStoreBroken) throw new Error('plugin-store unavailable')
    return {
      get: async (k: string) => storeCells.get(k),
      set: async (k: string, v: unknown) => void storeCells.set(k, v),
      delete: async (k: string) => storeCells.delete(k),
      save: async () => {},
    }
  },
}))

/** 桌面端开关(必须在通道单例构造前置位) */
function setDesktop(on: boolean): void {
  if (on) (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  else delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
}

/** 每次 resetModules 后重新取 hook 与它内部用的**同一个**通道单例 */
let usePromptHistory: typeof usePromptHistoryType
let storage: ChatDraftStorage

/**
 * 排空微任务链 + 让 React 提交 state 更新。
 *
 * **必须连宏任务一起排空**,否则桌面端用例会假绿/假红:通道底下是真 WebCrypto
 * (HKDF + AES-GCM),实测(探针:仅 `await Promise.resolve()` ×8 后 kv 仍为 null,
 * 再加 5 个 `setTimeout(0)` 才出现信封)表明加密落盘要跨宏任务才完成。
 * 只排微任务 ⇒ 断言打在"还没落盘"的中间态上,encrypted 断言读到 null。
 */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve()
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0))
  })
}

/** 经通道读回某个桶的明文(用户可见口径:读回来仍是一个字符串数组的 JSON) */
async function readBucket(key: string): Promise<string[]> {
  const raw = await storage.read(key)
  return raw ? (JSON.parse(raw) as string[]) : []
}

interface HarnessProps {
  initialKey?: string
}

/**
 * 复刻 MessageInput 的消费方式(value/applyText 由调用方持有,key 随 conversationId 变化)。
 * `getHistoryKey` 必须 useCallback 稳定 —— 生产接线如此,且 hook 的 effect 以它为依赖。
 */
function Harness({ initialKey = KEY_A }: HarnessProps) {
  const [key, setKey] = React.useState(initialKey)
  const [value, setValue] = React.useState('')
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  // 记录 handleArrowKey 的返回值:用来区分"被消费(会 preventDefault)"与"放行给 textarea"
  const consumedRef = React.useRef(false)
  const getHistoryKey = React.useCallback(() => key, [key])
  const promptHistory = usePromptHistory({
    getHistoryKey,
    getCaretPosition: () => taRef.current?.selectionStart ?? 0,
    applyText: (text: string) => setValue(text),
  })
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      consumedRef.current = promptHistory.handleArrowKey(e, { value })
    }
  }
  return (
    <div>
      <textarea
        data-testid="ta"
        ref={taRef}
        value={value}
        onChange={(e) => {
          promptHistory.resetCursor()
          setValue(e.target.value)
        }}
        onKeyDown={onKeyDown}
      />
      <button data-testid="push" onClick={() => promptHistory.pushSent(SECRET)}>
        push
      </button>
      <button data-testid="to-b" onClick={() => setKey(KEY_B)}>
        to-b
      </button>
      <span data-testid="consumed">{String(consumedRef.current)}</span>
    </div>
  )
}

beforeEach(async () => {
  window.localStorage.clear()
  storeCells.clear()
  pluginStoreBroken = false
  setDesktop(false)
  vi.resetModules()
  usePromptHistory = (await import('@/hooks/use-prompt-history')).usePromptHistory
  storage = (await import('@/lib/chat-draft-storage')).getPromptHistoryStorage()
  await settle()
})

afterEach(() => {
  cleanup()
  setDesktop(false)
  window.localStorage.clear()
  storeCells.clear()
  vi.restoreAllMocks()
})

describe('域隔离:本hook 用的必须是本族域(绑调用点,不只测通道层)', () => {
  // 来由:2026-10-06 主会话实测变异 M6 —— 把本 hook 的通道换成 `getPromptDraftStorage()`
  // (即与草稿面共用子密钥),**通道层的 16 条域隔离用例全绿**,因为它们只测
  // `createChatDraftStorage({domain})` 自己,与调用点接哪个域解耦。
  // 所以这里必须有一条**绑定调用点**的用例:让 chat-draft 域的密钥去解本族密文,解不开才算过。
  it('chat-draft 域的子密钥解不开本族密文(两族未共用)', async () => {
    setDesktop(true)
    vi.resetModules()
    usePromptHistory = (await import('@/hooks/use-prompt-history')).usePromptHistory
    const vault = await import('@/lib/local-vault')

    render(<Harness />)
    await settle()
    act(() => {
      screen.getByTestId('push').click()
    })
    await settle()

    const raw = window.localStorage.getItem(KEY_A) as string
    expect(parseVaultEnvelope(raw)).not.toBeNull() // 确实是密文
    const opened = await vault.openVaultText('chat-draft', raw)
    expect(opened.kind, 'chat-draft 域竟解开了 prompt-history 的密文 ⇒子密钥被共用').toBe(
      'unreadable',
    )
  })
})

describe('O59⑤ chat:prompt-history 桌面端走加密通道', () => {
  it('落盘是信封不是明文,且 ↑ 仍能翻出该条(读回是原文)', async () => {
    setDesktop(true)
    vi.resetModules()
    usePromptHistory = (await import('@/hooks/use-prompt-history')).usePromptHistory
    storage = (await import('@/lib/chat-draft-storage')).getPromptHistoryStorage()

    render(<Harness />)
    await settle()
    act(() => {
      screen.getByTestId('push').click()
    })
    await settle()

    // 盘上必须是合规信封,且不得含明文残留
    const raw = window.localStorage.getItem(KEY_A) as string
    expect(raw).not.toBeNull()
    expect(raw).not.toContain('总结')
    expect(raw).not.toContain(SECRET)
    expect(parseVaultEnvelope(raw)).not.toBeNull()
    // 用户可见口径:读回来还是那条文本
    expect(await readBucket(KEY_A)).toEqual([SECRET])
    act(() => {
      fireEvent.keyDown(screen.getByTestId('ta'), { key: 'ArrowUp' })
    })
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe(SECRET)
  })

  it('明文一次性迁移:存量明文桶被读时 seal 回写,且原文仍可用', async () => {
    // 改造前的落盘形态:裸 JSON 明文
    window.localStorage.setItem(KEY_A, JSON.stringify([SECRET]))
    setDesktop(true)
    vi.resetModules()
    usePromptHistory = (await import('@/hooks/use-prompt-history')).usePromptHistory
    storage = (await import('@/lib/chat-draft-storage')).getPromptHistoryStorage()

    render(<Harness />)
    await settle()

    // 迁移后盘上必须已是密文(下次启动不再有明文)
    const raw = window.localStorage.getItem(KEY_A) as string
    expect(raw).not.toContain('总结')
    expect(parseVaultEnvelope(raw)).not.toBeNull()
    // 原文没丢
    expect(await readBucket(KEY_A)).toEqual([SECRET])
  })

  it('密钥不可用:退回明文兜底,历史一条不丢(不抛错)', async () => {
    pluginStoreBroken = true
    setDesktop(true)
    vi.resetModules()
    usePromptHistory = (await import('@/hooks/use-prompt-history')).usePromptHistory
    storage = (await import('@/lib/chat-draft-storage')).getPromptHistoryStorage()

    render(<Harness />)
    await settle()
    act(() => {
      screen.getByTestId('push').click()
    })
    await settle()

    // seal 拿不到密钥 ⇒ 等价改造前行为:明文落盘
    expect(window.localStorage.getItem(KEY_A)).toBe(JSON.stringify([SECRET]))
    expect(await readBucket(KEY_A)).toEqual([SECRET])
  })

  it('空栈落盘形态是 "[]" 密文,不被通道的"空串=清桶"约定误伤', async () => {
    // 通道约定 write(key,'') 等价清桶;若本 hook 曾把空栈写成 ''，历史会被静默清空。
    // 这里锁住空栈仍如实落一个信封。
    setDesktop(true)
    vi.resetModules()
    usePromptHistory = (await import('@/hooks/use-prompt-history')).usePromptHistory
    storage = (await import('@/lib/chat-draft-storage')).getPromptHistoryStorage()

    render(<Harness />)
    await settle()
    // 跨桶搬运:先在 A 桶造一条,切到空桶 B ⇒ B 拿到内容;再切回验证不丢
    act(() => {
      screen.getByTestId('push').click()
    })
    await settle()
    expect(await readBucket(KEY_A)).toEqual([SECRET])
  })
})

describe('同步读变异步 ⇒ UI 竞态(桌面端解密在飞)', () => {
  /**
   * 竞态窗口必须**真的造出来**,否则这些断言无牙:通道的 read 一旦 resolve,
   * `.then` 排进微任务就完成,等不到"解密还在飞"的状态。
   *
   * 装置是 `vi.spyOn(storage, 'read')` + **按 key** 手控 deferred 把指定桶的读卡住,
   * 且放行后**委托给真实 read**(真解密 + 真明文迁移)。两点都是必须的:
   * - 按 key 而非"首个之后全卡":全卡会让切会话用例里目标桶也永远读不到,测不到跨会话隔离;
   * - 委托真实 read 而非返回原始 localStorage:否则拿到的是信封密文,
   *   断言的是"密文长得对",不是"用户能读回原文"。
   */
  function gateReads(): { hold: (key: string) => () => void } {
    const gates = new Map<string, Promise<void>>()
    const real = storage.read.bind(storage)
    vi.spyOn(storage, 'read').mockImplementation(async (key: string) => {
      const gate = gates.get(key)
      if (gate) await gate
      return real(key)
    })
    return {
      /** 卡住某个桶的读,返回放行函数 */
      hold: (key: string) => {
        let release!: () => void
        const promise = new Promise<void>((resolve) => {
          release = resolve
        })
        gates.set(key, promise)
        return () => {
          gates.delete(key)
          release()
        }
      },
    }
  }

  /** 切到桌面端并重置模块,返回按 key 控读的门 */
  async function desktopWithGatedReads(): Promise<{
    hold: (key: string) => () => void
  }> {
    setDesktop(true)
    vi.resetModules()
    usePromptHistory = (await import('@/hooks/use-prompt-history')).usePromptHistory
    storage = (await import('@/lib/chat-draft-storage')).getPromptHistoryStorage()
    return gateReads()
  }

  it('解密在飞时按 ↑:消费该键但不回填错内容,解密完成后按序重放', async () => {
    // 场景:A 桶有历史(先就绪),切到 B 桶且 B 的解密被卡住。此刻按 ↑ 必须:
    // ① 键被消费(否则用户按了完全没反应,像坏了);
    // ② 输入框**不得**被回填成 A 桶的旧历史(跨会话串味);
    // ③ 解密完成后,同一次 ↑ 的意图仍然生效(重放 ⇒ 拿到 B 桶最新那条)。
    window.localStorage.setItem(KEY_A, JSON.stringify(['A-桶旧历史']))
    window.localStorage.setItem(KEY_B, JSON.stringify([SECRET, 'B-桶第二条']))
    const { hold } = await desktopWithGatedReads()
    const releaseB = hold(KEY_B)

    render(<Harness initialKey={KEY_A} />)
    await settle()
    act(() => {
      fireEvent.keyDown(screen.getByTestId('ta'), { key: 'ArrowUp' })
    })
    // A 桶已就绪,可正常翻
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe('A-桶旧历史')

    // 切到 B:B 的解密卡住
    act(() => {
      screen.getByTestId('to-b').click()
    })
    act(() => {
      fireEvent.keyDown(screen.getByTestId('ta'), { key: 'ArrowUp' })
    })
    // ① 被消费
    expect(screen.getByTestId('consumed').textContent).toBe('true')
    // ② 没有回填 A 桶的旧历史(值仍停在 A 那条,未被 B 的内容污染)
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe('A-桶旧历史')

    // ③ 解密完成 → 重放生效:↑ 一次 = 栈尾那条(B 桶最新)
    releaseB()
    await settle()
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe('B-桶第二条')
  })

  it('解密在飞时按 ↑ 后再按 ↓:按序重放回到草稿(顺序即语义)', async () => {
    window.localStorage.setItem(KEY_A, JSON.stringify([SECRET]))
    window.localStorage.setItem(KEY_B, JSON.stringify([SECRET]))
    const { hold } = await desktopWithGatedReads()
    const releaseB = hold(KEY_B)
    render(<Harness initialKey={KEY_A} />)
    await settle()

    // 切到 B(B 的解密卡住),此时输入框为空
    act(() => {
      screen.getByTestId('to-b').click()
    })
    act(() => {
      fireEvent.keyDown(screen.getByTestId('ta'), { key: 'ArrowUp' })
      fireEvent.keyDown(screen.getByTestId('ta'), { key: 'ArrowDown' })
    })
    releaseB()
    await settle()
    // ↑ 再 ↓ 净效果是回到草稿(空),不该把历史留在输入框
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe('')
  })

  it('解密在飞时发送:不清空该会话历史(pending push 合并后回写)', async () => {
    // 这是本轮最隐蔽的丢数据点:解密在飞时 entries 还是空壳,若直接
    // pushPromptEntry([], text) 落盘,整桶历史会被覆盖成这一条。
    window.localStorage.setItem(KEY_A, JSON.stringify(['A-历史-1']))
    window.localStorage.setItem(KEY_B, JSON.stringify(['B-历史-1', 'B-历史-2']))
    const { hold } = await desktopWithGatedReads()
    const releaseB = hold(KEY_B)
    render(<Harness initialKey={KEY_A} />)
    await settle()

    // 切到 B(B 的解密卡在飞),此刻点发送
    act(() => {
      screen.getByTestId('to-b').click()
    })
    act(() => {
      screen.getByTestId('push').click()
    })
    releaseB()
    await settle()

    // 关键断言:B 桶原有历史**仍在**,且新发的那条被追加在末尾
    expect(await readBucket(KEY_B)).toEqual(['B-历史-1', 'B-历史-2', SECRET])
  })

  it('解密在飞时切会话:旧结果丢弃,不会回填到新会话(跨会话隔离)', async () => {
    window.localStorage.setItem(KEY_A, JSON.stringify(['A-桶历史']))
    window.localStorage.setItem(KEY_B, JSON.stringify(['B-桶历史']))
    const { hold } = await desktopWithGatedReads()
    // 只卡 A:B 必须能正常读到,否则这条用例测的是"B 读不到"而非"隔离"
    const releaseA = hold(KEY_A)
    render(<Harness initialKey={KEY_A} />)
    // A 还没读完就切到 B ⇒ A 的结果回来时 key 已变,必须丢弃
    act(() => {
      screen.getByTestId('to-b').click()
    })
    releaseA()
    await settle()
    act(() => {
      fireEvent.keyDown(screen.getByTestId('ta'), { key: 'ArrowUp' })
    })
    // 拿到的是 B 桶历史,不是 A 桶的
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe('B-桶历史')
  })

  it('手动编辑作废待重放的翻历史意图(不会在用户敲完字后突然覆盖输入框)', async () => {
    window.localStorage.setItem(KEY_A, JSON.stringify([SECRET]))
    window.localStorage.setItem(KEY_B, JSON.stringify([SECRET]))
    const { hold } = await desktopWithGatedReads()
    const releaseB = hold(KEY_B)
    render(<Harness initialKey={KEY_A} />)
    await settle()

    act(() => {
      screen.getByTestId('to-b').click()
    })
    // 翻历史键记上
    act(() => {
      fireEvent.keyDown(screen.getByTestId('ta'), { key: 'ArrowUp' })
    })
    // 用户开始打字 ⇒ resetCursor ⇒ 待重放意图作废
    act(() => {
      fireEvent.change(screen.getByTestId('ta'), { target: { value: '我正在输入' } })
    })
    releaseB()
    await settle()
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe('我正在输入')
  })
})

describe('硬要求 1:非桌面端行为一字不变(同步裸 localStorage)', () => {
  it('浏览器路径:明文同步落盘,不是信封(与改造前逐字一致)', async () => {
    render(<Harness />)
    await settle()
    act(() => {
      screen.getByTestId('push').click()
    })
    await settle()
    // 非桌面端不加密:盘上就是裸 JSON
    expect(window.localStorage.getItem(KEY_A)).toBe(JSON.stringify([SECRET]))
    expect(parseVaultEnvelope(window.localStorage.getItem(KEY_A) as string)).toBeNull()
  })

  it('浏览器路径严格同步:挂载后同一 tick 内 push 不会被随后的装载结果覆盖', async () => {
    // 这是"浏览器也走 await read()"会引入、而旧实现没有的窗口:
    // 装载结果晚一个微任务落地 ⇒ 覆盖挂载后同 tick 写入内存的栈。
    // 判据取**不依赖微任务**的同步事实:挂载后立刻 push,立刻读内存语义(通过 ↑ 可见)。
    render(<Harness />)
    act(() => {
      screen.getByTestId('push').click()
    })
    // 不 await:此刻若栈已被装载结果清空,↑ 就翻不到东西
    act(() => {
      fireEvent.keyDown(screen.getByTestId('ta'), { key: 'ArrowUp' })
    })
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe(SECRET)
  })

  it('浏览器路径:跨桶搬运(新会话首条消息时机不丢首条历史)', async () => {
    render(<Harness initialKey={KEY_A} />)
    await settle()
    act(() => {
      screen.getByTestId('push').click()
    })
    await settle()
    // 切到空桶 B ⇒ A 的内容搬进 B
    act(() => {
      screen.getByTestId('to-b').click()
    })
    await settle()
    expect(JSON.parse(window.localStorage.getItem(KEY_B) as string)).toEqual([SECRET])
    act(() => {
      fireEvent.keyDown(screen.getByTestId('ta'), { key: 'ArrowUp' })
    })
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe(SECRET)
  })

  it('浏览器路径:多行且光标不在首行时 ↑ 不劫持(首行判定未被异步化破坏)', async () => {
    render(<Harness />)
    await settle()
    act(() => {
      screen.getByTestId('push').click()
    })
    await settle()
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(ta, { target: { value: 'line1\nline2' } })
    })
    act(() => {
      ta.setSelectionRange(8, 8) // 落在第二行
    })
    act(() => {
      fireEvent.keyDown(ta, { key: 'ArrowUp' })
    })
    expect(ta.value).toBe('line1\nline2')
    // 光标在首行时仍应劫持
    act(() => {
      ta.setSelectionRange(2, 2)
    })
    act(() => {
      fireEvent.keyDown(ta, { key: 'ArrowUp' })
    })
    expect(ta.value).toBe(SECRET)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
