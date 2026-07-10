#!/usr/bin/env node
/**
 * Guard: education menu integration.
 * Ensures LearnAI / legacy learn-live-member learning entries are integrated under eduCenter.
 */
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')
const onlyStaged = process.argv.includes('--staged')

const files = {
  sidebar: path.join(clientRoot, 'src/components/Sidebar.vue'),
  eduRoutes: path.join(clientRoot, 'src/router/modules/edu.ts'),
  communityRoutes: path.join(clientRoot, 'src/router/modules/community.ts'),
  learnRoutes: path.join(clientRoot, 'src/router/modules/learn.ts'),
  liveMemberRoutes: path.join(clientRoot, 'src/router/modules/live-member.ts'),
  eduLayout: path.join(clientRoot, 'src/views/edu/index.vue'),
}

const triggers = [
  'client/src/components/Sidebar.vue',
  'client/src/router/modules/edu.ts',
  'client/src/router/modules/community.ts',
  'client/src/router/modules/learn.ts',
  'client/src/router/modules/live-member.ts',
  'client/src/views/edu/index.vue',
  'client/src/locales/modules/zh-CN/edu.json',
  'client/src/locales/modules/en/edu.json',
  'client/src/locales/modules/en-US/edu.json',
  'client/src/locales/modules/zh-TW/edu.json',
  'client/src/locales/modules/ja/edu.json',
  'client/src/locales/modules/ko/edu.json',
]

function stagedFiles() {
  try {
    return execSync('git diff --cached --name-only --diff-filter=ACMR', { cwd: projectRoot, encoding: 'utf-8' })
      .split('\n')
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter(Boolean)
  } catch {
    return null
  }
}

if (onlyStaged) {
  const staged = stagedFiles()
  if (staged && !triggers.some((t) => staged.includes(t))) {
    console.log('[staged] education menu integration files not staged, skip')
    process.exit(0)
  }
}

let failures = 0
function read(file) { return fs.readFileSync(file, 'utf-8') }
function fail(file, msg) {
  failures++
  console.error(`  [FAIL] ${path.relative(projectRoot, file)} ${msg}`)
}
function ok(msg) { console.log(`  [OK] ${msg}`) }
function expectIncludes(file, src, needle, msg) {
  if (!src.includes(needle)) fail(file, msg || `missing ${needle}`)
}

console.log('═══ Education menu integration guard ═══')

const sidebar = read(files.sidebar)
const topLearnAI = /items\s*:\s*\[[\s\S]*?\{\s*key\s*:\s*['"]learnAI['"][\s\S]*?path\s*:\s*['"]\/learn-ai['"][\s\S]*?children\s*:\s*\[/.test(sidebar)
if (topLearnAI) fail(files.sidebar, 'must not expose learnAI as standalone top-level nav item')
else ok('learnAI is no longer a standalone top-level Sidebar item')

const requiredSidebarKeys = [
  'eduLearnAI', 'eduCourses', 'eduMyCourses', 'eduLearnMap', 'eduLiveClass', 'eduMyLearning',
  'eduExam', 'eduAsk', 'eduCircle', 'eduPoint', 'eduOrder', 'eduMessage', 'eduNotification',
  'eduResource', 'eduSearch', 'eduAdmin',
]
for (const key of requiredSidebarKeys) {
  expectIncludes(files.sidebar, sidebar, `key: '${key}'`, `eduCenter.children missing key '${key}'`)
}

const requiredPrefixes = [
  "['/learn-ai', 'eduLearnAI']",
  "['/learn/list', 'eduCourses']",
  "['/learn/map', 'eduLearnMap']",
  "['/live', 'eduLiveClass']",
  "['/member/learn-record', 'eduMyLearning']",
  "['/edu/courses', 'eduCourses']",
  "['/edu/learn-map', 'eduLearnMap']",
]
for (const prefix of requiredPrefixes) expectIncludes(files.sidebar, sidebar, prefix, `prefixMap missing ${prefix}`)

const eduRoutes = read(files.eduRoutes)
const requiredEduRoutes = [
  "name: 'EduLearnAI'", "path: 'learn-ai'",
  "name: 'EduCourses'", "path: 'courses'",
  "name: 'EduCourseDetail'", "path: 'courses/detail/:id'",
  "name: 'EduLearnMap'", "path: 'learn-map'",
  "name: 'EduLiveDetail'", "name: 'EduLivePlay'",
  "name: 'EduMemberHomework'", "name: 'EduMemberCertificate'",
]
for (const needle of requiredEduRoutes) expectIncludes(files.eduRoutes, eduRoutes, needle, `edu.ts missing ${needle}`)

const community = read(files.communityRoutes)
expectIncludes(files.communityRoutes, community, "redirect: '/edu/learn-ai'", '/learn-ai must redirect to /edu/learn-ai')

const learn = read(files.learnRoutes)
for (const needle of ["redirect: '/edu/courses'", '`/edu/courses/detail/${to.params.id}`', "redirect: '/edu/learn-map'"]) {
  expectIncludes(files.learnRoutes, learn, needle, `learn route compatibility missing ${needle}`)
}

const liveMember = read(files.liveMemberRoutes)
for (const needle of ["redirect: '/edu/live'", '`/edu/live/detail/${to.params.id}`', "redirect: '/edu/member'"]) {
  expectIncludes(files.liveMemberRoutes, liveMember, needle, `live/member compatibility missing ${needle}`)
}

const layout = read(files.eduLayout)
expectIncludes(files.eduLayout, layout, ':default-active="activeMenu"', 'EduLayout must use activeMenu computed')
for (const key of ['edu.nav.learnAI', 'edu.nav.courses', 'edu.nav.myCourses', 'edu.nav.learnMap', 'edu.nav.notification']) {
  expectIncludes(files.eduLayout, layout, key, `EduLayout missing i18n key ${key}`)
}

const localeRequired = ['learnAI', 'courses', 'myCourses', 'learnMap', 'notification']
for (const locale of ['zh-CN', 'en', 'en-US', 'zh-TW', 'ja', 'ko']) {
  const file = path.join(clientRoot, `src/locales/modules/${locale}/edu.json`)
  const json = JSON.parse(read(file))
  const nav = json.edu?.nav || json.nav
  for (const key of localeRequired) {
    if (!nav || typeof nav[key] !== 'string' || nav[key].trim() === '') {
      fail(file, `missing edu.nav.${key}`)
    }
  }
}
ok('checked required Sidebar, route, layout and locale integration anchors')

if (failures > 0) {
  console.error(`\n[FAIL] ${failures} education menu integration violation(s)`)
  process.exit(1)
}
console.log('\n[OK] Education menu integration guard passed')
