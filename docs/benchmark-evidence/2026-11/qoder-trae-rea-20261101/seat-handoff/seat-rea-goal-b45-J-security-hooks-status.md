<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# [T11 已开工@2026-11-01/J席] 安全扫描判据提取 + hooks 事件面接线

- HEAD(开工基线): 785700f1ea49240034b98c01eb833ec3a942e1f2
- 现状格复核结果(与主席现读一致,补两条):
  1. `apps/cli/src/commands/security.ts`(475 行)导出面只有 `registerSecurityCommand`(:393);**它不是扫描器**,是对 `apps/api` `/api/security/*` 的 HTTP 审计客户端(audit/scan/report 三个子命令全部走远端)。本地可复用判据只有响应类型守卫 + 参数校验(纯函数,住同一文件、无人 import)。
  2. T3 册 G-12 的「三件套」读数**部分不实**:三件套(prompt_guard / exec_policy / tool_input_scanner)住在 `apps/ai-service/app/services/`(Python,agent 运行时面)+ `scripts/check-api-key-leak.mjs`(提交链守门,TS 不可 import)⇒ 对 CLI hooks 进程内判据面而言**一件都不在场**,"接一层薄适配器即可"不成立,本席按实际补 TS 判据层。
- 对照程序取证(qoder security-scan 0.9.5,.qoder-plugin 声明面,只读不粘值):
  - SessionStart:command 钩子,timeout=15,async=true
  - PostToolUse matcher=`Edit|Write|MultiEdit|NotebookEdit`:L1 pattern warning(无 timeout 字段)
  - PostToolUse matcher=`Bash` + if=`Bash(git push *)`:L3 agentic review
  - **Stop: 空数组**——册面「Stop 时云端 diff review」不确;config.yaml.example 头注自陈「The plugin does not register a Stop hook」,云端腿实际挂在 git-push PostToolUse 上。plugin.json 描述文案与声明面互相矛盾,以声明面为准。
  - 未发现凭据类文件被读;examples 仅为规则 schema。
- 取舍:本仓不外发 diff(刻意分歧,理由见交付报告);scan 一律 warn 语义;未判定不冒绿。

## 结清(2026-11-01/02 交接夜,同席)

- 判据单源:`apps/cli/src/security/secret-scan.ts`(pattern 表 7 条 + 占位符放行 6 条 + 三态判定 scanText/scanEditedFile/reviewWorkspaceChanges + TTL 去重)/ `apps/cli/src/security/audit-guards.ts`(security.ts 的类型守卫×5 + 参数校验×3 + 类型契约逐字节搬家;门 70 走文件头 `i18n-content-exempt-file` 可见豁免,不新增文案)。
- 命令壳 `commands/security.ts` 475→319 行,改为 import 判据层,行为不变(子命令名/参数/退出码/输出逐字);hooks 接线只动 `src/hooks/index.ts` 一个文件(postToolCall 编辑腿 + stop 聚合腿,warn-only)。
- 验证末行现读:turbo typecheck 8/8 successful;`tests/security-scan-hooks.test.ts` 15/15;hook 族 24 文件绿(hooks-trust-command 4 例红 = HEAD 既有,还原本席改动复现同红,根因 0e3ad01c29 的 configChange 派发 × 测试 mock 缺 TRUSTED_FOLDERS_PATH 导出,归下一笔);全量 vitest 5607 passed / 其余失败集与无本批改动时一致(另 2 枚为并行抖动,单独跑全绿)。
- 水印:3 枚新文件已 inject;`check-watermark-syntax`(门 95)全量档末行"全部通过"复跑过。
- 册面更正两处已写进 T11:①「Stop 时云端 diff review」不实(Stop 为空数组,深扫挂 git-push PostToolUse);②「三件套接薄适配器即可」对 CLI 半格不成立(Python 面/根脚本面均不可进程内复用)。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
