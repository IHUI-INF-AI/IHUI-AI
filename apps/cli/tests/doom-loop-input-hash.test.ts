// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * doom-loop-detector hashInput 回归锁(2026-09-27 修真缺陷:函数名/字段叫 inputHash,
 * 实现却是 JSON.stringify(整个工具入参) 原样返回,原文随 pattern POST 到服务端落库)。
 *
 * 钉死六条:
 *   ① 同一入参两次调用同值(确定性)
 *   ② 键序不同的同一对象同值(旧实现键序一变去重键就失效)
 *   ③ 入参不同 ⇒ 值不同
 *   ④ 返回值里绝不出现入参原文子串(哨兵字符串:路径/正文/命令行)
 *   ⑤ 返回值恒为 64 位小写十六进制
 *   ⑥ 循环引用入参不得抛错且仍返回 64 位 hex
 * 另附 BigInt/undefined/function 等不可序列化值的永不抛错锁。
 */
import { describe, expect, it } from 'vitest'
import { hashInput } from '../src/doom-loop-detector.js'

const HEX64 = /^[0-9a-f]{64}$/

/** 哨兵:分别模拟 file_read 的路径、文件正文、run_command 的命令行原文 */
const SENTINEL_PATH = 'C:/Users/honor/sentinel-secret-dir/ payroll.txt'
const SENTINEL_BODY = 'SENTINEL_FILE_BODY_do_not_leak_9f3c'
const SENTINEL_CMD = 'rm -rf /var/sentinel --force && export API_TOKEN=sentinel_token_xyz'

describe('hashInput 真 SHA-256 摘要', () => {
  it('① 同一入参两次调用同值', () => {
    const input = { path: '/tmp/a.txt', content: 'hello' }
    expect(hashInput(input)).toBe(hashInput(input))
    expect(hashInput(input)).toBe(hashInput({ path: '/tmp/a.txt', content: 'hello' }))
  })

  it('② 键序不同的同一对象同值(去重键不因键序漂移)', () => {
    const a = { path: '/tmp/a.txt', offset: 10, limit: 20 }
    const b = { limit: 20, path: '/tmp/a.txt', offset: 10 }
    expect(hashInput(a)).toBe(hashInput(b))
    // 嵌套对象同样要求键序无关
    const deepA = { meta: { x: 1, y: 2 }, name: 'n' }
    const deepB = { name: 'n', meta: { y: 2, x: 1 } }
    expect(hashInput(deepA)).toBe(hashInput(deepB))
  })

  it('③ 入参不同 ⇒ 值不同', () => {
    expect(hashInput({ path: '/a.txt' })).not.toBe(hashInput({ path: '/b.txt' }))
    expect(hashInput({ a: 1 })).not.toBe(hashInput({ a: 2 }))
    expect(hashInput({ a: 1 })).not.toBe(hashInput({ a: '1' }))
    expect(hashInput('run')).not.toBe(hashInput(['run']))
  })

  it('④ 返回值绝不包含入参原文(哨兵回归锁)', () => {
    const hashed = hashInput({
      path: SENTINEL_PATH,
      content: SENTINEL_BODY,
      command: SENTINEL_CMD,
    })
    expect(hashed).not.toContain(SENTINEL_PATH)
    expect(hashed).not.toContain(SENTINEL_BODY)
    expect(hashed).not.toContain(SENTINEL_CMD)
    expect(hashed).not.toContain('sentinel')
    // 兜底:hex 摘要的字符集本身就容不下原文里的斜杠/空格/中文等任何非 hex 字符
    expect(hashed).toMatch(HEX64)
  })

  it('⑤ 返回值恒为 64 位小写十六进制', () => {
    const samples: unknown[] = [
      undefined,
      null,
      {},
      { a: 1 },
      [1, 2, 3],
      'plain string',
      42,
      true,
      new Date(0),
      { nested: { deep: [{ x: [1, 2] }] } },
    ]
    for (const s of samples) {
      expect(hashInput(s)).toMatch(HEX64)
      expect(hashInput(s)).toHaveLength(64)
    }
  })

  it('⑥ 循环引用入参不得抛错,且仍返回 64 位 hex', () => {
    const circular: Record<string, unknown> = { name: 'loop' }
    circular.self = circular
    circular.nested = { parent: circular }
    expect(() => hashInput(circular)).not.toThrow()
    expect(hashInput(circular)).toMatch(HEX64)
    // 两个结构完全同构的循环对象应得同一摘要(确定性不因回边标记而丢)
    const circular2: Record<string, unknown> = { name: 'loop' }
    circular2.self = circular2
    circular2.nested = { parent: circular2 }
    expect(hashInput(circular)).toBe(hashInput(circular2))
  })

  it('附:BigInt/NaN/Infinity/function/symbol 等不可序列化值不得抛错', () => {
    expect(() => hashInput({ big: 9007199254740993n })).not.toThrow()
    expect(() => hashInput({ n: NaN, inf: Infinity, neg: -Infinity })).not.toThrow()
    expect(() => hashInput({ fn: () => 1, sym: Symbol('s') })).not.toThrow()
    expect(hashInput({ big: 1n })).toMatch(HEX64)
    // 顶层 undefined 与顶层 {} 同值(与旧行为 input ?? {} 对齐)
    expect(hashInput(undefined)).toBe(hashInput({}))
    // 兄弟分支重复引用同一对象属 DAG,不得被误判成循环:两个结构应同值
    const shared = { id: 7 }
    expect(hashInput({ a: shared, b: shared })).toBe(hashInput({ a: { id: 7 }, b: { id: 7 } }))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
