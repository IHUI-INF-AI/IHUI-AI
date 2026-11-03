<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T11 — Qoder security-scan 插件声明面取证 × 本仓 G-12 安全扫描 hook 接线(2026-11-01,执行席 J)

- 基线 HEAD:`785700f1ea49240034b98c01eb833ec3a942e1f2`
- 取证工具:直接读取对照程序 `.qoder-plugin` 声明面(主席令:rea 用于二进制/安装包;本次对照对象是**插件目录内的声明件**,程序优先路径按机主给定的 `C:/Users/Administrator/.qoder-cn/security-resources/security-scan` 直读,未做二进制反编译 —— 声明面已足够回答事件×matcher×阻断档位三个问题,[观察]级)。
- 边界执行:只读程序与声明面(plugin.json / qoder-hooks.json / *.example / SKILL.md / 目录清单);**未读**任何 `bin/` 内二进制内容、未读任何配置实值文件(`config.yaml.example` 与 `security-patterns.yaml.example` 是上游发布的示例声明件,不含凭据;目录内未发现需要跳过的凭据类文件,`assets/` 未逐一打开)。册内**不粘贴任何配置值**,只写字段名与形态。

## 1. 对照程序声明面(qoder security-scan)

### 1.1 包面 [观察]

- 版本:plugin.json `version` = package.json `version` = `.ready.json` `resourceVersion` = **0.9.5**(T3 册写的 `qoder-security 0.9.5` 版本号属实,但产品件名为 `security-scan`,作者署名 CodeSec Team,许可 Apache-2.0)。
- 结构:`plugin.json`(声明 `hooks` 与 `skills` 两个挂载点)、`qoder-hooks.json`(钩子声明)、`bin/`(启动器 6 件:.cmd/.sh 成对,含 bootstrap/update/settings)、`scripts/`(空目录)、`skills/security-scan/SKILL.md`、两个 `.example` 声明件。真实逻辑在 `bin/` 内的 `qodersec` 跨平台二进制(声明自述 "All logic runs in the cross-platform qodersec binary"),**本次未反编译**(无必要:判其 hook 形态只需声明面;二进制内部规则表若与 example 不同属 [未知])。

### 1.2 hooks 声明面(qoder-hooks.json)

| 事件 | matcher / if | 动作层 | 阻断档位 | timeout | async |
|---|---|---|---|---|---|
| SessionStart | — | `ensure-deps`(依赖自举) | 告警语义(装载腿) | 15 | true |
| PostToolUse | `Edit\|Write\|MultiEdit\|NotebookEdit` | `review --mode=hook --layer=l1`(pattern warning) | [推断]告警(声明面无 deny/block 字段;层名 L1 与 example 的 `post_tool_use_file.patterns` 对应) | 未声明 | 未声明 |
| PostToolUse | `Bash` + `if: Bash(git push *)` | `review --mode=hook --layer=l3`(agentic 深扫) | [推断]同上;SKILL.md 侧有"先offer再push"的人工确认门 | 未声明 | 未声明 |
| Stop | — | **空数组,零钩子** | — | — | — |

- **关键更正 [观察]**:`Stop: []` 为空,且 `config.yaml.example` 注释自陈 *"The plugin does not register a Stop hook, so the legacy stop.\* knobs are intentionally omitted"*。而 plugin.json/package.json 的 description 文案写 "cloud-backed diff review on **Stop**"。**声明面与文案互相矛盾,以声明面为准**:云端/深度 review 实际挂在 `git push` 触发的 PostToolUse(Bash matcher)上,不在 Stop 事件。
- ⇒ **T3 册 G-12 行「Stop 时云端 diff review」读数不实**(第二处不实见 §2);对照程序真实形态 = 两层 PostToolUse(编辑类 pattern warning + push 前 agentic diff review)+ 一条 SessionStart 自举。

### 1.3 判据声明面(example 件)[观察]

- `security-patterns.yaml.example`(L1 自定义规则 schema):字段 = ruleName / substrings / regex / path_glob / paths / exclude_paths / severity(HIGH|MEDIUM|LOW,默认 MEDIUM)/ reminder;守卫 = 合并去重后 ≤50 条、单条提醒 ≤1KB、regex ≤1000 字符、**RE2 线性时间实现拒炸栈模式**、编译错误条目丢弃不连累其余。
- `config.yaml.example` 相关字段名(只列名):`review.previous_findings_ttl_secs`(默认 3600,会话内同漏洞去重)/ `review.shared.diff.max_per_file|max_total|max_files`(默认 80KB/400KB/30 文件)/ `review.shared.state.reviewed_shas_cap`(L3 防重复审同一 commit)/ `review.post_tool_use_file.patterns.enabled|builtin|custom` / `transport.qoder_sdk.timeout_secs_by_layer`(review 60 / commit 120)+ `min_budget_secs` fail-fast / `.qodersecignore` + 10MiB 上传封顶(云端腿的外发预算)。
- SKILL.md 路由面:L1(hook 内)/ L2(轻量人工触发的 diff review)/ L3(commit 区间 agentic 审计)/ L4(全仓云扫)四档隔离,配置开关经 `security-scan-settings.*` 归一化 JSON 消费;取不到/解析失败 ⇒ **两档一律按 disabled 处理**(其失效方向与本仓 §0.3 同型,本仓多一条 missing 点名)。

## 2. 本仓判据现状复核(G-12 缺口格)

- `apps/cli/src/commands/security.ts`(改前 475 行)导出面只有 `registerSecurityCommand`:**它是 `/api/security/*` 的 HTTP 审计客户端**(audit/scan/report 三子命令全部远端取数),不是本地扫描器;可复用纯判据 = 响应类型守卫×5 + 参数校验×3,住同一文件、全仓零 import(消费方仅 `src/index.ts:90,883` 挂命令)。主席现读成立。
- **T3 册「三件套默认全开且有生产消费方」读数需限定范围**:prompt_guard / exec_policy / tool_input_scanner(`apps/ai-service/app/services/`)与提交链守门 `scripts/check-api-key-leak.mjs` 都真实在场,但:① Python 面跨语言不可 import;② 守门脚本判 git blob、住仓库根,发布包 `ihui-cli` 结构上引不到;③ 面向的是 **agent 运行时/提交链**,**CLI hooks 进程内判据面一件都不在场**。⇒ 册面"接一层薄 matcher 适配器即可"对 G-12 的 CLI 半格不成立,本席按实际补 TS 判据层(不新造云端/SCA 引擎,只做 pattern 层)。
- 同族判据住所如实登记(防"再抄一份"):
  - `scripts/check-api-key-leak.mjs` — 提交链 blocking 守门(已知前缀真值 + 通用形态);
  - `packages/shared/src/utils/redact.ts` 与 `apps/cli/src/redact.ts` — **遮蔽**(打码)不是检测;
  - `apps/ai-service/app/services/{prompt_guard,tool_input_scanner,exec_policy}.py` — Python 运行时面;
  - 新落点 `apps/cli/src/security/secret-scan.ts` — 本仓唯一的 **TS 进程内 pattern 检测判据**,与上面各家分工不同维(检测形态告警 vs 打码 vs 已知真值拦截),模式集与提交门**刻意独立**:发布包不得依赖仓库根脚本(§3 依赖红线)。

## 3. 本仓接线设计与取舍

### 3.1 三层对齐表

| 对照层(qoder 0.9.5) | 本仓落点 | 档位 |
|---|---|---|
| SessionStart ensure-deps(自举) | 不需要(判据在包内,零外部依赖) | 刻意省略 |
| L1 PostToolUse `Edit\|Write\|MultiEdit\|NotebookEdit` pattern warning | `runPostToolCall` 内置腿:`isEditToolName`(本仓工具名现读 = write_file/edit_file/batch_edit)⇒ `scanEditedFile` ⇒ 行进 `additionalContext`(G-424 ③ 内存通道)+ 非 clean 时 stderr 点名 | warn,不阻断 |
| Stop 事件 | 对照程序**没注册**(空数组);本仓反而用既有 `stop` 事件挂上聚合审查 = **事件面比对照宽的一格** | warn |
| L3 git-push 前 agentic 云 review | `runHook('stop')` 内置腿:`reviewWorkspaceChanges`(HEAD 以来 diff 新增行 + 未跟踪文件,上限对齐其 diff 三闸)⇒ **零外发** | warn,不外发 |
| L2/L4 云扫 + settings 门 | 不做(射程外) | 未实现,见 §4 |

### 3.2 超越轴(三条,均落测试)

1. **不外发用户代码**:对照程序把 diff/文件包送云端 review(自带 `.qodersecignore`/10MiB 预算也是在管理外泄面);本仓判据全在进程内,无任何网络调用。理由:把用户代码送出仓 = 新的数据出口,不在本格射程(AGENTS §5e-1 精神:判据不自带外泄面)。
2. **未判定不冒绿**:任何输入取不到(工具载荷无 path、读盘失败、git 不可用、扫描器自炸)⇒ `status=undetermined` + `missing=` 逐条点名 + 行内固定机器码 `not-judged-safe`;值域封闭三档,**结构上不存在"默认安全"第四格**(形状锁在测试)。对照程序的对应档是"字段缺失 ⇒ 两档按 disabled",方向一致但本仓把"缺什么"点名到行里。
3. **守卫失败不影响用户动作**:扫描腿包双层 catch(判据层自身不抛 + 接线层 `scan-adapter-crashed` 兜底),`proceed` 恒不受扫描影响(§12e:与提交内容无关的恒红只会逼人跳门)。对照声明面无对应观察(其二进制故障模式 [未知])。

### 3.3 消费侧边界(如实登记,不假装跑通)

- 本仓 postToolCall/stop 的 `HookResult` 在现有调用点(agent.ts/repl.ts/tools/*)多数**丢弃返回值**;告警的 guaranteed 可见面 = 钩子文本通道 `additionalContext`(已成形,任何消费方接上即用)+ 非 clean 时的 stderr 点名(带去重)。把 `additionalContext` 并入模型输入的第二条腿(sessionStart/userPromptSubmit 已有同款消费)对本事件的接线在 `commands/agent.ts`,**不在本席禁改清单外的授权面**,归下一笔;本席不越权改派发侧。

## 4. 未做与原因

- L2/L4 云端扫描、`security-scan-settings` 式产品开关、reviewed-SHA 追踪(防重复审同一 commit)⇒ 均属云/SCA 引擎面,超出"补齐判据可达性"本格;`stop` 层的去重窗口(TTL 3600s,对齐 `previous_findings_ttl_secs`)已覆盖"同一命中不重复报"的最小语义。
- `check-api-key-leak.mjs` 与本层模式集的合并:刻意不做(发布包 vs 仓库根脚本的依赖方向红线),两边判据维不同(真值拦截 vs 形态告警),登记于 §2 而非强行同源。

## 5. 现场数字(现读,2026-11-01)

- 新判据文件:2(`src/security/audit-guards.ts` / `src/security/secret-scan.ts`);接线文件:1(`src/hooks/index.ts`,hooks/ 目录内唯一改动面);命令壳:1(`src/commands/security.ts`,行为不变)。
- 模式表现读 7 条(aws/github/openai-style/private-key/slack/google/generic-assignment)+ 占位符放行表 6 条;上限常量对齐声明面三闸(81,920 / 409,600 / 30)。
- 新镜像测试 `tests/security-scan-hooks.test.ts` **15 例全绿**(现读);`pnpm turbo typecheck --filter=ihui-cli --force` **8/8 successful**;全量 `npx vitest run`(apps/cli)末行 **5607 passed | 20 failed | 6 skipped (5633)** —— 失败集经对照实验隔离:还原本席两枚改动文件后同批 7 枚文件照常红(`config-merge`/`config-sources`/`hooks-trust-command`/`policy-bundle-single-source`/`sandbox-strict…`/`spec-drift`/`tool-parallelism…`,均非本批引入;其余 2 枚在全量并行下抖动,单跑带本席改动全绿)。
- 既有红门(与本批无关,如实登记):`tests/hooks-trust-command.test.ts` 4 例红 = 提交 0e3ad01c29 给 `commands/hooks.ts` 加了 `configChange` 派发引用 `TRUSTED_FOLDERS_PATH`,而该测试的 trust.js mock 未带此导出(**HEAD 既有,非本批引入**,复现法=还原本席两文件后同红,已在交付报告点名)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
