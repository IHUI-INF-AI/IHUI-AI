// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 协作身份三档 + 命令门槛(fail-closed)。
 *
 * 借鉴来源(Qoder CN 协作 CLI,取证 docs/benchmark-evidence/2026-11/deep-native-2026-11-23/
 * block3-qoder.md 的 B3-03):身份 **User / RuntimeOwner / RuntimeAgent** 三档由 host 从可信
 * 会话上下文选定,CLI 不得自选 —— 不提供 `--identity` / `--runtime-context-fd` / `--profile`,
 * 401/403/404 不授权切身份;身份不足时拒绝(exit 3),绝不降级执行。
 *
 * 本仓复现 + 超越:
 *   1. 命令 → 所需权重写成**一张表**(`COLLAB_COMMAND_MIN_RANK`),新增命令漏映射会被类型与测试双重拦下;
 *   2. **自选检测**:argv 里一旦出现身份类参数即显式拒绝(不是"我们没提供",而是"提供了就拒");
 *   3. **未知即拒**:宿主上下文有值但不可识别时返回 null,任何命令一律拒绝,不回落 `user`;
 *   4. **防递归派生**:`runtime-agent` 不得再派发/派生,与 `subagents/worker-pool.ts` 的并发档互补。
 *
 * 边界(刻意):不实现凭据管道、不做身份切换、不读磁盘/网络;本层是纯判据,零 I/O。
 */

export type CollabIdentityTier = 'user' | 'runtime-owner' | 'runtime-agent';

/** 三档全集(顺序即文档顺序,测试按它校验完备性)。 */
export const COLLAB_IDENTITY_TIERS: readonly CollabIdentityTier[] = [
  'user',
  'runtime-owner',
  'runtime-agent',
];

/**
 * 档位权重:越大越受信。
 * `user`(人直接操作)与 `runtime-owner`(被授权代表用户的运行体)同级 —— 两者都能派发;
 * `runtime-agent` 只执行,不能自行派发或派生。
 */
export const COLLAB_IDENTITY_RANK: Readonly<Record<CollabIdentityTier, number>> = {
  user: 2,
  'runtime-owner': 2,
  'runtime-agent': 1,
};

/** 协作 CLI 命令面(枚举;每个都必须有身份映射)。 */
export type CollabCommand =
  | 'subagent.topology-read'
  | 'subagent.dispatch'
  | 'subagent.spawn'
  | 'subagent.arbitrate';

/** 命令 → 最低权重。完备性由 `identity-contract` 用例钉住(新增命令不映射即红)。 */
export const COLLAB_COMMAND_MIN_RANK: Readonly<Record<CollabCommand, number>> = {
  'subagent.topology-read': 1,
  'subagent.dispatch': 2,
  'subagent.spawn': 2,
  'subagent.arbitrate': 2,
};

/** 宿主注入运行上下文的**唯一** env 键;值只认 `owner` / `agent` 两个不透明标记。 */
export const COLLAB_RUNTIME_CONTEXT_ENV = 'IHUI_COLLAB_RUNTIME_CONTEXT';

/**
 * CLI 不得自选身份:出现这些参数即拒绝。
 * 刻意不列凭据类参数(`--token` 在 `ihui login` 等命令上有正当用途),本层只判身份。
 */
export const COLLAB_FORBIDDEN_ARGV_FLAGS: readonly string[] = [
  '--identity',
  '--profile',
  '--runtime-context-fd',
  '--role',
];

export type CollabIdentityCode =
  | 'identity_unknown'
  | 'identity_self_selected'
  | 'identity_insufficient';

export interface CollabIdentityGate {
  ok: boolean;
  /** 0 = 放行;3 = 拒绝(与协作 CLI 退出码契约一致,见 `./exit-codes.ts`)。 */
  exitCode: 0 | 3;
  code?: CollabIdentityCode;
  message?: string;
}

/** 拒绝时抛出的错误:带 exitCode,CLI 顶层可直接映射成进程退出码 3。 */
export class CollabIdentityRefused extends Error {
  readonly exitCode = 3;
  readonly code: CollabIdentityCode;

  constructor(code: CollabIdentityCode, message: string) {
    super(message);
    this.name = 'CollabIdentityRefused';
    this.code = code;
  }
}

/**
 * 解析当前协作身份。**只读宿主注入的 env**,签名里没有 argv、也不读 `process.argv`
 * ⇒ 结构上就无法被命令行参数影响。默认 `user`(本地终端直跑)。
 * @returns null = 上下文有值但不可识别 ⇒ 调用方必须拒绝(fail-closed,不回落 user)
 */
export function resolveCollabIdentity(
  env: Readonly<Record<string, string | undefined>> = process.env,
): CollabIdentityTier | null {
  const raw = env[COLLAB_RUNTIME_CONTEXT_ENV];
  if (raw === undefined || raw === '') return 'user';
  if (raw === 'owner') return 'runtime-owner';
  if (raw === 'agent') return 'runtime-agent';
  return null;
}

/** 从 argv 找第一个身份自选参数(同时支持 `--x=v` 与独立成项的 `--x` 两种写法)。 */
export function findForbiddenArgvFlag(argv: readonly string[]): string | null {
  for (const arg of argv) {
    for (const flag of COLLAB_FORBIDDEN_ARGV_FLAGS) {
      if (arg === flag || arg.startsWith(`${flag}=`)) return flag;
    }
  }
  return null;
}

/**
 * 身份闸:先拒自选参数,再拒未知上下文,最后比权重。
 * @param opts.argv 本命令自己的参数列表(命令解析器传入);不传 ⇒ 不做 argv 检查
 *   (刻意不默认读 `process.argv`,否则 `ihui login --token` 之类会把无关参数误判进去)
 */
export function assertCollabIdentity(
  command: CollabCommand,
  identity: CollabIdentityTier | null,
  opts: { argv?: readonly string[] } = {},
): CollabIdentityGate {
  const forbidden = findForbiddenArgvFlag(opts.argv ?? []);
  if (forbidden) {
    return {
      ok: false,
      exitCode: 3,
      code: 'identity_self_selected',
      message: `检测到身份自选参数 ${forbidden}:协作身份只由宿主注入,CLI 不得自选`,
    };
  }
  if (identity === null) {
    return {
      ok: false,
      exitCode: 3,
      code: 'identity_unknown',
      message: `协作身份上下文不可识别(${COLLAB_RUNTIME_CONTEXT_ENV} 的值不在 owner/agent 之内):按 fail-closed 拒绝`,
    };
  }
  const need = COLLAB_COMMAND_MIN_RANK[command];
  const rank = COLLAB_IDENTITY_RANK[identity];
  if (rank < need) {
    return {
      ok: false,
      exitCode: 3,
      code: 'identity_insufficient',
      message: `命令 ${command} 需要权重 ≥${need} 的身份,当前身份 ${identity}(权重 ${rank}):拒绝执行`,
    };
  }
  return { ok: true, exitCode: 0 };
}

/** 生产调用点用的闸:漏斗 `resolveCollabIdentity` + `assertCollabIdentity`,不通过即抛。 */
export function assertCollabIdentityOrThrow(
  command: CollabCommand,
  opts: {
    env?: Readonly<Record<string, string | undefined>>;
    argv?: readonly string[];
  } = {},
): void {
  const identity = resolveCollabIdentity(opts.env ?? process.env);
  const gate = assertCollabIdentity(
    command,
    identity,
    opts.argv === undefined ? {} : { argv: opts.argv },
  );
  if (!gate.ok) {
    throw new CollabIdentityRefused(
      gate.code ?? 'identity_unknown',
      gate.message ?? `协作身份校验未通过(${command})`,
    );
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
