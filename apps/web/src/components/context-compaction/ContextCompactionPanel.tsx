// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  listCompactionHistory,
  type CompactionHistoryResult,
  type CompactionRecord,
} from '@/api/context-compaction-api'

/**
 * 上下文压缩感知面板(独立组件,2026-09-03 立,P0-6)。
 *
 * 让用户感知并回看某个 AGENT 会话被 LLM 语义压缩的历史:
 * 触发时间、压缩前→压缩后 token、节省比例、摘要预览、总压缩次数。
 * 对标 CheckpointRewindPanel 的独立组件 + fetchApi + 'use client' 风格,
 * 独立命名,不改动既有共享布局/路由;接入方只需传 `sessionId` 放置即可。
 *
 * @param sessionId 会话 id
 */
export default function ContextCompactionPanel({ sessionId }: { sessionId: string }) {
  const t = useTranslations('contextCompaction')
  const [records, setRecords] = useState<CompactionRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const load = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError('')
    try {
      const data: CompactionHistoryResult = await listCompactionHistory(sessionId)
      setRecords(data.compactions)
      setTotal(data.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong>{t('title')}</strong>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? t('loading') : t('refresh')}
        </button>
        <span>
          {t('totalCompactions')}: {total} {t('countTimes')}
        </span>
      </div>
      {!sessionId && <span>{t('empty')}</span>}
      {error && <span style={{ color: '#d33' }}>{error}</span>}
      {sessionId && records.length === 0 && !loading && !error && <span>{t('empty')}</span>}
      {records.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {records.map((rec) => (
            <li
              key={rec.compaction_id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                border: '1px solid #e5e5e5',
                borderRadius: 6,
                padding: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, color: '#666' }}>
                  {new Date(rec.compacted_at * 1000).toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#188038',
                  }}
                >
                  -{Math.round(rec.saved_ratio * 100)}%
                </span>
              </div>
              <div style={{ fontSize: 13 }}>
                {t('tokenChange')}: {rec.original_tokens.toLocaleString()} {t('tokens')} →{' '}
                {rec.compressed_tokens.toLocaleString()} {t('tokens')}
              </div>
              {rec.summary && (
                <div style={{ fontSize: 12, color: '#444' }}>
                  <strong>{t('summaryPreview')}:</strong>{' '}
                  <span style={{ overflowWrap: 'anywhere' }}>
                    {rec.summary.length > 200 ? `${rec.summary.slice(0, 200)}…` : rec.summary}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
