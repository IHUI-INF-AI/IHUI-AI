// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi, getToken } from '@ihui/api-client';
import chalk from 'chalk';

/**
 * 审计摄入通道的 api-client 出口解析(86A 工具账本 / 86H 审批决策**共用这一份**)。
 *
 * 为什么单独成一个模块:上报入口原本只住在 `commands/agent.ts` 里,而审批决策的落链
 * 站点有五个(runAgent / repl / acp / agent-core / subagent)—— 让 tools 层与 acp 层
 * 反向 import `commands/agent.js` 会造出 `agent → tools/index → subagent → agent` 的
 * 循环。取出口这件"算同一件事"的逻辑必须只有一份实现(两处各写一遍必然漂移,本仓记过多次)。
 *
 * 三条不可漂的行为:
 * 1. 历史测试套件常整模块 mock `@ihui/api-client` 且不带这两个导出 —— vitest 对缺失导出的
 *    **访问本身就会抛错**(不是 undefined),所以判"在不在"必须 try/catch 兜住访问,
 *    否则 fire-and-forget 变 unhandled rejection;
 * 2. 兜住的跳过仍**喊一次**:被跳过是真跳过,不是被无声消化(与 §5e"失败必须响"同一条禁令);
 * 3. 按 tag 分档只喊一次 —— 一条通道的噪音不得替另一条消音。
 */

export interface AuditIngestClient {
  post: typeof fetchApi;
  hasToken: () => string | null;
}

const warnedTags = new Set<string>();

/**
 * 取上报出口;取不到 ⇒ 点名一次(每个 tag 一次)并返回 null。
 * 返回 null 是"这次被跳过"的事实,调用方不得把它当成功计数。
 */
export function resolveAuditIngestClient(tag: string): AuditIngestClient | null {
  try {
    return { post: fetchApi, hasToken: getToken };
  } catch {
    if (!warnedTags.has(tag)) {
      warnedTags.add(tag);
      process.stderr.write(
        chalk.yellow(`[${tag}] api-client fetchApi/getToken unavailable; audit reporting skipped\n`),
      );
    }
    return null;
  }
}

/** 仅测试用:清掉"出口缺失已喊过话"的记录(不传 tag 则全清)。 */
export function __resetAuditIngestClientWarnForTest(tag?: string): void {
  if (tag === undefined) warnedTags.clear();
  else warnedTags.delete(tag);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
