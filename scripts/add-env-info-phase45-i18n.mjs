#!/usr/bin/env node
/**
 * 幂等注入 envInfo 弹窗重构新增 key(2026-08-17 Phase4/5)。
 * 仅补缺失,不覆盖已有。涉及:commitOnly/submitAndPush/commitPushRemoteHint/
 * fullTitle/viewFull/workspace/remotes/noRemotes/branchDetails/currentBranch/
 * lastCommitTitle/added/deleted/total/modified/untracked/renamed/conflicted
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'packages/i18n/messages/web')
const WORDS = {
  'zh-CN': {
    commitOnly: '仅提交',
    submitAndPush: '提交并推送',
    commitPushRemoteHint: '将推送到远程仓库的当前分支',
    fullTitle: '环境信息详情',
    viewFull: '查看完整信息',
    workspace: '工作区',
    remotes: '远程仓库',
    noRemotes: '未配置远程仓库',
    branchDetails: '分支',
    currentBranch: '当前分支',
    lastCommitTitle: '最近提交',
    added: '新增',
    deleted: '删除',
    total: '总计',
    modified: '修改',
    untracked: '未跟踪',
    renamed: '重命名',
    conflicted: '冲突',
  },
  'zh-TW': {
    commitOnly: '僅提交',
    submitAndPush: '提交並推送',
    commitPushRemoteHint: '將推送到遠端儲存庫的目前分支',
    fullTitle: '環境資訊詳情',
    viewFull: '查看完整資訊',
    workspace: '工作區',
    remotes: '遠端儲存庫',
    noRemotes: '未設定遠端儲存庫',
    branchDetails: '分支',
    currentBranch: '目前分支',
    lastCommitTitle: '最近提交',
    added: '新增',
    deleted: '刪除',
    total: '總計',
    modified: '修改',
    untracked: '未追蹤',
    renamed: '重新命名',
    conflicted: '衝突',
  },
  en: {
    commitOnly: 'Commit only',
    submitAndPush: 'Commit & Push',
    commitPushRemoteHint: 'Will push to the current branch of the remote repository',
    fullTitle: 'Environment Details',
    viewFull: 'View full details',
    workspace: 'Workspace',
    remotes: 'Remotes',
    noRemotes: 'No remotes configured',
    branchDetails: 'Branch',
    currentBranch: 'Current branch',
    lastCommitTitle: 'Last commit',
    added: 'Added',
    deleted: 'Deleted',
    total: 'Total',
    modified: 'Modified',
    untracked: 'Untracked',
    renamed: 'Renamed',
    conflicted: 'Conflicted',
  },
  ja: {
    commitOnly: 'コミットのみ',
    submitAndPush: 'コミットとプッシュ',
    commitPushRemoteHint: 'リモートの現在のブランチにプッシュします',
    fullTitle: '環境情報詳細',
    viewFull: '詳細を表示',
    workspace: 'ワークスペース',
    remotes: 'リモート',
    noRemotes: 'リモートが設定されていません',
    branchDetails: 'ブランチ',
    currentBranch: '現在のブランチ',
    lastCommitTitle: '最新コミット',
    added: '追加',
    deleted: '削除',
    total: '合計',
    modified: '変更',
    untracked: '未追跡',
    renamed: '名前変更',
    conflicted: '競合',
  },
  ko: {
    commitOnly: '커밋만',
    submitAndPush: '커밋 및 푸시',
    commitPushRemoteHint: '원격 저장소의 현재 브랜치에 푸시합니다',
    fullTitle: '환경 정보 상세',
    viewFull: '전체 정보 보기',
    workspace: '워크스페이스',
    remotes: '원격 저장소',
    noRemotes: '원격 저장소가 구성되지 않았습니다',
    branchDetails: '브랜치',
    currentBranch: '현재 브랜치',
    lastCommitTitle: '최근 커밋',
    added: '추가',
    deleted: '삭제',
    total: '합계',
    modified: '수정',
    untracked: '추적 안 됨',
    renamed: '이름 변경',
    conflicted: '충돌',
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
