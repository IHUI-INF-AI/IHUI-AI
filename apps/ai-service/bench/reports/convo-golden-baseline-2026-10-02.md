<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-Bench v0 报告

- 任务总数: 30
- 通过: 30
- 通过率: 100.0%

| 任务ID                        | 类别             | 夹具                                  | 迭代 | 耗时(ms) | 检查 | 结果 |
| ----------------------------- | ---------------- | ------------------------------------- | ---- | -------- | ---- | ---- |
| convo-qa-config-recall        | convo-qa         | fixture_convo-qa-config-recall        | 0    | 0.0      | 3/3  | PASS |
| convo-qa-version-matrix       | convo-qa         | fixture_convo-qa-version-matrix       | 0    | 0.0      | 3/3  | PASS |
| convo-qa-error-code           | convo-qa         | fixture_convo-qa-error-code           | 0    | 0.0      | 3/3  | PASS |
| convo-qa-arch-decision        | convo-qa         | fixture_convo-qa-arch-decision        | 0    | 0.0      | 3/3  | PASS |
| convo-qa-migration-order      | convo-qa         | fixture_convo-qa-migration-order      | 0    | 0.0      | 3/3  | PASS |
| convo-qa-quota-policy         | convo-qa         | fixture_convo-qa-quota-policy         | 0    | 0.0      | 3/3  | PASS |
| convo-tools-report-gen        | convo-tools      | fixture_convo-tools-report-gen        | 0    | 0.0      | 3/3  | PASS |
| convo-tools-refactor-split    | convo-tools      | fixture_convo-tools-refactor-split    | 0    | 0.0      | 3/3  | PASS |
| convo-tools-env-audit         | convo-tools      | fixture_convo-tools-env-audit         | 0    | 0.0      | 3/3  | PASS |
| convo-tools-test-scaffold     | convo-tools      | fixture_convo-tools-test-scaffold     | 0    | 0.0      | 3/3  | PASS |
| convo-tools-changelog-merge   | convo-tools      | fixture_convo-tools-changelog-merge   | 0    | 0.0      | 4/4  | PASS |
| convo-tools-deps-extract      | convo-tools      | fixture_convo-tools-deps-extract      | 0    | 0.0      | 3/3  | PASS |
| convo-long-plan-execute       | convo-longtask   | fixture_convo-long-plan-execute       | 0    | 0.0      | 2/2  | PASS |
| convo-long-multi-round-calc   | convo-longtask   | fixture_convo-long-multi-round-calc   | 0    | 0.0      | 3/3  | PASS |
| convo-long-state-machine      | convo-longtask   | fixture_convo-long-state-machine      | 0    | 0.0      | 3/3  | PASS |
| convo-long-doc-chain          | convo-longtask   | fixture_convo-long-doc-chain          | 0    | 0.0      | 2/2  | PASS |
| convo-long-iterative-refine   | convo-longtask   | fixture_convo-long-iterative-refine   | 0    | 0.0      | 2/2  | PASS |
| convo-long-checkpoint-restore | convo-longtask   | fixture_convo-long-checkpoint-restore | 0    | 0.0      | 3/3  | PASS |
| convo-mm-alt-catalog          | convo-multimodal | fixture_convo-mm-alt-catalog          | 0    | 0.0      | 4/4  | PASS |
| convo-mm-dim-check            | convo-multimodal | fixture_convo-mm-dim-check            | 0    | 0.0      | 4/4  | PASS |
| convo-mm-format-convert       | convo-multimodal | fixture_convo-mm-format-convert       | 0    | 0.0      | 3/3  | PASS |
| convo-mm-caption-fix          | convo-multimodal | fixture_convo-mm-caption-fix          | 0    | 0.0      | 3/3  | PASS |
| convo-mm-palette-extract      | convo-multimodal | fixture_convo-mm-palette-extract      | 0    | 0.0      | 3/3  | PASS |
| convo-mm-audio-index          | convo-multimodal | fixture_convo-mm-audio-index          | 0    | 0.0      | 3/3  | PASS |
| convo-review-code-smells      | convo-review     | fixture_convo-review-code-smells      | 0    | 0.0      | 3/3  | PASS |
| convo-review-config-drift     | convo-review     | fixture_convo-review-config-drift     | 0    | 0.0      | 3/3  | PASS |
| convo-review-log-triage       | convo-review     | fixture_convo-review-log-triage       | 0    | 0.0      | 3/3  | PASS |
| convo-review-security-scan    | convo-review     | fixture_convo-review-security-scan    | 0    | 0.0      | 3/3  | PASS |
| convo-review-api-contract     | convo-review     | fixture_convo-review-api-contract     | 0    | 0.0      | 2/2  | PASS |
| convo-review-dead-code        | convo-review     | fixture_convo-review-dead-code        | 0    | 0.0      | 4/4  | PASS |

## 逐任务检查明细

### convo-qa-config-recall — 问答:配置键与端口跨文档回答

- 类别: convo-qa / 夹具: fixture_convo-qa-config-recall
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '答: 数据库连接池上限 47'
- [OK] `file_contains`: 包含子串: '答: Redis 端口 8811'
- [OK] `file_contains`: 包含子串: 'docs.md'

### convo-qa-version-matrix — 问答:版本兼容矩阵要点

- 类别: convo-qa / 夹具: fixture_convo-qa-version-matrix
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '结论: 最高 Node 版本 22'
- [OK] `file_contains`: 包含子串: '结论: 最低 Python 版本 3.10'
- [OK] `file_contains`: 包含子串: '结论: 已废弃的传输通道是 WebSocket'

### convo-qa-error-code — 问答:错误码语义查询

- 类别: convo-qa / 夹具: fixture_convo-qa-error-code
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '错误码 4021:会话已失效'
- [OK] `file_contains`: 包含子串: '错误码 5003:修复建议是重启 ai-service'
- [OK] `file_contains`: 包含子串: '错误码 4290'

### convo-qa-arch-decision — 问答:架构决策原因复盘

- 类别: convo-qa / 夹具: fixture_convo-qa-arch-decision
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'ADR: 选择分库分表'
- [OK] `file_contains`: 包含子串: 'ADR: 否决了读写分离'
- [OK] `file_contains`: 包含子串: 'ADR: 理由是单表容量'

### convo-qa-migration-order — 问答:迁移顺序与回滚点

- 类别: convo-qa / 夹具: fixture_convo-qa-migration-order
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '迁移: 第一步迁移 users 表'
- [OK] `file_contains`: 包含子串: '迁移: 最后迁移 audit_log'
- [OK] `file_contains`: 包含子串: '迁移: 回滚点保存在 tag'

### convo-qa-quota-policy — 问答:配额策略边界条件

- 类别: convo-qa / 夹具: fixture_convo-qa-quota-policy
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '配额: 免费层每日 50 次'
- [OK] `file_contains`: 包含子串: '配额: 超额后降级'
- [OK] `file_contains`: 包含子串: '每日 00:00(UTC+8)'

### convo-tools-report-gen — 编排:读数据生成汇总报告

- 类别: convo-tools / 夹具: fixture_convo-tools-report-gen
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '"total_files": 2'
- [OK] `file_contains`: 包含子串: '"total_items": 3'
- [OK] `file_contains`: 包含子串: '"generated_by": "agent"'

### convo-tools-refactor-split — 编排:批量重命名+清单

- 类别: convo-tools / 夹具: fixture_convo-tools-refactor-split
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'notes/a.txt -> notes/a.md'
- [OK] `file_contains`: 包含子串: 'notes/b.txt -> notes/b.md'
- [OK] `file_contains`: 包含子串: 'beta'

### convo-tools-env-audit — 编排:环境变量审计表

- 类别: convo-tools / 夹具: fixture_convo-tools-env-audit
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'PORT 设为 8811'
- [OK] `file_contains`: 包含子串: 'LOG_LEVEL 设为 info'
- [OK] `file_contains`: 包含子串: '共 3 项'

### convo-tools-test-scaffold — 编排:为纯函数生成测试骨架

- 类别: convo-tools / 夹具: fixture_convo-tools-test-scaffold
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'def test_add():'
- [OK] `file_contains`: 包含子串: 'def test_mul():'
- [OK] `file_contains`: 包含子串: 'assert add(1, 2) == 3'

### convo-tools-changelog-merge — 编排:合并变更日志

- 类别: convo-tools / 夹具: fixture_convo-tools-changelog-merge
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '## v1'
- [OK] `file_contains`: 包含子串: '## v2'
- [OK] `file_contains`: 包含子串: '- 初始发布'
- [OK] `file_contains`: 包含子串: '- 修复登录'

### convo-tools-deps-extract — 编排:依赖清单提取

- 类别: convo-tools / 夹具: fixture_convo-tools-deps-extract
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '- fastapi'
- [OK] `file_contains`: 包含子串: '- sqlalchemy'
- [OK] `file_contains`: 包含子串: '合计 3 个'

### convo-long-plan-execute — 长任务:规划后执行

- 类别: convo-longtask / 夹具: fixture_convo-long-plan-execute
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '步骤一:读取 spec.md'
- [OK] `file_contains`: 包含子串: 'ORION-77'

### convo-long-multi-round-calc — 长任务:三轮累计统计

- 类别: convo-longtask / 夹具: fixture_convo-long-multi-round-calc
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '第 1 轮: 11'
- [OK] `file_contains`: 包含子串: '第 3 轮: 33'
- [OK] `file_contains`: 包含子串: '总计: 66'

### convo-long-state-machine — 长任务:状态机多步推演

- 类别: convo-longtask / 夹具: fixture_convo-long-state-machine
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'step 1: running'
- [OK] `file_contains`: 包含子串: 'step 2: paused'
- [OK] `file_contains`: 包含子串: 'step 4: done'

### convo-long-doc-chain — 长任务:文档链条改写

- 类别: convo-longtask / 夹具: fixture_convo-long-doc-chain
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '# 基础文档'
- [OK] `file_contains`: 包含子串: '新增: 附录 A'

### convo-long-iterative-refine — 长任务:两轮迭代精化

- 类别: convo-longtask / 夹具: fixture_convo-long-iterative-refine
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '基于草稿精化'
- [OK] `file_contains`: 包含子串: '季度'

### convo-long-checkpoint-restore — 长任务:四步可回滚流程

- 类别: convo-longtask / 夹具: fixture_convo-long-checkpoint-restore
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'verify'
- [OK] `file_contains`: 包含子串: 'publish'
- [OK] `file_contains`: 包含子串: '四步全部完成'

### convo-mm-alt-catalog — 多模态:图片清单与 alt 文本

- 类别: convo-multimodal / 夹具: fixture_convo-mm-alt-catalog
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'cover.png'
- [OK] `file_contains`: 包含子串: 'banner.webp'
- [OK] `file_contains`: 包含子串: '首页封面,深蓝渐变'
- [OK] `file_contains`: 包含子串: '活动横幅,红底'

### convo-mm-dim-check — 多模态:尺寸规格核对

- 类别: convo-multimodal / 夹具: fixture_convo-mm-dim-check
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'hero.png 1200x400'
- [OK] `file_contains`: 包含子串: 'wide.jpg 900x300'
- [OK] `file_contains`: 包含子串: '超标 2 张'
- [OK] `file_not_contains`: 不包含子串: 'thumb.png'

### convo-mm-format-convert — 多模态:素材清单格式转换

- 类别: convo-multimodal / 夹具: fixture_convo-mm-format-convert
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '- [video] intro.mp4 (12s)'
- [OK] `file_contains`: 包含子串: '- [video] trailer.webm (30s)'
- [OK] `file_contains`: 包含子串: '- [image] cover.png (-)'

### convo-mm-caption-fix — 多模态:补全缺失 alt

- 类别: convo-multimodal / 夹具: fixture_convo-mm-caption-fix
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '![第一张演示图](one.png)'
- [OK] `file_contains`: 包含子串: '![第二张结果图](two.png)'
- [OK] `file_contains`: 包含子串: '正文段。'

### convo-mm-palette-extract — 多模态:配色方案提取

- 类别: convo-multimodal / 夹具: fixture_convo-mm-palette-extract
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'hsl(0 60% 80%)'
- [OK] `file_contains`: 包含子串: 'hsl(180 50% 90%)'
- [OK] `file_contains`: 包含子串: '亮色 3 个'

### convo-mm-audio-index — 多模态:音频清单索引

- 类别: convo-multimodal / 夹具: fixture_convo-mm-audio-index
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '#1 synthcat - nightdrive'
- [OK] `file_contains`: 包含子串: '#2 windfield - aurora'
- [OK] `file_contains`: 包含子串: '共 2 首'

### convo-review-code-smells — 审查:代码异味清单

- 类别: convo-review / 夹具: fixture_convo-review-code-smells
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '魔法数字'
- [OK] `file_contains`: 包含子串: '裸 except'
- [OK] `file_contains`: 包含子串: 'docstring'

### convo-review-config-drift — 审查:配置漂移检测

- 类别: convo-review / 夹具: fixture_convo-review-config-drift
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'b: 2 -> 5'
- [OK] `file_contains`: 包含子串: 'd: (新增) -> 9'
- [OK] `file_not_contains`: 不包含子串: '"a"'

### convo-review-log-triage — 审查:日志分级归类

- 类别: convo-review / 夹具: fixture_convo-review-log-triage
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'ERROR db timeout'
- [OK] `file_contains`: 包含子串: 'ERROR cache miss'
- [OK] `file_contains`: 包含子串: 'WARN slow query'

### convo-review-security-scan — 审查:安全项检查表

- 类别: convo-review / 夹具: fixture_convo-review-security-scan
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: 'sk-live-'
- [OK] `file_contains`: 包含子串: 'ghp_1111'
- [OK] `file_contains`: 包含子串: '评估: 高危'

### convo-review-api-contract — 审查:接口契约比对

- 类别: convo-review / 夹具: fixture_convo-review-api-contract
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '新增端点: POST /c'
- [OK] `file_contains`: 包含子串: '删除端点: GET /b'

### convo-review-dead-code — 审查:死代码清理建议

- 类别: convo-review / 夹具: fixture_convo-review-dead-code
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms / 自愈触发: 0 次

- [OK] `file_contains`: 包含子串: '未引用: orphan_a'
- [OK] `file_contains`: 包含子串: '未引用: orphan_b'
- [OK] `file_contains`: 包含子串: '共 2 处'
- [OK] `file_not_contains`: 不包含子串: 'used_one'
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
