<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 逐条对账导出：附录 D

生成：`node docs/benchmark-evidence/2026-09/reconcile.mjs qoder/chat-stream-inventory.md --section "附录 D" --out <本文件>`

四态口径：**L1 逐字 / L2 近义(Jaccard≥0.5) 不算差距**；L3=需人工核（键同名或子串同形，形似不等于等同）；MISS=候选缺失，须逐条定性后才可写进台账。控制测量在运行前已通过，故 MISS 不是匹配器空转的产物。

| 节 | 族 | 竞品键 | 竞品原文 | 判定 | 我方对应 |
| --- | --- | --- | --- | --- | --- |
| 附录 D |  | `101` | 请求验证失败 | L2 | certVerify.failed (J=0.60) |
| 附录 D |  | `102` | 请求时间校验失败 | MISS |  |
| 附录 D |  | `103` | 请求重复 | MISS |  |
| 附录 D |  | `104` | 账户暂不可用 | L3 | 子串同形:eduScheduling.timeEntryDialog.unavailable |
| 附录 D |  | `105` | 登录已过期 | L1 | ai.pane.errorCatalog.INTERNAL_AUTH_UNAVAILABLE.title |
| 附录 D |  | `107` | 当前网络无访问权限 | MISS |  |
| 附录 D |  | `108` | 暂无可用许可证 | L3 | 子串同形:about.license |
| 附录 D |  | `109` | 应用已被禁用 | MISS |  |
| 附录 D |  | `110` | 今日额度已用尽 | L1 | 源码字面量 |
| 附录 D |  | `111` | 可用额度已用尽 | L2 | ai.pane.errorCatalog.BUDGET_EXHAUSTED.title (J=0.67) |
| 附录 D |  | `112` | 配额已用尽 | MISS |  |
| 附录 D |  | `113` | 当前请求受到使用限制 | MISS |  |
| 附录 D |  | `114` | 试用账户使用受限 | MISS |  |
| 附录 D |  | `115` | 轻量模型月度额度已用尽 | L3 | 子串同形:ai.pane.errorCatalog.BUDGET_EXHAUSTED.title |
| 附录 D |  | `116` | 配额已用尽 | MISS |  |
| 附录 D |  | `117` | 配额已用尽 | MISS |  |
| 附录 D |  | `118` | 配额已用尽 | MISS |  |
| 附录 D |  | `119` | 今日免费额度已用尽 | L2 | ai.pane.errorCatalog.BUDGET_EXHAUSTED.title (J=0.50) |
| 附录 D |  | `120` | 账户数据已迁移 | L3 | 子串同形:admin.shop.funds.accountCount |
| 附录 D |  | `121` | 组织数据已迁移 | MISS |  |
| 附录 D |  | `122` | 计费组额度已用尽 | L2 | ai.pane.errorCatalog.BUDGET_EXHAUSTED.title (J=0.57) |
| 附录 D |  | `123` | 组织额度暂不可用 | L3 | 子串同形:eduScheduling.timeEntryDialog.unavailable |
| 附录 D |  | `400` | 服务暂时出现异常 | MISS |  |
| 附录 D |  | `406` | 这个话题我暂时聊不了 | MISS |  |
| 附录 D |  | `409` | 需要更新客户端 | L3 | 子串同形:settings.desktopCardTitle |
| 附录 D |  | `413` | 请求内容过大 | MISS |  |
| 附录 D |  | `416` | 当前模型拒绝了本次请求 | L1 | ai.pane.errorCatalog.MODEL_REFUSED.title |
| 附录 D |  | `422` | 回复传输异常 | MISS |  |
| 附录 D |  | `429` | 请求过于频繁 | L1 | ai.pane.errorCatalog.CONCURRENCY_LIMIT_EXCEEDED.title |
| 附录 D |  | `430` | 版本过低 | L1 | ai.pane.errorCatalog.VERSION_TOO_LOW.title |
| 附录 D |  | `500` | 系统发生异常 | MISS |  |
| 附录 D |  | `10408` | 请求超时 | L1 | ai.pane.errorCatalog.DELEGATE_TIMEOUT.title |
| 附录 D |  | `10500` | 服务内部处理错误 | L1 | ai.pane.errorCatalog.ENGINE_ERROR.title |
| 附录 D |  | `10605` | 模型负载较高 | MISS |  |
| 附录 D |  | `47902` | 轮次已达上限 | MISS |  |
| 附录 D |  | `47903` | 输出过长 | MISS |  |
| 附录 D |  | `47904` | 工具调用次数过多 | L3 | 子串同形:adminAiSkills.callCount |
| 附录 D |  | `48203` | 代理连接失败 | L2 | aiWs.connectFailedShort (J=0.60) |
| 附录 D |  | `48712` | 当前模型不支持此能力 | L3 | 子串同形:ecosystem.capUnsupported |
| 附录 D |  | `48713` | 暂无可用额度 | MISS |  |
| 附录 D |  | `48715` | 当前仓库受策略限制 | MISS |  |
| 附录 D |  | `48716` | 调用被 Hook 阻止 | MISS |  |
| 附录 D |  | `80411` | 上下文过长 | L1 | ai.pane.errorCatalog.CONTEXT_TOO_LONG.title |
| 附录 D |  | `80412` | 媒体文件数量超出限制 | L1 | ai.pane.errorCatalog.MEDIA_COUNT_EXCEEDED.title |
| 附录 D |  | `90000` | 当前模型不支持图片 | L3 | 子串同形:ecosystem.capUnsupported |
| 附录 D |  | `100400` | 自定义模型服务异常 | L3 | 子串同形:admin.roles.builtinNo |
| 附录 D |  | `100401` | 自定义模型认证失败 | L3 | 子串同形:admin.roles.builtinNo |
| 附录 D |  | `100403` | 当前套餐不支持自定义模型 | L3 | 子串同形:ecosystem.capUnsupported |
| 附录 D |  | `file_not_ready` | 文件尚未就绪，请稍后下载 | MISS |  |
| 附录 D |  | `file_not_uploaded` | 文件上传尚未完成 | L3 | 子串同形:knowledgeRag.upload.modeFile |
| 附录 D |  | `file_scan_failed` | 无法完成文件安全检查，暂时无法下载 | MISS |  |
| 附录 D |  | `file_content_rejected` | 文件安全检查阻止下载 | MISS |  |
| 附录 D |  | `USER_PHONE_EMPTY` | 无法获取关联手机号 | L3 | 子串同形:admin.members.fieldMobile |
| 附录 D |  | `USER_PHONE_NOT_FOUND` | 无法获取关联手机号 | L3 | 子串同形:admin.members.fieldMobile |
| 附录 D |  | `EXTERNAL_TOKEN_TIMEOUT` | 外部模型服务暂不可用 | L2 | ai.pane.errorCatalog.ENGINE_UNAVAILABLE.title (J=0.55) |
| 附录 D |  | `USER_PHONE_QUERY_FAILED` | 无法获取关联手机号 | L3 | 子串同形:admin.members.fieldMobile |
| 附录 D |  | `EXTERNAL_TOKEN_AUTH_FAILED` | 外部模型服务暂不可用 | L2 | ai.pane.errorCatalog.ENGINE_UNAVAILABLE.title (J=0.55) |
| 附录 D |  | `EXTERNAL_TOKEN_UNAVAILABLE` | 外部模型服务暂不可用 | L2 | ai.pane.errorCatalog.ENGINE_UNAVAILABLE.title (J=0.55) |
| 附录 D |  | `EXTERNAL_TOKEN_RATE_LIMITED` | 外部模型服务暂不可用 | L2 | ai.pane.errorCatalog.ENGINE_UNAVAILABLE.title (J=0.55) |
| 附录 D |  | `EXTERNAL_MODEL_QUOTA_EXCEEDED` | 外部模型额度不足 | MISS |  |
| 附录 D |  | `EXTERNAL_MODEL_PREPARATION_FAILED` | 当前外部模型不可用 | L3 | 子串同形:eduScheduling.timeEntryDialog.unavailable |
| 附录 D |  | `EXTERNAL_MODEL_USER_NOT_AVAILABLE` | 当前外部模型不可用 | L3 | 子串同形:eduScheduling.timeEntryDialog.unavailable |
| 附录 D |  | `speaking_banned` | 暂时无法发言 | MISS |  |
| 附录 D |  | `content_rejected` | 消息未通过文本审核 | L3 | 子串同形:admin.edu.answer.programming.notPassed |
| 附录 D |  | `issue_execution_active` | 任务正在执行 | MISS |  |
| 附录 D |  | `project_archived` | 项目已归档 | L2 | teamKnowledge.status.archived (J=0.50) |
| 附录 D |  | `discussion_archived` | 讨论已归档 | L2 | teamKnowledge.status.archived (J=0.50) |
| 附录 D |  | `moderation_unavailable` | 文本审核暂不可用 | L3 | 子串同形:eduScheduling.timeEntryDialog.unavailable |
| 附录 D |  | `invalid_request` | 请求不符合要求 | MISS |  |
| 附录 D |  | `invalid_query` | 上传请求无效 | MISS |  |
| 附录 D |  | `member_capacity_exceeded` | 成员已达上限 | MISS |  |
| 附录 D |  | `forbidden` | 没有操作权限 | MISS |  |
| 附录 D |  | `unauthorized` | 登录已失效 | MISS |  |
| 附录 D |  | `origin_not_allowed` | 当前环境无法上传 | MISS |  |
| 附录 D |  | `body_too_large` | 上传内容过大 | MISS |  |
| 附录 D |  | `unsupported_media_type` | 不支持该图片格式 | L3 | 子串同形:ecosystem.capUnsupported |
| 附录 D |  | `rate_limited` | 请求过于频繁 | L1 | ai.pane.errorCatalog.CONCURRENCY_LIMIT_EXCEEDED.title |
| 附录 D |  | `storage_unavailable` | 头像上传暂不可用 | L3 | 子串同形:eduScheduling.timeEntryDialog.unavailable |
| 附录 D |  | `not_ready` | 服务暂未就绪 | MISS |  |
| 附录 D |  | `internal_error` | 服务暂时出错 | MISS |  |
| 附录 D |  | `version_conflict` | 资料已被更新 | MISS |  |
| 附录 D |  | `organization_mismatch` | 组织不一致 | MISS |  |
| 附录 D |  | `project_member_removed` | 无法通过链接重新加入项目 | MISS |  |
| 附录 D |  | `client_upgrade_required` | 请升级 Qoder 后加入 | L3 | 子串同形:cliImport.sourceQoder |
| 附录 D |  | `organization_unavailable` | 暂时无法确认组织信息 | MISS |  |
| 附录 D |  | `not_found` | 资料不存在或不可访问 | L3 | 子串同形:admin.saas.stateNotFound |
| 附录 D |  | `file_type_not_supported` | 不支持此文件类型 | L3 | 子串同形:ecosystem.capUnsupported |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
