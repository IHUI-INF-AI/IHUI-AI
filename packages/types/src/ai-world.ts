// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 世界跨端契约类型(2026-10-19 立,票「web↔移动端同一契约两份声明」的 6 字段那一族)。
 *
 * 取代端内两份逐字同形的分类声明:
 *   - apps/mobile-rn/src/screens/AiWorldScreen.tsx 的 `interface AiWorldCategory`
 *   - apps/web/app/(main)/ai-world/types.ts 的 `export interface AiCategory`
 * 改前把两份声明体做 sha256 归一化比较(剥类型名与前后空白、逐行折叠缩进),同值
 *   6931ea11e03bf1747f6150044990c97722b5bdca01b2e5521dba2a2936c393a2,
 * 确属同一件东西,故收成单源;两端只改 import,运行时一字未动。
 *
 * 命名取规范名 `AiWorldCategory`(域限定完整,与移动端旧名同名;不用 web 端 `AiCategory`
 * 泛名——那个名字在 admin sites 那份异形本地声明里也存在,并到共享层会误导读者)。
 * 与 `@ihui/database` schema 的 `AiWorldCategory`(Drizzle `$inferSelect` 行,额外含
 * status/createdAt/updatedAt 等落库列)同名而**不同形** —— 前端 apps/web 与 apps/mobile-rn
 * 从不 import `@ihui/database`,后端 apps/api 从不 import `@ihui/types` 的这个符号,
 * 两条消费面互不交叠,不构成消费歧义;若将来某处需要同文件同读两包,再择一改名。
 *
 * 明确**不并入**的相邻同族(票面已裁决,勿再动):
 *   - apps/web/app/(main)/admin/ai-world/sites/page.tsx 的 `AiCategory`(icon 非空 string,
 *     取源端点不同;下游 isIconKey(cat.icon) 会因放宽而 TS2345)。
 *   - 错题本那一族(WrongQuestionListItem 已就位,但两份端侧文件是 ui-routes 派生输入,
 *     卡在派生钉,不属本票)。
 * `apps/web/app/(main)/ai-world/[id]/PageClient.tsx` 的 3 字段本地 `AiWorldCategory` 与
 * 本契约是子集关系(该文件只读 .name/.icon),已随本票把端侧本地声明改为 import 本合同;
 * 端侧运行时未变。
 */

/** AI 世界分类条目(GET /api/ai-world 内嵌 categories 与 GET /api/ai-world/categories 同一形状)。 */
export interface AiWorldCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort: number
}

/** 权威榜单来源 ID。 */
export type AiWorldLeaderboardSourceId =
  | 'aa'
  | 'lmarena'
  | 'openrouter'
  | 'helm'
  | 'opencompass'
  | 'superclue'
  | 'livebench'
  | 'swebench'
  | 'epoch'

/** 通用榜单列定义；用于承载不同平台的异构字段。 */
export interface AiWorldLeaderboardBoardColumn {
  key: string
  label: string
  /** score=0-100 分；percent=百分比；usd=美元；tokens=token 数；params=参数量；seconds=秒；date=日期；text=文本；int=整数；bool=布尔 */
  kind?:
    'score' | 'percent' | 'usd' | 'tokens' | 'params' | 'seconds' | 'date' | 'text' | 'int' | 'bool'
}

/** 通用榜单行：保留原始字段值，不同平台不强行统一量纲。 */
export interface AiWorldLeaderboardBoardRow {
  rank: number
  model: string
  vendor: string
  openWeights?: boolean | null
  cn?: boolean
  params?: string | null
  /** 该榜主指标，仅用于卡片/排序；完整字段仍在 values 里。 */
  score?: number | null
  values: Record<string, string | number | boolean | null>
}

/** 一个平台的完整榜单（全量行，不在聚合层截断）。 */
export interface AiWorldLeaderboardBoard {
  id: string
  sourceId: AiWorldLeaderboardSourceId
  name: string
  shortName: string
  metric: string
  description: string
  url: string
  dataset?: string
  asOf: string
  boardSize: number
  /** false 表示官方页面快照，暂无法自动刷新；true 表示官方接口/文件可刷新。 */
  live: boolean
  note: string
  columns: AiWorldLeaderboardBoardColumn[]
  rows: AiWorldLeaderboardBoardRow[]
}

/** 权威榜数据来源卡片。 */
export interface AiWorldLeaderboardSource {
  id: AiWorldLeaderboardSourceId
  name: string
  metric: string
  url: string
  dataset?: string
  asOf: string
  boardSize: number
  note: string
}

/** 综合位次里某一家榜单的坐标。 */
export interface AiWorldLeaderboardCrossSource {
  rank: number
  score?: number
  tokens?: number
  share?: number
}

/** 综合位次行：模型家族级，按覆盖榜数与百分位均值排序。 */
export interface AiWorldLeaderboardCrossRow {
  rank: number
  key: string
  model: string
  vendor: string
  cn: boolean
  openWeights: boolean
  coverage: number
  aa: AiWorldLeaderboardCrossSource | null
  lm: AiWorldLeaderboardCrossSource | null
  or: AiWorldLeaderboardCrossSource | null
}

/** 全源平均总榜里某一家榜单的坐标。 */
export interface AiWorldLeaderboardOverallSource {
  rank: number
  total: number
  /** 该榜内百分位，0-100；第一名为 100，末位为 0。 */
  percentile: number
}

/** 全源平均总榜行：同一模型家族在九家官方榜内的名次百分位均值。 */
export interface AiWorldLeaderboardOverallRow {
  rank: number
  key: string
  model: string
  vendor: string
  cn: boolean
  openWeights: boolean
  /** 命中的官方榜数（0-9）。 */
  coverage: number
  /** 九家榜内百分位的等权平均值，0-100。 */
  averagePercentile: number
  sources: Partial<Record<AiWorldLeaderboardSourceId, AiWorldLeaderboardOverallSource>>
}

/** Artificial Analysis 单项评测分数。percent 为 0-100，raw 为官方原始分（如 Elo）。 */
export interface AiWorldLeaderboardAaBenchmark {
  key: string
  label: string
  score: number
  unit?: 'percent' | 'raw'
}

/** Artificial Analysis 单榜行。 */
export interface AiWorldLeaderboardAaRow {
  rank: number
  model: string
  vendor: string
  score: number
  openWeights: boolean
  cn: boolean
  /** 是否推理模型 */
  reasoning?: boolean
  /** 上下文窗口（tokens） */
  contextWindow?: number | null
  /** 输入价格，美元 / 百万 tokens */
  inputPrice?: number | null
  /** 输出价格，美元 / 百万 tokens */
  outputPrice?: number | null
  cacheHitPrice?: number | null
  cacheWritePrice?: number | null
  /** 输出速度，tokens / 秒 */
  outputSpeed?: number | null
  /** 首 token 延迟，秒 */
  ttft?: number | null
  /** 首答案 token 延迟，秒 */
  ttfa?: number | null
  /** AA 通识指数（-100 ~ 100） */
  omniscience?: number | null
  /** AA 单任务成本，美元 */
  costPerTask?: number | null
  /** AA 单任务耗时，秒 */
  timePerTask?: number | null
  paramClass?: string | null
  priceClass?: string | null
  release?: string | null
  /** AA 全部单项评测，按官方原始分归一到 0-100 */
  benchmarks?: AiWorldLeaderboardAaBenchmark[]
}

/** LMArena 单榜行。 */
export interface AiWorldLeaderboardLmRow {
  rank: number
  model: string
  vendor: string
  score: number
  ci: number
  votes: number
  license: string
  open: boolean
  /** 95% 置信区间下界 */
  ciLow?: number
  /** 95% 置信区间上界 */
  ciHigh?: number
  /** 官方方差 */
  variance?: number
}

/** LMArena 单个分类榜。 */
export interface AiWorldLeaderboardLmCategory {
  id: string
  label: string
  /** 该分类全量模型数 */
  count: number
  /** 该分类全量票数 */
  votes: number
  /** 该分类榜单全量行，不再截前 50 */
  rows: AiWorldLeaderboardLmRow[]
}

/** OpenRouter 真实用量单榜行。 */
export interface AiWorldLeaderboardOrRow {
  rank: number
  model: string
  vendor: string
  tokens: number
  share: number
  slug: string
  build: string | null
  free: boolean
}

/** 自动刷新元信息；fallback 表示 Redis 无快照、页面用内置静态底稿。 */
export interface AiWorldLeaderboardRefresh {
  mode: 'auto' | 'fallback'
  schedule: string
  timezone: string
  lastSuccessAt: string
  lastAttemptAt?: string
  lastError?: string | null
  stale: boolean
}

/**
 * `/api/ai-world/authoritative-leaderboard` 的完整响应体。
 *
 * 单一契约：服务端定时刷新写 Redis，Web 每次打开读最新快照；
 * 构建期的 `authoritative-leaderboard.json` 只作为 Redis 不可用时的兜底。
 */
export interface AiWorldAuthoritativeLeaderboard {
  schemaVersion: number
  generatedAt: string
  title: string
  subtitle: string
  sources: AiWorldLeaderboardSource[]
  methodology: string
  cross: AiWorldLeaderboardCrossRow[]
  /** 九家官方榜全源百分位平均总榜；覆盖榜数优先，再按平均百分位排序。 */
  overallAll: AiWorldLeaderboardOverallRow[]
  aa: AiWorldLeaderboardAaRow[]
  lmarena: {
    overall: AiWorldLeaderboardLmRow[]
    chinese: AiWorldLeaderboardLmRow[]
    overallVotes: number
    chineseVotes: number
    overallCount: number
    chineseCount: number
    /** LMArena 官方数据集里的全部分类榜 */
    categories?: AiWorldLeaderboardLmCategory[]
  }
  openrouter: AiWorldLeaderboardOrRow[]
  /** 新增平台全量榜：HELM、OpenCompass、SuperCLUE、LiveBench、SWE-bench、Epoch ECI、AA 全量档位。 */
  boards?: AiWorldLeaderboardBoard[]
  refresh: AiWorldLeaderboardRefresh
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
