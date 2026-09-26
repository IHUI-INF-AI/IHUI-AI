// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `--permission-lease` —— 权限租约的**操作员显式**启用入口。
 *
 * 立论(为什么要有这个文件):`tools/permission-lease.ts` 把机制建好了(目标级、限时、
 * 可审计、构造器判死),但 HEAD 面上 `grantPermissionLease()` 在 `apps/cli/src` 生产面
 * **零调用点** —— 整套机制默认关闭 *且不可达*,即本仓反复出现的「造好没装车」。
 * 本文件补的就是那一个真实调用点:只有操作员在命令行上显式点名工具清单时才授予。
 *
 * 三条结构性约束(不由调用点自觉,由本文件与构造器共同保证):
 *  1. **只能走唯一构造出口** `grantPermissionLease()` —— 本文件绝不自己拼 lease 对象。
 *     无到期即拒、能力清单拒绝 `*`/空、`grantor` 只能是枚举三值,这些判死都在构造器里,
 *     这里不重复实现一遍(重复必然漂移,本仓"两处算同一件事必漂移"同族教训)。
 *  2. **到期必须有默认值且有限** —— ttl 默认 10 分钟、轮次默认 1 轮,两侧各有硬封顶
 *     (`Math.max/Math.min` 在同一解析出口内完成,与守门 112 的"唯一解析出口含封顶"同形)。
 *     永久放宽在本模块**无法被表达出来**。
 *  3. **判不出来就失败关闭** —— 清单非法/构造器拒绝 ⇒ 返回 `invalid`,由命令层退出 1;
 *     绝不"降级成没给 flag 继续跑",那等于把操作员要求的放宽模式悄悄换成另一套语义。
 *
 * 审计:`permission_lease_granted` 与 `permission_lease_revoked` 两条记录分别由
 * `grantPermissionLease()` / `revokePermissionLease()` 在既有出口(`auditLog` ⇒
 * `~/.ihui/audit.jsonl`)落盘,本文件不另立第二份审计通道。
 *
 * 未给 flag 时的行为:`parseLeaseTools(undefined)` ⇒ 空清单 ⇒ `kind:'none'` ⇒ 不调用构造器
 * ⇒ `activePermissionLease()` 恒为 null ⇒ 所有消费点走的仍是改造前那一份判定实现。
 */

import {
  grantPermissionLease,
  revokePermissionLease,
  PermissionLeaseError,
  type PermissionLease,
} from '../tools/permission-lease.js';

/** 租约时长默认值(分钟)。刻意短 —— 放宽的作用域是"这一个目标的这一轮"。 */
export const PERMISSION_LEASE_DEFAULT_TTL_MINUTES = 10;
/** 租约时长下限(分钟):低于 1 分钟的放宽只会被时钟抖动吞掉。 */
export const PERMISSION_LEASE_MIN_TTL_MINUTES = 1;
/** 租约时长硬封顶(分钟):`--permission-lease-ttl 99999` 不得把限时放宽变成不限时。 */
export const PERMISSION_LEASE_MAX_TTL_MINUTES = 60;

/** 轮次上限默认值:1 轮 = 本次运行,这是"目标级"的字面含义。 */
export const PERMISSION_LEASE_DEFAULT_TURNS = 1;
export const PERMISSION_LEASE_MIN_TURNS = 1;
/** 轮次硬封顶:与 `--max-turns` 的量级对齐,超过即无意义地放大作用域。 */
export const PERMISSION_LEASE_MAX_TURNS = 25;

/** 单次授予允许点名的工具数上限(清单越长越接近"全局放宽")。 */
export const PERMISSION_LEASE_MAX_TOOLS = 32;

const TOOL_LIST_SEPARATOR = ',';
/** 租约的审计 scope 前缀:让 audit.jsonl 里能一眼区分授予来源。 */
const SCOPE_PREFIX = 'cli-agent:';

/** 授予结果三态:`none` = 未给 flag(默认档,逐字不变)/ `granted` / `invalid`(必须失败关闭)。 */
export type PermissionLeaseFlagOutcome =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'granted';
      readonly lease: PermissionLease;
      readonly ttlMinutes: number;
      readonly turns: number;
    }
  | { readonly kind: 'invalid'; readonly reason: string };

/**
 * 解析逗号分隔的工具清单。只做**形状**处理(切分/去空白/去重/数量封顶),
 * 通配与空清单**不在这里重复判** —— 那是构造器的职责,它拒绝时本文件把错误转成 `invalid`。
 * 返回 null = 形状就不合法(带原因);空数组 = 未给 flag(⇒ `kind:'none'`)。
 */
export function parseLeaseTools(raw: string | null | undefined): {
  readonly tools: readonly string[];
  readonly error?: string;
} {
  const text = (raw ?? '').trim();
  if (text.length === 0) return { tools: [] };
  const parts = text
    .split(TOOL_LIST_SEPARATOR)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const unique = [...new Set(parts)];
  if (unique.length === 0) {
    // 操作员**写了**这个 flag 却一个工具都没点出来(例如 `--permission-lease ,`):
    // 这不是"没给 flag",静默当没给就是悄悄换了语义 ⇒ 失败关闭。
    // 文案取英文技术串:新文件在 HEAD 面的硬编码中文基线是 0,任何中文字面量都会被
    // 守门 70 判成"比基线更多";面向用户的包装语句走 i18n(`cliEntry.permissionLeaseInvalid`)。
    return { tools: [], error: '--permission-lease was given but the tool list is empty (name at least 1 tool)' };
  }
  if (unique.length > PERMISSION_LEASE_MAX_TOOLS) {
    return {
      tools: [],
      error: `--permission-lease accepts at most ${PERMISSION_LEASE_MAX_TOOLS} tools, got ${unique.length}`,
    };
  }
  return { tools: unique };
}

/**
 * ttl 解析 + 封顶(唯一出口,含 `Math.min`/`Math.max`)。
 * 非法/缺省 ⇒ 默认值。刻意**不抛**:超界是"往回收",不是"操作无效";
 * 生效值随 outcome 回传,命令层必须打印,不得静默把 240 分钟说成 10 分钟。
 */
export function resolveLeaseTtlMinutes(raw: string | number | null | undefined): number {
  const parsed = typeof raw === 'number' ? raw : Number.parseInt((raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed)) return PERMISSION_LEASE_DEFAULT_TTL_MINUTES;
  return Math.min(
    Math.max(Math.trunc(parsed), PERMISSION_LEASE_MIN_TTL_MINUTES),
    PERMISSION_LEASE_MAX_TTL_MINUTES,
  );
}

/** 轮次解析 + 封顶,口径与 ttl 同形。 */
export function resolveLeaseTurns(raw: string | number | null | undefined): number {
  const parsed = typeof raw === 'number' ? raw : Number.parseInt((raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed)) return PERMISSION_LEASE_DEFAULT_TURNS;
  return Math.min(Math.max(Math.trunc(parsed), PERMISSION_LEASE_MIN_TURNS), PERMISSION_LEASE_MAX_TURNS);
}

export interface GrantLeaseFromFlagInput {
  /** `--permission-lease` 原值(逗号分隔工具名);空/未给 ⇒ `kind:'none'`。 */
  toolsRaw?: string | null;
  /** `--permission-lease-ttl`(分钟)。 */
  ttlRaw?: string | number | null;
  /** `--permission-lease-turns`(轮)。 */
  turnsRaw?: string | number | null;
  /** 审计 scope 的目标标识(会话 id 等);空串时由 pid 兜底,绝不留空。 */
  target: string;
  nowMs?: number;
}

/**
 * 授予(唯一生产调用 `grantPermissionLease()` 的地方)。
 * 由 `runAgentAndExit` 在 agent 运行开始时调用一次。
 */
export function grantLeaseFromFlag(input: GrantLeaseFromFlagInput): PermissionLeaseFlagOutcome {
  const parsed = parseLeaseTools(input.toolsRaw);
  if (parsed.error) return { kind: 'invalid', reason: parsed.error };
  if (parsed.tools.length === 0) return { kind: 'none' };

  const ttlMinutes = resolveLeaseTtlMinutes(input.ttlRaw);
  const turns = resolveLeaseTurns(input.turnsRaw);
  const scope = `${SCOPE_PREFIX}${input.target.trim() || `pid-${process.pid}`}`;

  try {
    const lease = grantPermissionLease({
      scope,
      capabilities: parsed.tools,
      // 授权人写死为 cli-flag:本入口唯一的来源就是命令行,不得被别处冒充。
      grantor: 'cli-flag',
      ttlMs: ttlMinutes * 60_000,
      expiresAfterTurns: turns,
      nowMs: input.nowMs,
    });
    return { kind: 'granted', lease, ttlMinutes, turns };
  } catch (err) {
    // 构造器的判死(空清单/通配/无到期/叠租约)在这里转成"失败关闭",
    // 由命令层打印原因并 exit 1 —— 绝不静默回落到"没给 flag 继续跑"。
    const reason =
      err instanceof PermissionLeaseError || err instanceof Error
        ? err.message
        : String(err);
    return { kind: 'invalid', reason };
  }
}

/**
 * 运行收尾:显式撤销(落 `permission_lease_revoked` 审计行)。
 * 返回 true = 确实撤掉了一份。未授予过 ⇒ false,可安全重放(构造上不抛)。
 */
export function releaseLeaseAfterRun(reason: string): boolean {
  return revokePermissionLease(reason);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
