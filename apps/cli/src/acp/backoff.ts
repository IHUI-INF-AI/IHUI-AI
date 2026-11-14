// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 通用指数退避（exponential backoff with jitter）。
 *
 * 对标来源（Qoder，仅取证思想，代码为本仓自有实现）：
 *   `rc_vm_batch_members` 的失败成员独立退避——
 *     `prepare_retry_at = now + MIN(30000, 5000*(1<<MIN(prepare_attempts,3)))`
 *   `rc_vm_uploads` 的上传退避——`retry_at` 上限 30000ms、位移退避。
 *   思想：按尝试次数指数增大重试间隔，封顶一个上限，避免重试风暴。
 *
 * 超越点（Qoder 没有的）：
 *   1. **full jitter 抖动** —— 裸指数退避下，多个并发失败者会在同一时刻集体重试（惊群 thundering herd）。
 *      本模块按 AWS 经典 full-jitter 策略，把退避值抖动到 `[0, rawBackoff)`，打散重试时点。
 *   2. **封顶前置抖动** —— 先按位移算裸退避并封顶，再抖动，保证抖动后仍 ≤ 上限。
 *   3. **预算耗尽判定** —— 与 agent-inbox 的 recoveryBudget 同一 fail-closed 哲学：超预算判持久失败。
 *
 * 设计约束（单一真相源）：
 *   - 退避**只算不睡**（纯函数返回 delayMs），睡眠由调用方用 `sleep()` 或自行控制，
 *     便于测试断言与在不同调度环境（setTimeout / 定时任务 / 测试假时钟）复用。
 *   - 默认参数对齐 Qoder：base 5000ms、cap 30000ms。
 * 平台特有：无（纯计算，无平台 API）。
 */

/** 退避策略：full jitter（默认，打散惊群）或 fixed（裸指数，可预测，测试用）。 */
export type BackoffJitter = 'full' | 'none';

export interface BackoffOptions {
  /** 首次尝试前的基准退避（毫秒）。默认 5000，对齐 Qoder。 */
  baseMs?: number;
  /** 退避上限（毫秒），裸退避先封顶再抖动。默认 30000，对齐 Qoder。 */
  capMs?: number;
  /** 抖动策略。默认 'full'。 */
  jitter?: BackoffJitter;
  /**
   * 随机源，返回 [0,1)。默认 Math.random。
   * 注入以便测试确定性地断言抖动边界（测试传 () => 0 / () => 0.9999）。
   */
  random?: () => number;
}

/**
 * 按尝试次数算下一次重试延迟（毫秒）。
 *
 * @param attempts 已尝试次数（0 = 第一次失败后算第一次重试延迟）。
 * @returns 延迟毫秒，恒 ≥ 0 且 ≤ capMs。
 *
 * 裸退避 = MIN(cap, base * 2^attempts)，等价 Qoder 的 base*(1<<attempts) 封顶形式；
 * 用位移 `1 << n` 而非 Math.pow，与 Qoder 同源且对 attempts 做上限钳制防位移溢出。
 */
export function backoffDelayMs(attempts: number, options: BackoffOptions = {}): number {
  const baseMs = options.baseMs ?? 5000;
  const capMs = options.capMs ?? 30_000;
  const jitter = options.jitter ?? 'full';
  const random = options.random ?? Math.random;

  if (!Number.isFinite(attempts) || attempts < 0) {
    // 非法 attempts（负数/NaN/Infinity）fail-closed：不给退避，让调用方立即判持久失败。
    return 0;
  }

  // 位移钳制：attempts 过大时 1<<attempts 会溢出，钳到安全位数（≤30 已远超 cap/base 比值）。
  const shift = Math.min(Math.floor(attempts), 30);
  const raw = baseMs * (1 << shift);
  const capped = Math.min(raw, capMs);

  if (jitter === 'none') {
    return capped;
  }

  // full jitter：退避值均匀抖动到 [0, capped)。random 注入时边界可确定性断言。
  return Math.floor(random() * capped);
}

/**
 * 恢复预算判定：是否还允许重试。
 * 与 agent-inbox.recoveryBudget 语义一致（fail-closed），供退避调用方统一判持久失败。
 */
export function retryBudget(
  attempts: number,
  maxAttempts: number,
): { retryable: boolean; reason: string } {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 0) {
    return { retryable: false, reason: `maxAttempts 非法(${maxAttempts})，fail-closed 判不可重试` };
  }
  if (!Number.isFinite(attempts) || attempts < 0) {
    return { retryable: false, reason: `attempts 非法(${attempts})，fail-closed 判不可重试` };
  }
  if (attempts >= maxAttempts) {
    return {
      retryable: false,
      reason: `恢复预算耗尽(${attempts}/${maxAttempts})，判持久失败`,
    };
  }
  return { retryable: true, reason: `预算内(${attempts}/${maxAttempts})` };
}

/** 睡眠指定毫秒（调用方决定是否真睡；测试可注入假时钟替代）。 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
