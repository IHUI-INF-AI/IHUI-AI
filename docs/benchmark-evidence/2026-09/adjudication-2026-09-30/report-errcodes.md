<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 错误码两族 87 条 MISS · 家族级只读裁定报告

- 裁定日期：2026-09-29 · 仓库：G:\IHUI-AI（只读，未改任何仓库文件；临时脚本在 `.ihui-agent/tmp/d167-2/`）
- 输入：`.ihui-agent/tmp/d167-2/slice-errcodes.json`。**实际构成与任务口径有出入：附录 D 41 条 + 附录 E 46 条 = 87**（任务描述写 25/62，按实际数据裁定，未并桶）。
- 语料纪律：全部判定只看 **HEAD 面**（`git show HEAD:` / `git grep ... HEAD --`），未用工作树语言包；`packages/types/src/failure-code.ts` 为**未跟踪新文件（`??`，未入库）**，已读但单独标注。

---

## ① 机制级结论：**"错误码 → 用户可读文案"机制在我方对话链路【在位】**（HEAD 已入库，三层 + 门禁）

| 层 | 位置（HEAD） | 内容 |
|---|---|---|
| A. AppError 面 | `packages/shared/src/utils/error-messages.ts` | ① `ERROR_CODE_TO_I18N_KEY`（14 码 → `errors.*` i18n 键，L16-31）；② `ERROR_CODE_TO_ZH`（14 码固定中文，如 `UNAUTHORIZED:'登录已过期,请重新登录'`、`FORBIDDEN:'没有权限执行此操作'`）；③ `STATUS_TO_ZH`（HTTP 400/401/403/404/409/429/500/502/503/504 → 中文，**无 413/422**）；④ `ENGLISH_PATTERNS` 兜底正则（`/unauthorized/`、`/forbidden\|access denied\|permission denied\|not allowed/`、`/rate limit\|too many requests/`、`/duplicate\|conflict/`、`/invalid\|missing/` 等）。判序：errorCode → status → 文案正则 |
| B. 轮次业务码面 | `packages/shared/src/chat/error-catalog.ts` + `packages/i18n/messages/web/zh-CN.json` 的 `ai.pane.errorCatalog` | `ERROR_CODE_CATALOG` **110 个业务码** → `{titleKey, actionKey, category}`；web zh-CN 词包内 `ai.pane.errorCatalog` **110 组 title+action 全部有中文值**（如 `FILE_TOO_LARGE:'文件过大/精简文件后重试'`、`CONTEXT_TOO_LONG:'上下文过长'`、`RATE_LIMITED:'请求过于频繁'`、`TOKEN_EXPIRED:'登录已过期/重新登录'`、`MEDIA_COUNT_EXCEEDED:'媒体文件数量超出限制/精简附件后重试'`）。消费方：`apps/web/src/components/chat/message-list/MessageErrorCard.tsx`（errorCode 驱动错误卡）；测试：`packages/shared/src/chat/__tests__/error-catalog.test.ts` + `turn-status-badge.test.tsx`（五语言 parity、逐码 title/action 非空） |
| C. API 统一错误响应 | `apps/api/src/server.ts:143-196`（`setErrorHandler` 注册于 :213） | 统一渲染 `{code: statusCode, message, errorCode?}`；5xx→'服务器错误'、英文 message→'操作失败,请稍后重试' 兜底；`bodyLimit: 10MB`（超限抛 413 → 走同一 handler，得通用中文，**无"过大"语义**）；`apps/api/src/errors/codes.ts` `ErrorCode` 枚举（14 码 HTTP-aligned） |
| 门禁 | `scripts/check-error-code-coverage.mjs`、`scripts/check-error-code-not-text-matching.mjs` | 我方产出的 errorCode 未收录即 exit 1；禁止文本匹配判错 |

**机制级但未入库**：`packages/types/src/failure-code.ts`（`??` 未跟踪）是**决策码**层（rate_limited/timeout/…闭集，非用户文案），其 `failureCodeFromHttpStatus` 已含 413→context_limit、422→invalid_arguments 映射——**未入库，不能作为 HEAD 覆盖证据**，仅说明 413/422 档"正在飞"。

**对 87 条的关系**：机制在位，但它是**闭集**设计——87 个 Qoder 码**逐字 grep（HEAD，apps/web/src + packages/shared/src + apps/api/src + apps/cli/src）零命中**（如 `FILE_SIZE_LIMIT`/`BYOK_AUTHENTICATION_FAILED`/`CHAT_ATTACHMENT_LIMIT_EXCEEDED`/`body_too_large`/`FILE_SCAN` 全部 exit 1；数字码 47902/47903/48713/48715/48716/10605 全仓 src 零命中）。未登记码在 B 层返回 null（不渲染专属标题）、在 A 层落到通用正则/兜底文案。故裁定逐条看"**语义槽位**是否已在我方语料有中文文案位"，而非只看码名。

---

## ② 6 条抽样三态表（**抽样代表，未穷尽**）

| 抽样码 | Qoder 文案 | 判定 | 同义词探针证据（全部 HEAD 面） |
|---|---|---|---|
| `unauthorized` | 登录已失效 | **FALSE** | 精确键零（小写未登记），但机制+位置在位：A 层 `UNAUTHORIZED→'登录已过期,请重新登录'`（error-messages.ts L17,L50）+ `ENGLISH_PATTERNS /unauthorized/i`（L96）+ STATUS_TO_ZH 401；i18n `errors.unauthorized` 有值（web zh-CN）。同语义 B 层 `TOKEN_EXPIRED:'登录已过期/重新登录'` |
| `forbidden` | 没有操作权限 | **FALSE** | A 层 `FORBIDDEN→'没有权限执行此操作'`（L18,L51）+ `/forbidden\|access denied\|permission denied\|not allowed/i`（L99）+ 403 档；`errors.forbidden='没有权限执行此操作'`；shared zh-CN `forbidden.title='无权限访问'` |
| `body_too_large` | 上传内容过大 | **FALSE**（注：HTTP 413 档另判 TRUE-GAP，见附录） | 上传过大语义槽位已覆盖：web zh-CN `chat.attachRejectSize='文件超过大小上限({max}MB)…'`、`upload.oversizeSingle='文件超过大小上限:{name}'`、B 层 `FILE_TOO_LARGE:'文件过大'`、shared `viewFailure.resourceLimitExceeded.action='请求体或返回内容过大…'`。仅 `STATUS_TO_ZH` 缺 413 专门档 |
| `FILE_SIZE_LIMIT` | 文件超过支持的大小 | **FALSE** | 精确键 grep=0（HEAD 4 端 src），但同语义键+值在位：`chat.attachRejectSize`、`upload.oversizeSingle`、B 层 `FILE_TOO_LARGE.title='文件过大'/action='精简文件后重试'`（zh 包 + 词包五语言 parity 测试） |
| `BYOK_AUTHENTICATION_FAILED` | 这轮回复失败 | **FALSE** | 精确键 grep=0；Qoder 可见文案即通用轮次失败 → 我方轮次失败卡机制+位置在位（B 层 + MessageErrorCard + formatSSEError HTTP 分支，未登记码退化兜底同族文案）；且我方已有 BYOK 产品面与密钥族文案：shared `earnings.configureByokDesc='使用您自己的 API 密钥（BYOK）…'`、`byokGuide/byokWizard` 键族、`llmSettings` 显示/隐藏密钥、`quickKey` 密钥配置与校验文案。凭证/密钥探针命中 30+ 条 |
| `CHAT_ATTACHMENT_LIMIT_EXCEEDED` | 附件数量超限 | **FALSE** | 精确键 grep=0，但同语义键+值在位：`chat.attachRejectCount='附件最多 {max} 个,本次被拒 {count} 个'`（web zh-CN:10569）+ B 层 `MEDIA_COUNT_EXCEEDED:'媒体文件数量超出限制/精简附件后重试'` |

抽样小结：6/6 中 5 条 FALSE（语义槽位已覆盖，Qoder 码名未登记属**码名差异而非文案差距**）；`body_too_large` 本条 FALSE 但其 HTTP 413 兄弟档是 TRUE-GAP——已分档、未并桶。

---

## ③ 整族方向性结论 + 建议票面

**方向性结论（三族分别说，不并桶）**：

1. **附录 E 大写族（46 条）**：机制在位且 B 层 110 码闭集 + 五语言 parity 门禁已运转；46 条精确码零登记，但 34 条的可见文案槽位（轮次失败兜底、附件/文件大小上限、超时族、auth 族、BYOK 密钥族）已在我方语料有中文值 → **FALSE 为主**；**10 条 TRUE-GAP** 集中在"文件安全扫描 / 文件完整性 / 本地磁盘与缓存 / 会话历史缺失"四个 Qoder 桌面端下载管域，我方语料零覆盖（探针：`安全检查|安全扫描|病毒`=0、`完整性|校验失败`=0、`空间不足`仅管理面、`会话历史缺失`=0）；2 条 UNDETERMINED。
2. **附录 D 小写蛇形 + 混合族（41 条）**：`forbidden/unauthorized/invalid_*/internal_error/version_conflict/not_ready/body_too_large` 等与 A 层 14 码、英文正则同族 → FALSE；**9 条 TRUE-GAP**（配额外业务语义：组织迁移、轮次上限 47902、禁言、成员容量、文件三态、HTTP 413/422 专门档缺失）；6 条 UNDETERMINED。
3. **纯数字行（22 条）**：分两档——HTTP 状态码位（400/406/413/422/500）**机制在位**（A 层 STATUS_TO_ZH + C 层统一 errorHandler），400/500 FALSE，406 落 B 层 MODEL_REFUSED 族 FALSE，**413/422 机制在位但无专门档（STATUS_TO_ZH 缺档 + Fastify 413 落通用兜底）→ TRUE-GAP**；Qoder 业务数字码（102/103/107/109/112-118/121/10605/47902/47903/48713/48715/48716）非 HTTP 状态、全仓零登记，其中语义同族已被 A/B 层覆盖的判 FALSE，无对应语义位的判 TRUE-GAP/UNDETERMINED。

**建议票面一句话（若按真差距入库）**：
> 以"缺口清单"票入库：仅收录 19 条 TRUE-GAP（FILE_SCAN_PENDING/FAILED/TIMEOUT/UNSCANNABLE/BLOCKED、FILE_NOT_READY、FILE_INTEGRITY_FAILED、FILE_DISK_SPACE、FILE_STORAGE_INVALID、CHAT_SESSION_HISTORY_MISSING、47902、121、speaking_banned、member_capacity_exceeded、file_scan_failed、file_content_rejected、file_not_ready、STATUS_TO_ZH 补 413/422 档），并同步登记到 `ai.pane.errorCatalog` 闭集 + 守门脚本；60 条 FALSE 不入、8 条 UNDETERMINED 挂起待探。

**总票数**：TRUE-GAP 19 · FALSE 60 · UNDETERMINED 8（=87，未并桶）。

---

## 附录：87 行逐行初判（机制级推导复用：A=error-messages.ts，B=error-catalog+zh 包，C=api errorHandler；"0 命中"=HEAD 4 端 src 精确 grep）

### 附录 D（41 条）

| key | 判定 | 依据 |
|---|---|---|
| 102 | UNDETERMINED | 业务数字码 0 命中；"请求时间校验"语义位未探到我方对应（缺：我方链路是否存在时间窗/签名校验错误文案位） |
| 103 | FALSE | "请求重复"族：A 层 ENGLISH_PATTERNS `/already exist\|duplicate\|conflict/` + `CONFLICT:'操作冲突,请刷新后重试'` + 409 档 |
| 107 | FALSE | 网络族：B 层 `NETWORK_ERROR`（zh 包 title/action 在位）+ A 层 `/network\|fetch failed…/` |
| 109 | FALSE | "已禁用/受限"族：B 层 `ACCOUNT_RESTRICTED:'账户受限/联系管理员'`、`EXECUTOR_DISABLED`；shared `common.disabled='已禁用'` |
| 112 | FALSE | 配额族：B 层 `PROVIDER_QUOTA_EXHAUSTED/TRIAL_QUOTA_EXCEEDED/BUDGET_EXHAUSTED/CONCURRENCY_LIMIT_EXCEEDED`（resourceLimitExceeded，zh 在位） |
| 113 | FALSE | 限流族：B 层 `RATE_LIMITED:'请求过于频繁/稍后重试'` + A 层 `errors.rateLimited` + 429 档 |
| 114 | FALSE | 试用受限：B 层 `TRIAL_QUOTA_EXCEEDED`（zh 在位） |
| 116 | FALSE | 同 112 配额族 |
| 117 | FALSE | 同 112 配额族 |
| 118 | FALSE | 同 112 配额族 |
| 121 | TRUE-GAP | 组织数据迁移：0 命中；探针 `已迁移` web/shared=0；无对应语义位（legacy-migration 为类型层，无用户文案） |
| 400 | FALSE | HTTP 400 档：A 层 STATUS_TO_ZH['400']='提交的信息有误…' + C 层 Zod/AppError 400 渲染 |
| 406 | FALSE | 话题拒答族：B 层 `MODEL_REFUSED`（zh 包在位，category 拒答） |
| 413 | TRUE-GAP | STATUS_TO_ZH **无 413 档**；C 层 bodyLimit 超限落'操作失败,请稍后重试'通用兜底，失"过大"语义；413→context_limit 映射仅在未入库 failure-code.ts |
| 422 | TRUE-GAP | STATUS_TO_ZH **无 422 档**；C 层无专门文案；422→invalid_arguments 仅在未入库 failure-code.ts |
| 500 | FALSE | A 层 STATUS_TO_ZH['500']='服务器开小差了…' + C 层 5xx→'服务器错误' + B 层 `INTERNAL_ERROR:'服务内部处理错误/重试'` |
| 10605 | FALSE | 上游过载族：B 层 `PROVIDER_ERROR/UPSTREAM_FAILURE/SERVICE_UNAVAILABLE`（zh 在位）+ A 层 502/503 档；另有 `ai.pane.modelLoad` 负载状态面 |
| 47902 | TRUE-GAP | "轮次已达上限"：0 命中；探针 `轮次|回合+上限/限制`=0；B 层无轮次上限码（BUDGET_EXHAUSTED 是预算非轮次） |
| 47903 | FALSE | 输出过长族：B 层 `TEXT_TOO_LONG/CONTEXT_TOO_LONG:'上下文过长'`（zh 在位） |
| 48713 | FALSE | 额度族：B 层 `PROVIDER_QUOTA_EXHAUSTED/BUDGET_EXHAUSTED`（zh 在位） |
| 48715 | FALSE | 仓库/路径策略族：B 层 `PATH_NOT_ALLOWED/SENSITIVE_FILE_BLOCKED/SSRF_BLOCKED`（zh 在位） |
| 48716 | FALSE | Hook/策略阻止族：B 层 `EXEC_POLICY_DENIED/CHAT_MODE_TOOL_BLOCKED/DANGEROUS_COMMAND_BLOCKED/RISK_CONFIRM_REQUIRED`（zh 在位）+ 我方 agentHooks 域 |
| file_not_ready | TRUE-GAP | "文件尚未就绪(下载)"：探针 `就绪` 无下载态文案（仅 kanban/voice/liveDetail 场景）；B 层有 FILE_NOT_FOUND/DOWNLOAD_FAILED，无"未就绪"档 |
| file_scan_failed | TRUE-GAP | 文件安全检查域零覆盖：探针 `安全检查\|安全扫描\|病毒`=0 |
| file_content_rejected | TRUE-GAP | 同上，安全检查阻止下载零覆盖 |
| EXTERNAL_MODEL_QUOTA_EXCEEDED | FALSE | 配额族：B 层 `PROVIDER_QUOTA_EXHAUSTED/TRIAL_QUOTA_EXCEEDED`（zh 在位）；我方外部模型面（modelPlaza/n8nModel/openclaw）已有文案 |
| speaking_banned | TRUE-GAP | "暂时无法发言"：探针 `禁言` 仅 admin 敏感词处置标签，无用户侧错误文案位 |
| issue_execution_active | UNDETERMINED | "任务正在执行"互斥位：0 命中；我方 agents 执行域有状态面但未探到互斥错误文案（缺：任务重入错误位证据） |
| invalid_request | FALSE | invalid 族：A 层 `VALIDATION_FAILED:'提交的信息有误…'` + `/invalid\|missing…/` + B 层 `BAD_PARAMS/INVALID_PARAMS/INVALID_ARGUMENT` |
| invalid_query | FALSE | 同 invalid 族（上传请求无效落同一校验文案位） |
| member_capacity_exceeded | TRUE-GAP | "成员已达上限"：0 命中；探针席位仅营销文案；A 层仅 `MEMBER_EXISTS`（已存在≠容量满） |
| forbidden | FALSE | A 层 `FORBIDDEN` 键+值 + 正则 + 403 档（见抽样表） |
| unauthorized | FALSE | A 层 `UNAUTHORIZED` 键+值 + 正则 + 401 档（见抽样表） |
| origin_not_allowed | UNDETERMINED | "当前环境无法上传"：CORS/origin 错误通常不到用户面；缺：我方上传链路 origin 拒绝是否出用户文案的证据 |
| body_too_large | FALSE | 上传过大槽位已覆盖：`chat.attachRejectSize/upload.oversizeSingle/FILE_TOO_LARGE/viewFailure.resourceLimitExceeded.action`（见抽样表；413 HTTP 档另判） |
| not_ready | FALSE | 服务未就绪族：A 层 `SERVICE_UNAVAILABLE:'服务暂不可用,请稍后重试'` + B 层 `SERVICE_UNAVAILABLE`（zh 在位） |
| internal_error | FALSE | A 层 `INTERNAL_ERROR:'服务器开小差了…'` + B 层 `'服务内部处理错误/重试'` + C 层 5xx 兜底 |
| version_conflict | FALSE | 并发更新族：A 层 `OPTIMISTIC_LOCK:'数据已被其他人修改,请刷新后重试'`（key+值）+ B 层 `VERSION_*` 码族 |
| organization_mismatch | UNDETERMINED | 0 命中；我方组织/部门域（adminAuthDept）存在但未探到"组织不一致"错误文案位 |
| project_member_removed | UNDETERMINED | 0 命中；邀请链接重加域（invitations 键族存在）未见该错误文案；缺：链接失效/被移除重加入错误位 |
| organization_unavailable | UNDETERMINED | 0 命中；"无法确认组织信息"落 5xx 兜底可达但无专门位；缺：组织解析错误位证据 |

### 附录 E（46 条）

| key | 判定 | 依据 |
|---|---|---|
| TEAM_PROFILE_BUSY | FALSE | "团队正在更新"忙态≈资源锁：A 层 `LOCKED:'资源已被锁定,请稍后再试'`（key+值） |
| FILE_SCAN_PENDING | TRUE-GAP | 文件安全检查域零覆盖（探针 `安全检查`=0） |
| FILE_SCAN_FAILED | TRUE-GAP | 同上 |
| FILE_SCAN_TIMEOUT | TRUE-GAP | 同上（超时族通用文案可达，但"安检超时"专门位零覆盖） |
| FILE_SCAN_UNSCANNABLE | TRUE-GAP | 同上 |
| FILE_SCAN_BLOCKED | TRUE-GAP | 同上 |
| FILE_GET_FAILED | FALSE | 获取失败族：B 层 `DOWNLOAD_FAILED/NETWORK_ERROR/FETCH_FAILED`（zh 在位） |
| FILE_AUTH_REQUIRED | FALSE | 身份失效族：B 层 `TOKEN_EXPIRED:'登录已过期/重新登录'` + A 层 UNAUTHORIZED/401 档 |
| FILE_NOT_READY | TRUE-GAP | "文件尚未就绪"：0 命中；下载就绪态无文案位（同 file_not_ready 探针） |
| FILE_INTEGRITY_FAILED | TRUE-GAP | "完整性校验失败"：探针 `完整性\|校验失败`=0 |
| FILE_DISK_SPACE | TRUE-GAP | "本地缓存空间不足"：探针 `空间不足` 仅管理面磁盘监控/worktree，无用户错误文案位 |
| FILE_STORAGE_INVALID | TRUE-GAP | "无法写入或访问文件缓存"：0 命中；桌面缓存域零覆盖 |
| FILE_SIZE_LIMIT | FALSE | `chat.attachRejectSize/upload.oversizeSingle/FILE_TOO_LARGE`（key+值在位，见抽样表） |
| FILE_INVALID_ID | FALSE | invalid 族：A 层 VALIDATION_FAILED + B 层 `INVALID_PARAMS/BAD_PARAMS` |
| FILE_IDENTITY_CHANGED | UNDETERMINED | "获取期间身份已切换"：0 命中；身份族兜底可达但"切换"专门位未探到（缺：账号切换中断错误位） |
| AGENT_TOOL_RULE_CONFLICT | UNDETERMINED | 0 命中；我方 rules 域有 `rules.conflictDetectTitle='规则冲突检测'`（特性面非错误文案位）；缺：工具规则冲突错误位 |
| LOGIN_TIMEOUT | FALSE | 超时族：B 层 `TIMEOUT/REQUEST_TIMEOUT/NEEDS_INPUT_TIMEOUT`（zh title/action 在位）+ A 层 `/timeout\|timed out/` |
| AUTH_UNAUTHORIZED | FALSE | A 层 `UNAUTHORIZED` 键+值 `'登录已过期,请重新登录'` + 401 档（与 Qoder 文案"登录已失效"同语义） |
| CHAT_ATTACHMENT_LIMIT_EXCEEDED | FALSE | `chat.attachRejectCount` + `MEDIA_COUNT_EXCEEDED`（见抽样表） |
| CHAT_SESSION_HISTORY_MISSING | TRUE-GAP | "会话历史缺失"：0 命中；探针会话历史仅功能描述文案，无缺失错误位 |
| CHAT_SESSION_OPERATION_FAILED | FALSE | 轮次失败卡机制+位置在位：B 层 `EXECUTION_FAILED/EXECUTION_EXCEPTION:'服务内部处理错误/重试'` + MessageErrorCard + formatSSEError 5xx 分支（未登记码退化兜底，与 Qoder 通用文案同族） |
| QODER_EXECUTION_CONTROL_FAILED | FALSE | 同上（轮次失败兜底位） |
| QODER_EXECUTION_CONTROL_PREPARATION_FAILED | FALSE | 同上 |
| QODER_EXECUTION_SEND_FAILED | FALSE | 同上 + `aiWs.sendFailed='发送失败,请重试'` |
| QODER_EXECUTION_STREAM_ENDED | FALSE | 同上（流终止落轮次失败卡） |
| QODER_EXECUTION_STREAM_FAILED | FALSE | 同上 |
| QODER_EXECUTION_NO_RESPONSE | FALSE | 同上 |
| MCP_CAPABILITY_REVOKED | FALSE | Qoder 可见文案=通用轮次失败 → 轮次失败兜底位在位；我方 mcp/mcpStore/mcpPane 域在 |
| BYOK_EXECUTION_UNSUPPORTED | FALSE | 轮次失败兜底位 + BYOK 产品面文案（configureByokDesc/byokGuide/byokWizard）；精确码 0 命中 |
| BYOK_SERVICE_UNAVAILABLE | FALSE | 轮次失败兜底位 + A 层 `SERVICE_UNAVAILABLE:'服务暂不可用,请稍后重试'` |
| BYOK_PROFILE_NOT_FOUND | FALSE | 轮次失败兜底位 + 密钥配置面文案（llmSettings/quickKey/apiKeysPage） |
| BYOK_SELECTION_KEY_INVALID | FALSE | 轮次失败兜底位 + `quickKey.errApiKeyRequired` 等密钥校验文案 |
| BYOK_SIGNED_OUT | FALSE | 轮次失败兜底位 + A 层 UNAUTHORIZED/登录族 |
| BYOK_ACCOUNT_CHANGED | FALSE | 轮次失败兜底位 + 身份族（TOKEN_EXPIRED） |
| BYOK_SECURE_STORAGE_UNAVAILABLE | FALSE | 轮次失败兜底位（我方无桌面安全存储域，通用位可达） |
| BYOK_CREDENTIAL_UNAVAILABLE | FALSE | 轮次失败兜底位 + 凭证族文案（publish.accounts.credentials/settings.cliImportDesc） |
| BYOK_PROVIDER_UNSUPPORTED | FALSE | 轮次失败兜底位 + B 层 `INVALID_PROVIDER`（zh 在位） |
| BYOK_CATALOG_LOAD_FAILED | FALSE | 轮次失败兜底位 + 加载失败族（FETCH_FAILED/NETWORK_ERROR） |
| BYOK_CATALOG_UNSUPPORTED | FALSE | 轮次失败兜底位 + B 层 `UNSUPPORTED_FORMAT` 族 |
| BYOK_PROVIDER_REQUEST_FAILED | FALSE | 轮次失败兜底位 + B 层 `PROVIDER_ERROR/LLM_FAILED`（zh 在位） |
| BYOK_UNAVAILABLE | FALSE | 轮次失败兜底位 + SERVICE_UNAVAILABLE 族 |
| BYOK_AUTHENTICATION_FAILED | FALSE | 见抽样表 |
| CHAT_SESSION_INPUT_NOT_DELIVERED | FALSE | "消息尚未发送"族：`aiWs.sendFailed='发送失败,请重试'` + `ai.pane.inputNotices.queue.outcome.failed='消息发送失败，请重试'` |
| CHAT_SESSION_RUNTIME_RECONCILE_TIMEOUT | FALSE | 同上 + 超时族（TIMEOUT/REQUEST_TIMEOUT） |
| CHAT_SESSION_RUNTIME_RELEASE_PENDING | FALSE | 同上（发送失败族） |
| CHAT_SESSION_RUNTIME_RELEASE_FAILED | FALSE | 同上（发送失败族） |

---

## 证据文件清单（全部 HEAD 面读取）

- `packages/shared/src/utils/error-messages.ts`（A 层：L16-31 i18n 键映射 / L44-62 中文映射 / L66-78 STATUS_TO_ZH / L85-110 ENGLISH_PATTERNS）
- `packages/shared/src/chat/error-catalog.ts`（B 层 110 码闭集，D71 台账注释自述 attachErrorMeta/formatSSEError 分工）
- `packages/i18n/messages/web/zh-CN.json`（`ai.pane.errorCatalog` 110 组 title+action、`errors.*` 19 键、`chat.attachRejectCount/attachRejectSize`、`upload.oversizeSingle`、`aiWs.sendFailed`）
- `packages/i18n/messages/shared/zh-CN.json`（`viewFailure.resourceLimitExceeded.action`、`forbidden.title`、`earnings.configureByokDesc`）
- `apps/api/src/server.ts`（L143 errorHandler、L213 注册、bodyLimit 10MB）；`apps/api/src/errors/AppError.ts`、`apps/api/src/errors/codes.ts`
- `apps/web/src/components/chat/message-list/MessageErrorCard.tsx`（L52/L82/L112 errorCode 消费）
- `scripts/check-error-code-coverage.mjs`、`scripts/check-error-code-not-text-matching.mjs`（门禁）
- `packages/api-client/src/client.ts`（L1497 attachErrorMeta、L2060 formatSSEError）
- `packages/types/src/failure-code.ts`（**未入库 `??`**，决策码层，413/422 映射"正在飞"）
- 测试：`packages/shared/src/chat/__tests__/error-catalog.test.ts`、`apps/web/src/components/ai/__tests__/turn-status-badge.test.tsx`（五语言 parity）
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
