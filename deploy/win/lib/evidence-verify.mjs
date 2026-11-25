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

export const __test__ = {
  normalizeEv,
  findEntry,
  anchorCovering,
  proofOf,
  EV_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
