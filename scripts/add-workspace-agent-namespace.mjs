#!/usr/bin/env node
/**
 * add-workspace-agent-namespace.mjs — 一次性脚本:为 5 个 locales 文件补齐
 * floatingChat.workspaceAgent 命名空间 (Stage A + B 集成必需)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const LANGS = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko']

// 每语言的完整命名空间
const NS_BY_LANG = {
  'zh-CN': {
    planReview: {
      untitled: '未命名计划',
      badge: '待确认',
      stepsTitle: '执行步骤',
      filesLabel: '涉及文件',
      risksTitle: '风险点',
      accept: '接受计划',
      reject: '拒绝计划',
    },
    slashPalette: {
      searchPlaceholder: '搜索 slash 命令...',
      noResults: '没有匹配的命令',
      navigate: '导航',
      select: '选择',
      cancel: '取消',
      category: {
        session: '会话',
        workflow: '工作流',
        context: '上下文',
        help: '帮助',
        mode: '模式',
        info: '信息',
        setup: '初始化',
      },
    },
    taskList: {
      title: '任务列表',
      empty: '暂无任务',
      priority: {
        high: '高',
        medium: '中',
        low: '低',
      },
    },
  },
  en: {
    planReview: {
      untitled: 'Untitled Plan',
      badge: 'Pending',
      stepsTitle: 'Execution Steps',
      filesLabel: 'Files',
      risksTitle: 'Risks',
      accept: 'Accept Plan',
      reject: 'Reject',
    },
    slashPalette: {
      searchPlaceholder: 'Search slash commands...',
      noResults: 'No matching commands',
      navigate: 'Navigate',
      select: 'Select',
      cancel: 'Cancel',
      category: {
        session: 'Session',
        workflow: 'Workflow',
        context: 'Context',
        help: 'Help',
        mode: 'Mode',
        info: 'Info',
        setup: 'Setup',
      },
    },
    taskList: {
      title: 'Task List',
      empty: 'No tasks',
      priority: {
        high: 'High',
        medium: 'Medium',
        low: 'Low',
      },
    },
  },
  'zh-TW': {
    planReview: {
      untitled: '未命名計畫',
      badge: '待確認',
      stepsTitle: '執行步驟',
      filesLabel: '涉及檔案',
      risksTitle: '風險點',
      accept: '接受計畫',
      reject: '拒絕計畫',
    },
    slashPalette: {
      searchPlaceholder: '搜尋 slash 指令...',
      noResults: '沒有符合的指令',
      navigate: '導覽',
      select: '選擇',
      cancel: '取消',
      category: {
        session: '工作階段',
        workflow: '工作流程',
        context: '內容',
        help: '說明',
        mode: '模式',
        info: '資訊',
        setup: '設定',
      },
    },
    taskList: {
      title: '工作清單',
      empty: '無工作',
      priority: {
        high: '高',
        medium: '中',
        low: '低',
      },
    },
  },
  ja: {
    planReview: {
      untitled: '無題の計画',
      badge: '確認待ち',
      stepsTitle: '実行ステップ',
      filesLabel: '対象ファイル',
      risksTitle: 'リスク',
      accept: '計画を承認',
      reject: '計画を却下',
    },
    slashPalette: {
      searchPlaceholder: 'スラッシュコマンドを検索...',
      noResults: '一致するコマンドがありません',
      navigate: '移動',
      select: '選択',
      cancel: 'キャンセル',
      category: {
        session: 'セッション',
        workflow: 'ワークフロー',
        context: 'コンテキスト',
        help: 'ヘルプ',
        mode: 'モード',
        info: '情報',
        setup: '初期化',
      },
    },
    taskList: {
      title: 'タスクリスト',
      empty: 'タスクがありません',
      priority: {
        high: '高',
        medium: '中',
        low: '低',
      },
    },
  },
  ko: {
    planReview: {
      untitled: '제목 없는 계획',
      badge: '확인 대기 중',
      stepsTitle: '실행 단계',
      filesLabel: '관련 파일',
      risksTitle: '위험 요소',
      accept: '계획 수락',
      reject: '계획 거절',
    },
    slashPalette: {
      searchPlaceholder: '슬래시 명령 검색...',
      noResults: '일치하는 명령 없음',
      navigate: '탐색',
      select: '선택',
      cancel: '취소',
      category: {
        session: '세션',
        workflow: '워크플로',
        context: '컨텍스트',
        help: '도움말',
        mode: '모드',
        info: '정보',
        setup: '설정',
      },
    },
    taskList: {
      title: '작업 목록',
      empty: '작업 없음',
      priority: {
        high: '높음',
        medium: '보통',
        low: '낮음',
      },
    },
  },
}

let success = 0
let fail = 0

for (const lang of LANGS) {
  const file = join(ROOT, `client/src/locales/modules/${lang}/floatingChat.json`)
  let data
  try {
    const raw = readFileSync(file, 'utf-8')
    data = JSON.parse(raw)
  } catch (e) {
    console.error(`[FAIL] ${file}: 读取/解析失败: ${e.message}`)
    fail++
    continue
  }

  if (!data.floatingChat) data.floatingChat = {}
  if (!data.floatingChat.workspaceAgent) {
    data.floatingChat.workspaceAgent = NS_BY_LANG[lang]
    try {
      const newContent = JSON.stringify(data, null, 2) + '\n'
      writeFileSync(file, newContent, 'utf-8')
      console.log(`[OK] ${lang}: 已添加 workspaceAgent 命名空间`)
      success++
    } catch (e) {
      console.error(`[FAIL] ${file}: 写入失败: ${e.message}`)
      fail++
    }
  } else {
    console.log(`[SKIP] ${lang}: workspaceAgent 已存在`)
  }
}

console.log(`\n汇总: ${success} 成功, ${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)
