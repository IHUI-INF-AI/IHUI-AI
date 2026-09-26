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
 * 唯一消费出口:某次工具调用能否因租约而免逐次批准。
 * 返回 null = 本次不因租约放宽(走改造前的原判定)。
 * `dangerLevel === 'dangerous'` **一律** null,与租约内容无关。
 */
export function resolveLeaseRelaxation(
  lease: PermissionLease | null,
  toolName: string,
  dangerLevel: 'read' | 'write' | 'dangerous',
  nowMs: number = Date.now(),
): PermissionLease | null {
  if (!lease) return null;
  if (dangerLevel === 'dangerous') return null;
  if (!isPermissionLeaseLive(lease, nowMs)) return null;
  if (!leaseCovers(lease, toolName)) return null;
  return lease;
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
