// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'

const PROBES = [
  ['D14 云端沙箱agent', ['container_runtime', 'sandbox_queue', 'cloud_sandbox']],
  ['D17 专家包/技能市场/连接器授权中心', ['expert-pack', 'connector-auth-center', 'skill-market']],
  ['D18 Agent SDK 对外开放', ['publish-ready']],
  ['D19 三端对话流parity', ['terminal_delta']],
  ['D20 会话文件夹/标签/置顶+PDF', ['pinnedConversation', 'conversationFolder', 'exportPdf', 'session-tag']],
  ['D29 团队级知识引擎', ['teamKnowledge', 'repoWiki', 'knowledge_card', 'wiki_share']],
  ['D30 无人值守修复闭环', ['issue-claim', 'automations']],
  ['D31 设计稿转码Figma', ['figma']],
  ['D35 长会话分页投影', ['history_projection_state', 'turn_ordinal', 'history-projection']],
  ['D36 输入草稿与历史', ['prompt-drafts', 'prompt-history']],
  ['D39 错误重试可观测+额度动作族', ['retry_scheduled', 'injection_applied']],
  ['D41 Office/PDF产物预览', ['artifact-preview', 'previewSourceToggle']],
  ['D43 会话内快捷笔记', ['voice-note']],
  ['D48 本地会话数据加密', ['ihuiVaultV1', 'local-vault', 'chat-persist-crypto']],
  ['D50 多端遥控配对+每会话Tab状态', ['remote_control_enrollments', 'thread-tab-routes']],
  ['D58 工具类目聚合层', ['toolCategory']],
  ['D62 语音字幕与讨论纪要', ['discussion-minutes', '静音并显示字幕']],
  ['D64 小元素包', ['imageCounterView', 'creditsHeatmap']],
  ['D67 额度归属分型与折扣倒计时', ['低峰折扣', 'quotaOwnership']],
  ['D68 统一多源建议面板', ['multi-source-suggest', 'UnifiedSuggestion']],
  ['D69 输入区文案族补齐', ['压缩会消耗少量积分']],
  ['D73 多任务窗格', ['paneSplit', '多任务窗格']],
  ['D77 对话流业务表单卡', ['business-form-card', 'form_request']],
  ['D78 连接器授权卡', ['connector-auth-card', 'connectorAuth']],
  ['D81 活动条目双时态语法', ['activityTense']],
  ['D83 MCP工具活动server×tool措辞层', ['mcpToolActivity']],
  ['D85 自动审查统计条', ['自动审查统计', 'autoReviewStats']],
  ['D90 预览降级三态', ['无法读取当前文件', '工具记录内容']],
  ['D91 四类文档批注锚点分型', ['annotationAnchor']],
  ['D107 交代帧端内注册层', ['D107']],
  ['O13 多租户隔离重建', ['tenant_rls']],
  ['O13b roleId收敛第二段', ['internalUserRoleId']],
  ['O14 SDK真正发布', ['release-sdk']],
  ['O20 公网拓扑ai-service暴露', ['e2e-agent-access']],
  ['WP-1 新API接入执行链', ['builtins.ts']],
]

const patFile = '.ihui-agent/tmp/plan-open-tasks/probes.txt'
import { writeFileSync, readFileSync } from 'node:fs'
const all = [...new Set(PROBES.flatMap((p) => p[1]))]
writeFileSync(patFile, all.join('\n') + '\n', 'utf8')

let out = ''
try {
  out = execFileSync(
    'git',
    ['-c', 'safe.directory=*', 'grep', '-I', '-o', '-i', '--no-color', '-f', patFile, 'HEAD', '--', 'apps', 'packages', 'sdks', 'scripts'],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024, windowsHide: true },
  )
} catch (e) {
  if (e.status !== 1) throw e
  out = (e.stdout || '').toString()
}

const count = new Map()
for (const line of out.split('\n')) {
  if (!line) continue
  const i = line.indexOf(':', line.indexOf(':') + 1)
  const tok = line.slice(i + 1).trim().toLowerCase()
  count.set(tok, (count.get(tok) || 0) + 1)
}

const rows = PROBES.map(([name, toks]) => {
  const hit = toks.filter((t) => count.has(t.toLowerCase()))
  return { name, hit, detail: hit.map((h) => `${h}×${count.get(h.toLowerCase())}`) }
})
rows.sort((a, b) => a.hit.length - b.hit.length)
for (const r of rows) console.log(`${r.hit.length ? '在库' : '零  '} ${r.name.padEnd(30)} ${r.detail.join(' ')}`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
