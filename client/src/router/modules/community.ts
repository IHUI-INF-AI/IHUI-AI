import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'
import { loadModule, getCurrentLocale } from '@/locales'

type RedirectTo = { path: string; query: Record<string, string | string[]> }

export const communityRoutes: Array<RouteRecordRaw> = [
  {
    path: '/plaza',
    name: 'plaza',
    component: safeImport(
      () => import(/* webpackChunkName: "plaza" */ '@/views/Plaza.vue'),
      'Plaza'
    ),
    meta: {
      title: 'routes.plaza',
      description: 'seo.plaza.desc',
      keywords: 'seo.plaza.keywords',
    },
  },
  {
    path: '/xuqiu/:id',
    name: 'xuqiuDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "xuqiu-detail" */ '@/views/XuqiuDetail.vue'),
      'XuqiuDetail'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.xuqiuDetail',
      description: '查看需求详情和评论',
      keywords: '需求,详情,评论',
    },
  },
  {
    path: '/xuqiu',
    name: 'xuqiu',
    component: safeImport(
      () => import(/* webpackChunkName: "xuqiu" */ '@/views/Xuqiu.vue'),
      'Xuqiu'
    ),
    meta: {
      title: 'routes.xuqiu',
      description: 'seo.xuqiu.desc',
      keywords: 'seo.xuqiu.keywords',
    },
  },
  {
    path: '/tools-store',
    redirect: (to: RedirectTo) => {
      const toolId = to.query.toolId
      if (toolId && String(toolId).trim()) {
        return { path: `/agents/${String(toolId).trim()}`, query: {} }
      }
      return { path: '/agents', query: {} }
    },
  } as RouteRecordRaw,
  {
    path: '/ai-community',
    name: 'aiCommunity',
    component: safeImport(
      () => import(/* webpackChunkName: "ai-community" */ '@/views/AICommunity.vue'),
      'AICommunity'
    ),
    meta: {
      title: 'routes.aiCommunity',
      description: '智汇AI社区，提供AI对话交互功能',
      keywords: 'AI社区,智汇AI,对话,AI助手',
      requiresAuth: false,
    },
  },
  {
    path: '/courses',
    name: 'courses',
    component: safeImport(
      () => import(/* webpackChunkName: "courses" */ '@/views/Courses.vue'),
      'Courses'
    ),
    meta: {
      title: 'routes.courses',
      description: 'seo.courses.desc',
      keywords: 'seo.courses.keywords',
    },
  },
  {
    path: '/courses/:id',
    name: 'courseDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "course-detail" */ '@/views/CourseDetail.vue'),
      'CourseDetail'
    ),
    meta: {
      title: 'routes.courseDetail',
      description: 'seo.courseDetail.desc',
      keywords: 'seo.courseDetail.keywords',
      requiresAuth: true,
    },
  },
  {
    path: '/community',
    redirect: '/ai-community',
    meta: {
      title: '社区',
      description: '智汇AI社区 - 加入AI爱好者社区，分享经验、交流想法、参与讨论',
      keywords: 'AI社区,人工智能社区,AI交流,AI讨论,智汇AI社区',
    },
  } as RouteRecordRaw,
  {
    path: '/about',
    name: 'about',
    component: safeImport(
      () => import(/* webpackChunkName: "about" */ '@/views/About.vue'),
      'About'
    ),
    meta: {
      title: 'routes.about',
      description: 'seo.about.desc',
      keywords: 'seo.about.keywords',
    },
  },
  {
    path: '/feedback',
    name: 'feedback',
    component: safeImport(
      () => import(/* webpackChunkName: "feedback" */ '@/views/Feedback.vue'),
      'Feedback'
    ),
    meta: {
      title: 'routes.feedback',
      description: 'seo.feedback.desc',
      keywords: 'seo.feedback.keywords',
    },
  },
  {
    path: '/help',
    redirect: '/support/document-center',
    meta: {
      title: '帮助中心',
      description: '智汇AI帮助中心 - 产品使用文档、常见问题解答、技术支持',
      keywords: '帮助中心,使用文档,常见问题,技术支持,智汇AI帮助',
    },
  } as RouteRecordRaw,
  {
    path: '/share',
    name: 'share',
    component: safeImport(
      () => import(/* webpackChunkName: "share" */ '@/views/Share.vue'),
      'Share'
    ),
    meta: {
      title: 'routes.share',
      description: 'seo.share.desc',
      keywords: 'seo.share.keywords',
    },
  },
  {
    path: '/share/:id?',
    name: 'shareDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "share" */ '@/views/Share.vue'),
      'Share'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.share',
      description: '分享内容到各个社交平台',
      keywords: '分享,社交,推广',
    },
  },
  {
    path: '/ai-career',
    name: 'aiCareer',
    component: safeImport(
      () => import(/* webpackChunkName: "ai-career" */ '@/views/AICareer.vue'),
      'AICareer'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.aiCareerGuide',
      description: '为您的孩子提供专业的AI学习指导',
      keywords: 'AI,生涯指导,教育',
    },
  },
  {
    path: '/tech-service',
    name: 'techService',
    component: safeImport(
      () => import(/* webpackChunkName: "tech-service" */ '@/views/TechService.vue'),
      'TechService'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.techService',
      description: '获取专业的技术支持和帮助',
      keywords: '技术服务,支持,帮助',
    },
  },
  {
    path: '/my-appointments',
    name: 'myAppointments',
    component: safeImport(
      () => import(/* webpackChunkName: "my-appointments" */ '@/views/MyAppointments.vue'),
      'MyAppointments'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.myAppointments',
      description: '查看和管理您的服务预约',
      keywords: '预约,服务预约,我的预约',
    },
  },
  {
    path: '/webview',
    name: 'webview',
    component: safeImport(
      () => import(/* webpackChunkName: "webview" */ '@/views/WebView.vue'),
      'WebView'
    ),
    meta: {
      requiresAuth: false,
      title: '外部链接',
      description: '查看外部链接内容',
      keywords: '外部链接,WebView',
    },
  },
  {
    path: '/custom-service',
    name: 'customService',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "custom-service-redirect" */ '@/views/CustomerServiceRedirect.vue'
        ),
      'CustomerServiceRedirect'
    ),
    meta: {
      title: 'routes.customService',
      description: 'seo.customService.desc',
      keywords: 'seo.customService.keywords',
    },
  },
  {
    path: '/enterprise',
    name: 'enterpriseService',
    component: safeImport(
      () => import(/* webpackChunkName: "enterprise" */ '@/views/enterprise/EnterpriseService.vue'),
      'EnterpriseService'
    ),
    meta: {
      title: 'routes.enterpriseService',
      description: '智汇AI社 - AI时代企业理性效率服务与互助社群',
      keywords: '企业AI化,智能体,AI转型,企业服务,智汇AI社',
      requiresAuth: false,
    },
  },
  {
    path: '/enterprise/agent-scenario',
    name: 'agentScenario',
    component: safeImport(
      () => import(/* webpackChunkName: "enterprise" */ '@/views/enterprise/AgentScenario.vue'),
      'AgentScenario'
    ),
    meta: {
      title: 'routes.agentScenario',
      description: '智能体场景罗盘 - 企业AI化智能体应用场景分析框架',
      keywords: '智能体,AI场景,企业AI化,场景罗盘',
      requiresAuth: false,
    },
  },
  {
    path: '/enterprise/human-machine-collaboration',
    name: 'humanMachineCollaboration',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "enterprise" */ '@/views/enterprise/HumanMachineCollaboration.vue'
        ),
      'HumanMachineCollaboration'
    ),
    meta: {
      title: 'routes.humanMachineCollaboration',
      description: '人机协作组织 - 企业AI化服务架构与超级组织',
      keywords: '人机协作,超级员工,超级团队,AI组织',
      requiresAuth: false,
    },
  },
  {
    path: '/learn-ai',
    name: 'learnAI',
    component: safeImport(
      () => import(/* webpackChunkName: "learn-ai" */ '@/views/LearnAI.vue'),
      'LearnAI'
    ),
    meta: {
      title: 'routes.learnAI',
      description: 'seo.learnAI.desc',
      keywords: 'seo.learnAI.keywords',
      requiresAuth: false,
      showFooter: false,
    },
  },
  {
    path: '/learn-ai/:pathMatch(.*)*',
    name: 'learnAIProxy',
    component: safeImport(
      () => import(/* webpackChunkName: "learn-ai" */ '@/views/LearnAI.vue'),
      'LearnAI'
    ),
    meta: {
      title: 'routes.learnAI',
      description: 'seo.learnAI.desc',
      keywords: 'seo.learnAI.keywords',
      requiresAuth: false,
      showFooter: false,
    },
  },
  {
    path: '/privacy-policy',
    redirect: () => ({ path: '/docs', query: { doc: 'privacy-policy' } }),
    meta: {
      title: '隐私政策',
      description: '智汇AI隐私政策 - 了解我们如何收集、使用和保护您的个人信息',
      keywords: '隐私政策,个人信息保护,数据安全,智汇AI隐私',
    },
  } as RouteRecordRaw,
  {
    path: '/terms-of-service',
    redirect: () => ({ path: '/docs', query: { doc: 'terms-of-service' } }),
    meta: {
      title: '服务条款',
      description: '智汇AI服务条款 - 使用我们的服务前请阅读相关条款与条件',
      keywords: '服务条款,使用协议,条款条件,智汇AI服务',
    },
  } as RouteRecordRaw,
  {
    path: '/payment-terms',
    redirect: () => ({ path: '/docs', query: { doc: 'payment-terms' } }),
    meta: {
      title: '支付条款',
      description: '智汇AI支付条款 - 了解支付方式、退款政策与结算规则',
      keywords: '支付条款,退款政策,结算规则,智汇AI支付',
    },
  } as RouteRecordRaw,
  {
    path: '/user-agreement',
    redirect: () => ({ path: '/docs', query: { doc: 'user-agreement' } }),
    meta: {
      title: '用户协议',
      description: '智汇AI用户协议 - 用户注册与使用平台服务的权利与义务',
      keywords: '用户协议,用户权利,用户义务,智汇AI协议',
    },
  } as RouteRecordRaw,
  {
    path: '/support/terms-and-policies',
    redirect: () => ({ path: '/support/document-center', hash: '#terms-and-policies' }),
    meta: {
      title: '条款与政策',
      description: '智汇AI条款与政策中心 - 查看所有服务条款、隐私政策与合规文档',
      keywords: '条款政策,合规文档,服务条款,隐私政策,智汇AI合规',
    },
  } as RouteRecordRaw,
  {
    path: '/support/document-center',
    name: 'documentCenter',
    component: safeImport(
      () => import(/* webpackChunkName: "support" */ '@/views/support/DocumentCenter.vue'),
      'DocumentCenter'
    ),
    meta: {
      title: 'routes.documentCenter',
      description: '完整的技术文档、API 参考和开发指南',
      keywords: '文档,API,开发指南,技术文档',
      requiresAuth: false,
    },
  },
  {
    path: '/about/news-center',
    name: 'newsCenter',
    component: safeImport(
      () => import(/* webpackChunkName: "about" */ '@/views/about/NewsCenter.vue'),
      'NewsCenter'
    ),
    meta: {
      titleKey: 'newsCenter.title',
      description: '了解我们的最新动态、产品更新和行业资讯',
      keywords: '新闻,动态,产品更新,行业资讯',
      requiresAuth: false,
    },
  },
  {
    path: '/about/about-us',
    name: 'aboutUs',
    component: safeImport(
      () => import(/* webpackChunkName: "about" */ '@/views/about/AboutUs.vue'),
      'AboutUs'
    ),
    meta: {
      title: 'routes.aboutUs',
      description: '了解智汇AI，致力于打造最专业的AI服务平台',
      keywords: '关于我们,公司简介,团队',
      requiresAuth: false,
    },
  },
  {
    path: '/about/contact-us',
    name: 'contactUs',
    component: safeImport(
      () => import(/* webpackChunkName: "about" */ '@/views/about/ContactUs.vue'),
      'ContactUs'
    ),
    meta: {
      title: 'routes.contactUs',
      description: '联系智汇AI，获取产品咨询与商务合作',
      keywords: '联系我们,咨询,商务合作',
      requiresAuth: false,
    },
  },
  {
    path: '/about/become-supplier',
    name: 'becomeSupplier',
    component: safeImport(
      () => import(/* webpackChunkName: "about" */ '@/views/about/BecomeSupplier.vue'),
      'BecomeSupplier'
    ),
    meta: {
      title: 'routes.becomeSupplier',
      description: '加入我们的供应商网络，共同为AI生态贡献力量',
      keywords: '供应商,合作,申请',
      requiresAuth: false,
    },
  },
  {
    path: '/messages',
    name: 'messageCenter',
    component: safeImport(
      () => import(/* webpackChunkName: "message-center" */ '@/views/MessageCenter.vue'),
      'MessageCenter'
    ),
    meta: {
      title: 'routes.messageCenter',
      description: '查看站内信、系统消息和公告',
      keywords: '消息,站内信,公告,通知',
      requiresAuth: true,
    },
  },
  {
    path: '/notifications',
    name: 'notificationCenter',
    component: safeImport(
      () => import(/* webpackChunkName: "notification-center" */ '@/views/NotificationCenter.vue'),
      'NotificationCenter'
    ),
    meta: {
      title: 'routes.notificationCenter',
      description: '订单、钱包、系统通知中心',
      keywords: '通知,订单通知,钱包通知',
      requiresAuth: true,
    },
  },
  {
    path: '/points',
    name: 'pointCenter',
    component: safeImport(
      () => import(/* webpackChunkName: "point-center" */ '@/views/PointCenter.vue'),
      'PointCenter'
    ),
    meta: {
      title: 'routes.pointCenter',
      description: '积分账户、签到、积分商城',
      keywords: '积分,签到,积分商城,兑换',
      requiresAuth: true,
    },
  },
  {
    path: '/search',
    name: 'search',
    component: safeImport(
      () => import(/* webpackChunkName: "search" */ '@/views/Search.vue'),
      'Search'
    ),
    meta: {
      title: 'routes.search',
      description: '搜索智能体、课程、内容',
      keywords: '搜索,智能体搜索,课程搜索',
      requiresAuth: false,
    },
    beforeEnter: async () => {
      // 预加载 search i18n 模块，确保页面渲染时翻译键已就绪
      await loadModule(getCurrentLocale(), 'search')
    },
  },
  {
    path: '/ask',
    name: 'askList',
    component: safeImport(
      () => import(/* webpackChunkName: "ask-list" */ '@/views/AskList.vue'),
      'AskList'
    ),
    meta: {
      title: 'routes.askList',
      description: 'AI 问答社区 - 提问、解答、知识分享',
      keywords: '问答,AI问答,知识分享',
      requiresAuth: false,
    },
  },
  {
    path: '/ask/:id(\\d+)',
    name: 'askDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "ask-detail" */ '@/views/AskDetail.vue'),
      'AskDetail'
    ),
    meta: {
      title: 'routes.askDetail',
      description: '问题详情 / 回答 / 采纳',
      keywords: '问答详情,AI问答',
      requiresAuth: false,
    },
  },
  {
    path: '/circle',
    name: 'circleList',
    component: safeImport(
      () => import(/* webpackChunkName: "circle-list" */ '@/views/CircleList.vue'),
      'CircleList'
    ),
    meta: {
      title: 'routes.circleList',
      description: '兴趣圈子 - 发现同好、加入交流',
      keywords: '圈子,兴趣社区,同好',
      requiresAuth: false,
    },
  },
  {
    path: '/circle/:id(\\d+)',
    name: 'circleDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "circle-detail" */ '@/views/CircleDetail.vue'),
      'CircleDetail'
    ),
    meta: {
      title: 'routes.circleDetail',
      description: '圈子详情 / 动态 / 成员',
      keywords: '圈子详情,动态',
      requiresAuth: false,
    },
  },
  {
    path: '/exam',
    name: 'examList',
    component: safeImport(
      () => import(/* webpackChunkName: "exam-list" */ '@/views/ExamList.vue'),
      'ExamList'
    ),
    meta: {
      title: 'routes.examList',
      description: '考试中心 - 试卷练习 / 错题本 / 考试记录',
      keywords: '考试,试卷,错题本',
      requiresAuth: false,
    },
  },
  {
    path: '/exam/:id(\\d+)',
    name: 'examDo',
    component: safeImport(
      () => import(/* webpackChunkName: "exam-do" */ '@/views/ExamDo.vue'),
      'ExamDo'
    ),
    meta: {
      title: 'routes.examDo',
      description: '在线考试',
      keywords: '在线考试,答题',
      requiresAuth: true,
    },
  },
  {
    path: '/ranking',
    name: 'ranking',
    component: safeImport(
      () => import(/* webpackChunkName: "ranking" */ '@/views/Ranking.vue'),
      'Ranking'
    ),
    meta: {
      title: 'routes.ranking',
      description: '排行榜 - 积分/学习/智能体',
      keywords: '排行榜,积分榜,热度榜',
      requiresAuth: false,
    },
  },
]
