// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 管理员短信接码页面(对接 d1jiema 平台,后端 /api/admin/sms-receive/* 代理)。
 *
 * 使用流程:填短信关键词(keyWord,如【毛竹】验证码短信填"毛竹")→ 取号 →
 * 自动 5s 轮询取码(3 分钟超时)→ 收码复制验证码 → 释放/拉黑号码。
 * 附:查余额、发送短信、查历史(平台限频 1 次/分钟,60s 冷却)。
 */
'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  MessageSquareMore,
  RefreshCw,
  Smartphone,
  Copy,
  Trash2,
  Ban,
  Send,
  History,
  Loader2,
  ScrollText,
} from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Input } from '@ihui/ui-react'
import { Label } from '@ihui/ui-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ihui/ui-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import {
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  USED_COOLDOWN_SECONDS,
  CARD_TYPES,
  EMPTY_GET_PHONE_FORM,
  HOT_MIN_RECORDS,
  HOT_WINDOW_MS,
  fetchBalance,
  fetchPhone,
  fetchMessage,
  releasePhone,
  blockPhone,
  sendSms,
  fetchUsed,
  fetchPhoneHistory,
  fetchRelatedMsgs,
  countRecentRecords,
  copyText,
} from './helpers'
import type { GetPhoneForm, MessageData, PhoneHistoryItem, SendSmsForm } from './types'

type Phase = 'idle' | 'polling' | 'received' | 'timeout'

/** 自动筛新号轮次上限:防止全是已注册号时无限烧钱(每个验证码约 0.45 元) */
const MAX_AUTO_ROUNDS = 20

export default function SmsReceivePage() {
  // ── 余额 ──
  const [balance, setBalance] = React.useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = React.useState(false)
  const refreshBalance = React.useCallback(async () => {
    setBalanceLoading(true)
    try {
      setBalance(await fetchBalance())
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBalanceLoading(false)
    }
  }, [])
  React.useEffect(() => {
    void refreshBalance()
  }, [refreshBalance])

  // ── 取号表单 + 持有号码 ──
  const [form, setForm] = React.useState<GetPhoneForm>(EMPTY_GET_PHONE_FORM)
  const [getting, setGetting] = React.useState(false)
  const [phone, setPhone] = React.useState<string | null>(null)
  const [keyWord, setKeyWord] = React.useState('')
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [sms, setSms] = React.useState<MessageData | null>(null)

  // ── 自动筛新号:收码判定已注册(登录码)→自动拉黑换号继续筛,直到新号(注册码)停下 ──
  const [autoMode, setAutoMode] = React.useState(false)
  const [autoRound, setAutoRound] = React.useState(0)
  const [autoBlocked, setAutoBlocked] = React.useState(0)
  // pollSeed:自动换号后强制重启轮询 effect(phase 仍为 polling 时 setPhase 同值不会重跑)
  const [pollSeed, setPollSeed] = React.useState(0)

  // ── 发送短信 ──
  const [sendForm, setSendForm] = React.useState<SendSmsForm>({ toPhone: '', content: '' })
  const [sending, setSending] = React.useState(false)

  // ── 历史记录 ──
  const [usedItems, setUsedItems] = React.useState<string[]>([])
  const [usedLoading, setUsedLoading] = React.useState(false)
  const [cooldown, setCooldown] = React.useState(0)

  // ── 号码台账(本地 sms_receive_history:这号接过什么码/是否注册过,不受平台 24h/100 条限制) ──
  const [phoneHistory, setPhoneHistory] = React.useState<PhoneHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const refreshPhoneHistory = React.useCallback(async (p: string) => {
    setHistoryLoading(true)
    try {
      setPhoneHistory(await fetchPhoneHistory(p))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const pollTimer = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const deadline = React.useRef(0)
  const pendingKey = React.useRef<{ phone: string; keyWord: string } | null>(null)
  // 自动筛新号 ref:轮询 tick 闭包内读取,不触发重渲染
  const autoModeRef = React.useRef(false)
  const autoRoundRef = React.useRef(0)
  const autoFormRef = React.useRef<GetPhoneForm>(EMPTY_GET_PHONE_FORM)
  // 防并发双推进:超时兜底与收码换号竞态时只允许一次 advanceAutoRound 在飞
  const autoAdvancingRef = React.useRef(false)

  const stopPolling = React.useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  // 自动筛新号零成本预筛(本地台账 + 平台热度,全部免费):
  // ①本地台账有「登录码」记录 = 确认注册过 → 直接拉黑换下一个(防号池复用二次扣费);
  // ②平台全局时间线显示近 30 分钟被收码 ≥3 条 = 号池正被高频流转(超热门号),
  //   已被他人注册过目标平台的概率高 → 释放跳过换下一个。
  // 任何查询失败都视为无命中,不阻断流程(fail-open)
  const acquireAutoPhone = React.useCallback(async (): Promise<string> => {
    for (;;) {
      const p = await fetchPhone({ ...autoFormRef.current, phone: '' })
      const hist = await fetchPhoneHistory(p).catch(() => [])
      if (!hist.some((h) => h.usageKind === 'login')) {
        const related = await fetchRelatedMsgs(p).catch(() => [])
        const recent = countRecentRecords(related)
        if (recent < HOT_MIN_RECORDS) return p
        try {
          await releasePhone(p)
          toast.info(
            `${p} 号池流转过热(近 ${HOT_WINDOW_MS / 60000} 分钟 ${recent} 条收码记录),已释放跳过`,
          )
        } catch {
          // 释放失败不阻断换号
        }
      } else {
        try {
          await blockPhone(p)
          setAutoBlocked((n) => n + 1)
          toast.info(`${p} 本地台账已确认注册过,零成本拉黑换号`)
        } catch {
          // 拉黑失败也不阻断换号
        }
      }
      autoRoundRef.current += 1
      setAutoRound(autoRoundRef.current)
      if (autoRoundRef.current >= MAX_AUTO_ROUNDS) {
        throw new Error(
          `已连续筛选 ${MAX_AUTO_ROUNDS} 轮(本地台账/热度过滤全部命中),已停止(防余额耗尽)`,
        )
      }
    }
  }, [])

  // 自动筛新号推进:prev 号处置(已注册→拉黑 / 超时→释放) → 取下一个号 → 重启轮询。
  // 超时也换号:机主节奏慢于 3 分钟窗口时轮询停住会导致短信来了没人收,自动模式必须连续筛选
  const advanceAutoRound = React.useCallback(
    async (
      prevPhone: string,
      opts: { dispose: 'block' | 'release'; stopPhase: Phase; stopReason: string },
    ) => {
      // 防并发双触发:超时兜底与收码换号竞态时只允许一次推进(第二次调用直接忽略)
      if (autoAdvancingRef.current) return
      autoAdvancingRef.current = true
      try {
        if (autoRoundRef.current >= MAX_AUTO_ROUNDS) {
          setPhase(opts.stopPhase)
          toast.error(`${opts.stopReason},已自动停止(防余额耗尽,共 ${MAX_AUTO_ROUNDS} 轮)`)
          return
        }
        if (opts.dispose === 'block') {
          try {
            await blockPhone(prevPhone)
            setAutoBlocked((n) => n + 1)
            toast.info(`${prevPhone} 已注册过(登录验证码),已拉黑`)
          } catch (e) {
            toast.error(`拉黑失败(${(e as Error).message}),仍继续换号`)
          }
        } else {
          try {
            await releasePhone(prevPhone)
            toast.info(`${prevPhone} 等待超时未收到短信,已释放换号`)
          } catch {
            // 释放失败不阻断换号(平台备注:失败跳过即可)
          }
        }
        try {
          const f = autoFormRef.current
          const p = await acquireAutoPhone()
          autoRoundRef.current += 1
          setAutoRound(autoRoundRef.current)
          setPhone(p)
          // 换号后刷新台账卡片:否则仍展示上一轮号码的接码记录(收码前不会自刷)
          void refreshPhoneHistory(p)
          pendingKey.current = { phone: p, keyWord: f.keyWord.trim() }
          setSms(null)
          deadline.current = Date.now() + POLL_TIMEOUT_MS
          setPhase('polling')
          setPollSeed((s) => s + 1)
          toast.success(`已换号 ${p}(第 ${autoRoundRef.current} 轮),请重新去平台发送验证码`)
        } catch (e) {
          setPhase(opts.stopPhase)
          toast.error(`自动换号失败: ${(e as Error).message}。可手动重新取号继续`)
        }
      } finally {
        autoAdvancingRef.current = false
      }
    },
    [refreshPhoneHistory, acquireAutoPhone],
  )

  // 轮询取码:5s 间隔,3 分钟超时自动停(防忘停空烧计费);收到短信立即停
  React.useEffect(() => {
    if (phase !== 'polling') return
    const tick = async () => {
      const target = pendingKey.current
      if (!target) return
      // 超时前置检查:必须放在 fetch 之前 —— 请求持续失败时 catch 会吞错,
      // 超时判断若在 await 之后则永不可达(僵尸轮询,自动换号失效根因)
      if (Date.now() > deadline.current) {
        stopPolling()
        if (autoModeRef.current) {
          void advanceAutoRound(target.phone, {
            dispose: 'release',
            stopPhase: 'timeout',
            stopReason: `已连续筛选 ${MAX_AUTO_ROUNDS} 轮始终未收到短信`,
          })
        } else {
          setPhase('timeout')
          toast.error(`等待超时(${POLL_TIMEOUT_MS / 60000} 分钟),可释放号码后重新取号`)
        }
        return
      }
      try {
        const d = await fetchMessage(target.phone, target.keyWord)
        // 防串轮:等待期间已换号/重取号,本轮滞留结果作废
        if (pendingKey.current !== target) return
        if (d.status === 'received') {
          stopPolling()
          setSms(d)
          void refreshPhoneHistory(target.phone)
          // 用途分流:注册=新号(收口) / 登录=已注册过(自动模式下拉黑换号继续筛) / 其他=人工判断
          if (d.usageKind === 'register') {
            setPhase('received')
            toast.success(d.code ? `新号!验证码 ${d.code},请去平台完成注册` : '新号!收到注册验证码')
            return
          }
          if (d.usageKind === 'login' && autoModeRef.current) {
            void advanceAutoRound(target.phone, {
              dispose: 'block',
              stopPhase: 'received',
              stopReason: `已连续筛选 ${MAX_AUTO_ROUNDS} 轮未遇到新号`,
            })
            return
          }
          setPhase('received')
          if (d.usageKind === 'login') toast.info('该号已注册过(登录验证码)')
          else toast.info('收到短信(非注册/登录用途,请人工判断)')
          return
        }
      } catch {
        // 单次失败不中断轮询,由下一 tick 的超时前置检查兜底
      }
    }
    void tick()
    pollTimer.current = setInterval(() => void tick(), POLL_INTERVAL_MS)
    return stopPolling
  }, [phase, pollSeed, stopPolling, refreshPhoneHistory, advanceAutoRound])

  // 历史记录 60s 冷却倒计时
  React.useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  React.useEffect(() => stopPolling, [stopPolling])

  async function handleGetPhone(e: React.FormEvent) {
    e.preventDefault()
    if (!form.keyWord.trim()) {
      toast.error('短信关键词为必填项')
      return
    }
    setGetting(true)
    try {
      // 自动筛新号模式下忽略指定号码(自动换号也随机,避免指定号死循环)
      const f = autoMode ? { ...form, phone: '' } : form
      autoModeRef.current = autoMode
      autoFormRef.current = f
      autoRoundRef.current = 1
      setAutoRound(1)
      // 自动模式走零成本预筛取号:本地台账命中已注册直接拉黑重取,轮次在其上累加
      const p = autoMode ? await acquireAutoPhone() : await fetchPhone(f)
      setAutoBlocked(0)
      setPhone(p)
      setKeyWord(form.keyWord.trim())
      pendingKey.current = { phone: p, keyWord: form.keyWord.trim() }
      setSms(null)
      deadline.current = Date.now() + POLL_TIMEOUT_MS
      setPhase('polling')
      setPollSeed((s) => s + 1)
      toast.success(
        autoMode ? `已取号 ${p}(第 ${autoRoundRef.current} 轮),请去平台用它发送验证码` : `已取号 ${p},开始等待短信`,
      )
      void refreshPhoneHistory(p)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGetting(false)
    }
  }

  async function handleRelease() {
    if (!phone) return
    if (!window.confirm(`确认释放号码 ${phone}?释放后该号码不再归属本账号`)) return
    stopPolling()
    autoModeRef.current = false
    try {
      await releasePhone(phone)
      setPhase('idle')
      toast.success('已释放')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleBlock() {
    if (!phone) return
    if (!window.confirm(`确认拉黑号码 ${phone}?拉黑后平台不再分配该号码`)) return
    stopPolling()
    autoModeRef.current = false
    try {
      await blockPhone(phone)
      setPhase('idle')
      toast.success('已拉黑')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!phone) {
      toast.error('请先取号,发送短信使用取到的号码作为发送方')
      return
    }
    if (!sendForm.toPhone.trim() || !sendForm.content.trim()) {
      toast.error('接收号码与内容均为必填')
      return
    }
    setSending(true)
    try {
      await sendSms(phone, sendForm.toPhone.trim(), sendForm.content.trim())
      toast.success('发送成功')
      setSendForm({ toPhone: '', content: '' })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  async function handleFetchUsed() {
    setUsedLoading(true)
    try {
      setUsedItems(await fetchUsed())
      setCooldown(USED_COOLDOWN_SECONDS)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUsedLoading(false)
    }
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquareMore className="h-6 w-6 text-primary" />
          短信接码
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          余额:{balanceLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : balance !== null ? (
            <span className="font-mono font-semibold text-foreground">{balance}</span>
          ) : (
            '—'
          )}
          <Button variant="outline" size="sm" onClick={() => void refreshBalance()}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 取号 + 取码 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              取号与收码
            </CardTitle>
            <CardDescription>
              关键词填短信黑括号里的名字,如【毛竹】验证码9876 → 填「毛竹」;不填可能收不到被屏蔽的短信
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleGetPhone} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="keyWord">短信关键词 *</Label>
                <Input
                  id="keyWord"
                  value={form.keyWord}
                  onChange={(e) => setForm({ ...form, keyWord: e.target.value })}
                  placeholder="如:毛竹"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>卡类型</Label>
                  <Select
                    value={form.cardType}
                    onValueChange={(v) => setForm({ ...form, cardType: v as GetPhoneForm['cardType'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="province">省份(可选)</Label>
                  <Input
                    id="province"
                    value={form.province}
                    onChange={(e) => setForm({ ...form, province: e.target.value })}
                    placeholder="留空随机"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="specPhone">指定号码(可选)</Label>
                <Input
                  id="specPhone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder={autoMode ? '自动筛新号模式下随机取号' : '留空随机取号'}
                  disabled={autoMode}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoMode}
                  onChange={(e) => {
                    setAutoMode(e.target.checked)
                    autoModeRef.current = e.target.checked
                    if (e.target.checked) setForm((f) => ({ ...f, phone: '' }))
                  }}
                  className="h-4 w-4"
                  disabled={phase === 'polling'}
                />
                自动筛新号(遇到已注册号自动拉黑换号,最多 {MAX_AUTO_ROUNDS} 轮)
              </label>
              <Button type="submit" className="w-full" disabled={getting || phase === 'polling'}>
                {getting && <Loader2 className="h-4 w-4 animate-spin" />}
                取号
              </Button>
            </form>

            {phone && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">当前号码</span>
                  <span className="font-mono text-lg font-bold">{phone}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (await copyText(phone)) toast.success('已复制号码')
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    复制号码
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleRelease()}>
                    <Trash2 className="h-4 w-4" />
                    释放
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleBlock()}>
                    <Ban className="h-4 w-4" />
                    拉黑
                  </Button>
                </div>

                {phase === 'polling' && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在等待短信(关键词「{keyWord}」),每 {POLL_INTERVAL_MS / 1000} 秒查询一次…
                    </div>
                    {autoRound > 0 && (
                      <div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-2 text-sm text-sky-600">
                        自动筛新号:第 {autoRound} 轮 · 已拉黑 {autoBlocked} 个 ·
                        请用 <span className="font-mono font-bold">{phone}</span> 去「{keyWord}
                        」平台发送验证码
                      </div>
                    )}
                  </div>
                )}
                {phase === 'timeout' && (
                  <div className="text-sm text-destructive">
                    {autoRound > 0
                      ? `自动筛选已停止:连续 ${autoRound} 轮未收到短信。可调整关键词/卡类型后重新取号继续。`
                      : '等待超时,未收到短信。可释放号码后重新取号,或检查关键词是否正确。'}
                  </div>
                )}
                {phase === 'received' && sms?.status === 'received' && (
                  <div className="space-y-2">
                    {sms.usageKind === 'login' && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/15 p-2 text-sm text-amber-600">
                        该号已注册过{sms.platform ? `【${sms.platform}】` : '该平台'}
                        ,本次收到的为登录验证码(非首次注册)
                      </div>
                    )}
                    {sms.usageKind === 'register' && (
                      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/15 p-2 text-sm text-emerald-600">
                        新号注册{sms.platform ? `:${sms.platform}` : ''},该号码此前未在该平台注册过
                      </div>
                    )}
                    {sms.code && (
                      <div className="flex items-center justify-between rounded-md bg-primary/10 p-3">
                        <span className="font-mono text-2xl font-bold tracking-widest text-primary">
                          {sms.code}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (await copyText(sms.code ?? '')) toast.success('已复制验证码')
                          }}
                        >
                          <Copy className="h-4 w-4" />
                          复制验证码
                        </Button>
                      </div>
                    )}
                    <p className="rounded-md bg-muted p-3 text-sm break-all">{sms.raw}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* 发送短信 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                发送短信
              </CardTitle>
              <CardDescription>
                以当前持有号码发送;不能向个人手机号发送,发送垃圾信息平台会封号
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSend} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="toPhone">接收号码(1069 等非个人号码)</Label>
                  <Input
                    id="toPhone"
                    value={sendForm.toPhone}
                    onChange={(e) => setSendForm({ ...sendForm, toPhone: e.target.value })}
                    placeholder="1069xxxxxxxx"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="content">发送内容</Label>
                  <Input
                    id="content"
                    value={sendForm.content}
                    onChange={(e) => setSendForm({ ...sendForm, content: e.target.value })}
                    placeholder="最长 500 字符"
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={sending || !phone}>
                  {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                  发送
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 历史记录 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                历史记录
              </CardTitle>
              <CardDescription>
                平台限频 1 次/分钟,返回最近 24 小时最多 100 条
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleFetchUsed()}
                disabled={usedLoading || cooldown > 0}
              >
                {usedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {cooldown > 0 ? `冷却中 ${cooldown}s` : '查询历史'}
              </Button>
              {usedItems.length > 0 && (
                <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                  {usedItems.join('\n')}
                </pre>
              )}
            </CardContent>
          </Card>

          {/* 号码接码台账(本地留痕,收码即记) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                号码接码台账
              </CardTitle>
              <CardDescription>
                本地留痕,不受平台 24h/100 条限制;「登录」=该号已注册过对应平台
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!phone ? (
                <p className="text-sm text-muted-foreground">取号后自动展示该号码的历史接码记录</p>
              ) : phoneHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {historyLoading
                    ? '查询中…'
                    : '该号码暂无本地台账记录(首次使用,通常是没接过码的新号)'}
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-auto">
                  {phoneHistory.map((h) => (
                    <div key={h.id} className="rounded-md border p-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {new Date(h.receivedAt).toLocaleString('zh-CN', { hour12: false })}
                        </span>
                        {h.platform && <span className="text-xs font-semibold">【{h.platform}】</span>}
                        <UsageTag kind={h.usageKind} />
                        {h.smsCode && (
                          <span className="font-mono font-bold text-primary">{h.smsCode}</span>
                        )}
                        {h.keyword && (
                          <span className="text-xs text-muted-foreground">关键词:{h.keyword}</span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground" title={h.smsRaw}>
                        {h.smsRaw}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        API 文档:https://www.d1jiema.com/api.html · 频率计费:同一账号或 IP 每请求 1000 次扣
        0.01~0.2 元 · Token 配置于服务端 D1JIEMA_TOKEN
      </p>
    </div>
  )
}

/** 台账用途小标签:注册=新号首次接码 / 登录=该号已注册过该平台 */
function UsageTag({ kind }: { kind: PhoneHistoryItem['usageKind'] }) {
  if (kind === 'register')
    return <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-600">注册</span>
  if (kind === 'login')
    return (
      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-600">
        登录(已注册过)
      </span>
    )
  return <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">其他</span>
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
