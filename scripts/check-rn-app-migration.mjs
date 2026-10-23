#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * mobile-rn screen 迁移完整性守门(blocking,2026-07-29 立;**G-922 判据四修** 2026-10-21)
 *
 * 立门因由:P3-3.3「独立 screen 实现清零」后,mobile-rn 的 screen 若漏迁移到 @ihui/rn-app
 * 共享层,独立实现会回升、维护成本系数恶化。判据只有一份,就住在本文件。
 *
 * 〔G-922 本轮修的四处判据缺陷(净检出复量时量到)〕
 *   ① **ROOT 不再由 process.cwd() 定根** —— 共享工作树里 cwd 是谁的目录不由本门决定
 *      (AGENTS §15),现由 `import.meta.url` 自身位置推导(与守门 70/150 同型)。
 *   ② **不读盘**:screen 正文一律按面取(全量档=HEAD blob / `--staged`=索引 blob /
 *      `--worktree`=人工逃生舱),两面旗同给或取材失败 ⇒ exit 2「未判定」,绝不静默回落
 *      另一面(§0.4 / 守门 118)。旧实现 `readFileSync` 直取磁盘,读到的是并发会话此刻的
 *      现场,判出来的绿红跟被提交的内容无关。
 *   ③ **白名单带存活期 + 腐烂即红**:每枚登记必带 `why` 与 `expires`(§0.7 / 守门 108);
 *      到期即不再豁免;登记名在被审面 screens 清单里不存在 = 清单腐烂 ⇒ 红。本轮按现读
 *      摘除 DebugScreen.tsx / SquareScreen.tsx 两枚(两面均已不存在,豁免无的放矢),
 *      **存量归零后才把这一维设成红**(§0.2 恒红门禁令:升 blocking 的前置是存量归零)。
 *      同轮现扫登记块再摘三处**重名短账**(AgentCategories/PublishAccounts/aboutPageSections
 *      与后登详账同名 —— 对象字面量后键静默覆盖前键,重名即腐烂的另一形态,镜像 T9 锁死)。
 *   ④ **「1 条 import 就算已迁移」不再算数**:还得看 packages/app 共享层有没有同名的
 *      那个屏(文件同名或 `packages/app/src/index.ts` 导出同名符号),否则"已迁移 N 个"
 *      这个绿数不代表屏级共享。**这一维的存量只报数不判红**(枚数由门体当次运行现读打印),只拦
 *      "本次把它带进来"那一型(新增 screen / 基线原本有共享屏而被审面弄丢);全量档同样
 *      只报数 —— 存量没归零就升 blocking,是逼人 `--no-verify`(§0.2 明令)。
 *
 * 数字纪律(§0.1):头注不写死任何计数 —— screen 几枚、白名单几枚、存量几枚,一律以
 * 门体当次运行的输出为准(`--help` 只述判据,不做现读;现读数打在判定输出里)。
 * 写死数字三个月后必然腐烂成"文档说一套、门跑另一套"。
 *
 * CLI 用法:
 *   node scripts/check-rn-app-migration.mjs [--staged|--worktree] [--self-test] [--help]
 *
 * 退出码:0 绿 / 1 红 / 2 未判定(面取不到、两面旗同给、判据输入读不出)。
 *
 * 集成位置:guardian-runner.mjs 第 39 项(blocking)。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ① 定根:脚本自身位置推导,禁 process.cwd()(§15)。 */
export const ROOT = resolve(HERE, '..')
export const SCREENS_REL = 'apps/mobile-rn/src/screens'
export const APP_REL = 'packages/app/src'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/**
 * 白名单:允许独立实现的 RN 独占 screen。**每条必须带 why + expires**(§0.7)。
 * 到期 ⇒ 该枚不再豁免;要继续豁免就得按当刻现读重新登记(并写新理由)。
 * 登记了而文件已不在 ⇒ 清单腐烂判红(本轮已按现读摘除两枚,存量 0)。
 */
export const WHITELIST_ENTRIES = new Map(
  Object.entries({
    'profileMenuData.ts': {
      why: '数据文件:非 screen 组件,导出菜单配置数组',
      expires: '2027-06-30',
    },
    'profileContentTypes.ts': {
      why: '数据文件:非 screen 组件,导出 ProfileScreen 4 Tab 内容类型定义',
      expires: '2027-06-30',
    },
    // ── RN 独占 screen(无跨端需求,深度依赖 RN 特定 API/组件) ──
    'LearnMapScreen.tsx': {
      why: '学习地图屏:ScrollView 节点地图 + 进度环,共享层无同名屏,RN 端独占视觉交互',
      expires: '2027-06-30',
    },
    'LearnReviewScreen.tsx': {
      why: '学习复习屏:SM-2 复习队列 + 卡片翻转,共享层无同名屏,RN 端独占手势与动画',
      expires: '2027-06-30',
    },
    'UserArticlesScreen.tsx': {
      why: '用户文章屏:Image 封面 + FlatList 分页 + 下拉刷新,共享层无同名屏,RN 端独占列表交互',
      expires: '2027-06-30',
    },
    'VoiceSttScreen.tsx': {
      why: '语音转写屏:录音状态机 + 转写结果滚动区,共享层无同名屏,RN 端独占麦克风/权限通道',
      expires: '2027-06-30',
    },
    'UsageScreen.tsx': {
      why: '用量统计屏:模型用量条 + 周期切换,共享层无同名屏,RN 端独占统计视图',
      expires: '2027-06-30',
    },
    'UserFansScreen.tsx': {
      why: '粉丝列表屏:Image 头像 + ScrollView 分页 + 关注态切换,共享层无同名屏,RN 端独占列表交互',
      expires: '2027-06-30',
    },
    'ArticleHotScreen.tsx': {
      why: '热门文章屏:ScrollView 排行列表 + 热度排序,共享层无同名屏,RN 端独占列表交互',
      expires: '2027-06-30',
    },
    'ConnectedAccountsScreen.tsx': {
      why: '已连接账户屏:第三方账号绑定/解绑 + 状态徽章,共享层无同名屏,RN 端独占账号管理交互',
      expires: '2027-06-30',
    },
    'DistributionCompanyScreen.tsx': {
      why: '分销公司屏:公司信息表单 + 审核状态,共享层无同名屏,RN 端独占表单交互',
      expires: '2027-06-30',
    },
    'ImageGenGalleryScreen.tsx': {
      why: '图像生成画廊屏:Image 瀑布流 + 详情弹层,共享层无同名屏,RN 端独占图片浏览交互',
      expires: '2027-06-30',
    },
    'PublishAnalyticsScreen.tsx': {
      why: '发布分析屏:数据卡片 + 趋势条 + 周期切换,共享层无同名屏,RN 端独占统计视图',
      expires: '2027-06-30',
    },
    'AiAssistantN8nScreen.tsx': {
      why: 'N8n 工作流 AI 助手:streamChat SSE + VoiceInput + ModelConfigDialog + Drawer 历史对话,RN 端独占流式对话交互(L30 的"复用 @ihui/rn-app Drawer"仅是 doc comment,非 import)',
      expires: '2027-06-30',
    },
    'CoursePlanetScreen.tsx': {
      why: '课程星球:Carousel + KnowledgePlanet + MoreTitles,RN 端独占课程浏览交互',
      expires: '2027-06-30',
    },
    'MoreCourseScreen.tsx': {
      why: '更多课程:KnowledgePlanet + BottomFigure + CommissionFloatingIcon,RN 端独占课程列表',
      expires: '2027-06-30',
    },
    // ── 2026-10-24 摘除 CarteScreen.tsx / DeveloperScreen.tsx 两枚:两屏渲染已收进
    //    packages/app 同名共享屏(RN 端改为薄壳 import @ihui/rn-app),豁免无的放矢。──
    // ── 2026-10-24 摘除 RecruitmentScreen.tsx:渲染已收进 packages/app 同名共享屏,
    //    宣传表提到 packages/shared/src/constants/trader-plan-promo.ts(RN 端已真委托)。──
    'SubagentsScreen.tsx': {
      why: '子智能体屏:RN 独占 FlatList 队列交互 + api-client subagents 流,Web 端有独立实现',
      expires: '2027-06-30',
    },
    'WebPortalScreen.tsx': {
      why: 'Web 门户屏:RN WebView 全屏容器加载 web portal,RN 端独占 webview 壳',
      expires: '2027-06-30',
    },
    'CartScreen.tsx': {
      why: '购物车页:RN 端独占 WeChat 支付流程 + Native Stack 导航,Web/Miniapp 有独立 cart 实现',
      expires: '2027-06-30',
    },
    'TopicDetailScreen.tsx': {
      why: '话题详情:RN 端独占关注翻转 + 时间相对化 + 帖子详情流,Web/Miniapp 有独立实现',
      expires: '2027-06-30',
    },
    // ── 2026-10-23 摘除 AboutScreen.tsx 与 aboutPageSections.ts 两枚:富版已提升为共享真相源
    //    (packages/app/src/features/about/AboutScreen.tsx + 分段表
    //     packages/shared/src/constants/about-sections.ts),RN 端改为薄壳委托,端内分段数据件已删
    //    ⇒ 白名单无的放矢(留着即 §0.7 清单腐烂)。──
    // ── 2026-10-21 补登(HEAD 面 V1 红 3 条,逐条按现读判"无低成本真迁移";
    //     原块上方另有三枚同名的历史短账,重名静默覆盖 = 名单腐烂,已去重只留本份详账)──
    'AgentCategoriesScreen.tsx': {
      why: '智能体分类屏(405 行):本地 NavBar/NavChrome + useNavigation 跳 AgentDetail(第 30-39/265 行),分类详情与分类内智能体收进 Modal 弹层(web /agents/categories 与 /agents/categories/[id] 是两个独立路由);packages/app 现有 agent-market(AgentMarketScreen,搜索列表)与 category-detail(CategoryDetailScreen,按 Tab 的条目流)都不覆盖"分类列表 + 分类内智能体"这一形态,真共享需新写屏并重定 props 契约(>100 行),故 RN 独占',
      expires: '2027-06-30',
    },
    'PublishAccountsScreen.tsx': {
      why: '平台账号屏(443 行):扫码重新授权走 /api/publish/scan-login/start + 2.5s 轮询 + 关闭时 cancel(第 141-183 行),二维码用 RN Image 的 headers 带 Bearer(第 246-251/341-346 行,依赖 getToken 与 API_BASE_URL),解绑走本地 appAlert;packages/app 只有 PublishScreen(发布任务列表),web /publish/accounts 是 DOM 实现且另带批量导入/分组,无同名共享屏',
      expires: '2027-06-30',
    },
  }),
)

/** 兼容导出(镜像测试与历史调用方按名字集合取用);权威带期限的那一份是 WHITELIST_ENTRIES。 */
export const WHITELIST = new Set(WHITELIST_ENTRIES.keys())

export function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * ④ 的判据本体:文本内容里有没有真的 import 了 @ihui/rn-app。
 * (入参是**文本**不是路径 —— 本门不读盘,取材面由调用方定。)
 */
export function hasRnAppImport(text) {
  return /from\s+['"]@ihui\/rn-app(\/[^'"]+)?['"]/.test(String(text ?? ''))
}

/** `PaymentScreen.tsx` → `PaymentScreen`(④ 比对共享层同名用的屏名本体)。 */
export function stemOf(fileName) {
  return String(fileName).replace(/\.(tsx|ts|jsx|js)$/, '')
}

/**
 * 共享层"有这个屏"的证据集:packages/app/src 下的文件同名 stem ∪ index.ts 的导出符号。
 * 单一实现,门体与镜像测试都走它(§22c)。
 */
export function sharedScreenNames({ appFileRels = [], indexText = '' }) {
  const names = new Set()
  for (const rel of appFileRels) {
    const base = String(rel).split('/').pop()
    if (!base || base.startsWith('__')) continue
    if (/\.(tsx|ts|jsx|js)$/.test(base)) names.add(stemOf(base))
  }
  for (const m of String(indexText).matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\b/g)) names.add(m[1])
  return names
}

/** 到期判定(ISO 字典序)。到期 ⇒ 不再豁免(§0.7)。 */
export function isExpired(entry, today) {
  return String(entry?.expires ?? '') < today
}

/**
 * 判据汇总(纯函数,自检与镜像测试都打这里)。
 * @param {object} o
 * @param {Array<{name:string,text:string}>} o.screens 被审面的 screen 集
 * @param {Map<string,string|null>} o.baseline HEAD 面同路径正文;`null`/缺失 = 该屏是本次新增
 * @param {Set<string>} o.sharedNames 共享层同名集合(与被审面同轮取材)
 * @param {Set<string>} o.baselineSharedNames HEAD 面共享层同名集合(④ 棘轮锚点;缺省同 sharedNames)
 * @param {Set<string>} o.headScreenNames HEAD 面 screens 清单(③ 腐烂判据的取材面)
 * @param {boolean} o.fullAudit 全量档 ⇒ ④ 只报数不判红(§0.2 存量未归零)
 * @returns {{violations:Array, soft:Array, rot:Array, expired:Array, counted:number}}
 */
export function verdict({
  screens = [],
  baseline = new Map(),
  sharedNames = new Set(),
  baselineSharedNames = null,
  headScreenNames = new Set(),
  whitelist = WHITELIST_ENTRIES,
  today = isoToday(),
  fullAudit = false,
}) {
  const violations = []
  const soft = []
  const rot = []
  const expired = []

  for (const [name, entry] of whitelist) {
    if (isExpired(entry, today)) expired.push({ name, expires: entry.expires })
    // ③ 登记名在 HEAD 面 screens 清单里不存在 ⇒ 清单腐烂(摘除两枚后存量 0,故可判红)
    if (headScreenNames.size > 0 && !headScreenNames.has(name)) {
      rot.push({ name, why: entry.why })
    }
  }
  const liveWhitelist = new Set(
    [...whitelist].filter(([, e]) => !isExpired(e, today)).map(([name]) => name),
  )

  for (const { name, text } of screens) {
    const stem = stemOf(name)
    const hasImport = hasRnAppImport(text)
    const baseText = baseline.has(name) ? baseline.get(name) : null
    if (!hasImport) {
      if (!liveWhitelist.has(name)) {
        violations.push({
          name,
          code: 'V1',
          why: liveWhitelist.has(name) ? '' : '未 import @ihui/rn-app 且无有效豁免',
        })
      }
      continue
    }
    // ④ 有 import ≠ 屏级共享
    if (sharedNames.has(stem)) continue
    if (fullAudit) {
      soft.push({ name, code: 'V2', why: '有共享层 import,但 packages/app 无同名共享屏(存量,只报数)' })
      continue
    }
    if (baseText === null) {
      violations.push({ name, code: 'V2', why: '新增 screen 未走屏级共享(packages/app 无同名共享屏)' })
      continue
    }
    // 棘轮锚点 = HEAD 面那一枚自己:基线也缺同名共享屏 ⇒ 存量,只报数(§0.2)
    if (!(baselineSharedNames ?? sharedNames).has(stem)) {
      soft.push({ name, code: 'V2', why: '基线同形态存量(棘轮放过,只报数)' })
      continue
    }
    violations.push({ name, code: 'V2', why: '屏级共享被本次改动弄丢(packages/app 无同名共享屏)' })
  }
  return { violations, soft, rot, expired, counted: screens.length }
}

/** 面选择包装:两面旗同给 ⇒ 未判定(§0.4)。 */
export function pickFace(staged, worktree) {
  const picked = selectFace({ staged, worktree })
  if (picked.error) return { face: null, undetermined: true, reason: picked.error }
  return { face: picked.face, undetermined: false, reason: '' }
}

/**
 * ② 面取材:清单与正文**同面同轮**,取不到就抛(调用方落 exit 2,绝不回落另一面)。
 * @returns {{rels:string[], texts:Map<string,string>}} key 用仓库相对路径
 */
export function readFace(face, rel, opt = {}) {
  // 两种清单口径:`changedOnly` = 只取本次改动(screen 面用它,blocking 门不该判没碰的东西);
  // 缺省 = 取该面**完整**清单(共享层集合用它 —— 只按改动文件算共享层,等于把"别人没碰
  // packages/app"读成"共享层里没有这个屏",凭空造出 V2 红)。
  const listArgs =
    face === 'staged'
      ? opt.changedOnly
        ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', rel]
        : ['ls-files', '--cached', '--', rel]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', rel]
  const out = gitRaw(listArgs, ROOT, { timeout: 120000 })
  const rels = String(out ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((p) => p.startsWith(`${rel}/`))
  if (face === 'worktree') {
    const texts = new Map()
    for (const p of rels) {
      try {
        texts.set(p, readWorktreeFile(ROOT, p))
      } catch {
        /* 工作树面读不到 = 该行不在,交给调用方按缺失处理 */
      }
    }
    return { rels, texts }
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((p) => `${prefix}${p}`)
  const texts = new Map()
  if (specs.length > 0) {
    const got = catBatch(ROOT, specs, { timeout: 120000 })
    for (const s of specs) {
      const v = got.get(s)
      if (typeof v === 'string') texts.set(s.slice(prefix.length), v)
    }
  }
  return { rels, texts }
}

/** 自检:内存构造面(不跑真 git),逐维覆盖 + 反证。 */
export function selfTest() {
  const T = '2026-10-21'
  const wl = new Map([['AboutScreen.tsx', { why: 'RN 独占', expires: '2027-06-30' }]])
  const head = new Set(['AboutScreen.tsx', 'PaymentScreen.tsx', 'GhostScreen.tsx'])
  const shared = new Set(['PaymentScreen'])
  const cases = [
    {
      n: '① V1:无 import 且无豁免 ⇒ 红',
      v: verdict({
        screens: [{ name: 'ConnectorsScreen.tsx', text: 'export default function C(){}' }],
        baseline: new Map(),
        sharedNames: shared,
        headScreenNames: head,
        whitelist: wl,
        today: T,
      }),
      red: 1,
      soft: 0,
    },
    {
      n: '② V1:无 import 但在有效豁免内 ⇒ 绿',
      v: verdict({
        screens: [{ name: 'AboutScreen.tsx', text: 'export default function A(){}' }],
        baseline: new Map(),
        sharedNames: shared,
        headScreenNames: head,
        whitelist: wl,
        today: T,
      }),
      red: 0,
      soft: 0,
    },
    {
      n: '③ 到期:豁免过期 ⇒ 不再豁免 ⇒ 红 + 点名到期',
      v: verdict({
        screens: [{ name: 'AboutScreen.tsx', text: 'export default function A(){}' }],
        baseline: new Map(),
        sharedNames: shared,
        headScreenNames: head,
        whitelist: new Map([['AboutScreen.tsx', { why: 'x', expires: '2020-01-01' }]]),
        today: T,
      }),
      red: 1,
      soft: 0,
      expired: 1,
    },
    {
      n: '④ 腐烂:登记名在 HEAD 面 screens 里不存在 ⇒ 红',
      v: verdict({
        screens: [],
        baseline: new Map(),
        sharedNames: shared,
        headScreenNames: head,
        whitelist: new Map([['GhostScreen.tsx', { why: 'x', expires: '2027-06-30' }], ['NoSuchScreen.tsx', { why: 'y', expires: '2027-06-30' }]]),
        today: T,
      }),
      red: 0,
      soft: 0,
      rot: 1,
    },
    {
      n: '⑤ V2 棘轮:新增 screen 有 import 但共享层无同名 ⇒ 红(只拦新增)',
      v: verdict({
        screens: [{ name: 'BrandNewScreen.tsx', text: "import { X } from '@ihui/rn-app'" }],
        baseline: new Map(),
        sharedNames: shared,
        headScreenNames: head,
        whitelist: wl,
        today: T,
      }),
      red: 1,
      soft: 0,
    },
    {
      n: '⑥ V2 棘轮:基线同形态存量 ⇒ 只报数不判红(§0.2 存量未归零不得升 blocking)',
      v: verdict({
        screens: [{ name: 'OldScreen.tsx', text: "import { X } from '@ihui/rn-app'" }],
        baseline: new Map([['OldScreen.tsx', "import { X } from '@ihui/rn-app'"]]),
        sharedNames: shared,
        headScreenNames: head,
        whitelist: wl,
        today: T,
      }),
      red: 0,
      soft: 1,
    },
    {
      n: '⑦ V2:共享层有同名 ⇒ 绿(真屏级共享)',
      v: verdict({
        screens: [{ name: 'PaymentScreen.tsx', text: "import { PaymentScreen } from '@ihui/rn-app'" }],
        baseline: new Map(),
        sharedNames: shared,
        headScreenNames: head,
        whitelist: wl,
        today: T,
      }),
      red: 0,
      soft: 0,
    },
  ]
  let fails = 0
  let total = 0
  const check = (n, cond) => {
    total++
    if (cond) console.log(`✓ ${n}`)
    else {
      fails++
      console.log(`✗ ${n}`)
    }
  }
  for (const c of cases) {
    const got = c.v
    const ok =
      got.violations.length === (c.red ?? 0) &&
      got.soft.length === (c.soft ?? 0) &&
      (got.expired?.length ?? 0) === (c.expired ?? 0) &&
      (got.rot?.length ?? 0) === (c.rot ?? 0)
    check(
      `${c.n} —— 实得 红${got.violations.length}/报数${got.soft.length}/到期${got.expired.length}/腐烂${got.rot.length}`,
      ok,
    )
  }
  check(
    '⑦b V2 退化:基线有同名共享屏、被审面弄丢 ⇒ 红(棘轮只放过存量,不放过退化)',
    verdict({
      screens: [{ name: 'PaymentScreen.tsx', text: "import { Q } from '@ihui/rn-app'" }],
      baseline: new Map([['PaymentScreen.tsx', "import { PaymentScreen } from '@ihui/rn-app'"]]),
      sharedNames: new Set(),
      baselineSharedNames: new Set(['PaymentScreen']),
      headScreenNames: head,
      whitelist: wl,
      today: T,
    }).violations.length === 1,
  )
  // ⑧ 面纪律:两面旗同给 ⇒ 未判定
  const both = pickFace(true, true)
  check('⑧ 两面旗同给 ⇒ 未判定(exit 2,绝不回落另一面)', both.undetermined && both.reason !== '')
  const one = pickFace(true, false)
  check('⑧b 单旗 ⇒ 判面成立', !one.undetermined && one.face === 'staged')
  // ⑨ 判据有牙:把 import 锚点抽掉 ⇒ 判据必须翻
  check(
    '⑨ 反证:hasRnAppImport 对近邻包名 @ihui/rn-application 必须判假',
    hasRnAppImport("import { X } from '@ihui/rn-application'") === false &&
      hasRnAppImport("import { X } from '@ihui/rn-app'") === true,
  )
  check(
    '⑨b 反证:共享层同名集合空 ⇒ V2 必咬(恒绿实现撑不住)',
    verdict({
      screens: [{ name: 'ZzzScreen.tsx', text: "import { Q } from '@ihui/rn-app'" }],
      baseline: new Map(),
      sharedNames: new Set(),
      headScreenNames: head,
      whitelist: wl,
      today: T,
    }).violations.length === 1,
  )
  if (fails) console.log(`❌ 自检 ${total - fails}/${total} 例(${fails} 例失败)`)
  else console.log(`✅ 自检 ${total}/${total} 例全过`)
  return fails ? 1 : 0
}

function printHelp() {
  console.log(`
check-rn-app-migration.mjs — mobile-rn screen 迁移完整性守门(guardian 39)

用法:
  node scripts/check-rn-app-migration.mjs [--staged|--worktree] [--self-test] [--help]

面(§0.4,清单与正文同面同轮,取不到即 exit 2 未判定):
  无旗       全量档 = HEAD blob 面(④ 维只报数)
  --staged   索引 blob 面,只判本次带进来的改动(pre-commit 形态)
  --worktree 工作树面(人工逃生舱)

判据:
  V1 未 import @ihui/rn-app 且无有效豁免 ⇒ 红
  V2 有 import 但 packages/app 无同名共享屏 ⇒ 新增/退化即红,存量只报数
  V3 白名单登记名在被审面 screens 清单里不存在(清单腐烂)⇒ 红
  V4 豁免到期 ⇒ 不再豁免(须按当刻现读重新登记)
  面取不到 / 两面旗同给 ⇒ exit 2 未判定,不记绿也不冒红

退出码: 0 绿 / 1 红 / 2 未判定
`)
}

/** CLI 主体:返回退出码。 */
export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp()
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()

  const pick = pickFace(argv.includes('--staged'), argv.includes('--worktree'))
  if (pick.undetermined) {
    console.error(`[check-rn-app-migration] ⏭ 未判定:${pick.reason} ⇒ 不记绿也不冒红(§0.3/§0.4)`)
    return 2
  }
  const face = pick.face
  const faceName = face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工逃生舱)' : 'HEAD blob'
  const fullAudit = face === 'head'

  let faceScreens
  let headScreens
  let shared
  let baselineShared
  try {
    faceScreens = readFace(face, SCREENS_REL, { changedOnly: face === 'staged' })
    headScreens = readFace('head', SCREENS_REL)
    const sharedOf = (f) => {
      const a = readFace(f, APP_REL)
      return sharedScreenNames({
        appFileRels: a.rels,
        indexText: a.texts.get(`${APP_REL}/index.ts`) ?? '',
      })
    }
    shared = sharedOf(face === 'staged' ? 'staged' : 'head')
    baselineShared = sharedOf('head')
  } catch (e) {
    console.error(`[check-rn-app-migration] ⏭ 未判定:取材层取不到 ${faceName} 面(${e?.message ?? e})`)
    return 2
  }

  const headNames = new Set(headScreens.rels.map((p) => p.split('/').pop()))
  const screens = faceScreens.rels
    .map((p) => ({ name: p.split('/').pop(), text: faceScreens.texts.get(p) ?? '' }))
    .filter((s) => /\.(tsx|ts)$/.test(s.name))
  const baseline = new Map()
  for (const p of headScreens.rels) baseline.set(p.split('/').pop(), headScreens.texts.get(p) ?? '')
  for (const s of screens) if (!baseline.has(s.name)) baseline.set(s.name, null)

  const v = verdict({
    screens,
    baseline,
    sharedNames: shared,
    baselineSharedNames: baselineShared,
    headScreenNames: headNames,
    whitelist: WHITELIST_ENTRIES,
    today: isoToday(),
    fullAudit,
  })

  const bad = v.violations.length + v.rot.length
  const scope = `${faceName}面 ${screens.length} 枚`
  if (v.soft.length > 0) {
    console.log(
      `${C.yellow}ℹ️ 「有 import 但共享层无同名屏」存量 ${v.soft.length} 枚(只报数,不判红 —— §0.2 存量未归零不得升 blocking):${C.reset}`,
    )
    for (const s of v.soft.slice(0, 12)) console.log(`   · ${s.name} —— ${s.why}`)
    if (v.soft.length > 12) console.log(`   … 其余 ${v.soft.length - 12} 枚略`)
  }
  if (v.expired.length > 0) {
    console.log(`${C.yellow}ℹ️ 已到期豁免 ${v.expired.length} 枚(不再生效,须按当刻现读重新登记):${C.reset}`)
    for (const e of v.expired) console.log(`   · ${e.name} 到期 ${e.expires}`)
  }

  if (bad === 0) {
    console.log(
      `${C.green}✓ mobile-rn 迁移守门(${scope}):无未迁移 screen、白名单无腐烂条目${C.reset}`,
    )
    return 0
  }

  console.log('')
  console.log(`${C.red}${C.bold}❌ mobile-rn 迁移守门:${scope} 判 ${bad} 条${C.reset}`)
  if (v.violations.length > 0) {
    console.log(`${C.red}未迁移/未屏级共享:${C.reset}`)
    for (const x of v.violations) console.log(`  ${C.red}- ${x.name} [${x.code}] ${x.why}${C.reset}`)
  }
  if (v.rot.length > 0) {
    console.log(`${C.red}白名单腐烂(登记的文件在被审面 screens 清单里不存在):${C.reset}`)
    for (const r of v.rot) console.log(`  ${C.red}- ${r.name} —— ${r.why}${C.reset}`)
  }
  console.log('')
  console.log(`${C.bold}修复(二选一):${C.reset}`)
  console.log(`  ${C.magenta}A.${C.reset} 迁移:packages/app/src/features/<feature>/<Name>Screen.tsx 建共享组件 → index.ts 导出 → RN screen 改 wrapper(参考 PaymentScreen.tsx)`)
  console.log(`  ${C.magenta}B.${C.reset} 确属 RN 独占:在门体 WHITELIST_ENTRIES 登记并附 why + expires(到期须重新登记)`)
  console.log('')
  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`[check-rn-app-migration] 异常: ${e?.stack ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  ROOT,
  SCREENS_REL,
  APP_REL,
  WHITELIST,
  WHITELIST_ENTRIES,
  isoToday,
  isExpired,
  hasRnAppImport,
  stemOf,
  sharedScreenNames,
  verdict,
  pickFace,
  readFace,
  selfTest,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
