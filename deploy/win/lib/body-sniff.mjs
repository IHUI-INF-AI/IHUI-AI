// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 请求体有界嗅探(2026-11-25 立)。
//
// 为什么要有界:body 是**在线请求路径**上唯一还没被扫的面(WAF 只扫 URL / UA / method)。
// 但读 body 有两个真风险:
//   ① 读完不放回,上游收到空体 —— 所有表单提交当场坏掉;
//   ② 慢速发体的客户端把 router 挂住(slowloris 换个方向打)。
//
// 三条硬约束(每一条都对应一次实测/一次推理):
//   · 只在 content-length **已知、>0、<= limit** 时读;chunked 与 multipart 文件上传一律不读。
//   · 读够 content-length 就立刻停 —— 此时 `end` 还没触发,`unshift` 才有效。
//     在 `end` 之后 unshift 会抛 `ERR_STREAM_UNSHIFT_AFTER_END_EVENT`,而那时数据已无法放回,
//     上游会拿到空体。所以判据必须是「计满即停」,不能等 `end`。
//   · 超时 / 溢出 / 出错一律先 `unshift` 已读字节再返回 `text:null`。
//     判定放弃,但转发不受影响 —— 失效方向恒为「少扫一次」,绝不是「少转发一次」。
//
// content-length 谎报的两侧都想过:
//   实际比声明短 ⇒ `end` 先到 ⇒ 返回 `text:null` 且无法放回。这种请求本来就不完整,
//                   上游拿不到完整体也会报错,不是本层的责任;判据里显式标 `why:'end'`。
//   实际比声明长 ⇒ 计满声明字节即停 ⇒ 已读部分 unshift 回去,剩余字节仍在 socket 里,上游照样收全。

export const SNIFF_POLICY = Object.freeze({
  /** 一次性读(转发前判定)的体积上限:再大就改走流式,不整段缓冲。 */
  limitBytes: 8192,
  /** 计满后最多再等这么久;到点就放弃判定。300ms 足够 8KB 在正常网络上到达。 */
  deadlineMs: 300,
  /** multipart 只在这么小的体上嗅(再大基本是文件上传)。 */
  multipartLimitBytes: 1024,
  /**
   * 流式扫描的总量上限(2026-11-25 补)。超过这个体积就不扫 ——
   * 256KB 以上的体基本是文件传输,不是攻击载荷的常见载体,而每字节都要过 9 条正则。
   * 这是本条路线**有意画出的边界**,不是遗漏:再往上要么牺牲延迟,要么牺牲 CPU。
   */
  streamLimitBytes: 256 * 1024,
  /** 滚动窗口:最长规则需要约 200 字节上下文(union…select…from),留 512 足够跨 chunk 拼上。 */
  windowBytes: 512,
  /** 单次喂给正则的切片:大 chunk 先切开,避免一次性让 9 条正则跑几十 KB。 */
  chunkStepBytes: 4096,
})

/**
 * 判断这条请求要不要嗅探。返回 `{sniff, why, expected}`。
 * `expected` 只在 `sniff:true` 时有意义。
 *
 * chunked(2026-11-25 补):这里原先一律跳过,理由是"长度未知读不完整、放不回去"。
 * 可那等于告诉攻击者:**改一个 Transfer-Encoding 头,体规则整层失效** ——
 * 一条只认长度的防线,等于没有防线。现在改为按 limit 封顶读,两条分支各自闭合:
 *   · 读够 limit(流还没 end)⇒ unshift 有效,剩余字节仍在 socket 里 ⇒ 上游收全;
 *   · 没读够就 end(整段小于 limit)⇒ 数据放不回去,由转发层**整段重放**(`replay`)。
 */
export function shouldSniff(headers, { limit = SNIFF_POLICY.limitBytes, multipartLimit = SNIFF_POLICY.multipartLimitBytes } = {}) {
  const h = headers ?? {}
  const te = String(h['transfer-encoding'] ?? '').toLowerCase()
  // 同时出现 content-length 与 transfer-encoding 属请求走私的经典形状;
  // Node 自己以 transfer-encoding 为准,这里同序,不另立标准。
  //
  // chunked 一律走**流式**:长度未知,整段读不到"计满即停"那个点;
  // 流式不消费原流(只是旁听 data),因此根本不需要 unshift/replay,转发天然完整。
  if (te.includes('chunked')) return { sniff: true, why: 'chunked', stream: true, expected: SNIFF_POLICY.streamLimitBytes }
  const expected = Number(h['content-length'] ?? -1)
  if (!Number.isFinite(expected) || expected <= 0) return { sniff: false, why: 'no-length' }
  const ct = String(h['content-type'] ?? '').toLowerCase()
  if (ct.startsWith('multipart/') && expected > multipartLimit) return { sniff: false, why: 'multipart' }
  if (expected <= limit) return { sniff: true, why: 'ok', expected }
  // 大体(2026-11-25 补):以前这里直接放弃 —— 等于"放 9000 字节填充在前面就能把载荷藏到后面"。
  // 现在改走流式:边转发边扫,命中就断上游(上游收到的是不完整请求,不会处理,副作用为零)。
  if (expected > SNIFF_POLICY.streamLimitBytes) return { sniff: false, why: 'too-large' }
  return { sniff: true, why: 'stream-large', stream: true, expected }
}

/**
 * 滚动扫描器(2026-11-25 立):给大体用。
 *
 * 与 `sniffBody` 的本质区别:它**不消费原流**,只旁听 `data` —— 所以不存在
 * "读完放不回去"那一整类问题(那是上一枚和上上枚各踩一次的坑)。
 * 代价是判定发生在转发过程中:命中时上游已经收到一部分体,因此必须**断开上游**;
 * 但请求没有完成,上游不会把它当成一次有效调用,副作用为零。
 *
 * 三条边界:
 *   · 累计超过 `limit` 就停(默认 256KB),不扫到底 —— 再往上 CPU 与延迟不划算;
 *   · 大 chunk 先按 `step` 切开再喂正则,避免一次跑几十 KB;
 *   · 保留 `window` 字节尾部,让跨 chunk 的载荷(union…select…from)能拼上。
 */
export function createRollingScanner({
  limit = SNIFF_POLICY.streamLimitBytes,
  windowBytes = SNIFF_POLICY.windowBytes,
  step = SNIFF_POLICY.chunkStepBytes,
  inspect,
} = {}) {
  if (typeof inspect !== 'function') throw new TypeError('createRollingScanner 需要 inspect(text) => hits[]')
  let tail = Buffer.alloc(0)
  let total = 0
  let hits = []
  let stopReason = null

  const push = (chunk) => {
    if (stopReason || !chunk || !chunk.length) return null
    total += chunk.length
    if (total > limit) {
      stopReason = 'limit'
      return null
    }
    for (let i = 0; i < chunk.length; i += step) {
      const piece = chunk.subarray(i, Math.min(i + step, chunk.length))
      const merged = tail.length ? Buffer.concat([tail, piece]) : piece
      const found = inspect(merged.toString('utf8'))
      if (found && found.length) {
        hits = found
        stopReason = 'hit'
        return found
      }
      tail = merged.length > windowBytes ? merged.subarray(merged.length - windowBytes) : merged
    }
    return null
  }

  return {
    push,
    get total() {
      return total
    },
    get hits() {
      return hits
    },
    get stopReason() {
      return stopReason
    },
    get done() {
      return stopReason !== null
    },
  }
}

/**
 * 有界读取请求体。返回 `{text, why, bytes}`:
 *   `why:'full'`   ⇒ 读够了声明的全部字节,`text` 是解码后的文本;
 *   `why:'end'`    ⇒ body 比声明短(异常请求),`text` 为 null,数据已无法放回;
 *   `why:'timeout'`/`'overflow'`/`'error'` ⇒ `text` 为 null,已读字节已 unshift 回去。
 *
 * 无论哪条分支,只要还能放回就一定放回 —— 调用方不需要也不能再做一次。
 */
export function sniffBody(req, { expected, limit = SNIFF_POLICY.limitBytes, deadlineMs = SNIFF_POLICY.deadlineMs } = {}) {
  return new Promise((resolve) => {
    const want = Number(expected ?? -1)
    const chunks = []
    let total = 0
    let settled = false

    const settle = (why) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
      const merged = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)
      let restored = false
      // 在 `end` 之后 unshift 不是 throw,而是 `errorOrDestroy` **emit 'error'** ——
      // 那时我们已经把 error 监听摘掉了,于是它会变成 uncaughtException 把进程打断。
      // 所以先看 readableEnded:已经结束的流直接跳过,不去碰它。
      if (merged.length && !req.readableEnded && !req.destroyed) {
        try {
          req.unshift(merged)
          restored = true
        } catch {
          /* 极少数实现差异:放不回去就如实报 why */
        }
      }
      // `end` 与 `full` 都算"整段拿到了":前者是流自己结束(整段小于声明或 chunked 小体),
      // 后者是读够了声明字节。两种都能判定 —— 以前只在 full 时给文本,chunked 的小体因此永远看不见。
      const complete = why === 'full' || why === 'end'
      req.pause()
      resolve({ text: complete ? merged.toString('utf8') : null, why, bytes: merged.length, restored, merged })
    }

    const onData = (chunk) => {
      chunks.push(chunk)
      total += chunk.length
      if (total >= limit * 2) {
        settle('overflow')
        return
      }
      if (Number.isFinite(want) && want > 0 && total >= want) settle('full')
    }
    const onEnd = () => settle('end')
    const onError = () => settle('error')
    const timer = setTimeout(() => settle('timeout'), deadlineMs)

    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onError)
    req.resume()
  })
}

export const __test__ = { shouldSniff, sniffBody, createRollingScanner }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
