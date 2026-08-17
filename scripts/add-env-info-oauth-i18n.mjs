#!/usr/bin/env node
/**
 * 幂等注入 GitHub OAuth Device Flow i18n key(2026-08-17)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'packages/i18n/messages/web')
const WORDS = {
  'zh-CN': {
    authorize: '使用 GitHub 授权',
    authorizing: '等待授权…',
    userCode: '授权码',
    verificationUri: '授权页面',
    openAuthPage: '打开授权页面',
    authorizePending: '请在浏览器中确认授权…',
    authorizeExpired: '授权已过期,请重新发起',
    authSuccess: 'GitHub 授权成功,已连接仓库',
    authFail: 'GitHub 授权失败',
    manualToken: '手动输入 Token(高级)',
    noOAuthConfig: '未配置 GitHub OAuth App,请手动输入 Token 或联系管理员',
    copied: '已复制授权码',
    copyCode: '复制授权码',
  },
  'zh-TW': {
    authorize: '使用 GitHub 授權',
    authorizing: '等待授權…',
    userCode: '授權碼',
    verificationUri: '授權頁面',
    openAuthPage: '開啟授權頁面',
    authorizePending: '請在瀏覽器中確認授權…',
    authorizeExpired: '授權已過期,請重新發起',
    authSuccess: 'GitHub 授權成功,已連結儲存庫',
    authFail: 'GitHub 授權失敗',
    manualToken: '手動輸入 Token(進階)',
    noOAuthConfig: '未設定 GitHub OAuth App,請手動輸入 Token 或聯絡管理員',
    copied: '已複製授權碼',
    copyCode: '複製授權碼',
  },
  en: {
    authorize: 'Authorize with GitHub',
    authorizing: 'Waiting for authorization…',
    userCode: 'Authorization code',
    verificationUri: 'Authorization page',
    openAuthPage: 'Open authorization page',
    authorizePending: 'Please confirm authorization in your browser…',
    authorizeExpired: 'Authorization expired, please retry',
    authSuccess: 'GitHub authorized, repository connected',
    authFail: 'GitHub authorization failed',
    manualToken: 'Enter token manually (advanced)',
    noOAuthConfig: 'GitHub OAuth App not configured. Enter token manually or contact admin',
    copied: 'Authorization code copied',
    copyCode: 'Copy code',
  },
  ja: {
    authorize: 'GitHub で認証',
    authorizing: '認証待ち…',
    userCode: '認証コード',
    verificationUri: '認証ページ',
    openAuthPage: '認証ページを開く',
    authorizePending: 'ブラウザで認証を確認してください…',
    authorizeExpired: '認証が期限切れです。再試行してください',
    authSuccess: 'GitHub 認証成功、リポジトリ接続済み',
    authFail: 'GitHub 認証に失敗しました',
    manualToken: 'Token を手動入力(上級)',
    noOAuthConfig: 'GitHub OAuth App が設定されていません。Token を手動入力するか管理者に連絡してください',
    copied: '認証コードをコピーしました',
    copyCode: 'コードをコピー',
  },
  ko: {
    authorize: 'GitHub로 인증',
    authorizing: '인증 대기 중…',
    userCode: '인증 코드',
    verificationUri: '인증 페이지',
    openAuthPage: '인증 페이지 열기',
    authorizePending: '브라우저에서 인증을 확인하세요…',
    authorizeExpired: '인증이 만료되었습니다. 다시 시도하세요',
    authSuccess: 'GitHub 인증 성공, 저장소 연결됨',
    authFail: 'GitHub 인증 실패',
    manualToken: '수동으로 토큰 입력(고급)',
    noOAuthConfig: 'GitHub OAuth App이 구성되지 않았습니다. 토큰을 수동 입력하거나 관리자에게 문의하세요',
    copied: '인증 코드가 복사되었습니다',
    copyCode: '코드 복사',
  },
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
  console.log(`[OK]   ${lang}: filled ${Object.keys(w).length} keys`)
  const trailingNL = raw.endsWith('\n') ? '\n' : ''
  writeFileSync(file, `${JSON.stringify(json, null, 2)}${trailingNL}`, 'utf-8')
}
console.log(changed > 0 ? `\nDone: ${changed} file(s)` : '\nNothing to do')
