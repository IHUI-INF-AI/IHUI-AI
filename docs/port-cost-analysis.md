# 项目竏分析与维护成朼?
> **Workspace:** g:\IHUI-AI

---

**User**

朡盚全部竏都有哺  请全部深度细列出来   并且分析给我现在套代码的实际维护成本   还有叼化的?
**Assistant**

我来调研 IHUI-AI monorepo 的代码体秒维护成本数据。这昸为研究任务,不做任何代码俔?
让我先创建任务?然后并收集各类数据?
先探索目录结?存在哺?然后并运统命令?
盽结构清晰:8 ?apps + 14 ?packages。现在并行运行统计命令先做代码体移?任务1),用一两脚本次完成?
代码体积统完成(总 5774 文件 / 969,388 ?。apps/desktop 显示 0 文件,。并行运行后绻计任务?
并运 5 主计命?desktop 验证、守门脚?top5、pre-commit hook、依赖模i18n?
apps/desktop 主?Tauri(Rust)结构,源码?src-tauri。继绹行运行其他统计?
Task 2 完成:95 ?mjs 脚本,22936 行现在并行运?pre-commit hook 读取、依赖统计i18n 统、desktop 源码?
pre-commit hook 读取完成:guardian-runner 执 40 ?27 blocking + 11 warn + 2 info)+ lint-staged + 3 条件闸门(16/16b/16c)。继绹行运行依赖i18n、LLM provider、路由docker+测试统?
Task 4 完成:8 ?package.json,合 308 举?198 dep + 110 dev,朎?。继绹行运?i18n、LLM provider、路由docker+测试?
i18n ?5 文件,?zh-CN 顶层 key 计数返回 0,排查结构。并行运?zh-CN 结构查LLM provider、路由docker+测试?
zh-CN.json 昵套结?顶层 key ?"skills")。重新数顶?key,并运 LLM provider、路由docker+测试?
i18n:5 诨文件,zh-CN.json 29044 行顶?key ?590 验证。并行运?zh-CN key 复验、LLM provider、路由统计docker+测试?
PowerShell 5.1 ?ConvertFrom-Json 对大 JSON ?bug。改?node 精确计数,并运 LLM provider、路由docker、测?TODO?
i18n :5 诨,zh-CN 顶层 590 key / 递归 26791 key。并行运?LLM provider、路由docker、测试TODO 统?
Task 6 完成:config.py 155 ?24 ?*_api_key + 7 ?*_api_base(?24-27 ?LLM provider)。继绹行运行路由docker、测试TODO 统?
Task 7 完成:API 跔 429 .ts / ai-service v1 8 .py / web 615 page.tsx。并行运?docker 服务、测试文件TODO 标统?
root docker-compose.yml 返回 0 服务,排查。并行运?root compose 查测试文件TODO 标?
root compose ?services 但数返?0(參正则)。并?重 root compose 服务、测试文件TODO 标?
root compose ?`services:` 行未袌?參有编码问题并?调试 compose + 测试文件 + TODO?
root compose 实际?14 东?api, worker, web, ai-service, db, migrate, redis, jaeger, otel-collector, prometheus, grafana, node-exporter, loki, promtail)+ 1 network + 4 volumes。状态机失败?PS 5.1 默编码。现在并行运行测试文?+ TODO 统?
Task 9 完成:468 丵试文?55 e2e + 282 api + 131 ai-service)。现在统?TODO/FIXME/HACK/XXX 标?
Task 10 完成:TODO 563 / FIXME 16 / HACK 154 / XXX 1937 / 合 2670(XXX 參吤小写不敏感的诌?。最后确?apps/desktop 源码(Tauri/Rust 结构)?
apps/desktop ?Tauri 应用:3 ?.rs 文件 / 950 ?Rust 源码。所有数捔集完毕api 跔 429 偏高,做最后一次验?+ 更新 todo?
有数捔集完成更新任务状态并汇报告?
# IHUI-AI Monorepo 代码体积与维护成朰研报?
纠究任?朿改任何文件所有数捚过 PowerShell `Get-ChildItem` + `Measure-Object` + `Select-String` 统,排除 `node_modules`/`dist`/`.next`/`.turbo`/`build`/`.output`/`.venv`/`__pycache__`/`.git`/`target`/`*.lock`?
## 1. 各代码体积

源码扩展?`.ts/.tsx/.js/.jsx/.mjs/.cjs/.py`

| 盽 | 源码文件?| 总?| 备注 |
|---|---|---|---|
| apps/web | 2576 | 335,429 | Next.js 15 前,体积大 |
| apps/api | 1166 | 273,688 | Fastify 5 后 |
| apps/ai-service | 335 | 118,692 | FastAPI AI 服务(Python) |
| apps/cli | 268 | 60,392 | CLI 工具 |
| apps/desktop | 0 (TS/JS/Py) | 0 | Tauri 应用,源码?Rust:3 ?.rs / 950 ?|
| apps/extension | 86 | 10,251 | 浏器扩?|
| apps/mobile-rn | 224 | 29,683 | React Native 移动?|
| apps/miniapp-taro | 551 | 59,594 | Taro 4 小程?|
| packages/* | 460 | 56,924 | 14 丅二 |
| scripts | 108 | 24,735 | 守门/工具脚本 |
| **合** | **5774** (+3 .rs) | **969,388** (+950) | **?97 万源码** |

## 2. 守门脚本数量与杂度(scripts/*.mjs)

- **总数:95 ?.mjs 脚本 / 22,936 ?*
- (scripts 盽整体 108 文件 / 24,735 ??.ps1/.json 等其他类?

**Top 5(行数?:**

| 排名 | 文件 | 行数 |
|---|---|---|
| 1 | fix-i18n-deep.mjs | 1423 |
| 2 | audit-migration-frontend-routes.mjs | 888 |
| 3 | audit-migration-db-fields.mjs | 839 |
| 4 | audit-migration-api-routes-v2.mjs | 757 |
| 5 | audit-migration-i18n.mjs | 746 |

## 3. pre-commit hook 守门项数

读取 `g:\IHUI-AI\.husky\pre-commit`(85 ?:

| 类别 | 数量 | 说明 |
|---|---|---|
| guardian-runner 批量?| 40 ?| 27 blocking + 11 warn + 2 info |
| lint-staged | 1 ?| ?5(eslint + prettier) |
| 条件 typecheck 闸门 | 1 ?| ?16(?apps/web staged) |
| 条件 database 重建闸门 | 1 ?| ?16b(?packages/database/src staged) |
| 条件 RN global.css 同 | 1 ?| ?16c(?mobile-rn/tokens.css staged) |
| **查点总** | **44** | ?|

## 4. 依赖规模(8 ?package.json,朎?

| ?| dependencies | devDependencies | 合 |
|---|---|---|---|
| root package.json | 0 | 13 | 13 |
| apps/api | 61 | 21 | 82 |
| apps/web | 62 | 31 | 93 |
| apps/mobile-rn | 32 | 10 | 42 |
| apps/miniapp-taro | 21 | 14 | 35 |
| apps/cli | 14 | 7 | 21 |
| apps/extension | 8 | 12 | 20 |
| apps/desktop | 0 | 2 | 2 |
| **合(朎?** | **198** | **110** | **308** |

> ai-service ?Python,?package.json(?pyproject.toml/requirements)?
## 5. i18n 诨数和 key ?
- **诨文件?5 ?*(apps/web/messages/):`en.json` / `ja.json` / `ko.json` / `zh-CN.json` / `zh-TW.json`
- **zh-CN.json(基准诨):**
  - 顶层 key ?**590**
  - 递归 key 总数:**26,791**
  - 文件行数:**29,044 ?*
- ?apps/miniapp-taro/src/i18n/zh-CN.ts 存在(小程序狫 i18n)

## 6. LLM provider 数量

读取 `g:\IHUI-AI\apps\ai-service\app\core\config.py`(155 ?:

- **`*_api_key` 字:24 ?*(唸去重)
- **`*_api_base` 字:7 ?*(唸去重)

**24 ?api_key provider**:agnes, aihorde, ainative, alibaba_intl, anthropic, bazaarlink, cerebras, cohere, gemini, groq, huggingface, inference_net, llm7, mistral, modal, nlp_cloud, nvidia, openai, openrouter, reka, routeway, scaleway, stepfun, zai

**7 ?api_base**(其中 kilo/ovh/pollinations ?api_key,为免?provider):agnes, aihorde, kilo, llm7, ovh, pollinations, stepfun

> **LLM provider ?24-27 ?*(24 东 key + 3 主 base 的免?provider)?
## 7. 跔 / API 竂?
| ?| 文件类型 | 数量 | 说明 |
|---|---|---|---|
| apps/api/src/routes | *.ts | 429(递归)/ 227(直接) | 吭盽 admin/admin-extended/admin-sys/ai-vendors/community/learn/other/user/ws/__tests__ |
| apps/ai-service/app/api/v1 | *.py | 8 | AI 服务 v1 接口 |
| apps/web/app | page.tsx | 615(递归) | Next.js 页面(全在子目?直接 0) |

## 8. Docker compose 服务总数

| compose 文件 | 服务?| 服务?|
|---|---|---|
| docker-compose.yml(? | 14 | api, worker, web, ai-service, db, migrate, redis, jaeger, otel-collector, prometheus, grafana, node-exporter, loki, promtail |
| deploy/saas/docker-compose.yml | 3 | admin-api, prometheus, grafana |
| deploy/observability/docker-compose.observability.yml | 4 | otel-collector, jaeger, prometheus, grafana |
| **合** | **21** | 跨文件有重(prometheus/grafana/jaeger/otel-collector 在文件出现) |

> ??compose 另有 1 ?network(ihui-net)+ 4 ?volumes(pgdata/redisdata/prometheusdata/grafanadata),不入服务数?
## 9. 测试文件?
| 测试盽 | 模式 | 数量 |
|---|---|---|
| apps/web/e2e | *.spec.ts | 55 |
| apps/api/tests | *.test.ts | 282 |
| apps/ai-service/tests | test_*.py | 131 |
| **合** | ?| **468** |

## 10. TODO/FIXME/HACK/XXX 标?
扏 15,279 为码文?.ts/.tsx/.js/.jsx/.mjs/.cjs/.py/.json/.yml/.yaml/.css/.md/.html/.vue/.rs/.go),排除构建产物:

| 标 | 数量 |
|---|---|
| TODO | 563 |
| FIXME | 16 |
| HACK | 154 |
| XXX | 1937 |
| **合** | **2670** |

> ?Select-String 默大小写不敏感,XXX ?1937)參吰?`xxx` 变量?占位符匹配;TODO/FIXME/HACK 为注释标记主主体?
---

## 维护成本关键指标汇?
| 指标 | 数?| 维护成本信号 |
|---|---|---|
| 总源码?| ~97 万(969,388 + 950 Rust) | 大型 monorepo |
| 源码文件?| 5,777 | ?|
| 竕?| 8 ?web/api/ai-service/cli/desktop/extension/mobile-rn/miniapp-taro) | 多同负担?|
| 共享包数?| 14 ?packages/*) | ?|
| 守门脚本 | 95 ?.mjs / 22,936 ?| 守门基设施庞大 |
| pre-commit 查点 | 44 ?27 blocking) | 提交门?|
| 依赖总数(朎? | 308(8 ?package.json) | ?|
| i18n 诨?| 5 诨 / 590 顶层 key / 26,791 递归 key | 翻译维护量大 |
| LLM provider | 24-27 ?| 多厂商?|
| API 跔文件 | 429 .ts(api)+ 8 .py(ai-service) | 后接口面广 |
| 前页面 | 615 page.tsx | 前页面?|
| Docker 服务 | 21(?3 compose 文件) | 部署编排复杂 |
| 测试文件 | 468 | 测试覆盖面广 |
| TODO 类标?| 2,670 | 机信?XXX 数含诌配需人工甄别) |

**调研结**:IHUI-AI 昸为 97 万源码? 竿通?4 ?pre-commit 查点?5 丮门脚?4-27 ?LLM provider? 诨 i18n(26,791 key)?15 前页面?29 API 跔?1 ?Docker 服务?68 测试文件的大型全?AI 平台 monorepo,维护成本主集中在竐步守门基设施、i18n 翻译、LLM 厂商对接四个维度?
# IHUI-AI 全口清?+ 维护成本分析

## 、全部口深度清?
权威来源:[docs/port-management.md](file:///g:/IHUI-AI/docs/port-management.md) + [scripts/check-port-registry.mjs](file:///g:/IHUI-AI/scripts/check-port-registry.mjs) + 实际配置文件交叉验证?
### 1.1 应用服务(8801-8809)

| 竏 | 服务 | ?| 实际配置位置 | strictPort | 状?|
|---|---|---|---|---|---|
| 8801 | Web(Next.js 15 + Turbopack) | apps/web | [apps/web/package.json](file:///g:/IHUI-AI/apps/web/package.json) `next dev --turbopack -p 8801` | ?| 在用 |
| 8802 | API(Fastify 5) | apps/api | [apps/api/src/index.ts#L11](file:///g:/IHUI-AI/apps/api/src/index.ts#L11) + `.env PORT=8802` | ?| 在用 |
| 8803 | AI Service(FastAPI + LangGraph) | apps/ai-service | [apps/ai-service/app/core/config.py#L20](file:///g:/IHUI-AI/apps/ai-service/app/core/config.py#L20) `port=8803` | ?| 在用 |
| 8804 | Taro H5(小程?H5 调试) | apps/miniapp-taro | [apps/miniapp-taro/config/dev.ts](file:///g:/IHUI-AI/apps/miniapp-taro/config/dev.ts) `port:8804 strictPort:true` | ?| 在用 |
| 8805 | Metro Bundler(React Native) | apps/mobile-rn | [apps/mobile-rn/package.json](file:///g:/IHUI-AI/apps/mobile-rn/package.json) `expo start --port 8805` | ?| 在用 |
| 8806 | ~~Desktop Vite~~ | apps/desktop | [tauri.conf.json#L9](file:///g:/IHUI-AI/apps/desktop/src-tauri/tauri.conf.json#L9) `devUrl: http://localhost:8801` | ?| **已废?*(A 套壳:复用 web 8801,不再狫竏) |
| 8807 | CLI(预留) | apps/cli | ?| ?| 预留朔 |
| 8808 | Extension(预留) | apps/extension | 浏器扩展走 `chrome.runtime`,**不监?* | ?| 预留朔(扩展无口需? |
| 8809 | (预留扩展) | ?| ?| ?| 空槽 |

### 1.2 基设施(8810-8819)

| 竏 | 服务 | 容器内?| 配置位置 | 绑定 |
|---|---|---|---|---|
| 8810 | PostgreSQL 15(pgvector) | 5432 | [docker-compose.yml#L228](file:///g:/IHUI-AI/docker-compose.yml#L228) `127.0.0.1:8810:5432` | ?localhost |
| 8811 | Redis 7 | 6379 | [docker-compose.yml#L266](file:///g:/IHUI-AI/docker-compose.yml#L266) `127.0.0.1:8811:6379` | ?localhost |
| 8812 | OTel Collector gRPC(OTLP) | 4317 | [docker-compose.yml#L302](file:///g:/IHUI-AI/docker-compose.yml#L302) `8812:4317` | 0.0.0.0 |
| 8813 | OTel Collector HTTP(OTLP) | 4318 | [docker-compose.yml#L301](file:///g:/IHUI-AI/docker-compose.yml#L301) `8813:4318` | 0.0.0.0 |
| 8814 | Jaeger UI | 16686 | [docker-compose.yml#L283](file:///g:/IHUI-AI/docker-compose.yml#L283) `8814:16686` | 0.0.0.0 |
| 8815 | Prometheus | 9090 | [docker-compose.yml#L337](file:///g:/IHUI-AI/docker-compose.yml#L337) `8815:9090` | 0.0.0.0 |
| 8816 | Grafana | 3000 | [docker-compose.yml#L366](file:///g:/IHUI-AI/docker-compose.yml#L366) `8816:3000` | 0.0.0.0 |
| 8817 | Node Exporter | 9100 | [docker-compose.yml#L387](file:///g:/IHUI-AI/docker-compose.yml#L387) `8817:9100` | 0.0.0.0 |
| 8818 | Loki | 3100 | [docker-compose.yml#L403](file:///g:/IHUI-AI/docker-compose.yml#L403) `8818:3100` | 0.0.0.0 |
| 8819 | (预留扩展) | ?| ?| ?|

### 1.3 辅助工具(8820-8829)

| 竏 | 服务 | 实际配置 | 状?|
|---|---|---|---|
| 8820 | Storybook(docs 声称) | [apps/web/package.json:24](file:///g:/IHUI-AI/apps/web/package.json#L24) **实际 `storybook dev -p 6006`** | ⚠️ **docs/代码不一?*(见可优化?? |
| 8821 | Promtail(内部健康? | monitoring/promtail/promtail-config.yml | 在用 |
| 8822-8829 | (预留扩展) | ?| 空槽 |

### 1.4 SaaS 部署(8830-8839)

| 竏 | 服务 | 配置位置 | 绑定 |
|---|---|---|---|
| 8830 | Admin API(SaaS 托平台) | [deploy/saas/docker-compose.yml#L83-85](file:///g:/IHUI-AI/deploy/saas/docker-compose.yml#L83) `127.0.0.1:8830:8830` | ?localhost |
| 8831-8839 | (预留扩展) | ?| 空槽 |

### 1.5 蓝绿部署?8840-8849)?注册表声明?
| 竏 | 服务 | 实际占用 | 状?|
|---|---|---|---|
| 8841 | CLI Agent Server | [apps/cli/src/commands/serve.ts:24](file:///g:/IHUI-AI/apps/cli/src/commands/serve.ts#L24) `--port <port> default '8841' strictPort` | ⚠️ **占用"蓝绿部署预留?,docs 朳?*(见可优化?? |
| 8840/8842-8849 | (蓝绿部署预留) | ?| 空槽 |

### 1.6 容器内部竏(不变,不映射到宿主)

| 容器内?| 服务 | 说明 |
|---|---|---|
| 8080 | api | 生产 API 容器?healthcheck ? |
| 8081 | worker | BullMQ worker healthcheck |
| 3000 | web / grafana | Next.js standalone / Grafana 容器?|
| 8000 | ai-service | FastAPI 容器?[Dockerfile#L28](file:///g:/IHUI-AI/apps/ai-service/Dockerfile#L28) `EXPOSE 8000`) |
| 5432 | postgres | PostgreSQL 容器?|
| 6379 | redis | Redis 容器?|
| 4317/4318 | otel-collector | OTLP 接收 |
| 16686 | jaeger | Jaeger UI |
| 9090 | prometheus | Prometheus |
| 9100 | node-exporter | Node Exporter |
| 3100 | loki | Loki |
| 14250/14268/14269 | jaeger internal | gRPC/HTTP collector |
| 13133 | otel-collector | 内部健康?|
| 9080 | promtail | 内部健康?|
| 8888 | otel-collector | 臺 metrics |

### 1.7 豁免的非 88xx 竏(check-port-registry.mjs ?36-59 行豁免列?

SMTP(587/465/25)、HTTP/HTTPS(80/443)、SSH(22)、Ollama(11434)、LM Studio(1234)、MCP transport(8765)、MCP OAuth 测试(18999)、ai-service 测试 mock(8001)、生?admin-api 旧?8082)、Alertmanager(9093)、ai-feed-sources(6688)、Vite 默(5173)、Prometheus 旧映?9091)、mock SMTP(1025)?
### 1.8 竏总数统

| 类别 | 数量 |
|---|---|
| 已注?88xx(dev/宿主) | **14 ?*(8801-8805/8810-8818/8830/8841) |
| 预留 88xx 空槽 | **20 ?*(8806-8809/8819/8822-8829/8831-8839/8840/8842-8849) |
| 容器内部竏 | **16 ?*(不映? |
| 豁免笸?CI 竏 | **~17 ?* |
| **涉及竏总数** | **~67 ?* |

---

## 二代码维护成月?基于实测数据)

### 2.1 代码体量硕?
| 维度 | 数?| 行业对标 |
|---|---|---|
| 总源码?| **~97 万**(969,388 + 950 Rust) | 大型 monorepo(丞互联网公司量? |
| 源码文件?| **5,777** | ?|
| 竕?| **8 ?* | 全栈 + 多覆盖 |
| 共享?| **14 ?*(packages/*) | 抽象层 |
| 守门脚本 | **95 ?.mjs / 22,936 ?* | 守门基设施臺庞大 |
| pre-commit 查点 | **44 ?*(27 blocking + 11 warn + 2 info + 4 项独? | 提交门极高 |
| 依赖总数(朎? | **308**(8 ?package.json) | 依赖图?|
| i18n | **5 诨 / 590 顶层 key / 26,791 递归 key** | 翻译面巨?|
| LLM provider | **24-27 ?*(24 ?key 字 + 3 丌?base) | 厂商对接面广 |
| API 跔 | **429 .ts**(api)+ **8 .py**(ai-service) | 后接口面广 |
| 前页面 | **615 ?page.tsx** | 前页面?|
| Docker 服务 | **21 ?*(?3 ?compose) | 部署编排复杂 |
| 测试文件 | **468**(55 e2e + 282 api + 131 ai-service) | 测试覆盖?|
| TODO/FIXME/HACK 标 | **~733**(563 TODO + 16 FIXME + 154 HACK) | 机中?|

### 2.2 维护成本四象?
**🔴 高成朌(主体维护负担)**

1. **多同?*(AGENTS.md §9 强制全连??8 竻改动评估跨影响,web 33 万 + api 27 万 + ai-service 12 万三重?2. **守门基设施反向维护**?95 丮门脚?/ 22,936 ?臺就是 ~2.3 万代码要维?守门脚本 bug 会阻塞所?agent 提交?3. **i18n 翻译同**?26,791 丒归 key × 5 诨 = ~13.4 万条翻译条目,?AI 流水线维?任一 key 漏翻 ?parity 守门阻?4. **LLM provider 适配**?24-27 ?provider,任一接口变更(API base / 鉴权 / 模型?多俔 config.py + .env.example + docker-compose.yml?
**🟡 丈朌(収但需关注)**

5. **测栈**(7 丛控?Promtail + Loki + Grafana + Prometheus + Jaeger + OTel + NodeExporter)?完整 APM 链路,朜吊耗资?生产维护专人?6. **生产安全审产物**(JWT/DB/Redis 强制密码、mTLS、CORS 严格校验)?已落?但每次新增配罡同 .env.example + docker-compose + 吊校验三?7. **测试套件**?468 测试文件,?3 诨?TS/Py/Rust),任一栈升级需重跑全量?
**🟢 低成朌(设艥)**

8. **竏注册?*?单一权威文档 + 守门脚本,新竏流程清晰?9. **共享包抽?*?14 ?packages/* 复用 UI/types/auth/database,减少重代码?10. **Docker 化部?*?21 服务全器化,致高?
### 2.3 维护成本量化估算(粗算)

假 1 名工程师维护 5 万代码/?行业丞项目经验?:

- 主体代码(97 万)?**~19 人年** 等效维护?- 守门脚本(2.3 万)?**~0.5 人年** 等效维护?- i18n(13.4 万条翻译)?**~1 人年**(?AI 流水线已降至 ~0.3 人年)
- 多协调 ?**×1.3 倍系?*(8 竐?

**等效总维护成??25-27 人年/?*(对应实际 3-4 名全职工程师 + AI agent 协同)?
---

## 三可优化?按收?成本排序)

### ?Storybook 竏 docs/代码不一致低成本高收?立即叿?
- ****:[docs/port-management.md §2.3](file:///g:/IHUI-AI/docs/port-management.md) 声明 Storybook ?8820,?[apps/web/package.json:24](file:///g:/IHUI-AI/apps/web/package.json#L24) 实际?`-p 6006`(?88xx,违反注册表??- **影响**:竏守门脚本?warn,?docs 没人?发困惑?- ****:二一 —?  - A. 改代?`storybook dev -p 8820`(符合注册?
  - B. ?docs ?Storybook 移出 88xx(承豁免)
- **建 A**,5 分钟搞定?
### ?CLI serve 竏 8841 占用"蓝绿部署预留?朳册低成本?
- ****:[apps/cli/src/commands/serve.ts:24](file:///g:/IHUI-AI/apps/cli/src/commands/serve.ts#L24) 占用 8841,?[docs/port-management.md §2.4-2.5](file:///g:/IHUI-AI/docs/port-management.md) 仍写"8840-8849 蓝绿部署预留",?[check-port-registry.mjs 注册表](file:///g:/IHUI-AI/scripts/check-port-registry.mjs#L32) ?8841-8849 但未标注 8841 实际用?- ****:?docs §2 新"2.6 蓝绿部署 / CLI Agent(8840-8849)"小节,显式注册 8841 = CLI Agent Server?
### ?预留空槽过(20/34 = 59% 空置?【低优先级?
- 8807/8808/8809/8819/8822-8829/8831-8839/8840/8842-8849 ?20 丩槽?- **判断**:预留机昐理?段位映射便于扩展),?59% 空置率明扩张度低于规划?- **建**:保留现状(预留不成?,?docs §2 及?空槽位为朝 3 年扩展?非当前务"?
### ?8806 Desktop 废弃占位【低优先级?
- 8806 已废?docs 标注 ~~删除线~~),但注册表仍占位?- **建**:保留 docs 占位(历史追溯价?,?[check-port-registry.mjs 注册表](file:///g:/IHUI-AI/scripts/check-port-registry.mjs#L22-33) 叧?8806(已不在集合内,无需改动)?
### ?守门脚本叐并中等成朸等收益?
- 95 ?.mjs 东大量 audit-migration-* 系列(fix-i18n-deep 1423 ?+ 4 ?audit-migration-* ?3230 ??- **建**:?audit-migration-* 合并?1 ?`audit-migration.mjs --target=frontend-routes|db-fields|api-routes|i18n`,减少脚本数量 + 共享充逻辑?- **风险**:重测守门行为不回归?
### ?LLM provider 配置字扁平??字典化中等成末收益?
- [config.py:39-103](file:///g:/IHUI-AI/apps/ai-service/app/core/config.py#L39-103) ?**24 ?`*_api_key` + 7 ?`*_api_base` 扁平字**,新 provider ?3 ?config.py + .env.example + docker-compose.yml)?- **建**:改为 `llm_providers: dict[str, ProviderConfig]` JSON 配置,新 provider 零代码改?叔 .env)?- **收益**:config.py 减少 ~80 ?.env.example 减少 ~50 ?新 provider 成本?3 处改动降?0 处代码改动?- **风险**:迁移现有 .env 配置,提供 backward-compat shim 1 三?
### ?测栈精简评估【低成本评估,丈朮施?
- 朜发是否真的需?7 丛控?Promtail + Loki + Grafana + Prometheus + Jaeger + OTel + NodeExporter)?
- **建**:朜发拆?`docker-compose.dev.yml`(?db + redis)vs `docker-compose.observability.yml`(全监控),按需吊?- **现状**:已有 `deploy/observability/docker-compose.observability.yml` 狫文件,但根 compose 仍包吅??參虑?compose ?profile?
### ?i18n 26,791 递归 key 必性计高成本高收益?
- 26,791 丒归 key 丏能存?近义重 / 已废弃页面残?key / 次活?key?- **建**:写脚?zh-CN.json 中在但代码?grep 不到引用?key",大率能?10-20%?- **收益**:翻译同成本等比下降?- **风险**:动拼?key(?`t(\`model.${id}\`)`)会?人工甄别?
### ?TODO/FIXME/HACK 733 处技机清理持绽成本?
- 563 TODO + 154 HACK + 16 FIXME,建每个迻清理 10-20 ?- **优先?*:HACK > FIXME > TODO(HACK 多为临时绕过,风险??
### ?多实际用户评估【战略?
- 8 竸 mobile-rn(224 文件 / 2.9 万)?miniapp-taro(551 文件 / 5.9 万)昐有真实用?
- 若某竕期无用户 ?參虑冻结维护(不删代码,但停?§9 全同要求),节省 ~30% 多协调成本?- **判断?*:归属产品决策,非技朆策?
---

## 四一句话结

**竏管理**:14 东?+ 20 ?+ 16 器内 + 17 丱?设规范(单一注册?+ strictPort + 守门脚本),主瑕疵?Storybook docs/代码不一???CLI 8841 朜 docs 注册(?,5 分钟叿?
**维护成本**:~97 万 / 8 ?/ 95 守门脚本 / 44 pre-commit ?/ 24 LLM provider / 5 诨 i18n,等效?25-27 人年/?**核心负担在竐?+ 守门基设施 + i18n + LLM 适配四维**,优化优先??LLM 字典?> ?Storybook 致?> ?测栈精简)> ?守门脚本合并)> ?i18n key 审)?
---


