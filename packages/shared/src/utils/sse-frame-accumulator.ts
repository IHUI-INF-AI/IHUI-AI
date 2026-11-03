// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815939:入站 SSE 的"尾帧账目"唯一出口。
//
// 为什么要单独成文件(而不是在各端循环里补两行):本仓至少有四处自己写了
// `buffer += decode(...)` / `while (indexOf('\n\n'))` 的切帧循环,而"连接结束时缓冲区里
// 剩下的那半帧"在每一处的处置都不一样 —— 有的直接不碰(use-agent-stream.ts)、
// 有的 `if (buffer.trim()) parseXxx(buffer)` 排空但不计数(api-client)。各写一遍必然漂开,
// 而漂开的表现不是报错,是**静默变短**:帧丢了、账面全绿、没人知道少了什么。
// 这与 §5e"失败必须响"、守门 77"绝不静默成看起来全绿"是同一条禁令的反面形态。
//
// 三态绝不并桶(本模块的全部价值):
//   - `drained`      尾段被排空解析成功(调用方的 salvage 通道认领了它)
//   - `discarded`    尾段确实被丢弃 —— 可数、可点名(chars + preview + 丢弃原因)
//   - `undetermined` 尾段**判不出来**(close() 从未被调用 / salvage 自己抛错)
// 把 `undetermined` 并进 `discarded` 是把"没看清"写成"有问题";并进 `drained` 或干脆
// 不写是把"没看清"写成"没问题" —— 两个方向都不许。同理,"缓冲区是空的"是一句**结论**
// (三态里的"确实没有"),而"没人调用过 close()"不是结论,是未判定(承 G-721 口径:
// 不得把 undefined 解释成"清除","查不到"与"没有"分两型)。

/** 尾段处置的三态。 */
export type SseTailOutcome = 'drained' | 'discarded' | 'undetermined'

/** 一条尾段记录:计数与点名用的两个量纲分开,免得"报了个数却找不到站点"。 */
export interface SseTailRecord {
  readonly outcome: SseTailOutcome
  /** 尾段原始长度(UTF-16 码元数,即缓冲区里真实留下的量),不是 preview 的长度 */
  readonly chars: number
  /** 归一后的内容预览(空白折叠成单空格),仅供点名;判据一律看 chars */
  readonly preview: string
  /** 为什么落这一态(机器可读前缀 + 人读说明) */
  readonly reason: string
}

/** 一条流的尾帧账目。close() 之前读到什么算什么;close() 未调用 ⇒ 一律未判定。 */
export interface SseTailAccount {
  /** 交给 onFrame 的完整帧数(空帧也算,因为切帧不看内容) */
  readonly completeFrames: number
  readonly drained: readonly SseTailRecord[]
  readonly discarded: readonly SseTailRecord[]
  readonly undetermined: readonly SseTailRecord[]
  /** close() 是否真的跑过 —— false 时下面三个数组的"空"没有任何结论含义 */
  readonly closed: boolean
}

/** 排空通道:自行决定尾段能不能救(能认领返回 true,判不可用返回 false)。 */
export type SseTailSalvage = (tail: string) => boolean

export interface SseFrameAccumulatorOptions {
  /** 每个完整帧(不含分隔用的空行)回调一次 */
  readonly onFrame: (frame: string) => void
  /**
   * 可选的排空通道。不提供 = 尾段按 `discarded` 计(**不是**按"没有尾段"计),
   * 因为丢弃是已知事实;提供但内部抛错 = `undetermined`,因为那一格没判成。
   */
  readonly salvage?: SseTailSalvage
  /** 点名预览的最大字符数(默认 120) */
  readonly previewLimit?: number
}

export interface SseFrameAccumulator {
  /** 喂入解码后的文本增量;内部按 `\n\n` 切帧并逐帧回调 */
  readonly push: (chunk: string) => void
  /** 收口并结清尾段账目;幂等 —— 第二次调用返回同一份账(不得重复记账) */
  readonly close: () => SseTailAccount
  /** 未 close 时的只读快照:尾段一律记 undetermined,而不是伪装成"空" */
  readonly peek: () => SseTailAccount
}

const DEFAULT_PREVIEW_LIMIT = 120

/** 帧分隔符:SSE 以空行收帧。本模块只按这一种形态切,与既有各端逐字同形。 */
export const SSE_FRAME_SEPARATOR = '\n\n'

function previewOf(text: string, limit: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > limit ? `${collapsed.slice(0, limit)}…` : collapsed
}

/**
 * 建一个带尾帧账目的切帧器。
 *
 * 用法(两端一致):`push()` 进流式增量,流结束/异常收口处**必须**调一次 `close()`,
 * 并把返回的账目交给 `summarizeSseTailAccount()` —— 它为 null 时才代表"确实没有尾帧"。
 */
export function createSseFrameAccumulator(options: SseFrameAccumulatorOptions): SseFrameAccumulator {
  const { onFrame, salvage } = options
  const previewLimit = options.previewLimit ?? DEFAULT_PREVIEW_LIMIT

  let buffer = ''
  let completeFrames = 0
  let account: SseTailAccount | null = null

  const tailRecord = (outcome: SseTailOutcome, tail: string, reason: string): SseTailRecord => ({
    outcome,
    chars: tail.length,
    preview: previewOf(tail, previewLimit),
    reason,
  })

  const doClose = (): SseTailAccount => {
    const tail = buffer
    buffer = ''

    const drained: SseTailRecord[] = []
    const discarded: SseTailRecord[] = []
    const undetermined: SseTailRecord[] = []

    // 只有空白残渣(例如服务端在最后多发了一个换行)才构不成"一帧":这是结论,不是漏账。
    if (tail.trim().length > 0) {
      if (typeof salvage === 'function') {
        let accepted: boolean
        try {
          accepted = salvage(tail)
        } catch (e) {
          // salvage 抛错 ⇒ 那一格没判成。不得折成"已丢弃"(那等于把一次故障写成一次裁决),
          // 也不得折成"没有尾帧"。
          undetermined.push(
            tailRecord('undetermined', tail, `salvage-threw: e=${e instanceof Error ? e.message : String(e)}`),
          )
          accepted = false
        }
        if (accepted) {
          drained.push(tailRecord('drained', tail, 'salvaged-by-caller'))
        } else if (undetermined.length === 0) {
          discarded.push(tailRecord('discarded', tail, 'salvage-returned-false'))
        }
      } else {
        // 没有排空通道 = 已知会丢弃。宁可报"丢了半帧"也不许把它读成"收尾干净"。
        discarded.push(tailRecord('discarded', tail, 'no-salvage-channel'))
      }
    }

    account = { completeFrames, drained, discarded, undetermined, closed: true }
    return account
  }

  return {
    push(chunk: string): void {
      if (account) {
        // 收口后再喂 = 调用方的时序错了。这里不静默吞掉、也不假装还能补记:
        // 账已经结了,再喂进来的内容既不在 complete 也不在尾段里 = 又一次"静默变短",
        // 所以直接抛,让时序问题在跑它的那一刻响出来(而不是在报告里安静地少一帧)。
        throw new Error('[sse-frame-accumulator] push() 在 close() 之后被调用 ⇒ 尾帧账目已失效')
      }
      if (chunk.length === 0) return
      buffer += chunk
      let idx = buffer.indexOf(SSE_FRAME_SEPARATOR)
      while (idx !== -1) {
        const frame = buffer.slice(0, idx)
        buffer = buffer.slice(idx + SSE_FRAME_SEPARATOR.length)
        completeFrames += 1
        onFrame(frame)
        idx = buffer.indexOf(SSE_FRAME_SEPARATOR)
      }
    },
    close(): SseTailAccount {
      if (account) return account
      return doClose()
    },
    peek(): SseTailAccount {
      if (account) return account
      // 未收口:缓冲区里有什么是**已知**的,但它会不会变成尾段还判不出来 ⇒ 未判定。
      const tail = buffer
      return {
        completeFrames,
        drained: [],
        discarded: [],
        undetermined: [tailRecord('undetermined', tail, 'close-not-called')],
        closed: false,
      }
    },
  }
}

/**
 * 账目的人读/日志摘要:**没有任何尾段时返回 null**(调用方可据此免打一行噪音)。
 *
 * 返回的字符串一定带上三态各自的计数 —— 只报"丢了 N 帧"而不报"判不出 M 帧",
 * 下一个人就会把这一行读成"其余都是干净的"。
 */
export function summarizeSseTailAccount(account: SseTailAccount | null): string | null {
  if (account === null) {
    return 'sse-tail: undetermined=1 (reason=no-account — 收口从未发生,不得读成"没有尾帧")'
  }
  const total = account.drained.length + account.discarded.length + account.undetermined.length
  if (total === 0 && account.closed) {
    // 确实没有尾段:这是一句结论,但仍要能区分"结论"与"没判" —— closed 已在文案里。
    return null
  }
  const parts = [
    `complete=${account.completeFrames}`,
    `drained=${account.drained.length}`,
    `discarded=${account.discarded.length}`,
    `undetermined=${account.undetermined.length}`,
    `closed=${account.closed ? 'yes' : 'no'}`,
  ]
  for (const rec of [...account.discarded, ...account.undetermined, ...account.drained]) {
    parts.push(`${rec.outcome}[${rec.chars}chars]=${rec.reason} preview="${rec.preview}"`)
  }
  return `sse-tail: ${parts.join(' ')}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
