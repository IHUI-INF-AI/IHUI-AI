'use client'

import { useTranslations, useLocale } from 'next-intl'
import { formatDate } from './helpers'
import type { Certificate } from './types'

interface Props {
  list: Certificate[]
  statusText: Record<number, string>
}

export function CertificatePrintArea({ list, statusText }: Props) {
  const t = useTranslations('certificate')
  const locale = useLocale()
  return (
    <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
      {list.map((cert) => (
        <div
          key={cert.id}
          data-print-cert-id={cert.id}
          style={{
            width: '800px',
            padding: '64px 48px',
            background: '#ffffff',
            textAlign: 'center',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            color: '#1f2937',
          }}
        >
          <div style={{ fontSize: '14px', color: '#9ca3af', letterSpacing: '2px' }}>
            CERTIFICATE
          </div>
          <h1 style={{ fontSize: '32px', margin: '12px 0 8px' }}>{cert.name}</h1>
          <p style={{ color: '#6b7280', marginBottom: '32px' }}>
            {t('download.certNo')}：{cert.certificateNo ?? '-'}
          </p>
          <div style={{ fontSize: '16px', lineHeight: '2.2', color: '#374151' }}>
            <p>{t('download.certText', { name: cert.nickname ?? '-' })}</p>
            <p>
              {t('download.issueTime')}：{formatDate(cert.issuedAt, locale)}
            </p>
            <p>
              {t('download.status')}: {statusText[cert.status] ?? t('download.statusValid')}
            </p>
          </div>
          <div
            style={{
              marginTop: '48px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '14px',
              color: '#6b7280',
            }}
          >
            <span>{t('download.issuingOrg')}</span>
            <span>{formatDate(cert.issuedAt, locale)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
