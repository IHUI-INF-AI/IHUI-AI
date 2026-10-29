// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 入口层单 IP 令牌桶限流(2026-10-29 加固)。
 *
 * 为什么需要:线上入口是 `ihui-api-router.mjs`(Node 反代),**不是 nginx** ——
 * `deploy/nginx/conf.d/rate-limit.conf` 那 6 套 zone 在本机生产从未装车。而 web 的
 * 8801 必须监听 0.0.0.0(EdgeOne 源站直填公网 IP),意味着**知道源站 IP 就能绕过边缘**,
 * router 是唯一还能拦一手的层。
 *
 * 定位(别把它当抗 DDoS):
 *   · 目标 = 单 IP 高频扫描 / 小规模 CC / 暴力枚举;
 *   · **不是**抗大规模分布式 DDoS —— 那种量级只能靠 EdgeOne/高防,单进程内存计数扛不住,
 *     也不该扛(把 router 拖死等于自己完成攻击)。
 *   · 因此阈值刻意给得宽(默认 500 rps / 1000 burst):正常单 IP(即便经 EdgeOne 回源共享
 *     出口 IP)远达不到,而单 IP 洪水会瞬间打满。
 *
 * 为什么用 remoteAddress 而不是 X-Forwarded-For:
 *   XFF 是客户端可任意伪造的头。拿它当限流 key 等于把限流开关交给攻击者(每请求换一个
 *   假 IP 即绕过)。TCP 对端地址不可伪造,是唯一诚实的 key。代价是「经 EdgeOne 回源时
 *   所有请求共享出口 IP」—— 故阈值必须宽,见上。
 *
 * 内存安全:桶按 IP 累积会无界增长,故设 maxKeys 上限,超限按 lastRefill 淘汰最旧 10%。
 * 淘汰是「忘记历史」而非「拒绝」,失效方向恒为放宽 —— 宁可少限一次,不可误杀。
 */

const DEFAULTS = Object.freeze({
  rps: 500,
  burst: 1000,
  maxKeys: 50_000,
})

/**
 * @param {object} [opts]
 * @param {number} [opts.rps] 每秒补充令牌数
 * @param {number} [opts.burst] 桶容量(允许的瞬时突发)
 * @param {number} [opts.maxKeys] 最多跟踪多少个 IP
 * @param {() => number} [opts.now] 注入时钟(测试用)
 * @returns {{check: (key: string) => {allowed: boolean, retryAfterSec: number, remaining: number}, size: () => number}}
 */
export function createIpRateLimiter(opts = {}) {
  const rps = positiveOr(opts.rps, DEFAULTS.rps)
  const burst = positiveOr(opts.burst, DEFAULTS.burst)
  const maxKeys = positiveOr(opts.maxKeys, DEFAULTS.maxKeys)
  const now = typeof opts.now === 'function' ? opts.now : Date.now

  /** @type {Map<string, {tokens: number, last: number}>} */
  const buckets = new Map()

  function evictOldest() {
    const entries = [...buckets.entries()].sort((a, b) => a[1].last - b[1].last)
    const drop = Math.max(1, Math.floor(entries.length * 0.1))
    for (let i = 0; i < drop; i += 1) buckets.delete(entries[i][0])
  }

  function check(key) {
    const t = now()
    let bucket = buckets.get(key)
    if (bucket === undefined) {
      // 新 IP 从满桶开始:首次访问不该被限(正常用户第一屏就是几十个请求)。
      bucket = { tokens: burst, last: t }
      buckets.set(key, bucket)
      if (buckets.size > maxKeys) evictOldest()
    } else {
      const elapsedSec = (t - bucket.last) / 1000
      if (elapsedSec > 0) {
        bucket.tokens = Math.min(burst, bucket.tokens + elapsedSec * rps)
        bucket.last = t
      }
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return { allowed: true, retryAfterSec: 0, remaining: Math.floor(bucket.tokens) }
    }
    // 还差多少令牌才能放行一个 ⇒ 向上取整到秒(Retry-After 只认整数秒)
    const needSec = (1 - bucket.tokens) / rps
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(needSec)), remaining: 0 }
  }

  return { check, size: () => buckets.size }
}

/**
 * 从 env 读限流配置。`IHUI_BG_RATE_LIMIT=off` 可整层关闭(应急逃生舱)。
 *
 * 关闭而不是把阈值调大:出了误伤事故时,运维要的是「一条命令止血」,
 * 而不是「猜一个够大的数字」。
 */
export function resolveRateLimitConfig(env = process.env) {
  const flag = String(env.IHUI_BG_RATE_LIMIT ?? '').trim().toLowerCase()
  if (flag === 'off' || flag === '0' || flag === 'false' || flag === 'no') {
    return { enabled: false, rps: 0, burst: 0 }
  }
  return {
    enabled: true,
    rps: positiveOr(Number(env.IHUI_BG_RATE_LIMIT_RPS), DEFAULTS.rps),
    burst: positiveOr(Number(env.IHUI_BG_RATE_LIMIT_BURST), DEFAULTS.burst),
  }
}

function positiveOr(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
