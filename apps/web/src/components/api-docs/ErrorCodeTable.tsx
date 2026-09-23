// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import {
  Card,
  CardContent,
  SearchInput,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'

/** 错误码文案键(对应消息树 apiDocs.errorCodes.<key>.{meaning,fix},键名不含点号) */
type ErrorCodeKey =
  | 'c1000'
  | 'c1001'
  | 'c1002'
  | 'c1003'
  | 'c1004'
  | 'c1005'
  | 'c1006'
  | 'c1007'
  | 'c1008'
  | 'c1009'
  | 'c1010'
  | 'secretRequired'
  | 'rateBackendUnavailable'
  | 'dataAccessDenied'
  | 'dataScopeDenied'
  | 'dataIsolationUnavailable'
  | 'c2001'
  | 'c2002'
  | 'c2003'
  | 'c2004'
  | 'c2005'
  | 'c2006'
  | 'c3001'
  | 'c3002'
  | 'c5013'

interface ErrorCode {
  /** 数字业务码(1000-5999)或机器可读语义码(SCOPE_REQUIRED 等),与后端 errorCode 一致 */
  code: number | string
  httpStatus: number
  i18nKey: ErrorCodeKey
}

interface ErrorCodeRow extends Omit<ErrorCode, 'i18nKey'> {
  meaning: string
  fix: string
}

const ERROR_CODES: ErrorCode[] = [
  { code: 1000, httpStatus: 401, i18nKey: 'c1000' },
  { code: 1001, httpStatus: 401, i18nKey: 'c1001' },
  { code: 1002, httpStatus: 403, i18nKey: 'c1002' },
  { code: 1003, httpStatus: 403, i18nKey: 'c1003' },
  { code: 1004, httpStatus: 429, i18nKey: 'c1004' },
  { code: 1005, httpStatus: 402, i18nKey: 'c1005' },
  { code: 1006, httpStatus: 413, i18nKey: 'c1006' },
  // P0 第二批次(2026-07-31 立):用户级模型限流 + 多租户
  { code: 1007, httpStatus: 429, i18nKey: 'c1007' },
  { code: 1008, httpStatus: 429, i18nKey: 'c1008' },
  { code: 1009, httpStatus: 403, i18nKey: 'c1009' },
  // O2(2026-09-21 立):Key 级 5h/1d/7d 窗口超限 —— 1009 已被租户绑定占用,故新码取 1010
  { code: 1010, httpStatus: 429, i18nKey: 'c1010' },
  // O2(2026-09-21 立):凭据形态收紧 + 限流后端 fail-close
  { code: 'SECRET_REQUIRED', httpStatus: 401, i18nKey: 'secretRequired' },
  { code: 'RATE_BACKEND_UNAVAILABLE', httpStatus: 503, i18nKey: 'rateBackendUnavailable' },
  // 数据闸(2026-09-21 立):dataClass 从文档约定变成运行期机械判定
  { code: 'DATA_ACCESS_DENIED', httpStatus: 403, i18nKey: 'dataAccessDenied' },
  { code: 'DATA_SCOPE_DENIED', httpStatus: 403, i18nKey: 'dataScopeDenied' },
  { code: 'DATA_ISOLATION_UNAVAILABLE', httpStatus: 503, i18nKey: 'dataIsolationUnavailable' },
  { code: 2001, httpStatus: 502, i18nKey: 'c2001' },
  { code: 2002, httpStatus: 504, i18nKey: 'c2002' },
  { code: 2003, httpStatus: 529, i18nKey: 'c2003' },
  // P0 第二批次(2026-07-31 立):realtime/midjourney/mcp 专用错误码
  { code: 2004, httpStatus: 502, i18nKey: 'c2004' },
  { code: 2005, httpStatus: 502, i18nKey: 'c2005' },
  { code: 2006, httpStatus: 502, i18nKey: 'c2006' },
  { code: 3001, httpStatus: 400, i18nKey: 'c3001' },
  { code: 3002, httpStatus: 400, i18nKey: 'c3002' },
  // P0 第二批次(2026-07-31 立):rerank/moderations 上游未配置
  { code: 5013, httpStatus: 502, i18nKey: 'c5013' },
]

function statusClass(s: number): string {
  return s >= 500
    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
}

export function ErrorCodeTable(): React.JSX.Element {
  const t = useTranslations('apiDocs')
  const [keyword, setKeyword] = React.useState('')

  const rows = React.useMemo<ErrorCodeRow[]>(
    () =>
      ERROR_CODES.map((e) => ({
        code: e.code,
        httpStatus: e.httpStatus,
        meaning: t(`errorCodes.${e.i18nKey}.meaning`),
        fix: t(`errorCodes.${e.i18nKey}.fix`),
      })),
    [t],
  )

  const filtered = React.useMemo(() => {
    if (!keyword.trim()) return rows
    const kw = keyword.toLowerCase()
    return rows.filter(
      (e) =>
        String(e.code).includes(kw) ||
        e.meaning.toLowerCase().includes(kw) ||
        e.fix.toLowerCase().includes(kw) ||
        String(e.httpStatus).includes(kw),
    )
  }, [keyword, rows])

  return (
    <Card>
      <CardContent className="min-[640px]:p-3 space-y-3 p-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{t('errorCodesTitle')}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t('errorCodesDesc')}</p>

        <SearchInput
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('searchPlaceholder')}
          size="lg"
          wrapperClassName="w-full"
        />

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-9 px-2 text-xs">{t('errorCodesTitle')}</TableHead>
                <TableHead className="h-9 px-2 text-xs">HTTP</TableHead>
                <TableHead className="h-9 px-2 text-xs">{t('meaningCol')}</TableHead>
                <TableHead className="h-9 px-2 text-xs">{t('fixCol')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                    {t('noMatchedErrorCodes')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.code}>
                    <TableCell className="px-2 py-1.5 font-mono text-xs font-medium">
                      {e.code}
                    </TableCell>
                    <TableCell className="px-2 py-1.5">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs font-semibold',
                          statusClass(e.httpStatus),
                        )}
                      >
                        {e.httpStatus}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-xs">{e.meaning}</TableCell>
                    <TableCell className="px-2 py-1.5 text-xs text-muted-foreground">
                      {e.fix}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
