// edu-ai manifest 生成器(Wave2):i18n 96 键五语逐条取自 web 同源文案,键名做扁平化映射。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const LANGS = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko']
const SUBS = ['aigc', 'cert', 'courses', 'policy', 'video']

const keys = fs
  .readFileSync('/tmp/eduai-keys.txt', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((k) => k.replace(/^eduAiPage\./, ''))
  .filter((k) => k !== 'common.back')

const SPECIAL = {
  certRequirements: ['cert', 'certificationRequirements'],
  policyLevelLabel: ['policy', 'policyLevel'],
  loadFailed: ['aigc', 'loadFailed'],
  next: ['aigc', 'next'],
  prev: ['aigc', 'prev'],
  page: ['aigc', 'page'],
  viewDetail: ['aigc', 'viewDetail'],
}

function resolveKey(web, key) {
  if (key === 'title') return typeof web.edu?.ai === 'string' ? web.edu.ai : undefined
  const sp = SPECIAL[key]
  if (sp) return web.eduAi?.[sp[0]]?.[sp[1]]
  for (const sub of SUBS) {
    if (key.startsWith(sub) && key.length > sub.length && /^[A-Z]/.test(key[sub.length])) {
      const rest = key.slice(sub.length)
      const camel = rest[0].toLowerCase() + rest.slice(1)
      const v = web.eduAi?.[sub]?.[camel]
      if (typeof v === 'string') return v
    }
  }
  return undefined
}

const i18n = {}
for (const lang of LANGS) {
  const web = JSON.parse(fs.readFileSync(path.join(ROOT, `packages/i18n/messages/web/${lang}.json`), 'utf8'))
  const ns = {}
  const missing = []
  for (const key of keys) {
    const v = resolveKey(web, key)
    if (typeof v === 'string') ns[key] = v
    else missing.push(key)
  }
  if (missing.length) {
    console.error(`${lang} 缺 ${missing.length} 键: ${missing.join(',')}`)
    process.exit(2)
  }
  i18n[lang] = { eduAiPage: ns }
}

const manifest = {
  domain: 'edu-ai',
  wave: 'wave2',
  unitScreen: 'EduAi(4 tab 枢纽)+ EduAiVideoCompose',
  newFiles: [
    'apps/mobile-rn/src/screens/EduAiHubScreen.tsx',
    'apps/mobile-rn/src/screens/EduAiVideoComposeScreen.tsx',
    'packages/app/src/features/edu-ai/EduAiHubScreen.tsx',
    'packages/app/src/features/edu-ai/EduAiVideoComposeScreen.tsx',
    'packages/app/src/features/edu-ai/edu-ai-styles.ts',
    'packages/api-client/src/endpoints/edu-ai.ts',
  ],
  indexExports: [
    "export { EduAiHubScreen } from './features/edu-ai/EduAiHubScreen'",
    "export type { EduAiTab, EduAiListState, EduAiAigcToolRow, EduAiCertRow, EduAiCourseRow, EduAiPolicyRow, EduAiHubScreenProps } from './features/edu-ai/EduAiHubScreen'",
    "export { EduAiVideoComposeScreen } from './features/edu-ai/EduAiVideoComposeScreen'",
    "export type { EduAiVideoStepName, EduAiVideoStepStatus, EduAiVideoStepRow, EduAiVideoTaskRow, EduAiVideoComposeScreenProps } from './features/edu-ai/EduAiVideoComposeScreen'",
  ],
  apiClientIndexExports: ["export * from './endpoints/edu-ai.js'"],
  navigator: [
    {
      import: "import { EduAiHubScreen } from '../screens/EduAiHubScreen'",
      param: "  EduAi: { tab?: 'aigc' | 'cert' | 'courses' | 'policy' } | undefined",
      screen: '<RootStack.Screen name="EduAi" component={EduAiHubScreen} />',
    },
    {
      import: "import { EduAiVideoComposeScreen } from '../screens/EduAiVideoComposeScreen'",
      param: '  EduAiVideoCompose: undefined',
      screen: '<RootStack.Screen name="EduAiVideoCompose" component={EduAiVideoComposeScreen} />',
    },
  ],
  i18n,
  ledger: [
    {
      web: 'edu-ai/aigc-tools',
      rn: 'apps/mobile-rn/src/screens/EduAiHubScreen.tsx',
      status: 'aligned',
      note: 'Wave2@2026-10-26: AIGC 工具库由四 tab 枢纽共享屏承载(tab=aigc),端点 getAigcTools/getAigcToolDetail(GET /api/ai-education/aigc-tool,web aigc-tools/page.tsx:174 同址);分页 12/页、category 七档筛选、关键词防抖与 web 同口径',
      at: '2026-10-26',
    },
    {
      web: 'edu-ai/certification',
      rn: 'apps/mobile-rn/src/screens/EduAiHubScreen.tsx',
      status: 'aligned',
      note: 'Wave2@2026-10-26: 教师 AI 认证由四 tab 枢纽共享屏承载(tab=cert),端点 getTeacherCertifications/getTeacherCertificationDetail(GET /api/ai-education/teacher-certification,web certification/page.tsx:113 同址);分页 10/页、level 四档筛选',
      at: '2026-10-26',
    },
    {
      web: 'edu-ai/courses',
      rn: 'apps/mobile-rn/src/screens/EduAiHubScreen.tsx',
      status: 'aligned',
      note: 'Wave2@2026-10-26: AI 课程由四 tab 枢纽共享屏承载(tab=courses),k12/university 双子页签分别走 getK12Curriculums 与 getUniversityCourses(web courses/page.tsx:85-86 同址),详情各按子页签取 curriculum/course 信封',
      at: '2026-10-26',
    },
    {
      web: 'edu-ai/policy',
      rn: 'apps/mobile-rn/src/screens/EduAiHubScreen.tsx',
      status: 'aligned',
      note: 'Wave2@2026-10-26: AI 教育政策库由四 tab 枢纽共享屏承载(tab=policy),端点 getEduPolicies/getEduPolicyDetail(GET /api/ai-education/policy,web policy/page.tsx:116 同址);policyLevel 三档筛选',
      at: '2026-10-26',
    },
    {
      web: 'edu-ai/video-compose',
      rn: 'apps/mobile-rn/src/screens/EduAiVideoComposeScreen.tsx',
      status: 'aligned',
      note: 'Wave2@2026-10-26: AI 视频编排新建共享屏承载,端点 createVideoComposeTask/getVideoComposeTask/regenerateVideoComposeTask(web video-compose/page.tsx:232/257/276 同址);后端无 GET 列表路由,任务列表随会话存活(与 web 同口径),3s 轮询仅在有 pending/running 任务时启动',
      at: '2026-10-26',
    },
  ],
}

const out = path.join(ROOT, '.ihui-agent/wave2/edu-ai.manifest.json')
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n')
console.log(`written ${out}; i18n keys=${keys.length} × ${LANGS.length}; ledger=${manifest.ledger.length}`)
