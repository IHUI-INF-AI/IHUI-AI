#!/usr/bin/env node
/**
 * add-workspace-agent-i18n.mjs — 批量为 5 个 locales 补齐 floatingChat.workspaceAgent.* 命名空间
 *
 * 背景: Stage A 集成 SlashCommandPalette + TaskListPanel 到 AIChat.vue,
 *   2 个组件均使用 t('floatingChat.workspaceAgent.{slashPalette|taskList}.*') 取翻译,
 *   必须在 5 个语言文件中完整, 否则键名裸露.
 *
 * 涵盖:
 *   - slashPalette: searchPlaceholder / noResults / navigate / select / cancel + category.*
 *   - taskList: title / empty / priority.{high|medium|low}
 *
 * 退出码: 0=全部成功, 1=至少一个文件未更新.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const COMMON_SLASH_PALETTE = {
  searchPlaceholder: ['搜索斜杠命令...', 'Search slash commands...', '搜尋斜線指令...', 'スラッシュコマンドを検索...', '슬래시 명령어 검색...'],
  noResults: ['未找到匹配的命令', 'No matching commands', '未找到符合的指令', '一致するコマンドがありません', '일치하는 명령이 없습니다'],
  navigate: ['浏览', 'Navigate', '瀏覽', 'ナビゲート', '탐색'],
  select: ['选择', 'Select', '選擇', '選択', '선택'],
  cancel: ['取消', 'Cancel', '取消', 'キャンセル', '취소'],
  category: {
    session: ['会话', 'Session', '會話', 'セッション', '세션'],
    workflow: ['工作流', 'Workflow', '工作流', 'ワークフロー', '워크플로'],
    context: ['上下文', 'Context', '上下文', 'コンテキスト', '컨텍스트'],
    help: ['帮助', 'Help', '說明', 'ヘルプ', '도움말'],
  },
}

const COMMON_TASK_LIST = {
  title: ['任务清单', 'Task List', '任務清單', 'タスク一覧', '작업 목록'],
  empty: ['暂无任务', 'No tasks', '暫無任務', 'タスクなし', '작업 없음'],
  priority: {
    high: ['高', 'High', '高', '高', '높음'],
    medium: ['中', 'Medium', '中', '中', '중간'],
    low: ['低', 'Low', '低', '低', '낮음'],
  },
}

const LOCALES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko']

let allSuccess = true

for (let i = 0; i < LOCALES.length; i++) {
  const lang = LOCALES[i]
  const filePath = join(ROOT, `client/src/locales/modules/${lang}/floatingChat.json`)
  let data
  try {
    const raw = readFileSync(filePath, 'utf-8')
    data = JSON.parse(raw)
  } catch (e) {
    console.error(`[FAIL] ${filePath}: 读取或解析失败: ${e.message}`)
    allSuccess = false
    continue
  }

  // 确保 floatingChat.workspaceAgent 存在
  if (!data.floatingChat || typeof data.floatingChat !== 'object') {
    console.error(`[FAIL] ${filePath}: 缺少 floatingChat 根对象`)
    allSuccess = false
    continue
  }
  if (!data.floatingChat.workspaceAgent || typeof data.floatingChat.workspaceAgent !== 'object') {
    data.floatingChat.workspaceAgent = {}
  }
  const ws = data.floatingChat.workspaceAgent

  // slashPalette
  ws.slashPalette = ws.slashPalette || {}
  ws.slashPalette.searchPlaceholder = COMMON_SLASH_PALETTE.searchPlaceholder[i]
  ws.slashPalette.noResults = COMMON_SLASH_PALETTE.noResults[i]
  ws.slashPalette.navigate = COMMON_SLASH_PALETTE.navigate[i]
  ws.slashPalette.select = COMMON_SLASH_PALETTE.select[i]
  ws.slashPalette.cancel = COMMON_SLASH_PALETTE.cancel[i]
  ws.slashPalette.category = ws.slashPalette.category || {}
  for (const cat of ['session', 'workflow', 'context', 'help']) {
    ws.slashPalette.category[cat] = COMMON_SLASH_PALETTE.category[cat][i]
  }

  // taskList
  ws.taskList = ws.taskList || {}
  ws.taskList.title = COMMON_TASK_LIST.title[i]
  ws.taskList.empty = COMMON_TASK_LIST.empty[i]
  ws.taskList.priority = ws.taskList.priority || {}
  for (const p of ['high', 'medium', 'low']) {
    ws.taskList.priority[p] = COMMON_TASK_LIST.priority[p][i]
  }

  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    console.log(`[OK] ${filePath}: workspaceAgent.{slashPalette|taskList} 注入成功`)
  } catch (e) {
    console.error(`[FAIL] ${filePath}: 写入失败: ${e.message}`)
    allSuccess = false
  }
}

process.exit(allSuccess ? 0 : 1)
