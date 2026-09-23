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
// D81 类目聚合双时态(文件/图片/搜索/思考/自定义)——与 tool-activity 共用 taskStatus 双时态词表,不另建
export * from './tool-category'
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
// D105 PR 检查状态与动作卡(六态 + 聚合三态/空态的唯一判定层;不取数,数据面复用既有 PR 通道)
export * from './pr-checks'
// D103 流内多智能体批量动作卡的动作矩阵(六动作 × 三态;相位与实例状态两个正交维度各只有一个定义处)
export * from './agent-actions'
// D99 消息串内富文本动作锚点(标签白名单 + 跨端唯一解析器;非白名单一律按文本,严禁打开裸 HTML)
export * from './rich-anchors'
// D72 Worktree 生命周期八态(创建中/已创建/初始化失败/超时/已清理/恢复中/已恢复/无法恢复;与 §12d
// 收编三阶段 cherry-pick→remove→prune 状态一致,含单写者守卫;不为卡片取数,onAction 注入)
export * from './worktree-lifecycle'
// D96 对话内写作块三动作(accept/acceptAll/revert)+ 失败态;撤销可逆,复用 artifact-canvas 版本栈
export * from './writing-block'
// D82 就地润色与失败保稿四相位(成功替换草稿 / 失败草稿字节级不变 / 二次可重试;不新建提示词栈)
export * from './prompt-polish'
