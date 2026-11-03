<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# F-workbook 席位心跳(goal-b45,rea 逆向 Qoder xlsx-sidecar ⇒ 本仓补齐)

状态:**已开工**
HEAD(开工现读):`a1e6e0e78415d00fdfc556fd59723d307f3867e8`(branch main)
派单口径:对照件 `xlsx-sidecar.exe` 的 `open/read_range/writeCells/save_archive` 那一格,
本仓做成「api 侧工作簿读写面 + ai-service 侧 agent 工具」,**不加任何依赖**。

## 一、现状格复核(逐条现读,派单声明 vs 实测)

| 派单声明 | 复核结果 |
| --- | --- |
| `apps/api/src/services/excel-export-service.ts:17` `import ExcelJS from 'exceljs'` | **成立**(现读该行即 import);`:118` `new ExcelJS.Workbook()` 成立;`:251` 读侧同款(`importFromExcel` 里 load) |
| `apps/api/package.json:79 "exceljs": "^4.4.0"` | **成立**;实装 `node_modules/.pnpm/exceljs@4.4.0/` 在场 ⇒ 零新依赖可落地 |
| `apps/api/src/services/document-parser.ts:274` XLSX/XLSM 读(exceljs 优先、xlsx 降级) | **成立**(该行为注释「XLSX / XLSM:exceljs 优先,xlsx 库降级」,下一行进 `parseXlsx`) |
| `apps/ai-service/app/tools/document_tools.py` xlsx 面只读 | **成立**:`_parse_xlsx`(:248)走 zipfile+ElementTree 出 TSV,无任何写回/句柄面 |
| `edu-canteen.test.ts:601` 有真跑不 mock 的全链路用例 | **成立**(逐字现读:`apps/api/src/routes/__tests__/edu-canteen.test.ts:601` 注记「excel-export-service(ExcelJS)真实运行不 mock,验证导出全链路」;本席一度在 `services/__tests__/` 找 ⇒ 记一次取材面错误,路径以 routes/__tests__ 为准) |
| 跨端调用既有形态 = `knowledge_writer.py` + `api/v1/knowledge_write.py` | **成立**,并另找到更贴本席的一支:`api_tools_bridge.py:98` / `automation_tools.py:188` 用 `internal_service_headers(uid, "api-tools", legacy_token=...)` 走内部票通道 ⇒ 本席用它,**不新开票种**(`INTERNAL_TICKET_SCOPES` 是封闭集,新增要两侧同笔,禁改 `internal_ticket.py`) |
| api 侧鉴权出口 | 现读:混合通道唯一出口 = `apps/api/src/plugins/auth.ts:382 checkAuthOrInternalService`(JWT 优先,失败降级内部票,票/令牌验过后注入 `request.userId`);归属判据 = `apps/api/src/db/file-queries.ts:28 canAccessFile` |

## 二、口径决定(写进代码注释)

- 非破坏式保存:写操作**一律落新文件**,绝不覆盖输入档(与对照件 `save_archive` 的写回不同形,是**有意的取舍**)。
- 公式那一格**不做重算**:exceljs 无计算引擎,`read_range` 读到公式单元格**不得**返回缓存值
  (AGENTS §0.3 在产品数据上的等价形态:取不到真值不许拿旧值冒充);含公式工作簿被改动后结果带
  `recalc_unsupported: true`。
- 身份:归属主体只认承载层注入(api 侧 `request.userId`;MCP 侧 `__user_id`),模型/客户端自报一律不入判据
  (`ROUTING_IDENTITY_KEYS` 纪律)。

## 三、节拍

- 00:00 开工,现状格复核完毕。
- 待:api 服务层 → api 路由 → ai-service 客户端+工具 → 双端测试 → 水印 → 验证命令。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
