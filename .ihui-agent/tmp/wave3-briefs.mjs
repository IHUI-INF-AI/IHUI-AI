// Wave3 派单证据生成:按 10 包输出每条路由的 web 目录 / 端点 / 候选复用。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const triage = JSON.parse(fs.readFileSync(path.join(ROOT, '.ihui-agent/tmp/wave3-triage.json'), 'utf8'))
const byWeb = new Map(triage.map((r) => [r.web, r]))

const PACKS = {
  p1: {
    name: '知识库与记忆',
    routes: ['knowledge', 'knowledge-base/[id]', 'knowledge-base/search', 'knowledge-cards', 'knowledge-graph', 'memory-manager', 'memory/[id]'],
  },
  p2: {
    name: '自媒体与发布',
    routes: ['self-media/automation', 'self-media/koubo', 'self-media/wechat', 'publish/monitor', 'workspace/[id]', 'media-tasks', 'voices'],
  },
  p3: {
    name: '技能与插件',
    routes: ['skills-market', 'skills-market/[id]', 'skills/market', 'plugins', 'registry', 'rules', 'mcp-projects'],
  },
  p4: {
    name: 'AI 生成与智能体',
    routes: ['ai-generation', 'ai-generation/video-tasks', 'agents/edit/[id]', 'agents/my', 'agent-plan', 'agent-plan/progress', 'subagents/detail', 'subagents/dispatch'],
  },
  p5: {
    name: '教育',
    routes: ['edu/schedule', 'edu/edu-management/homework', 'edu/edu-management/study-plan', 'edu/edu-management/grades/trend/[studentId]', 'edu-points', 'schedule'],
  },
  p6: {
    name: '变现与钱包',
    routes: ['distribution/orders', 'distribution/token', 'distribution/withdraw/records', 'wallet/withdraw/records', 'fund-data', 'stock', 'traders', 'member/dashboard', 'member/exam/sign-up', 'member/settings'],
  },
  p7: {
    name: '用户与社交',
    routes: ['user/comment', 'user/resource', 'user/sign-up', 'comments', 'chat/favorites', 'chat/settings'],
  },
  p8: {
    name: '设置与云',
    routes: ['cloud-agent', 'cloud-run', 'lecturers', 'lecturers/[id]', 'oauth/my-authorized', 'settings/agent-security', 'settings/model-record'],
  },
  p9: {
    name: '内容与工具',
    routes: ['learn/topic', 'learn/buyconfirm', 'certificate/download', 'drama', 'web-tools', 'business-card/favorites'],
  },
  p10: {
    name: '社区与检索',
    routes: ['circles/post', 'invitations', 'letters', 'news/category/[id]', 'search/history'],
  },
}

const outDir = path.join(ROOT, '.ihui-agent/wave3')
fs.mkdirSync(outDir, { recursive: true })
let covered = 0
for (const [id, pack] of Object.entries(PACKS)) {
  const lines = [`# Wave3 ${id.toUpperCase()} — ${pack.name}`, `路由 ${pack.routes.length} 条`, '']
  for (const w of pack.routes) {
    const r = byWeb.get(w)
    if (!r) {
      lines.push(`## ${w}\n  ⚠️ 分诊缺失`)
      continue
    }
    covered++
    lines.push(`## ${w}`)
    lines.push(`  web 目录: ${r.dir}`)
    lines.push(`  页面族: ${r.files} 文件 / ${r.lines} 字节`)
    lines.push(`  端点: ${r.apis.length ? r.apis.join(', ') : '（页面未直出 /api 字面量，需读代码确认）'}`)
    lines.push(`  候选共享屏目录: ${r.featureHits.length ? r.featureHits.join(', ') : '无同名'}`)
    lines.push(`  候选端点封装: ${r.endpointHits.length ? r.endpointHits.join(', ') : '无'}`)
    lines.push(`  候选 RN 屏: ${r.rnHits.length ? r.rnHits.join(', ') : '无'}`)
    lines.push('')
  }
  fs.writeFileSync(path.join(outDir, `${id}.brief.md`), lines.join('\n'))
}
console.log('生成', Object.keys(PACKS).length, '份派单;覆盖路由', covered, '/', triage.length)
const all = Object.values(PACKS).flatMap((p) => p.routes)
const dup = all.filter((r, i) => all.indexOf(r) !== i)
console.log('重复分配:', dup.length ? dup.join(',') : '无')
const miss = triage.map((r) => r.web).filter((w) => !all.includes(w))
console.log('漏分配:', miss.length ? miss.join(',') : '无')
