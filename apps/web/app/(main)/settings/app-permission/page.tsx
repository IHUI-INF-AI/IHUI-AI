'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Smartphone } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@ihui/ui'
import { Container } from '@/components/layout'
import { cn } from '@/lib/utils'

interface AppPermission {
  name: string
  purposeKey: string
  required: boolean
}

export default function AppPermissionPage() {
  const t = useTranslations('settings')

  const permissions: AppPermission[] = [
    { name: '相机', purposeKey: 'appPermissionCameraPurpose', required: false },
    { name: '相册', purposeKey: 'appPermissionAlbumPurpose', required: false },
    { name: '麦克风', purposeKey: 'appPermissionMicPurpose', required: false },
    { name: '通知', purposeKey: 'appPermissionNotificationPurpose', required: false },
    { name: '存储', purposeKey: 'appPermissionStoragePurpose', required: true },
    { name: '网络访问', purposeKey: 'appPermissionNetworkPurpose', required: true },
    { name: '设备识别', purposeKey: 'appPermissionDeviceIdPurpose', required: true },
  ]

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('appPermissionTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('appPermissionDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4" />
            {t('appPermissionCardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('appPermissionName')}</TableHead>
                  <TableHead>{t('appPermissionPurpose')}</TableHead>
                  <TableHead className="w-24 text-center">{t('appPermissionRequired')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((perm) => (
                  <TableRow key={perm.name}>
                    <TableCell className="whitespace-nowrap text-sm font-medium">
                      {perm.name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t(perm.purposeKey)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          perm.required
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {perm.required
                          ? t('appPermissionRequiredYes')
                          : t('appPermissionRequiredNo')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </Container>
  )
}
