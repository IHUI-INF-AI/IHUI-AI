// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'

const g = (...a) => {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', ...a], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
    })
  } catch (e) {
    if (e.status === 1) return (e.stdout || '').toString()
    return '<<ERR ' + (e.stderr || '').toString().slice(0, 120)
  }
}
const n = (pat, ...ps) => g('grep', '-l', '-I', '-F', pat, 'HEAD', '--', ...ps).split('\n').filter(Boolean).length

console.log('HEAD =', g('rev-parse', '--short', 'HEAD').trim())
console.log('\n=== A 类(判"未开工")的反向自检:实现物是否真不在 HEAD ===')
console.log('D35 turn_ordinal 文件数          :', n('turn_ordinal', 'apps', 'packages', 'sdks'))
console.log('D35 history-projection.ts 在树    :', g('ls-tree', '-r', '--name-only', 'HEAD').includes('history-projection.ts') ? 'YES' : 'no')
console.log('D43 voice-note.ts 在树            :', g('ls-tree', '-r', '--name-only', 'HEAD').includes('voice-note.ts') ? 'YES' : 'no')
console.log('D36 prompt-drafts.ts 在树         :', g('ls-tree', '-r', '--name-only', 'HEAD').includes('prompt-drafts.ts') ? 'YES' : 'no')
console.log('D50 remote_control 命中(全仓)     :', n('remote_control_enrollments', 'apps', 'packages', 'sdks', 'scripts'))
console.log('D50 thread-tab-routes 命中        :', n('thread-tab-routes', 'apps', 'packages', 'sdks', 'scripts'))
console.log('D86 HookStats 里 blocked 字段     :', n('blocked', 'packages/database/src'))
console.log('WP1 builtins.ts 现值              :', g('show', 'HEAD:apps/cli/src/tools/builtins.ts').split('\n').filter((l) => l.includes('IHUI_YOLO') || l.includes('isAutoApprovableCommand')).slice(0, 3).join(' ⏎ '))
console.log('D68 message-input 三浮层并存      :', g('show', 'HEAD:apps/web/src/components/chat/message-input.tsx').split('\n').filter((l) => /FileMentionPopover|ContextSelectorPopover|SlashCommandPalette/.test(l)).slice(0, 4).join(' ⏎ '))
console.log('D17 专家包 字面量命中             :', n('专家包', 'apps', 'packages'))

console.log('\n=== C 类(判"该翻勾")的接线点自检 ===')
console.log('D15 github-app 路由注册           :', g('grep', '-n', '-I', '-F', 'github-app', 'HEAD', '--', 'apps/api/src/routes/index.ts').split('\n').slice(0, 2).join(' ⏎ '))
console.log('O10 agent-runs 路由注册           :', g('grep', '-n', '-I', '-F', 'agent-runs', 'HEAD', '--', 'apps/api/src/routes/index.ts').split('\n').slice(0, 2).join(' ⏎ '))
console.log('D55 step-decision 消费点          :', n('step-decision', 'apps/web/src', 'apps/miniapp-taro/src', 'apps/mobile-rn/src', 'apps/extension'))
console.log('D39 buildRetryCountdownView 消费  :', n('buildRetryCountdownView', 'apps/web/src', 'packages/shared/src'))
console.log('D90 FileUpdatedBar 消费           :', n('FileUpdatedBar', 'apps', 'packages'))
console.log('D106 onSteer 各端命中             :', ['extension', 'miniapp-taro', 'mobile-rn', 'cli'].map((e) => `${e}=${n('onSteer', 'apps/' + e + '/src')}`).join(' '))

console.log('\n=== "造好没装车"族:零 import 复核(命中文件数,1=只有自身) ===')
for (const tok of ['QuotaOwnershipCard', 'ConnectorAuthCard', 'VoiceSubtitleBar', 'PaneSplitContainer', 'BusinessFormCard', 'tool-activity-line', 'InputNoticeBanner', 'activity-line']) {
  console.log(`${tok.padEnd(22)}: ${n(tok, 'apps', 'packages')}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
