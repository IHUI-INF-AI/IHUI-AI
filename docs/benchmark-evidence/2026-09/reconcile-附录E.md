<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 逐条对账导出：附录 E

生成：`node docs/benchmark-evidence/2026-09/reconcile.mjs qoder/chat-stream-inventory.md --section "附录 E" --out <本文件>`

四态口径：**L1 逐字 / L2 近义(Jaccard≥0.5) 不算差距**；L3=需人工核（键同名或子串同形，形似不等于等同）；MISS=候选缺失，须逐条定性后才可写进台账。控制测量在运行前已通过，故 MISS 不是匹配器空转的产物。

| 节 | 族 | 竞品键 | 竞品原文 | 判定 | 我方对应 |
| --- | --- | --- | --- | --- | --- |
| 附录 E | tagPill | `TEAM_PROFILE_BUSY` | 团队正在更新 | MISS |  |
| 附录 E | tagPill | `TEAM_ARCHIVED` | 团队已归档 | L2 | teamKnowledge.status.archived (J=0.50) |
| 附录 E | tagPill | `AGENT_CONFIGURATION_ARCHIVED` | Agent 已归档 | L2 | agentCanvas.typeAgent (J=0.57) |
| 附录 E | tagPill | `BUILTIN_AGENT_ARCHIVE_FORBIDDEN` | 无法归档默认 Qoder | L3 | 子串同形:cliImport.sourceQoder |
| 附录 E | tagPill | `FILE_UPLOAD_INCOMPLETE` | 文件上传尚未完成 | L3 | 子串同形:knowledgeRag.upload.modeFile |
| 附录 E | tagPill | `FILE_SCAN_PENDING` | 文件等待安全检查，请稍后下载 | MISS |  |
| 附录 E | tagPill | `FILE_SCAN_PROCESSING` | 文件安全检查中，请稍后下载 | L3 | 子串同形:ai.toolCall.pendingCheckingShort |
| 附录 E | tagPill | `FILE_CONTENT_REJECTED` | 文件未通过安全检查，无法下载 | L3 | 子串同形:admin.edu.answer.programming.notPassed |
| 附录 E | tagPill | `FILE_SCAN_FAILED` | 文件安全检查失败，暂时无法下载 | MISS |  |
| 附录 E | tagPill | `FILE_SCAN_TIMEOUT` | 文件安全检查超时，暂时无法下载 | MISS |  |
| 附录 E | tagPill | `FILE_SCAN_UNSUPPORTED` | 暂不支持对此类文件进行安全检查，无法下载 | L3 | 子串同形:ecosystem.capUnsupported |
| 附录 E | tagPill | `FILE_SCAN_UNSCANNABLE` | 无法完成文件安全检查，无法下载 | MISS |  |
| 附录 E | tagPill | `FILE_GET_FAILED` | 无法获取文件 | MISS |  |
| 附录 E | tagPill | `FILE_AUTH_REQUIRED` | 协作身份已失效 | MISS |  |
| 附录 E | tagPill | `FILE_UNAVAILABLE` | 文件不存在或无法访问 | L3 | 子串同形:admin.saas.stateNotFound |
| 附录 E | tagPill | `FILE_NOT_READY` | 文件尚未就绪 | MISS |  |
| 附录 E | tagPill | `FILE_SCAN_BLOCKED` | 文件检查阻止下载 | MISS |  |
| 附录 E | tagPill | `FILE_RATE_LIMITED` | 文件请求过于频繁 | L2 | ai.pane.errorCatalog.CONCURRENCY_LIMIT_EXCEEDED.title (J=0.71) |
| 附录 E | tagPill | `FILE_DOWNLOAD_FAILED` | 文件暂时下载失败 | L3 | 子串同形:certificate.detail.downloadError |
| 附录 E | tagPill | `FILE_INTEGRITY_FAILED` | 文件完整性校验失败 | MISS |  |
| 附录 E | tagPill | `FILE_DISK_SPACE` | 本地缓存空间不足 | MISS |  |
| 附录 E | tagPill | `FILE_STORAGE_INVALID` | 无法写入或访问文件缓存 | MISS |  |
| 附录 E | tagPill | `FILE_SIZE_LIMIT` | 文件超过支持的大小 | MISS |  |
| 附录 E | tagPill | `FILE_LOCAL_EXECUTION_REQUIRED` | 当前执行环境不支持获取附件 | L3 | 子串同形:ecosystem.capUnsupported |
| 附录 E | tagPill | `FILE_BACKEND_UNAVAILABLE` | 当前环境未提供文件获取能力 | L3 | 子串同形:user.realname.noReason |
| 附录 E | tagPill | `FILE_INVALID_ID` | 文件标识无效 | MISS |  |
| 附录 E | tagPill | `FILE_IDENTITY_CHANGED` | 文件获取期间身份已切换 | MISS |  |
| 附录 E | tagPill | `WORKSPACE_ADDITIONAL_DIRECTORY_UNAVAILABLE` | 无法添加文件夹 | L2 | aigcPublish.fileAddText (J=0.50) |
| 附录 E | tagPill | `AGENT_TOOL_RULE_CONFLICT` | 工具规则冲突 | MISS |  |
| 附录 E | tagPill | `AUTH_NETWORK` | 无法连接登录服务 | MISS |  |
| 附录 E | tagPill | `LOGIN_TIMEOUT` | 登录超时 | MISS |  |
| 附录 E | tagPill | `BROWSER_OPEN_FAILED` | 无法打开浏览器 | L2 | nav.openBrowser (J=0.67) |
| 附录 E | tagPill | `AUTH_SERVER_ERROR` | 服务暂不可用 | L1 | 源码字面量 |
| 附录 E | tagPill | `AUTH_UNAUTHORIZED` | 登录已失效 | MISS |  |
| 附录 E | tagPill | `AUTH_LOGIN_FAILED` | 登录未完成 | L2 | points.tasks.notCompleted (J=0.50) |
| 附录 E | tagPill | `CHAT_ATTACHMENT_LIMIT_EXCEEDED` | 附件数量超限 | MISS |  |
| 附录 E | tagPill | `CHAT_SESSION_WORKSPACE_UNAVAILABLE` | 工作区不可用 | L3 | 子串同形:agent.fieldWorkspace |
| 附录 E | tagPill | `CHAT_SESSION_HISTORY_MISSING` | 会话历史缺失 | MISS |  |
| 附录 E | tagPill | `CHAT_SESSION_OPERATION_FAILED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `QODER_EXECUTION_CONTROL_FAILED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `QODER_EXECUTION_CONTROL_PREPARATION_FAILED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `QODER_EXECUTION_SEND_FAILED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `QODER_EXECUTION_STREAM_ENDED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `QODER_EXECUTION_STREAM_FAILED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `QODER_EXECUTION_NO_RESPONSE` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `MCP_CAPABILITY_REVOKED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_EXECUTION_UNSUPPORTED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_SERVICE_UNAVAILABLE` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_PROFILE_NOT_FOUND` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_SELECTION_KEY_INVALID` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_SIGNED_OUT` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_ACCOUNT_CHANGED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_SECURE_STORAGE_UNAVAILABLE` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_CREDENTIAL_UNAVAILABLE` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_PROVIDER_UNSUPPORTED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_CATALOG_LOAD_FAILED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_CATALOG_UNSUPPORTED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_PROVIDER_REQUEST_FAILED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_UNAVAILABLE` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `BYOK_AUTHENTICATION_FAILED` | 这轮回复失败 | MISS |  |
| 附录 E | tagPill | `CHAT_SESSION_INPUT_NOT_DELIVERED` | 消息尚未发送 | MISS |  |
| 附录 E | tagPill | `CHAT_SESSION_AGENT_RUNTIME_UNAVAILABLE` | Agent 暂不可用 | L2 | agentCanvas.typeAgent (J=0.50) |
| 附录 E | tagPill | `CHAT_SESSION_RUNTIME_RECONCILE_TIMEOUT` | 消息尚未发送 | MISS |  |
| 附录 E | tagPill | `CHAT_SESSION_RUNTIME_RELEASE_PENDING` | 消息尚未发送 | MISS |  |
| 附录 E | tagPill | `CHAT_SESSION_RUNTIME_RELEASE_FAILED` | 消息尚未发送 | MISS |  |
| 附录 E | tagPill | `CHAT_SESSION_INPUT_RESULT_UNKNOWN` | 消息发送状态待确认 | L3 | 子串同形:ai.pane.diffStatus.pending |
| 附录 E | tagPill | `QODER_EXECUTION_NETWORK_UNAVAILABLE` | 无法连接执行服务 | MISS |  |
| 附录 E | tagPill | `AVATAR_UNAVAILABLE` | 头像更新失败 | L2 | common.update.error (J=0.60) |
| 附录 E | tagPill | `AVATAR_LOGIN_REQUIRED` | 头像更新失败 | L2 | common.update.error (J=0.60) |
| 附录 E | tagPill | `AVATAR_IDENTITY_CHANGED` | 头像更新失败 | L2 | common.update.error (J=0.60) |
| 附录 E | tagPill | `AVATAR_BUSY` | 头像更新失败 | L2 | common.update.error (J=0.60) |
| 附录 E | tagPill | `AVATAR_INVALID_INPUT` | 头像更新失败 | L2 | common.update.error (J=0.60) |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
