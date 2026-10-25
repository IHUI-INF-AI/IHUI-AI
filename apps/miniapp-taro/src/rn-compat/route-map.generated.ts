// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ⚠️ 生成物,请勿手改 —— 重新生成:`node scripts/gen-rn-compat.mjs --write`
 *
 * RN 路由名 → 小程序页面路径。判据 = RN 导航器的 Screen 登记 ∪ 跨端登记表的 rn↔miniapp 对,
 * 两条现读事实 join(取名规则猜路径必然漂移)。不在表里的路由名 = 小程序端尚无对应页,
 * 由 rn-compat/navigation 运行时点名"这一跳未执行",绝不跳到一个像的名字上去。
 */
export const RN_ROUTE_MAP: Record<string, string> = {
  AccountCancel: '/pkg-user/account-cancel/index',
  AccountPool: '/pkg-user/account-pool/index',
  AiAssistant: '/pkg-ai/ai-assistant/index',
  AiAssistantN8n: '/pkg-ai/ai-assistant-n8n/index',
  AiCareer: '/pkg-ai/ai-career/index',
  AiGroup: '/pkg-ai/ai-group/index',
  AigcList: '/pkg-ai/aigc/list',
  AigcPublish: '/pkg-ai/aigc/publish',
  AppTopup: '/pkg-shop/wallet/recharge/index',
  Assistant: '/pkg-ai/agent-dialogue/index',
  BusinessCard: '/pkg-ai/business-card/index',
  Carte: '/pkg-learn/course-planet/index',
  CategoryDetail: '/pkg-content/category-detail/index',
  ChangePwd: '/pkg-user/user/password',
  DistributionOrderList: '/pages/distribution/order-list/index',
  EarnCommission: '/pages/distribution/plan/index',
  EduShop: '/pkg-shop/edu-shop/index',
  Income: '/pkg-shop/wallet/commission/index',
  LlmSettings: '/pkg-user/llm-settings/index',
  ModelEdit: '/pkg-ai/dev-enter/model-edit/index',
  ModelIncome: '/pkg-ai/developer/income',
  ModelPlaza: '/pkg-ai/model-plaza/index',
  News: '/pages/plaza/index/index',
  RankingDetail: '/pkg-ai/ranking/index',
  Recharge: '/pkg-shop/wallet/recharge/index',
  Recruitment: '/pkg-content/recruitment/index/index',
  Settings: '/pages/setting/index',
  StudyIndex: '/pages/study/index',
  StudyPublish: '/pages/study/publish/index',
  TopupSuccess: '/pkg-shop/vip/success',
  UserFans: '/pkg-user/fans/index',
  UserPublic: '/pkg-user/user-public/index',
  VipTrader: '/pkg-shop/vip-trader/index/index',
  WrongQuestions: '/pages/exam/wrong-list/index',
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
