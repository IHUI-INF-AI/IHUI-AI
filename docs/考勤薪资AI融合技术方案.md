<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 考勤核对 → AI 月度考勤表 → 财务薪资核算 技术方案

> 版本 v1.0 · 2026-11-12 · 状态：待确认
> 目标：一键导入多格式考勤表 → AI 核对 → 生成准确无误的月度考勤表 → 连通财务部 AI 核算工资

---

## 0. 你要的三件事，对应到本方案

| 你的原话 | 方案对应能力 | 现状 |
|---|---|---|
| 一键导入各种格式表格 | 文件导入 + 智能字段映射（Excel/CSV） | ❌ 全新 |
| 一键 AI 生成考勤表，必须准确无误 | 核对引擎 + 异常清单 + 人确认 + 月度汇总 | ⚠️ 有地基（monthlyStats job + attendance-core） |
| 连通财务部 AI 核算工资 | 薪资计算引擎（含社保/个税/加班费） | ❌ 全新（finance.ts 是平台佣金，与员工工资无关） |

**核心结论**：现有 26 条人事端点都是**原子操作**（查/建/审批单条），不是端到端工作流。这份方案补齐三块缺失的引擎，全部复用现有地基（Excel 解析、分片上传、jobs 框架、审批流、AI 工具注册范式），不另起炉灶。

---

## 1. 现有地基（已核实，直接复用）

| 设施 | 位置 | 作用 |
|---|---|---|
| 考勤判定核心 | `@ihui/attendance-core`（`judgeStatus`） | 迟到/早退/缺勤判定唯一真相源，禁止二次实现 |
| 日结任务 | `hr-jobs.ts` → `hr.daily.absent` / `hr.daily.exception` | 每日 00:10 补缺勤、09:00 汇总异常 |
| **月度统计任务** | `hr-jobs.ts` → `hr.monthly.stats`（cron `30 0 1 * *`） | **已存在**！每月 1 日汇总上月各部门考勤 → 这是月度表的直接前置 |
| 幂等任务框架 | `job_runs` 表 + `(job_name, idempotency_key)` 唯一键 | 新任务直接挂进来 |
| 审批流引擎 | `hr-approval-flow.ts`（`APPROVAL_FLOW_CONFIGS` + `resolveApprovalFlow`） | 薪资审批复用 |
| **Excel 解析** | `apps/api/package.json` → `exceljs` + `@e965/xlsx` | **已具备**！导入考勤表直接用 |
| Excel 导出 | `services/excel-export-service.ts` | 生成月度考勤表直接用 |
| 分片上传 | `routes/chunked-upload.ts` + `files.ts` | 大文件导入复用，`resolveDiskPath()` 取磁盘真实路径 |
| AI 工具注册 | `api_tools_bridge.py`（OpenAPI spec → `api_*` 工具） | 新端点自动暴露给 AI |
| 权限范式 | `requirePermission('hr:xxx:view'/'manage')` | 新路由沿用 |

### ⚠️ 关键缺口（必须补，否则薪资算不了）
**`hr_employee` 表没有薪资字段**（已逐字段核实：只有 id/employeeNo/name/departmentId/position/hireDate/status/phone/idNumber）。计算工资缺基数，必须新增薪资配置表。

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│  第一阶段：导入（Import）                                          │
│  Excel/CSV 上传 → 智能字段映射(AI) → 数据校验 → 入库(待核对)        │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  第二阶段：核对（Verify）                                          │
│  与系统考勤记录比对 → 生成差异清单 → 人工确认 → 写入正式考勤表        │
│  【准确无误的关键闸门：差异必须人确认，不自动覆盖】                  │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  第三阶段：生成月度考勤表（Monthly Report）                        │
│  聚合 hr_attendance_record → 月度汇总 → 导出 Excel → 人签字归档     │
│  复用现有 hr.monthly.stats job                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  第四阶段：财务薪资核算（Payroll）← 财务部 AI                      │
│  读月度考勤表 → 算加班费/扣款 → 算社保公积金 → 算个税 → 生薪资单     │
│  【金额红线：算完必须人复核，AI 不自动发放】                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型（新增表）

全部放 `packages/database/src/schema/hr-payroll.ts`，遵循现有 drizzle 范式。

### 3.1 薪资配置（补现有缺口）
```typescript
// 员工薪资配置（一对多历史版本，支持调薪）
hr_salary_config:
  id: uuid PK
  employeeId: uuid FK → hr_employee
  baseSalary: numeric(12,2)      // 月基本工资（税前）
  otBase: numeric(12,2)          // 加班费计算基数（默认=baseSalary，可单独约定）
  housingFundRate: numeric(5,4)  // 公积金个人比例(0.05~0.12)
  insuranceBase: numeric(12,2)   // 社保缴费基数（上下限内的实际值）
  effectiveFrom: date
  effectiveTo: date nullable
  createdBy: uuid FK → users

// 薪资周期（月度）
hr_payroll_period:
  id: uuid PK
  periodMonth: varchar(7) UNIQUE  // 'YYYY-MM'
  status: varchar(20)             // draft|imported|verified|calculated|approved|paid
  attendanceSheetFileId: uuid FK → files  // 生成的月度考勤表 Excel
  closedAt: timestamp nullable
  operatorId: uuid FK → users
```

### 3.2 导入与核对
```typescript
// 导入批次
hr_import_batch:
  id: uuid PK
  periodMonth: varchar(7)
  fileId: uuid FK → files
  fileName: varchar(255)
  fileHash: varchar(64)          // SHA-256，防重复导入
  status: varchar(20)            // parsing|mapped|pending_review|verified|rejected
  totalRows: integer
  matchedRows: integer           // 与系统记录匹配
  conflictRows: integer          // 差异行
  mappingConfig: jsonb           // 字段映射结果（AI 识别的列→字段对应）
  uploadedBy: uuid FK → users

// 导入行明细（暂存，核对通过才写正式表）
hr_import_row:
  id: uuid PK
  batchId: uuid FK → hr_import_batch
  rowNumber: integer
  employeeNo: varchar(50)        // 工号
  raw: jsonb                     // 原始行数据
  parsed: jsonb                  // 解析后结构化
  matchStatus: varchar(20)       // matched|conflict|not_found|duplicate
  diffDetail: jsonb nullable     // 与系统记录的差异详情
  resolved: boolean default false
  resolvedBy: uuid FK → users nullable
```

### 3.3 月度考勤汇总（生成表的持久化）
```typescript
hr_attendance_monthly:
  id: uuid PK
  periodMonth: varchar(7)
  employeeId: uuid FK → hr_employee
  departmentId: uuid FK → hr_department
  scheduledDays: numeric(5,1)    // 应出勤天数（按 workdays 位掩码算）
  actualDays: numeric(5,1)       // 实际出勤
  lateCount: integer
  earlyCount: integer
  absentCount: numeric(5,1)
  leaveDays: jsonb               // {sick:1.5, personal:0, annual:2, ...}
  otHours: numeric(6,2)          // 加班总时长（区分工作日/休息日/节假日）
  otDetail: jsonb                // {weekday:2.5, weekend:8, holiday:0}
  sourceBatchId: uuid FK → hr_import_batch nullable  // 若来自导入
  generatedBy: varchar(20)       // system_job|import|manual
```

### 3.4 薪资明细
```typescript
hr_payroll_item:
  id: uuid PK
  periodId: uuid FK → hr_payroll_period
  employeeId: uuid FK → hr_employee
  baseSalary: numeric(12,2)
  otAmount: numeric(12,2)        // 加班费
  allowance: numeric(12,2)       // 补贴/奖金
  grossPay: numeric(12,2)        // 应发合计
  insurancePersonal: numeric(12,2)   // 社保个人部分
  housingFundPersonal: numeric(12,2) // 公积金个人部分
  taxableIncome: numeric(12,2)   // 本期应纳税所得额（累计预扣法）
  incomeTax: numeric(12,2)       // 个税
  deduction: numeric(12,2)       // 其他扣款（考勤扣款等）
  netPay: numeric(12,2)          // 实发
  breakdown: jsonb               // 完整计算过程（可审计）
  UNIQUE(periodId, employeeId)
```

---

## 4. API 路由（新增）

放 `apps/api/src/routes/hr-attendance-report.ts` + `hr-payroll.ts`，沿用 `buildSchema` + `requirePermission` 范式。

### 4.1 导入（Import）
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/hr/attendance/import` | `hr:attendance:manage` | 上传 Excel/CSV，返回 batchId + AI 字段映射预览 |
| GET | `/hr/attendance/import/:batchId/mapping` | `hr:attendance:view` | 查看字段映射结果 |
| PUT | `/hr/attendance/import/:batchId/mapping` | `hr:attendance:manage` | 人工修正映射 |
| GET | `/hr/attendance/import/:batchId/rows` | `hr:attendance:view` | 分页查导入行（含 matchStatus 筛选） |

### 4.2 核对（Verify）— 准确性闸门
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/hr/attendance/import/:batchId/verify` | `hr:attendance:manage` | 触发核对，生成差异清单 |
| GET | `/hr/attendance/import/:batchId/conflicts` | `hr:attendance:view` | 拉差异行（待处理） |
| PUT | `/hr/attendance/import/row/:rowId/resolve` | `hr:attendance:manage` | 逐行裁决（采用导入值/保留系统值/手动改） |
| POST | `/hr/attendance/import/:batchId/confirm` | `hr:attendance:manage` | **全部裁决完成才能确认，写正式考勤表** |

### 4.3 月度考勤表（Monthly Report）
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/hr/attendance/monthly/generate` | `hr:attendance:manage` | 生成指定月汇总（写 `hr_attendance_monthly`） |
| GET | `/hr/attendance/monthly` | `hr:attendance:view` | 查月度汇总（period + department + employee 筛选） |
| POST | `/hr/attendance/monthly/export` | `hr:attendance:view` | 导出 Excel 月度考勤表（落 files 表，返回 fileId） |
| POST | `/hr/attendance/monthly/sign` | `hr:attendance:manage` | 归档签字（锁定该月，进 payroll 前置） |

### 4.4 薪资核算（Payroll）
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/hr/payroll/config/:employeeId` | `hr:payroll:view` | 查薪资配置 |
| PUT | `/hr/payroll/config/:employeeId` | `hr:payroll:manage` | 设/调薪资（写历史版本） |
| POST | `/hr/payroll/periods` | `hr:payroll:manage` | 开薪资周期 |
| POST | `/hr/payroll/periods/:id/calculate` | `hr:payroll:manage` | **触发算薪**（读月度考勤 → 算加班/社保/个税） |
| GET | `/hr/payroll/periods/:id/items` | `hr:payroll:view` | 查薪资明细 |
| PUT | `/hr/payroll/item/:itemId/adjust` | `hr:payroll:manage` | 手动调整单项（记审计） |
| POST | `/hr/payroll/periods/:id/approve` | `hr:payroll:manage` | 提交审批（走 resolveApprovalFlow） |
| POST | `/hr/payroll/periods/:id/export` | `hr:payroll:view` | 导出薪资单 Excel |

---

## 5. 薪资计算规则（已核实的权威口径）

> ⚠️ 以下为**当前有效规则**，已从权威来源核实。落地时**必须做成可配置项**，因为社保比例各地不同、每年基数会调整。

### 5.1 加班费（劳动法第 44 条，全国统一）

**三档倍数**（来源：[ref_web_ab1b1f0409b42d298eb80a06] 杭州市总工会、[ref_web_759cff0dfe77b1a90cf846fa] 福州鼓楼区政府、[ref_web_307172e4f37699fa2f18da43] 中工网）：

| 加班类型 | 倍数 | 能否调休替代 |
|---|---|---|
| 工作日延时（加点） | **150%**（1.5 倍） | ❌ 只能发钱 |
| 休息日加班且不能补休 | **200%**（2 倍） | ✅ 可安排补休替代，二选一 |
| 法定节假日加班 | **300%**（3 倍） | ❌ 只能发钱，且**不含当日工资**（3 倍 + 节假日工资兼得） |

**计算公式**（月计薪天数 21.75 天，[ref_web_b656a43bdbc9eb5ce3a4f984] 山东法律服务网）：
```
日工资 = 月工资基数 ÷ 21.75
小时工资 = 日工资 ÷ 8

工作日加班费 = 小时工资 × 1.5 × 加班小时
休息日加班费 = 日工资   × 2   × 加班天数   （或安排补休）
节假日加班费 = 日工资   × 3   × 加班天数
```

**加班基数规则**（[ref_web_307172e4f37699fa2f18da43]）：优先按劳动合同约定，但**不得低于当地最低工资标准**；无约定按正常工作时间工资（含基本工资+绩效+奖金等，不能按最低工资算）。→ 系统用 `hr_salary_config.otBase`。

### 5.2 社保与公积金（**各地不同，必须可配置**）

以下为核实到的**示例地区口径**，证明"同险种各地费率有差异"，落地时按参保地配置：

| 险种 | 单位 | 个人 | 来源地区 |
|---|---|---|---|
| 养老保险 | 16% | 8% | 长沙/襄阳/宿迁/福建（全国基本统一）[ref_web_8e9733721c5a144d2a6176a4][ref_web_e79a0ba08e7c63bf7950f05b][ref_web_b8f09f704445e1679a7e2d91][ref_web_291763efa0b8790f507af318] |
| 失业保险 | 0.5%~0.7% | 0.3%~0.5% | 各地不同（襄阳 0.7/0.3、宿迁 0.5/0.5、福建 0.5/0.5） |
| 工伤保险 | 0.2%~2.6%（按行业 8 档） | 0（个人不缴） | 各地 [ref_web_8e9733721c5a144d2a6176a4] |
| 医疗保险 | 7%~8.5% | 2% | 地市统筹，各地有差异 [ref_web_291763efa0b8790f507af318] |
| 生育保险 | 0.35%~0.7% | 0 | 多地已并入医保 |
| 住房公积金 | 5%~12% | 5%~12% | 单位与个人比例须一致 [ref_web_4d9a369eb23dc56f84a0e08d][ref_web_d105331dc3d583f77f3b47ce] |

**社保缴费基数上下限**：按当地上年度社平工资的 60%（下限）~300%（上限）核定，每年调整（[ref_web_291763efa0b8790f507af318]）。→ 系统 `hr_salary_config.insuranceBase` 存核定后的实际基数。

**公积金基数上下限**：各地不同，如郑州 2025 上限 27520/下限 2100、连云港上限 28800/下限 2260（[ref_web_4d9a369eb23dc56f84a0e08d][ref_web_d105331dc3d583f77f3b47ce]）。

> **结论**：社保/公积金**绝不能写死比例**。方案设计 `hr_payroll_config_region` 配置表（参保地 + 险种 + 单位/个人比例 + 基数上下限 + 生效期），由财务维护，算薪时读取。

### 5.3 个人所得税（累计预扣法，全国统一）

**核心机制**（来源：国家税务总局《个人所得税扣缴申报管理办法》 [ref_web_8f6cdeae4de7c7cf590124af]）：

居民个人工资薪金按**累计预扣法**按月预扣：
```
累计预扣预缴应纳税所得额
  = 累计收入 − 累计免税收入 − 累计减除费用 − 累计专项扣除
    − 累计专项附加扣除 − 累计依法确定的其他扣除

累计减除费用 = 5000元/月 × 当年截至本月任职月份数

本期应预扣预缴税额
  = (累计预扣预缴应纳税所得额 × 预扣率 − 速算扣除数)
    − 累计减免税额 − 累计已预扣预缴税额
（余额为负时暂不退税，年度终了汇算清缴多退少补）
```

**综合所得七级超额累进税率（年表）**（[ref_web_fba3186f5b5eb6eefb112feb]）：

| 全年应纳税所得额 | 税率 | 速算扣除数 |
|---|---|---|
| ≤ 36,000 | 3% | 0 |
| 36,000 ~ 144,000 | 10% | 2,520 |
| 144,000 ~ 300,000 | 20% | 16,920 |
| 300,000 ~ 420,000 | 25% | 31,920 |
| 420,000 ~ 660,000 | 30% | 52,920 |
| 660,000 ~ 960,000 | 35% | 85,920 |
| > 960,000 | 45% | 181,920 |

**七项专项附加扣除（2025 执行标准，[ref_web_fba3186f5b5eb6eefb112feb][ref_web_de62c0048de30925829fc4f7]）**：

| 项目 | 标准 |
|---|---|
| 子女教育 | 每孩每月 2000 元（3 岁至博士） |
| 3 岁以下婴幼儿照护 | 每孩每月 2000 元 |
| 赡养老人 | 独生子女 3000/月；非独生分摊每人≤1500/月 |
| 住房贷款利息 | 1000/月（首套，最长 240 月） |
| 住房租金 | 直辖市/省会 1500；百万人口城市 1100；其他 800 |
| 继续教育 | 学历 400/月（≤48 月）；职业资格证书当年 3600 |
| 大病医疗 | 医保目录内自付超 15000 部分，限额 80000 |

> **设计要点**：个税计算需员工填报的**专项附加扣除信息**。系统需新增 `hr_employee_tax_profile` 表（子女数/是否独生/租房或房贷/父母年龄等），或对接个税 APP 数据。扣除标准做成**配置常量 + 生效年度**，政策调整时改配置不改代码。

### 5.4 算薪流水线（单员工）
```
1. 读 hr_attendance_monthly（该员工该月）
2. 读 hr_salary_config（生效版本）
3. 算加班费：
   weekday_ot = otDetail.weekday × (otBase/21.75/8) × 1.5
   weekend_ot = otDetail.weekend × (otBase/21.75)   × 2.0
   holiday_ot = otDetail.holiday × (otBase/21.75)   × 3.0
   otAmount = 三者之和
4. 算考勤扣款（按公司制度，可配置）：
   缺勤扣款 = 缺勤天数 × 日工资
   迟到/早退扣款 = 按制度（可固定金额或累计）
5. grossPay = baseSalary + otAmount + allowance − 考勤扣款
6. 算社保公积金个人部分 = insuranceBase × 各险种个人比例之和
7. 算个税（累计预扣法，需该员工本年累计数据）：
   taxableIncome = grossPay − 5000 − 社保个人 − 公积金个人 − 专项附加扣除
   incomeTax = 累计预扣法(见 5.3)
8. netPay = grossPay − 社保个人 − 公积金个人 − incomeTax − 其他扣款
9. 全程 breakdown jsonb 落库（每步可审计、可复算）
```

---

## 6. 「必须准确无误」如何保障（最关键章节）

你强调准确无误。这块是设计的核心，用了**四道闸门 + 三层对账**：

### 6.1 四道闸门
```
闸门1 文件级：fileHash 防重复导入；行数/金额汇总校验（导入行数=解析行数）
闸门2 字段级：AI 字段映射 → 人确认映射对不对（错列=灾难，必须人过一眼）
闸门3 行级：  核对引擎逐行比对系统考勤 → 差异行 100% 人工裁决，绝不自动覆盖
闸门4 结果级：算薪后抽样/全量复核 → 财务确认 → 审批流 → 才能发放
```

### 6.2 三层对账（自动校验，不靠人眼）
```typescript
// 每次生成月度表/算薪，自动跑对账，不一致就拦截
对账1 行数勾稽：导入总行数 === 解析成功行数 + 失败行数
对账2 状态勾稽：每行 matchStatus 必 ∈ {matched,conflict,not_found,duplicate}，且有裁决
对账3 金额勾稽：grossPay − 五险一金个人 − 个税 − 扣款 === netPay（逐员工复算）
对账4 跨表勾稽：月度表员工数 === 在职员工数（离职的单独标记）
```

### 6.3 可审计 + 可复算
- 每笔薪资的 `breakdown` jsonb 存**完整计算过程**（每一步的输入、公式、中间值）。财务发现某人对不上，点开能看每分钱怎么来的，也能用 breakdown 复算验证。
- 薪资配置走**历史版本**（`effectiveFrom/To`），当月算薪用当月生效版本，回溯不串味。
- 薪资审批走现有 `resolveApprovalFlow`，**发放前必须有审批记录**，AI 不自动发放。

### 6.4 准确性的根本边界（必须说清）
- **规则引擎（加班费/社保/个税公式）是确定性的**，不是 AI「算」——AI 只负责编排和解释，金额由代码按固定公式算，杜绝大模型幻觉算错数。
- **AI 不碰最终金额的裁决权**：AI 能生成考勤表、能算薪资草稿、能解释差异，但「确认无误」「确认发放」一定是人点。这与人事板块已确立的「判断类写操作一律人确认」红线完全一致。

---

## 7. AI 编排（Agent Skill 设计）

新增两个 Agent Skill，复用现有 AI 工具注册范式（`api_tools_bridge.py` 自动把新端点暴露成 `api_*` 工具）。

### 7.1 人事考勤 AI（扩展现有 hr-workflow）
在 `apps/ai-service/app/skills/auto/hr-workflow.md` 增加导入与月度表编排场景：
```
用户："把上个月考勤表导进来核对一下"
AI 编排：
1. [写·需确认] 触发导入 → AI 智能识别字段映射，预览给用户确认
   "识别到 12 列，映射为：工号→employeeNo、上班打卡→checkIn... 对吗？"
2. [只读] 触发核对 → 展示差异清单
   "共 320 行：298 匹配、18 有差异、4 工号没找到。差异我先列出来你裁决"
3. [写·需确认] 逐行/批量裁决差异（AI 给建议，人拍板）
4. [写·需确认] 确认导入 → 写正式考勤表
5. [只读] 生成月度汇总 → 导出 Excel → 给 fileId
```

### 7.2 财务薪资 AI（新建 payroll-workflow skill）
```
用户："算一下 11 月工资"
AI 编排：
1. [前置检查] 该月考勤表是否已签字归档？没归档 → 停，提示先完成考勤
2. [只读] 检查薪资配置完整性 → "3 人没设 baseSalary，先补"
3. [写·需确认] 触发算薪 → 生成薪资明细草稿
4. [只读] 展示汇总 + 异常（"张三加班费 0 但有 8 小时周末加班，周末加班可调休替代，确认吗？"）
5. [写·需确认] 调整单项（记审计）
6. [写·需确认] 提交审批流
7. [写·需确认] 审批通过后导出薪资单
   红线：AI 绝不自动发放工资
```

### 7.3 两个 Skill 的边界（回答你"连通财务部 AI"）
- 人事 AI 负责**考勤准确性**（导入→核对→月度表签字）。
- 财务 AI 负责**薪资核算**（读签字后的月度表→算钱→出薪资单）。
- 两者通过 `hr_attendance_monthly`（签字状态）+ `hr_payroll_period` 衔接。**月度表没签字，财务 AI 拒绝算薪**——这是"准确无误"的跨部门闸门。

---

## 8. 实施分期（建议）

| 期 | 内容 | 工作量 | 依赖 |
|---|---|---|---|
| **M1 导入** | 文件上传 + Excel/CSV 解析 + AI 字段映射 + 入库暂存 | 中 | 复用 exceljs/chunked-upload |
| **M2 核对** | 核对引擎 + 差异清单 + 逐行裁决 + 确认写正式表 | 中 | attendance-core |
| **M3 月度表** | 月度汇总（扩展现有 monthlyStats job）+ 导出 Excel + 签字归档 | 中 | M2 |
| **M4 薪资配置** | salary_config/region_config 表 + 配置界面 | 中 | 补 hr_employee 缺口 |
| **M5 算薪引擎** | 加班费/社保/公积金/个税计算 + breakdown 审计 + 对账 | **大** | M3+M4，规则确认 |
| **M6 薪资审批** | 审批流接入 + 薪资单导出 | 中 | M5 |
| **M7 AI Skill** | 两个 Agent Skill 编排 + 端点注册 | 中 | M1-M6 |

**建议节奏**：M1→M2→M3 先做（纯考勤，无金额风险，能快速见效）；M4→M5→M6 再做（涉及金额，规则要你先确认）。

---

## 9. 需要你确认的关键项（不确认没法准确开发）

### 9.1 薪资规则（最高优先，影响 M5）
1. **参保城市**是哪里？决定社保/公积金比例和基数上下限（各地差异大）。
2. **个税专项附加扣除**：员工信息怎么来？
   - 方案 A：系统内建表单让员工填（子女数/是否独生/租房等），系统算。
   - 方案 B：财务从个税 APP 导出扣除信息，导入系统。
   - 你倾向哪个？
3. **考勤扣款制度**：迟到/早退/缺勤怎么扣？（固定金额 / 按比例 / 累计阶梯？）有没有制度文档？
4. **加班费基数**：默认=基本工资，还是=基本工资+绩效+奖金？公司劳动合同怎么约定的？

### 9.2 数据与边界
5. 考勤导入表的**标准格式**有没有模板？还是各种乱格式都要 AI 认？（影响 M1 复杂度）
6. 财务部现在怎么算工资的？（Excel 手算 / 其他软件？）要不要迁移历史数据？
7. **薪资数据可见性**：普通员工能看自己薪资单吗？薪资权限是否只有财务+老板？（涉及权限表设计）
8. 是否需要**工资条**发放功能（推送给员工）？还是只出表给财务？

### 9.3 范围确认
9. 这一版要不要包含**离职员工**的薪资结算（当月在职天数折算）？
10. 要不要**年终奖/13 薪**单独计税（全年一次性奖金单独计税 vs 并入综合所得）？

---

## 10. 风险清单

| 风险 | 等级 | 缓解 |
|---|---|---|
| 社保/个税规则各地不同、每年变 | 高 | 全部做成配置表 + 生效期，不写死代码；政策变了改配置 |
| AI 字段映射认错列 | 高 | 映射结果必须人确认（闸门2），错列不进库 |
| 核对自动覆盖系统记录 | 高 | 差异 100% 人工裁决（闸门3），绝不自动覆盖 |
| AI 幻觉算错金额 | 高 | 金额由确定性代码算，AI 只编排不裁决（见 6.4） |
| 员工薪资数据泄露 | 高 | 严格权限（hr:payroll:view）+ 审计日志 + 看自己只能看自己的 |
| 月度表没核对就进薪资 | 高 | 跨部门闸门：月度表未签字，财务 AI 拒绝算薪 |
| hr_employee 无薪资字段 | 中 | M4 先补表 + 迁移脚本，否则算不了 |
| Excel 公式不重算 | 低 | 已知约束，导出用数值覆盖（workbook-service 注释已提示） |

---

## 11. 下一步

你先看第 9 节的确认项，尤其是 **9.1 薪资规则**（参保城市、个税扣除方式、考勤扣款制度、加班基数）。这几项定了，M5 算薪引擎才能保证"准确无误"。

确认后我建议从 **M1 导入 + M2 核对** 开始动手（无金额风险、见效快），M5 算薪等规则对齐再上。

> 引用来源：国家税务总局政策法规库 [ref_web_8f6cdeae4de7c7cf590124af]、12366 纳税服务平台 [ref_web_f50bcafe1b215d4d7aebb6f8]、杭州市总工会 [ref_web_ab1b1f0409b42d298eb80a06]、福州市鼓楼区政府 [ref_web_759cff0dfe77b1a90cf846fa]、中工网 [ref_web_307172e4f37699fa2f18da43]、山东法律服务网 [ref_web_b656a43bdbc9eb5ce3a4f984]、长沙市人社局 [ref_web_8e9733721c5a144d2a6176a4]、湖北省政府 [ref_web_e79a0ba08e7c63bf7950f05b]、宿迁市人社局 [ref_web_b8f09f704445e1679a7e2d91]、福建省税务局 [ref_web_291763efa0b8790f507af318]、郑州公积金中心 [ref_web_4d9a369eb23dc56f84a0e08d]、连云港市政府 [ref_web_d105331dc3d583f77f3b47ce]、驻马店幼专 [ref_web_de62c0048de30925829fc4f7]。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
