// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Plus, Search, Loader2, Brain, AlertCircle, Sparkles } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Switch } from '@ihui/ui-react'
import { fetchMemory, deleteMemory } from '@/lib/memory-api'
import { fetchApi } from '@/lib/api'
import type { MemoryEntry, MemoryScope, MemoryEntryType } from '@ihui/types'
import { MemoryCard } from '@/components/memory/MemoryCard'
import { MemoryScopeTabs, type ScopeFilter } from '@/components/memory/MemoryScopeTabs'
import { MemoryTypeFilter, type TypeFilter } from '@/components/memory/MemoryTypeFilter'
import { BackButton } from '@/components/common'

/**
 * 「自动记忆」开关的初始状态判定(2026-10-03 极性反转收敛)
 * ------------------------------------------------------------
 * 背景:记忆页原来写的是键 `autoMemory`(**opt-in** 语义,`'false'` = 关闭),
 * 隐私页写的是键 `autoMemoryOptOut`(**opt-out** 语义,`'true'` = 关闭)。
 * 两个键**极性相反、键名不同**,于是同一件事在两个界面给出两个答案 ——
 * 用户在记忆页关掉记忆,隐私页却显示"未关闭"。
 *
 * 现在**统一到隐私页那个键** `autoMemoryOptOut`(机主已决策,不保留两个反极性
 * 开关并存)。判定链与后端 `apps/ai-service/app/services/auto_memory_optout.py`
 * 的 `resolve()` **逐步对齐**,前端不得自行发明第四种口径:
 *
 * | 优先级 | 证据                                | 本页显示 |
 * |--------|-------------------------------------|----------|
 * | 1      | `autoMemoryOptOut='true'`(新键)      | 关闭     |
 * | 2      | `autoMemoryOptOut` 有记录(非 'true')  | 开启     |
 * | 3      | `autoMemory='false'`(旧键)            | 关闭     |
 * | 4      | `autoMemory` 有记录(非 'false')       | 开启     |
 * | 5      | 两个键都缺                           | 开启     |
 *
 * 第 3-4 步(读旧键)是**存量用户保护**,不是为了继续支持旧键:已用记忆页关过
 * 记忆的用户库里只有 `autoMemory='false'`,若这里只读新键就会缺省成"开启",
 * 等于这次上线**反向把他们恢复**了 —— 一个开关上线改变了任何人的现状。
 * 与后端"新键优先、旧键仍读"的三态链同源,故此处不做数据迁移(见交付说明)。
 *
 * 注意"键缺失"与"键存在但值不是 'true'"是两回事:后端按 `is not None` 判存在,
 * 空串也会占住优先级(落到第 2 步 ⇒ 开启)。这里用 `!== undefined` 精确复刻,
 * 不要写成真值判断 —— 那会让 `autoMemoryOptOut=''` 意外掉到旧键上。
 *
 * 已知缝隙(已在本次补上):部署方若设了全局 env `IHUI_AUTO_MEMORY=0`,本页原来
 * 无从读取(它不是 `NEXT_PUBLIC_*`,不会下发到浏览器),仍会显示"开启",而后端
 * 不提取。现在本页读 `GET /settings/runtime-flags`(只返回这一个布尔)与用户偏好
 * 做**合取**,于是界面显示 = 全局 ∧ 用户 = 后端 `auto_memory_optout.resolve()` 的
 * 同一件事。
 *
 * 极性(两处语义不同,别把 env 当 opt-out 用):
 * - env `IHUI_AUTO_MEMORY` = "是否**全局开启**"(部署方的总闸);
 * - 界面这个开关 = "自动记忆 开/关"(**opt-in**,`checked` 直接就是它);
 * - 合取 `全局 ∧ 用户` 之后**仍然是 opt-in 显示**,不需要取反。
 *
 * @param settings `/settings/privacy` 返回的 settings 原始键值(值均为字符串)
 * @param globalEnabled `/settings/runtime-flags` 返回的 `autoMemoryGloballyEnabled`;
 *   缺省/端点不可用时为 `true`(= 部署方没关 = 整改前行为),**不**因读不到就把
 *   界面显示成"关闭"—— 那会让"接口抖动"看起来像"用户被关了记忆"。
 * @returns 是否开启自动记忆(**opt-in 语义**,与界面开关 `checked` 同向)
 */
export function resolveAutoMemoryEnabled(
  settings: Record<string, string>,
  globalEnabled = true,
): boolean {
  const optOut = settings.autoMemoryOptOut
  if (optOut !== undefined) {
    // opt-out 语义:'true' = 用户已关闭 ⇒ 界面显示关闭;其余有记录的值 = 开启。
    const userEnabled = optOut.trim().toLowerCase() !== 'true'
    // 合取在**最后**一步做,不在链条中间提前 return —— 否则第 1/2 步命中就绕过了
    // 全局闸,`IHUI_AUTO_MEMORY=0` 的部署会漏掉一次(界面显示"开启",后端不提取)。
    return userEnabled && globalEnabled
  }
  const legacy = settings.autoMemory
  if (legacy !== undefined) {
    // 旧键(opt-in 语义):'false' = 已关闭 ⇒ 界面显示关闭;其余 = 开启。
    const userEnabled = legacy.trim().toLowerCase() !== 'false'
    return userEnabled && globalEnabled
  }
  // 两个键都缺 = 用户从未表态 ⇒ 默认开启(= 整改前行为,开关上线不改变任何人现状)
  return globalEnabled
}

export default function MemoryListPage() {
  const router = useRouter()
  const t = useTranslations('memory')
  const [scope, setScope] = useState<ScopeFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [autoMemory, setAutoMemory] = useState(true)
  const [autoMemoryGlobal, setAutoMemoryGlobal] = useState(true)
  const [autoMemoryLoading, setAutoMemoryLoading] = useState(true)
  const [autoMemoryToast, setAutoMemoryToast] = useState<{
    type: 'success' | 'error'
    msg: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    // 两个请求并行:一个是 per-user 偏好,一个是部署方全局 env 镜像(只读一个布尔)。
    //
    // 用 allSettled 而不是 all:env 镜像端点是**后加的**,它不可用(部署方还没升级
    // api、网络抖动、404)时不该把用户的隐私偏好一起吞掉 —— all 会让整个 then
    // 跳过,结果是"用户的『关闭记忆』被无视、界面显示开启",比不接线更坏。
    // allSettled 让两份结果各自落地,互不牵连。
    void Promise.allSettled([
      fetchApi<{ settings: Record<string, string> }>('/settings/privacy'),
      fetchApi<{ autoMemoryGloballyEnabled?: boolean }>('/settings/runtime-flags'),
    ]).then(([prefsSettled, flagsSettled]) => {
      if (cancelled) return
      // 全局闸只在"端点明确回 false"时才关。
      //
      // 判据是 `!( ... === false)` 这个整体取反,而不是 `=== false`:
      // 请求 reject / 端点不存在(saas 部署方还没升级 api)/ success=false /
      // 字段缺失 —— 这些都归入"没关",而不是"关了"。写成 `=== false` 会让一次
      // 接口抖动把界面显示成"用户已关闭记忆",方向与后端 `auto_memory_optout`
      // "读库失败按现状行为(开启)放行"相反。
      const flagsOff =
        flagsSettled.status === 'fulfilled' &&
        flagsSettled.value?.success === true &&
        flagsSettled.value.data?.autoMemoryGloballyEnabled === false
      const globalEnabled = !flagsOff
      setAutoMemoryGlobal(globalEnabled)

      const prefsRes = prefsSettled.status === 'fulfilled' ? prefsSettled.value : undefined
      if (prefsRes?.success) {
        // setAutoMemory 始终是「自动记忆 开/关」(opt-in),界面语义不随键名翻转 ——
        // 极性反转只发生在 resolve 内部与下面的写入取反处。
        setAutoMemory(resolveAutoMemoryEnabled(prefsRes.data.settings ?? {}, globalEnabled))
      } else {
        // 偏好读失败也要应用全局闸:部署方关了就是关了,不该因为偏好端点抖动
        // 而让界面显示"开启"。
        setAutoMemory(resolveAutoMemoryEnabled({}, globalEnabled))
      }
      setAutoMemoryLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!autoMemoryToast) return
    const timer = setTimeout(() => setAutoMemoryToast(null), 3000)
    return () => clearTimeout(timer)
  }, [autoMemoryToast])

  async function handleAutoMemoryChange(value: boolean) {
    // 全局闸关闭时,界面**不能**把开关拨回"开启":那会造成"界面显示开启、后端仍不提取"
    // 的反向假开关(比原问题更难解释,因为用户刚亲手点过)。此处直接忽略并复位。
    // 置灰已在下面的 Switch 上用 disabled 表达,这里是第二道(防 programmatic 调用)。
    if (!autoMemoryGlobal) {
      setAutoMemory(false)
      return
    }
    setAutoMemory(value)
    try {
      const res = await fetchApi('/settings/privacy', {
        method: 'PUT',
        // 界面开关是 opt-in(「开启记忆」),落库的键是 opt-out(「不自动写入长期记忆」)
        // ⇒ 必须取反。写反极性会让用户点"关闭记忆"却把自动记忆打开,比不改更糟。
        // 只写新键:后端判定链新键优先,旧键残留不会把用户的新表态压回去。
        body: JSON.stringify({ autoMemoryOptOut: String(!value) }),
      })
      setAutoMemoryToast({
        type: res.success ? 'success' : 'error',
        msg: res.success ? t('autoMemorySaveSuccess') : t('autoMemorySaveFailed'),
      })
    } catch {
      setAutoMemoryToast({ type: 'error', msg: t('autoMemorySaveFailed') })
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = scope === 'all' ? {} : { scope: scope as MemoryScope }
      const res = await fetchMemory(query)
      setEntries(res.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = entries.filter((e) => {
    if (type !== 'all' && e.type !== (type as MemoryEntryType)) return false
    const k = keyword.trim().toLowerCase()
    if (!k) return true
    return e.text.toLowerCase().includes(k) || e.category.toLowerCase().includes(k)
  })

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const query = scope === 'all' ? {} : { scope: scope as MemoryScope }
      await deleteMemory(id, query)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-5xl space-y-5">
      <BackButton />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {t('autoMemory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">
              {t('autoMemoryDesc')}
            </span>
            <Switch
              checked={autoMemory}
              // 加载中禁用手势;**全局闸关闭时也禁用** —— 让用户能看见"记忆当前是关的",
              // 但不能拨回开启(拨了也只会得到"界面亮着、后端不提取"的反向假开关)。
              disabled={autoMemoryLoading || !autoMemoryGlobal}
              onCheckedChange={handleAutoMemoryChange}
              className="shrink-0"
            />
          </div>
        </CardContent>
      </Card>
      {autoMemoryToast && (
        <div
          className={`fixed right-4 top-4 z-modal rounded-md px-4 py-2 text-sm text-white shadow-lg ${autoMemoryToast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {autoMemoryToast.msg}
        </div>
      )}

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">记忆系统</h1>
          <span className="text-sm text-muted-foreground">({entries.length})</span>
        </div>
        <Button asChild>
          <Link href="/memory/new">
            <Plus className="h-4 w-4" />
            新建记忆
          </Link>
        </Button>
      </header>

      <MemoryScopeTabs active={scope} onChange={setScope} />

      <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
        <MemoryTypeFilter active={type} onChange={setType} />
        <div className="relative w-full min-[640px]:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索分类或内容..."
            className="w-full rounded-sm border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card py-8 text-center">
          <Brain className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">还没有记忆条目</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/memory/new">
              <Plus className="h-4 w-4" />
              创建第一条记忆
            </Link>
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {filtered.map((entry) => (
            <MemoryCard
              key={entry.id}
              entry={entry}
              onDelete={handleDelete}
              onEdit={(e) => {
                router.push(`/memory/${e.id}`)
              }}
              deleting={deletingId === entry.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
