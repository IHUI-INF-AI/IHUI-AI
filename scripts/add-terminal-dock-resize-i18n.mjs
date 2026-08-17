#!/usr/bin/env node
/**
 * 幂等补充 terminalDock.resize key(2026-08-17):ai-terminal-dock.tsx 拖拽命中区 aria-label 用到。
 * 仅追加缺失 key,不覆盖已有。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'packages/i18n/messages/web')
const WORDS = {
  'zh-CN': { resize: '调整高度' },
  'zh-TW': { resize: '調整高度' },
  en: { resize: 'Resize' },
  ja: { resize: '高さ調整' },
  ko: { resize: '높이 조정' },
}

let changed = 0
for (const [lang, w] of Object.entries(WORDS)) {
  const file = join(DIR, `${lang}.json`)
  const raw = readFileSync(file, 'utf-8')
  const json = JSON.parse(raw)
  const td = json.aiChat?.terminalDock
  if (!td || typeof td !== 'object') {
    console.error(`[SKIP] ${lang}: no terminalDock`)
    continue
  }
  if ('resize' in td) {
    console.log(`[SKIP] ${lang}: resize exists`)
    continue
  }
  td.resize = w.resize
  const trailingNL = raw.endsWith('\n') ? '\n' : ''
  writeFileSync(file, `${JSON.stringify(json, null, 2)}${trailingNL}`, 'utf-8')
  changed++
  console.log(`[OK]   ${lang}: resize injected`)
}
console.log(changed > 0 ? `\nDone: ${changed} file(s)` : '\nNothing to do')
