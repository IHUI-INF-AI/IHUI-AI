import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'

export const userRoutes: Array<RouteRecordRaw> = [
  {
    path: '/oauth/authorize',
    name: 'oauthAuthorize',
    component: safeImport(
      () => import(/* webpackChunkName: "oauth-authorize" */ '@/views/OAuthAuthorize.vue'),
      'OAuthAuthorize'
    ),
    meta: {
      title: 'OAuth 授权确认',
      description: '第三方应用授权确认页面',
      keywords: 'OAuth,授权,确认',
      requiresAuth: true,
    },
  },
  {
    path: '/oauth/my-authorized',
    name: 'oauthMyAuthorized',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "oauth-my-authorized" */ '@/views/OAuthMyAuthorized.vue'),
      'OAuthMyAuthorized'
    ),
    meta: {
      title: '已授权应用管理',
      description: '管理您已授权的第三方 OAuth 应用',
      keywords: 'OAuth,已授权,应用管理',
      requiresAuth: true,
    },
  },
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
  },
  {
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
      requiresAuth: true,
    },
  },
]
