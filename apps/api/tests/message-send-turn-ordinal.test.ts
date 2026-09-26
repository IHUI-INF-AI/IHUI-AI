// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 第三段(2026-09-26):POST /messages/send 直插补齐 turn_ordinal 的语义回归。
 *
 * 本机无隔离测试库(AGENTS §5:测试一律禁止连生产库;8810 无监听),
 * 所以"两条连插得到两个不同序号"只能在**唯一出口的纯函数层**按写入序模拟证明:
 * 每次插入前对"已落库行"重算 max —— 与 routes/message.ts 里那条
 * `select max(turnOrdinal)` 逐字同口径。这不替代真库并发验证(那需要
 * SERIALIZABLE / advisory lock,另计一票),但它钉死两件事:
 *  ① 顺序双插必得两个不同序号(max+1 语义生效);
 *  ② 交错读(max 都在写前)时序号**相等而非回退** —— 按写入序单调不降,
 *     即"尽力而为"的失败形态是分叉不是倒退。
 * 另附静态判据:该直插必须经 services/turn-ordinal.js 唯一出口
 * (chat-messages-insert-paths 只查 values 块里有没有 `turnOrdinal` 标识,
 * 内联 `maxTurn + 1` 那份它看不见 —— 第二真相正是那条门立论要防的形态)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { turnOrdinalForRole } from '../src/services/turn-ordinal.js'

const HERE = dirname(fileURLToPath(import.meta.url))

/** 已落库行的最小形态:与 `select max(turnOrdinal)` 的输入集同构。 */
interface StoredRow {
  readonly turnOrdinal: number | null
}

/** 与 routes/message.ts 的 `sql`max(${chatMessages.turnOrdinal})`` 同口径:NULL 不参与。 */
function maxTurnOf(rows: readonly StoredRow[]): number {
  return rows.reduce((m, r) => Math.max(m, r.turnOrdinal ?? 0), 0)
}

/** 一次"插入":读当前 max → 走唯一出口算序号 → 落库。返回落库后的行集。 */
function insertUserMessage(rows: StoredRow[]): StoredRow[] {
  const turnOrdinal = turnOrdinalForRole(maxTurnOf(rows), 'user')
  return [...rows, { turnOrdinal }]
}

/** 取 /messages/send 里 chatMessages 直插的 values 块(找不到返回 null,由调用方判死)。 */
function extractSendValuesBlock(src: string): string | null {
  return (
    src.match(/\.insert\(\s*chatMessages\s*\)[\s\S]*?\.values\(\{[\s\S]*?\}\)/)?.[0] ?? null
  )
}

/**
 * 第二真相判据(静态测试与变异对照共用**同一份实现**,§22c):
 * values 块必须走唯一出口,且序号不得是内联的裸 `+ 1`。
 */
function hasSecondTruth(valuesBlock: string): boolean {
  return (
    !valuesBlock.includes('turnOrdinalForRole(') ||
    /turnOrdinal:\s*[^,\n]*\+\s*1\s*[,}]/.test(valuesBlock)
  )
}

describe('D35 第三段:/messages/send 的 turn_ordinal 语义', () => {
  it('空会话首条 user 消息得 turn 1(不留 NULL/0)', () => {
    const after = insertUserMessage([])
    expect(after[0]!.turnOrdinal).toBe(1)
  })

  it('两条连插(顺序读-改-写)必须得到两个不同序号', () => {
    let rows: StoredRow[] = []
    rows = insertUserMessage(rows)
    rows = insertUserMessage(rows)
    const ordinals = rows.map((r) => r.turnOrdinal)
    expect(ordinals).toEqual([1, 2])
    expect(new Set(ordinals).size).toBe(2)
  })

  it('并发撞号(双方都在对方落库前读 max)时:序号相等,按写入序单调不降', () => {
    // 双方各自看到的 max 都是 0(新会话)→ 都算出 1:失败形态是"两条并成一轮",
    // 不是"后写的序号更小"。若此处出现倒退,max+1 的实现就已经错出语义之外了。
    const base: StoredRow[] = []
    const readA = turnOrdinalForRole(maxTurnOf(base), 'user')
    const readB = turnOrdinalForRole(maxTurnOf(base), 'user')
    const written = [{ turnOrdinal: readA }, { turnOrdinal: readB }]
    expect(readA).toBe(readB) // 撞号确实发生(否则本用例没在测并发交错)
    for (let i = 1; i < written.length; i++) {
      expect(written[i]!.turnOrdinal).toBeGreaterThanOrEqual(written[i - 1]!.turnOrdinal!)
    }
    // 已有存量行的交错同理:同 max 读 → 同序号,不回退;NULL 存量行不拉低 max
    const seeded: StoredRow[] = [{ turnOrdinal: 5 }, { turnOrdinal: null }]
    const a = turnOrdinalForRole(maxTurnOf(seeded), 'user')
    const b = turnOrdinalForRole(maxTurnOf(seeded), 'user')
    expect(a).toBe(6)
    expect(b).toBe(6)
  })

  it('静态:该直插经唯一出口,不得内联第二份 max+1 语义', () => {
    const src = readFileSync(join(HERE, '../src/routes/message.ts'), 'utf8')
    expect(src).toContain("from '../services/turn-ordinal.js'")
    const valuesBlock = extractSendValuesBlock(src)
    expect(valuesBlock, '未找到 chatMessages 直插的 values 块').toBeTruthy()
    expect(hasSecondTruth(valuesBlock!)).toBe(false)
  })

  it('变异对照:把出口换成内联 maxTurn+1 必须被同一条判据识别', () => {
    const src = readFileSync(join(HERE, '../src/routes/message.ts'), 'utf8')
    const valuesBlock = extractSendValuesBlock(src)
    expect(valuesBlock, '真实文件必须仍可提取 values 块').toBeTruthy()
    // 在真实块上做最小变异(仅两处:去掉出口、序号改内联 +1),
    // 判据返回"有第二真相"才算有牙;原块必为 false 由上一例把守。
    const mutated = valuesBlock!.replace(
      "turnOrdinalForRole(Number(turnRows[0]?.maxTurn ?? 0), 'user')",
      'maxTurn + 1',
    )
    expect(mutated).not.toBe(valuesBlock)
    expect(hasSecondTruth(mutated)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
