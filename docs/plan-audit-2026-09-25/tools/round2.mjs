// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'
const g = (...a) => {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true })
  } catch (e) {
    return e.status === 1 ? (e.stdout || '').toString() : ''
  }
}
const files = (t, ...ps) =>
  g('grep', '-l', '-I', '-F', t, 'HEAD', '--', ...ps)
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(l.indexOf(':') + 1).split(':')[0])

console.log('=== 第二轮取证(修正代理结论) ===')
console.log('D81 tool-activity-line 真实文件名:')
console.log(
  g('ls-tree', '-r', '--name-only', 'HEAD')
    .split('\n')
    .filter((p) => /activity|tense|双时态/.test(p))
    .slice(0, 10)
    .map((x) => '   ' + x)
    .join('\n') || '   (无)',
)
console.log('\nD86 hooks 表列(HEAD packages/database/src):')
console.log(
  g('grep', '-n', '-I', '-E', "pgTable\\('(hook|hooks)", 'HEAD', '--', 'packages/database/src')
    .split('\n')
    .filter(Boolean)
    .slice(0, 5)
    .join('\n') || '   零命中(表名不匹配该式)',
)
console.log('\nD16 model_router 的 route()/from_catalog 非测试调用点:')
console.log(
  g('grep', '-rn', '-I', '-E', 'route_live\\(|from_catalog\\(|\\.route\\(', 'HEAD', '--', 'apps/ai-service/app')
    .split('\n')
    .filter(Boolean)
    .slice(0, 8)
    .join('\n') || '   零命中',
)
console.log('\nD58 CATEGORY_TABLE 所在端:')
files('CATEGORY_TABLE', 'apps', 'packages').forEach((f) => console.log('   ' + f))

console.log('\n=== 碰撞图:脏工作区路径(他人 in-flight) ===')
const dirty = g('status', '--porcelain')
  .split('\n')
  .filter(Boolean)
  .map((l) => l.slice(3).replace(/"/g, ''))
console.log(`共 ${dirty.length} 条`)
const doms = {
  'D14 云端沙箱': /sandbox/,
  'D35 历史投影': /history-projection/,
  'D36 草稿': /prompt-drafts/,
  'D43 语音笔记': /voice-note/,
  'D62 字幕': /voice-subtitle/,
  'D73 多窗格': /pane-split/,
  'D78 连接器卡': /connector-auth/,
  'D58 工具类目': /tool-category/,
  'D91 批注锚点': /annotation-anchor/,
  'D39/D69 输入区': /message-input|stream-handlers|auto-topup/,
  'D86/D107 钩子': /hooks|sse_contract/,
  'D85/D55 决策条': /goal-card|queue-command-registry|edit-resend|move-to-worktree/,
  'D106/rn 交代': /ChatDisclosure|mobile-rn|permission-tier|approval-action/,
  'TTS/音频': /\.e2e_free_tts/,
}
for (const [k, re] of Object.entries(doms)) {
  const hits = dirty.filter((d) => re.test(d))
  if (hits.length) console.log(`  ${k.padEnd(16)} 在飞 ${hits.length} 文件: ${hits.slice(0, 3).join(', ')}${hits.length > 3 ? ' …' : ''}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
