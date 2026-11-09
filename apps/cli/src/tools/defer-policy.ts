// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 延迟装载策略(Deferred Tool Policy) —— 决定"哪些工具的**参数 schema** 不常驻 system prompt"。
 *
 * 立因:工具表全量拼进 prompt 时,116 枚工具的 schema 会吃掉大量前缀预算,
 * 且工具集每变一次(插件/MCP/按需注册)整段前缀就变一次,缓存命中率被拖垮。
 * 这里只做**按名字族的保守分类**,不改任何注册点、不改权限链、不改 danger 判定。
 *
 * 三条纪律:
 *   1) `dangerous` 级工具**永不**默认延迟 —— 危险动作必须让模型在常驻 schema 里
 *      直接看到参数,不允许"先检索再确认"绕一层(那会把确认时机推后到工具执行)。
 *   2) 低频/长尾族才延迟;高频核心族(read_file/write_file/edit_file/grep/glob/run_command/
 *      todo_write/skill/ask_user_question)必须常驻,延迟它们等于每轮多一次检索往返。
 *   3) 模式按"前缀"或"精确名"表达,不逐个工具抄名单 —— 名单会随工具新增静默漂移,
 *      而前缀族在新增成员时自动跟上(这正是本策略愿意承担的失效方向:多延迟一枚低频工具,
 *      由 tool_search 兜底,而不是漏延迟整族)。
 */

import type { Tool } from './index.js';

/** 单个延迟模式。`kind` 决定匹配方式,`reason` 是中文设计理由(给后来人,而不是给模型)。 */
export interface DeferredToolPattern {
  readonly kind: 'prefix' | 'exact';
  readonly value: string;
  readonly reason: string;
}

/**
 * 延迟模式表。顺序无关紧要(任一命中即延迟),但**新增模式必须自带理由**。
 *
 * 取舍口径:单会话里"十次里不到一次"的族先延;一次任务中反复要用的族不延。
 */
export const DEFERRED_TOOL_PATTERNS: readonly DeferredToolPattern[] = [
  {
    kind: 'prefix',
    value: 'debug_',
    reason: 'DAP 调试会话族(launch/attach/断点/单步/变量等)只在排障专项任务里用,常规编码会话零调用;族内 dangerous 成员(launch/attach)由 shouldDeferTool 的兜底规则自动常驻。',
  },
  {
    kind: 'prefix',
    value: 'browser_page_',
    reason: '页面动作族(snapshot/click/type/select/hover/press_key/pick_at_point)是同一次浏览器会话里的第二步之后才需要,首步由 browser_navigate/snapshot 常驻即可,参数细节到用时再检索。',
  },
  {
    kind: 'prefix',
    value: 'browser_',
    reason: '浏览器自动化整体属低频长尾(多数编码会话不打开页面);导航与快照等入口仍可由 tool_search 一次命中并拿到完整 schema。',
  },
  {
    kind: 'prefix',
    value: 'git_branch_',
    reason: '分支管理(branch_create/switch/delete/list)是低频运维动作,一次任务通常只发生一次,不值得占用常驻前缀。',
  },
  {
    kind: 'prefix',
    value: 'git_stash_',
    reason: 'stash 三连只在切换上下文时用,普通修复/提交流程不触发;延迟后由检索按 "stash" 命中。',
  },
  {
    kind: 'prefix',
    value: 'git_remote_',
    reason: '远端读写(remote_add/list)属仓库一次性配置,不进日常循环。',
  },
  {
    kind: 'prefix',
    value: 'git_tag_',
    reason: '打标签/列标签是发版动作,频次远低于 status/diff/log/add/commit 五枚常驻核心。',
  },
  {
    kind: 'prefix',
    value: 'git_conflict_',
    reason: '冲突检测与解决只在合并失败后进入,属事件驱动的低频路径。',
  },
  {
    kind: 'exact',
    value: 'git_merge',
    reason: '合并本身是低频高危动作,延迟参数展示可缩短常驻前缀;安全级别不因延迟而改变(权限链照旧)。',
  },
  {
    kind: 'exact',
    value: 'git_rebase',
    reason: 'rebase 属低频且容易改历史的动作,与 merge 同档处理;延迟只影响提示面,不影响执行面。',
  },
  {
    kind: 'prefix',
    value: 'gh_',
    reason: 'GitHub PR/Issue/Release 族(12 枚)只在对接远端平台时用,占常驻前缀比例高、单会话命中率低。',
  },
  {
    kind: 'prefix',
    value: 'lsp_',
    reason: 'LSP 导航族(8 枚)是"看代码"的补充手段,已有 grep/glob/read_file 常驻兜底;专项重构时才检索。',
  },
  {
    kind: 'exact',
    value: 'codegraph',
    reason: '代码图谱属可选增强能力,索引未启用时调用也不会成功,延迟它可避免误导模型优先使用。',
  },
  {
    kind: 'exact',
    value: 'goto_definition',
    reason: '与 lsp_goto_definition 同类的低频导航,保留 lsp 族一个入口常驻即可。',
  },
  {
    kind: 'exact',
    value: 'find_references',
    reason: '引用查找属"读代码"的低频分支,命中面比 read_file/grep 窄。',
  },
  {
    kind: 'prefix',
    value: 'terminal_',
    reason: '终端会话族(open/send/read/resize/close)在已有 run_command 常驻时属重复能力,仅在需要长驻交互终端时检索。',
  },
  {
    kind: 'prefix',
    value: 'memory_',
    reason: '记忆四枚(recall/save/dream/forget)由宿主在会话装配期注入相关条目,模型主动调用属低频补充。',
  },
  {
    kind: 'prefix',
    value: 'clipboard_',
    reason: '剪贴板读写默认关闭(feature flag),开启后也属偶发动作,不宜常驻。',
  },
  {
    kind: 'prefix',
    value: 'batch_',
    reason: '批量编辑/预览/撤销属专项重构工具,与单文件 edit_file 常驻入口重叠,延迟后可避免模型误选。',
  },
  {
    kind: 'exact',
    value: 'enter_worktree',
    reason: 'worktree 隔离是会话级一次性决策,进入后由 exit 对称收尾,两次调用之间不需要反复看 schema。',
  },
  {
    kind: 'exact',
    value: 'exit_worktree',
    reason: '与 enter_worktree 成对,按同一理由延迟。',
  },
  {
    kind: 'prefix',
    value: 'lsp_workspace_',
    reason: '工作区级符号/重命名/代码动作属大范围重构动作,频次低且与 lsp_ 主族重复表达。',
  },
];

const EMPTY_REVEALED: ReadonlySet<string> = new Set<string>();

/**
 * 判断单枚工具是否应默认延迟。
 *
 * @param name      工具名(注册表里的规范名)
 * @param tool      可选工具对象;给定时可读到 `dangerLevel` / `deferLoading`
 * @param revealed  会话级已揭示集合(命中即不再延迟 —— 检索过一次就常驻本轮)
 *
 * 判序:
 *   1. 显式 `deferLoading === false/true` 优先(注册点不逐个改,但允许个别工具自述);
 *   2. `dangerous` 一律常驻(见文件头纪律 1);
 *   3. 已揭示的不再延迟;
 *   4. 命中模式表才延迟。
 */
export function shouldDeferTool(
  name: string,
  tool?: Pick<Tool, 'dangerLevel' | 'deferLoading'>,
  revealed: ReadonlySet<string> = EMPTY_REVEALED,
): boolean {
  if (tool?.deferLoading === true) {
    // 即便工具自述延迟,危险级别仍高于自述:危险工具必须常驻。
    return tool.dangerLevel !== 'dangerous';
  }
  if (tool?.deferLoading === false) return false;
  if (tool?.dangerLevel === 'dangerous') return false;
  if (revealed.has(name)) return false;
  return DEFERRED_TOOL_PATTERNS.some((pattern) =>
    pattern.kind === 'prefix' ? name.startsWith(pattern.value) : name === pattern.value,
  );
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
