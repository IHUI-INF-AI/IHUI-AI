/**
 * 开放平台页数据：能力/接口一览、文档链接、FAQ、客户案例、使用场景
 * 用于数据驱动展示，便于运营扩展与多语言
 */

/** 接口一览项：文案用 i18n 键 */
export interface ApiEndpointItem {
  method: string
  path: string
  nameKey: string
  descKey: string
  category?: string
}

/** 文档与资源链接 */
export interface DocLinkItem {
  labelKey: string
  href: string
  internal?: boolean
}

/** FAQ 项（i18n 键） */
export interface FaqItemKeys {
  q: string
  a: string
}

/** 客户案例项（i18n 键） */
export interface CustomerCaseKeys {
  tagKey: string
  titleKey: string
  descKey: string
}

/** API 接口一览（与智汇 API 文档对应，展示给买方） */
export const apiEndpoints: ApiEndpointItem[] = [
  { method: 'POST', path: '/v1/chat/completions', nameKey: 'openPlatform.apiList.chatCompletions', descKey: 'openPlatform.apiList.chatCompletionsDesc', category: 'CORE' },
  { method: 'POST', path: '/v1/embeddings', nameKey: 'openPlatform.apiList.embeddings', descKey: 'openPlatform.apiList.embeddingsDesc', category: 'CORE' },
  { method: 'POST', path: '/v1/swarm/create', nameKey: 'openPlatform.apiList.swarmCreate', descKey: 'openPlatform.apiList.swarmCreateDesc', category: 'CORE' },
  { method: 'POST', path: '/v1/documents/parse', nameKey: 'openPlatform.apiList.docParse', descKey: 'openPlatform.apiList.docParseDesc', category: 'POWERFUL' },
  { method: 'POST', path: '/v1/vision/analyze', nameKey: 'openPlatform.apiList.visionAnalyze', descKey: 'openPlatform.apiList.visionAnalyzeDesc', category: 'VISION' },
  { method: 'POST', path: '/v1/audio/tts', nameKey: 'openPlatform.apiList.audioTts', descKey: 'openPlatform.apiList.audioTtsDesc', category: 'AUDIO' },
  { method: 'GET', path: '/v1/models', nameKey: 'openPlatform.apiList.modelsList', descKey: 'openPlatform.apiList.modelsListDesc', category: 'SUPPORT' },
]

/** 文档与资源聚合（开发指南、API 参考、SDK、README） */
export const docLinks: DocLinkItem[] = [
  { labelKey: 'openPlatform.docLinks.developerGuide', href: '/support/document-center', internal: true },
  { labelKey: 'openPlatform.docLinks.apiReference', href: '/open/apis', internal: true },
  { labelKey: 'openPlatform.docLinks.sdkDocs', href: '/open/sdks', internal: true },
  { labelKey: 'openPlatform.docLinks.readme', href: 'https://github.com/ihui-ai', internal: false },
]

/** 售卖区 FAQ（i18n 键数组，便于扩展） */
export const saleFaqKeys: FaqItemKeys[] = [
  { q: 'openPlatform.sale.saleFaq1q', a: 'openPlatform.sale.saleFaq1a' },
  { q: 'openPlatform.sale.saleFaq2q', a: 'openPlatform.sale.saleFaq2a' },
  { q: 'openPlatform.sale.saleFaq3q', a: 'openPlatform.sale.saleFaq3a' },
  { q: 'openPlatform.sale.saleFaq4q', a: 'openPlatform.sale.saleFaq4a' },
]

/** 页脚通用 FAQ（i18n 键数组） */
export const mainFaqKeys: FaqItemKeys[] = [
  { q: 'openPlatform.faq1q', a: 'openPlatform.faq1a' },
  { q: 'openPlatform.faq2q', a: 'openPlatform.faq2a' },
  { q: 'openPlatform.faq3q', a: 'openPlatform.faq3a' },
  { q: 'openPlatform.faq4q', a: 'openPlatform.faq4a' },
]

/** 客户案例（i18n 键，便于扩展条数） */
export const customerCaseKeys: CustomerCaseKeys[] = [
  { tagKey: 'openPlatform.sale.case1Tag', titleKey: 'openPlatform.sale.case1Title', descKey: 'openPlatform.sale.case1Desc' },
  { tagKey: 'openPlatform.sale.case2Tag', titleKey: 'openPlatform.sale.case2Title', descKey: 'openPlatform.sale.case2Desc' },
  { tagKey: 'openPlatform.sale.case3Tag', titleKey: 'openPlatform.sale.case3Title', descKey: 'openPlatform.sale.case3Desc' },
]

/** 典型使用场景（i18n 键列表） */
export const useCaseKeys: string[] = [
  'openPlatform.sale.useCase1',
  'openPlatform.sale.useCase2',
  'openPlatform.sale.useCase3',
  'openPlatform.sale.useCase4',
  'openPlatform.sale.useCase5',
]

// ========== 定价对比表 ==========
/** 定价对比行：功能维度 + 三档是否包含 */
export interface PricingComparisonRow {
  featureKey: string  // i18n: openPlatform.pricingCompare.xxx
  free: boolean
  standard: boolean
  enterprise: boolean
}

export const pricingComparisonRows: PricingComparisonRow[] = [
  { featureKey: 'openPlatform.pricingCompare.expAndCredit', free: true, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.dashboard', free: true, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.publicDocs', free: true, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.basicChatApi', free: true, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.usageConsole', free: true, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.communitySupport', free: true, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.fullSourceCode', free: false, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.multiEndpoints', free: false, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.backendAndApis', free: false, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.officialSdks', free: false, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.fullDocsAndGuide', free: false, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.ticketSupport', free: false, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.updates', free: false, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.workflowIntegration', free: false, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.secondaryDeploy', free: false, standard: true, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.privateDeploy', free: false, standard: false, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.sla', free: false, standard: false, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.dedicatedManager', free: false, standard: false, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.customTraining', free: false, standard: false, enterprise: true },
  { featureKey: 'openPlatform.pricingCompare.complianceAudit', free: false, standard: false, enterprise: true },
]

// ========== 能力标签筛选 ==========
export interface CapabilityTagItem {
  id: string
  labelKey: string
}

export const capabilityTags: CapabilityTagItem[] = [
  { id: 'ALL', labelKey: 'openPlatform.capabilityTags.all' },
  { id: 'CORE', labelKey: 'openPlatform.capabilityTags.core' },
  { id: 'POWERFUL', labelKey: 'openPlatform.capabilityTags.powerful' },
  { id: 'VISION', labelKey: 'openPlatform.capabilityTags.vision' },
  { id: 'AUDIO', labelKey: 'openPlatform.capabilityTags.audio' },
  { id: 'WORKFLOW', labelKey: 'openPlatform.capabilityTags.workflow' },
  { id: 'SUPPORT', labelKey: 'openPlatform.capabilityTags.support' },
]

/** 能力项（用于 API 矩阵 + 标签筛选）：与 apiUniverse 对应，用 i18n 键 + tag */
export interface CapabilityItemWithTag {
  titleKey: string
  descKey: string
  tag: string
  latency: string
  iconName: string  // 组件名，如 Share, Document
}

export const capabilitiesWithTags: CapabilityItemWithTag[] = [
  { titleKey: 'title.open_platform.Swarm协作A4', descKey: 'openPlatform.apiDesc1', tag: 'CORE', latency: '80ms', iconName: 'Share' },
  { titleKey: 'title.open_platform.全格式文档API5', descKey: 'openPlatform.apiDesc2', tag: 'POWERFUL', latency: '1.2s', iconName: 'Document' },
  { titleKey: 'title.open_platform.多模态视觉API6', descKey: 'openPlatform.apiDesc3', tag: 'VISION', latency: '150ms', iconName: 'View' },
  { titleKey: 'title.open_platform.智能音频API7', descKey: 'openPlatform.apiDesc4', tag: 'AUDIO', latency: '200ms', iconName: 'Microphone' },
  { titleKey: 'title.open_platform.自动化插件API8', descKey: 'openPlatform.apiDesc5', tag: 'WORKFLOW', latency: '50ms', iconName: 'Connection' },
  { titleKey: 'title.open_platform.监控看板API9', descKey: 'openPlatform.apiDesc6', tag: 'SUPPORT', latency: '30ms', iconName: 'Monitor' },
]

// ========== 全功能参照表 / 功能表 ==========
export interface FullFeatureRow {
  nameKey: string
  descKey: string
  moduleKey: string
}

export const fullFeatureReferenceRows: FullFeatureRow[] = [
  { nameKey: 'openPlatform.featureRef.chatCompletions', descKey: 'openPlatform.featureRef.chatCompletionsDesc', moduleKey: 'openPlatform.featureRef.moduleApi' },
  { nameKey: 'openPlatform.featureRef.embeddings', descKey: 'openPlatform.featureRef.embeddingsDesc', moduleKey: 'openPlatform.featureRef.moduleApi' },
  { nameKey: 'openPlatform.featureRef.swarm', descKey: 'openPlatform.featureRef.swarmDesc', moduleKey: 'openPlatform.featureRef.moduleApi' },
  { nameKey: 'openPlatform.featureRef.docParse', descKey: 'openPlatform.featureRef.docParseDesc', moduleKey: 'openPlatform.featureRef.moduleApi' },
  { nameKey: 'openPlatform.featureRef.vision', descKey: 'openPlatform.featureRef.visionDesc', moduleKey: 'openPlatform.featureRef.moduleApi' },
  { nameKey: 'openPlatform.featureRef.audioTts', descKey: 'openPlatform.featureRef.audioTtsDesc', moduleKey: 'openPlatform.featureRef.moduleApi' },
  { nameKey: 'openPlatform.featureRef.dashboard', descKey: 'openPlatform.featureRef.dashboardDesc', moduleKey: 'openPlatform.featureRef.moduleHub' },
  { nameKey: 'openPlatform.featureRef.sdks', descKey: 'openPlatform.featureRef.sdksDesc', moduleKey: 'openPlatform.featureRef.moduleHub' },
  { nameKey: 'openPlatform.featureRef.models', descKey: 'openPlatform.featureRef.modelsDesc', moduleKey: 'openPlatform.featureRef.moduleHub' },
  { nameKey: 'openPlatform.featureRef.agents', descKey: 'openPlatform.featureRef.agentsDesc', moduleKey: 'openPlatform.featureRef.moduleHub' },
  { nameKey: 'openPlatform.featureRef.apiDocs', descKey: 'openPlatform.featureRef.apiDocsDesc', moduleKey: 'openPlatform.featureRef.moduleHub' },
  { nameKey: 'openPlatform.featureRef.knowledgeDocs', descKey: 'openPlatform.featureRef.knowledgeDocsDesc', moduleKey: 'openPlatform.featureRef.moduleHub' },
  { nameKey: 'openPlatform.featureRef.console', descKey: 'openPlatform.featureRef.consoleDesc', moduleKey: 'openPlatform.featureRef.moduleEco' },
  { nameKey: 'openPlatform.featureRef.workflowPlugins', descKey: 'openPlatform.featureRef.workflowPluginsDesc', moduleKey: 'openPlatform.featureRef.moduleEco' },
  { nameKey: 'openPlatform.featureRef.github', descKey: 'openPlatform.featureRef.githubDesc', moduleKey: 'openPlatform.featureRef.moduleEco' },
]

/** 功能表（精简：功能名 + 说明） */
export interface FeatureTableRow {
  nameKey: string
  descKey: string
}

export const featureTableRows: FeatureTableRow[] = [
  { nameKey: 'openPlatform.featureTable.dialog', descKey: 'openPlatform.featureTable.dialogDesc' },
  { nameKey: 'openPlatform.featureTable.embedding', descKey: 'openPlatform.featureTable.embeddingDesc' },
  { nameKey: 'openPlatform.featureTable.swarm', descKey: 'openPlatform.featureTable.swarmDesc' },
  { nameKey: 'openPlatform.featureTable.document', descKey: 'openPlatform.featureTable.documentDesc' },
  { nameKey: 'openPlatform.featureTable.vision', descKey: 'openPlatform.featureTable.visionDesc' },
  { nameKey: 'openPlatform.featureTable.audio', descKey: 'openPlatform.featureTable.audioDesc' },
  { nameKey: 'openPlatform.featureTable.sdk', descKey: 'openPlatform.featureTable.sdkDesc' },
  { nameKey: 'openPlatform.featureTable.multiEnd', descKey: 'openPlatform.featureTable.multiEndDesc' },
]
