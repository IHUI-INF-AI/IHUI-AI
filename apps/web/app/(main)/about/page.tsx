'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Info, Mail, Phone, MapPin, Globe, Loader2, Shield, Users, Target } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Container } from '@/components/layout'

interface AboutInfo {
  siteName?: string | null
  description?: string | null
  about?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  website?: string | null
  version?: string | null
  icp?: string | null
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AboutPage() {
  const t = useTranslations('about')

  const { data, isLoading, error } = useQuery({
    queryKey: ['about'],
    queryFn: () => api<AboutInfo>(`/api/settings/about`),
    retry: false,
  })

  const info: AboutInfo = data ?? {}

  return (
    <Container maxWidth="lg" padding={false} className="space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Info className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="space-y-6">
          {/* 端点不可用时显示静态内容 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                {t('platformIntro')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>{t('introDesc1')}</p>
              <p>{t('introDesc2')}</p>
              <p>{t('introDesc3')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                {t('contactUs')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('email')}:</span>
                <span>support@ihui.ai</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('phone')}:</span>
                <span>400-000-0000</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('address')}:</span>
                <span>{t('addressValue')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('website')}:</span>
                <span>https://www.ihui.ai</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                {t('versionInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('version')}</span>
                <span className="font-medium">v1.0.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('icp')}</span>
                <span>京ICP备00000000号</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 平台介绍 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                {t('platformIntro')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {info.about || info.description ? (
                <p>{info.about || info.description}</p>
              ) : (
                <>
                  <p>{t('introDesc1')}</p>
                  <p>{t('introDesc2')}</p>
                  <p>{t('introDesc3')}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* 联系方式 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                {t('contactUs')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {info.contactEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('email')}:</span>
                  <span>{info.contactEmail}</span>
                </div>
              )}
              {info.contactPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('phone')}:</span>
                  <span>{info.contactPhone}</span>
                </div>
              )}
              {info.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('address')}:</span>
                  <span>{info.address}</span>
                </div>
              )}
              {info.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('website')}:</span>
                  <span>{info.website}</span>
                </div>
              )}
              {!info.contactEmail && !info.contactPhone && !info.address && (
                <p className="text-muted-foreground">{t('noContact')}</p>
              )}
            </CardContent>
          </Card>

          {/* 版本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                {t('versionInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('version')}</span>
                <span className="font-medium">{info.version || 'v1.0.0'}</span>
              </div>
              {info.icp && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('icp')}</span>
                  <span>{info.icp}</span>
                </div>
              )}
              {info.siteName && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('siteName')}</span>
                  <span className="font-medium">{info.siteName}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 团队理念 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                {t('ourMission')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>{t('missionDesc1')}</p>
              <p>{t('missionDesc2')}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </Container>
  )
}
