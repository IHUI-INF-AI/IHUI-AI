// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 证据编号公开核验判据(2026-11-25 立,第二十件)。纯函数,零 IO。
 *
 * 为什么要这一件:对外文案里写着「编号可被任何第三方核验」,但技术上此前只有内部能验 ——
 * 攻击者拿到 EV-xxx 无从核对。**承诺悬空比不承诺更糟**:它把一个未兑现的能力写在了
 * 攻击者会读到的页面上。这一层的任务就是把这个承诺变成可执行的事实。
 *
 * 三条设计纪律(每条都是为了「能给对方看」而不是「自己看着爽」):
 *   ① **只给哈希,不给详情**。核验要回答的是「这条记录存在、且没被改」,
 *      不需要把攻击者自己的 IP / UA / 载荷再回显给他。回显等于二次投递。
 *   ② **自证方式必须写在回执里**。第三方不该需要读我们的源码才知道怎么算 ——
 *      四要素与算法直接给出去,他拿计算器就能复核。
 *   ③ **带上覆盖该条的最新外锚**。哈希自证只证明「我没改」,证明不了「我什么时候有的」;
 *      外锚(独立时间戳)才回答后者。没有锚的条目如实写 `anchor: null`,不编一个。
 */

export const VERIFY_STATE = Object.freeze({
  FOUND: 'found',
  NOT_FOUND: 'not_found',
  INVALID: 'invalid',
  /**
   * 已开票但尚未入链(2026-11-25 实测补上的一态)。
   *
   * 拦下攻击者那一刻就生成编号、立刻写进告知日志,而**入链**由 autoban 每 10 分钟
   * 吸收一轮。若不给这一态,攻击者拿编号立刻来查会得到 `not_found` ——
   * 那等于告诉他"这编号是编的",承诺悬空的第二版。已开票 ≠ 没有:前者是"正在写入",
   * 后者是"我没记录过"。把两者混成一句是取证系统最不该犯的错。
   */
  PENDING: 'pending',
})

/** EV 编号的形态:`EV-` + 6~12 位大写十六进制。 */
export const EV_RE = /^EV-[0-9A-F]{6,12}$/

/** 归一化:去空白、转大写。不合形态返回空串(由调用方判 invalid)。 */
export function normalizeEv(input) {
  const s = String(input == null ? '' : input).trim().toUpperCase()
  if (!EV_RE.test(s)) return ''
  return s
}

/**
 * 从链条目里按编号找出那一条。
 * @param {{ref?:string|null}[]} entries
 * @returns {{entry:object, index:number}|null}
 */
export function findEntry(entries, ev) {
  const want = normalizeEv(ev)
  if (!want) return null
  const list = Array.isArray(entries) ? entries : []
  for (let i = 0; i < list.length; i += 1) {
    if (String(list[i]?.ref ?? '').toUpperCase() === want) return { entry: list[i], index: i }
  }
  return null
}

/**
 * 找「覆盖该条」的最近一个外锚。
 *
 * 覆盖 = 锚的时刻链里已经包含这条,即 `anchor.payload.seq >= 目标 seq`。
 * 取**最早**满足条件的那个锚,而不是最新 —— 越早越能证明「这条在当时就已经存在」,
 * 用最新的锚只能说明「现在存在」,削弱了证据的时间效力。
 *
 * @param {{payload?:object,anchorHash?:string}[]} anchors
 * @param {number} seq
 */
export function anchorCovering(anchors, seq) {
  const list = Array.isArray(anchors) ? anchors : []
  for (let i = 0; i < list.length; i += 1) {
    const p = list[i]?.payload ?? {}
    if (typeof p.seq === 'number' && p.seq >= seq) {
      return {
        ring: i + 1,
        at: p.ts ?? null,
        seq: p.seq,
        chainHead: p.chainHead ?? null,
        anchorHash: list[i]?.anchorHash ?? null,
      }
    }
  }
  return null
}

/**
 * 自证说明:把算法原样交给对方,他不需要读我们的代码。
 */
export function proofOf(entry) {
  return {
    formula: 'sha256(`${seq}|${prevHash}|${ts}|${payloadHash}`) === hash',
    fields: {
      seq: entry?.seq ?? null,
      prevHash: entry?.prevHash ?? null,
      ts: entry?.ts ?? null,
      payloadHash: entry?.payloadHash ?? null,
      hash: entry?.hash ?? null,
    },
    genesis: '0'.repeat(64),
    note: 'prevHash 指向上一条的 hash;从 GENESIS(64 个 0)开始逐条串到本条,任何一条被改动,本条及其后全部对不上。',
  }
}

/**
 * 主入口:给编号,给回执。
 *
 * `noticedAt` = 该编号在**告知日志**里的开出时刻(由调用方从 `block-notice.jsonl` 取)。
 * 链里查不到但告知日志里有 ⇒ `pending`(已开票、写入中),不是 `not_found`。
 *
 * @param {{entries:object[], anchors?:object[], ev:string, noticedAt?:string|null}} args
 */
export function buildReceipt({ entries, anchors = [], ev, noticedAt = null } = {}) {
  const norm = normalizeEv(ev)
  if (!norm) {
    return {
      state: VERIFY_STATE.INVALID,
      reason: '编号形态不合法(应为 EV- 加 6~12 位十六进制)',
      receipt: null,
    }
  }
  const hit = findEntry(entries, norm)
  if (!hit) {
    if (noticedAt) {
      return {
        state: VERIFY_STATE.PENDING,
        reason: '该编号已开票,正在写入证据链',
        receipt: {
          ev: norm,
          found: false,
          pending: true,
          noticedAt,
          note: '拦截发生时已开票并写入告知日志,入链由后台每 10 分钟吸收一轮;稍后重查即返回完整自证回执。',
        },
      }
    }
    /* 不存在与「不合法」分开:前者是真实反馈(这个编号确实不在册),后者是输入错误 */
    return {
      state: VERIFY_STATE.NOT_FOUND,
      reason: '该编号不在证据链中',
      receipt: { ev: norm, found: false },
    }
  }
  const total = Array.isArray(entries) ? entries.length : 0
  const anchor = anchorCovering(anchors, hit.entry.seq)
  return {
    state: VERIFY_STATE.FOUND,
    reason: '在册',
    receipt: {
      ev: norm,
      found: true,
      seq: hit.entry.seq,
      at: hit.entry.ts ?? null,
      hash: hit.entry.hash ?? null,
      chainLength: total,
      /* 只给锚的元信息,不给整份链 */
      anchor,
      /* 编号在链中的位置(从 0 起),让"第 N 条"这类说法可被外部对上 */
      position: hit.index,
      proof: proofOf(hit.entry),
    },
  }
}

/**
 * 批量区间核验(2026-11-25 补,第二十一件)。纯函数,零 IO。
 *
 * 为什么单个编号核验之外还要这一件:单个编号只能证明「这一条在册且未改」,
 * 证明不了「这一整段都是连续的、中间没有被人挖掉一段再补一段」。攻击者/研究者
 * 想验"从 seq A 到 seq B 全部存在且首尾相连"时,单条查询要发 N 次请求、且
 * 连接关系得自己拼 —— 那等于让他做本该由我们交出的工作。
 *
 * 三条纪律:
 *   ① 区间有缺口就**如实报缺口**(`gaps` + `complete:false`),不用"过滤掉缺的"冒充完整。
 *      这是本层最容易犯的错:数组拼起来看着挺整齐,但中间少了一条就等于链断过。
 *   ② 逐条给出 `prevHash`,并**由本层独立验一遍首尾相接** (`broken`)。
 *      第三方不必自己拼:回执直接告诉他"这段是连着的/哪里断的"。
 *   ③ 跨度有上限(`RANGE_MAX_SPAN`)。不设上限 = 给扫描器一个免费的全量导出接口。
 *      上限存在的意义不是省资源,是让"导出全链"这件事必须分多次、可被计数。
 */

/** 单次区间核验的最大跨度(闭区间 `to - from`,含两端)。 */
export const RANGE_MAX_SPAN = 200

/**
 * 区间回执。
 *
 * @param {{entries:object[], anchors?:object[], from:number, to:number}} args
 */
export function buildRangeReceipt({ entries, anchors = [], from, to } = {}) {
  const fi = Number(from)
  const ti = Number(to)
  const bad = (reason) => ({ state: VERIFY_STATE.INVALID, reason, receipt: null })
  if (!Number.isInteger(fi) || !Number.isInteger(ti)) return bad('from/to 必须是整数')
  if (fi < 0 || ti < 0) return bad('seq 从 0 起,不接受负数')
  if (ti < fi) return bad('to 必须不小于 from')
  if (ti - fi > RANGE_MAX_SPAN) {
    return bad(`跨度超过 ${RANGE_MAX_SPAN};请拆成多段查询(本层不提供全量导出)`)
  }

  const list = Array.isArray(entries) ? entries : []
  const bySeq = new Map()
  for (const e of list) {
    if (typeof e?.seq === 'number') bySeq.set(e.seq, e)
  }

  const rows = []
  const gaps = []
  for (let s = fi; s <= ti; s += 1) {
    const e = bySeq.get(s)
    if (!e) {
      gaps.push(s)
      continue
    }
    rows.push({
      seq: e.seq,
      ts: e.ts ?? null,
      prevHash: e.prevHash ?? null,
      /* payloadHash 必须给:自证公式里就有它,不给等于让第三方无法独立复核。
         它是 SHA-256,不可逆 —— 给出它不会回显攻击者的 IP/UA/载荷。 */
      payloadHash: e.payloadHash ?? null,
      hash: e.hash ?? null,
    })
  }

  /* 首尾相接:本层自己验,而不是把拼装工作推给核验者。
     `broken` 只记「本区间内相邻两条接不上」的位置;区间首条与前一条的关系
     由 `headPrevHash` 单独给出(核验者可拿它去查 from-1)。 */
  const broken = []
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].prevHash !== rows[i - 1].hash) {
      broken.push({ seq: rows[i].seq, expectedPrevHash: rows[i - 1].hash, actualPrevHash: rows[i].prevHash })
    }
  }

  const anchor = anchorCovering(anchors, ti)
  return {
    state: VERIFY_STATE.FOUND,
    reason: gaps.length === 0 && broken.length === 0 ? '区间完整且首尾相接' : '区间存在缺口或断点',
    receipt: {
      from: fi,
      to: ti,
      count: rows.length,
      expected: ti - fi + 1,
      complete: gaps.length === 0 && broken.length === 0,
      gaps,
      broken,
      headPrevHash: rows.length > 0 ? rows[0].prevHash : null,
      headSeq: rows.length > 0 ? rows[0].seq : null,
      tailHash: rows.length > 0 ? rows[rows.length - 1].hash : null,
      rows,
      anchor,
      proof: {
        formula: 'sha256(`${seq}|${prevHash}|${ts}|${payloadHash}`) === hash',
        link: 'rows[i].prevHash === rows[i-1].hash;headPrevHash 应等于 seq-1 的 hash(或 GENESIS)',
        genesis: '0'.repeat(64),
      },
    },
  }
}

export const __test__ = {
  normalizeEv,
  findEntry,
  anchorCovering,
  proofOf,
  buildRangeReceipt,
  RANGE_MAX_SPAN,
  EV_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
