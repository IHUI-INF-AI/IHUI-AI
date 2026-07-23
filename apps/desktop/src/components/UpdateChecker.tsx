import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { useI18n } from '../i18n'
import { checkForUpdate, downloadAndInstallUpdate, type DownloadProgress } from '../lib/updater'

type Status = 'idle' | 'checking' | 'available' | 'downloading' | 'done' | 'error' | 'latest'

export function UpdateChecker() {
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState('')

  const onCheck = async () => {
    setStatus('checking')
    setError('')
    try {
      const info = await checkForUpdate()
      if (!info) {
        setStatus('latest')
        return
      }
      setVersion(info.version)
      setStatus('available')
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  const onDownload = async () => {
    setStatus('downloading')
    setError('')
    setProgress(null)
    try {
      await downloadAndInstallUpdate((p) => setProgress(p))
      setStatus('done')
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('update.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="setting-row">
          <span>{labelFor(status, version, t)}</span>
          {status === 'idle' && (
            <button type="button" onClick={onCheck}>{t('update.check')}</button>
          )}
          {status === 'checking' && (
            <button type="button" disabled>{t('update.checking')}</button>
          )}
          {status === 'available' && (
            <button type="button" onClick={onDownload}>{t('update.download')}</button>
          )}
          {status === 'downloading' && (
            <button type="button" disabled>
              {progress && progress.contentLength > 0
                ? `${Math.round((progress.downloaded / progress.contentLength) * 100)}%`
                : t('update.downloading')}
            </button>
          )}
        </div>
        {error && <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>{error}</p>}
      </CardContent>
    </Card>
  )
}

function labelFor(
  status: Status,
  version: string,
  t: (k: string, p?: Record<string, string | number>) => string,
): string {
  switch (status) {
    case 'idle': return t('update.idle')
    case 'checking': return t('update.checking')
    case 'available': return t('update.available', { version })
    case 'downloading': return t('update.downloading')
    case 'done': return t('update.done')
    case 'latest': return t('update.latest')
    case 'error': return t('update.error')
  }
}
