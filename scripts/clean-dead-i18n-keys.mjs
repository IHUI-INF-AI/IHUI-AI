#!/usr/bin/env node
/**
 * 清理 i18n 死 key
 * 从 packages/i18n/messages/web/*.json 中删除 scan-dead-i18n-keys.mjs 识别的死 key
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const MESSAGES_DIR = join(process.cwd(), 'packages/i18n/messages/web')

// 死 key 列表（从 .trae-cn/tmp/i18n-dead-keys-2026-08-15.md 提取）
const DEAD_KEYS = [
  // admin.customerService.* (38)
  'admin.customerService.addAgent',
  'admin.customerService.colNickname',
  'admin.customerService.colStatus',
  'admin.customerService.colLoad',
  'admin.customerService.colSkills',
  'admin.customerService.colActions',
  'admin.customerService.loading',
  'admin.customerService.noAgents',
  'admin.customerService.switchStatus',
  'admin.customerService.addAgentTitle',
  'admin.customerService.addAgentDesc',
  'admin.customerService.fieldUserId',
  'admin.customerService.userIdPlaceholder',
  'admin.customerService.fieldAgentNickname',
  'admin.customerService.fieldMaxConcurrent',
  'admin.customerService.cancel',
  'admin.customerService.create',
  'admin.customerService.addCategory',
  'admin.customerService.colName',
  'admin.customerService.colSlug',
  'admin.customerService.colDescription',
  'admin.customerService.colSort',
  'admin.customerService.noCategories',
  'admin.customerService.addCategoryTitle',
  'admin.customerService.addCategoryDesc',
  'admin.customerService.fieldCatName',
  'admin.customerService.fieldSlug',
  'admin.customerService.slugPlaceholder',
  'admin.customerService.fieldDescription',
  'admin.customerService.fieldSort',
  'admin.customerService.statusPlaceholder',
  'admin.customerService.allStatus',
  'admin.customerService.priorityPlaceholder',
  'admin.customerService.allPriority',
  'admin.customerService.colTicketNo',
  'admin.customerService.colTitle',
  'admin.customerService.colPriority',
  'admin.customerService.colCreatedAt',
  'admin.customerService.noTickets',
  'admin.customerService.handle',
  // admin.loginLogs.* (35)
  'admin.loginLogs.delete',
  'admin.loginLogs.edit',
  'admin.loginLogs.loading',
  'admin.loginLogs.empty',
  'admin.loginLogs.colId',
  'admin.loginLogs.colUserUuid',
  'admin.loginLogs.colLoginType',
  'admin.loginLogs.colPlatform',
  'admin.loginLogs.colIp',
  'admin.loginLogs.colLocation',
  'admin.loginLogs.colUa',
  'admin.loginLogs.colLoginTime',
  'admin.loginLogs.colMessage',
  'admin.loginLogs.colActions',
  'admin.loginLogs.dialogEditTitle',
  'admin.loginLogs.dialogCreateTitle',
  'admin.loginLogs.descEdit',
  'admin.loginLogs.descCreate',
  'admin.loginLogs.fieldUserUuid',
  'admin.loginLogs.fieldLoginType',
  'admin.loginLogs.fieldPlatform',
  'admin.loginLogs.fieldLocation',
  'admin.loginLogs.fieldLoginTime',
  'admin.loginLogs.fieldMessage',
  'admin.loginLogs.cancel',
  'admin.loginLogs.save',
  'admin.loginLogs.labelUserUuid',
  'admin.loginLogs.placeholderUserUuid',
  'admin.loginLogs.labelPlatform',
  'admin.loginLogs.placeholderPlatform',
  'admin.loginLogs.labelLocation',
  'admin.loginLogs.placeholderLocation',
  'admin.loginLogs.labelLoginTime',
  'admin.loginLogs.search',
  'admin.loginLogs.reset',
  // admin.* (2)
  'admin.visitTracking',
  'admin.behaviorAnalytics',
  // adminTicketDetail.* (15)
  'adminTicketDetail.status',
  'adminTicketDetail.priority',
  'adminTicketDetail.issueDescription',
  'adminTicketDetail.statusTransition',
  'adminTicketDetail.noTransitions',
  'adminTicketDetail.assignAgent',
  'adminTicketDetail.selectAgent',
  'adminTicketDetail.assign',
  'adminTicketDetail.replyRecords',
  'adminTicketDetail.noReply',
  'adminTicketDetail.roleAgent',
  'adminTicketDetail.roleUser',
  'adminTicketDetail.customerReply',
  'adminTicketDetail.replyPlaceholder',
  'adminTicketDetail.sendReply',
  // design.* (6)
  'design.responsive.deviceMobilePortrait',
  'design.responsive.deviceMobileLandscape',
  'design.responsive.deviceTabletPortrait',
  'design.responsive.deviceTabletLandscape',
  'design.responsive.deviceDesktop',
  'design.responsive.deviceCustom',
  // edu.* (39)
  'edu.eduAttendancePage.title',
  'edu.eduAttendancePage.subtitle',
  'edu.eduAttendancePage.checkIn',
  'edu.eduAttendancePage.checkOut',
  'edu.eduAttendancePage.leave',
  'edu.eduAttendancePage.stats',
  'edu.eduGradePage.title',
  'edu.eduGradePage.subtitle',
  'edu.eduGradePage.input',
  'edu.eduGradePage.stats',
  'edu.eduGradePage.rank',
  'edu.eduGradePage.trend',
  'edu.eduHomeworkPage.title',
  'edu.eduHomeworkPage.subtitle',
  'edu.eduHomeworkPage.submit',
  'edu.eduHomeworkPage.grade',
  'edu.eduHomeworkPage.stats',
  'edu.eduEnrollmentPage.title',
  'edu.eduEnrollmentPage.subtitle',
  'edu.eduEnrollmentPage.lead',
  'edu.eduEnrollmentPage.trial',
  'edu.eduEnrollmentPage.enroll',
  'edu.eduFinancePage.title',
  'edu.eduFinancePage.subtitle',
  'edu.eduFinancePage.fee',
  'edu.eduFinancePage.payment',
  'edu.eduFinancePage.refund',
  'edu.eduEmpty.noSchedule',
  'edu.eduEmpty.noMeal',
  'edu.eduEmpty.noPlan',
  'edu.eduEmpty.noAttendance',
  'edu.eduEmpty.noGrade',
  'edu.eduEmpty.noLead',
  'edu.eduEmpty.noTrial',
  'edu.eduEmpty.noEnrollment',
  'edu.eduEmpty.noHomework',
  'edu.eduEmpty.noRule',
  'edu.eduEmpty.noPayment',
  'edu.eduEmpty.noRefund',
]

/**
 * 从对象中删除嵌套 key
 * @param {object} obj - 要删除 key 的对象
 * @param {string} keyPath - 点分隔的 key 路径，如 "a.b.c"
 */
function deleteNestedKey(obj, keyPath) {
  const keys = keyPath.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null || Array.isArray(current[key])) {
      return false // 路径不存在
    }
    current = current[key]
  }
  const lastKey = keys[keys.length - 1]
  if (lastKey in current) {
    delete current[lastKey]
    return true
  }
  return false
}

/**
 * 清理对象中的空父节点
 * @param {object} obj - 要清理的对象
 * @param {string} keyPath - 当前路径
 */
function cleanEmptyParents(obj, keyPath) {
  const keys = keyPath.split('.')
  for (let i = keys.length - 1; i > 0; i--) {
    const parentPath = keys.slice(0, i).join('.')
    const parentKeys = parentPath.split('.')
    let parent = obj
    for (let j = 0; j < parentKeys.length - 1; j++) {
      parent = parent[parentKeys[j]]
    }
    const key = parentKeys[parentKeys.length - 1]
    if (parent[key] && typeof parent[key] === 'object' && Object.keys(parent[key]).length === 0) {
      delete parent[key]
    }
  }
}

let totalDeleted = 0

for (const locale of LOCALES) {
  const filePath = join(MESSAGES_DIR, `${locale}.json`)
  const content = readFileSync(filePath, 'utf-8')
  const data = JSON.parse(content)
  
  let deletedInFile = 0
  for (const keyPath of DEAD_KEYS) {
    if (deleteNestedKey(data, keyPath)) {
      deletedInFile++
    }
  }
  
  // 清理空父节点
  for (const keyPath of DEAD_KEYS) {
    cleanEmptyParents(data, keyPath)
  }
  
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  console.log(`[${locale}] 删除 ${deletedInFile} 个死 key`)
  totalDeleted += deletedInFile
}

console.log(`\n总计删除 ${totalDeleted} 个死 key (${DEAD_KEYS.length} 个 key × ${LOCALES.length} 个语言文件)`)
