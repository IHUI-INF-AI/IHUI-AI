<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R61 —— 协议面封闭集 N≤3 族扫尾（全量穷举法第六轮：12 族批量收编 + 精确差集去重）

## 1. 本轮目标与取证方法

承接 R60 报告 §7 的开放轴「剩余 N≤3 族扫尾」。本轮不再凭记忆挑族，而是**机械差集**决定落地清单，避免两类错误：重复落地、凭空猜测。

取证真相源仍是 R58 穷举产物 `D:/DevEnv/Temp/r58/families.out`（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + `struct variant X::Y with N element` 机器反推，95 家族）。本轮两次差集：

- **粗差集**（variant 字符串是否被本仓 core 任何模块收编）：95 族 → 36 已落 / 59 未落。含假阳性。
- **精确差集**（模块元素数表键集 == 族 variant 集，AST 解析全仓 core）：95 族 → 30 族精确已落。消除假阳性。

关键发现——**同族异形态陷阱**：`ReviewDecision`、`ThreadStatus`、`PatchChangeKind`、`McpStartupStatus` 等族在粗差集里显示"未落"，但 R56 早期模块已按 **wire 值形态**（snake/camel，如 `approved_for_session` / `notLoaded`）收编；families.out 记的是同族 **PascalCase struct variant 名**（如 `ApprovedExecpolicyAmendment` / `Active`）。两者是同一封闭集的两种取证口径，**属重复落地，本轮全部跳过**。

R61 最终清单 = R60 §7 点名的 8 族 + 3 个经精确差集确认为真空白的增补正交族，共 12 族，全部逐字表从 families.out 机器解析（零手敲）、本仓 core 零同名模块。

## 2. 交付（24 文件：12 模块 + 12 测试，commit 见 §5）

| 模块 | 族 | 逐字 variant（元素数） | 本仓语义域 / 一轴超越 |
|---|---|---|---|
| `plugin_source.py` | PluginSource | Git:4, Local:1, Npm:3 | remote/local 分发域；Git4 vs Npm3 差异化守门 |
| `web_search_action.py` | WebSearchAction | FindInPage:2, OpenPage:1, Search:2 | navigation/discovery 动作域 |
| `gateway_auth.py` | GatewayAuth | EnvironmentVariable:1, ExternallyConfigured:1 | environment/external 凭证域；元素数同 1 靠域归类区分 |
| `gateway_oauth_delivery.py` | GatewayOAuthDelivery | Cookie:1, Header:2 | browser/http 投递域 |
| `login_account_response.py` | LoginAccountResponse | Chatgpt:2, ChatgptDeviceCode:3 | interactive/device 登录域 |
| `otel_exporter_kind.py` | OtelExporterKind | OtlpGrpc:3, OtlpHttp:4 | grpc/http 传输域 |
| `file_change.py` | FileChange | Add:1, Delete:1, Update:2 | create/update/delete 变更域 |
| `wire_runtime_response.py` | WireRuntimeResponse | Result:5, Terminated:3, Yielded:3 | complete/yield 终态域；Result5 族内最强区分 |
| `parsed_command.py` | ParsedCommand | ListFiles:2, Read:3, Search:3, Unknown:1 | filesystem/discovery/fallback 命令域 |
| `provisioning_message.py` | ProvisioningMessage | ProvisionSandboxRequest:1, ProvisionSandboxResponse:1, RegisterInstallationRequest:1 | sandbox/installation 供给域 |
| `exec_permission_profile.py` | ExecPermissionProfile | External:1, Managed:2 | external/managed 策略域 |
| `wire_result.py` | WireResult | Err:1, Ok:1 | success/failure 结果域 |

每个模块统一含：`StrEnum` 逐字值域、逐字元素数表（真相源）、语义域归类表、`xxx_names/count/ensure/domain/domain_members/is/validate` 纯函数、`ValueError` 子类错误点名。元素数差异化的族让 `validate(name, count)` 具备真实区分力；元素数全同的族（GatewayAuth / WireResult / ProvisioningMessage）明确靠域归类提供区分轴，不虚报守门强度。

同构族纪律：`ParsedCommand` 与 `CommandAction`（4 variant 逐字同构）、`ExecPermissionProfile` 与 `TaggedPermissionProfile`（逐字同构）各只落一族，重复落地价值已被 R58/R60 证伪。

## 3. 生成与静态检查

生成器程序化复用 R60 已验证骨架（HEADER/TEST_TPL/render 函数零手敲漂移），只注入 12 族 SPECS；水印头由 build.py 从 HEAD 面干净模块逐字前置（不可见字符零手敲）：

- `py_compile` 24/24 绿
- 水印审计 24/24（`IHUI-AI-PROVENANCE` 逐字存在）
- ruff 0.16.6：12 个 I001 import 排序自动修后全绿（ruff 改动后复验水印仍 24/24、py_compile 仍绿）

## 4. 验证（全绿）

- **280 pytest**（R61 单跑）/ **1782 pytest**（R61 + R56-R60 全量回归）
- **三重反向变异实证**（每步 shell `trap` 兜底恢复，因共享树守护 SIGTERM 曾打断批量脚本一次，已验证残留并从原始 body 完整重建后再分步执行）：
  1. 删 `PluginSource.Local` 枚举档 → test_plugin_source 转红，恢复转绿
  2. 篡改 `FileChange.Update` 元素数 2→99 → test_file_change 2 failed 转红，恢复转绿
  3. 篡改 `GatewayAuth.ExternallyConfigured` 域映射 external→environment → test_gateway_auth 1 failed 转红，恢复转绿
  - 三锚点终检全为 1，零变异残留
- 一次 SIGTERM 教训：批量 mutate_check.py 的 finally 未执行导致 `FileChange.Update=99` 残留（当时文件仍 untracked、未落 HEAD），从 scratch 原始 body 重建 + ruff + pytest 复核后确认干净，改用单变异 trap 法完成。

## 5. 落库与推送状态

- 对象空间精确 pathspec 落库成功：commit `5156939b634`，25 文件全在 HEAD 面、工作树干净、零他席 staged 触碰。
- **推送未完成**：唯一推送通道在「执行 git push origin main」阶段被 SIGTERM，`ls-remote` sha 未变（仍 `e255e143`，R61 未上 `origin/main`）。分诊 pre-push-gate：13 道 blocking 门通过、0 判红、1 道 **T1 全量 typecheck 被单门超时看门狗终止（未判定）**——共享树资源饱和，与 R59 同型，非本轮 Python 产物问题，也非真实违规。按纪律（未判定不洗门、饱和树不反复硬推）停止重试；本地 0 behind / 35 ahead 无分叉、R61 提交安全落在 HEAD，交守护 converge 后统一推送。

## 6. 诚实边界

- 12 族 variant 名与元素数逐字确证于 codex.exe 26.1111.2228.0；**语义域归类（remote/local、browser/http、success/failure 等）是本仓归类，非对照原生判据**，不冒充反编译结论。
- 各 variant 的具体携带字段、协议时序、配置协议未从 disasm 确证，本轮只钉「名 + 元素数 + 归类」三层，不越界断言。
- `tagged enum` / `unit-variant` 值域两轮正则仍近 0（R60 probe 已证），需换 Ghidra 定向 xref，非批量可及，本轮不动。
- 同族异形态（R56 wire 值 vs families.out struct variant 名）已识别并排除；不排除 R56 之外仍有未被两法覆盖的第三形态，但当前证据到此为止。

## 7. 后续开放轴

- **剩余 N≤2 族扫尾**：精确差集后仍有约 47 族未落（多 N=1/2），如 `GatewayAuth` 已落但 `WireResult` 类同构族余项、`Account`/`ActorInfo`/`ContextReference`/`DelegateRequest` 等；按语义正交性择优，避免为凑数落同义重复族。
- **`Message`(N=17) 大族**：R58 记 17，R60 probe `variant_qualified` 正则一度抓到 45，经宽正则元素数反证为连体串假阳性；真值仍以 families.out 的 17 为准，但需 Ghidra 确认是否有未登记 variant。
- **从「名清单」升级到「字段级 wire 契约」**：当前 6 轮均为值域封闭集，下一步应挑 1~2 个高频族做 disasm 级字段反推（R53 LEA xref 法），把复现深度从「有哪些值」推进到「值长什么样」。
