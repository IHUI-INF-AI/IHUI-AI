<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 我方侧 AI 对话流清单·组2(web 端;第 5-8 类;D204/D160 拆票 2/4)

> 口径:端=web(用户在浏览器对话流里能看到的元素;实现位 `apps/web/src` 为主,含 web 消费的渲染层)。数据源三行:① `docs/benchmark-evidence/2026-09/web-bind2.tsv`(2026-09 快照,271 行 22 组件块,收编行保留其原始行号并尾注「(收编自 web-bind2.tsv)」);② 本仓源码补查,行号一律为 `git grep -n <模式> HEAD` 的 HEAD 面(注意 `packages/i18n/messages/web/zh-CN.json` 工作区有 +51/-4 未提交改动,词典值全部以 HEAD grep 验证);③ 竞品同名节(qoder/trae/codex `chat-stream-inventory.md`)仅用于对齐类别边界。条目格式:`- \`文件:行号\` \`i18n键\` 「中文原文」—— 能力一句话`;组件内置文案标「(组件字面量)」。两态纪律:未取证到 ≠ 不存在 ≠ 不必做,零命中只登记证据不下结论。

## 0 逐类「未取证到」核对(先声明缺口,再给清单)

| 类 | 问题 | 结果 |
| --- | --- | --- |
| 5 | 整轮文件修改撤销(竞品 qoder 有 undo/rewound 卡) | `git grep -n "撤销本轮" HEAD -- apps/web/src` → 0 命中;`git grep -niE "rewound\|undoChanges" HEAD -- apps/web/src` → 0 命中。仅有检查点粒度回滚确认(§5 checkpoint-rollback-confirm);可能能力在检查点内实现、可能入口不在对话流、可能确实未做 |
| 5 | qoder 式 `chatActivity.fileChanges.*` 键族 | `git grep -niE "fileChanges" HEAD -- apps/web/src/components/ai/progress-sections` → 0 命中;我方对应面为 changes-section / inline-diff-card |
| 6 | TodoWrite 类待办工具可见态 | `git grep -n "TodoWrite" HEAD -- apps/web/src` → 0 命中;可能后端未实现该工具、可能无独立 UI |
| 6 | 里程碑 / Spec 审批按钮文案 | `git grep -niE "milestone" HEAD -- apps/web/src/components/ai` → 0 命中;`git grep -niE "spec.*approve" HEAD -- apps/web/src/components/ai/spec-panel` → 仅 useSpecHandlers.ts:404 的 `/api/spec/review/approve` 接口调用 1 命中,无对应中文文案命中 |
| 7 | 团队管理 / 成员可见文案 | `git grep -n "团队" HEAD -- apps/web/src/components/ai` → 0 命中(仅 __tests__ 断言);`git grep -niE "agent.?team\|team.?agent" HEAD -- apps/web/src/components/ai` → 仅 sub-agent-activity-feed.tsx:77 源码注释(Expert Team Canvas),无 UI 文案 |
| 8 | ExitPlanMode 协议词 | `git grep -niE "ExitPlanMode" HEAD -- apps/web/src packages/ui-react packages/shared` → 0 命中;我方计划模式入口为 slashCmd.plan「切换到规划模式(AI 只制定计划,不执行工具)」(zh-CN.json HEAD:11474),无同名协议词 |
| 8 | 规则建议(主动建议建规则)/ acceptEdits 档位词 | `git grep -n "规则建议" HEAD -- apps/web/src packages/ui-react` → 0 命中;`git grep -niE "acceptEdits" HEAD -- apps/web/src` → 0 命中(内部模式映射为 accept-edits,无 UI 文案) |

## 5 文件与 diff / 审阅面

> 类别判据锚:对话流内文件变更卡、diff 预览/逐块接受拒绝、行级评论、会话改动总览、检查点回滚确认、PR 检查、Worktree 工作区;对齐 qoder ## 5(chatActivity.fileChanges + workspace.review)、trae ## 5(代码变更窗口)、codex ## 5(diff 与 Review 面板)。

- `apps/web/src/components/ai/progress-sections/changes-section.tsx:97` `ai.pane.changes.oldContent` 「原内容」—— 变更项展开显示修改前内容 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/changes-section.tsx:100` `ai.pane.changes.copyOldContent` 「复制原内容」—— 复制旧内容 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/changes-section.tsx:113` `ai.pane.changes.newFile` 「新文件」—— 新建文件标记 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/changes-section.tsx:113` `ai.pane.changes.newContent` 「新内容」—— 变更项展开显示修改后内容 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/changes-section.tsx:117` `ai.pane.changes.copyNewContent` 「复制新内容」—— 复制新内容 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/changes-section.tsx:148` `ai.pane.changes.added` 「新增 {n}」—— 新增文件计数 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/changes-section.tsx:149` `ai.pane.changes.modified` 「修改 {n}」—— 修改文件计数 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/changes-section.tsx:156` `ai.pane.changes.title` 「文件变更」—— 对话流文件变更折叠区标题 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/changes-section.tsx:168` `ai.pane.changes.moreItems` 「…还有 {n} 项」—— 变更列表裁尾 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/pr-checks-card.tsx:80` `ai.pane.prChecks.summary.failing` 「检查未通过」—— PR CI 汇总态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/pr-checks-card.tsx:81` `ai.pane.prChecks.summary.pending` 「检查待处理」—— CI 汇总态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/pr-checks-card.tsx:82` `ai.pane.prChecks.summary.successful` 「检查已通过」—— CI 汇总态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/pr-checks-card.tsx:83` `ai.pane.prChecks.summary.none` 「无 CI 检查」—— CI 空态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/pr-checks-card.tsx:86` `ai.pane.prChecks.state.failed` 「测试失败」—— 单检查项状态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/pr-checks-card.tsx:87` `ai.pane.prChecks.state.passed` 「测试已通过」—— 单检查项状态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/pr-checks-card.tsx:88` `ai.pane.prChecks.state.pending` 「待测试」—— 单检查项状态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/pr-checks-card.tsx:94` `ai.pane.prChecks.action.checksFix` 「修复」—— 让 AI 修复未通过检查 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/pr-checks-card.tsx:95` `ai.pane.prChecks.action.checksRemove` 「移除」—— 移除检查项 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/pr-checks-card.tsx:117` `ai.pane.prChecks.countLabel` 「{passed}/{total} 项通过」—— 通过率标签 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:59` `ai.pane.worktree.state.creating` 「创建中」—— Worktree 生命周期态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:60` `ai.pane.worktree.state.ready` 「已创建」—— 生命周期态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:61` `ai.pane.worktree.state.initFailed` 「初始化失败」—— 生命周期态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:62` `ai.pane.worktree.state.timeout` 「超时」—— 生命周期态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:63` `ai.pane.worktree.state.cleaned` 「此任务的 Worktree 已被清理以释放磁盘空间。」—— 生命周期态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:64` `ai.pane.worktree.state.restoring` 「恢复中」—— 生命周期态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:65` `ai.pane.worktree.state.restored` 「已恢复」—— 生命周期态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:66` `ai.pane.worktree.state.restoreFailed` 「无法恢复」—— 生命周期态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:69` `ai.pane.worktree.action.restore` 「恢复 Worktree」—— 恢复动作 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:70` `ai.pane.worktree.action.retryRestore` 「重试恢复」—— 重试动作 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:71` `ai.pane.worktree.action.reclaimDisk` 「回收磁盘空间」—— 磁盘回收动作 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:88` `ai.pane.worktree.title` 「Worktree」—— 工作树卡标题 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/checkpoint-rollback-confirm.tsx:107` `ai.checkpointHistory.rollbackConfirmTitle` 「确认恢复此检查点？」—— 检查点回滚确认弹窗
- `apps/web/src/components/ai/checkpoint-rollback-confirm.tsx:128` `ai.checkpointHistory.rollbackConfirmDesc` 「恢复将把以下文件回退到检查点状态：」—— 回滚影响说明
- `apps/web/src/components/ai/checkpoint-rollback-confirm.tsx:138` `ai.checkpointHistory.rollbackConfirmAdded` 「+{count} 行」—— 逐文件回滚增删统计
- `apps/web/src/components/ai/checkpoint-rollback-confirm.tsx:141` `ai.checkpointHistory.rollbackConfirmDeleted` 「-{count} 行」—— 逐文件回滚增删统计
- `apps/web/src/components/ai/checkpoint-rollback-confirm.tsx:195` `ai.checkpointHistory.rollbackConfirmNoFiles` 「无文件变更（仅恢复对话，共 {count} 条消息）」—— 无文件变更回滚态
- `apps/web/src/components/ai/checkpoint-rollback-confirm.tsx:212` `ai.checkpointHistory.rollbackConfirmConfirm` 「确认恢复」—— 回滚执行按钮
- `apps/web/src/components/ai/diff-hunk-controls.tsx:67` `ai.pane.diffHunk.acceptBlock` 「接受此改动块」—— 逐改动块接受/拒绝审阅
- `apps/web/src/components/ai/diff-hunk-controls.tsx:67` `ai.pane.diffHunk.rejectBlock` 「拒绝此改动块」—— 逐改动块拒绝
- `apps/web/src/components/ai/diff-hunk-controls.tsx:85` `ai.pane.diffHunk.stageHunk` 「暂存」—— 改动块暂存/取消暂存
- `apps/web/src/components/ai/diff-hunk-controls.tsx:168` `ai.pane.diffHunk.applySelected` 「应用所选({count})」—— 批量应用所选改动块
- `apps/web/src/components/ai/diff-hunk-controls.tsx:172` `ai.pane.diffHunk.selectedSummary` 「已选 {accepted}/{total}」—— 所选进度
- `apps/web/src/components/ai/diff-comment-panel.tsx:82` `ai.pane.diffComment.placeholderLine` 「对第 {line} 行提意见…」—— diff 行级评论输入
- `apps/web/src/components/ai/diff-comment-panel.tsx:83` `ai.pane.diffComment.placeholderFile` 「对本次改动提意见…」—— 文件级评论输入
- `apps/web/src/components/ai/diff-comment-panel.tsx:114` `ai.pane.diffComment.fileLevel` 「整个文件」—— 评论作用域标记
- `apps/web/src/components/ai/diff-preview.tsx:63` `ide.diffViewer.oldVersion` 「旧版本」—— 双栏 diff 列头
- `apps/web/src/components/ai/diff-preview.tsx:63` `ide.diffViewer.newVersion` 「新版本」—— 双栏 diff 列头
- `apps/web/src/components/ai/inline-diff-viewer.tsx:96` `ide.diffViewer.foldedLines` 「已折叠 {count} 行未改动内容」—— 未改动行折叠
- `apps/web/src/components/ai/inline-diff-viewer.tsx:684` `ide.diffViewer.conflictTitle` 「需人工选择来源」—— 合并冲突人工裁决区
- `apps/web/src/components/ai/inline-diff-viewer.tsx:680` `ide.diffViewer.useOurs` 「采用当前」—— 冲突取当前版
- `apps/web/src/components/ai/inline-diff-viewer.tsx:681` `ide.diffViewer.useTheirs` 「采用传入」—— 冲突取传入版
- `apps/web/src/components/ai/inline-diff-card.tsx:354` `ai.pane.diffHunk.stageFile` 「全部暂存」—— 整文件暂存/还原
- `apps/web/src/components/ai/inline-diff-card.tsx:513` `ai.pane.diffAppliedHint` 「改动已写入文件系统」—— 应用结果提示
- `apps/web/src/components/ai/inline-diff-card.tsx:528` (组件字面量) 「Accept」—— 应用按钮英文回退字面量
- `apps/web/src/components/ai/session-diff-dialog.tsx:37` `chat.sessionDiff.title` 「会话改动总览」—— /diff 会话级改动总览弹窗
- `apps/web/src/components/ai/session-diff-dialog.tsx:73` `chat.sessionDiff.changedTimes` 「{count}{plus} 次」—— 文件被改次数
- `apps/web/src/components/ai/session-diff-dialog.tsx:89` `chat.sessionDiff.before` 「变更前」—— 会话 diff 前列
- `apps/web/src/components/ai/session-diff-dialog.tsx:98` `chat.sessionDiff.after` 「变更后」—— 会话 diff 后列

### 未取证到(第 5 类)
- 整轮文件修改撤销卡(undo/rewound):`git grep -n "撤销本轮" HEAD -- apps/web/src` → 0 命中;`git grep -niE "rewound|undoChanges" HEAD -- apps/web/src` → 0 命中;可能能力折叠进检查点回滚、可能入口在 IDE 侧工作区面板、可能确实未做,不下「没有」结论
- `chatActivity.fileChanges.*` 同形键族:`git grep -niE "fileChanges" HEAD -- apps/web/src/components/ai/progress-sections` → 0 命中;可能命名不同(changes.*)、可能无悬停快捷 diff 预览

## 6 计划与待办(To-do / Spec / Goal)

> 类别判据锚:执行计划步骤卡(plan-steps)、下一步推荐(next-steps)、Goal 卡(/goal 工作流)、任务清单面板、Spec 模式面板;对齐 qoder ## 6、trae ## 6(任务清单与 Plan/Spec/Goal 三工作流)、codex ## 6(计划与任务)。

- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:111` `taskStatus.stepCount` 「{n} 个步骤」—— 计划步骤计数 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:113` `chat.plan.summaryErrorCount` 「错误 {count}」—— 步骤错误计数 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:117` `chat.plan.summaryAllDone` 「全部完成」—— 计划完成态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:127` `chat.plan.title` 「执行计划」—— 计划卡标题 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:138` `taskStatus.workedFor` 「用时 {time}」—— 步骤耗时 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:155` `chat.plan.ariaLabel` 「执行计划步骤」—— 无障碍标签 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:252` `chat.plan.progressPercent` 「{percent}%」—— 进度百分比 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:293` `chat.plan.stepThinking` 「思考」—— 步骤思考态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:346` `chat.plan.reasoningCopied` 「推理过程已复制」—— 复制反馈 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:352` `chat.plan.reasoningCopyFailed` 「复制失败」—— 复制失败态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:382` `chat.plan.copyReasoning` 「复制推理过程」—— 复制步骤推理 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:401` `chat.copied` 「已复制」—— 复制成功态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/goal-card.tsx:114` `goalCard.emptyHint` 「在输入框输入 /goal <目标> 设定,或由 AI 自动推进」—— Goal 工作流引导
- `apps/web/src/components/ai/goal-card.tsx:133` `goalCard.continuePrompt` 「继续推进目标「{goal}」（当前进度 {progress}%{blockers}）。若已可继续,直接继续执行;若仍受阻,请说明原因。」—— 一键续跑生成提示词
- `apps/web/src/components/ai/goal-card.tsx:139` `goalCard.continueQueued` 「续跑指令已加入输入框,发送后自动执行」—— 续跑反馈
- `apps/web/src/components/ai/goal-card.tsx:180` `goalCard.editAriaLabel` 「编辑目标」—— 目标内联编辑
- `apps/web/src/components/ai/goal-card.tsx:204` `goalCard.editSave` 「保存」—— 编辑保存
- `apps/web/src/components/ai/goal-card.tsx:256` `goalCard.achievedInTime` 「已在 {totalTime} 内达成目标」—— 达成态
- `apps/web/src/components/ai/goal-card.tsx:299` `goalCard.resetProgress` 「归零」—— 进度手调(同线 fullProgress「置满」)
- `apps/web/src/components/ai/goal-card.tsx:307` `goalCard.blockers` 「阻塞原因」—— 阻塞清单区
- `apps/web/src/components/ai/goal-card.tsx:308` `goalCard.noBlockers` 「无阻塞」—— 空态
- `apps/web/src/components/ai/goal-card.tsx:339` `goalCard.blockerPlaceholder` 「输入阻塞原因…」—— 阻塞项输入
- `apps/web/src/components/ai/goal-card.tsx:373` `goalCard.resume` 「继续」—— 目标继续按钮
- `apps/web/src/components/ai/goal-card.tsx:400` `goalCard.cleared` 「目标已清除」—— 清除目标反馈
- `apps/web/src/components/ai/progress-sections/next-steps-card.tsx:117` `ai.pane.nextStepsContinue` 「继续执行剩余 {n} 步」—— 流结束后下一步推荐(键缺省回退组件内同文案)
- `apps/web/src/components/ai/progress-sections/next-steps-card.tsx:129` `ai.pane.nextStepsRunTests` 「运行测试验证变更」—— 推荐动作
- `apps/web/src/components/ai/progress-sections/next-steps-card.tsx:134` `ai.pane.nextStepsCommit` 「提交代码变更」—— 推荐动作
- `apps/web/src/components/ai/progress-sections/next-steps-card.tsx:143` `ai.pane.nextStepsSummarize` 「总结本次对话进展」—— 兜底推荐
- `apps/web/src/components/ai/progress-sections/next-steps-card.tsx:162` `ai.pane.nextStepsTitle` 「下一步推荐」—— 推荐卡标题
- `apps/web/src/components/ai/progress-sections/next-steps-card.tsx:163` `ai.pane.nextStepsDismiss` 「关闭」—— 推荐卡关闭
- `apps/web/src/components/ai/task-list-panel.tsx:48` (组件字面量) 「任务清单」—— 任务清单面板标题
- `apps/web/src/components/ai/task-list-panel.tsx:52` (组件字面量) 「暂无任务」—— 任务清单空态
- `apps/web/src/components/ai/spec-panel/components.tsx:19` (组件字面量) 「范围」—— Spec 生成范围选择
- `apps/web/src/components/ai/spec-panel/components.tsx:77` (组件字面量) 「生成」—— Spec 生成按钮(加载态「生成中」)
- `apps/web/src/components/ai/spec-panel/components.tsx:128` (组件字面量) 「对比当前」—— Spec 与当前代码 diff
- `apps/web/src/components/ai/spec-panel/components.tsx:138` (组件字面量) 「导出」—— 导出 spec markdown

### 未取证到(第 6 类)
- TodoWrite 类待办工具可见态:`git grep -n "TodoWrite" HEAD -- apps/web/src` → 0 命中;可能后端未实现该工具、可能待办以 plan-steps 形态呈现、可能确实未做
- 里程碑(milestone)元素:`git grep -niE "milestone" HEAD -- apps/web/src/components/ai` → 0 命中;可能概念不存在、可能用「阶段(phase*)」表达(见 §8 planReview.phase*)

## 7 子代理 / 专家并行 / 团队

> 类别判据锚:Subagent 派单卡、智能体动作卡、多智能体动作卡、专家泳道画布、Subagent 拓扑、派单弹窗、后台任务/Agent 任务面板、侧边任务、交接单、编排枢纽;对齐 qoder ## 7、trae ## 7(Subagent 与 Agent 团队)、codex ## 7(子代理与并行)。

- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:130` `ai.pane.subagent.toolCallsTitle` 「{n} 次工具调用」—— 子代理卡工具调用标题 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:132` `ai.pane.subagent.toolCallsCount` 「{n}次」—— 工具调用计数 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:153` `ai.pane.subagent.state` 「状态:」—— 子代理状态标签 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:160` `ai.pane.subagent.role` 「角色:」—— 子代理角色 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:172` `ai.pane.subagent.startedAt` 「启动:」—— 启动时间 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:180` `ai.pane.subagent.endedAt` 「结束:」—— 结束时间 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:187` `ai.pane.subagent.duration` 「耗时:」—— 耗时 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:197` `ai.pane.subagent.copyThreadId` 「复制 threadId」—— 复制线程 ID (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:206` `ai.pane.subagent.toolsCount` 「工具调用({n})」—— 工具折叠组 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:244` `ai.pane.subagent.active` 「{n} 活跃」—— 派单汇总态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:245` `ai.pane.subagent.done` 「{n} 完成」—— 派单汇总态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:246` `ai.pane.subagent.failed` 「{n} 失败」—— 派单汇总态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:254` `ai.pane.subagent.title` 「Subagent 派单」—— 派单区标题 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:69` `ai.pane.agentActions.action.spawn.label` 「创建」—— 智能体动作 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:70` `ai.pane.agentActions.action.resume.label` 「恢复」—— 动作 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:71` `ai.pane.agentActions.action.sendInput.label` 「发送输入」—— 动作 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:72` `ai.pane.agentActions.action.interrupt.label` 「中断」—— 动作 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:73` `ai.pane.agentActions.action.close.label` 「关闭」—— 动作 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:74` `ai.pane.agentActions.action.list.label` 「列出」—— 动作 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:112` `ai.pane.agentActions.state.running` 「运行中」—— 智能体状态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:113` `ai.pane.agentActions.state.completed` 「已完成」—— 状态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:114` `ai.pane.agentActions.state.errored` 「出错」—— 状态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:115` `ai.pane.agentActions.state.interrupted` 「已中断」—— 状态 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:144` `ai.pane.agentActions.header.count` 「{count, plural, one {1 个智能体} other {# 个智能体}}」—— 卡头计数 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:167` `ai.pane.agentActions.meta.prompt` 「输入：{prompt}」—— 动作入参回显 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/multi-agent-action-card.tsx:58` `multiAgentAction.action.spawn.label` 「创建」—— 多智能体动作 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/multi-agent-action-card.tsx:135` `multiAgentAction.header.count` 「{count, plural, one {# 个智能体} other {# 个智能体}}」—— 卡头计数 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/overview-section.tsx:128` `ai.pane.overview.subagents` 「子代理」—— 任务总览子代理计数 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/dispatch-subagent-dialog.tsx:222` `dispatchDialog.dispatchAction` 「派发」—— 手动派单弹窗主按钮
- `apps/web/src/components/ai/dispatch-subagent-dialog.tsx:225` `dispatchDialog.autoPlan` 「智能规划」—— LLM 自动规划派单
- `apps/web/src/components/ai/dispatch-subagent-dialog.tsx:228` `dispatchDialog.customRolesTab` 「自定义角色」—— 自定义角色页签
- `apps/web/src/components/ai/dispatch-subagent-dialog.tsx:231` `dispatchDialog.evolutionTab` 「Agent 演化」—— 角色演化页签
- `apps/web/src/components/ai/dispatch-subagent-dialog.tsx:536` `dispatchDialog.dagTitle` 「DAG 依赖图」—— 派单 DAG 编辑器
- `apps/web/src/components/ai/dispatch-subagent-dialog.tsx:840` `dispatchDialog.recommendedAgents` 「推荐 Agent 组合」—— 规划结果组合
- `apps/web/src/components/ai/background-agents-panel.tsx:179` `ai.backgroundAgents.runningCount` 「{count} 运行中」—— 后台任务面板运行数
- `apps/web/src/components/ai/background-agents-panel.tsx:185` `ai.backgroundAgents.enableNotifications` 「开启通知」—— 后台任务通知开关
- `apps/web/src/components/ai/background-agents-panel.tsx:206` `ai.backgroundAgents.emptyHint` 「使用 /agents 或 API 启动后台任务」—— 空态引导
- `apps/web/src/components/ai/background-agents-panel.tsx:320` `ai.backgroundAgents.viewResult` 「查看结果」—— 查看后台任务结果
- `apps/web/src/components/ai/agent-tasks-panel.tsx:119` `agentTasks.ephemeralBadge` 「内存态(临时)」—— Agent 任务面板临时标记
- `apps/web/src/components/ai/agent-tasks-panel.tsx:144` `agentTasks.iterations` 「已迭代 {count} 轮」—— 迭代轮数
- `apps/web/src/components/ai/agent-tasks-panel.tsx:156` `agentTasks.injectPlaceholder` 「中途插话:补充指令/纠偏…」—— 运行中插话输入
- `apps/web/src/components/ai/sub-agent-activity-feed.tsx:250` `ai.subAgentFeed.coordinated` 「已协调 {count} 个子智能体完成」—— 专家泳道画布汇总态
- `apps/web/src/components/ai/sub-agent-activity-feed.tsx:251` `ai.subAgentFeed.working` 「{count} 个子智能体协作中」—— 协作中态
- `apps/web/src/components/ai/sub-agent-activity-feed.tsx:280` `ai.subAgentFeed.viewFeed` 「列表视图」—— 画布/列表视图切换
- `apps/web/src/components/ai/swarm-topology-view.tsx:326` `swarmTopology.emptyState` 「暂无活跃 Subagent 拓扑(派发后此处显示节点)」—— 拓扑视图空态
- `apps/web/src/components/ai/swarm-topology-view.tsx:566` `swarmTopology.arbiterBadge` 「仲裁节点」—— 仲裁节点标记
- `apps/web/src/components/ai/swarm-topology-view.tsx:571` `swarmTopology.dagBadge` 「DAG 节点」—— DAG 节点标记
- `apps/web/src/components/ai/swarm-topology-view.tsx:809` `swarmTopology.collaborationTitle` 「协作消息流({count})」—— 节点协作消息流
- `apps/web/src/components/ai/swarm-topology-view.tsx:866` `swarmTopology.relationsTitle` 「关系图」—— 协作关系图
- `apps/web/src/components/ai/side-task-lifecycle-card.tsx:85` `ai.pane.sideTask.title` 「侧边任务」—— /side 侧问任务生命周期卡
- `apps/web/src/components/ai/side-task-lifecycle-card.tsx:144` `ai.pane.sideTask.action.close` 「关闭任务」—— 关闭侧边任务
- `apps/web/src/components/ai/handoff-package-card.tsx:101` `ai.pane.handoff.title` 「失败诊断交接单」—— 失败诊断交接卡
- `apps/web/src/components/ai/handoff-package-card.tsx:110` `ai.pane.handoff.copy` 「复制交接单」—— 复制交接内容
- `apps/web/src/components/ai/orchestration-hub-panel.tsx:342` `orchestration.events.events24h` 「24h 事件」—— 编排枢纽事件计数
- `apps/web/src/components/ai/orchestration-hub-panel.tsx:403` `orchestration.events.noEvents` 「暂无事件」—— 事件空态
- `apps/web/src/components/ai/orchestration-hub-panel.tsx:908` `orchestration.telemetry.pillarHealth` 「支柱健康」—— 编排支柱健康遥测

### 未取证到(第 7 类)
- 团队管理/成员可见文案:`git grep -n "团队" HEAD -- apps/web/src/components/ai` → 0 命中(仅测试文件断言);可能团队面在子代理页(components/subagents/*)而非对话流、可能确实未做
- 专家 UI 字面量:`git grep -niE "expert.?panel|专家" HEAD -- apps/web/src/components/ai` → 仅 sub-agent-activity-feed.tsx:77-80/97/310 源码注释命中,无 UI 文案;专家身份以角色名(researcher/coder/reviewer 等)呈现而非「专家」词面

## 8 审批与权限(含高危操作 / 规则建议 / ExitPlanMode)

> 类别判据锚:工具审批弹窗(三/四档+决策事实+沙箱环境)、权限模式切换(请求批准/替我审批/完全访问)、完全访问首启确认、工具执行确认、执行计划阶段门(规划模式对应面)、命令放行规则面板、/permission 三档命令;对齐 qoder ## 8(含 ExitPlanMode)、trae ## 8(权限与沙箱)、codex ## 8(审批与沙箱)。

- `apps/web/src/components/ai/progress-sections/subagent-section.tsx:165` `ai.pane.subagent.pendingApproval` 「待审批」—— 子代理卡待审批徽标 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/tool-approval-dialog.tsx:538` `editor.toolApproval.title` 「工具审批」—— 高危工具审批弹窗标题
- `apps/web/src/components/ai/tool-approval-dialog.tsx:541` `editor.toolApproval.description` 「AI 请求执行以下高危操作,请确认是否允许」—— 审批导语
- `apps/web/src/components/ai/tool-approval-dialog.tsx:556` `editor.toolApproval.reject` 「拒绝」—— 拒绝按钮
- `apps/web/src/components/ai/tool-approval-dialog.tsx:574` `editor.toolApproval.approve` 「批准」—— 批准按钮
- `apps/web/src/components/ai/tool-approval-dialog.tsx:588` `editor.toolApproval.argsPreview` 「参数预览」—— 工具参数预览区
- `apps/web/src/components/ai/tool-approval-dialog.tsx:646` `editor.toolApproval.decisionReversible` 「可回退:该会话已有 {count} 个检查点,决策后可回退恢复」—— 决策事实·可逆性
- `apps/web/src/components/ai/tool-approval-dialog.tsx:647` `editor.toolApproval.decisionIrreversible` 「不可回退:该会话没有可回退的检查点,决策后无法用回退撤销」—— 决策事实·不可逆
- `apps/web/src/components/ai/tool-approval-dialog.tsx:669` `editor.toolApproval.envLabel` 「执行环境」—— 逐请求环境事实区
- `apps/web/src/components/ai/tool-approval-dialog.tsx:676` `editor.toolApproval.envUnknown` 「未上报(不据档位推断,请拒绝并要求重试)」—— 环境未上报两态
- `apps/web/src/components/ai/tool-approval-dialog.tsx:690` `editor.toolApproval.envInSandbox` 「在沙箱中运行」—— 沙箱事实
- `apps/web/src/components/ai/tool-approval-dialog.tsx:706` `editor.toolApproval.envNetworkOff` 「本次不开放网络」—— 网络事实
- `apps/web/src/components/ai/tool-approval-dialog.tsx:735` `editor.toolApproval.envNetworkBlocked` 「被拦截的网络目标」—— 拦截目标列表
- `apps/web/src/components/ai/tool-approval-dialog.tsx:801` `editor.toolApproval.grantRuleToggle` 「批准并把这类命令加入放行」—— D158 审批第四档(规则建议落地点)
- `apps/web/src/components/ai/tool-approval-dialog.tsx:804` `editor.toolApproval.grantRuleDesc` 「以命令前缀「{prefix}…」为作用域生成放行规则,90 天后自动过期,可随时在放行规则面板撤销」—— 放行规则说明
- `apps/web/src/components/ai/tool-approval-dialog.tsx:517` `editor.toolApproval.grantRuleConfirmTitle` 「确认放行高危命令?」—— 高危命令二次确认门
- `apps/web/src/components/ai/tool-approval-dialog.tsx:518` `editor.toolApproval.grantRuleConfirmContent` 「命令「{prefix}…」命中高危操作。放行后 90 天内同类命令将不再询问,使用风险需自行承担。」—— 二次确认正文
- `apps/web/src/components/ai/tool-approval-dialog.tsx:829` `editor.toolApproval.pendingCount` 「还有 {count} 个待审批」—— 审批队列提示
- `apps/web/src/components/ai/permission-mode-popover.tsx:390` `chat.permission.buttonLabel` 「权限模式」—— 三档模式切换入口
- `apps/web/src/components/ai/permission-mode-popover.tsx:458` `chat.permission.popoverTitle` 「应如何批准 AI 操作?」—— 模式选择弹层标题
- `apps/web/src/components/ai/permission-mode-popover.tsx:562` `chat.permission.highRisk` 「高风险」—— 完全访问档风险标
- `apps/web/src/components/ai/permission-mode-popover.tsx:597` `chat.permission.quickFullAccess` 「完全访问」—— 快捷完全访问
- `apps/web/src/components/ai/permission-mode-popover.tsx:624` `chat.permission.setAsDefault` 「设为全局默认」—— 默认档设置
- `apps/web/src/components/ai/permission-mode-popover.tsx:262` `chat.permission.switchedToFull` 「已切换到完全访问」—— 切档反馈(可撤销 toast)
- `apps/web/src/components/ai/permission-mode-popover.tsx:281` `chat.permission.switchedToAuto` 「已切换到替我审批」—— 切档反馈
- `apps/web/src/components/ai/full-access-confirm-dialog.tsx:118` `chat.permission.firstTimeConfirmTitle` 「启用完全访问模式?」—— 完全访问首启确认
- `apps/web/src/components/ai/full-access-confirm-dialog.tsx:121` `chat.permission.firstTimeConfirmDesc` 「完全访问模式允许 AI 在未经确认的情况下执行任何操作,包括修改/删除文件、执行任意命令、访问网络。仅在完全信任的私有项目中使用。」—— 首启确认正文
- `apps/web/src/components/ai/full-access-confirm-dialog.tsx:143` `chat.permission.firstTimeConfirmProceed` 「继续启用」—— 确认启用
- `apps/web/src/components/ai/permission-confirm-dialog.tsx:92` `ai.permissionConfirm.title` 「工具执行确认」—— Agent 工具执行确认弹窗
- `apps/web/src/components/ai/permission-confirm-dialog.tsx:93` `ai.permissionConfirm.description` 「Agent 请求执行以下工具,请确认是否允许」—— 确认导语
- `apps/web/src/components/ai/permission-confirm-dialog.tsx:180` `ai.permissionConfirm.allowAllSession` 「本次会话全部允许(后续不再弹窗)」—— 会话级放行
- `apps/web/src/components/ai/permission-confirm-dialog.tsx:188` `ai.permissionConfirm.deny` 「拒绝」—— 拒绝按钮
- `apps/web/src/components/ai/permission-confirm-dialog.tsx:197` `ai.permissionConfirm.allow` 「允许」—— 允许按钮
- `apps/web/src/components/ai/plan-review-panel.tsx:146` `planReview.title` 「执行计划」—— 计划评审面板(规划模式阶段门)
- `apps/web/src/components/ai/plan-review-panel.tsx:197` `planReview.empty` 「暂无执行计划，运行 Agent 后在此查看」—— 空态
- `apps/web/src/components/ai/plan-review-panel.tsx:98` `planReview.submitReview` 「提交评审」—— 草稿→评审阶段动作
- `apps/web/src/components/ai/plan-review-panel.tsx:104` `planReview.startExecute` 「开始执行」—— 批准→执行阶段动作
- `apps/web/src/components/ai/plan-review-panel.tsx:158` `planReview.viewPullRequest` 「查看拉取请求」—— 计划关联 PR
- `apps/web/src/components/ai/approved-rules-panel.tsx:126` `aiApprovedRules.title` 「命令放行规则」—— 放行规则面板(审批沉淀规则)
- `apps/web/src/components/ai/approved-rules-panel.tsx:143` `aiApprovedRules.description` 「审批时生成的命令前缀与网络目标放行规则;到期自动过期,可随时撤销」—— 面板说明
- `apps/web/src/components/ai/approved-rules-panel.tsx:159` `aiApprovedRules.empty` 「暂无放行规则」—— 空态
- `apps/web/src/components/ai/approved-rules-panel.tsx:72` `aiApprovedRules.revokeConfirmTitle` 「撤销放行规则?」—— 撤销确认
- `apps/web/src/hooks/use-chat/slash-commands.ts:267` `permissionLabelAsk` 「请求批准」—— /permission 三档命令标签
- `apps/web/src/hooks/use-chat/slash-commands.ts:269` `permissionLabelAuto` 「自动审批」—— 三档命令标签
- `apps/web/src/hooks/use-chat/slash-commands.ts:270` `permissionLabelFull` 「完全访问」—— 三档命令标签
- `apps/web/src/components/ai/permission-history-panel.tsx:351` `chat.permission.historyTitle` 「权限模式历史」—— 模式切换历史审计
- `apps/web/src/components/ai/permission-mode-info-modal.tsx:50` `chat.permission.infoModalTitle` 「权限模式详情」—— 高风险模式说明弹窗

### 未取证到(第 8 类)
- ExitPlanMode 协议词与同名卡:`git grep -niE "ExitPlanMode" HEAD -- apps/web/src packages/ui-react packages/shared` → 0 命中;可能以 slashCmd.plan「切换到规划模式(AI 只制定计划,不执行工具)」+ plan-review 阶段门承担同职能、可能确实未做同名协议
- 规则建议(主动建议建规则)文案:`git grep -n "规则建议" HEAD -- apps/web/src packages/ui-react` → 0 命中;仅审批第四档「批准并把这类命令加入放行」为审批内建规则入口,无独立的「建议你为此创建规则」卡
- acceptEdits 档位词:`git grep -niE "acceptEdits" HEAD -- apps/web/src` → 0 命中;内部映射 auto→accept-edits(slash-commands.ts:257),UI 不出该词面

## 计数与自检

| 类 | 条目数 | 其中收编自 web-bind2.tsv | 其中源码补查(HEAD) | 未取证到条数 |
| --- | --- | --- | --- | --- |
| 5 文件与 diff / 审阅面 | 58 | 31 | 27 | 2 |
| 6 计划与待办 | 36 | 12 | 24 | 2 |
| 7 子代理 / 专家并行 / 团队 | 56 | 28 | 28 | 2 |
| 8 审批与权限 | 47 | 1 | 46 | 3 |
| 合计 | 197 | 72 | 125 | 9 |

| 自检项 | 结果 |
| --- | --- |
| 是否 ≤200 条 | 是(197,未取证到行不计入条目数) |
| 四类是否齐全且每类 ≥1 条真实条目 | 是(58/36/56/47,均含 file:line 锚) |
| 检索过的 git grep 模式清单(HEAD 面) | `\bt\('`、`useTranslations(`、组件中文字面量 `-P [\x{4e00}-\x{9fff}]`、词典键值 alternation(toolApproval/chat.permission/permissionConfirm/planReview/aiApprovedRules/diffHunk/diffComment/diffViewer/goalCard/sessionDiff/checkpointHistory/dispatchDialog/backgroundAgents/agentTasks/subAgentFeed/sideTask/handoff/swarmTopology/orchestration/taskStatus/nextSteps)、探针 `撤销本轮`、`rewound\|undoChanges`、`fileChanges`、`TodoWrite`、`milestone`、`spec.*approve`、`团队`、`agent.?team`、`expert.?panel\|专家`、`ExitPlanMode`、`规则建议`、`acceptEdits`、`permissionLabel`、`slashCmd` |
| 特别说明 | `packages/i18n/messages/web/zh-CN.json` 工作区有未提交改动(+51/-4),全部词典值已用 HEAD git grep 逐条验证;slash-commands.ts / goal-card.tsx / tool-approval-dialog.tsx 等组件经 `git diff --stat HEAD` 确认无工作区漂移 |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
