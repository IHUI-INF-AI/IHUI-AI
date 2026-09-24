// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// TOKEN_STORAGE_KEY / REFRESH_TOKEN_STORAGE_KEY 已迁移至 ./constants/storage-keys.ts
// 此处 re-export 保持向后兼容(已有大量代码从 'constants' 直接 import)
export { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from './constants/storage-keys'
export const REFRESH_LEAD_MS = 5 * 60 * 1000

/**
 * Token 过期状态码(各端判断 HTTP 响应是否表示 token 过期,触发 refresh / 重登流程)。
 * 401 = 标准 Unauthorized;40101 = 业务层 token 过期约定码;499 = 客户端关闭连接前置码。
 */
export const TOKEN_EXPIRED_CODES = [401, 40101, 499] as const

/**
 * Web 端基址(各端跳转 web 端页面 / SSO 回跳 / 分享链接拼接用)。
 * 生产环境固定 https://aizhs.top;开发环境各端可自行 fallback 到 localhost。
 */
export const WEB_BASE = 'https://aizhs.top'

/**
 * Error codes (business error enum, predicates, i18n key mapping) - shared across all apps.
 * @see ./constants/error-codes.ts
 */
export * from './constants/error-codes'

export * from './constants/theme'

// 统一 re-export constants/ 目录下所有常量
export * from './constants/index'

/**
 * 杀手锏常量跨端只读镜像(web / cli / miniapp 与 Python 之间必须逐值一致)。
 * 唯一真源(Py)在 apps/ai-service/app/core/tunables.py —— 改动真源时必须同步本段,
 * 否则 ai-service 的 tests/test_killer_parity.py 以"漂移即失败"拦截。
 */
export const MAX_STEPS_PER_RUN = 2000
export const DEFAULT_CHECKPOINT_TTL = 86400
export const FILE_VERSION_REDIS_TTL = 86400
export const DEFAULT_TRIGGER_RATIO = 0.88
export const DEFAULT_TARGET_RATIO = 0.6
export const DEFAULT_KEEP_RECENT = 6
export const DEFAULT_MIN_MESSAGES = 2
export const DEFAULT_PROTOCOL_VERSION = '2025-03-26'
export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2024-11-05',
  '2025-03-26',
  '2025-06-18',
  '2025-11-25',
] as const
/**
 * P3-11 同构:压缩质量自证默认值镜像(真源 tunables.py 的 *_DEFAULT 标量;
 * env 解析值随环境变化,parity 断言以默认值为基线)。
 */
export const AGENT_COMPACTION_QUALITY_THRESHOLD_DEFAULT = 0.5
export const AGENT_COMPACTION_QUALITY_KEEP_RECENT_BONUS_DEFAULT = 4

/**
 * 旧工具结果回收(reclaim)与压缩有效性守卫的阈值镜像(真源 tunables.py 段 4b)。
 * 实现常量在 packages/context-compaction/src/{reclaim,validity-guards}.ts ——
 * 三处必须逐值相等,由 consistency-fixtures.json 的 strategy_constants 与
 * apps/ai-service/tests/test_killer_parity.py 双向对账。
 */
export const RECLAIM_KEEP_RECENT_ROUNDS = 3
export const RECLAIM_MIN_SAVED_TOKENS = 600
export const RECLAIM_WINDOW_RATIO_TRIGGER = 0.6
export const RECLAIM_IDLE_TRIGGER_MS = 120000
export const RECLAIM_MIN_RESULT_TOKENS = 120
export const REFILL_QUICK_WINDOW_ROUNDS = 2
export const REFILL_BREAKER_MAX_CONSECUTIVE = 3
export const OVERFLOW_DROP_MAX_ROUNDS = 6
export const NEXT_TURN_GROWTH_TOKENS = 1200

/**
 * W5:SSE 流式传输健壮性常量(跨端单一真源)。
 *
 * 取值与 @ihui/api-client 的 client.ts 内部实现保持一致(该文件因不依赖
 * @ihui/shared 而无法反向 import 本段,故此处为唯一可复用真源,各端引用本段,
 * 禁止再各自硬编码)。miniapp-taro 的 streamChat 读超时 / 指数退避重试直接复用。
 */
/** 单次读流超时(ms):超过则视为连接卡死并触发重试 */
export const STREAM_READ_TIMEOUT_MS = 30000
/** 最大重试次数(业务错误 401/403/429 不计入重试) */
export const STREAM_MAX_RETRIES = 3
/** 指数退避初始延迟(ms):delay = INITIAL * 2^attempt */
export const STREAM_INITIAL_RETRY_DELAY = 1000
/** 指数退避延迟上限(ms):同时约束 retry-after 头换算出的等待时长 */
export const STREAM_MAX_RETRY_DELAY = 30000
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
