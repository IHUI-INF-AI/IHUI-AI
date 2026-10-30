// Wave3 细包切分:P10 实测 ~30 轮/条 ⇒ 每包 3 条(留余量给自验),按域亲和归组。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const triage = JSON.parse(fs.readFileSync(path.join(ROOT, '.ihui-agent/tmp/wave3-triage.json'), 'utf8'))
const done = new Set(['circles/post', 'invitations', 'letters', 'news/category/[id]', 'search/history'])

const PACKS = {
  q1: ['knowledge', 'knowledge-base/[id]', 'knowledge-base/search'],
  q2: ['knowledge-cards', 'knowledge-graph', 'memory-manager'],
  q3: ['memory/[id]', 'self-media/automation', 'self-media/koubo'],
  q4: ['self-media/wechat', 'publish/monitor', 'media-tasks'],
  q5: ['workspace/[id]', 'voices', 'skills-market'],
  q6: ['skills-market/[id]', 'skills/market', 'plugins'],
  q7: ['registry', 'rules', 'mcp-projects'],
  q8: ['ai-generation', 'ai-generation/video-tasks', 'drama'],
  q9: ['agents/edit/[id]', 'agents/my', 'subagents/detail'],
  q10: ['subagents/dispatch', 'agent-plan', 'agent-plan/progress'],
  q11: ['edu/schedule', 'edu/edu-management/homework', 'edu/edu-management/grades/trend/[studentId]'],
  q12: ['edu/edu-management/study-plan', 'edu-points', 'schedule'],
  q13: ['distribution/orders', 'distribution/token', 'distribution/withdraw/records'],
  q14: ['wallet/withdraw/records', 'fund-data', 'stock'],
  q15: ['traders', 'member/dashboard', 'member/exam/sign-up'],
  q16: ['member/settings', 'user/comment', 'user/resource'],
  q17: ['user/sign-up', 'comments', 'chat/favorites'],
  q18: ['chat/settings', 'business-card/favorites', 'certificate/download'],
  q19: ['learn/topic', 'learn/buyconfirm', 'web-tools'],
  q20: ['cloud-agent', 'cloud-run', 'oauth/my-authorized'],
  q21: ['lecturers', 'lecturers/[id]', 'settings/agent-security'],
  q22: ['settings/model-record'],
}

const byWeb = new Map(triage.map((r) => [r.web, r]))
const all = Object.values(PACKS).flat()
const dup = all.filter((r, i) => all.indexOf(r) !== i)
const miss = triage.map((r) => r.web).filter((w) => !done.has(w) && !all.includes(w))
const ghost = all.filter((w) => !byWeb.has(w))
console.log('细包', Object.keys(PACKS).length, '条数', all.length, '重复', dup.join(',') || '无', '漏', miss.join(',') || '无', '不存在', ghost.join(',') || '无')

for (const [id, routes] of Object.entries(PACKS)) {
  const lines = [`# Wave3 ${id.toUpperCase()} — ${routes.length} 条路由`, '']
  for (const w of routes) {
    const r = byWeb.get(w)
    if (!r) {
      lines.push(`## ${w}\n  ⚠️ 分诊缺失\n`)
      continue
    }
    lines.push(`## ${w}`)
    lines.push(`  web 目录: ${r.dir}`)
    lines.push(`  页面族: ${r.files} 文件 / ${r.lines} 字节`)
    lines.push(`  端点: ${r.apis.length ? r.apis.join(', ') : '（页面未直出 /api 字面量，必须读源码确认数据来源）'}`)
    lines.push(`  候选共享屏目录: ${r.featureHits.length ? r.featureHits.join(', ') : '无同名'}`)
    lines.push(`  候选端点封装: ${r.endpointHits.length ? r.endpointHits.join(', ') : '无'}`)
    lines.push(`  候选 RN 屏: ${r.rnHits.length ? r.rnHits.join(', ') : '无'}`)
    lines.push('')
  }
  fs.writeFileSync(path.join(ROOT, `.ihui-agent/wave3/${id}.brief.md`), lines.join('\n'))
}
console.log('已写细包简报')
