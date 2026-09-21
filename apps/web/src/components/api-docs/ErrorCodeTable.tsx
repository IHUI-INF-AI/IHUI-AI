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

interface ErrorCode {
  /** 数字业务码(1000-5999)或机器可读语义码(SCOPE_REQUIRED 等),与后端 errorCode 一致 */
  code: number | string
  httpStatus: number
  meaning: string
  fix: string
}

const ERROR_CODES: ErrorCode[] = [
  {
    code: 1000,
    httpStatus: 401,
    meaning: 'API Key 无效',
    fix: '检查 Authorization: Bearer ihui_xxx 头',
  },
  { code: 1001, httpStatus: 401, meaning: 'API Key 已过期', fix: '重新生成 Key 或联系管理员续期' },
  { code: 1002, httpStatus: 403, meaning: 'IP 不在白名单', fix: '在 Key 配置中添加 IP' },
  { code: 1003, httpStatus: 403, meaning: '模型不在白名单', fix: '在 Key 配置中添加模型' },
  { code: 1004, httpStatus: 429, meaning: '超过 QPM 限制', fix: '升级订阅包或降低调用频率' },
  { code: 1005, httpStatus: 402, meaning: '余额不足', fix: '充值或兑换码充值' },
  { code: 1006, httpStatus: 413, meaning: '单次 token 超限', fix: '降低 max_tokens 或拆分请求' },
  // P0 第二批次(2026-07-31 立):用户级模型限流 + 多租户
  {
    code: 1007,
    httpStatus: 429,
    meaning: '超过单模型 RPM 限制',
    fix: '降低该模型的调用频率或升级分组',
  },
  {
    code: 1008,
    httpStatus: 429,
    meaning: '超过单模型 TPM 限制',
    fix: '降低该模型的 token 用量或升级分组',
  },
  {
    code: 1009,
    httpStatus: 403,
    meaning: 'API Key 不属于该租户',
    fix: '检查 Key 与租户的绑定关系',
  },
  // O2(2026-09-21 立):Key 级 5h/1d/7d 窗口超限 —— 1009 已被租户绑定占用,故新码取 1010
  {
    code: 1010,
    httpStatus: 429,
    meaning: 'Key 级窗口(5h/1d/7d)调用数超限',
    fix: '按响应 Retry-After 与 X-RateLimit-* 退避重试,或调低窗口内频率',
  },
  // O2(2026-09-21 立):凭据形态收紧 + 限流后端 fail-close
  {
    code: 'SECRET_REQUIRED',
    httpStatus: 401,
    meaning: '缺少 X-Api-Secret 头(默认必须携带)',
    fix: '携带创建/轮换密钥时一次性返回的 secret;过渡期可由服务端 API_KEY_REQUIRE_SECRET=false 放宽',
  },
  {
    code: 'RATE_BACKEND_UNAVAILABLE',
    httpStatus: 503,
    meaning: '限流后端不可用,请求被 fail-close 拒绝',
    fix: '按 Retry-After(默认 5s)重试;仅计费/高危能力会触发,低危只读降级放行',
  },
  // 数据闸(2026-09-21 立):dataClass 从文档约定变成运行期机械判定
  {
    code: 'DATA_ACCESS_DENIED',
    httpStatus: 403,
    meaning: '该能力的 dataClass 不允许触达此数据表(或表名不可判定)',
    fix: '对照能力目录的 dataClass:compute 只产运行记录,读业务数据须走 scoped-read',
  },
  {
    code: 'DATA_SCOPE_DENIED',
    httpStatus: 403,
    meaning: '语句越过归属边界(缺 owner 谓词或绑定他人资源 ID)',
    fix: '只查询/写入调用者自有资源,禁止跨 owner/tenant 访问',
  },
  {
    code: 'DATA_ISOLATION_UNAVAILABLE',
    httpStatus: 503,
    meaning: '数据隔离前提不成立(连接为超级用户或无法证实非超级用户)',
    fix: '服务端需以非超级用户连接数据库;联系管理员,勿改客户端重试',
  },
  { code: 2001, httpStatus: 502, meaning: '上游服务不可用', fix: '稍后重试,系统会自动故障切换' },
  { code: 2002, httpStatus: 504, meaning: '上游超时', fix: '降低 max_tokens 或检查网络' },
  { code: 2003, httpStatus: 529, meaning: '上游过载', fix: '稍后重试' },
  // P0 第二批次(2026-07-31 立):realtime/midjourney/mcp 专用错误码
  {
    code: 2004,
    httpStatus: 502,
    meaning: 'Realtime WebSocket 上游错误',
    fix: '检查模型是否支持 realtime + 网络连接',
  },
  {
    code: 2005,
    httpStatus: 502,
    meaning: 'Midjourney 上游错误',
    fix: '检查 midjourney-proxy 是否在线 + 任务参数',
  },
  {
    code: 2006,
    httpStatus: 502,
    meaning: 'MCP 工具调用失败',
    fix: '检查 MCP server 状态 + 工具名是否存在',
  },
  { code: 3001, httpStatus: 400, meaning: '请求参数错误', fix: '检查 messages 格式' },
  { code: 3002, httpStatus: 400, meaning: '模型不存在', fix: '查 GET /v1/models 可用模型' },
  // P0 第二批次(2026-07-31 立):rerank/moderations 上游未配置
  {
    code: 5013,
    httpStatus: 502,
    meaning: '上游渠道未配置',
    fix: '联系管理员配置 rerank/moderations 上游',
  },
]

function statusClass(s: number): string {
  return s >= 500
    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
}

export function ErrorCodeTable(): React.JSX.Element {
  const t = useTranslations('models.apiDocs')
  const [keyword, setKeyword] = React.useState('')

  const filtered = React.useMemo(() => {
    if (!keyword.trim()) return ERROR_CODES
    const kw = keyword.toLowerCase()
    return ERROR_CODES.filter(
      (e) =>
        String(e.code).includes(kw) ||
        e.meaning.toLowerCase().includes(kw) ||
        e.fix.toLowerCase().includes(kw) ||
        String(e.httpStatus).includes(kw),
    )
  }, [keyword])

  return (
    <Card>
      <CardContent className="min-[640px]:p-3 space-y-3 p-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">错误码</p>
        </div>
        <p className="text-xs text-muted-foreground">
          所有 API 错误码、HTTP 状态码含义与修复建议,支持搜索。
        </p>

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
                <TableHead className="h-9 px-2 text-xs">错误码</TableHead>
                <TableHead className="h-9 px-2 text-xs">HTTP</TableHead>
                <TableHead className="h-9 px-2 text-xs">含义</TableHead>
                <TableHead className="h-9 px-2 text-xs">修复建议</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                    无匹配错误码
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
