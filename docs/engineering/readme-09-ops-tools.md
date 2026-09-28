# 运维与生产监控工具 · 守门补登

> 本文件是从 `README.md` 拆出来的**原文收纳件**(2026-09-27,README 瘦身票)。
> 来源:旧 `README.md` 第 6343–6384 行,逐字搬入,未改写任何一句。
> 目录页与索引见 [`docs/engineering/README.md`](./README.md)。

## 运维与生产监控工具(2026-09-27 起)
这台机由一支 agent 运维班组常驻值守(5 个班次:每小时巡检 / 每 30 分钟版本核验 / 每日 04:00 自愈 / 每日 05:30 备份核验 / 每周一体检邮件)。下面这几件是它们共用的出口,都不在提交链上,判的是**机器状态**——挂进提交链就会变成与任何提交都无关的恒红门,唯一结局是逼人 `--no-verify` 连带全部检查作废。
| 工具 | 干什么 | 为什么必须有它 |
| --- | --- | --- |
| `scripts/sync-prometheus-live-config.mjs` | 把 `monitoring/prometheus/prometheus.yml` 派生到部署机那份运行副本,并让运行副本的 `rule_files` 直接指回仓库那份 `alerts.yml`;`--check` 零副作用,`--reload` 走热加载(本机 prometheus 已开 `enable-lifecycle`,改监控配置**不需要重启服务**) | 生产 prometheus 过去读仓库外一份手抄副本,只抓 6 个目标 ⇒ `AlertmanagerDown`/`AlertBridgeDown` 依赖的 `up{job=…}` 序列**根本不存在**,`== 0` 恒不成立 —— 邮件链路断了不会有任何告警。而仓库那份 `alerts.yml` 因带两条 Prometheus 3.x 不认的 `disabled:` 字段被 `promtool` **整份拒绝**,两侧各自"能跑"、合起来从没跑过。**规矩:凡 Down 类判据必须配一条"job 集合差"对账,"序列缺失"比"值为 0"更危险。** 派生器另有占位符凭据守卫(它曾把 `password: __REPLACE…` 逐字烘进生产 ⇒ 主机指标采集器恒 401、磁盘/内存告警长期哑) |
| `scripts/prune-rotated-nssm-logs.mjs` | nssm 轮转副本的保留策略量算;**默认只读**,`--keep N --apply` 才删,超 40 份或 512MB 自动拒绝需 `--allow-mass` | **轮转 ≠ 保留策略**:nssm 只把写满那份改名,一个旧副本都不删(现读 6 组 / 48 份 / 1.19GB)。活文件(名里无时间戳)永不进候选、刚轮转 <1h 跳过、解析后落在 logs 目录外的一律剔除(防 junction 穿透清空) |
| `scripts/alert-volume-report.mjs` | 只读量算"发信总量 / 风暴簇 / 跳门总量 / 哪道门导致跳门 / 检查整批没跑的次数" | 过去全仓没人统计过这些,"修好三道"可能只是"修好我看到的三道"。跳门的唯一真值来源是 `.workbuddy/safe-commit-attestation.jsonl` |
| `scripts/pg-restore-drill.mjs` | 备份可恢复性核验:`--check`/`--offline-verify` 不碰库,`--apply` 才做在线还原演练 | 全仓 `pg_restore` 此前只出现在注释里 —— **没验过的备份不算备份**。文件层已证到最强(整份归档解出 363MB SQL 流零报错);在线演练缺一个建库权限,**属机主授权动作,agent 不得自行提权** |
| `scripts/run-evidence.mjs` | 给任何一次取证落件并写 `#EVIDENCE-RC`,读侧 `--verify` 判"跑完 / 被截断 / 被杀" | 把"跑失败"与"根本没跑到"变成机器可分辨的两件事。管道尾的 `$?` 是 `tail` 的退出码,不是判据的 —— 本仓一天内三次因此得出相反结论 |
**两条通用口径**:(1) 端内/部署机那份运行配置一律是**派生态**,禁止手改也禁止"只拦红不回写"(与 design-tokens 同源那条同规矩);(2) **改常驻服务的脚本必须重启才生效,而 PowerShell/node 每轮重新派生的子进程改工作树即刻生效** —— 判据是"它是常驻读进内存,还是每轮重新起",别一律当"要重启"。
> - **文件族同样只有一份判据**(2026-09-27 收口，`packages/shared/src/chat/file-tool-intent.ts`)：
>   "这一句要不要给 AI 一只**改文件**的手"此前只写在 web 端(`tool-config.ts`)，而扩展会话
>   **完全不带**文件族 —— 这类分叉本身不会报错,只会表现成"同一句话在 web 能改文件、在那个端不能";而**要不要带取决于该端有没有委托面**(见本条末尾),所以"补齐"不等于"照抄 web 的名单"。
>   现搬到共享层：web 保留 re-export(不打断既有 import 面)。两张名单刻意命名成
>   `FILE_*_INTENT_TOOLS` 且**不进 `./chat` barrel**：barrel 里已有的 `FILE_WRITE_TOOLS`
>   (`task-status.ts`)是"这次调用算不算改了文件"的**识别**白名单(Set，按 `.has()` 消费)，与
>   "把哪些工具交给模型"的**能力**清单同词不同义，并置会产出 `export *` 歧义。行为对子与
>   "端内不得再写第二份正则"由 `packages/shared/src/chat/__tests__/file-tool-intent.test.ts` 钉住。
>   **扩展端实测后收回携带**(2026-09-27 同日晚):它不送 `workspace_context`,写类工具会落到服务端 `_mcp.call_tool`,那里 `write_file`/`file_edit` 属 `_ADMIN_ONLY_TOOLS` 而对话链 `__user_role` 恒为 0 ⇒ 每次必失败;只读族则会在服务端工作区上执行 ⇒ 越权面变更。带过去只会先给一条流中 diff、再报权限失败,
>   所以扩展此刻**不带**文件族(理由四条写进端内 `toolsForChatRequest` 头注并被测试锁住:排除必须带理由,否则下一个人会顺手补回来)。**工具流中 diff 预览(SSE `tool-delta` 帧)现覆盖 web / 小程序 / RN 三端**:载荷 `partialText` 是**累积文本**
>   判断)，仅 `running` 态渲染，`tool-result` 到达即清(最终 ± 行以 result 为准)。**收帧与渲染的管线四端都在位**(扩展那一段属"接线已到位、生产者尚未指向它"),而当前真会收到帧的是 web / 小程序 / RN 三端,三端的渲染条件
>   逐字同形，字段声明收敛进 `@ihui/types` 的 `ToolCall.partialDiff`，端内归并层一律纯函数
>   (web `createToolDeltaHandler` / 扩展 `lib/tool-call-frames.ts` / 小程序 `cards/types.ts` /
>   RN `chat-render-model.ts`)，接线由各自的源码级锁 + 真实帧端到端用例钉住。
  - `useUpdater` 状态机(idle → checking → available → downloading → installing → done);退出更新守卫与全屏遮罩已于 2026-09-27 整条移除(两处实测缺陷:监听注册晚于异步 IPC 注入 ⇒ "正在退出..." 永久转圈,遮罩从不回报有没有更新)
- **关闭行为可配置(2026-09-28 起)**:托盘图标显隐、关闭窗口动作(隐藏到托盘 / 直接退出 / 每次询问)、开机自启与静默启动、托盘菜单项与未读徽标,六项集中在「设置 → 桌面端行为」并可跨设备漫游;判定与超时兜底住在 Rust 侧,不依赖 WebView 是否活着
| `scripts/pg-backup-cadence-audit.mjs` | 只读审计每日备份的**节拍与完整性**:逐日在位、每份 `complete/truncated/undetermined` 三态、0 字节与体积塌陷、异地腿缺口 | 自定义格式的 TOC 在文件**尾部**,`pg_dump` 中途死掉留下的文件大小看着完全正常 —— 只看大小与 `ls` 判不出"这份根本恢复不了" |
| `scripts/pg-restore-app-reads.mjs` | 把 60 条**应用自己发的只读查询**同时打到生产库与还原出来的演练库,五态不并桶地报 pass / 还原库报错 / 列形分叉 / 行数漂移 / 未判定 | "表数行数全等"只证明**元数据**到了;缺手写迁移的 `search_vector`、自定义 enum、RLS 会话变量、序列落后这些形态没有一个会移动那两把尺子,而应用一查就废 |
| `deploy/win/ihui-pg-restore-prereq.sql` | 灾难恢复第 0 步:在干净集群上先建 `ihui` / `ihui_app` 两个角色再还原 | 单库 dump **结构上不含**角色与成员关系(实测 0 条 CREATE ROLE),而归档有 958 条 `OWNER TO ihui` —— 不先建角色,属主全部落空。口令是占位符,文件本身无机密 |
> ⚠️ **版权与许可声明**
> - 本仓库采用 **Apache-2.0** 开源许可：允许商用、修改与再分发（须保留版权声明与 NOTICE，并标注修改）。
> - 版权与归属声明详见 **根目录 [NOTICE](NOTICE)**（Apache-2.0 要求随每一副本保留本声明与 NOTICE）。
> - 源文件头部保留一行可见版权署名（Apache-2.0 第 4 条归属声明）。
| `deploy/win/ihui-pg-backup.ps1`(生产实际执行的是 `deploy/prod-bundle/pg-backup.ps1`,两侧逐字节等值由守门 104 钉) | 每晚 03:00 逐库导出 `ihui_dev` + `keycloak`(自定义压缩格式,保留 ACL 只重映射属主),本地与云盘同步目录**同窗轮转 7 天** | `keycloak` 是这台机唯一"丢了就建不回来、而此前完全没被备份"的库(SSO realm 只活在库里,全仓无 realm-export / compose / kc.sh 可重建),而它只有 0.2MB。另一半成因:旧清理写死只匹配 `ihui_dev_*.dump`,于是 dash 命名的档与 `.sql.gz` 共 153.8MB 永久清不掉,云盘目录更是**一行清理代码都没有** —— 网盘配额撞顶的失败形态不是报错,而是同步客户端静默停传,和"从没配过异地"长一模一样 |
| 63         | check-sse-parser-parity.mjs                                              | **SSE 双解析器漏接对账(blocking,D106/G-148 配套)**:同一协议被 `packages/api-client`(web/extension/mobile-rn)与 `packages/shared/src/utils/sse-parse.ts`(miniapp-taro)两处独立解析。三类判定:① 抽不到事件名 = 判据失效**按失败处理**;② sse-parse 覆盖帧数 ratchet(`parseCoverageBaseline=23`,只挡倒退);③ api-client 已解析而未接的帧必须在 `scripts/data/sse-parser-coverage.json` 的 `webOnly` 写明"为什么只有该端消费"(空理由/已接却仍登记都拦)。判据强度实测:把 `steer` 守卫改坏 → 立即红两条(覆盖倒退 + 未登记),"只剩产出语句或只剩类型联合声明"都骗不过本闸。`--self-test` 10 例正反成对,`--report` 输出逐端补齐工单                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 守门补登：服务二进制路径存续性（2026-09-28 立，warn）

`scripts/check-service-binary-paths.mjs` 把"外部自升级把 Windows 服务的二进制路径烂掉"这一型变成机器可查事实：RSSHub 曾因为 `~\.workbuddy\binaries\node\versions\<新版本>` 整个目录被换掉而**静默停服 3 天，期间没有任何告警**，而全仓没有任何一处会去问"服务声明要跑的那个 exe 今天还在不在"。

门体遍历本机服务、按 nssm 的 `Parameters\Application` 绝对路径逐条判存在性，结论分三态且**绝不并桶**：可判存在 / 确认缺失 / 未判定。枚举不到任何 nssm 托管服务（例如这台开发机）时如实报"未判定"并点名原因——那不等于通过。定级是 **warn**：服务路径属机器状态，提交者结构上满足不了，挂进 blocking 只会让每台每次提交被逼 `--no-verify`，一次绕过等于全部守门对该提交作废。问责档跑 `--strict`（确认缺失与未判定都拒绝出具合格证）；应急跳过变量 `HUSKY_SKIP_SERVICE_BINARY_PATHS`。

