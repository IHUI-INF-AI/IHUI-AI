#!/usr/bin/env node
/**
 * add-eduai-i18n.mjs — 为 5 语言 web messages 注入 eduAi 命名空间 + nav 导航 key
 * 用法: node scripts/add-eduai-i18n.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MSG_DIR = path.resolve(__dirname, '../packages/i18n/messages/web')

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

/** 各语言文案(zh-CN 为基准,其他语言做对应翻译) */
const NAV_KEYS = {
  'zh-CN': { eduAiPolicy: 'AI 政策库', eduAiCert: '教师 AI 认证', eduAiAigc: 'AIGC 工具库', eduAiCourses: 'AI 课程' },
  en: { eduAiPolicy: 'AI Policy', eduAiCert: 'AI Teacher Cert', eduAiAigc: 'AIGC Tools', eduAiCourses: 'AI Courses' },
  ja: { eduAiPolicy: 'AI政策ライブラリ', eduAiCert: '教員AI認証', eduAiAigc: 'AIGCツール', eduAiCourses: 'AIコース' },
  ko: { eduAiPolicy: 'AI 정책 라이브러리', eduAiCert: '교사 AI 인증', eduAiAigc: 'AIGC 도구', eduAiCourses: 'AI 강좌' },
  'zh-TW': { eduAiPolicy: 'AI 政策庫', eduAiCert: '教師 AI 認證', eduAiAigc: 'AIGC 工具庫', eduAiCourses: 'AI 課程' },
}

const EDUAI = {
  'zh-CN': {
    policy: {
      title: 'AI 教育政策库', subtitle: '汇聚国家与地方 AI 教育政策、行动方案与解读',
      search: '搜索政策关键词...', allLevels: '全部级别', national: '国家', ministerial: '部委', local: '地方',
      issuingAuthority: '发布机构', issueDate: '发布日期', effectiveDate: '生效日期', policyLevel: '级别',
      targetGroup: '适用对象', summary: '摘要', keyPoints: '核心要点', implementation: '实施路径',
      goals: '目标', sourceUrl: '来源链接', viewDetail: '查看详情', loading: '加载中...', empty: '暂无政策',
      loadFailed: '加载失败', page: '第 {page} / {total} 页', prev: '上一页', next: '下一页',
      back: '返回', noDetail: '暂无详细内容', status: '状态', active: '生效中', draft: '草稿', closed: '已关闭',
    },
    cert: {
      title: '教师 AI 认证', subtitle: 'AI 师资培训与认证项目,助力教师掌握 AI 教学能力',
      search: '搜索认证项目...', allLevels: '全部等级', primary: '初级', intermediate: '中级', advanced: '高级',
      certName: '认证名称', issuingAuthority: '发证机构', targetTeachers: '面向教师', level: '等级',
      trainingHours: '培训学时', trainingContent: '培训内容', assessmentMethod: '考核方式',
      certificationRequirements: '认证要求', validity: '证书有效期', benefits: '认证权益',
      viewDetail: '查看详情', loading: '加载中...', empty: '暂无认证项目', loadFailed: '加载失败',
      page: '第 {page} / {total} 页', prev: '上一页', next: '下一页', hoursSuffix: '学时',
    },
    aigc: {
      title: 'AIGC 工具库', subtitle: '精选 AI 生成内容工具,助力教学与创作',
      search: '搜索工具...', allCategories: '全部类型', text: '文生文', image: '文生图', video: '视频',
      audio: '音频', code: '代码', '3d': '3D 建模', agent: 'AI 智能体',
      name: '工具名称', nameCn: '中文名', provider: '提供商', category: '类型', rating: '评分',
      free: '免费', paid: '付费', freemium: '免费增值', api: '提供 API', mobileApp: '移动端',
      description: '简介', coreFeatures: '核心功能', useCases: '使用场景', pricingModel: '定价模式',
      pricingDetail: '定价详情', freeTier: '免费额度', pros: '优点', cons: '缺点', tips: '使用技巧',
      alternatives: '替代工具', userCount: '用户量', viewDetail: '查看详情', loading: '加载中...',
      empty: '暂无工具', loadFailed: '加载失败', page: '第 {page} / {total} 页', prev: '上一页', next: '下一页',
      noRating: '暂无评分',
    },
    courses: {
      title: 'AI 课程', subtitle: 'K12 与高校 AI 课程体系,覆盖全学段',
      tabK12: 'K12 AI 课程', tabUniversity: '高校 AI 课程', search: '搜索课程...',
      stage: '学段', gradeRange: '年级', courseName: '课程名称', hoursPerYear: '年课时',
      courseType: '课程类型', learningObjectives: '学习目标', contentModules: '内容模块',
      keyConcepts: '核心概念', skillRequirements: '技能要求', teachingMethods: '教学方法',
      assessmentMethods: '考核方式', toolsResources: '工具与资源',
      targetMajor: '面向专业', credits: '学分', hours: '学时', university: '开设高校',
      description: '课程简介', modules: '课程模块', prerequisites: '先修要求', textbooks: '教材',
      teachingTeam: '教学团队', assessment: '考核方式', required: '必修', elective: '选修',
      primary: '小学', junior: '初中', senior: '高中', viewDetail: '查看详情', loading: '加载中...',
      empty: '暂无课程', loadFailed: '加载失败', page: '第 {page} / {total} 页', prev: '上一页', next: '下一页',
      noDetail: '暂无详细内容',
    },
  },
  en: {
    policy: {
      title: 'AI Education Policy Hub', subtitle: 'National and local AI education policies, action plans and insights',
      search: 'Search policy keyword...', allLevels: 'All levels', national: 'National', ministerial: 'Ministerial', local: 'Local',
      issuingAuthority: 'Issuing authority', issueDate: 'Issue date', effectiveDate: 'Effective date', policyLevel: 'Level',
      targetGroup: 'Target group', summary: 'Summary', keyPoints: 'Key points', implementation: 'Implementation',
      goals: 'Goals', sourceUrl: 'Source link', viewDetail: 'View detail', loading: 'Loading...', empty: 'No policies',
      loadFailed: 'Load failed', page: 'Page {page} / {total}', prev: 'Prev', next: 'Next',
      back: 'Back', noDetail: 'No detail', status: 'Status', active: 'Active', draft: 'Draft', closed: 'Closed',
    },
    cert: {
      title: 'AI Teacher Certification', subtitle: 'AI teacher training and certification programs',
      search: 'Search certification...', allLevels: 'All levels', primary: 'Primary', intermediate: 'Intermediate', advanced: 'Advanced',
      certName: 'Certification', issuingAuthority: 'Issuing authority', targetTeachers: 'Target teachers', level: 'Level',
      trainingHours: 'Training hours', trainingContent: 'Training content', assessmentMethod: 'Assessment method',
      certificationRequirements: 'Requirements', validity: 'Validity', benefits: 'Benefits',
      viewDetail: 'View detail', loading: 'Loading...', empty: 'No certifications', loadFailed: 'Load failed',
      page: 'Page {page} / {total}', prev: 'Prev', next: 'Next', hoursSuffix: 'h',
    },
    aigc: {
      title: 'AIGC Tools', subtitle: 'Curated AI content generation tools for teaching and creation',
      search: 'Search tools...', allCategories: 'All categories', text: 'Text', image: 'Image', video: 'Video',
      audio: 'Audio', code: 'Code', '3d': '3D', agent: 'Agent',
      name: 'Name', nameCn: 'Chinese name', provider: 'Provider', category: 'Category', rating: 'Rating',
      free: 'Free', paid: 'Paid', freemium: 'Freemium', api: 'API', mobileApp: 'Mobile app',
      description: 'Description', coreFeatures: 'Core features', useCases: 'Use cases', pricingModel: 'Pricing model',
      pricingDetail: 'Pricing detail', freeTier: 'Free tier', pros: 'Pros', cons: 'Cons', tips: 'Tips',
      alternatives: 'Alternatives', userCount: 'Users', viewDetail: 'View detail', loading: 'Loading...',
      empty: 'No tools', loadFailed: 'Load failed', page: 'Page {page} / {total}', prev: 'Prev', next: 'Next',
      noRating: 'No rating',
    },
    courses: {
      title: 'AI Courses', subtitle: 'K12 and university AI course systems across all stages',
      tabK12: 'K12 AI Courses', tabUniversity: 'University AI Courses', search: 'Search courses...',
      stage: 'Stage', gradeRange: 'Grade', courseName: 'Course name', hoursPerYear: 'Hours/year',
      courseType: 'Course type', learningObjectives: 'Learning objectives', contentModules: 'Content modules',
      keyConcepts: 'Key concepts', skillRequirements: 'Skills', teachingMethods: 'Teaching methods',
      assessmentMethods: 'Assessment', toolsResources: 'Tools & resources',
      targetMajor: 'Target major', credits: 'Credits', hours: 'Hours', university: 'University',
      description: 'Description', modules: 'Modules', prerequisites: 'Prerequisites', textbooks: 'Textbooks',
      teachingTeam: 'Teaching team', assessment: 'Assessment', required: 'Required', elective: 'Elective',
      primary: 'Primary', junior: 'Junior', senior: 'Senior', viewDetail: 'View detail', loading: 'Loading...',
      empty: 'No courses', loadFailed: 'Load failed', page: 'Page {page} / {total}', prev: 'Prev', next: 'Next',
      noDetail: 'No detail',
    },
  },
}

// ja / ko / zh-TW 复用 zh-CN(未翻译的先用中文,避免 key 缺失;可后续精翻)
const FALLBACK = { ja: 'zh-CN', ko: 'zh-CN', 'zh-TW': 'zh-CN' }

function deepClone(o) { return JSON.parse(JSON.stringify(o)) }

for (const locale of LOCALES) {
  const file = path.join(MSG_DIR, `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))

  // nav keys
  if (!data.nav) data.nav = {}
  for (const [k, v] of Object.entries(NAV_KEYS[locale] ?? NAV_KEYS['zh-CN'])) {
    data.nav[k] = v
  }

  // eduAi namespace(ja/ko/zh-TW 基于 zh-CN 复制)
  const src = EDUAI[locale] ?? deepClone(EDUAI[FALLBACK[locale]])
  data.eduAi = src

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`[OK] ${locale}.json 已注入 eduAi + nav 4 key`)
}

// 校验:5 语言 eduAi key 集合一致
const keysOf = (l) => Object.keys(EDUAI[l] ?? EDUAI['zh-CN'])
const base = keysOf('zh-CN')
for (const l of LOCALES) {
  const ks = keysOf(l)
  const missing = base.filter((k) => !ks.includes(k))
  if (missing.length) console.log(`[WARN] ${l} 缺顶层 key: ${missing.join(',')}`)
}
console.log('[DONE] eduAi i18n 注入完成')
