// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 守护日志(2026-10-25 从 scripts/git-guardian.mjs 原样搬出,函数体/落盘路径/文案一字不动)。
 *
 * 搬出动因:守门 103 的 C1 单文件行数上限(6000,该规则无豁免通道)—— git-guardian.mjs
 * 6074 行判红,越线提交是机主 2026-10-24 的守护增强且已在 origin。按"渐进收口不得
 * 改阈值"的设计前提,唯一正解是拆文件;本模块与 lib/git-guardian-pure.mjs(2026-10-21
 * 同一动因搬出)同型:实现单源在 lib,主文件只做原路径 import + 再导出,外部消费者
 * (git-guardian-prod-foreign.mjs 等)按原路径 import 不受影响。
 *
 * 为什么日志也搬:TEMP 清扫两族(lib/git-guardian-temp-sweepers.mjs)的 logger 默认值
 * 绑定本函数、该族同批搬出;两族若反向 import 主文件,就会与主文件的 import 形成环。
 * LOG 常量随同搬出:主文件余下几处 tick 路径以 dirname(LOG) 作状态目录锚点,经 import
 * 取用同一份,不复制第二份路径字面量(两处各写一条必漂移,本仓记过最多次的失效型)。
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveWorktree } from './gitdir.mjs'

export const LOG = join(resolveWorktree(), '.ihui-agent', 'state', 'git-guardian.log')

export function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try {
    mkdirSync(dirname(LOG), { recursive: true })
    appendFileSync(LOG, line + '\n')
  } catch {
    /* 日志失败不影响守护 */
  }
}
