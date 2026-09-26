// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 权限租约(Permission Lease)—— 目标级、限时、可审计的权限放宽。
 *
 * 立论(为什么不是"再来一个 bypass 开关"):
 * 本仓权限面原本只有两极 —— 要么常规档(宽权限逐次批准),要么
 * `permissionMode==='bypassPermissions'`(整个会话全程免批,即安全审计最忌讳的
 * 全局后门)。本模块填的是中间那一格:**放宽的作用域必须是单个目标/单轮、
 * 必须自带到期、必须可显式撤销、每次放宽都要能在既有审计出口里回读**。
 *
 * 三条不可动摇的结构性质(都由构造器判死,不靠调用点自觉):
 *  1. 没有到期就不存在"租约" —— `expiresAt` 必填,且 `expiresAfterTurns` /
 *     `maxCalls` 至少再给一个。"永久放宽"这一型在本模块**无法被构造出来**。
 *  2. 能力清单必须是显式工具名 —— 拒绝 `*`/空清单(那等于把 bypassPermissions
 *     换个名字重新引进)。
 *  3. 租约只回答"是否还要人批准",**从不**回答"能不能做":
 *     `dangerous` 级工具一律不受租约影响(危险确认在 `executeToolCall` 的独立闸,
 *     `deny`/白名单判定的优先权也永远高于租约)。
 *
 * 默认关闭:不调用 `grantPermissionLease()` 时 `activePermissionLease()` 恒为
 * null,而所有消费点在 lease 为 null 时走的都是**改造前那一份**判定实现。
 */

import { createHash } from 'node:crypto'

import { auditLog } from '../audit.js';

/** 租约可覆盖的能力档位:显式工具名(不允许通配)。 */
export type LeaseCapability = string;

/** 授权人:只有这三类来源,且都要求"用户显式声明本目标内免逐次确认"。 */
export type LeaseGrantor = 'cli-flag' | 'repl-command' | 'goal-mode';

/** 租约作用域:一个目标或一轮,标识由授予方给出(空串一律拒)。 */
export type LeaseScope = string;

export interface PermissionLease {
  readonly scope: LeaseScope;
  readonly grantedAt: string;
  /** ISO 到期时刻,必填 —— 没有到期时间的对象在本模块里构造不出来。 */
  readonly expiresAt: string;
  /** 轮次上限(goal 循环每轮 `advancePermissionLeaseTurn` 推进一次)。 */
  readonly expiresAfterTurns?: number;
  /** 放宽次数上限(每次实际生效计 1)。 */
  readonly maxCalls?: number;
  readonly capabilities: readonly LeaseCapability[];
  readonly grantor: LeaseGrantor;
  /** 审计出口回读定位:与 `audit.jsonl` 里那条 grant 记录的 id 同值。 */
  readonly auditRef: string;
  /** 撤销时刻;null 表示未撤销。 */
  revokedAt: string | null;
  /** 摘要绑定的工作区身份(仅当授予时给了 `digestDeclarations` 才存在)。
   *  缺省 ⇒ 本租约没有摘要维度,判定逐字同旧语义(默认档不变的构造保证)。
   *  **只能在构造时定死,此后不可重绑** —— 身份是摘要 key 的一半,可事后改写等于把一条租约
   *  悄悄搬到另一个工作区名下(那既是"每次批准都漂移"的死锁形,也是冒充已批准的越权形)。 */
  readonly workspaceId?: string;
  /** 槽位指纹:工具名 → 授予时刻声明内容摘要集合(sha256 hex)。持久信任键 = 工作区身份 × 声明摘要。
   *  出现在这里的 capability 受摘要治理:运行期每次比对调用内容,**内容变了旧批准即失效**,
   *  并落单列的待再审态(见 `LeaseRelaxationDetail.contentDrifted`),不是压回"从未批准"。
   *  写入只有两处:① 授予时的 `digestDeclarations`;② 批准时刻的 `recordApprovedInvocation()`。
   *  外层不 freeze(② 要追加),每个值数组仍冻结 —— 逐槽不可原地篡改,增槽只经那一个出口。 */
  readonly slotDigests?: Record<string, readonly string[]>;
  /** 摘要维度的取用档位:true = 能力清单里的工具**先要一次真人批准来建立内容绑定**,之后按内容钉住
   *  (bind-on-first-approval)。缺省 false ⇒ 逐字旧语义(能力名匹配即放宽,不存在内容绑定)。
   *  它解开的正是"要批准才有绑定 / 有绑定才要批准"的死循环 —— 没有这一档,批准时刻永远成不了摘要的数据源。 */
  readonly digestTrackOnApproval?: boolean;
  /** 已推进轮次(内部可变计数,到期判据读它)。 */
  turnsUsed: number;
  /** 已放宽次数(内部可变计数)。 */
  callsUsed: number;
}

export interface GrantLeaseInput {
  scope: string;
  capabilities: readonly string[];
  grantor: LeaseGrantor;
  /** 到期时长(毫秒)。与 `expiresAt` 二选一,同时给以 `expiresAt` 为准。 */
  ttlMs?: number;
  expiresAt?: string;
  expiresAfterTurns?: number;
  maxCalls?: number;
  nowMs?: number;
  /** 工作区身份:提供 `digestDeclarations` 时必填 —— 两处算同一 key 必须共用一份实现。 */
  workspaceId?: string;
  /** 按摘要钉住的内容声明:工具名 → 授予时被批准的完整命令/声明文本。键必须是 capabilities 的子集。
   *  不在此表的 capability 继续按工具名精确匹配的旧语义放宽(未启用摘要维度 ⇒ 既有链路行为不变)。 */
  digestDeclarations?: Readonly<Record<string, readonly string[]>>;
  /** true = 本租约的能力在拿到**第一次真人批准**之前不放宽(bind-on-first-approval,见 `recordApprovedInvocation`)。
   *  开启必须同时给 `workspaceId`:没有身份就没有可比的摘要 key,这一档只会变成"永远要批准"。 */
  digestTrackOnApproval?: boolean;
}

/** 租约不成立时的错误类型(调用方必须把它当缺陷处理,不得吞掉)。 */
export class PermissionLeaseError extends Error {
  override name = 'PermissionLeaseError';
}

const WILDCARDS = new Set(['*', 'all', 'any']);

function requireText(value: string | undefined, field: string): string {
  const v = (value ?? '').trim();
  if (!v) throw new PermissionLeaseError(`租约字段 ${field} 不得为空`);
  return v;
}

/** 归一到可比较的到期时刻(毫秒)。 */
export function leaseExpiryMs(lease: PermissionLease): number {
  const ms = Date.parse(lease.expiresAt);
  if (!Number.isFinite(ms)) {
    throw new PermissionLeaseError(`租约 expiresAt 不是合法 ISO 时刻: ${lease.expiresAt}`);
  }
  return ms;
}

/**
 * 活性判据(时长/轮次/次数三者取先到,撤销即刻失效)。
 * 到期判定与撤销判定都放在这一份实现里 —— 消费点若各自再写一遍 `Date.now()`
 * 比较,两处必然漂移(本仓同族教训:"两处算同一件事必漂移")。
 */
export function isPermissionLeaseLive(lease: PermissionLease, nowMs: number = Date.now()): boolean {
  if (lease.revokedAt !== null) return false;
  if (nowMs >= leaseExpiryMs(lease)) return false;
  if (lease.expiresAfterTurns !== undefined && lease.turnsUsed >= lease.expiresAfterTurns) return false;
  if (lease.maxCalls !== undefined && lease.callsUsed >= lease.maxCalls) return false;
  return true;
}

/** 能力覆盖判定:大小写敏感的精确工具名匹配(不做前缀/通配)。 */
export function leaseCovers(lease: PermissionLease, toolName: string): boolean {
  return lease.capabilities.includes(toolName);
}

/**
 * 持久信任键 / 槽位指纹:sha256(工作区身份 \0 声明内容)。用最普通的稳定哈希,不自创规范。
 * 授予与运行期比对都只能经这一个出口 —— 两处各写一遍摘要算法必然漂移(本仓"两处算同一
 * key 共用一份实现"同族教训)。
 */
export function slotDigest(workspaceId: string, declaration: string): string {
  return createHash('sha256').update(`${workspaceId}\u0000${declaration}`, 'utf8').digest('hex')
}

// ==================== 摘要维度的开关与"批准时刻"的数据源 ====================

/** 单个槽位最多留几条"被批准过的内容"摘要(超出按 FIFO 丢最旧)—— 没有上限就是无界增长。 */
export const MAX_DIGESTS_PER_SLOT = 8;

/**
 * 摘要维度的**显式关闭出口**(环境变量,缺省 = 启用)。
 * 为什么默认启用而不是默认关闭:一旦某个槽位被摘要治理,校验不过就必须不放宽(fail-closed),
 * 这是本维度存在的唯一理由;默认关闭等于把"内容变了旧批准仍生效"重新请回来。
 * 为什么仍要给出路:启用后未提供调用内容的消费点一律不放宽(见 `resolveLeaseRelaxation` 那条旧入口),
 * 对已经写了 `digestDeclarations` 的调用方是**行为收紧**,必须有一条不改动代码就能退回旧语义的口。
 * 取值:`0` / `false` / `off`(大小写不敏感、去空白)视为关闭;其余一律视为启用。
 */
export const LEASE_DIGEST_SWITCH_ENV = 'IHUI_LEASE_SLOT_DIGEST';

/** 读摘要维度是否在位(唯一出口,判定与登记都只问这一处,不在两处各读一遍 env)。 */
export function isLeaseDigestDimensionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env[LEASE_DIGEST_SWITCH_ENV] ?? '').trim().toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off');
}

/** 登记失败的成因(全部如实回传,调用方不得吞 —— 吞掉就等于"批准过了"的假账)。 */
export type RecordApprovedInvocationFailure =
  | 'digest-dimension-disabled'
  | 'no-active-lease'
  | 'lease-not-live'
  | 'lease-has-no-workspace-identity'
  | 'workspace-identity-mismatch'
  | 'dangerous-tool'
  | 'tool-not-in-lease'
  | 'empty-invocation-content'
  | 'unbound-slot-not-tracked'
  | 'lease-has-no-slot-ledger';

export type RecordApprovedInvocationResult =
  | {
      readonly recorded: true;
      readonly auditRef: string;
      readonly tool: string;
      readonly digest: string;
      readonly slotSize: number;
      /** true = 这是该槽位的第一次绑定(此前它不受摘要治理)。 */
      readonly firstBinding: boolean;
    }
  | { readonly recorded: false; readonly reason: RecordApprovedInvocationFailure };

export interface RecordApprovedInvocationInput {
  /** 被批准的那一次调用的工具名(必须是本租约能力清单里的名字)。 */
  toolName: string;
  /** **被批准的内容原文**:与执行侧喂进判定的同一份序列化口径(同一 stringify,不得两边各拼一遍)。 */
  invocationContent: string | null | undefined;
  /** 危险档一律不登记 —— 危险确认从来不受租约影响,给它建槽位等于把危险操作塞进"以后免批"。 */
  dangerLevel: 'read' | 'write' | 'dangerous';
  /** 工作区身份:必须与租约构造时定死的那一份同值(见 `PermissionLease.workspaceId`)。 */
  workspaceId: string;
  /** 审计说明(为什么这次批准要落成绑定)。 */
  reason?: string;
  nowMs?: number;
}

/**
 * 向**当前生效**的租约登记"用户在交互批准那一刻批准过的命令内容"。
 *
 * 这一格补的是时序缺口:租约在运行开始时授予、批准发生在其后,而 `PermissionLease` 的字段是
 * readonly、构造器还把"叠加授予"判死 —— 所以"把摘要补进去"**不能**用再 grant 一次来表达,
 * 也不能造第二套批准流。这里给的是一个显式、带审计、单一写入点的登记出口,四条判死照旧不动:
 *  1. 无到期 / 通配 / 危险档不受影响三条构造判死一个都没松(本函数根本不构造租约);
 *  2. 只能给**已在能力清单里**的名字建槽位 —— 否则登记即静默扩大作用域(与构造器同一条理由);
 *  3. 身份不同源即拒:租约没定死 workspaceId ⇒ 无从可比,直接拒(不补绑、不猜);
 *  4. 空内容即拒(空摘要使漂移判定失效,构造器里同一条)。
 *
 * 未绑定过的新名字只有在 `digestTrackOnApproval` 在位时才允许首次绑定 —— 那正是"第一次批准"
 * 换到绑定、之后的同内容调用才享受放宽的闭环(见该字段注释)。
 */
export function recordApprovedInvocation(
  input: RecordApprovedInvocationInput,
): RecordApprovedInvocationResult {
  const nowMs = input.nowMs ?? Date.now();
  const lease = activeLease;
  if (!lease) return { recorded: false, reason: 'no-active-lease' };
  if (!isLeaseDigestDimensionEnabled()) return { recorded: false, reason: 'digest-dimension-disabled' };
  if (!isPermissionLeaseLive(lease, nowMs)) return { recorded: false, reason: 'lease-not-live' };
  if (input.dangerLevel === 'dangerous') return { recorded: false, reason: 'dangerous-tool' };
  const tool = (input.toolName ?? '').trim();
  if (!leaseCovers(lease, tool)) return { recorded: false, reason: 'tool-not-in-lease' };
  // 身份同源:租约的 workspaceId 在构造时定死,登记侧只能"对上",不能"改成手上这份"。
  const identity = (lease.workspaceId ?? '').trim();
  if (identity.length === 0) return { recorded: false, reason: 'lease-has-no-workspace-identity' };
  if ((input.workspaceId ?? '').trim() !== identity) {
    auditLog({
      timestamp: new Date(nowMs).toISOString(),
      tool: 'permission_lease_slot_digest_refused',
      input: { auditRef: lease.auditRef, scope: lease.scope, capability: tool, reason: 'workspace-identity-mismatch' },
      success: false,
      error: '登记被批准内容时工作区身份与租约构造时定死的那一份不一致,已拒绝(不重绑、不猜)',
    });
    return { recorded: false, reason: 'workspace-identity-mismatch' };
  }
  const content = input.invocationContent;
  if (content === null || content === undefined || content.length === 0)
    return { recorded: false, reason: 'empty-invocation-content' };

  const ledger = lease.slotDigests;
  // 有身份、有登记意图,却没有台账 ⇒ 构造侧漏建(不该发生)。判死而不是就地补一张:补就等于把
  // "登记能否生效"变成运行期悄悄造字段,而字段是否在被审的构造路径上建立是这条链唯一的凭据。
  if (!ledger) return { recorded: false, reason: 'lease-has-no-slot-ledger' };
  const existing = ledger[tool] ?? [];
  const firstBinding = existing.length === 0;
  // 未绑定过的名字:只有显式开了 bind-on-first-approval 的租约才允许在此建立第一格绑定。
  if (firstBinding && lease.digestTrackOnApproval !== true) {
    return { recorded: false, reason: 'unbound-slot-not-tracked' };
  }
  const digest = slotDigest(identity, content);
  if (existing.includes(digest)) {
    return { recorded: true, auditRef: lease.auditRef, tool, digest, slotSize: existing.length, firstBinding: false };
  }
  // FIFO 封顶:保留最近 MAX_DIGESTS_PER_SLOT 条被批准过的内容(最旧的先掉)。
  const next = [...existing, digest].slice(-MAX_DIGESTS_PER_SLOT);
  ledger[tool] = Object.freeze(next);
  auditLog({
    timestamp: new Date(nowMs).toISOString(),
    tool: 'permission_lease_slot_digest_recorded',
    input: {
      auditRef: lease.auditRef,
      scope: lease.scope,
      grantor: lease.grantor,
      capability: tool,
      // 只落指纹,不落命令明文(审计流水是明文盘,内容原文可能含凭据 —— 与守门 67 同一条取向)
      digest,
      slotSize: next.length,
      firstBinding,
      reason: input.reason ?? '用户在交互批准那一刻批准了本次调用内容',
    },
    success: true,
  });
  return { recorded: true, auditRef: lease.auditRef, tool, digest, slotSize: next.length, firstBinding };
}

/** 租约放宽明细判定的结果:`contentDrifted` 把"曾批准、内容已变、待再审"与"从未批准"分开。 */
export interface LeaseRelaxationDetail {
  readonly lease: PermissionLease
  /** true = 该槽位摘要绑定,而本次调用内容与授予时声明摘要不符(含未提供内容):
   *  旧批准失效、落入单列的待再审态 —— 消费点不得把它读成"从未批准"。 */
  readonly contentDrifted: boolean
}

/**
 * 摘要维度加入后的**唯一明细判定出口**。判序与旧 `resolveLeaseRelaxation` 逐字相同,
 * 只在能力覆盖之后多一步槽位指纹比对:
 *  - 该工具未被摘要绑定 ⇒ `contentDrifted:false`,语义与旧完全一致(默认档不变);
 *  - 已绑定但未提供调用内容 ⇒ 按 drifted 处理(fail-closed:无从校验不得静默放行);
 *  - 已绑定且内容相符 ⇒ 照常放宽;不符 ⇒ 不放宽,并留可区分的态 + 审计行。
 */
export function resolveLeaseRelaxationDetail(
  lease: PermissionLease | null,
  toolName: string,
  dangerLevel: 'read' | 'write' | 'dangerous',
  invocationContent: string | null | undefined,
  nowMs: number = Date.now(),
): LeaseRelaxationDetail | null {
  if (!lease) return null;
  if (dangerLevel === 'dangerous') return null;
  if (!isPermissionLeaseLive(lease, nowMs)) return null;
  if (!leaseCovers(lease, toolName)) return null;
  // 关闭出口在位 ⇒ 摘要维度整体退场,逐字回到"按工具名精确匹配即放宽"的旧语义(不静默改判据,
  // 结论行由 `IHUI_LEASE_SLOT_DIGEST` 决定并在 `describePermissionLease` 之外可回读)。
  if (!isLeaseDigestDimensionEnabled()) return { lease, contentDrifted: false }
  const bound = lease.slotDigests?.[toolName]
  if (!bound || bound.length === 0) {
    // 该名字还没有绑定。两种正当情形在这里分岔:
    //  - 租约开了 bind-on-first-approval ⇒ **不放宽**,让人先批准一次,批准内容由
    //    `recordApprovedInvocation()` 落成绑定(这就是"批准那一刻的内容"成为数据源的那一步);
    //  - 未开 ⇒ 逐字旧语义(能力名匹配即放宽,不存在内容绑定)。
    if (lease.digestTrackOnApproval === true) {
      auditLog({
        timestamp: new Date(nowMs).toISOString(),
        tool: 'permission_lease_content_drift',
        input: {
          auditRef: lease.auditRef,
          scope: lease.scope,
          capability: toolName,
          reason: '该能力按"先批准一次建立内容绑定"档位纳管,尚无绑定 ⇒ 不放宽(非"从未批准",是"还没批准过")',
        },
        success: false,
        error: '内容绑定尚未建立,需用户首次批准',
      });
      return { lease, contentDrifted: true };
    }
    return { lease, contentDrifted: false };
  }
  const digest =
    invocationContent === null || invocationContent === undefined ? null : slotDigest(lease.workspaceId ?? '', invocationContent)
  const drifted = digest === null || !bound.includes(digest)
  if (drifted) {
    auditLog({
      timestamp: new Date(nowMs).toISOString(),
      tool: 'permission_lease_content_drift',
      input: {
        auditRef: lease.auditRef,
        scope: lease.scope,
        capability: toolName,
        reason:
          invocationContent === null || invocationContent === undefined
            ? '摘要绑定槽位未提供调用内容(fail-closed)'
            : '调用内容与授予时声明摘要不符',
      },
      success: false,
      error: '内容漂移使旧批准失效,需用户重新审批',
    });
  }
  return { lease, contentDrifted: drifted };
}

/**
 * 消费出口(旧签名,瘦投影):某次工具调用能否因租约而免逐次批准。
 * 返回 null = 本次不因租约放宽(走改造前的原判定)。`dangerLevel === 'dangerous'` **一律** null。
 * 该入口不携带调用内容 ⇒ 摘要绑定的槽位按 fail-closed 不放宽;未绑定槽约的结论与改造前逐字相同。
 */
export function resolveLeaseRelaxation(
  lease: PermissionLease | null,
  toolName: string,
  dangerLevel: 'read' | 'write' | 'dangerous',
  nowMs: number = Date.now(),
): PermissionLease | null {
  const detail = resolveLeaseRelaxationDetail(lease, toolName, dangerLevel, null, nowMs);
  return detail && !detail.contentDrifted ? detail.lease : null;
}

/** 记账一次实际放宽(由消费点在放宽真的生效时调用)。 */
export function noteLeaseCall(lease: PermissionLease, toolName: string): void {
  lease.callsUsed += 1;
  auditLog({
    timestamp: new Date().toISOString(),
    tool: 'permission_lease_used',
    input: {
      auditRef: lease.auditRef,
      scope: lease.scope,
      grantor: lease.grantor,
      capability: toolName,
      callsUsed: lease.callsUsed,
      maxCalls: lease.maxCalls ?? null,
      expiresAt: lease.expiresAt,
    },
    success: true,
  });
}

/** 推进一轮(goal 循环每轮一次);轮次上限由此生效。 */
export function advancePermissionLeaseTurn(reason: string, nowMs: number = Date.now()): boolean {
  const lease = activeLease;
  if (!lease) return false;
  lease.turnsUsed += 1;
  const stillLive = isPermissionLeaseLive(lease, nowMs);
  auditLog({
    timestamp: new Date().toISOString(),
    tool: 'permission_lease_turn',
    input: { auditRef: lease.auditRef, scope: lease.scope, turnsUsed: lease.turnsUsed, reason },
    success: stillLive,
    error: stillLive ? undefined : '租约已到期(轮次/时长/撤销)',
  });
  if (!stillLive) activeLease = null;
  return stillLive;
}

let activeLease: PermissionLease | null = null;

/** 读取当前生效租约(未授予/已到期/已撤销 ⇒ null)。 */
export function activePermissionLease(): PermissionLease | null {
  return activeLease;
}

/**
 * 授予租约(唯一构造出口)。判死:空 scope / 空能力清单 / 通配 / 无到期 /
 * 到期不晚于授予时刻 / 已有一份在生效(禁止叠租约把作用域悄悄扩大)。
 */
export function grantPermissionLease(input: GrantLeaseInput): PermissionLease {
  const nowMs = input.nowMs ?? Date.now();
  const scope = requireText(input.scope, 'scope');
  const caps = input.capabilities.map((c) => c.trim()).filter((c) => c.length > 0);
  if (caps.length === 0) throw new PermissionLeaseError('租约能力清单不得为空(空清单=全局放宽)');
  if (caps.some((c) => WILDCARDS.has(c.toLowerCase()))) {
    throw new PermissionLeaseError('租约能力清单禁止通配(*) —— 那等于全局 bypass');
  }
  // 叠租约会把作用域悄悄扩大,故放在字段校验之后、赋值之前判死
  if (activeLease && isPermissionLeaseLive(activeLease, nowMs)) {
    throw new PermissionLeaseError('已有一份生效中的权限租约,不得叠加授予');
  }
  const expiresAtMs = input.expiresAt ? Date.parse(input.expiresAt) : nowMs + (input.ttlMs ?? NaN);
  if (!Number.isFinite(expiresAtMs)) {
    throw new PermissionLeaseError('必须给出 expiresAt 或正的 ttlMs —— 无期限的放宽不被允许');
  }
  if (expiresAtMs <= nowMs) throw new PermissionLeaseError('到期时刻必须晚于授予时刻');
  if (input.expiresAfterTurns === undefined && input.maxCalls === undefined) {
    throw new PermissionLeaseError('除时长外还须给轮次或调用数上限(二者取先到)');
  }
  if (input.expiresAfterTurns !== undefined && !(input.expiresAfterTurns >= 1)) {
    throw new PermissionLeaseError('expiresAfterTurns 必须 >= 1');
  }
  if (input.maxCalls !== undefined && !(input.maxCalls >= 1)) {
    throw new PermissionLeaseError('maxCalls 必须 >= 1');
  }
  // 摘要绑定的字段校验(赋值之前判死):键必须在能力清单内、声明非空、工作区身份必填。
  const digestDecls = input.digestDeclarations ?? {};
  const boundTools = Object.keys(digestDecls);
  let workspaceId: string | undefined;
  let slotDigests: Record<string, readonly string[]> | undefined;
  // 内容绑定档位(bind-on-first-approval):没有显式声明也要把身份定死 —— 没有身份就没有可比的
  // 摘要 key,这一档只会退化成"永远要批准"(死锁形),所以在这里判死而不是等运行期一直问人。
  if (input.digestTrackOnApproval === true && boundTools.length === 0) {
    const trackWsId = requireText(input.workspaceId, 'workspaceId(内容绑定档位)');
    workspaceId = trackWsId;
    slotDigests = {};
  }
  if (boundTools.length > 0) {
    // const 捕获:闭包里读 let 变量会被 TS 收窄回 string|undefined,摘要入口要的是 string
    const wsId = requireText(input.workspaceId, 'workspaceId(摘要绑定)');
    workspaceId = wsId;
    for (const tool of boundTools) {
      if (!caps.includes(tool)) {
        throw new PermissionLeaseError(`摘要绑定的能力不在清单内: ${tool}(绑定即静默扩大作用域)`);
      }
      const decls = digestDecls[tool] ?? [];
      if (decls.length === 0 || decls.some((d) => d.length === 0)) {
        throw new PermissionLeaseError(`摘要绑定槽位 ${tool} 的声明内容不得为空(空摘要使漂移判定失效)`);
      }
    }
    slotDigests = {};
    for (const tool of boundTools) {
      slotDigests[tool] = Object.freeze((digestDecls[tool] ?? []).map((d) => slotDigest(wsId, d)));
    }
  }

  const lease: PermissionLease = {
    scope,
    grantedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresAfterTurns: input.expiresAfterTurns,
    maxCalls: input.maxCalls,
    capabilities: Object.freeze([...new Set(caps)]),
    grantor: input.grantor,
    auditRef: `lease-${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    revokedAt: null,
    ...(workspaceId !== undefined ? { workspaceId } : {}),
    ...(slotDigests !== undefined ? { slotDigests } : {}),
    ...(input.digestTrackOnApproval === true ? { digestTrackOnApproval: true } : {}),
    turnsUsed: 0,
    callsUsed: 0,
  };
  activeLease = lease;
  // 审计痕迹落在既有出口(`auditLog` ⇒ ~/.ihui/audit.jsonl),不另立第二份真相。
  auditLog({
    timestamp: lease.grantedAt,
    tool: 'permission_lease_granted',
    input: {
      auditRef: lease.auditRef,
      scope: lease.scope,
      grantor: lease.grantor,
      capabilities: [...lease.capabilities],
      grantedAt: lease.grantedAt,
      expiresAt: lease.expiresAt,
      expiresAfterTurns: lease.expiresAfterTurns ?? null,
      maxCalls: lease.maxCalls ?? null,
      // 记账哪些槽位受摘要治理(只记键名与指纹存在性;摘要不可逆,不落命令明文)
      digestBoundCapabilities: lease.slotDigests ? Object.keys(lease.slotDigests) : [],
      // 档位是否在位要能在审计里回读:它决定"这份租约的能力在第一次真人批准前不放宽"
      digestTrackOnApproval: lease.digestTrackOnApproval === true,
    },
    success: true,
  });
  return lease;
}

/**
 * 显式撤销出口。返回 true = 确实撤掉了一份租约。
 * 刻意不抛错:撤销是运维动作,目标已不存在时应可安全重放。
 */
export function revokePermissionLease(reason: string, nowMs: number = Date.now()): boolean {
  const lease = activeLease;
  if (!lease) return false;
  lease.revokedAt = new Date(nowMs).toISOString();
  auditLog({
    timestamp: lease.revokedAt,
    tool: 'permission_lease_revoked',
    input: { auditRef: lease.auditRef, scope: lease.scope, reason },
    success: true,
  });
  activeLease = null;
  return true;
}

/** 测试/进程收尾用:清场(不参与生产判定路径)。 */
export function resetPermissionLeaseForTests(): void {
  activeLease = null;
}

/** 人类可读的一行状态(供 `ihui status` / 交付前核对,不泄露能力细节之外的信息)。 */
export function describePermissionLease(lease: PermissionLease, nowMs: number = Date.now()): string {
  const live = isPermissionLeaseLive(lease, nowMs);
  const turns = lease.expiresAfterTurns === undefined ? '—' : `${lease.turnsUsed}/${lease.expiresAfterTurns}`;
  const calls = lease.maxCalls === undefined ? '—' : `${lease.callsUsed}/${lease.maxCalls}`;
  return `租约${live ? '生效中' : '已失效'} scope=${lease.scope} 能力=${lease.capabilities.join(',')} 到期=${lease.expiresAt} 轮次=${turns} 次数=${calls}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
