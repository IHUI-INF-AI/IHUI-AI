import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const MESSAGES_DIR = join(process.cwd(), 'packages', 'i18n', 'messages')

const MOBILE_RN_DEAD = {
  activityDetail: ['loadFailed'],
  agentReviewDetail: ['loadFailed'],
  debug: [
    'apiBaseUrl', 'clearCache', 'clearStorage', 'cleared', 'confirm',
    'copied', 'copyFailed', 'copyLogs', 'env', 'locale', 'platform',
    'title', 'version', 'warning',
  ],
  exam: ['startHint'],
  helpDetail: ['loadFailed'],
  lecturerDetail: ['loadFailed'],
  taskDispatch: [
    'title', 'inputPlaceholder', 'send', 'sending', 'loadTasksFailed',
    'loadDevicesFailed', 'selectDeviceFirst', 'dispatchFailed', 'emptyTasks',
    'noDevices', 'target',
    'status.pending', 'status.running', 'status.completed', 'status.failed', 'status.cancelled',
    'cancel.cancelButton', 'cancel.cancelling', 'cancel.cancelFailed',
    'reconnect.reconnecting',
    'file.attach', 'file.attached', 'file.tooLarge', 'file.invalidBase64',
    'file.missingFilename', 'file.filenamePlaceholder', 'file.mimePlaceholder', 'file.contentPlaceholder',
  ],
}

const MINIAPP_TARO_DEAD = {
  news: ['views'],
}

function removeKeys(obj, deadMap) {
  for (const [ns, keys] of Object.entries(deadMap)) {
    if (!(ns in obj)) {
      console.warn('[WARN] namespace "' + ns + '" not found')
      continue
    }
    for (const key of keys) {
      const parts = key.split('.')
      let cur = obj[ns]
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === null || cur[parts[i]] === undefined) {
          console.warn('[WARN] path "' + ns + '.' + key + '" broken at "' + parts[i] + '"')
          break
        }
        cur = cur[parts[i]]
      }
      const leaf = parts[parts.length - 1]
      if (cur !== null && cur !== undefined && leaf in cur) {
        delete cur[leaf]
      } else {
        console.warn('[WARN] key "' + ns + '.' + key + '" not found')
      }
    }
    if (Object.keys(obj[ns]).length === 0) {
      delete obj[ns]
    }
  }
}

function processFile(relPath, deadMap) {
  const fullPath = join(MESSAGES_DIR, relPath)
  if (!existsSync(fullPath)) {
    console.warn('[WARN] file not found: ' + fullPath)
    return
  }
  const raw = readFileSync(fullPath, 'utf-8')
  const obj = JSON.parse(raw)
  const beforeKeys = JSON.stringify(Object.keys(obj).sort())
  removeKeys(obj, deadMap)
  writeFileSync(fullPath, JSON.stringify(obj, null, 2) + '\n', 'utf-8')
  console.log(relPath + ': ' + beforeKeys.slice(0, 40) + '...')
}

for (const loc of LOCALES) {
  processFile(join('mobile-rn', loc + '.json'), MOBILE_RN_DEAD)
}

for (const loc of LOCALES) {
  processFile(join('miniapp-taro', loc + '.json'), MINIAPP_TARO_DEAD)
}

console.info('\nDone')