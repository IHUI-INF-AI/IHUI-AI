/**
 * fix-admin-menu-i18n.cjs
 * ----------------------------------------------------------------
 * 修复 admin/Menu.vue 中 30 个缺失的 adminCommon.menu.* 翻译 key
 * 同步到 5 个语言文件 (zh-CN, en, zh-TW, ja, ko)
 *
 * 历史背景:
 * - check:i18n:keys 报 308 个 key 缺失，全部集中在 src/components/admin/Menu.vue
 * - 缺失分组: 2 个 group (monitoring, oauth) + 28 个 item
 * - 5 个 locale 的 menu.group 与 menu.item 节点结构相同，仅补缺失 key
 *
 * 运行: node scripts/fix-admin-menu-i18n.cjs
 * 验证: npm run check:i18n:keys  (期望 0 缺失)
 * ----------------------------------------------------------------
 */

const fs = require('fs')
const path = require('path')

const LOCALES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko']

// 30 个缺失 key 的 5 语言翻译
// 保持与项目现有术语一致 (参考 adminCommon.json 已有的 learn/point/community 等命名)
const I18N = {
  group: {
    monitoring:   { 'zh-CN': '监控',          en: 'Monitoring',           'zh-TW': '監控',         ja: '監視',           ko: '모니터링' },
    oauth:        { 'zh-CN': 'OAuth 授权',     en: 'OAuth Authorization',  'zh-TW': 'OAuth 授權',    ja: 'OAuth 認可',      ko: 'OAuth 인증' },
  },
  item: {
    activityManagement:        { 'zh-CN': '活动管理',         en: 'Activity Management',         'zh-TW': '活動管理',         ja: '活動管理',           ko: '활동 관리' },
    agentCategoryManagement:   { 'zh-CN': '智能体分类管理',   en: 'Agent Category Management',   'zh-TW': '智能體分類管理',   ja: 'エージェント分類管理', ko: '에이전트 분류 관리' },
    agentExamineManagement:    { 'zh-CN': '智能体审核管理',   en: 'Agent Review Management',     'zh-TW': '智能體審核管理',   ja: 'エージェント審査管理', ko: '에이전트 심사 관리' },
    agentManagement:           { 'zh-CN': '智能体管理',       en: 'Agent Management',            'zh-TW': '智能體管理',       ja: 'エージェント管理',   ko: '에이전트 관리' },
    courseManagement:          { 'zh-CN': '课程管理',         en: 'Course Management',           'zh-TW': '課程管理',         ja: 'コース管理',         ko: '강의 관리' },
    databaseOptimization:      { 'zh-CN': '数据库优化',       en: 'Database Optimization',       'zh-TW': '數據庫優化',       ja: 'データベース最適化', ko: '데이터베이스 최적화' },
    dependencyManager:         { 'zh-CN': '依赖管理',         en: 'Dependency Manager',          'zh-TW': '依賴管理',         ja: '依存関係管理',       ko: '의존성 관리' },
    errorDashboard:            { 'zh-CN': '错误监控',         en: 'Error Dashboard',             'zh-TW': '錯誤監控',         ja: 'エラーダッシュボード', ko: '오류 대시보드' },
    eventBusMonitor:           { 'zh-CN': '事件总线监控',     en: 'Event Bus Monitor',           'zh-TW': '事件總線監控',     ja: 'イベントバスモニター', ko: '이벤트 버스 모니터' },
    faqManagement:             { 'zh-CN': '常见问题管理',     en: 'FAQ Management',              'zh-TW': '常見問題管理',     ja: 'FAQ管理',            ko: 'FAQ 관리' },
    feedbackManagement:        { 'zh-CN': '反馈管理',         en: 'Feedback Management',         'zh-TW': '反饋管理',         ja: 'フィードバック管理',  ko: '피드백 관리' },
    fundManagement:            { 'zh-CN': '资金管理',         en: 'Fund Management',             'zh-TW': '資金管理',         ja: '資金管理',           ko: '자금 관리' },
    grayRelease:               { 'zh-CN': '灰度发布',         en: 'Gray Release',                'zh-TW': '灰度發布',         ja: 'グレー公開',         ko: '카나리 배포' },
    mobileAdapter:             { 'zh-CN': '移动端适配',       en: 'Mobile Adapter',              'zh-TW': '移動端適配',       ja: 'モバイルアダプタ',   ko: '모바일 어댑터' },
    mobileDashboard:           { 'zh-CN': '移动端监控',       en: 'Mobile Dashboard',            'zh-TW': '移動端監控',       ja: 'モバイルダッシュボード', ko: '모바일 대시보드' },
    monitoringDashboard:       { 'zh-CN': '系统监控',         en: 'Monitoring Dashboard',        'zh-TW': '系統監控',         ja: '監視ダッシュボード', ko: '모니터링 대시보드' },
    oauthApps:                 { 'zh-CN': 'OAuth 应用',       en: 'OAuth Apps',                  'zh-TW': 'OAuth 應用',       ja: 'OAuthアプリ',        ko: 'OAuth 앱' },
    oauthAuditDashboard:       { 'zh-CN': 'OAuth 审计面板',   en: 'OAuth Audit Dashboard',       'zh-TW': 'OAuth 審計面板',   ja: 'OAuth監査ダッシュボード', ko: 'OAuth 감사 대시보드' },
    oauthAuditLogs:            { 'zh-CN': 'OAuth 审计日志',   en: 'OAuth Audit Logs',            'zh-TW': 'OAuth 審計日誌',   ja: 'OAuth監査ログ',      ko: 'OAuth 감사 로그' },
    oauthScopeMeta:            { 'zh-CN': 'OAuth 权限元数据', en: 'OAuth Scope Metadata',        'zh-TW': 'OAuth 權限元數據', ja: 'OAuthスコープメタ',  ko: 'OAuth 스코프 메타' },
    paymentManagement:         { 'zh-CN': '支付管理',         en: 'Payment Management',          'zh-TW': '支付管理',         ja: '決済管理',           ko: '결제 관리' },
    performanceDashboard:      { 'zh-CN': '性能监控',         en: 'Performance Dashboard',       'zh-TW': '性能監控',         ja: 'パフォーマンスダッシュボード', ko: '성능 대시보드' },
    productManagement:         { 'zh-CN': '产品管理',         en: 'Product Management',          'zh-TW': '產品管理',         ja: '製品管理',           ko: '제품 관리' },
    recommendationConfig:      { 'zh-CN': '推荐配置',         en: 'Recommendation Config',       'zh-TW': '推薦配置',         ja: 'レコメンド設定',     ko: '추천 설정' },
    refundAudit:               { 'zh-CN': '退款审核',         en: 'Refund Audit',                'zh-TW': '退款審核',         ja: '返金審査',           ko: '환불 심사' },
    settlementManagement:      { 'zh-CN': '结算管理',         en: 'Settlement Management',       'zh-TW': '結算管理',         ja: '決算管理',           ko: '정산 관리' },
    userManagement:            { 'zh-CN': '用户管理',         en: 'User Management',             'zh-TW': '用戶管理',         ja: 'ユーザー管理',       ko: '사용자 관리' },
    webhookManagement:         { 'zh-CN': 'Webhook 管理',     en: 'Webhook Management',          'zh-TW': 'Webhook 管理',     ja: 'Webhook管理',        ko: 'Webhook 관리' },
    withdrawalManagement:      { 'zh-CN': '提现管理',         en: 'Withdrawal Management',       'zh-TW': '提現管理',         ja: '出金管理',           ko: '출금 관리' },
  },
}

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales', 'modules')

let totalAdded = 0
const report = []

for (const locale of LOCALES) {
  const filePath = path.join(LOCALES_DIR, locale, 'adminCommon.json')
  if (!fs.existsSync(filePath)) {
    report.push(`SKIP ${locale}: file not found`)
    continue
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(raw)

  if (!data.adminCommon || !data.adminCommon.menu) {
    report.push(`SKIP ${locale}: menu node missing`)
    continue
  }
  if (!data.adminCommon.menu.group) data.adminCommon.menu.group = {}
  if (!data.adminCommon.menu.item) data.adminCommon.menu.item = {}

  let added = 0
  for (const [k, trans] of Object.entries(I18N.group)) {
    if (!(k in data.adminCommon.menu.group)) {
      data.adminCommon.menu.group[k] = trans[locale]
      added++
    }
  }
  for (const [k, trans] of Object.entries(I18N.item)) {
    if (!(k in data.adminCommon.menu.item)) {
      data.adminCommon.menu.item[k] = trans[locale]
      added++
    }
  }

  if (added > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
    totalAdded += added
    report.push(`UPDATED ${locale}: +${added} keys (${Object.keys(I18N.group).length} groups, ${Object.keys(I18N.item).length} items)`)
  } else {
    report.push(`NO-OP ${locale}: all keys already present`)
  }
}

console.log('=== fix-admin-menu-i18n report ===')
report.forEach((r) => console.log(r))
console.log(`=== Total keys added: ${totalAdded} ===`)
console.log('Run `npm run check:i18n:keys` to verify 0 admin/Menu.vue errors.')
