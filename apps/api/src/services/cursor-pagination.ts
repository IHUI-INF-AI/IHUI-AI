/**
 * O10④ 对外游标分页规范。
 *
 * **编解码内核不在这里** —— 仓里已有 `apps/api/src/utils/cursor-page.ts`(O10b 落的签名游标:
 * base64url body + HMAC 签名 + 归属/kind 指纹 + `has_more` 两条既有判据)。AGENTS §3 禁"两套真相",
 * 所以本模块只做三件它没有、且必须单点收口的**规范层**的事:
 *
 * 1. **档位常量**:`limit` 的默认值与上限只有一处定义,禁止各路由自定(那是"每文件一个数字"的老病)。
 * 2. **族绑定**:把 owner 维度 + 列表族折成 `CursorBinding`,让游标跨用户、跨列表族都不可复用。
 * 3. **信封形状**:本仓对外一律 `{ code, message, data }`(AGENTS §5),而 `cursor-page` 刻意不
 *    碰信封(它服务的是 OpenAI 兼容的 `first_id/last_id/has_more` 外壳)。这里补上这一层,
 *    使新建面与 `/v1` 各自保持自己的协议形状,而游标算法只有一份。
 *
 * 与 `page/pageSize`(内部 admin 面,`routes/admin/_shared.ts`)是**并存不是替换**:
 * 游标只服务对外面;内部面分页契约一个字节都不动。
 *
 * 本面(新建的对外 run 面)游标是**唯一**分页形态 —— 新契约不必兼容裸 `page`,
 * 因此不接 `page_format=cursor` 那个开关(它是为不改旧响应而生的兼容位)。
 */
import {
  CURSOR_KIND,
  decodeCursor,
  encodeCursor,
  isCursorToken,
  pageOf,
  readCursorPageRequest,
  type CursorBinding,
  type CursorDecode,
  type CursorKind,
  type HasMoreRule,
  type PageRequest,
} from '../utils/cursor-page.js'
import { success, type ApiSuccess } from '../utils/response.js'

// 内核原样透出:调用方只 import 一个入口,不需要知道内核实现在哪个目录。
export { CURSOR_KIND, decodeCursor, encodeCursor, isCursorToken, pageOf, readCursorPageRequest }
export type { CursorBinding, CursorDecode, CursorKind, HasMoreRule, PageRequest }
export {
  CURSOR_PAGE_FORMAT,
  CURSOR_PREFIX,
  PAGE_FORMAT_PARAM,
  clampLimit,
  resolveAfter,
  wantsCursorPageFormat,
  withNextCursor,
} from '../utils/cursor-page.js'

/** 对外列表的唯二分页档位。`max` 是硬上限:游标列表没有 total,填得越深越贵。 */
export const PAGE_LIMITS = { def: 20, max: 100 } as const
export interface PageLimits {
  def: number
  max: number
}

/**
 * run 族复用 `thread-runs` 这个已登记的 kind。
 * 新增第 6 个 kind 必须改 `utils/cursor-page.ts` 的 `CURSOR_KIND` 枚举(共享真相源),
 * 那属主会话的决定 —— 本票不擅自往枚举里塞值。跨用户/跨族的隔离由 `ownerKey` 承担,
 * 安全性不因此减弱:A 的游标在 B 的请求里仍解不开(`foreign-scope`)。
 */
export const RUNS_CURSOR_KIND: CursorKind = CURSOR_KIND.threadRuns

/** 把"谁在看哪个族"折成游标绑定;`ownerKey` 必须是该列表**实际的过滤维度**。 */
export function cursorBinding(
  ownerKey: string | number,
  kind: CursorKind = RUNS_CURSOR_KIND,
): CursorBinding {
  return { kind, ownerKey: String(ownerKey) }
}

export type PageQueryParse = { ok: true; request: PageRequest } | { ok: false; message: string }

/** 解析 `limit` + `after`:非法游标 → 错误消息(由路由回 400,**绝不**降级成"从头开始")。 */
export function readPageQuery(input: {
  query: Record<string, unknown>
  binding: CursorBinding
  secret: string
  limits?: PageLimits
}): PageQueryParse {
  const limits: PageLimits = input.limits ?? { ...PAGE_LIMITS }
  return readCursorPageRequest({
    query: input.query,
    binding: input.binding,
    secret: input.secret,
    limits,
  })
}

export interface CursorPageData<T> {
  items: T[]
  has_more: boolean
  next_cursor: string | null
}

export interface CursorPageResult<T> {
  envelope: ApiSuccess<CursorPageData<T>>
  /**
   * `after` 给了却在集合里找不到锚点(记录过期 / 被删)。
   * 内核按旧语义从头取,但**新面必须改判 400** —— 静默返回首页等于把翻页翻成重复数据。
   */
  anchorMissing: boolean
}

/** 由"该族全部条目(写入顺序)"算出一页 + 下一页游标,并套上本仓信封。 */
export function buildCursorPage<T>(input: {
  items: readonly T[]
  request: PageRequest
  idOf: (item: T) => string
  binding: CursorBinding
  secret: string
  /** 默认 `beyond-page`(锚点之后还有剩余才算还有下一页);`page-full` 留给 SCAN 类列表。 */
  hasMoreRule?: HasMoreRule
}): CursorPageResult<T> {
  const outcome = pageOf(input.items, {
    request: input.request,
    idOf: input.idOf,
    hasMoreRule: input.hasMoreRule ?? 'beyond-page',
    cursor: { binding: input.binding, secret: input.secret },
  })
  return {
    envelope: success<CursorPageData<T>>({
      items: outcome.data,
      has_more: outcome.has_more,
      next_cursor: outcome.next_cursor,
    }),
    anchorMissing: outcome.anchor_missing,
  }
}
