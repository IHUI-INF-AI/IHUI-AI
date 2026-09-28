#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * check-site-footer.mjs — SiteFooter 关键 class + namespace 守门
 *
 * 触发背景(2026-07-30 立,真实回退事故):
 * 多次 commit 后 SiteFooter 被回退到 v8 4 分组状态(丢 INTERNATIONAL_MODELS/CHINESE_MODELS 拆分),
 * 本守门脚本防止 v10/v11 关键改动再被回退。
 *
 * 守门项:
 * 1. SiteFooter.tsx 关键 className 不能变(py-2 md:py-3 / h-7 w-7 / h-16 w-16 / h-5 w-5 / xl:grid-cols-5)
 *    (2026-08-26 lg→xl:1024 视口内容区仅 470px,5 列每列 ~40px 放不下 h5 → grid 坍缩 16px;xl(≥1280) 内容区 726px 才够 5 列)
 * 2. ECOSYSTEM_GROUPS 必须是 5 分组(含 internationalModels / chineseModels)
 * 3. 必须 import INTERNATIONAL_MODELS / CHINESE_MODELS
 * 4. 单一 useTranslations('footer') 命名空间,禁止 tRoutes() / 其他 namespace
 * 5. footer-data.ts 必须导出 INTERNATIONAL_MODELS / CHINESE_MODELS
 * 6. 5 个 i18n 文件 footer 命名空间必须包含 internationalModels / chineseModels / agreementSubtitle / contactSubtitle
 *
 * 用法:
 *   node scripts/check-site-footer.mjs            # 单次守门(判定面 = 工作树磁盘)
 *   node scripts/check-site-footer.mjs --staged   # 提交链档:判定面 = 索引 blob
 *   node scripts/check-site-footer.mjs --worktree # 显式磁盘档(人工逃生舱)
 *   node scripts/check-site-footer.mjs --root <d> # 显式仓库根(测试/夹具通道)
 *   pnpm footer:guard                            # package.json 集成
 *
 * 判定面(2026-09-28 收口,与守门 70/118 及 2i 死 key 扫描同口径):
 *   本步是**批外 blocking**,旧形态把 SiteFooter.tsx / footer-data.ts / **5 个 web 语言包**
 *   一律按磁盘读 —— 语言包是全仓并发写入最热的面之一,别人一次未暂存的 footer 键改动就能
 *   把无关提交钉红,唯一出路是 --no-verify(一次绕过约等于链上全部守门作废,§12e/§12f)。
 *   `--staged` ⇒ 7 份输入在同一次 `cat-file --batch` 里取自**索引 blob**(清单与内容同面同轮);
 *   面上取不到 ⇒ **exit 2「未判定」并点名路径,绝不回退磁盘、绝不记为通过**。
 *   缺省 / `--worktree` ⇒ 磁盘,既有行为逐字不变。
 *
 * 退出码: 0=通过, 1=失败(判据红), 2=无法判定(未判定:取材失败 / 参数矛盾)
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { Undetermined, assertRepoRoot, catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** `--root <dir>` / `--root=<dir>` 两种形态都必须认(只认一种会让假根被静默忽略 ⇒ 扫真仓假绿)。 */
function resolveRootArg(list) {
  const eq = list.find((a) => a.startsWith('--root='))
  if (eq !== undefined) {
    const v = eq.slice('--root='.length)
    return v ? { root: resolve(v), error: null } : { root: null, error: '--root= 缺目录值' }
  }
  const i = list.indexOf('--root')
  if (i < 0) return { root: null, error: null }
  const v = list[i + 1]
  if (!v || v.startsWith('-')) return { root: null, error: '--root 必须带目录值' }
  return { root: resolve(v), error: null }
}
const argv = process.argv.slice(2)
const rootArg = resolveRootArg(argv)
if (rootArg.error) {
  console.error(`[check-site-footer] 无法判定(exit 2,未判定): ${rootArg.error}`)
  process.exit(2)
}
const ROOT = rootArg.root ?? resolve(__dirname, '..')

const facePick = selectFace({
  staged: argv.includes('--staged'),
  worktree: argv.includes('--worktree'),
  def: 'worktree',
})
if (facePick.error) {
  console.error(`[check-site-footer] 无法判定(exit 2,未判定): ${facePick.error}`)
  process.exit(2)
}
const FACE = facePick.face
const FACE_LABEL_TEXT = FACE === 'staged' ? '索引 blob' : '工作树磁盘'

function failUndetermined(what) {
  console.error(`[check-site-footer] 无法判定(exit 2,未判定): ${what}`)
  console.error('   这不是"SiteFooter 被回退",是这次判不了。**未判定 ≠ 通过**,也绝不回退磁盘。')
  process.exit(2)
}

/** rel(仓库根相对、正斜杠) → 索引 blob 文本;null = 未预载。 */
let faceIndex = null
/** 7 份输入一次读满(清单与内容同面同轮;混面取数会产出自洽却错位的尺子,守门 118)。 */
function ensureFaceIndex(rels) {
  if (faceIndex) return
  try {
    assertRepoRoot(ROOT, '本门')
  } catch (e) {
    if (e instanceof Undetermined) failUndetermined(`判定面基准不成立:${e.message}`)
    throw e
  }
  let got
  try {
    got = catBatch(ROOT, rels.map((r) => `:${r}`), { timeout: 120000 })
  } catch (e) {
    if (e instanceof Undetermined)
      failUndetermined(`索引面取材失败(**不回退磁盘**):${e.message}`)
    throw e
  }
  faceIndex = new Map()
  for (const r of rels) {
    const t = got.get(`:${r}`)
    if (typeof t === 'string') faceIndex.set(r, t)
  }
}
/** 按判定面读一份输入;返回 null = 该路径在**判定面**上取不到正文(文件不存在 / 非 blob)。 */
function faceRead(rel) {
  if (FACE !== 'staged') {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) return null
    let s
    try {
      s = readFileSync(abs, 'utf8')
    } catch (e) {
      // 读失败原样抛 ⇒ 顶层折成 exit 2:一个编码/权限错误不得伪装成"文件不存在"的业务结论。
      throw new Undetermined(`${FACE_LABEL_TEXT} 取不到 ${rel}: ${e.message}`)
    }
    return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
  }
  ensureFaceIndex(ALL_RELS)
  return faceIndex.get(rel) ?? null
}
/** 枚举/取材在预载阶段就完成,面上"没有这条路径"是真缺失(与磁盘档同语义 ⇒ 判红)。 */
function faceListed(rel) {
  if (FACE !== 'staged') return existsSync(join(ROOT, rel))
  ensureFaceIndex(ALL_RELS)
  let out
  try {
    out = gitRaw(['ls-files', '--', rel], ROOT, { timeout: 60000 })
  } catch (e) {
    if (e instanceof Undetermined) failUndetermined(`索引面存在性问不到 ${rel}:${e.message}`)
    throw e
  }
  return out.split(/\r?\n/).filter(Boolean).includes(rel)
}

const errors = []
const warnings = []

function check(label, cond, hint) {
  if (cond) {
    console.log(`  \u2713 ${label}`)
  } else {
    errors.push(`${label}${hint ? ' — ' + hint : ''}`)
    console.log(`  \u2717 ${label}${hint ? ' — ' + hint : ''}`)
  }
}

// 1. SiteFooter.tsx 关键 class 守门
const SF_REL = 'apps/web/src/components/marketing/SiteFooter.tsx'
const FD_REL = 'apps/web/src/components/marketing/footer-data.ts'
/** 本门全部输入(索引面一次读满的清单)。 */
const ALL_RELS = [
  SF_REL,
  FD_REL,
  'packages/i18n/messages/web/zh-CN.json',
  'packages/i18n/messages/web/en.json',
  'packages/i18n/messages/web/zh-TW.json',
  'packages/i18n/messages/web/ko.json',
  'packages/i18n/messages/web/ja.json',
]

if (!faceListed(SF_REL)) {
  errors.push(`SiteFooter.tsx 不存在(判定面:${FACE_LABEL_TEXT}): ${SF_REL}`)
} else {
  console.log('\n[1/6] SiteFooter.tsx 关键 class 守门')
  const sf = faceRead(SF_REL) ?? ''
  check('py-2 md:py-3 padding(v10 拉高)', /py-2[^\n]*md:py-3/.test(sf), 'v10 footer 高度 ~140px 关键')
  check('h-7 w-7 icon box', /h-7 w-7/.test(sf), 'icon 容器尺寸')
  check('h-16 w-16 QR box', /h-16 w-16/.test(sf), 'QR 码容器尺寸')
  check('h-5 w-5 ICP icon', /h-5 w-5 object-contain/.test(sf), '备案图标尺寸')
  check('xl:grid-cols-5 生态合作 5 列', /xl:grid-cols-5/.test(sf), '5 类分组 1 行布局(2026-08-26 lg→xl 防窄内容区坍缩)')
  check('useTranslations(\'footer\') 单一命名空间', /useTranslations\(['"]footer['"]\)/.test(sf))
  check('无 tRoutes() 残留(跨 namespace 拼接)', !/tRoutes\(/.test(sf), 'SiteFooter 不应跨 namespace')
  check('ECOSYSTEM_GROUPS 含 5 项', (sf.match(/titleKey:/g) ?? []).length >= 5, '5 个分组')
  check(
    'ECOSYSTEM_GROUPS 含 internationalModels',
    /titleKey:\s*['"]internationalModels['"]/.test(sf)
  )
  check('ECOSYSTEM_GROUPS 含 chineseModels', /titleKey:\s*['"]chineseModels['"]/.test(sf))
  check('import INTERNATIONAL_MODELS', /INTERNATIONAL_MODELS/.test(sf))
  check('import CHINESE_MODELS', /CHINESE_MODELS/.test(sf))
}

// 2. footer-data.ts 导出守门
if (!faceListed(FD_REL)) {
  errors.push(`footer-data.ts 不存在(判定面:${FACE_LABEL_TEXT}): ${FD_REL}`)
} else {
  console.log('\n[2/6] footer-data.ts 导出守门')
  const fd = faceRead(FD_REL) ?? ''
  check('export const INTERNATIONAL_MODELS', /export const INTERNATIONAL_MODELS/.test(fd))
  check('export const CHINESE_MODELS', /export const CHINESE_MODELS/.test(fd))
  check('MODELS 数组保留(BrandMarquee 依赖)', /export const MODELS/.test(fd))
  // 数国际/国产模型组里 nameKey 出现次数(应各 4 个)
  // 用 [\s\S]*? 跨行匹配 + 平衡数组结束符]
  const intlIdx = fd.indexOf('INTERNATIONAL_MODELS')
  const cnIdx = fd.indexOf('CHINESE_MODELS')
  const intlEnd = intlIdx >= 0 ? fd.indexOf('\n]', intlIdx) : -1
  const intlBlock = intlIdx >= 0 && intlEnd >= 0 ? fd.slice(intlIdx, intlEnd) : ''
  const intlCount = (intlBlock.match(/nameKey:/g) ?? []).length
  check(`INTERNATIONAL_MODELS 含 4 个模型(实际 ${intlCount})`, intlCount === 4)

  const cnEnd = cnIdx >= 0 ? fd.indexOf('\n]', cnIdx) : -1
  const cnBlock = cnIdx >= 0 && cnEnd >= 0 ? fd.slice(cnIdx, cnEnd) : ''
  const cnCount = (cnBlock.match(/nameKey:/g) ?? []).length
  check(`CHINESE_MODELS 含 4 个模型(实际 ${cnCount})`, cnCount === 4)
}

// 3-6. 5 个语言 i18n 守门
const i18nFiles = [
  { lang: 'zh-CN', file: 'packages/i18n/messages/web/zh-CN.json' },
  { lang: 'en', file: 'packages/i18n/messages/web/en.json' },
  { lang: 'zh-TW', file: 'packages/i18n/messages/web/zh-TW.json' },
  { lang: 'ko', file: 'packages/i18n/messages/web/ko.json' },
  { lang: 'ja', file: 'packages/i18n/messages/web/ja.json' },
]

console.log(`\n[3-6/6] 5 语言 footer 命名空间关键 key 守门(判定面:${FACE_LABEL_TEXT})`)
const requiredKeys = [
  'internationalModels',
  'chineseModels',
  'agreementSubtitle',
  'contactSubtitle',
  'userAgreement',
  'privacyPolicy',
  'aboutUs',
  'contactUs',
  'companyName',
  'icp',
  'copyright',
]
for (const { lang, file } of i18nFiles) {
  if (!faceListed(file)) {
    errors.push(`${lang} 文件不存在(判定面:${FACE_LABEL_TEXT}): ${file}`)
    continue
  }
  const raw = faceRead(file)
  let json
  try {
    json = JSON.parse(raw ?? '{}')
  } catch (e) {
    errors.push(`${lang} ${file} 解析失败(判定面:${FACE_LABEL_TEXT}): ${e.message}`)
    continue
  }
  const footer = json.footer
  if (!footer) {
    errors.push(`${lang} 缺 footer 命名空间`)
    continue
  }
  for (const key of requiredKeys) {
    const val = footer[key]
    if (val === undefined) {
      errors.push(`${lang} footer.${key} 缺失`)
    } else if (typeof val === 'string' && val.trim() === '') {
      errors.push(`${lang} footer.${key} 为空字符串`)
    } else if (val === null) {
      errors.push(`${lang} footer.${key} 为 null`)
    }
  }
  // 嵌套 key 守门
  for (const k of ['claude', 'gpt', 'gemini', 'deepseek', 'qwen', 'doubao', 'llama', 'mistral']) {
    if (!footer.modelItems?.[k] || String(footer.modelItems[k]).trim() === '') {
      errors.push(`${lang} footer.modelItems.${k} 缺失或为空`)
    }
  }
  for (const k of ['mongodb', 'mysql', 'postgresql', 'redis', 'sqlite']) {
    if (!footer.databases?.[k] || String(footer.databases[k]).trim() === '') {
      errors.push(`${lang} footer.databases.${k} 缺失或为空`)
    }
  }
  if (errors.length === 0 || errors.every((e) => !e.startsWith(lang + ' '))) {
    console.log(`  \u2713 ${lang} 全部 ${requiredKeys.length + 13} 个 key 完整`)
  }
}

// 输出汇总
console.log('\n========================================')
if (errors.length === 0) {
  console.log(`\u2705 SiteFooter 守门全部通过(警告 ${warnings.length} 条)`)
  process.exit(0)
} else {
  console.log(`\u274c SiteFooter 守门失败: ${errors.length} 个错误`)
  for (const e of errors) console.log(`   - ${e}`)
  if (warnings.length > 0) {
    console.log(`\n警告 ${warnings.length} 条:`)
    for (const w of warnings) console.log(`   - ${w}`)
  }
  console.log('\n修复提示:')
  console.log('  1. 检查 SiteFooter.tsx 是否被回退到 v8 4 分组状态')
  console.log('  2. 确认 footer-data.ts 导出 INTERNATIONAL_MODELS / CHINESE_MODELS')
  console.log('  3. 5 语言文件 footer 命名空间必须包含 internationalModels / chineseModels / agreementSubtitle / contactSubtitle')
  process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
