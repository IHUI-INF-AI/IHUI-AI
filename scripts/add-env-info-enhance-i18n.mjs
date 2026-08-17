#!/usr/bin/env node
/**
 * 幂等补 aiChat.envInfo 增强 5 key(noCommit/retry/pushOk/pushFail/commitNoRemote)(2026-08-17)。
 * 仅补缺失,不覆盖已有。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'packages/i18n/messages/web')
const WORDS = {
  'zh-CN': { noCommit: '无提交', retry: '重试', pushOk: '推送成功', pushFail: '推送失败', commitNoRemote: '未配置远程仓库,仅本地提交' },
  'zh-TW': { noCommit: '無提交', retry: '重試', pushOk: '推送成功', pushFail: '推送失敗', commitNoRemote: '未設定遠端儲存庫,僅本機提交' },
  en: { noCommit: 'No commits', retry: 'Retry', pushOk: 'Pushed successfully', pushFail: 'Push failed', commitNoRemote: 'No remote configured, committed locally only' },
  ja: { noCommit: 'コミットなし', retry: '再試行', pushOk: 'プッシュ成功', pushFail: 'プッシュ失敗', commitNoRemote: 'リモート未設定、ローカルコミットのみ' },
  ko: { noCommit: '커밋 없음', retry: '재시도', pushOk: '푸시 성공', pushFail: '푸시 실패', commitNoRemote: '원격 저장소 미구성, 로컬 커밋만' },
}

let changed = 0
for (const [lang, w] of Object.entries(WORDS)) {
  const file = join(DIR, `${lang}.json`)
  const raw = readFileSync(file, 'utf-8')
  const json = JSON.parse(raw)
  const envInfo = json.aiChat?.envInfo
  if (!envInfo || typeof envInfo !== 'object') {
    console.error(`[SKIP] ${lang}: no envInfo`)
    continue
  }
  let modified = false
  for (const [k, v] of Object.entries(w)) {
    if (!(k in envInfo)) {
      envInfo[k] = v
      modified = true
    }
  }
  if (!modified) {
    console.log(`[SKIP] ${lang}: all exist`)
    continue
  }
  changed++
  console.log(`[OK]   ${lang}: filled ${Object.keys(w).filter((k) => !(k in envInfo) || true).length}`)
  const trailingNL = raw.endsWith('\n') ? '\n' : ''
  writeFileSync(file, `${JSON.stringify(json, null, 2)}${trailingNL}`, 'utf-8')
}
console.log(changed > 0 ? `\nDone: ${changed} file(s)` : '\nNothing to do')
