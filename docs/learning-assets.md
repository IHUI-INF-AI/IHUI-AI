# 学习资产登记(Learning Assets Registry)

> 用途:把 CI 工作流运行反馈转化为可复用学习资产,供后续审查 / 复盘观察改进效果。
> 对应 better-harness finding:`workflow-assets-not-loop-engineering`(34 个工作流未接入学习闭环)。

## 登记规则(强制)

1. **每个 `.github/workflows/*.yml` 必须在本表登记**(新增 / 重命名 / 删除工作流时同步更新本表)。
2. **反馈采集通道**:`loop-daily-triage.yml` 每日扫描代码卫生 / 静态分析 / 依赖健康,结果写入 `.github/loop-runtime/STATE.md`(git 跟踪,可被审查观察)。
3. **反馈 → 学习资产**:工作流失败 / 告警 / 阈值漂移时,复盘结论(根因 + 防回归手段)追加到 `.trae-cn/archive/` 复盘文档,并在此表 `学习用途` 列登记可复用模式。
4. **不改 CI 行为**:本表只登记资产与反馈来源,不修改工作流本身的执行逻辑。

## 工作流反馈资产清单(34)

### quality — 质量门禁(17)

| 工作流 | 反馈类型 | 学习用途 |
| ------ | -------- | -------- |
| `ci.yml` | 构建/测试结果 | 主门禁失败模式、构建缓存失效规律 |
| `ci-monorepo.yml` | 全量门禁结果 | monorepo 依赖图变化、跨包契约漂移 |
| `build.yml` | 构建产物健康 | 产物大小/依赖树异常 |
| `e2e.yml` | 端到端回归 | 用户路径断裂模式、环境依赖 flake |
| `knip.yml` | 未使用依赖/导出 | 死代码清理队列、依赖泄漏 |
| `i18n-check.yml` | parity 门禁 | 翻译 key 漂移、多语言回归 |
| `i18n-dead-key-audit.yml` | 死 key 审计 | 冗余翻译沉淀规律 |
| `openapi-check.yml` | 契约漂移 | API 契约破坏模式(如 F3 路由改名漏同步) |
| `style-spec.yml` | 风格规范 | UI 规范偏离(圆角/分割线/字体对齐) |
| `visual-regression.yml` | 视觉回归 | 样式回归定位、基线更新纪律 |
| `lighthouse-ci.yml` | 性能预算 | 性能退化归因、预算调整依据 |
| `migration-tests.yml` | 迁移测试 | 数据库迁移破坏模式 |
| `test-real-db.yml` | 真实 DB 集成 | 环境差异导致的 SQL/时序问题 |
| `llm-provider-schema-test.yml` | provider schema | 提供商接口变更(如 F2 gemini 断言漂移) |
| `nativewind-monitor.yml` | RN 样式回归 | 跨端样式同步 |
| `smoke-new-modules.yml` | 新模块冒烟 | 新模块接入遗漏 |
| `ws-loadtest.yml` | WebSocket 压测 | 长连接稳定性、负载瓶颈 |

### release — 发布(4)

| 工作流 | 反馈类型 | 学习用途 |
| ------ | -------- | -------- |
| `release-on-tag.yml` | tag 发布结果 | 发布流程卡点、版本号纪律 |
| `release-cli.yml` | CLI 发布 | CLI 打包/发布失败模式 |
| `release-desktop.yml` | 桌面端发布 | Tauri 打包问题、签名失败 |
| `release-sdk.yml` | SDK 发布 | npm 发布权限/产物一致性 |

### deploy — 部署(3)

| 工作流 | 反馈类型 | 学习用途 |
| ------ | -------- | -------- |
| `blue-green-deploy.yml` | 部署健康 | 回滚触发条件、部署窗口规律 |
| `deploy-github-pages.yml` | 静态站点部署 | 构建产物路径漂移 |
| `miniapp-preview.yml` | 小程序预览 | 小程序构建环境差异 |

### security — 安全(2)

| 工作流 | 反馈类型 | 学习用途 |
| ------ | -------- | -------- |
| `weekly-security-audit.yml` | 安全审计 | 依赖漏洞模式、泄露检测 |
| `generate-tauri-keys.yml` | 密钥生成 | 签名密钥轮换纪律 |

### ops — 运维(4)

| 工作流 | 反馈类型 | 学习用途 |
| ------ | -------- | -------- |
| `s3-lifecycle-drift.yml` | 存储漂移检测 | 生命周期策略漂移规律 |
| `weekly-cleanup.yml` | 资源清理 | 资源堆积模式、清理豁免规则 |
| `observability-drills.yml` | 可观测演练 | 监控盲区、告警有效性 |
| `mirror-to-cn.yml` | 镜像同步 | 镜像同步失败模式(网络/凭据) |

### loop / community — 学习闭环与社区(4)

| 工作流 | 反馈类型 | 学习用途 |
| ------ | -------- | -------- |
| `loop-daily-triage.yml` | L1 每日体检 | 写 `.github/loop-runtime/STATE.md`,全局卫生趋势 |
| `repo-metadata.yml` | 仓库元数据 | 元数据漂移、README/徽章一致性 |
| `button-wrap-nightly.yml` | UI 夜间检查 | 按钮换行/布局回归模式 |
| `thank-star.yml` | 社区致谢 | 社区互动数据(非技术学习输入) |

## 审查观察点

- 后续 better-harness 审查可检查:① 本表工作流清单与 `.github/workflows/` 是否一致;② 失败复盘是否进入 `.trae-cn/archive/`;③ `loop-runtime/STATE.md` 连续 degraded 时是否有对应整改记录。
