#!/usr/bin/env node
/**
 * 补齐 pre-commit hook 检测到的 30 个缺失 i18n 键。
 * zh-CN 用中文,en 用英文,ja/ko/zh-TW 用英文 fallback(不阻塞,仅 WARNING)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MESSAGES_DIR = join(process.cwd(), 'apps/web/messages')

function readJSON(filePath) {
  let text = readFileSync(filePath, 'utf8')
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  return JSON.parse(text)
}

function setNested(obj, dotPath, value) {
  const keys = dotPath.split('.')
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in cur) || typeof cur[keys[i]] !== 'object') {
      cur[keys[i]] = {}
    }
    cur = cur[keys[i]]
  }
  cur[keys[keys.length - 1]] = value
}

const MISSING_KEYS = {
  'admin.eduCertTemplate.validityCustomDays': { 'zh-CN': '自定义天数', en: 'Custom Days' },
  'admin.eduCertTemplate.validityDateRange': { 'zh-CN': '有效期范围', en: 'Validity Date Range' },
  'admin.eduCertTemplate.fieldValidDays': { 'zh-CN': '有效天数', en: 'Valid Days' },
  'admin.eduCertTemplate.fieldValidFrom': { 'zh-CN': '生效日期', en: 'Valid From' },
  'admin.eduCertTemplate.fieldValidTo': { 'zh-CN': '失效日期', en: 'Valid To' },
  'admin.edu.exam.index.fieldEnabled': { 'zh-CN': '启用', en: 'Enabled' },
  'admin.edu.learn.topics.fieldShowIndex': { 'zh-CN': '首页展示', en: 'Show on Index' },
  'admin.edu.learn.topics.colShowIndex': { 'zh-CN': '首页展示', en: 'Show on Index' },
  'admin.edu.learn.topics.showIndexYes': { 'zh-CN': '是', en: 'Yes' },
  'admin.edu.learn.topics.showIndexNo': { 'zh-CN': '否', en: 'No' },
  'admin.users.createUser': { 'zh-CN': '新建用户', en: 'Create User' },
  'admin.users.uploadAvatar': { 'zh-CN': '上传头像', en: 'Upload Avatar' },
  'admin.users.uploadAvatarHint': { 'zh-CN': '支持 JPG/PNG,最大 2MB', en: 'JPG/PNG, max 2MB' },
  'admin.users.dept': { 'zh-CN': '部门', en: 'Department' },
  'admin.users.noDept': { 'zh-CN': '未分配部门', en: 'No Department' },
  'admin.users.ban': { 'zh-CN': '禁用', en: 'Ban' },
  'admin.users.unban': { 'zh-CN': '启用', en: 'Unban' },
  'admin.users.confirmBan': { 'zh-CN': '确定要禁用该用户吗？', en: 'Ban this user?' },
  'admin.users.confirmUnban': { 'zh-CN': '确定要启用该用户吗？', en: 'Unban this user?' },
  'admin.users.delete': { 'zh-CN': '删除', en: 'Delete' },
  'admin.users.confirmDeletePrefix': { 'zh-CN': '确定要删除用户 "', en: 'Delete user "' },
  'admin.users.confirmDeleteSuffix': { 'zh-CN': '" 吗？', en: '"?' },
  'admin.users.resetPassword': { 'zh-CN': '重置密码', en: 'Reset Password' },
  'feedback.field_images': { 'zh-CN': '截图', en: 'Images' },
  'feedback.imagesPlaceholder': { 'zh-CN': '粘贴或拖拽图片到此处', en: 'Paste or drag images here' },
  'chat.hideReasoning': { 'zh-CN': '隐藏推理过程', en: 'Hide Reasoning' },
  'chat.showReasoning': { 'zh-CN': '显示推理过程', en: 'Show Reasoning' },
}

const LANGS = ['en', 'zh-CN', 'ja', 'ko', 'zh-TW']

for (const lang of LANGS) {
  const filePath = join(MESSAGES_DIR, `${lang}.json`)
  const messages = readJSON(filePath)
  let added = 0

  for (const [dotPath, translations] of Object.entries(MISSING_KEYS)) {
    const value = translations[lang] ?? translations.en
    setNested(messages, dotPath, value)
    added++
  }

  writeFileSync(filePath, JSON.stringify(messages, null, 2) + '\n', 'utf8')
  console.log(`${lang}: added ${added} keys`)
}

console.log('\nDone: 27 keys added to 5 language files')
