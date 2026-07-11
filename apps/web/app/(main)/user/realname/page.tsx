'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldCheck, Clock, XCircle, User } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

const realnameSchema = z.object({
  realName: z.string().min(2, '真实姓名至少2个字符').max(50, '真实姓名最多50个字符'),
  idCard: z.string().min(15, '身份证号至少15位').max(20, '身份证号最多20位'),
  source: z.enum(['pc', 'h5', 'miniapp']),
})

type RealnameValues = z.infer<typeof realnameSchema>

interface RealnameInfo {
  status: 'unverified' | 'pending' | 'approved' | 'rejected' | null
  realName?: string
  idCard?: string
  source?: string
  rejectReason?: string
  auditTime?: string
  createdAt?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function formatDate(v?: string): string {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

export default function RealnamePage() {
  const t = useTranslations('user')
  const qc = useQueryClient()

  const { data: info, isLoading } = useQuery({
    queryKey: ['auth', 'realname', 'my'],
    queryFn: () => api<RealnameInfo>('/api/auth/realname/my'),
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RealnameValues>({
    resolver: zodResolver(realnameSchema),
    defaultValues: { realName: '', idCard: '', source: 'pc' },
  })

  const source = watch('source')

  const onSubmit = async (values: RealnameValues) => {
    try {
      const r = await fetchApi('/api/auth/realname/submit', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      if (r.success) {
        toast.success(t('realname.success'))
        reset()
        qc.invalidateQueries({ queryKey: ['auth', 'realname', 'my'] })
      } else {
        toast.error(r.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('realname.error'))
    }
  }

  const status = info?.status ?? null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <User className="h-6 w-6 text-primary" />
          {t('realname.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('realname.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('realname.loading')}
        </div>
      ) : status === 'approved' ? (
        <Card className="border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
              <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('realname.approvedTitle')}</p>
              <p className="text-lg font-semibold">{info?.realName ?? '-'}</p>
              <p className="text-xs text-muted-foreground">
                {t('realname.auditTime')}：{formatDate(info?.auditTime)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : status === 'pending' ? (
        <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-500" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">{t('realname.pendingTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('realname.pendingHint')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {status === 'rejected' && (
            <Card className="border-red-500/40 bg-red-50/40 dark:bg-red-950/20">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                  <XCircle className="h-6 w-6 text-red-600 dark:text-red-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{t('realname.rejectedTitle')}</p>
                  <p className="text-sm text-red-600 dark:text-red-500">
                    {t('realname.rejectedReason')}：{info?.rejectReason ?? t('realname.noReason')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {status === 'rejected' ? t('realname.form.resubmit') : t('realname.formTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="realName">{t('realname.form.name')}</Label>
                  <Input
                    id="realName"
                    placeholder={t('realname.form.namePlaceholder')}
                    {...register('realName')}
                  />
                  {errors.realName && (
                    <p className="text-xs text-destructive">{errors.realName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idCard">{t('realname.form.idCard')}</Label>
                  <Input
                    id="idCard"
                    placeholder={t('realname.form.idCardPlaceholder')}
                    {...register('idCard')}
                  />
                  {errors.idCard && (
                    <p className="text-xs text-destructive">{errors.idCard.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('realname.source')}</Label>
                  <Select
                    value={source}
                    onValueChange={(v) => setValue('source', v as 'pc' | 'h5' | 'miniapp')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pc">{t('realname.sourcePC')}</SelectItem>
                      <SelectItem value="h5">{t('realname.sourceH5')}</SelectItem>
                      <SelectItem value="miniapp">{t('realname.sourceMiniapp')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('realname.form.submit')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
