// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export * from './ai-skill-variables'
// AI 操控桥的投递定址判定(五桥共用一份实现,端内只注入自身身份)
export * from './agent-action-addressing'
export * from './app-control-intent'
export * from './async'
export * from './base64'
// 上下文占用归因分解(按构成来源,而非只报总量)
export * from './context-attribution'
// canonical JSON 序列化唯一出口(86F:审计链哈希与导出签名共用,生产面禁止第二份)
export * from './canonical-json'

export * from './content-equal'
// D20 会话组织(文件夹/标签)的归一化、回收与筛选规则唯一实现(端内不得再建第二套)
export * from './conversation-org'
export * from './dangerous-command-detector'
export * from './date-utils'
// G-854(2026-10-04 立)矢量图预览的视口数学唯一出口 —— 倍率域/适应视口/定点缩放/平移钳制,
// 内联渲染器与独立预览 Modal 共用一份;端内不得再写第二遍(§「两处算同一件事必漂移」)
export * from './diagram-viewport'
// G-704(2026-09-29 立)「值等价即不写」的等深比较器唯一实现(端内不得各写一份近似品)
export * from './deep-equal-records'
export * from './error-messages'
export * from './file-helpers'
export * from './form-styles'
export * from './format'
export * from './format-ext'
// 移动端/小程序端通用格式工具(2026-07-30 立)
export * from './format-mobile'
// 跨端图片处理工具(2026-07-30 立,apps/mobile-rn + apps/miniapp-taro 共用)
export * from './image-helpers'
// 跨端 compact 数字格式化(2026-08-01 P3-4.2 批次5 立,从 apps/web/src/lib/number-format.ts 下沉)
export * from './number-format'
// 跨端存储抽象(2026-07-30 立,apps/mobile-rn + apps/miniapp-taro 共用)
export * from './storage'
export * from './jwt-utils'
export * from './llm-templates'
export * from './logger'
export * from './markdown-mermaid-code'
export * from './mcp-curated'
export * from './message-search'
export * from './object'
// 脱敏(共享层唯一实现;D94 交接单 / 日志 / 出库边界共用;规则为 ai-service
// output_cleaning.py + cli/redact.ts 既有正则的并集,端内不得再建第二套)
export * from './redact'
export * from './role'
export * from './sanitize-url'
export * from './search-suggestions'
export * from './select-class'
export { parseSSEChunk, type SSEEvent as ParsedSSEEvent } from './sse-parse'
export * from './status-colors'
export * from './storage-migration'
// 跨端 Token 估算工具(2026-08-01 P3-4.2 批次5 立,从 apps/web/src/lib/token-estimate.ts 下沉)
export * from './token-estimate'
// 工具入参的两档摘要(结构指纹 + 形态类)唯一出口,86 审计链的输入格式层;不含任何原值
export * from './tool-args-digest'
export * from './vip-utils'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
