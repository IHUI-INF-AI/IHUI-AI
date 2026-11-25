// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端共享常量统一入口
 * 各端从此处统一 import,禁止本地硬编码重复
 */
export * from './theme'
export * from './error-codes'
export * from './storage-keys'
export * from './coze'
export * from './payment-codes'
export * from './external-urls'
export * from './default-avatar'
export * from './image-source-pool'
export * from './sso-client-ids'
export * from './page-size'
export * from './fallback-models'
export * from './share'
export * from './model-catalog'
export * from './model-names'
// 2026-11-03 跨端对齐:模型编辑只读字段清单上收共享(web 置灰 / RN 编辑 / 驱动层 payload 同源)
export * from './model-edit'
export * from './web-portal'
export * from './about-sections'
export * from './carte-sections'
// ModelEdit 只读字段清单:RN 共享屏与小程序同名页读同一份,禁止端内各抄一份(「能改但不生效」的根因)
export * from './model-edit'
// D120/D124:注入来源 kind 闭集 + 词表键(web 聚合条 / ui-react 单条交代共用同一份)
export * from './injection-kinds'
// G-100:Apple AASA 单一真相源(web 8801 与 api 8802 同源消费,禁止各端再抄 JSON)
export * from './apple-app-site-association'
// 2026-11-23 计费口径单一真相源:积分倍数关键词推断的规则数据 + 解释器(api/web 同读,Py 侧由生成器同源产出)
export * from './points-multiplier-rules'
// 2026-11-26 VIP 权益 key → 中文标签单一真相源(数据库存英文 key,端上直接渲染会露裸键名)
export * from './vip-benefits'
// 2026-11-26 撤除 './aigc-metadata' 的再导出:该模块从未入库(树上与工作树都没有这个文件),
// 只留了一行 `export * from`,@ihui/shared 的 tsc 直接 TS2307 卡死 ⇒ 部署环连续多轮 build-fail,
// 线上停在旧构建。补该特性时须把 aigc-metadata.ts 与本行同枚提交,不许分家。
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
