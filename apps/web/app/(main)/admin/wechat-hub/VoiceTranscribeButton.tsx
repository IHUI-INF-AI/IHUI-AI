// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AudioLines, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type {
  WechatVoiceTranscribeBatchResult,
  WechatVoiceTranscribeResult,
} from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

/** 单轮扫描条数；单轮后端最长可能跑 180s，分批节奏由前端控制。 */
const ROUND_LIMIT = 10
/** 一次点击最多连跑几轮；剩余仍未清零就停下来，让用户再点一次继续。 */
const MAX_ROUNDS = 5

type BatchSummary = {
  kind: 'batch'
  scanned: number
  transcribed: number
  failed: number
  skipped: number
  remaining: number
  reasons: string[]
  stubStopped: boolean
  zeroProgress: boolean
}

type SinglePayload = {
  kind: 'single'
  result: WechatVoiceTranscribeResult
}

type TranscribePayload = BatchSummary | SinglePayload

/**
 * 批量把未转写的语音消息交给本地 whisper 转成文本。
 * 每轮 limit 10，按后端回传的 remaining 决定要不要继续下一轮；stub 结果是「STT 没真正
 * 跑起来」，不写库，必须显式告知，不能让用户以为已经转好了，也绝不把占位文本当转写稿展示。
 */
export default function VoiceTranscribeButton({ accountId }: { accountId: string }) {
  const qc = useQueryClient()
  const [notice, setNotice] = React.useState<string | null>(null)
  const [warning, setWarning] = React.useState<string | null>(null)
  const [round, setRound] = React.useState(0)
  // 累计进度放在 ref 里：中途抛错时局部变量会被销毁，onError 仍能读到已完成量。
  const progressRef = React.useRef({ scanned: 0, transcribed: 0, failed: 0, skipped: 0 })

  const mutation = useMutation({
    mutationFn: async (): Promise<TranscribePayload> => {
      progressRef.current = { scanned: 0, transcribed: 0, failed: 0, skipped: 0 }
      let scanned = 0
      let transcribed = 0
      let failed = 0
      let skipped = 0
      let remaining = 0
      let stubStopped = false
      let zeroProgress = false
      const reasons: string[] = []

      for (let currentRound = 1; currentRound <= MAX_ROUNDS; currentRound += 1) {
        setRound(currentRound)
        const result = await wechatHubApi.transcribeVoice(accountId, { limit: ROUND_LIMIT })

        // 单条结果（无 items 字段）：保留原有单条分支，不并入批量累计。
        if (!('items' in result)) {
          return { kind: 'single', result }
        }

        const batch: WechatVoiceTranscribeBatchResult = result
        const roundTranscribed = batch.transcribed
        scanned += batch.scanned
        transcribed += roundTranscribed
        failed += batch.failed
        skipped += batch.skipped
        remaining = typeof batch.remaining === 'number' ? batch.remaining : 0

        for (const item of batch.items) {
          if (!item.ok && item.error && !reasons.includes(item.error)) {
            reasons.push(item.error)
          }
        }
        progressRef.current = { scanned, transcribed, failed, skipped }

        // 权威信号：服务端明确本轮碰到 STT 引擎未就绪（stub 占位、不写库），remaining
        // 不会因这一轮下降，立即停止轮询，不再打下一轮空转。
        if (batch.stub === true) {
          stubStopped = true
          break
        }
        // remaining 清零说明该账号已没有待转写语音，提前结束。
        if (remaining === 0) break
        // 兜底：本轮一条都没真正写进库（只看本轮增量，不看累计），基本等价于引擎侧整体
        // 不可用，再打下一轮只是重复失败；stub 信号缺失时由这条兜住。
        if (roundTranscribed === 0) {
          zeroProgress = true
          break
        }
      }

      return {
        kind: 'batch',
        scanned,
        transcribed,
        failed,
        skipped,
        remaining,
        reasons,
        stubStopped,
        zeroProgress,
      }
    },
    onSuccess: (payload) => {
      if (payload.kind === 'single') {
        const result = payload.result
        if (result.stub) {
          setNotice(null)
          setWarning('转写引擎暂不可用（本地模型未就绪），未写入检索库')
        } else {
          setNotice(`已转写 ${result.chars} 字`)
          setWarning(null)
        }
      } else {
        const {
          scanned,
          transcribed,
          failed,
          skipped,
          remaining,
          reasons,
          stubStopped,
          zeroProgress,
        } = payload
        const isEmpty = scanned === 0 && transcribed === 0 && failed === 0 && skipped === 0
        if (isEmpty) {
          // 压根没有待转写语音：单独提示，不拼零值汇总，也不出引擎不可用类 warning。
          setNotice('该账号暂无待转写的语音')
          setWarning(null)
        } else {
          const lines = [
            `扫描 ${scanned} 条 · 成功 ${transcribed} · 失败 ${failed} · 跳过 ${skipped}`,
          ]
          if (remaining > 0) lines.push(`还有 ${remaining} 条未转完，再点一次继续`)
          setNotice(lines.join('；'))

          if (stubStopped) {
            // 服务端权威信号：引擎未就绪，与「没有语音可转」的终态明确区分开。
            setWarning('转写引擎暂不可用（本地模型未就绪），未写入检索库；装好模型后再点一次')
          } else if (zeroProgress) {
            // 兜底判据：本轮零成功，提示引擎侧大概率不可用，而不是已全部转完。
            setWarning('转写引擎暂不可用（本地模型未就绪），未写入检索库')
          } else if (skipped > 0 || failed > 0) {
            setWarning(
              reasons.length > 0
                ? reasons.join('；')
                : '转写引擎暂不可用（本地模型未就绪），未写入检索库',
            )
          } else {
            setWarning(null)
          }
        }
      }
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'messages', accountId] })
    },
    onError: (e) => {
      const errMsg = e instanceof Error ? e.message : '语音转写失败'
      const done = progressRef.current.transcribed
      setNotice(null)
      setWarning(
        done > 0 ? `已转写 ${done} 条后中断：${errMsg}；再点一次继续` : errMsg,
      )
      // 中断前成功写库的条目也要刷新到 UI，不能让列表停在旧数据上。
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'messages', accountId] })
    },
  })

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        title="把未转写的语音消息批量转成文本，转完就能被检索和问数引用"
      >
        {mutation.isPending ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <AudioLines className="mr-1 h-3 w-3" />
        )}
        {mutation.isPending ? `转写中 ${round}/${MAX_ROUNDS}` : '转写语音'}
      </Button>
      {notice ? <Alert variant="info" title="转写结果" description={notice} /> : null}
      {warning ? <Alert variant="warning" title="注意" description={warning} /> : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
