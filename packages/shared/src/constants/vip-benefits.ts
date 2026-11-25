// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VIP 权益 `key → 中文标签` 的**单一真相源**。
 *
 * 为什么必须有这份表:数据库 `vip_levels.benefits` 存的是英文 key
 * (`unlimitedChat` / `exclusiveModel` / `testPaymentFlow` …),而 `GET /api/vip/levels`
 * 原样下发。任何端把 key 直接当标题渲染,用户看到的就是裸键名 ——
 * 2026-11-26 小程序 VIP 页「权益详情」实测正是这种形态(`testPaymentFlow`、`unlimitedChat`)。
 *
 * 文案原稿取自 `apps/api/src/routes/landing.ts` 的 `benefitLabel` 映射(落地页一直在用),
 * 这里收成共享常量,端上不再各自抄一份;`testPaymentFlow` 是落地页表里缺的一条,本表补齐。
 *
 * 未知 key **原样返回**:不造词,便于第一时间发现后端新增了未登记的权益。
 * 后端如新增权益,应同时在此登记中文标签。
 */
export const VIP_BENEFIT_LABELS: Readonly<Record<string, string>> = {
  unlimitedChat: '无限 AI 对话',
  exclusiveModel: '独享高级模型',
  prioritySupport: '优先客服支持',
  referral: '推荐返佣资格',
  lifetime: '终身权益',
  distributionQualification: '分销资格',
  aiCourses: 'AI 课程访问',
  founderQa: '创始人问答',
  agentBeta: 'Agent 内测',
  vipMaxDiscount: 'VIP 最大折扣',
  customAgentDiscount: '定制 Agent 折扣',
  allVipRights: '全部 VIP 权益',
  verticalAccountIncubation: '垂直账号孵化',
  secondaryDistribution: '二级分销',
  offlineLearning: '线下学习',
  testPaymentFlow: '支付流程测试',
}

/**
 * 把权益 key 转成展示文案。命中映射返回中文,未命中原样返回 key。
 * 纯函数、无 IO,三端(node / RN / Taro / web)共用同一份判据。
 */
export function vipBenefitLabel(key: string): string {
  const trimmed = key.trim()
  return VIP_BENEFIT_LABELS[trimmed] ?? trimmed
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
