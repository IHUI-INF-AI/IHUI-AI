// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件类工具的**意图→工具集**策略(单一源)。
 *
 * 为什么从 `apps/web/src/hooks/use-chat/tool-config.ts` 搬到共享层:这不是偏好,是安全面。
 * 这张表决定"哪些用户话术会让模型拿到 `write_file` / `edit_file`",而带不带写类工具
 * 直接等于"这个会话能不能改文件"。第二个真相源迟早会漂(一端放宽正则、另一端没跟),
 * 而漂了不会体现在报错上,只会体现在"同样的话在这个端能改文件、在那个端不能"。
 *
 * 一条**实测边界**(2026-09-27,票⑲ 收回扩展端携带时量出来的,写给下一个想扩消费方的人):
 * 这张表只在"该端有委托面"时才等于能力。web 送 `workspace_context`,所以 fs 类工具由
 * `llm.py` 的委托分支交回浏览器执行;不送 `workspace_context` 的端会落到服务端
 * `_mcp.call_tool`,那里 `write_file` / `file_edit` 属 `_ADMIN_ONLY_TOOLS` 而对话链
 * `__user_role` 恒为 0 ⇒ **必失败**,只读族则会在服务端工作区上执行 ⇒ 越权面变更。
 * 所以新增消费方之前先确认该端有 `onToolDelegate` + tool-result 回传,否则这张表不该被它 import。
 *
 * 消费方(一律走子路径 `@ihui/shared/chat/file-tool-intent`,**不进 `./chat` barrel**:
 * barrel 里已有 `FILE_WRITE_TOOLS`(识别白名单 Set),同名并置会让 `export *` 产出歧义):
 *  - `apps/web/src/hooks/use-chat/tool-config.ts`(re-export,保持既有 import 面不变)
 *
 * 口径逐字照搬 web 原实现,搬迁本身不改语义 —— 任何收紧/放宽都另立一票并两端同改。
 */

/**
 * 只读文件族:宽松召回(读/看/分析/搜 文件·代码·路径)。
 *
 * 命名刻意带 `_INTENT_`:同名 `FILE_WRITE_TOOLS` 已被 `./task-status.ts` 占用,而那是**另一个东西**
 * ——「判定这次工具调用改了文件」的识别白名单(ReadonlySet,与后端 FILE_MODIFY_TOOLS 对齐,成员含
 * apply_diff / create_file / delete_file)。两者必须分名:前者决定"把哪些工具交给模型",
 * 后者决定"把哪些调用算成文件变更"。同名并进同一个 barrel 会直接产出 `export *` 歧义
 * (web `tool-call-card.tsx:33` 按 `.has()` 用后者,拿到数组就是运行时崩)。
 */
export const FILE_READ_INTENT_TOOLS: readonly string[] = [
  'read_file',
  'list_files',
  'file_search',
  'search_codebase',
  'analyze_code',
]

/**
 * 写文件族:仅明确修改动词才携带。
 * 注意与发帧面 `apps/ai-service/app/routers/llm.py` 的 `_FILE_EDIT_PREVIEW_TOOLS`
 * (`write_file` / `file_edit` / `edit_file`)是**两件事**:那张表决定"要不要给流中 diff 预览",
 * 本表决定"要不要把这个工具交给模型"。二者成员不必同,也不得互相推导。
 */
export const FILE_WRITE_INTENT_TOOLS: readonly string[] = ['write_file', 'edit_file']

const FILE_READ_INTENT_RE =
  /(读取|读一下|读出|看一下|看看|查看|打开|分析|总结|检查|搜索|找一下|列出)[^。\n]{0,24}(文件|代码|目录|配置|项目|仓库)|(package|src|apps|packages|components|hooks|stores|lib)[\\/][\w./\\-]+\.\w{1,8}|[\w-]+\.(tsx?|jsx?|py|json|md|css|ya?ml)\b|read_file|list_files/i

const FILE_WRITE_INTENT_RE =
  /(修改|改动|改一下|改掉|编辑|写入|写一个|新增|添加|删除|创建|修复|重构|实现|补齐)[^。\n]{0,24}(文件|代码|逻辑|功能|组件|接口|样式|错误|报错|类型|参数|路径|方法|函数)/i

/**
 * 按用户输入挑文件族工具。判序刻意为"先要有读意图,才谈写":
 * 只出现修改动词而没有文件上下文时**一律不给**写工具(宁可少给,不可多给)。
 * @param content 用户本轮消息原文
 */
export function fileToolsFor(content: string): string[] {
  if (!content) return []
  if (!FILE_READ_INTENT_RE.test(content)) return []
  // 文件上下文已成立(路径/扩展名/读文件动词)时,出现修改动词即加写族
  if (FILE_WRITE_INTENT_RE.test(content)) {
    return [...FILE_READ_INTENT_TOOLS, ...FILE_WRITE_INTENT_TOOLS]
  }
  return [...FILE_READ_INTENT_TOOLS]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
