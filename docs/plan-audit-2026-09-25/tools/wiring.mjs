import { execFileSync } from 'node:child_process'
const g = (...a) => {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true })
  } catch (e) {
    if (e.status === 1) return (e.stdout || '').toString()
    return ''
  }
}
const T = [
  'QuotaOwnershipCard',
  'ConnectorAuthCard',
  'VoiceSubtitleBar',
  'PaneSplitContainer',
  'BusinessFormCard',
  'business-form-card',
  'InputNoticeBanner',
  'tool-activity-line',
  'deriveStepDecision',
  'stepDecisionState',
  'onSteer',
  'blocked',
  'ReviewStatsBar',
  'CATEGORY_TABLE',
]
for (const t of T) {
  const files = g('grep', '-l', '-I', '-F', t, 'HEAD', '--', 'apps', 'packages', 'sdks')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(l.indexOf(':') + 1).split(':')[0])
  console.log(`\n${t}  (${files.length} 文件)`)
  files.slice(0, 12).forEach((f) => console.log('   ' + f))
}
