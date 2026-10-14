// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D69 `runtimeSupportsInterjection` 的 web 消费链定向用例。
//
// 钉住三件事(改造的**全部**验收面):
//   ① 字段缺失 ⇒ false(与改造前写死 false 同形,零回归);
//   ② 字段 true / false ⇒ 分别透传(声明为 false 是"明确不支持",不是"没读到");
//   ③ 宿主不再有 `runtimeSupportsInterjection: false` 这类硬编码(收口不被回退)。
//
// 刻意**不**渲染 MessageInput(它要 next-intl / router / 一堆 store):判定段与落库段
// 是纯函数 + store,单独钉住即可;宿主侧只做源码面断言(防止有人把 false 抄回去)。

import { beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  noteRuntimeCapabilities,
  readInterjectionDeclaration,
  resolveInterjectionSupport,
} from '../runtime-capabilities'
import { useChatStore } from '@/stores/chat'

const HERE = __dirname
const MESSAGE_INPUT_SRC = path.resolve(
  HERE,
  '..',
  '..',
  '..',
  'components',
  'chat',
  'message-input.tsx',
)

describe('Runtime 插话能力声明 / 读取层', () => {
  it('① 字段缺失 ⇒ 未声明(null):空载荷 / 无关字段 / 非 boolean 一律不算声明', () => {
    const missing: unknown[] = [
      undefined,
      null,
      {},
      { messageId: 'm1' },
      { capabilities: {} },
      { capabilities: null },
      { runtimeCapabilities: {} },
      // 字符串 / 数字 / 数组形态不得被误读成"支持"(旧字段代际差的典型形态)
      { supportsInterjection: 'true' },
      { supportsInterjection: 1 },
      { capabilities: { interjection: 'yes' } },
      { supportsInterjection: [true] },
      'true',
      1,
    ]
    for (const raw of missing) {
      expect(readInterjectionDeclaration(raw), JSON.stringify(raw) ?? String(raw)).toBeNull()
    }
  })

  it('② 字段 true / false ⇒ 原样读出(四种候选键形态逐条钉)', () => {
    const carriers: Array<{ raw: unknown; expected: boolean }> = [
      { raw: { supportsInterjection: true }, expected: true },
      { raw: { supportsInterjection: false }, expected: false },
      { raw: { supports_interjection: true }, expected: true },
      { raw: { capabilities: { interjection: true } }, expected: true },
      { raw: { capabilities: { interjection: false } }, expected: false },
      { raw: { runtimeCapabilities: { interjection: true } }, expected: true },
    ]
    for (const { raw, expected } of carriers) {
      expect(readInterjectionDeclaration(raw), JSON.stringify(raw)).toBe(expected)
    }
  })

  it('① 回落判点:只有显式 true 才算支持(未声明 / false ⇒ false)', () => {
    expect(resolveInterjectionSupport(null)).toBe(false)
    expect(resolveInterjectionSupport(undefined)).toBe(false)
    expect(resolveInterjectionSupport(false)).toBe(false)
    expect(resolveInterjectionSupport(true)).toBe(true)
  })
})

describe('Runtime 插话能力声明 / 落库与消费链', () => {
  beforeEach(() => {
    useChatStore.getState().clearMessages()
  })

  it('① 帧载荷无该字段 ⇒ store 保持未声明 ⇒ 消费侧 false(零回归)', () => {
    expect(noteRuntimeCapabilities({ messageId: 'm1', totalTokens: 12 })).toBeNull()
    expect(useChatStore.getState().runtimeInterjection).toBeNull()
    expect(resolveInterjectionSupport(useChatStore.getState().runtimeInterjection)).toBe(false)
  })

  it('② 声明 true ⇒ store 落 true ⇒ 消费侧 true', () => {
    expect(noteRuntimeCapabilities({ supportsInterjection: true })).toBe(true)
    expect(useChatStore.getState().runtimeInterjection).toBe(true)
    expect(resolveInterjectionSupport(useChatStore.getState().runtimeInterjection)).toBe(true)
  })

  it('② 声明 false ⇒ store 落 false ⇒ 消费侧 false(与未声明同屏、异义)', () => {
    expect(noteRuntimeCapabilities({ capabilities: { interjection: false } })).toBe(false)
    expect(useChatStore.getState().runtimeInterjection).toBe(false)
    expect(resolveInterjectionSupport(useChatStore.getState().runtimeInterjection)).toBe(false)
  })

  it('② 未声明的空帧不得把已生效的声明抹回未知', () => {
    noteRuntimeCapabilities({ supportsInterjection: true })
    expect(useChatStore.getState().runtimeInterjection).toBe(true)
    noteRuntimeCapabilities({ totalTokens: 0 })
    expect(useChatStore.getState().runtimeInterjection).toBe(true)
  })

  it('新建对话:上一轮的声明随 clearMessages 一起复位(消费侧回落 false)', () => {
    noteRuntimeCapabilities({ supportsInterjection: true })
    expect(resolveInterjectionSupport(useChatStore.getState().runtimeInterjection)).toBe(true)
    useChatStore.getState().clearMessages()
    expect(useChatStore.getState().runtimeInterjection).toBeNull()
    expect(resolveInterjectionSupport(useChatStore.getState().runtimeInterjection)).toBe(false)
  })
})

describe('Runtime 插话能力声明 / 宿主收口(源码面)', () => {
  it('③ message-input.tsx 不再硬编码 runtimeSupportsInterjection=false,且走回落判点', () => {
    const src = fs.readFileSync(MESSAGE_INPUT_SRC, 'utf8')
    // 只扫代码面:注释里提到旧形态是被允许的解释性文字,不算硬编码
    const codeFace = src
      .split(/\r?\n/)
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n')
    expect(codeFace).not.toMatch(/runtimeSupportsInterjection\s*:\s*false/)
    expect(codeFace).not.toMatch(/runtimeSupportsInterjection\s*=\s*\{?\s*false/)
    // 三处(perms / blockCtx / prop)都读同一个派生值
    expect(codeFace.match(/runtimeSupportsInterjection(?!\s*[:=]\s*false)/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(src).toContain("from '@/hooks/use-chat/runtime-capabilities'")
    expect(codeFace).toContain('resolveInterjectionSupport(runtimeInterjection)')
  })
})
