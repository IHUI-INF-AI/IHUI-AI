// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分页"卡住"的判定(票 G-816010)。
 *
 * 上游原型:`packages/ui/src/v4/conversationProjectionStore.ts` 的 `loadOlder` /
 * `loadAllOlder` 两处 —— ① `atLogEpoch !== current.logEpoch` **或** 窗口首行 `rowId`
 * 已移动 ⇒ 整批丢弃(注释原话:"防止把权威侧已移除的历史行复活");② 游标未推进 ⇒
 * 停止补拉并回 `retryable-failure`,**不是静默成功**。
 *
 * ## 为什么本仓只有第二条能抄,第一条只能改形
 *
 * 逐读结论(2026-10-07 现读,`git grep -nE "nextCursor" HEAD -- apps/web/src packages/shared/src`):
 * 我方**有**推进侧两处 —— 共享层 `packages/shared/src/chat/history-projection.ts` 的
 * `deriveHistoryBoundary`(那两行 `olderCursor / newerCursor: page.hasMore ? page.nextCursor : null`)
 * 与 `advanceHistoryPagingCursors`,加上端内滚动上翻的消费点
 * `apps/web/src/components/ai/ai-side-panel.tsx` 的 `handleLoadMoreHistory`(落点是
 * `oldestCursorRef.current = res.data.nextCursor` 那一行)—— 但两处都**没有**"游标未推进即判
 * 失败"的分支:响应给了什么游标就照单收,和本次请求带出去的那个是否相同从不比对。于是
 * `older.length === 0` 之外的另一种卡法完全无人看守 ——
 * 服务端把同一个游标再回一次、行也照样回一页,消费方就把它当"又翻到一页"收下,下一次上翻
 * 发出的是同一个游标、拿到的是同一页:**账面每次加载都成功,而更早的历史永远读不到**。
 * 用户侧表现是"滚到顶了但再也翻不出旧消息",日志零痕迹(本仓"失效形态是安静"那一族)。
 *
 * 第一条判据**不照抄** `logEpoch`:我方没有 epoch/水位通道(协议住在
 * `packages/shared/src/chat/projection-watermark.ts`,那是 SSE 投影帧的代次,不是分页行的
 * 版本),造一个空壳 epoch 只会让下一个读代码的人以为有水位协议、并把判据接到一个恒等的
 * 数上 —— 那比没有判据更糟。等价替代是**窗口首行的权威复核**:调用方在"发出请求前"与
 * "响应到达后"各对权威侧读一次窗口首行 id,两次不一致 ⇒ 权威侧在这次请求期间动过行
 * ⇒ 这一批不能拼进时间线(拼回去就是把已被移除的历史行复活)。**两个快照必须是同一段
 * 未提交窗口的两次权威读**,不是"折叠本页前/后"的窗口首行 —— 后者每次正常上翻都必然
 * 移动,拿它当输入等于把每一条正常翻页判成丢弃(反向锁③钉的就是这一误用的对立面)。
 * 本仓今天**还没有**这条权威重读通道,所以调用方拿不出证据时必须**不传**
 * `windowFront` ⇒ 判据落 `undetermined` 并报名,而不是默认"首行没动"。
 *
 * ## 三态绝不并桶
 *
 * 游标维:`advanced`(换到了下一跳)/ `stalled`(必须停并按可重试失败上报)/
 * `chain-exhausted`(服务端明说没有更多 —— 这不是失败,把它判成失败等于让每次翻到底都
 * 报错,而"乱报错"与"静默成功"是同一枚硬币的两面)/ `undetermined`(服务端根本没回游标
 * 字段,或本次没带游标因而没有比较基准)。
 * 首行维:`intact` / `moved` / `undetermined`。
 * 第四态与 `undetermined` **都不得折进 `advanced`**,也不得折进 `stalled`:把"没看清"
 * 写成"有问题"和写成"没问题"都是把尺子读歪。`undetermined` 一律停止补拉(带同一个游标
 * 再发一次就是 replay),但**不**产出 `retryable` —— 它要的是报名,不是弹窗。
 *
 * 纯函数:零 IO、零 `node:*`、零 React、零副作用(§3;`apps/web` 与共享层都可能消费它,
 * 而守门 126 判的是"可达面内出现内建导入")。
 */

/** 游标维的四种结论(见头注"三态绝不并桶")。 */
export type CursorAdvanceOutcome = 'advanced' | 'stalled' | 'chain-exhausted' | 'undetermined'

/** 窗口首行复核维的三种结论。 */
export type WindowFrontOutcome = 'intact' | 'moved' | 'undetermined'

/**
 * 判定所依据的每一条理由。闭集 —— 导出它不是为了好看:调用方要能把"这一维到底是被什么
 * 判成这个结论的"逐条报出来,而 `verdict` 本身不携带这个信息。
 */
export type PageAdvanceReason =
  /** 响应游标 ≠ 请求游标:正常推进。 */
  | 'cursor-advanced'
  /** 响应游标 == 请求游标:本次没有任何前进信息 ⇒ 卡住。 */
  | 'cursor-unchanged'
  /** 服务端声明还有更多,却没给出可继续的游标(null / 缺席)⇒ 继续拉注定空转,按卡住处理。 */
  | 'cursor-missing-while-has-more'
  /** 服务端明说没有更多(游标为 null 且未声明 hasMore)。 */
  | 'chain-exhausted'
  /** 响应**根本没有**游标这一项 ⇒ 游标维无法判定(不得当作推进)。 */
  | 'no-cursor-conclusion'
  /** 本次未带游标(首屏 / 整段重建)⇒ 没有可比的基准。 */
  | 'no-request-cursor'
  /** 权威重读的窗口首行两次一致。 */
  | 'front-intact'
  /** 权威重读的窗口首行两次不一致 ⇒ 权威侧在这次请求期间动过行。 */
  | 'front-moved'
  /** 调用方没给权威重读证据(或只给了一次)⇒ 首行维无法判定,如实报名而不是默认放行。 */
  | 'front-not-reread'
  /** 需要报"丢弃了多少行"却没传 `rows` ⇒ 计数无法给出(仍是丢弃,只是数量未知)。 */
  | 'row-count-unknown'

/** 参与首行复核的行形状:只需要一个稳定 id,不关心其余字段。 */
export interface PageAdvanceRow {
  readonly id: string
}

/**
 * 窗口首行的两次**权威侧**读数。`fromAuthority: true` 是调用方的书面担保(字面量类型,
 * 编译器拒绝从变量顺手填) —— 拿不出这条担保就不要传这个对象。
 */
export interface WindowFrontReread {
  readonly before: string | null
  readonly after: string | null
  readonly fromAuthority: true
}

export interface PageAdvanceInput {
  /** 本次请求实际带出去的游标;`null` = 没带(首屏 / 整段重建)。 */
  readonly requestCursor: string | null
  /**
   * 响应给的游标。三种写法各有含义,不要用其中一种去冒充另一种:
   * `string` = 下一跳落点;`null` = 服务端明说没有更多;**字段缺席 / `undefined`**
   * = 服务端没给结论(⇒ `no-cursor-conclusion`,不是"没有更多")。
   */
  readonly responseCursor?: string | null
  /** 服务端的 hasMore(缺席 = 服务端没声明,按"未声明"处理,不当作 true)。 */
  readonly responseHasMore?: boolean
  /** 本页返回的行(用于"整批丢弃"时把数量报出来);缺席 ⇒ `row-count-unknown`。 */
  readonly rows?: readonly PageAdvanceRow[]
  /** 权威侧窗口首行的两次读数;拿不到证据就不要传。 */
  readonly windowFront?: WindowFrontReread
}

export interface PageAdvanceResult {
  readonly cursor: CursorAdvanceOutcome
  readonly frontCheck: WindowFrontOutcome
  readonly reasons: readonly PageAdvanceReason[]
  /**
   * 这一批不得拼进时间线。两种来源:`front-moved`(权威侧动过行,拼回去会复活已删历史行)
   * 与 `stalled`(本次没有前进信息,收下它与 replay 不可区分,而重试本来就会重新取回)。
   */
  readonly discardBatch: boolean
  /** `discardBatch` 时本页被丢掉的行数;没传 `rows` ⇒ `null`(数量无法给出,但丢弃照旧)。 */
  readonly discardedRowCount: number | null
  /**
   * 必须按**可重试失败**上报(不是"成功且没有更多")。仅 `cursor === 'stalled'` 为真。
   */
  readonly retryable: boolean
  /** 消费方不得再带着同一游标继续补拉。`advanced` 之外一律为真。 */
  readonly stopPaging: boolean
}

/** 理由闭集(供调用方与测试反查"判据是否只会说它自己认识的那几句话")。 */
export const PAGE_ADVANCE_REASONS: readonly PageAdvanceReason[] = [
  'cursor-advanced',
  'cursor-unchanged',
  'cursor-missing-while-has-more',
  'chain-exhausted',
  'no-cursor-conclusion',
  'no-request-cursor',
  'front-intact',
  'front-moved',
  'front-not-reread',
  'row-count-unknown',
] as const

/** 游标维闭集。 */
export const CURSOR_ADVANCE_OUTCOMES: readonly CursorAdvanceOutcome[] = [
  'advanced',
  'stalled',
  'chain-exhausted',
  'undetermined',
] as const

/** 首行维闭集。 */
export const WINDOW_FRONT_OUTCOMES: readonly WindowFrontOutcome[] = [
  'intact',
  'moved',
  'undetermined',
] as const

/**
 * 响应里"有没有游标这一项"必须按**字段存在性**判,不能按值判 `=== undefined` ——
 * 服务端刻意回 `null`("没有更多")与路由压根没带这个键,是两件事:前者是有结论,
 * 后者是没结论。把它俩并成一桶,判据就会把"没看清"写成"到底了",于是永久缺页照旧静默。
 */
function hasCursorField(input: PageAdvanceInput): boolean {
  if (!Object.prototype.hasOwnProperty.call(input, 'responseCursor')) return false
  return input.responseCursor !== undefined
}

/** 首行维:两个权威读数的一致性与否则都不猜;证据不齐就落 undetermined。 */
function judgeWindowFront(
  windowFront: WindowFrontReread | undefined,
  reasons: PageAdvanceReason[],
): WindowFrontOutcome {
  if (windowFront === undefined) {
    reasons.push('front-not-reread')
    return 'undetermined'
  }
  const { before, after } = windowFront
  // 一致就是 intact —— 含"两次都读到窗口为空"这一形:null===null 是权威侧两次都说
  // "没有首行",那是一个结论,不是没读到,所以它落在 intact 而不是 undetermined。
  if (before === after) {
    reasons.push('front-intact')
    return 'intact'
  }
  reasons.push('front-moved')
  return 'moved'
}

/**
 * 判定一次翻页有没有真的往前走,以及这一批能不能拼进时间线。
 *
 * 判序是**先游标后首行**,两者互不顶账:游标推进了但权威窗口首行已移动 ⇒ 仍整批丢弃
 * (这正是上游那条"复活已删历史行"的形态 —— 游标对了不代表行集还对)。反过来游标卡住
 * 而首行一致 ⇒ 丢弃并按可重试失败上报,不报"复活"这一维。
 */
export function judgePageAdvance(input: PageAdvanceInput): PageAdvanceResult {
  const reasons: PageAdvanceReason[] = []

  // ── 维度一:游标 ────────────────────────────────────────────────────────────
  let cursor: CursorAdvanceOutcome
  if (!hasCursorField(input)) {
    cursor = 'undetermined'
    reasons.push('no-cursor-conclusion')
  } else {
    const responseCursor = input.responseCursor
    if (responseCursor === null) {
      // 服务端说"没有更多",却又声明还有 ⇒ 这是自相矛盾的响应,继续拉注定空转。
      // 归 stalled 而不是 chain-exhausted:chain-exhausted 的语义是"链合法地走完了",
      // 而这一格的实际后果与票面点名的"永久缺页"完全一致(共享层
      // `deriveHistoryBoundary` 就会产出 `hasOlder:true` 配 `olderCursor:null` 的这一页,
      // 消费方 `loadOlder` 随即 `if (!cursor) return` —— 静默停在半途)。
      if (input.responseHasMore === true) {
        cursor = 'stalled'
        reasons.push('cursor-missing-while-has-more')
      } else {
        cursor = 'chain-exhausted'
        reasons.push('chain-exhausted')
      }
    } else if (input.requestCursor === null) {
      // 首屏 / 整段重建:没有"上一次带出去的游标"可比,推进与否无从判。
      cursor = 'undetermined'
      reasons.push('no-request-cursor')
    } else if (responseCursor === input.requestCursor) {
      cursor = 'stalled'
      reasons.push('cursor-unchanged')
    } else {
      cursor = 'advanced'
      reasons.push('cursor-advanced')
    }
  }

  // ── 维度二:窗口首行的权威复核 ─────────────────────────────────────────────
  const frontCheck = judgeWindowFront(input.windowFront, reasons)

  // ── 合成给消费方的三个动作位 ───────────────────────────────────────────────
  const discardBatch = cursor === 'stalled' || frontCheck === 'moved'
  let discardedRowCount: number | null = null
  if (discardBatch) {
    if (input.rows === undefined) {
      discardedRowCount = null
      reasons.push('row-count-unknown')
    } else {
      discardedRowCount = input.rows.length
    }
  }

  return {
    cursor,
    frontCheck,
    reasons,
    discardBatch,
    discardedRowCount,
    // 只有 stalled 才是"失败":chain-exhausted 是合法终点,undetermined 是要报名的空白维。
    // 把后两者一起判成失败 = 每次翻到底 / 每个不回游标的接口都弹一次错(反向锁③的反面)。
    retryable: cursor === 'stalled',
    stopPaging: cursor !== 'advanced',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
