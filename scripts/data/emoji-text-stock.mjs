/**
 * 文本位存量台账(逐条落账,2026-11-05 扩面时现读 HEAD 面登记)。
 *
 * 立因:`check-no-emoji-icons.mjs` 的文本位维度有存量(新判据不升 blocking,§0.5 棘轮),
 *   存量必须逐条落账并写清"真违规 还是 合法用途",否则白名单化之后没人知道为什么放行。
 * 判据:`judgeStockLedger`(同文件)。存量命中未落账 / 理由不足 10 字 / 台账残留已消失位置,
 *   三种都会点名;新增命中仍由 `--staged` 的 ratchet 当场阻断,不靠这份台账兜。
 *
 * class 取值:
 *   - violation:真违规(可见文案位把 emoji 当图标/装饰,应换 lucide 图标或纯文字);
 *   - legit:合法用途(数据展示/度量符号),按用途保留。
 *
 * 形状与门内扫描结果一一对应:`file:line:label`(缩进调整不动台账;换行需同步台账)。
 */
export const EMOJI_TEXT_STOCK = [
  { file: 'apps/miniapp-taro/src/pkg-user/checkin-assistant/WorkbuddyTaskSection.tsx', line: 467, label: 'text emoji (visible copy)', class: 'violation', reason: '打卡结果前的 ✓ 属可见文案位,应换 lucide Check 图标或去掉符号' },
  { file: 'apps/mobile-rn/src/components/IntelligentAssistant.tsx', line: 83, label: 'string emoji (user copy)', class: 'violation', reason: '助手欢迎语里的 👋 是面向用户文案 emoji,应去掉交图标表达' },
  { file: 'apps/web/app/(main)/admin/crew/[id]/PageClient.tsx', line: 121, label: 'string emoji (user copy)', class: 'violation', reason: '运行日志的 ⏹ 状态符号属可见文案,应换图标或文字状态' },
  { file: 'apps/web/app/(main)/admin/crew/helpers.ts', line: 66, label: 'string emoji (user copy)', class: 'violation', reason: '会话完成提示以 ✅ 前缀,属可见文案 emoji,应改文字或图标' },
  { file: 'apps/web/app/(main)/admin/crew/page.tsx', line: 350, label: 'text emoji (visible copy)', class: 'violation', reason: 'stub 模式警示的 ⚠ 用 emoji 当图标,应换 lucide TriangleAlert' },
  { file: 'apps/web/app/(main)/admin/developer/DeveloperCards.tsx', line: 316, label: 'text emoji (visible copy)', class: 'violation', reason: '密钥提示的 ⚠ 用 emoji 当警示图标,应换 lucide TriangleAlert' },
  { file: 'apps/web/app/(main)/admin/relay/tasks/page.tsx', line: 159, label: 'text emoji (visible copy)', class: 'violation', reason: '未判定提示的 ⚠ 用 emoji 当警示图标,应换 lucide TriangleAlert' },
  { file: 'apps/web/app/(main)/agent-canvas/AgentCanvasClient.tsx', line: 169, label: 'string emoji (user copy)', class: 'violation', reason: '执行日志里的 ▶ 状态符号属可见文案,应换图标或纯文字' },
  { file: 'apps/web/app/(main)/agent-canvas/AgentCanvasClient.tsx', line: 224, label: 'string emoji (user copy)', class: 'violation', reason: '运行结束日志的 ■ 状态符号属可见文案,应换图标或纯文字' },
  { file: 'apps/web/app/(main)/subagents/detail/SubagentDetailClient.tsx', line: 281, label: 'text emoji (visible copy)', class: 'violation', reason: '配额超限提示的 ⚠ 用 emoji 当警示图标,应换 lucide TriangleAlert' },
  { file: 'apps/web/src/components/ai/best-of-compare.tsx', line: 167, label: 'text emoji (visible copy)', class: 'violation', reason: '理由行的 📌 属可见文案 emoji,应换 lucide Pin 或去掉' },
  { file: 'apps/web/src/components/checkin/WorkbuddyTaskPanel.tsx', line: 431, label: 'text emoji (visible copy)', class: 'violation', reason: '打卡结果前的 ✓ 属可见文案位,应换 lucide Check 图标或去掉符号' },
  { file: 'apps/web/src/hooks/use-device-fingerprint.ts', line: 57, label: 'string emoji (user copy)', class: 'violation', reason: '防伪画布水印文案含 🛡,替换需同步防伪图,暂记存量待评估' },
  { file: 'apps/web/src/hooks/use-device-fingerprint.ts', line: 59, label: 'string emoji (user copy)', class: 'violation', reason: '防伪画布水印文案含 🛡,替换需同步防伪图,暂记存量待评估' },
  { file: 'packages/app/src/features/agent-market/AgentMarketScreen.tsx', line: 96, label: 'text emoji (visible copy)', class: 'legit', reason: '评分星 ★ 与数值是评分数据展示,属合法用途,不按图标违规处理' },
]
