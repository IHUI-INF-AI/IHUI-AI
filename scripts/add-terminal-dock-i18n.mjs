#!/usr/bin/env node
/**
 * 幂等注入 aiChat.terminalDock(4 key)到 5 语言(2026-08-17)。
 * 仅补齐缺失 key,不覆盖已有;terminalDock 不存在则创建。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'packages/i18n/messages/web')
const WORDS = {
  'zh-CN': { title: 'PowerShell 终端', newSession: '新建终端', collapse: '收起', resize: '调整高度' },
  'zh-TW': { title: 'PowerShell 終端', newSession: '新增終端', collapse: '收起', resize: '調整高度' },
  en: { title: 'PowerShell Terminal', newSession: 'New Terminal', collapse: 'Collapse', resize: 'Resize' },
  ja: { title: 'PowerShell ターミナル', newSession: '新規ターミナル', collapse: '折りたたむ', resize: '高さ調整' },
  ko: { title: 'PowerShell 터미널', newSession: '새 터미널', collapse: '접기', resize: '높이 조정' },
}

let changed = 0
for (const [lang, w] of Object.entries(WORDS)) {
  const file = join(DIR, `${lang}.json`)
  const raw = readFileSync(file, 'utf-8')
  const json = JSON.parse(raw)
  const aiChat = json.aiChat
  if (!aiChat || typeof aiChat !== 'object') {
    console.error(`[SKIP] ${lang}: no aiChat`)
    continue
  }
  if (!aiChat.terminalDock || typeof aiChat.terminalDock !== 'object') {
    aiChat.terminalDock = { ...w }
    changed++
    console.log(`[OK]   ${lang}: terminalDock created (${Object.keys(w).length} keys)`)
    const trailingNL = raw.endsWith('\n') ? '\n' : ''
    writeFileSync(file, `${JSON.stringify(json, null, 2)}${trailingNL}`, 'utf-8')
    continue
  }
  let modified = false
  for (const [k, v] of Object.entries(w)) {
    if (!(k in aiChat.terminalDock)) {
      aiChat.terminalDock[k] = v
      modified = true
    }
  }
  if (!modified) {
    console.log(`[SKIP] ${lang}: all exist`)
    continue
  }
  changed++
  console.log(`[OK]   ${lang}: keys filled`)
  const trailingNL = raw.endsWith('\n') ? '\n' : ''
  writeFileSync(file, `${JSON.stringify(json, null, 2)}${trailingNL}`, 'utf-8')
}
console.log(changed > 0 ? `\nDone: ${changed} file(s)` : '\nNothing to do')
