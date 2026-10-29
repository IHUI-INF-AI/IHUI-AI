// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebView 功能门户配置(M4 方案,跨端单一真相源,2026-10-18 立)
 *
 * 背景:移动端 apps/mobile-rn 已有通用 WebViewScreen(M4 方案 2026-08-26 立),
 * 用法 navigation.navigate('WebView', { url, title });小程序对等物是
 * pages/webview 承载页 + pkg-about/web-portal 门户页。两端共用本配置,
 * 避免"同一功能域两份清单必然漂移"(AGENTS.md §0.6 单一真相源)。
 *
 * 约定:
 * - path 与 apps/web/app/(main) 下的真实路由一致((main) 为 Next.js 路由组,URL 不含它)
 * - titleKey 为 i18n key 名,统一置于 webViewPortal 命名空间;端内语言包未覆盖时
 *   由 fallbackLabel(中文)兜底,保证不裸 key 上屏
 * - key 全局唯一,采用 <domain>-<page> 连字符格式
 * - SEO/多语言获客页(compare/use-cases/en/ja/ko/blog)刻意不收:app 内无搜索引擎,
 *   这类页面对壳端(desktop/mobile-cap 即 web 本身)无意义;功能型缺口才进门户。
 */

// 守门 70 的内容文案声明式出口:本文件整份是「条目 → 标签」台账,fallbackLabel 按上面头注的
// 约定**必然**是中文兜底串(真界面取词走 webViewPortal.* 五语言键,缺键才用它),不是界面 chrome。
// i18n-content-exempt-file: 门户标签台账,fallbackLabel 是约定好的中文兜底串,界面取词在五语言词包 until 2027-04-20
export interface WebPortalEntry {
  /** 全局唯一标识(domain 前缀 + 页面,连字符分隔) */
  key: string
  /** i18n key 名,端内语言包缺键时回落 fallbackLabel */
  titleKey: string
  /** 相对路径,与 web 端 (main) 路由一致,不含 (main) */
  path: string
  /** 功能域名,如 'edu-ai' */
  domain: string
  /** 中文兜底标签(语言包未覆盖该键时显示) */
  fallbackLabel: string
}

export interface WebPortalSection {
  /** 分组标题的 i18n key 名 */
  titleKey: string
  /** 分组标题的中文兜底标签(语言包未覆盖该键时显示,与条目 fallbackLabel 同机制) */
  fallbackLabel: string
  /** 该分组下的门户条目 */
  entries: readonly WebPortalEntry[]
}

/**
 * 门户分组配置:覆盖移动端未原生实现的全部复杂功能域
 */
export const WEB_PORTAL_SECTIONS = [
  {
    titleKey: 'webViewPortal.sections.eduAi',
    fallbackLabel: 'AI 教育',
    entries: [
      {
        key: 'edu-ai-policy',
        titleKey: 'webViewPortal.eduAi.policy',
        path: '/edu-ai/policy',
        domain: 'edu-ai',
        fallbackLabel: '政策解读',
      },
      {
        key: 'edu-ai-certification',
        titleKey: 'webViewPortal.eduAi.certification',
        path: '/edu-ai/certification',
        domain: 'edu-ai',
        fallbackLabel: '认证中心',
      },
      {
        key: 'edu-ai-courses',
        titleKey: 'webViewPortal.eduAi.courses',
        path: '/edu-ai/courses',
        domain: 'edu-ai',
        fallbackLabel: '课程中心',
      },
      {
        key: 'edu-ai-aigc-tools',
        titleKey: 'webViewPortal.eduAi.aigcTools',
        path: '/edu-ai/aigc-tools',
        domain: 'edu-ai',
        fallbackLabel: 'AIGC 工具',
      },
      {
        key: 'edu-ai-map',
        titleKey: 'webViewPortal.eduAi.map',
        path: '/edu-ai/map',
        domain: 'edu-ai',
        fallbackLabel: '学习地图',
      },
      {
        key: 'edu-ai-marking',
        titleKey: 'webViewPortal.eduAi.marking',
        path: '/edu-ai/marking',
        domain: 'edu-ai',
        fallbackLabel: 'AI 批改',
      },
      {
        key: 'edu-ai-outbound',
        titleKey: 'webViewPortal.eduAi.outbound',
        path: '/edu-ai/outbound',
        domain: 'edu-ai',
        fallbackLabel: '智能外呼',
      },
      {
        key: 'edu-ai-tbox',
        titleKey: 'webViewPortal.eduAi.tbox',
        path: '/edu-ai/tbox',
        domain: 'edu-ai',
        fallbackLabel: 'T-Box',
      },
      {
        key: 'edu-ai-video-compose',
        titleKey: 'webViewPortal.eduAi.videoCompose',
        path: '/edu-ai/video-compose',
        domain: 'edu-ai',
        fallbackLabel: '视频合成',
      },
      {
        key: 'edu-ai-voice',
        titleKey: 'webViewPortal.eduAi.voice',
        path: '/edu-ai/voice',
        domain: 'edu-ai',
        fallbackLabel: 'AI 语音',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.edu',
    fallbackLabel: '教务管理',
    entries: [
      {
        key: 'edu-schedule-management',
        titleKey: 'webViewPortal.eduManagement.schedule',
        path: '/edu/edu-management/schedule',
        domain: 'edu',
        fallbackLabel: '排课管理',
      },
      {
        key: 'edu-attendance',
        titleKey: 'webViewPortal.eduManagement.attendance',
        path: '/edu/edu-management/attendance',
        domain: 'edu',
        fallbackLabel: '考勤管理',
      },
      {
        key: 'edu-grades',
        titleKey: 'webViewPortal.eduManagement.grades',
        path: '/edu/edu-management/grades',
        domain: 'edu',
        fallbackLabel: '成绩管理',
      },
      {
        key: 'edu-homework',
        titleKey: 'webViewPortal.eduManagement.homework',
        path: '/edu/edu-management/homework',
        domain: 'edu',
        fallbackLabel: '作业管理',
      },
      {
        key: 'edu-canteen-procurement',
        titleKey: 'webViewPortal.eduManagement.canteenProcurement',
        path: '/edu/edu-management/procurement',
        domain: 'edu',
        fallbackLabel: '食堂采购记账',
      },
      {
        key: 'edu-parent',
        titleKey: 'webViewPortal.eduParent',
        path: '/edu/parent',
        domain: 'edu',
        fallbackLabel: '家长端',
      },
      {
        key: 'edu-timetable',
        titleKey: 'webViewPortal.eduSchedule',
        path: '/edu/schedule',
        domain: 'edu',
        fallbackLabel: '课表',
      },
      {
        key: 'edu-points',
        titleKey: 'webViewPortal.eduPoints',
        path: '/edu-points',
        domain: 'edu',
        fallbackLabel: '教育积分',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.developer',
    fallbackLabel: '开发者平台',
    entries: [
      {
        key: 'developer-keys',
        titleKey: 'webViewPortal.developer.keys',
        path: '/developer/keys',
        domain: 'developer',
        fallbackLabel: 'API 密钥',
      },
      {
        key: 'developer-api-docs',
        titleKey: 'webViewPortal.developer.apiDocs',
        path: '/developer/api-docs',
        domain: 'developer',
        fallbackLabel: 'API 文档',
      },
      {
        key: 'developer-webhooks',
        titleKey: 'webViewPortal.developer.webhooks',
        path: '/developer/webhooks',
        domain: 'developer',
        fallbackLabel: 'Webhook',
      },
      {
        key: 'developer-logs',
        titleKey: 'webViewPortal.developer.logs',
        path: '/developer/logs',
        domain: 'developer',
        fallbackLabel: '调用日志',
      },
      {
        key: 'developer-billing',
        titleKey: 'webViewPortal.developer.billing',
        path: '/developer/billing',
        domain: 'developer',
        fallbackLabel: '账单',
      },
      {
        key: 'developer-relay',
        titleKey: 'webViewPortal.developer.relay',
        path: '/developer/relay',
        domain: 'developer',
        fallbackLabel: 'Relay 网关',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.selfMedia',
    fallbackLabel: '自媒体运营',
    entries: [
      {
        key: 'self-media-koubo',
        titleKey: 'webViewPortal.selfMedia.koubo',
        path: '/self-media/koubo',
        domain: 'self-media',
        fallbackLabel: '口播稿',
      },
      {
        key: 'self-media-wechat',
        titleKey: 'webViewPortal.selfMedia.wechat',
        path: '/self-media/wechat',
        domain: 'self-media',
        fallbackLabel: '公众号',
      },
      {
        key: 'self-media-automation',
        titleKey: 'webViewPortal.selfMedia.automation',
        path: '/self-media/automation',
        domain: 'self-media',
        fallbackLabel: '自动化',
      },
      {
        key: 'publish-analytics',
        titleKey: 'webViewPortal.publish.analytics',
        path: '/publish/analytics',
        domain: 'self-media',
        fallbackLabel: '发布分析',
      },
      {
        key: 'publish-calendar',
        titleKey: 'webViewPortal.publish.calendar',
        path: '/publish/calendar',
        domain: 'self-media',
        fallbackLabel: '发布日历',
      },
      {
        key: 'self-media-tasks',
        titleKey: 'webViewPortal.mediaTasks',
        path: '/media-tasks',
        domain: 'self-media',
        fallbackLabel: '媒体任务',
      },
      {
        key: 'self-voices',
        titleKey: 'webViewPortal.voices',
        path: '/voices',
        domain: 'self-media',
        fallbackLabel: '语音资源',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.knowledgeTools',
    fallbackLabel: '知识与工具',
    entries: [
      {
        key: 'knowledge-graph',
        titleKey: 'webViewPortal.knowledgeGraph',
        path: '/knowledge-graph',
        domain: 'knowledge-graph',
        fallbackLabel: '知识图谱',
      },
      // web `/knowledge` 是「按语义搜索检索记忆库里的知识」那张页(knowledgeList 命名空间),
      // 与本端原生 KnowledgeBase(RAG 知识库)不是同一件事 ⇒ 门户承接,不另造第三张屏。
      {
        key: 'knowledge-base',
        titleKey: 'webViewPortal.knowledgeBase',
        path: '/knowledge',
        domain: 'knowledge',
        fallbackLabel: '知识库',
      },
      {
        key: 'tools-voice-stt',
        titleKey: 'webViewPortal.tools.voiceStt',
        path: '/tools/voice-stt',
        domain: 'tools',
        fallbackLabel: '语音转文字',
      },
      {
        key: 'resources',
        titleKey: 'webViewPortal.resources',
        path: '/resources',
        domain: 'resources',
        fallbackLabel: '资源库',
      },
      {
        key: 'stock',
        titleKey: 'webViewPortal.stock',
        path: '/stock',
        domain: 'stock',
        fallbackLabel: '股票行情',
      },
      {
        key: 'fund-data',
        titleKey: 'webViewPortal.fundData',
        path: '/fund-data',
        domain: 'fund-data',
        fallbackLabel: '基金行情',
      },
      {
        key: 'knowledge-cards',
        titleKey: 'webViewPortal.knowledgeCards',
        path: '/knowledge-cards',
        domain: 'knowledge-graph',
        fallbackLabel: '知识卡片',
      },
      {
        key: 'knowledge-planet',
        titleKey: 'webViewPortal.knowledgePlanet',
        path: '/knowledge-planet',
        domain: 'knowledge-graph',
        fallbackLabel: '知识星球',
      },
      {
        key: 'web-tools',
        titleKey: 'webViewPortal.webTools',
        path: '/web-tools',
        domain: 'knowledge-graph',
        fallbackLabel: '网页工具',
      },
      {
        key: 'learnTopic',
        titleKey: 'webViewPortal.learnTopic',
        path: '/learn/topic',
        domain: 'learn',
        fallbackLabel: '课程专题',
      },
      {
        key: 'kbSearch',
        titleKey: 'webViewPortal.kbSearch',
        path: '/knowledge-base/search',
        domain: 'knowledge-base',
        fallbackLabel: '知识库检索',
      },
      {
        key: 'skillsMarketHome',
        titleKey: 'webViewPortal.skillsMarketHome',
        path: '/skills/market',
        domain: 'skills',
        fallbackLabel: '技能广场',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.workspace',
    fallbackLabel: '工作区',
    entries: [
      {
        key: 'workspace-dashboard',
        titleKey: 'webViewPortal.workspace',
        path: '/workspace',
        domain: 'workspace',
        fallbackLabel: '工作区',
      },
      {
        key: 'workspace-permissions',
        titleKey: 'webViewPortal.workspacePermissions',
        path: '/workspace/permissions',
        domain: 'workspace',
        fallbackLabel: '工作区权限',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.models',
    fallbackLabel: '模型管理',
    entries: [
      {
        key: 'models-overview',
        titleKey: 'webViewPortal.models.overview',
        path: '/models/overview',
        domain: 'models',
        fallbackLabel: '模型总览',
      },
      {
        key: 'models-keys',
        titleKey: 'webViewPortal.models.keys',
        path: '/models/keys',
        domain: 'models',
        fallbackLabel: '模型密钥',
      },
      {
        key: 'models-usage',
        titleKey: 'webViewPortal.models.usage',
        path: '/models/usage',
        domain: 'models',
        fallbackLabel: '用量统计',
      },
      {
        key: 'models-prompts',
        titleKey: 'webViewPortal.models.prompts',
        path: '/models/prompts',
        domain: 'models',
        fallbackLabel: 'Prompt 管理',
      },
      {
        key: 'models-eval',
        titleKey: 'webViewPortal.models.eval',
        path: '/models/eval',
        domain: 'models',
        fallbackLabel: '模型评测',
      },
      {
        key: 'aiGeneration',
        titleKey: 'webViewPortal.aiGeneration',
        path: '/ai-generation',
        domain: 'ai-generation',
        fallbackLabel: 'AI 生成',
      },
      {
        key: 'videoTasks',
        titleKey: 'webViewPortal.videoTasks',
        path: '/ai-generation/video-tasks',
        domain: 'ai-generation',
        fallbackLabel: '视频任务',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.more',
    fallbackLabel: '更多功能',
    entries: [
      {
        key: 'tags',
        titleKey: 'webViewPortal.tags',
        path: '/tags',
        domain: 'community',
        fallbackLabel: '标签',
      },
      {
        key: 'topics',
        titleKey: 'webViewPortal.topics',
        path: '/topics',
        domain: 'community',
        fallbackLabel: '话题',
      },
      {
        key: 'context',
        titleKey: 'webViewPortal.context',
        path: '/context',
        domain: 'ai',
        fallbackLabel: '上下文管理',
      },
      {
        key: 'traders',
        titleKey: 'webViewPortal.traders',
        path: '/traders',
        domain: 'community',
        fallbackLabel: '交易员',
      },
      {
        key: 'members',
        titleKey: 'webViewPortal.members',
        path: '/members',
        domain: 'community',
        fallbackLabel: '会员列表',
      },
      {
        key: 'lecturers',
        titleKey: 'webViewPortal.lecturers',
        path: '/lecturers',
        domain: 'edu',
        fallbackLabel: '讲师',
      },
      {
        key: 'tools-pdf',
        titleKey: 'webViewPortal.tools.pdf',
        path: '/tools/pdf',
        domain: 'tools',
        fallbackLabel: 'PDF 工具',
      },
      {
        key: 'oauth-authorized',
        titleKey: 'webViewPortal.oauth.authorized',
        path: '/oauth/my-authorized',
        domain: 'oauth',
        fallbackLabel: '授权管理',
      },
      {
        key: 'enterprise',
        titleKey: 'webViewPortal.enterprise',
        path: '/enterprise',
        domain: 'enterprise',
        fallbackLabel: '企业服务',
      },
      {
        key: 'feature-center',
        titleKey: 'webViewPortal.featureCenter',
        path: '/feature-center',
        domain: 'feature-center',
        fallbackLabel: '能力中心',
      },
      // 账户账单/发票(web settings.billingTitle 那张)。与上面开发者组的 /developer/billing
      // 不是同一页:那张是 API 消费账单,这张是账户订单与发票。
      {
        key: 'settings-billing',
        titleKey: 'webViewPortal.settingsBilling',
        path: '/settings/billing',
        domain: 'settings',
        fallbackLabel: '账单管理',
      },
      // 2026-10-27:RN 面判过「零承载」的功能页按头注约定进门户,而不是各端再搓一份原生屏。
      {
        key: 'letters',
        titleKey: 'webViewPortal.letters',
        path: '/letters',
        domain: 'letters',
        fallbackLabel: '站内信',
      },
      {
        key: 'invitations',
        titleKey: 'webViewPortal.invitations',
        path: '/invitations',
        domain: 'invitations',
        fallbackLabel: '邀请管理',
      },
      {
        key: 'pluginMarket',
        titleKey: 'webViewPortal.pluginMarket',
        path: 'plugins',
        domain: 'undefined',
        fallbackLabel: '插件市场',
      },
      {
        key: 'skillsMarket',
        titleKey: 'webViewPortal.skillsMarket',
        path: 'skills-market',
        domain: 'undefined',
        fallbackLabel: '技能市场',
      },
      {
        key: 'memoryManager',
        titleKey: 'webViewPortal.memoryManager',
        path: 'memory-manager',
        domain: 'undefined',
        fallbackLabel: '记忆管理台',
      },
      {
        key: 'agentRules',
        titleKey: 'webViewPortal.agentRules',
        path: 'rules',
        domain: 'undefined',
        fallbackLabel: '运行规则',
      },
      {
        key: 'publishMonitor',
        titleKey: 'webViewPortal.publishMonitor',
        path: 'publish/monitor',
        domain: 'monitor',
        fallbackLabel: '发布监测',
      },
      {
        key: 'dramaStudio',
        titleKey: 'webViewPortal.dramaStudio',
        path: 'drama',
        domain: 'undefined',
        fallbackLabel: '短剧剧本',
      },
      {
        key: 'myResources',
        titleKey: 'webViewPortal.myResources',
        path: 'user/resource',
        domain: 'resource',
        fallbackLabel: '我的资源',
      },
      {
        key: 'mySignUps',
        titleKey: 'webViewPortal.mySignUps',
        path: 'user/sign-up',
        domain: 'sign-up',
        fallbackLabel: '我的报名',
      },
      {
        key: 'certificateDownload',
        titleKey: 'webViewPortal.certificateDownload',
        path: 'certificate/download',
        domain: 'download',
        fallbackLabel: '证书下载',
      },
      {
        key: 'marginWallet',
        titleKey: 'webViewPortal.marginWallet',
        path: 'distribution/token',
        domain: 'token',
        fallbackLabel: '保证金钱包',
      },
      {
        key: 'withdrawRecords',
        titleKey: 'webViewPortal.withdrawRecords',
        path: 'wallet/withdraw/records',
        domain: 'withdraw',
        fallbackLabel: '提现记录',
      },
      {
        key: 'chatFavorites',
        titleKey: 'webViewPortal.chatFavorites',
        path: '/chat/favorites',
        domain: 'chat',
        fallbackLabel: '对话收藏',
      },
      {
        key: 'cardFavorites',
        titleKey: 'webViewPortal.cardFavorites',
        path: '/business-card/favorites',
        domain: 'business-card',
        fallbackLabel: '名片收藏',
      },
      {
        key: 'chatSettings',
        titleKey: 'webViewPortal.chatSettings',
        path: '/chat/settings',
        domain: 'chat',
        fallbackLabel: '对话参数',
      },
      {
        key: 'searchHistory',
        titleKey: 'webViewPortal.searchHistory',
        path: '/search/history',
        domain: 'search',
        fallbackLabel: '搜索历史',
      },
      {
        key: 'agentPlan',
        titleKey: 'webViewPortal.agentPlan',
        path: '/agent-plan',
        domain: 'agent-plan',
        fallbackLabel: '智能体计划',
      },
      {
        key: 'agentPlanProgress',
        titleKey: 'webViewPortal.agentPlanProgress',
        path: '/agent-plan/progress',
        domain: 'agent-plan',
        fallbackLabel: '计划进度',
      },
      {
        key: 'myAgents',
        titleKey: 'webViewPortal.myAgents',
        path: '/agents/my',
        domain: 'agents',
        fallbackLabel: '我的智能体',
      },
      {
        key: 'subagentDetail',
        titleKey: 'webViewPortal.subagentDetail',
        path: '/subagents/detail',
        domain: 'subagents',
        fallbackLabel: '子智能体详情',
      },
      {
        key: 'subagentDispatch',
        titleKey: 'webViewPortal.subagentDispatch',
        path: '/subagents/dispatch',
        domain: 'subagents',
        fallbackLabel: '新建派单',
      },
      {
        key: 'agentSecurity',
        titleKey: 'webViewPortal.agentSecurity',
        path: '/settings/agent-security',
        domain: 'settings',
        fallbackLabel: '智能体安全策略',
      },
      {
        key: 'modelRecord',
        titleKey: 'webViewPortal.modelRecord',
        path: '/settings/model-record',
        domain: 'settings',
        fallbackLabel: '模型备案',
      },
      {
        key: 'examSignUps',
        titleKey: 'webViewPortal.examSignUps',
        path: '/member/exam/sign-up',
        domain: 'member',
        fallbackLabel: '我的考试报名',
      },
      {
        key: 'buyConfirm',
        titleKey: 'webViewPortal.buyConfirm',
        path: '/learn/buyconfirm',
        domain: 'learn',
        fallbackLabel: '课程购买确认',
      },
      {
        key: 'distributionWithdrawRecords',
        titleKey: 'webViewPortal.distributionWithdrawRecords',
        path: '/distribution/withdraw/records',
        domain: 'distribution',
        fallbackLabel: '分销提现记录',
      },
      {
        key: 'news',
        titleKey: 'webViewPortal.news',
        path: '/news',
        domain: 'news',
        fallbackLabel: '资讯',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.admin',
    fallbackLabel: '管理后台',
    entries: [
      {
        key: 'admin-home',
        titleKey: 'webViewPortal.admin.home',
        path: '/admin',
        domain: 'admin',
        fallbackLabel: '管理后台首页',
      },
      {
        key: 'admin-dashboard-stat',
        titleKey: 'webViewPortal.admin.dashboardStat',
        path: '/admin/dashboard-stat',
        domain: 'admin',
        fallbackLabel: '数据概览',
      },
      {
        key: 'admin-users',
        titleKey: 'webViewPortal.admin.users',
        path: '/admin/users',
        domain: 'admin',
        fallbackLabel: '用户管理',
      },
      {
        key: 'admin-member-users',
        titleKey: 'webViewPortal.admin.memberUsers',
        path: '/admin/member/users',
        domain: 'admin',
        fallbackLabel: '会员管理',
      },
      {
        key: 'admin-orders',
        titleKey: 'webViewPortal.admin.orders',
        path: '/admin/orders',
        domain: 'admin',
        fallbackLabel: '订单管理',
      },
      {
        key: 'admin-refund',
        titleKey: 'webViewPortal.admin.refund',
        path: '/admin/refund',
        domain: 'admin',
        fallbackLabel: '退款管理',
      },
      {
        key: 'admin-wallet',
        titleKey: 'webViewPortal.admin.wallet',
        path: '/admin/wallet',
        domain: 'admin',
        fallbackLabel: '钱包管理',
      },
      {
        key: 'admin-withdrawal',
        titleKey: 'webViewPortal.admin.withdrawal',
        path: '/admin/withdrawal',
        domain: 'admin',
        fallbackLabel: '提现管理',
      },
      {
        key: 'admin-articles',
        titleKey: 'webViewPortal.admin.articles',
        path: '/admin/articles',
        domain: 'admin',
        fallbackLabel: '文章审核',
      },
      {
        key: 'admin-edu-course',
        titleKey: 'webViewPortal.admin.eduCourse',
        path: '/admin/edu/course',
        domain: 'admin',
        fallbackLabel: '课程审核',
      },
      {
        key: 'admin-edu-exam',
        titleKey: 'webViewPortal.admin.eduExam',
        path: '/admin/edu/exam',
        domain: 'admin',
        fallbackLabel: '试卷审核',
      },
      {
        key: 'admin-live',
        titleKey: 'webViewPortal.admin.live',
        path: '/admin/live',
        domain: 'admin',
        fallbackLabel: '直播管理',
      },
      {
        key: 'admin-point',
        titleKey: 'webViewPortal.admin.point',
        path: '/admin/point',
        domain: 'admin',
        fallbackLabel: '积分管理',
      },
      {
        key: 'admin-news',
        titleKey: 'webViewPortal.admin.news',
        path: '/admin/news',
        domain: 'admin',
        fallbackLabel: '资讯管理',
      },
      {
        key: 'admin-agents',
        titleKey: 'webViewPortal.admin.agents',
        path: '/admin/agents',
        domain: 'admin',
        fallbackLabel: '智能体管理',
      },
      {
        key: 'admin-feedbacks',
        titleKey: 'webViewPortal.admin.feedbacks',
        path: '/admin/feedbacks',
        domain: 'admin',
        fallbackLabel: '用户反馈',
      },
      {
        key: 'admin-ticket',
        titleKey: 'webViewPortal.admin.ticket',
        path: '/admin/ticket',
        domain: 'admin',
        fallbackLabel: '工单管理',
      },
      {
        key: 'admin-configs',
        titleKey: 'webViewPortal.admin.configs',
        path: '/admin/configs',
        domain: 'admin',
        fallbackLabel: '系统配置',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.docs',
    fallbackLabel: '文档与帮助',
    entries: [
      {
        key: 'docs-home',
        titleKey: 'webViewPortal.docs.home',
        path: '/docs',
        domain: 'docs',
        fallbackLabel: '文档中心',
      },
      {
        key: 'docs-quickstart',
        titleKey: 'webViewPortal.docs.quickstart',
        path: '/docs/quickstart',
        domain: 'docs',
        fallbackLabel: '快速上手',
      },
      {
        key: 'docs-getting-started',
        titleKey: 'webViewPortal.docs.gettingStarted',
        path: '/docs/manual/getting-started',
        domain: 'docs',
        fallbackLabel: '新手指南',
      },
      {
        key: 'docs-faq',
        titleKey: 'webViewPortal.docs.faq',
        path: '/docs/manual/faq',
        domain: 'docs',
        fallbackLabel: '常见问题',
      },
      {
        key: 'help-home',
        titleKey: 'webViewPortal.docs.help',
        path: '/help',
        domain: 'docs',
        fallbackLabel: '帮助中心',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.workflows',
    fallbackLabel: '工作流与自动化',
    entries: [
      {
        key: 'workflows-home',
        titleKey: 'webViewPortal.workflows.home',
        path: '/workflows',
        domain: 'workflows',
        fallbackLabel: '工作流',
      },
      {
        key: 'automations-home',
        titleKey: 'webViewPortal.workflows.automations',
        path: '/automations',
        domain: 'workflows',
        fallbackLabel: '自动化任务',
      },
      {
        key: 'orchestration-home',
        titleKey: 'webViewPortal.workflows.orchestration',
        path: '/orchestration',
        domain: 'workflows',
        fallbackLabel: '编排中心',
      },
      {
        key: 'schedule-home',
        titleKey: 'webViewPortal.workflows.schedule',
        path: '/schedule',
        domain: 'workflows',
        fallbackLabel: '定时任务',
      },
      {
        key: 'cloud-runs-home',
        titleKey: 'webViewPortal.cloudRuns',
        path: '/cloud-agent',
        domain: 'cloud-agent',
        fallbackLabel: '云托管运行记录',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.analytics',
    fallbackLabel: '数据看板',
    entries: [
      {
        key: 'analytics-dashboard',
        titleKey: 'webViewPortal.analytics.dashboard',
        path: '/dashboard',
        domain: 'analytics',
        fallbackLabel: '数据看板',
      },
      {
        key: 'analytics-bi',
        titleKey: 'webViewPortal.analytics.bi',
        path: '/bi-dashboard',
        domain: 'analytics',
        fallbackLabel: 'BI 看板',
      },
      {
        key: 'analytics-cost',
        titleKey: 'webViewPortal.analytics.cost',
        path: '/cost-dashboard',
        domain: 'analytics',
        fallbackLabel: '成本看板',
      },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.openPlatform',
    fallbackLabel: '开放平台',
    entries: [
      {
        key: 'open-mcp-store',
        titleKey: 'webViewPortal.openPlatform.mcpStore',
        path: '/mcp-store',
        domain: 'open-platform',
        fallbackLabel: 'MCP 市场',
      },
      {
        key: 'open-mcp-projects',
        titleKey: 'webViewPortal.openPlatform.mcpProjects',
        path: '/mcp-projects',
        domain: 'open-platform',
        fallbackLabel: 'MCP 项目',
      },
      {
        key: 'open-connectors',
        titleKey: 'webViewPortal.openPlatform.connectors',
        path: '/connectors',
        domain: 'open-platform',
        fallbackLabel: '连接器生态',
      },
      {
        key: 'open-registry',
        titleKey: 'webViewPortal.openPlatform.registry',
        path: '/registry',
        domain: 'open-platform',
        fallbackLabel: '能力注册表',
      },
      {
        key: 'open-api-test',
        titleKey: 'webViewPortal.openPlatform.apiTest',
        path: '/api-test',
        domain: 'open-platform',
        fallbackLabel: 'API 调试',
      },
      {
        key: 'open-capability-market',
        titleKey: 'webViewPortal.openPlatform.capabilityMarket',
        path: '/capability-market',
        domain: 'open-platform',
        fallbackLabel: '能力市场',
      },
    ],
  },
] as const satisfies readonly WebPortalSection[]

/** 拼接门户条目的完整 URL */
export function buildWebPortalUrl(webBase: string, entry: WebPortalEntry): string {
  return `${webBase}${entry.path}`
}

/**
 * 记忆详情页 URL(web `/memory/[id]`)—— 路径形状住在门户同源里,端内不许各拼一份。
 *
 * 为什么移动端要承它而不是自己再画一张屏:那张页带**编辑 + 保存**,而移动端原生记忆列表
 * 只有新建与删除(packages/app/src/features/memory/MemoryScreen.tsx 现读无 update 通道),
 * 补原生等于把 web 的一张页在两端各写一遍(§3 共享层优先 + §4 跨端同形)。
 */
export function buildMemoryDetailUrl(webBase: string, id: string): string {
  return `${webBase}/memory/${encodeURIComponent(id)}`
}

/**
 * 把门户 URL 压成 SSO `redirectUri` 的合规形态(2026-10-13 真机实测立因,别删注释里的因)
 *
 * 真机取证(Redmi flame / Android 16 / 已登录态):App 内点开「AI 对话 / 工具」,
 * WebView 里 web 端仍弹登录框 ⇒ App→Web 会话打通是断的。根因:服务端对**绝对 URL**
 * 走 env 白名单 SSO_ALLOWED_ORIGINS,生产未配置 ⇒ 400 ⇒ 降级直开 ⇒ WebView 内没有
 * httpOnly 的 auth_token cookie。服务端**内置允许**的形态里本就有「站内相对路径」,
 * 比 origin 白名单更严格且不依赖 env ⇒ 同域一律压成相对路径是正解。
 */
export function toWebSsoRedirectUri(webBase: string, url: string): string {
  try {
    const base = new URL(webBase)
    const parsed = new URL(url)
    if (parsed.protocol === base.protocol && parsed.host === base.host) {
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`
      return path || '/'
    }
  } catch {
    // 已是相对路径或无法解析:原样交给服务端判(它可能仍认)
  }
  return url
}

/**
 * 构建 App→Web 免登录 URL:web 端 /sso/mobile-auth 消费页用一次性 code 换
 * httpOnly auth_token cookie 后跳往目标页。与 RN WebViewScreen 现网跑通的链路同形。
 */
export function buildWebSsoMobileAuthUrl(
  webBase: string,
  targetUrl: string,
  ssoCode: string,
): string {
  return `${webBase}/sso/mobile-auth?sso_code=${encodeURIComponent(ssoCode)}&redirect=${encodeURIComponent(targetUrl)}`
}
