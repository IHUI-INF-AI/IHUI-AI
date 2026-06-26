import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'
import { loadModule, getCurrentLocale } from '@/locales'

// 2026-06-26 修复: 路由进入前预加载 i18n 模块，避免键名裸露
function preloadI18n(modules: string[]) {
  return async () => {
    const locale = getCurrentLocale()
    await Promise.all(modules.map(m => loadModule(locale, m).catch(() => undefined)))
  }
}

export const userRoutes: Array<RouteRecordRaw> = [
  {
    path: '/forgot-password',
    name: 'forgotPassword',
    component: safeImport(
      () => import(/* webpackChunkName: "forgot-password" */ '@/views/ForgotPassword.vue'),
      'ForgotPassword'
    ),
    meta: {
      title: 'routes.forgotPassword',
      description: '重置您的账户密码',
      keywords: '忘记密码,重置密码',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['forgotPassword']),
  },
  {
    path: '/phone-binding',
    name: 'phoneBinding',
    component: safeImport(
      () => import(/* webpackChunkName: "phone-binding" */ '@/views/PhoneBinding.vue'),
      'PhoneBinding'
    ),
    meta: {
      title: 'routes.phoneBinding',
      description: '绑定手机号，用于验证与找回',
      keywords: '手机号绑定,验证码',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['phoneBinding']),
  },
  {
    path: '/user',
    name: 'user',
    component: safeImport(() => import(/* webpackChunkName: "user" */ '@/views/User.vue'), 'User'),
    meta: {
      title: 'routes.user',
      description: 'seo.user.desc',
      keywords: 'seo.user.keywords',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['user']),
  },
  {
    path: '/user-center',
    name: 'userCenter',
    component: safeImport(
      () => import(/* webpackChunkName: "user-center" */ '@/views/UserCenter.vue'),
      'UserCenter'
    ),
    meta: {
      title: 'routes.userCenter',
      description: '智汇AI用户中心',
      keywords: '用户中心,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['userCenter']),
  },
  {
    path: '/vip-membership',
    name: 'vipMembership',
    component: safeImport(
      () => import(/* webpackChunkName: "vip-membership" */ '@/views/VIPMembership.vue'),
      'VIPMembership'
    ),
    meta: {
      title: 'VIP会员',
      description: '智汇AI VIP会员',
      keywords: 'VIP,会员,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['vipMembership']),
  },
  {
    path: '/distribution-center',
    name: 'distributionCenter',
    component: safeImport(
      () => import(/* webpackChunkName: "distribution-center" */ '@/views/DistributionCenter.vue'),
      'DistributionCenter'
    ),
    meta: {
      title: 'routes.distributionCenter',
      description: '智汇AI分销中心',
      keywords: '分销,中心,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['distributionCenter']),
  },
  {
    path: '/recharge',
    name: 'recharge',
    component: safeImport(
      () => import(/* webpackChunkName: "recharge" */ '@/views/Recharge.vue'),
      'Recharge'
    ),
    meta: {
      title: 'routes.recharge',
      description: '智汇AI充值',
      keywords: '充值,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['recharge']),
  },
  {
    path: '/withdrawal',
    name: 'withdrawal',
    component: safeImport(
      () => import(/* webpackChunkName: "withdrawal" */ '@/views/Withdrawal.vue'),
      'Withdrawal'
    ),
    meta: {
      title: '提现',
      description: '智汇AI提现',
      keywords: '提现,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['withdrawal']),
  },
  {
    path: '/wallet',
    name: 'wallet',
    component: safeImport(
      () => import(/* webpackChunkName: "wallet" */ '@/views/Wallet.vue'),
      'Wallet'
    ),
    meta: {
      title: 'routes.wallet',
      description: '智汇AI钱包',
      keywords: '钱包,余额,智汇AI',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['wallet']),
  },
  {
    path: '/customer-service',
    name: 'customerService',
    component: safeImport(
      () => import(/* webpackChunkName: "customer-service" */ '@/views/CustomerService.vue'),
      'CustomerService'
    ),
    meta: {
      title: '客服中心',
      description: '智汇AI客服中心',
      keywords: '客服,在线客服,工单,技术支持',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['customerService']),
  },
  {
    path: '/order-list',
    name: 'orderList',
    component: safeImport(
      () => import(/* webpackChunkName: "order-list" */ '@/views/OrderList.vue'),
      'OrderList'
    ),
    meta: {
      title: 'routes.orders',
      description: '智汇AI订单列表',
      keywords: '订单,列表,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['orderList']),
  },
  {
    path: '/distribution-order-list',
    name: 'distributionOrderList',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "distribution-order-list" */ '@/views/DistributionOrderList.vue'
        ),
      'DistributionOrderList'
    ),
    meta: {
      title: 'routes.distributionOrders',
      description: '智汇AI分销订单',
      keywords: '分销,订单,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['distributionOrderList']),
  },
  {
    path: '/my-commission',
    name: 'myCommission',
    component: safeImport(
      () => import(/* webpackChunkName: "my-commission" */ '@/views/MyCommission.vue'),
      'MyCommission'
    ),
    meta: {
      title: '我的佣金',
      description: '智汇AI我的佣金',
      keywords: '佣金,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['myCommission']),
  },
  {
    path: '/profile',
    name: 'profile',
    component: safeImport(() => import(/* webpackChunkName: "user" */ '@/views/User.vue'), 'User'),
    meta: {
      title: 'routes.user',
      description: 'seo.profile.desc',
      keywords: 'seo.profile.keywords',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['user']),
  },
  {
    // 2026-06-24: 后端 /user/settings/* 已可用, 7 个设置合规子页面 (业务执照/ICP备案/模型备案/使用规范/应用权限/账号注销/更换手机号) 全部就绪, 恢复入口
    path: '/settings',
    name: 'settings',
    component: safeImport(
      () => import(/* webpackChunkName: "settings" */ '@/views/Settings.vue'),
      'Settings'
    ),
    meta: {
      title: 'routes.settings',
      description: 'seo.settings.desc',
      keywords: 'seo.settings.keywords',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['settings']),
  },
  // ============ 设置与合规子页面（多端互通，对齐 miniapp pagesA/settings）============
  {
    path: '/settings/business-license',
    name: 'settingsBusinessLicense',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "settings-business-license" */ '@/views/settings/BusinessLicense.vue'),
      'BusinessLicense'
    ),
    meta: {
      title: '营业执照',
      description: '查看平台营业执照信息',
      keywords: '营业执照,合规,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['settings']),
  },
  {
    path: '/settings/icp-record',
    name: 'settingsIcpRecord',
    component: safeImport(
      () => import(/* webpackChunkName: "settings-icp-record" */ '@/views/settings/IcpRecord.vue'),
      'IcpRecord'
    ),
    meta: {
      title: 'ICP备案',
      description: '查看平台ICP备案信息',
      keywords: 'ICP备案,合规,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['settings']),
  },
  {
    path: '/settings/model-record',
    name: 'settingsModelRecord',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "settings-model-record" */ '@/views/settings/ModelRecord.vue'),
      'ModelRecord'
    ),
    meta: {
      title: '模型备案',
      description: '查看生成式人工智能服务模型备案信息',
      keywords: '模型备案,合规,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['settings']),
  },
  {
    path: '/settings/usage-rules',
    name: 'settingsUsageRules',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "settings-usage-rules" */ '@/views/settings/UsageRules.vue'),
      'UsageRules'
    ),
    meta: {
      title: '使用规范',
      description: '查看平台使用规范与条款',
      keywords: '使用规范,服务条款,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['settings']),
  },
  {
    path: '/settings/app-permission',
    name: 'settingsAppPermission',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "settings-app-permission" */ '@/views/settings/AppPermission.vue'),
      'AppPermission'
    ),
    meta: {
      title: '应用权限说明',
      description: '查看应用所需权限说明',
      keywords: '应用权限,隐私,智汇AI',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['settings']),
  },
  {
    path: '/settings/account-cancel',
    name: 'settingsAccountCancel',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "settings-account-cancel" */ '@/views/settings/AccountCancel.vue'),
      'AccountCancel'
    ),
    meta: {
      title: '账号注销',
      description: '申请注销账号',
      keywords: '账号注销,注销,智汇AI',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['settings']),
  },
  {
    path: '/settings/change-phone',
    name: 'settingsChangePhone',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "settings-change-phone" */ '@/views/settings/ChangePhone.vue'),
      'ChangePhone'
    ),
    meta: {
      title: '更换手机号',
      description: '更换绑定的手机号',
      keywords: '更换手机号,手机号,智汇AI',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['settings']),
  },
  {
    path: '/key-management',
    name: 'keyManagement',
    component: safeImport(
      () => import(/* webpackChunkName: "key-management" */ '@/views/KeyManagement.vue'),
      'KeyManagement'
    ),
    meta: {
      title: 'routes.keyManagement',
      description: 'API Key 创建、查看与删除',
      keywords: '密钥管理,API Key',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['keyManagement']),
  },
  {
    path: '/vip',
    name: 'vip',
    component: safeImport(() => import(/* webpackChunkName: "vip" */ '@/views/Vip.vue'), 'Vip'),
    meta: {
      title: 'routes.vip',
      description: 'seo.vip.desc',
      keywords: 'seo.vip.keywords',
    },
    beforeEnter: preloadI18n(['vip']),
  },
  {
    path: '/vip/trader',
    name: 'vipTrader',
    component: safeImport(
      () => import(/* webpackChunkName: "vip-trader" */ '@/views/VipTrader.vue'),
      'VipTrader'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.becomeTrader',
      description: '申请成为操盘手，享受更多权益',
      keywords: '操盘手,申请,VIP',
    },
    beforeEnter: preloadI18n(['vipTrader']),
  },
  {
    path: '/business-card',
    name: 'businessCard',
    component: safeImport(
      () => import(/* webpackChunkName: "business-card" */ '@/views/BusinessCard.vue'),
      'BusinessCard'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.personalCard',
      description: '展示您的个人信息和联系方式',
      keywords: '个人名片,分享',
    },
    beforeEnter: preloadI18n(['businessCard']),
  },
  {
    path: '/orders',
    name: 'orders',
    component: safeImport(
      () => import(/* webpackChunkName: "orders" */ '@/views/Orders.vue'),
      'Orders'
    ),
    meta: {
      title: 'routes.orders',
      description: 'seo.orders.desc',
      keywords: 'seo.orders.keywords',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['orders']),
  },
  {
    path: '/orders/:id',
    name: 'orderDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "order-detail" */ '@/views/OrderDetail.vue'),
      'OrderDetail'
    ),
    meta: {
      title: 'routes.orderDetail',
      description: 'seo.orderDetail.desc',
      keywords: 'seo.orderDetail.keywords',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['orders', 'orderDetail']),
  },
  {
    path: '/refunds',
    name: 'refundManagement',
    component: safeImport(
      () => import(/* webpackChunkName: "refund-management" */ '@/views/RefundManagement.vue'),
      'RefundManagement'
    ),
    meta: {
      title: 'routes.refundManagement',
      description: 'seo.refundManagement.desc',
      keywords: 'seo.refundManagement.keywords',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['refundManagement']),
  },
  {
    path: '/refunds/:refundNo',
    name: 'refundDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "refund-detail" */ '@/views/RefundDetail.vue'),
      'RefundDetail'
    ),
    meta: {
      title: 'routes.refundDetail',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['refundDetail']),
  },
  {
    path: '/refund',
    name: 'refund',
    component: safeImport(
      () => import(/* webpackChunkName: "refund" */ '@/views/Refund.vue'),
      'Refund'
    ),
    meta: {
      title: 'routes.refund',
      description: 'seo.refund.desc',
      keywords: 'seo.refund.keywords',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['refund']),
  },
  {
    path: '/distribution',
    name: 'distribution',
    component: safeImport(
      () => import(/* webpackChunkName: "distribution" */ '@/views/Distribution.vue'),
      'Distribution'
    ),
    meta: {
      title: 'routes.distribution',
      description: 'seo.distribution.desc',
      keywords: 'seo.distribution.keywords',
    },
    beforeEnter: preloadI18n(['distribution']),
  },
  {
    path: '/distribution/company',
    name: 'distributionCompany',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "distribution-company" */ '@/views/DistributionCompany.vue'),
      'DistributionCompany'
    ),
    meta: {
      requiresAuth: true,
      title: '我的公司',
      description: '管理您的分销公司和团队',
      keywords: '分销,公司,团队管理',
    },
    beforeEnter: preloadI18n(['distribution']),
  },
  {
    path: '/distribution/team',
    name: 'distributionTeam',
    component: safeImport(
      () => import(/* webpackChunkName: "distribution-team" */ '@/views/DistributionTeam.vue'),
      'DistributionTeam'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.invitedTeam',
      description: '查看和管理我邀请的团队成员',
      keywords: '分销,团队,邀请',
    },
    beforeEnter: preloadI18n(['distribution']),
  },
  {
    path: '/distribution/team/:id',
    name: 'distributionTeamDetail',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "distribution-team-detail" */ '@/views/DistributionTeamDetail.vue'
        ),
      'DistributionTeamDetail'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.subordinateDetail',
      description: '查看下级成员的详细信息',
      keywords: '分销,团队成员,详情',
    },
    beforeEnter: preloadI18n(['distribution']),
  },
  {
    path: '/distribution/orders',
    name: 'distributionOrders',
    component: safeImport(
      () => import(/* webpackChunkName: "distribution-orders" */ '@/views/DistributionOrders.vue'),
      'DistributionOrders'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.distributionOrderList',
      description: '查看我的分销订单',
      keywords: '分销,订单,列表',
    },
    beforeEnter: preloadI18n(['distribution']),
  },
  {
    path: '/commission/plan',
    name: 'commissionPlan',
    component: safeImport(
      () => import(/* webpackChunkName: "commission-plan" */ '@/views/CommissionPlan.vue'),
      'CommissionPlan'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.commissionPlan',
      description: '邀请好友，赚取佣金',
      keywords: '分佣,佣金,邀请',
    },
    beforeEnter: preloadI18n(['commissionPlan']),
  },
  {
    path: '/token-value',
    name: 'tokenValue',
    component: safeImport(
      () => import(/* webpackChunkName: "token-value" */ '@/views/TokenValue.vue'),
      'TokenValue'
    ),
    meta: {
      requiresAuth: true,
      title: '我的智汇值',
      description: '查看智汇值使用记录和余额',
      keywords: '智汇值,积分,代币',
    },
    beforeEnter: preloadI18n(['tokenValue']),
  },
  {
    path: '/payment',
    name: 'payment',
    component: safeImport(
      () => import(/* webpackChunkName: "payment" */ '@/views/Payment.vue'),
      'Payment'
    ),
    meta: {
      title: 'routes.payment',
      description: 'seo.payment.desc',
      keywords: 'seo.payment.keywords',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['payment']),
  },
  {
    path: '/top-up',
    name: 'topUp',
    component: safeImport(
      () => import(/* webpackChunkName: "top-up" */ '@/views/TopUp.vue'),
      'TopUp'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.accountRecharge',
      description: '为您的账户充值智汇值',
      keywords: '充值,账户充值,智汇值',
    },
    beforeEnter: preloadI18n(['topUp']),
  },
  {
    path: '/top-up/success',
    name: 'topUpSuccess',
    component: safeImport(
      () => import(/* webpackChunkName: "top-up-success" */ '@/views/TopUpSuccess.vue'),
      'TopUpSuccess'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.rechargeSuccess',
      description: '账户充值成功',
      keywords: '充值成功',
    },
    beforeEnter: preloadI18n(['topUp']),
  },
  {
    path: '/top-up/fail',
    name: 'topUpFail',
    component: safeImport(
      () => import(/* webpackChunkName: "top-up-fail" */ '@/views/TopUpFail.vue'),
      'TopUpFail'
    ),
    meta: {
      requiresAuth: true,
      title: '充值失败',
      description: '账户充值失败',
      keywords: '充值失败',
    },
    beforeEnter: preloadI18n(['topUp']),
  },
  {
    path: '/income/commission',
    name: 'traderCommission',
    component: safeImport(
      () => import(/* webpackChunkName: "trader-commission" */ '@/views/TraderCommission.vue'),
      'TraderCommission'
    ),
    meta: {
      requiresAuth: true,
      title: '我的佣金',
      description: '查看您的操盘手佣金详情',
      keywords: '佣金,操盘手,收益',
    },
    beforeEnter: preloadI18n(['traderCommission']),
  },
  {
    path: '/withdraw',
    name: 'withdraw',
    component: safeImport(
      () => import(/* webpackChunkName: "withdrawal" */ '@/views/Withdrawal.vue'),
      'Withdrawal'
    ),
    meta: {
      requiresAuth: true,
      title: '提现',
      description: '申请提现到您的账户',
      keywords: '提现,提款',
    },
    beforeEnter: preloadI18n(['withdrawal']),
  },
  {
    path: '/withdraw/records',
    name: 'withdrawRecords',
    component: safeImport(
      () => import(/* webpackChunkName: "withdraw-records" */ '@/views/WithdrawRecords.vue'),
      'WithdrawRecords'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.withdrawDetail',
      description: '查看您的提现记录',
      keywords: '提现记录,提现明细',
    },
    beforeEnter: preloadI18n(['withdrawal']),
  },
  {
    path: '/vip/details',
    name: 'vipDetails',
    component: safeImport(
      () => import(/* webpackChunkName: "vip-details" */ '@/views/VipDetails.vue'),
      'VipDetails'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.memberDetail',
      description: '选择适合您的会员套餐',
      keywords: 'VIP,会员,套餐',
    },
    beforeEnter: preloadI18n(['vip']),
  },
  {
    path: '/statistics',
    name: 'statistics',
    component: safeImport(
      () => import(/* webpackChunkName: "statistics" */ '@/views/Statistics.vue'),
      'Statistics'
    ),
    meta: {
      title: 'routes.statistics',
      description: 'seo.statistics.desc',
      keywords: 'seo.statistics.keywords',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['statistics']),
  },
  {
    path: '/bi',
    name: 'biDashboard',
    component: safeImport(
      () => import(/* webpackChunkName: "bi-dashboard" */ '@/views/BiDashboard.vue'),
      'BiDashboard'
    ),
    meta: {
      title: '业务自助 BI',
      description: '自助报表、维度下钻与异常归因',
      keywords: 'BI,自助报表,下钻,异常归因',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['biDashboard']),
  },
  {
    path: '/security-audit',
    name: 'securityAudit',
    component: safeImport(
      () => import(/* webpackChunkName: "security-audit" */ '@/views/SecurityAuditDashboard.vue'),
      'SecurityAuditDashboard'
    ),
    meta: {
      title: '安全审计中心',
      description: '越权检测、敏感操作二次验证、异常行为分析',
      keywords: '安全,审计,越权,二次验证,行为分析',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['securityAudit']),
  },
  {
    path: '/i18n',
    name: 'i18nDashboard',
    component: safeImport(
      () => import(/* webpackChunkName: "i18n-dashboard" */ '@/views/I18nDashboard.vue'),
      'I18nDashboard'
    ),
    meta: {
      title: '国际化开发者面板',
      description: '9 种语言元数据、CLDR 复数规则、翻译同步与差异对比',
      keywords: '国际化,i18n,多语言,RTL,阿拉伯语,希伯来语,复数',
      // 2026-06-26: 国际化开发者面板改公开 (无需登录即可访问)
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['i18nDashboard']),
  },
]
