#!/usr/bin/env node
/**
 * 幂等注入 GitHub 集成 i18n key(2026-08-17)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'packages/i18n/messages/web')
const WORDS = {
  'zh-CN': {
    connectGithub: '连接 GitHub',
    githubToken: 'GitHub Token',
    tokenPlaceholder: '输入 GitHub Personal Access Token…',
    connected: '已连接',
    notConnected: '未连接',
    githubTokenHint: 'Token 仅保存在本机 ~/.ihui/github_token,用于查询 PR 状态',
    tokenSaved: 'Token 已保存',
    tokenSaveFailed: 'Token 保存失败,请检查有效性',
    prConnectHint: '连接 GitHub 以获取拉取请求状态',
    compareOnGithub: '在 GitHub 上比较分支',
    githubConnectedAs: '已连接 GitHub',
    githubConfigure: '配置 GitHub 仓库连接',
    tokenClear: '清除 Token',
    tokenCleared: 'Token 已清除',
  },
  'zh-TW': {
    connectGithub: '連結 GitHub',
    githubToken: 'GitHub Token',
    tokenPlaceholder: '輸入 GitHub Personal Access Token…',
    connected: '已連結',
    notConnected: '未連結',
    githubTokenHint: 'Token 僅儲存在本機 ~/.ihui/github_token,用於查詢 PR 狀態',
    tokenSaved: 'Token 已儲存',
    tokenSaveFailed: 'Token 儲存失敗,請檢查有效性',
    prConnectHint: '連結 GitHub 以取得拉取請求狀態',
    compareOnGithub: '在 GitHub 上比較分支',
    githubConnectedAs: '已連結 GitHub',
    githubConfigure: '設定 GitHub 儲存庫連結',
    tokenClear: '清除 Token',
    tokenCleared: 'Token 已清除',
  },
  en: {
    connectGithub: 'Connect GitHub',
    githubToken: 'GitHub Token',
    tokenPlaceholder: 'Enter GitHub Personal Access Token…',
    connected: 'Connected',
    notConnected: 'Not connected',
    githubTokenHint: 'Token is stored locally at ~/.ihui/github_token, used for PR status',
    tokenSaved: 'Token saved',
    tokenSaveFailed: 'Failed to save token, please check its validity',
    prConnectHint: 'Connect GitHub to fetch pull request status',
    compareOnGithub: 'Compare branches on GitHub',
    githubConnectedAs: 'Connected to GitHub',
    githubConfigure: 'Configure GitHub repository connection',
    tokenClear: 'Clear Token',
    tokenCleared: 'Token cleared',
  },
  ja: {
    connectGithub: 'GitHub に接続',
    githubToken: 'GitHub Token',
    tokenPlaceholder: 'GitHub Personal Access Token を入力…',
    connected: '接続済み',
    notConnected: '未接続',
    githubTokenHint: 'Token はローカルの ~/.ihui/github_token に保存され、PR 状態の取得に使用されます',
    tokenSaved: 'Token を保存しました',
    tokenSaveFailed: 'Token の保存に失敗しました。有効性を確認してください',
    prConnectHint: 'GitHub に接続してプルリクエスト状態を取得',
    compareOnGithub: 'GitHub でブランチを比較',
    githubConnectedAs: 'GitHub に接続済み',
    githubConfigure: 'GitHub リポジトリ接続を設定',
    tokenClear: 'Token をクリア',
    tokenCleared: 'Token をクリアしました',
  },
  ko: {
    connectGithub: 'GitHub 연결',
    githubToken: 'GitHub 토큰',
    tokenPlaceholder: 'GitHub Personal Access Token 입력…',
    connected: '연결됨',
    notConnected: '연결 안 됨',
    githubTokenHint: '토큰은 로컬 ~/.ihui/github_token에 저장되며 PR 상태 조회에 사용됩니다',
    tokenSaved: '토큰이 저장되었습니다',
    tokenSaveFailed: '토큰 저장 실패. 유효성을 확인하세요',
    prConnectHint: 'GitHub에 연결하여 풀 리퀘스트 상태 가져오기',
    compareOnGithub: 'GitHub에서 브랜치 비교',
    githubConnectedAs: 'GitHub에 연결됨',
    githubConfigure: 'GitHub 저장소 연결 구성',
    tokenClear: '토큰 지우기',
    tokenCleared: '토큰이 지워졌습니다',
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
