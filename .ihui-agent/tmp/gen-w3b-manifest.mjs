// W3-B manifest:user/sign-up(新建)。另两条 user/* 经核后端无注册面 ⇒ 不改判,留在 gap。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const LANGS = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko']
const KEYS = ['title', 'loading', 'empty', 'statusDraft', 'statusPublished', 'statusRejected', 'statusCompleted']

const i18n = {}
for (const l of LANGS) {
  const web = JSON.parse(fs.readFileSync(path.join(ROOT, `packages/i18n/messages/web/${l}.json`), 'utf8'))
  const src = web.user?.['sign-up']
  if (!src) {
    console.error(`${l} 缺 user.sign-up 命名空间 ⇒ 未判定,不落盘`)
    process.exit(2)
  }
  const ns = {}
  const miss = []
  for (const k of KEYS) {
    if (typeof src[k] === 'string') ns[k] = src[k]
    else miss.push(k)
  }
  if (miss.length) {
    console.error(`${l} 缺键 ${miss.join(',')} ⇒ 未判定,不落盘`)
    process.exit(2)
  }
  i18n[l] = { signUpPage: ns }
}

const manifest = {
  domain: 'sign-up',
  wave: 'wave3-b',
  unitScreen: 'SignUpScreen(我的报名:课程 + 试卷两路聚合)',
  newFiles: [
    'packages/api-client/src/endpoints/sign-ups.ts',
    'packages/app/src/features/sign-up/SignUpScreen.tsx',
    'apps/mobile-rn/src/screens/SignUpScreen.tsx',
  ],
  indexExports: [
    "export { SignUpScreen } from './features/sign-up/SignUpScreen'",
    "export type { SignUpRowView, SignUpStatusView, SignUpScreenProps } from './features/sign-up/SignUpScreen'",
  ],
  apiClientIndexExports: ["export * from './endpoints/sign-ups.js'"],
  navigator: [
    {
      import: "import { SignUpScreen } from '../screens/SignUpScreen'",
      param: '  SignUp: undefined',
      screen: '<RootStack.Screen name="SignUp" component={SignUpScreen} />',
    },
  ],
  i18n,
  ledger: [
    {
      web: 'user/sign-up',
      rn: 'apps/mobile-rn/src/screens/SignUpScreen.tsx',
      status: 'aligned',
      note:
        'Wave3-b@2026-10-27: 新建共享屏 packages/app/src/features/sign-up/SignUpScreen.tsx + 薄壳 + 端点 packages/api-client/src/endpoints/sign-ups.ts;' +
        '后端契约现读 = GET /api/sign-ups?userId= (apps/api/src/routes/sign-ups.ts:40 经 routes/index.ts:868 以 prefix /api/sign-ups 注册,' +
        'preHandler requireAuth,非本人且非 admin 拒于 sign-ups.ts:45-47);响应为 lessonSignUps⨝lessons 与 examSignups⨝examPapers 两路聚合,' +
        '各自过 LESSON_STATUS_MAP/EXAM_STATUS_MAP 归一到 draft|published|rejected|completed 再按 createdAt 倒序合并,回 success({list,total});' +
        '状态四档文案取自 web 同 ns(user.sign-up),targetType 与 web 同形原文渲染(web 未给它建键,不自造译文);未登录不发注定 401 的查询(同 web useAuthGate)。',
      at: '2026-10-27',
    },
  ],
  notLanded: [
    {
      web: 'user/comment',
      verdict: '保持 gap(不改判)',
      why:
        'web 页打 GET /api/comments?authorId=(apps/web/app/(main)/user/comment/page.tsx:39),后端无此注册面:' +
        'apps/api/src/routes/comments.ts 只有 /comments/:id 与 /comments/:id/replies|like 等(现读 295/347/368/382/392 行),无列表 GET;' +
        '且 /api/comments/mine 在 apps/api 全仓零命中 ⇒ 该功能没有可用数据源,铺屏=造点了没反应的按钮,不按"消红"口径改判。',
    },
    {
      web: 'user/resource',
      verdict: '保持 gap(不改判)',
      why:
        'web 页打 GET /api/resources?authorId=(apps/web/app/(main)/user/resource/page.tsx:26),后端同样无注册面:' +
        'apps/api/src/routes 全仓 grep get(\'/resources\' 零命中(social.ts:653 命中的是 /tags/:id/resources,不同契约),' +
        'authorId 在 resource.ts/social.ts 零出现;/api/resources/mine 亦零命中 ⇒ 同上不改判。',
    },
  ],
}

const out = path.join(ROOT, '.ihui-agent/wave3/w3b.manifest.json')
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n')
console.log(`written ${out}`)
console.log('ledger', manifest.ledger.length, 'notLanded', manifest.notLanded.length, 'i18n keys', KEYS.length, '×', LANGS.length)
