// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对话渲染模型 barrel(W6 立;web / extension / mobile-rn 共用纯函数出口)
export * from './render-model'
// 任务进度状态条派生层(跨端单一真相源:纯函数,无平台依赖)
export * from './task-status'
// 工具码名 → i18n 键展示映射(界面禁止直显英文工具码名)
export * from './tool-display'
export * from './tool-activity'
// 流式失败的跨端标记规则(error 词汇单一真相:标记 / 尾位定位 / 失败轮判定 / 重发目标)
export * from './stream-error'
// 工作区权限档展示(D111:档位行取词,web/extension/miniapp-taro/mobile-rn 共用)
export * from './permission-tier'
// D79 等待态文案池(分象限×分阶段轮换,seed 取模确定性,跨端共用)
export * from './waiting-pool'
// D55 步骤决策词汇表(15 个后端字面量的唯一映射,跨端共用;认不出不编造)
export * from './step-decision'
// D36 会话内输入历史栈(纯逻辑:push/去重/50 上限/游标导航;平台无关,web 接线在 use-prompt-history)
export * from './prompt-history'
