// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-814408(2026-10-02)事件流的**单一写者**出口 —— "谁在写这条流"只在这一处决定并登记。
 *
 * 上游做法(参考 ZCode CLI 的 `prompt-command.ts:282-310`,关键在 `:293` 一带;那份研究副本
 * 只落在本机 `.ihui-agent/tmp/zcode-study/` 下、**未入库**,干净检出上取不到 —— 引它只为交代
 * 口径出处,不作为可复核的证据指针):常驻订阅跨回合存活,per-turn `onEvent` 在 submitPrompt 的 finally 里
 * 就被摘掉,所以两者**绝不同时装**;选「二选一」而不是「双装 + 按 id 去重」,因为前者让
 * "恰好一次"成为**结构性事实**,不依赖任何 sink 的调用顺序。
 *
 * 我方现状(逐条枚举见交付报告):`client/tui-client.ts` 的 fan-out 集合(`handlers`)只有
 * "加"没有"减"也没有"谁加过",而 `client/remote-adapter.ts:86` 把 per-turn sink 永久装进同一
 * 个集合 —— 于是同一条事件可以被两个写者各写一次(第二次 send 装上第二个 sink 后,第一次的
 * sink 仍在),而账面看不出装了几份。这正是上游拒绝的那一型。
 *
 * 本模块的判据(三条,缺一不可):
 *  ① **一条流同时只许一个写者**。第二个 attach 必须带 `coexist` 声明(reason + 指向一个当前
 *     真正持有租约的 label),否则当场抛错并点名已有写者 —— 静默并存结构上不可能发生。
 *  ② **per-turn 的寿命 = 一次调用**。`runPerTurnSink` 在 finally 里摘钩并释放租约,异常路径
 *     同样摘(上游 input-facade 的那一条纪律);常驻写者必须显式 `release()`。
 *  ③ **本出口不做去重**。没有任何"按 id 丢弃重复行"的通道 —— 一旦有,①② 就会被读成
 *     "反正后面会去掉重",而双装的成因(装两次)永远无人修。
 *
 * `describeStreamWriters()` 是登记面:谁在写、写了多久(第几次 attach)、是否带声明并存,
 * 全部可查 —— "显式声明"必须留下机器可读的痕迹,否则它与静默并存的区别只在注释里。
 */

/** 写者角色:`resident` 跨回合存活;`per-turn` 只活过一次调用。 */
export type StreamWriterKind = 'resident' | 'per-turn';

/**
 * 并存声明:第二条写者接入的唯一合法出口。
 * `reason` 必须是实质的(空白即视为未声明);`with` 必须逐字命中**当前在位**的某个写者 label,
 * 否则等于对着空气声明 —— 那比没有声明更糟,它会替人做出"这一格已被想过"的判断。
 */
export interface CoexistenceDeclaration {
  readonly reason: string;
  readonly with: string;
}

export interface StreamLease {
  readonly streamId: string;
  readonly kind: StreamWriterKind;
  readonly label: string;
  readonly coexist: CoexistenceDeclaration | null;
  /** 本次 attach 的序号(同一条流上从 1 递增;诊断"装了几份"用) */
  readonly attachOrdinal: number;
  readonly active: boolean;
  /** 幂等:重复 release 不报错也不影响账 */
  release(): void;
}

/** 判据被违反时的错误:携带已有写者清单,让人一眼看到"该摘谁 / 该声明谁"。 */
export class StreamWriterConflictError extends Error {
  readonly code = 'STREAM_WRITER_CONFLICT';
  readonly streamId: string;
  readonly attempted: { kind: StreamWriterKind; label: string; coexist: CoexistenceDeclaration | null };
  readonly existingWriters: readonly { kind: StreamWriterKind; label: string }[];

  constructor(args: {
    streamId: string;
    attempted: { kind: StreamWriterKind; label: string; coexist: CoexistenceDeclaration | null };
    existingWriters: readonly { kind: StreamWriterKind; label: string }[];
    why: string;
  }) {
    const who = args.existingWriters.map((w) => `${w.kind}:${w.label}`).join(', ');
    super(
      `[event-stream-ownership] 流 "${args.streamId}" 已有写者(${who}),` +
        `再装 "${args.attempted.kind}:${args.attempted.label}" 会被拒:${args.why}。` +
        '单一写者是结构性事实,不是去重结果 —— 要么先摘掉已有写者,要么带 coexist{reason,with} 显式声明。',
    );
    this.name = 'StreamWriterConflictError';
    this.streamId = args.streamId;
    this.attempted = args.attempted;
    this.existingWriters = args.existingWriters;
  }
}

/** 参数本身不成立(空 streamId / 空 label / 声明缺字段)—— 与"冲突"分开计,免得把用法错误读成竞争。 */
export class StreamWriterRuleError extends Error {
  readonly code = 'STREAM_WRITER_RULE';
  constructor(message: string) {
    super(`[event-stream-ownership] ${message}`);
    this.name = 'StreamWriterRuleError';
  }
}

interface StreamRecord {
  readonly streamId: string;
  readonly leases: StreamLease[];
  /** 该流上累计 attach 次数(release 不掉,是"装过几份"的真账) */
  attachCount: number;
}

const streams = new Map<string, StreamRecord>();

function recordOf(streamId: string): StreamRecord {
  let rec = streams.get(streamId);
  if (!rec) {
    rec = { streamId, leases: [], attachCount: 0 };
    streams.set(streamId, rec);
  }
  return rec;
}

/**
 * 活性令牌表(与 lease 对象一一对应;release 即摘除)。
 * 活性外置的原因:`release()` 之后登记面必须立刻看不见那条僵尸租约,否则 `describeStreamWriters`
 * 会把"已摘钩的写者"报成"在写",而这份报告就是唯一的人读证据。
 */
const ACTIVE = new Set<symbol>();

function activeLeases(rec: StreamRecord): StreamLease[] {
  return rec.leases.filter((l) => l.active);
}

function describeAttempt(lease: StreamLease): { kind: StreamWriterKind; label: string } {
  return { kind: lease.kind, label: lease.label };
}

/**
 * 唯一判定点。外部一律经 `claimResidentWriter` / `claimPerTurnSink` 进来 —— 角色由"调了哪个
 * helper"决定,而不是由调用方自报的字符串决定,所以 kind 字面量在本模块之外不应当出现。
 */
function claimStreamWriter(args: {
  streamId: string;
  kind: StreamWriterKind;
  label: string;
  coexist?: CoexistenceDeclaration | null;
}): StreamLease {
  const streamId = typeof args.streamId === 'string' ? args.streamId.trim() : '';
  const label = typeof args.label === 'string' ? args.label.trim() : '';
  if (!streamId) throw new StreamWriterRuleError('streamId 不得为空:不知名的流无法被对账');
  if (!label) throw new StreamWriterRuleError(`流 "${streamId}" 上的写者必须自报 label(谁在写)`);

  const rec = recordOf(streamId);
  const existing = activeLeases(rec);
  const coexist = args.coexist ?? null;
  if (coexist !== null) {
    const reason = typeof coexist.reason === 'string' ? coexist.reason.trim() : '';
    const withLabel = typeof coexist.with === 'string' ? coexist.with.trim() : '';
    if (!reason) throw new StreamWriterRuleError('并存声明必须带实质 reason(空白 = 没有声明)');
    if (!withLabel) throw new StreamWriterRuleError('并存声明必须带 with(指向当前在位的哪个写者)');
    if (existing.length === 0) {
      throw new StreamWriterRuleError(
        `流 "${streamId}" 上没有任何在位写者,却带着并存声明 —— 声明的对象不存在`,
      );
    }
    if (!existing.some((l) => l.label === withLabel)) {
      throw new StreamWriterRuleError(
        `并存声明指向的写者 "${withLabel}" 当前不在流 "${streamId}" 上(在位:${existing
          .map((l) => l.label)
          .join(', ') || '无'})`,
      );
    }
  }

  const leaseToken = Symbol(`${streamId}#${rec.attachCount + 1}`);
  const lease: StreamLease = {
    streamId,
    kind: args.kind,
    label,
    coexist,
    attachOrdinal: rec.attachCount + 1,
    get active(): boolean {
      return ACTIVE.has(leaseToken);
    },
    release(): void {
      if (!ACTIVE.has(leaseToken)) return; // 幂等:已摘的不再动账,也不误删他人条目
      ACTIVE.delete(leaseToken);
      // 释放即从登记数组里摘掉:per-turn 每次 send 都产生一份租约,若只标 inactive 不清理,
      // 长会话(REPL / ACP 常驻)会把每条流的账撑成无界数组 —— 判据自己不该成为泄漏源。
      const idx = rec.leases.indexOf(lease);
      if (idx >= 0) rec.leases.splice(idx, 1);
    },
  };
  ACTIVE.add(leaseToken);

  rec.attachCount += 1;
  rec.leases.push(lease);
  if (existing.length > 0 && coexist === null) {
    // 拒绝之后不留痕迹:失败的 attach 既不算写者也不进 attachCount(否则"试过几次"会把
    // 被拦下的尝试混成真实装上的份数)。
    lease.release();
    rec.attachCount -= 1;
    throw new StreamWriterConflictError({
      streamId,
      attempted: { kind: lease.kind, label: lease.label, coexist },
      existingWriters: existing.map(describeAttempt),
      why: '第二条写者必须带 coexist{reason,with} 显式声明,不得静默并存',
    });
  }
  return lease;
}

/** 常驻写者:跨回合存活,必须显式 release(或由宿主 close 时统一摘)。 */
export function claimResidentWriter(
  streamId: string,
  label: string,
  coexist?: CoexistenceDeclaration | null,
): StreamLease {
  return claimStreamWriter({ streamId, kind: 'resident', label, coexist });
}

/** per-turn 写者:一次调用内有效。请配合 `runPerTurnSink` 使用(它保证 finally 摘钩)。 */
export function claimPerTurnSink(
  streamId: string,
  label: string,
  coexist?: CoexistenceDeclaration | null,
): StreamLease {
  return claimStreamWriter({ streamId, kind: 'per-turn', label, coexist });
}

/**
 * per-turn 的寿命纪律:装上 → 跑 body → **无论成败**都摘钩并释放租约。
 * 这就是上游 `submitPrompt` finally 里摘 `onEvent` 的那一步 —— 没有它,per-turn sink
 * 就退化成第二个常驻订阅,而"两个常驻"正是本票要消灭的形态。
 */
export async function runPerTurnSink<T>(args: {
  streamId: string;
  label: string;
  attach: () => void;
  detach: () => void;
  body: () => Promise<T>;
  coexist?: CoexistenceDeclaration;
}): Promise<T> {
  const lease = claimPerTurnSink(args.streamId, args.label, args.coexist ?? null);
  try {
    args.attach();
    return await args.body();
  } finally {
    try {
      args.detach();
    } finally {
      lease.release();
    }
  }
}

export interface StreamWritersReport {
  readonly streamId: string;
  /** 当前在位的写者(已 release 的不在此列) */
  readonly writers: readonly { kind: StreamWriterKind; label: string; attachOrdinal: number }[];
  /** 带声明并存的写者(与 writers 同源,单列是为了"报名"这件事不靠读注释) */
  readonly declaredCoexistence: readonly { label: string; reason: string; with: string }[];
  /** 累计**成功**装上的份数(被拒的尝试不计;release 不退此账) */
  readonly attachCount: number;
  /**
   * 登记面为这条流保留的条目数。它必须恒等于 `writers.length` —— 若释放后的租约留在数组里,
   * 长会话(每次 send 一份 per-turn 租约)就是无界增长,判据本身变成泄漏源。
   */
  readonly retainedEntries: number;
}

/** 登记面:所有流逐条列出;空面返回空数组,调用方须自行区分"没有流"与"没查到"。 */
export function describeStreamWriters(): StreamWritersReport[] {
  const out: StreamWritersReport[] = [];
  for (const rec of streams.values()) {
    const active = activeLeases(rec);
    out.push({
      streamId: rec.streamId,
      writers: active.map((l) => ({ kind: l.kind, label: l.label, attachOrdinal: l.attachOrdinal })),
      declaredCoexistence: active.flatMap((l) =>
        l.coexist === null
          ? []
          : [{ label: l.label, reason: l.coexist.reason, with: l.coexist.with }],
      ),
      attachCount: rec.attachCount,
      retainedEntries: rec.leases.length,
    });
  }
  return out;
}

/** 某条流此刻的在位写者(宿主 close 时要不要整片摘除,判据在这里)。 */
export function activeWritersOn(streamId: string): readonly { kind: StreamWriterKind; label: string }[] {
  const rec = streams.get(streamId.trim());
  if (!rec) return [];
  return activeLeases(rec).map(describeAttempt);
}

/** 摘掉某条流上全部在位写者(宿主 close 的出口);返回摘掉的份数。 */
export function releaseStreamWriters(streamId: string): number {
  const rec = streams.get(streamId.trim());
  if (!rec) return 0;
  const active = activeLeases(rec);
  for (const l of active) l.release();
  return active.length;
}

/**
 * 仅供测试复位(生产禁止 —— 复位会把"这条流装过几份"的账抹平,而那份账正是本票要留下的证据)。
 */
export function __resetStreamWritersForTests(): void {
  streams.clear();
  ACTIVE.clear();
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
