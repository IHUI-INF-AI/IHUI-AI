#!/usr/bin/env node
/**
 * 幂等注入 AI 面板右上角三按钮 + 环境信息弹窗的 i18n key(2026-08-17)。
 * - 以 zh-CN 文案为基准,为 web 5 语言注入 aiChat.envInfoButton / openTerminal / toggleWorkPanel / envInfo.*
 * - 幂等:已存在的 key 不覆盖;envInfo 子对象做浅合并(逐 key 补齐缺失)
 * - 用法: node scripts/add-env-info-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DIR = join(ROOT, 'packages/i18n/messages/web')

// 各语言文案(zh-CN 为基准,zh-TW/en/ja/ko 翻译)
const TRANSLATIONS = {
  'zh-CN': {
    envInfoButton: '环境信息',
    openTerminal: '打开终端',
    toggleWorkPanel: '切换工作展示区',
    envInfo: {
      ariaLabel: '环境信息',
      title: '环境信息',
      refresh: '刷新',
      collapse: '折叠',
      loading: '加载中…',
      noWorkspace: '未选择工作区,请先在顶部绑定本地工作区',
      errorTitle: '环境信息加载失败',
      notRepo: '当前目录不是 Git 仓库',
      detached: '游离 HEAD',
      changes: '变更',
      noChanges: '无变更',
      local: '本地',
      remote: '远程',
      remoteYes: '已配置',
      remoteNo: '未配置',
      aheadBehind: '领先/落后',
      commitPush: '提交或推送',
      commitPlaceholder: '输入提交信息…',
      commitOk: '提交成功',
      commitFail: '提交或推送失败',
      pullRequest: '拉取请求',
      prUnavailable: '无法获取拉取请求状态',
      prNoRemote: '未配置远程仓库',
      compareBranch: '比较分支',
    },
  },
  'zh-TW': {
    envInfoButton: '環境資訊',
    openTerminal: '開啟終端',
    toggleWorkPanel: '切換工作展示區',
    envInfo: {
      ariaLabel: '環境資訊',
      title: '環境資訊',
      refresh: '重新整理',
      collapse: '摺疊',
      loading: '載入中…',
      noWorkspace: '未選擇工作區,請先在頂部綁定本機工作區',
      errorTitle: '環境資訊載入失敗',
      notRepo: '目前目錄不是 Git 儲存庫',
      detached: '游離 HEAD',
      changes: '變更',
      noChanges: '無變更',
      local: '本機',
      remote: '遠端',
      remoteYes: '已設定',
      remoteNo: '未設定',
      aheadBehind: '領先/落後',
      commitPush: '提交或推送',
      commitPlaceholder: '輸入提交訊息…',
      commitOk: '提交成功',
      commitFail: '提交或推送失敗',
      pullRequest: '拉取請求',
      prUnavailable: '無法取得拉取請求狀態',
      prNoRemote: '未設定遠端儲存庫',
      compareBranch: '比較分支',
    },
  },
  en: {
    envInfoButton: 'Environment Info',
    openTerminal: 'Open Terminal',
    toggleWorkPanel: 'Toggle Work Panel',
    envInfo: {
      ariaLabel: 'Environment Info',
      title: 'Environment Info',
      refresh: 'Refresh',
      collapse: 'Collapse',
      loading: 'Loading…',
      noWorkspace: 'No workspace selected. Bind a local workspace from the top first.',
      errorTitle: 'Failed to load environment info',
      notRepo: 'Current directory is not a Git repository',
      detached: 'detached HEAD',
      changes: 'Changes',
      noChanges: 'No changes',
      local: 'Local',
      remote: 'Remote',
      remoteYes: 'Configured',
      remoteNo: 'Not configured',
      aheadBehind: 'Ahead/Behind',
      commitPush: 'Commit & Push',
      commitPlaceholder: 'Enter commit message…',
      commitOk: 'Committed successfully',
      commitFail: 'Commit or push failed',
      pullRequest: 'Pull Request',
      prUnavailable: 'Unable to fetch pull request status',
      prNoRemote: 'No remote repository configured',
      compareBranch: 'Compare Branches',
    },
  },
  ja: {
    envInfoButton: '環境情報',
    openTerminal: 'ターミナルを開く',
    toggleWorkPanel: 'ワークパネルの切り替え',
    envInfo: {
      ariaLabel: '環境情報',
      title: '環境情報',
      refresh: '更新',
      collapse: '折りたたむ',
      loading: '読み込み中…',
      noWorkspace: 'ワークスペースが選択されていません。上部でローカルワークスペースをバインドしてください。',
      errorTitle: '環境情報の読み込みに失敗しました',
      notRepo: '現在のディレクトリは Git リポジトリではありません',
      detached: 'detached HEAD',
      changes: '変更',
      noChanges: '変更なし',
      local: 'ローカル',
      remote: 'リモート',
      remoteYes: '設定済み',
      remoteNo: '未設定',
      aheadBehind: '先行/遅延',
      commitPush: 'コミットとプッシュ',
      commitPlaceholder: 'コミットメッセージを入力…',
      commitOk: 'コミットに成功しました',
      commitFail: 'コミットまたはプッシュに失敗しました',
      pullRequest: 'プルリクエスト',
      prUnavailable: 'プルリクエストの状態を取得できません',
      prNoRemote: 'リモートリポジトリが設定されていません',
      compareBranch: 'ブランチを比較',
    },
  },
  ko: {
    envInfoButton: '환경 정보',
    openTerminal: '터미널 열기',
    toggleWorkPanel: '작업 패널 전환',
    envInfo: {
      ariaLabel: '환경 정보',
      title: '환경 정보',
      refresh: '새로고침',
      collapse: '접기',
      loading: '불러오는 중…',
      noWorkspace: '워크스페이스가 선택되지 않았습니다. 상단에서 로컬 워크스페이스를 먼저 바인딩하세요.',
      errorTitle: '환경 정보를 불러오지 못했습니다',
      notRepo: '현재 디렉터리는 Git 저장소가 아닙니다',
      detached: '분리된 HEAD',
      changes: '변경',
      noChanges: '변경 없음',
      local: '로컬',
      remote: '원격',
      remoteYes: '구성됨',
      remoteNo: '구성되지 않음',
      aheadBehind: '앞/뒤',
      commitPush: '커밋 및 푸시',
      commitPlaceholder: '커밋 메시지 입력…',
      commitOk: '커밋 성공',
      commitFail: '커밋 또는 푸시 실패',
      pullRequest: '풀 리퀘스트',
      prUnavailable: '풀 리퀘스트 상태를 가져올 수 없습니다',
      prNoRemote: '원격 저장소가 구성되지 않았습니다',
      compareBranch: '브랜치 비교',
    },
  },
}

let changed = 0
for (const [lang, words] of Object.entries(TRANSLATIONS)) {
  const file = join(DIR, `${lang}.json`)
  const raw = readFileSync(file, 'utf-8')
  const json = JSON.parse(raw)
  const aiChat = json.aiChat
  if (!aiChat || typeof aiChat !== 'object') {
    console.error(`[SKIP] ${lang}: no aiChat namespace`)
    continue
  }
  // 幂等:envInfoButton / openTerminal / toggleWorkPanel 已存在则跳过
  let modified = false
  for (const key of ['envInfoButton', 'openTerminal', 'toggleWorkPanel']) {
    if (!(key in aiChat)) {
      aiChat[key] = words[key]
      modified = true
    }
  }
  // envInfo 子对象:浅合并,只补缺失 key
  if (!aiChat.envInfo || typeof aiChat.envInfo !== 'object') {
    aiChat.envInfo = { ...words.envInfo }
    modified = true
  } else {
    for (const [k, v] of Object.entries(words.envInfo)) {
      if (!(k in aiChat.envInfo)) {
        aiChat.envInfo[k] = v
        modified = true
      }
    }
  }
  if (!modified) {
    console.log(`[SKIP] ${lang}: all keys exist`)
    continue
  }
  // 保持 2 空格缩进 + 原文件尾随换行
  const trailingNL = raw.endsWith('\n') ? '\n' : ''
  writeFileSync(file, `${JSON.stringify(json, null, 2)}${trailingNL}`, 'utf-8')
  changed++
  console.log(`[OK]   ${lang}: injected env-info keys`)
}

console.log(changed > 0 ? `\nDone: ${changed} file(s) updated` : '\nNothing to do')
