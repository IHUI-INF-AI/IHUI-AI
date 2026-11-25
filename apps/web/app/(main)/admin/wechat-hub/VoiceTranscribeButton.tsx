// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AudioLines, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatVoiceTranscribeBatchResult } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

/**
 * 批量把未转写的语音消息交给本地 whisper 转成文本。
 * stub 结果是「STT 没真正跑起来」，不写库，必须显式告知，不能让用户以为已经转好了。
 */
export default function VoiceTranscribeButton({ accountId }: { accountId: string }) {
  const qc = useQueryClient()
  const [notice, setNotice] = React.useState<string | null>(null)
  const [warning, setWarning] = React.useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => wechatHubApi.transcribeVoice(accountId, { limit: 20 }),
    onSuccess: (result) => {
      if ('items' in result) {
        const batch = result as WechatVoiceTranscribeBatchResult
        setNotice(
          `扫描 ${batch.scanned} 条：成功 ${batch.transcribed} · 失败 ${batch.failed} · 跳过 ${batch.skipped}`,
        )
        setWarning(
          batch.skipped > 0
            ? '跳过项多为音频取不到、超 20MB，或 STT 只返回了占位结果（未写库）。'
            : null,
        )
      } else {
        setNotice(
          result.stub ? 'STT 返回占位结果，未写库（模型可能未就绪）' : `已转写 ${result.chars} 字`,
        )
        setWarning(
          result.stub ? '本地 whisper 模型未就绪时会回 stub，装好模型后再转一次即可。' : null,
        )
      }
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'messages', accountId] })
    },
    onError: (e) => {
      setNotice(null)
      setWarning(e instanceof Error ? e.message : '语音转写失败')
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
        转写语音
      </Button>
      {notice ? <Alert variant="info" title="转写结果" description={notice} /> : null}
      {warning ? <Alert variant="warning" title="注意" description={warning} /> : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
