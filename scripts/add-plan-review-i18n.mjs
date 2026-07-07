#!/usr/bin/env node
/**
 * add-plan-review-i18n.mjs — 批量为 5 个 locales 添加 floatingChat.workspaceAgent.planReview 命名空间
 *
 * 背景: Stage B Plan Mode 两阶段分离, PlanReviewPanel.vue 通过
 *   t('floatingChat.workspaceAgent.planReview.xxx') 取 8 个 key (untitled/badge/stepsTitle/...),
 *   必须在 5 个语言文件 (zh-CN/en/zh-TW/ja/ko) 中完整存在, 否则键名裸露.
 *
 * 入口: floatingChat 对象下追加 workspaceAgent 对象 (含 planReview 子对象), 严格保持 JSON 语法正确.
 *
 * 退出码: 0=全部成功, 1=至少一个文件未更新.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const LOCALES = [
  {
    file: 'client/src/locales/modules/zh-CN/floatingChat.json',
    planReview: {
      untitled: '未命名计划',
      badge: '待确认',
      stepsTitle: '执行步骤',
      filesLabel: '涉及文件',
      risksTitle: '风险提示',
      accept: '接受计划',
      reject: '拒绝',
    },
  },
  {
    file: 'client/src/locales/modules/en/floatingChat.json',
    planReview: {
      untitled: 'Untitled Plan',
      badge: 'Pending',
      stepsTitle: 'Execution Steps',
      filesLabel: 'Files',
      risksTitle: 'Risks',
      accept: 'Accept Plan',
      reject: 'Reject',
    },
  },
  {
    file: 'client/src/locales/modules/zh-TW/floatingChat.json',
    planReview: {
      untitled: '未命名計劃',
      badge: '待確認',
      stepsTitle: '執行步驟',
      filesLabel: '涉及檔案',
      risksTitle: '風險提示',
      accept: '接受計劃',
      reject: '拒絕',
    },
  },
  {
    file: 'client/src/locales/modules/ja/floatingChat.json',
    planReview: {
      untitled: '無題の計画',
      badge: '確認待ち',
      stepsTitle: '実行ステップ',
      filesLabel: 'ファイル',
      risksTitle: 'リスク',
      accept: '計画を承認',
      reject: '拒否',
    },
  },
  {
    file: 'client/src/locales/modules/ko/floatingChat.json',
    planReview: {
      untitled: '제목 없는 계획',
      badge: '확인 대기 중',
      stepsTitle: '실행 단계',
      filesLabel: '파일',
      risksTitle: '위험',
      accept: '계획 수락',
      reject: '거절',
    },
  },
]

let allSuccess = true

for (const { file, planReview } of LOCALES) {
  const filePath = join(ROOT, file)
  let data
  try {
    const raw = readFileSync(filePath, 'utf-8')
    data = JSON.parse(raw)
  } catch (e) {
    console.error(`[FAIL] ${file}: 读取或解析失败: ${e.message}`)
    allSuccess = false
    continue
  }

  // 确保 floatingChat.workspaceAgent 存在
  if (!data.floatingChat || typeof data.floatingChat !== 'object') {
    console.error(`[FAIL] ${file}: 缺少 floatingChat 根对象`)
    allSuccess = false
    continue
  }
  if (!data.floatingChat.workspaceAgent || typeof data.floatingChat.workspaceAgent !== 'object') {
    data.floatingChat.workspaceAgent = {}
  }
  // 合并 planReview (覆盖以保证最新值)
  data.floatingChat.workspaceAgent.planReview = {
    ...data.floatingChat.workspaceAgent.planReview,
    ...planReview,
  }

  try {
    // 2 空格缩进 + 末尾换行
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    console.log(`[OK] ${file}: workspaceAgent.planReview 注入成功 (${Object.keys(planReview).length} keys)`)
  } catch (e) {
    console.error(`[FAIL] ${file}: 写入失败: ${e.message}`)
    allSuccess = false
  }
}

process.exit(allSuccess ? 0 : 1)
