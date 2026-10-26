// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-40 A/E 格:ack 事实(`command_ack_facts`)的写侧服务层。
 *
 * 分工与既有两层互补,不是第三套真相:
 * - `services/run-idempotency.ts` 是**零 I/O** 的槽位内核(KV 端口,进程重放用),它的 TODO
 *   已点名"实体存活属 DB 层,不在此加第二个 I/O 依赖"—— 本文件就是那个 DB 层出口。
 * - `packages/database/src/schema/command-ack-facts.ts` 是表与主键语义
 *   (`child:<parentSessionId>:<sourceCommandId>` 的元组形态)的真相源,本文件只做判据与端口。
 *
 * **E 格(运行时实体存活)**:`assertCommandAckFactAlive` 是唯一判据出口 —— 事实表中
 * 查得到 ∧ 已终态(`completed`)∧ 载荷非空 ∧ 未过 `expires_at`,四条全过才算"活着"。
 * 任何一条不满足都抛 `CommandAckFactNotAliveError`(硬错):缺失不是 404、processing 不是
 * 409、载荷缺席不是"脏数据跳过" —— 在"跨会话引用是否可信"这一判定上,失效方向必须是
 * **多抛一次定向硬错**(§0.10),绝不是"查不到就当存在"。消费点见 routes/command-acks.ts
 * 的重放路径(重放前先问存活,损坏即 500,不回放、不重建)。
 *
 * **A 格(幂等写)**:`recordCommandAckFact` 用 `onConflictDoNothing`(生产实现)承载
 * "同 key 重发拿首次结果":冲突后读回既有事实,**同指纹 = replayed(先过 E 存活;
 * processing 在途态按内核 in-progress 语义回 409,不进硬错),异指纹 = key-reused(绝不
 * 覆盖)** —— 复合主键上的 onConflictDoNothing 若不回读指纹,会把"换请求体复用同一坐标"
 * 静默吞掉,那正是幂等层最阴的错(详见内核判据 2 的头注)。
 *
 * I/O 全部走 `CommandAckFactStore` 端口:判据本身是纯函数,测试注入内存实现即可零网络、
 * 零真库(测试隔离铁律:不碰 8810/8811)。
 */
import { and, eq } from 'drizzle-orm'
import { commandAckFacts, type CommandAckFact, type NewCommandAckFact } from '@ihui/database'
import type { Database } from '../db/index.js'

/** E 格硬错在响应体里的稳定 errorCode(与 `CommandAckFactNotAliveError.code` 逐字同值)。 */
export const COMMAND_ACK_FACT_NOT_ALIVE_CODE = 'COMMAND_ACK_FACT_NOT_ALIVE'
/** A 格"同坐标换了请求体"的稳定 errorCode(对齐内核判据 2 的 key-reused 语义)。 */
export const COMMAND_ACK_KEY_REUSED_CODE = 'COMMAND_ACK_KEY_REUSED'

/** 事实存不进 `command_ack_facts`(生产:Postgres;测试:内存实现)的窄端口。 */
export interface CommandAckFactStore {
  /**
   * 写入一条事实;主键 `(parent_session_id, source_command_id)` 冲突时**不覆盖**,
   * 返回 `null`(onConflictDoNothing 语义)。返回非 null = 本次真实写入的行。
   */
  insertFact(input: NewCommandAckFact): Promise<CommandAckFact | null>
  /** 按主键元组读回既有事实;查无此行返回 `null`。 */
  getFact(parentSessionId: string, sourceCommandId: string): Promise<CommandAckFact | null>
}

/** 生产实现:Drizzle + Postgres。冲突靠表的复合主键 + onConflictDoNothing。 */
export function createPgCommandAckFactStore(database: Database): CommandAckFactStore {
  return {
    async insertFact(input) {
      const rows = await database
        .insert(commandAckFacts)
        .values(input)
        .onConflictDoNothing({
          target: [commandAckFacts.parentSessionId, commandAckFacts.sourceCommandId],
        })
        .returning()
      return rows[0] ?? null
    },
    async getFact(parentSessionId, sourceCommandId) {
      const rows = await database
        .select()
        .from(commandAckFacts)
        .where(
          and(
            eq(commandAckFacts.parentSessionId, parentSessionId),
            eq(commandAckFacts.sourceCommandId, sourceCommandId),
          ),
        )
        .limit(1)
      return rows[0] ?? null
    },
  }
}

/** "不活"的四档成因。处置同向(硬错),但 reason 必须分开报 —— 定向说明要能落到具体那一条。 */
export type CommandAckFactDeadReason =
  /** 事实表中查无此行:被引用的跨会话坐标根本不存在。 */
  | 'missing'
  /** 行在,但停在 `processing`(已抢槽、载荷未定):引用它做回放等于引用一个还没发生的动作。 */
  | 'not-terminal'
  /** 行自称 `completed` 却读不出载荷:事实损坏(载侧 CHECK 本应拦住,判据仍在读侧兜底)。 */
  | 'payload-missing'
  /** 行已被 `expires_at` 过期:保留期到点,引用按"已回收"判死。 */
  | 'expired'

/**
 * E 格硬错。刻意不继承 AppError:它是**数据完整性**错误,不是某一层路由的业务错;
 * 状态码与 errorCode 的翻译点在消费方路由(单一翻译点,见 routes/command-acks.ts)。
 */
export class CommandAckFactNotAliveError extends Error {
  readonly code = COMMAND_ACK_FACT_NOT_ALIVE_CODE
  readonly reason: CommandAckFactDeadReason
  readonly parentSessionId: string
  readonly sourceCommandId: string
  constructor(
    reason: CommandAckFactDeadReason,
    coords: { parentSessionId: string; sourceCommandId: string },
    detail: string,
  ) {
    super(`跨会话 ack 事实不活(${reason}):${detail}`)
    this.name = 'CommandAckFactNotAliveError'
    this.reason = reason
    this.parentSessionId = coords.parentSessionId
    this.sourceCommandId = coords.sourceCommandId
  }
}

/**
 * E 格唯一判据:`fact` 是否可以作为**活着**的跨会话事实被引用。
 * 通过则原样返回事实;任何一档不满足都抛 `CommandAckFactNotAliveError`,绝无静默通过。
 * 纯函数:不碰 I/O,时钟由调用方注入(`now`),测试可零网络钉死各档。
 */
export function assertCommandAckFactAlive(
  fact: CommandAckFact | null,
  coords: { parentSessionId: string; sourceCommandId: string },
  now: Date,
): CommandAckFact {
  if (fact === null) {
    throw new CommandAckFactNotAliveError(
      'missing',
      coords,
      `事实表中查无 (${coords.parentSessionId}, ${coords.sourceCommandId}) —— 引用不存在的命令一律硬错,绝不当作存在`,
    )
  }
  if (fact.status !== 'completed') {
    throw new CommandAckFactNotAliveError(
      'not-terminal',
      coords,
      `事实停在 ${fact.status},载荷未定 —— 未终态化的事实不可引用`,
    )
  }
  if (fact.payload === null) {
    throw new CommandAckFactNotAliveError(
      'payload-missing',
      coords,
      'completed 事实读不出载荷 —— 事实损坏,绝不回放、绝不重建',
    )
  }
  if (fact.expiresAt !== null && fact.expiresAt.getTime() <= now.getTime()) {
    throw new CommandAckFactNotAliveError(
      'expired',
      coords,
      `事实保留期已于 ${fact.expiresAt.toISOString()} 到点 —— 按已回收判死`,
    )
  }
  return fact
}

/** "同坐标的命令仍在处理中"的稳定 errorCode(与内核 IDEMPOTENCY_IN_PROGRESS 同一词汇)。 */
export const COMMAND_ACK_IN_PROGRESS_CODE = 'IDEMPOTENCY_IN_PROGRESS'

export type CommandAckRecordOutcome =
  | { outcome: 'created'; fact: CommandAckFact }
  | { outcome: 'replayed'; fact: CommandAckFact }
  /** 同指纹但事实停在 `processing`:对齐内核 in-progress 语义(409 稍后重试),不是硬错。 */
  | { outcome: 'in-progress' }
  | { outcome: 'key-reused'; existingFingerprint: string }

/**
 * A 格幂等写入协调。语义(与内核 run-idempotency 的判据同源,载体换成表):
 * 1. 首写成功 → `created`;
 * 2. 主键冲突 + 指纹相同 → **先过 E 存活断言**(重放路径也必须问"还活着吗",损坏即硬错)
 *    再回 `replayed` —— 重发拿的是首次结果,不是重建一份;
 * 3. 主键冲突 + 指纹不同 → `key-reused`,既有事实一个字节都不动;
 * 4. 冲突后读不到行(并发删除窗口)→ 重试一次;仍不收敛才抛内部错 —— 走到这一步说明
 *    存储在违反自己刚给出的约束,继续猜只会把别人的事实覆盖掉。
 */
export async function recordCommandAckFact(
  store: CommandAckFactStore,
  fact: NewCommandAckFact,
  now: Date,
): Promise<CommandAckRecordOutcome> {
  const coords = { parentSessionId: fact.parentSessionId, sourceCommandId: fact.sourceCommandId }
  const inserted = await store.insertFact(fact)
  if (inserted !== null) return { outcome: 'created', fact: inserted }

  const existing = await store.getFact(coords.parentSessionId, coords.sourceCommandId)
  if (existing !== null) {
    if (existing.fingerprint === fact.fingerprint) {
      // processing 的同指纹重发 = "上一轮还在途",对齐内核 in-progress(409),不进 E 硬错;
      // E 的 not-terminal 档留给"引用事实做回放"的消费方(GET /alive、completed 重放前的兜底)。
      if (existing.status === 'processing') return { outcome: 'in-progress' }
      assertCommandAckFactAlive(existing, coords, now)
      return { outcome: 'replayed', fact: existing }
    }
    return { outcome: 'key-reused', existingFingerprint: existing.fingerprint }
  }

  const retried = await store.insertFact(fact)
  if (retried !== null) return { outcome: 'created', fact: retried }
  const reRead = await store.getFact(coords.parentSessionId, coords.sourceCommandId)
  if (reRead !== null) {
    if (reRead.fingerprint === fact.fingerprint) {
      if (reRead.status === 'processing') return { outcome: 'in-progress' }
      assertCommandAckFactAlive(reRead, coords, now)
      return { outcome: 'replayed', fact: reRead }
    }
    return { outcome: 'key-reused', existingFingerprint: reRead.fingerprint }
  }
  throw new Error(
    `command_ack_fact 幂等插入竞争未收敛(${coords.parentSessionId}, ${coords.sourceCommandId}):冲突后既读不到他人事实也写不进自己 —— 存储行为异常,拒绝继续`,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
