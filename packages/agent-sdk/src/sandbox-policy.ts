// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * agent 沙箱执行策略（执行前判定层）。
 *
 * 能力溯源（逆向-复现-超越，2026-11-27）:对照程序 DeepSeek Harness 把内置 node/pnpm/python
 * 三运行时**直接**暴露给 AI（resources/runtime/primary-runtime/dependencies/），无超时、
 * 无输出上限、无危险命令拒绝、无环境脱敏 —— 这是 harness「给模型一个可执行环境」的取舍。
 * 本模块用**自有实现**在执行前加一层策略判定，至少在一个轴上超越对照:
 *   1. 危险命令拒绝(critical/high 必拦) —— 判据**注入**而非本层自造(见 DANGEROUS 纪律);
 *   2. 资源上限(超时 / stdout+stderr 上限)—— 默认即有,不是可选;
 *   3. 环境脱敏(密钥类变量默认不进子进程);
 *   4. 审计结构(每次判定产出可落日志的 record,含 allow/deny + 原因)。
 *
 * 为什么这层是纯判定、不 spawn:spawn 已在 query.ts(ACP 子进程)与各工具执行器里。
 * 这里只回答「能不能跑 + 用什么限制跑 + 为什么」,执行方据 result.allowed 决定放行或拒绝。
 * 这样判定与执行解耦,判定可单测、可审计、可被多个执行器复用(§6 单一真相源)。
 *
 * DANGEROUS 纪律(关键,防判据漂移):
 * 本层**不自造**危险命令正则。`detectDangerous` 是注入的判据函数,生产由调用方传入
 * `@ihui/shared` 的 `detectDangerousCommands`(唯一真相源),本层只消费它的 `hasDangerous`。
 * 若未注入(null),本层**降级为拒绝**(fail-closed),绝不因「没有判据」就放行 ——
 * 失效方向恒为「多拦一次 / 多要一次审批」,不是「多放一次跳门」(§0.10)。
 *
 * 零依赖:本文件不 import 任何包(node 类型除外),保持 @ihui/agent-sdk 的零运行时依赖边界。
 */

/** 单条可执行项(命令 + 参数),执行器把待跑的东西归一成它再送判 */
export interface SandboxCommand {
  /** 可执行程序(已解析或 PATH 名) */
  readonly program: string
  /** 参数数组 */
  readonly args?: readonly string[]
  /** 工作目录 */
  readonly cwd?: string
}

/** 资源上限(全部有默认值,缺省即生效) */
export interface SandboxLimits {
  /** 墙钟超时毫秒;超时即 kill */
  readonly timeoutMs: number
  /** stdout 保留尾部字节数 */
  readonly stdoutLimit: number
  /** stderr 保留尾部字节数 */
  readonly stderrLimit: number
}

/** 判定所需的上下文(宿主注入,不从进程全局偷读) */
export interface SandboxContext {
  /** 危险命令判据(生产注入 @ihui/shared detectDangerousCommands;null ⇒ fail-closed) */
  readonly detectDangerous: ((input: string) => { hasDangerous: boolean }) | null
  /** 环境脱敏开关(默认 true:密钥类变量不进子进程) */
  readonly sanitizeEnv?: boolean
}

/** 判定结论 */
export type SandboxDecision =
  | { readonly allowed: true; readonly limits: SandboxLimits; readonly env: Record<string, string> }
  | { readonly allowed: false; readonly reason: string; readonly code: SandboxDenyCode }

export type SandboxDenyCode =
  | 'DANGEROUS_COMMAND'
  | 'MISSING_DANGEROUS_DETECTOR'
  | 'EMPTY_PROGRAM'

/** 审计记录(每次判定产出一条,可落日志;不含明文密钥) */
export interface SandboxAuditRecord {
  readonly program: string
  readonly decision: 'allow' | 'deny'
  readonly code?: SandboxDenyCode
  readonly reason?: string
  readonly timeoutMs?: number
  readonly envKeysSanitized?: readonly string[]
}

/** 默认资源上限 —— 相对 DeepSeek harness(无上限)的核心差异,缺省即生效 */
export const DEFAULT_SANDBOX_LIMITS: SandboxLimits = {
  timeoutMs: 120_000,
  stdoutLimit: 256 * 1024,
  stderrLimit: 64 * 1024,
}

/**
 * 密钥类环境变量名片段(大小写不敏感,子串匹配)。
 * 命中即默认从子进程环境中剥除 —— 凭据永不进不受信子进程(§5d / client-sign 同纪律)。
 */
const SECRET_ENV_FRAGMENTS = [
  'token', 'secret', 'password', 'passwd', 'api_key', 'apikey',
  'access_key', 'private_key', 'credential', 'auth', 'cookie', 'session',
] as const

/** 环境变量名是否疑似密钥(纯判定,给脱敏与审计共用) */
export function looksLikeSecretEnvKey(key: string): boolean {
  const k = key.toLowerCase()
  return SECRET_ENV_FRAGMENTS.some((frag) => k.includes(frag))
}

/** 对环境做脱敏:剥除疑似密钥变量,返回(脱敏后环境, 被剥的键名列表) */
export function sanitizeEnv(env: Readonly<Record<string, string>>): {
  env: Record<string, string>
  sanitizedKeys: string[]
} {
  const out: Record<string, string> = {}
  const sanitizedKeys: string[] = []
  for (const [key, value] of Object.entries(env)) {
    if (looksLikeSecretEnvKey(key)) {
      sanitizedKeys.push(key)
      continue
    }
    out[key] = value
  }
  return { env: out, sanitizedKeys }
}

/** 把命令归一成用于危险判定的字符串(program + args) */
function commandLineOf(cmd: SandboxCommand): string {
  return [cmd.program, ...(cmd.args ?? [])].join(' ')
}

/**
 * 执行前判定:这个命令能不能在沙箱里跑、用什么限制、为什么。
 *
 * 失效方向(fail-closed):
 * - program 为空 ⇒ 拒绝(EMPTY_PROGRAM)
 * - 未注入危险判据 ⇒ 拒绝(MISSING_DANGEROUS_DETECTOR),不因缺判据而放行
 * - 判据命中 critical/high ⇒ 拒绝(DANGEROUS_COMMAND)
 *
 * @param cmd   待执行项
 * @param env   拟传给子进程的环境(通常调用方已合并 process.env)
 * @param ctx   判定上下文(dangerous 判据必传,null 则 fail-closed)
 * @param limits 资源上限覆盖(缺省用 DEFAULT_SANDBOX_LIMITS)
 */
export function evaluateSandboxCommand(
  cmd: SandboxCommand,
  env: Readonly<Record<string, string>>,
  ctx: SandboxContext,
  limits: Partial<SandboxLimits> = {},
): { decision: SandboxDecision; audit: SandboxAuditRecord } {
  const effective: SandboxLimits = {
    timeoutMs: limits.timeoutMs ?? DEFAULT_SANDBOX_LIMITS.timeoutMs,
    stdoutLimit: limits.stdoutLimit ?? DEFAULT_SANDBOX_LIMITS.stdoutLimit,
    stderrLimit: limits.stderrLimit ?? DEFAULT_SANDBOX_LIMITS.stderrLimit,
  }

  const program = cmd.program?.trim() ?? ''
  if (!program) {
    return {
      decision: { allowed: false, reason: '沙箱拒绝:待执行程序为空', code: 'EMPTY_PROGRAM' },
      audit: { program, decision: 'deny', code: 'EMPTY_PROGRAM', reason: 'empty program' },
    }
  }

  if (ctx.detectDangerous === null) {
    return {
      decision: {
        allowed: false,
        reason: '沙箱拒绝:未注入危险命令判据(fail-closed),不放行',
        code: 'MISSING_DANGEROUS_DETECTOR',
      },
      audit: {
        program,
        decision: 'deny',
        code: 'MISSING_DANGEROUS_DETECTOR',
        reason: 'no dangerous detector injected',
      },
    }
  }

  const line = commandLineOf(cmd)
  const detection = ctx.detectDangerous(line)
  if (detection.hasDangerous) {
    return {
      decision: {
        allowed: false,
        reason: `沙箱拒绝:命令命中危险模式 → ${line}`,
        code: 'DANGEROUS_COMMAND',
      },
      audit: {
        program,
        decision: 'deny',
        code: 'DANGEROUS_COMMAND',
        reason: 'dangerous command matched',
      },
    }
  }

  const doSanitize = ctx.sanitizeEnv !== false
  const sanitized = doSanitize ? sanitizeEnv(env) : { env: { ...env }, sanitizedKeys: [] }

  return {
    decision: { allowed: true, limits: effective, env: sanitized.env },
    audit: {
      program,
      decision: 'allow',
      timeoutMs: effective.timeoutMs,
      envKeysSanitized: sanitized.sanitizedKeys,
    },
  }
}
