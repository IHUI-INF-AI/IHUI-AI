// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * hr 工具族 —— 由 scripts/gen-ai-tools-from-routes.mjs 从清单自动生成。
 * 手工修改请改清单后重跑生成器,不要直接改本文件。
 */
import { createRouteTools, type RouteToolSpec } from './route-tools.js'

const HR_SPECS: RouteToolSpec[] = [
  {
    "name": "hr_department_list",
    "description": "列出所有人事部门(只读)。无需参数。",
    "method": "GET",
    "path": "/api/hr-attendance/departments"
  },
  {
    "name": "hr_department_create",
    "description": "新建人事部门(需 hr:attendance:manage)。",
    "method": "POST",
    "path": "/api/hr-attendance/departments",
    "params": [
      {
        "name": "name",
        "type": "string",
        "description": "部门名称",
        "required": true
      },
      {
        "name": "parentId",
        "type": "string",
        "description": "上级部门 ID(uuid,可选)"
      },
      {
        "name": "leaderEmployeeId",
        "type": "string",
        "description": "负责人员工 ID(uuid,可选)"
      },
      {
        "name": "sortOrder",
        "type": "number",
        "description": "排序序号(可选)"
      }
    ]
  },
  {
    "name": "hr_employee_list",
    "description": "查询员工列表(只读),可按部门/状态筛选。",
    "method": "GET",
    "path": "/api/hr-attendance/employees",
    "params": [
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid,可选)"
      },
      {
        "name": "status",
        "type": "string",
        "description": "员工状态筛选(可选)"
      }
    ]
  },
  {
    "name": "hr_employee_create",
    "description": "新建员工档案(需 hr:attendance:manage)。",
    "method": "POST",
    "path": "/api/hr-attendance/employees",
    "params": [
      {
        "name": "userId",
        "type": "string",
        "description": "关联用户 ID(uuid,可选)"
      },
      {
        "name": "employeeNo",
        "type": "string",
        "description": "工号",
        "required": true
      },
      {
        "name": "name",
        "type": "string",
        "description": "姓名",
        "required": true
      },
      {
        "name": "departmentId",
        "type": "string",
        "description": "所属部门 ID(uuid)",
        "required": true
      },
      {
        "name": "position",
        "type": "string",
        "description": "岗位(可选)"
      },
      {
        "name": "hireDate",
        "type": "string",
        "description": "入职日期 YYYY-MM-DD(可选)"
      },
      {
        "name": "phone",
        "type": "string",
        "description": "手机号(可选)"
      },
      {
        "name": "idNumber",
        "type": "string",
        "description": "证件号(可选)"
      }
    ]
  },
  {
    "name": "hr_attendance_rule_get",
    "description": "读取某部门的考勤规则(只读),departmentId 必填。",
    "method": "GET",
    "path": "/api/hr-attendance/attendance/rule",
    "params": [
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid)",
        "required": true
      }
    ]
  },
  {
    "name": "hr_attendance_rule_upsert",
    "description": "新建/更新部门考勤规则(需 hr:attendance:manage)。",
    "method": "PUT",
    "path": "/api/hr-attendance/attendance/rule",
    "params": [
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid)",
        "required": true
      },
      {
        "name": "lateAfter",
        "type": "string",
        "description": "迟到阈值 HH:MM(可选)"
      },
      {
        "name": "earlyBefore",
        "type": "string",
        "description": "早退阈值 HH:MM(可选)"
      },
      {
        "name": "absentAfter",
        "type": "string",
        "description": "缺勤阈值 HH:MM(可选)"
      },
      {
        "name": "workdays",
        "type": "number",
        "description": "工作日掩码 1..127(可选)"
      },
      {
        "name": "enabled",
        "type": "boolean",
        "description": "是否启用(可选)"
      }
    ]
  },
  {
    "name": "hr_attendance_check_in",
    "description": "员工签到(需登录)。",
    "method": "POST",
    "path": "/api/hr-attendance/attendance/check-in",
    "params": [
      {
        "name": "employeeId",
        "type": "string",
        "description": "员工 ID(uuid)",
        "required": true
      },
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid)",
        "required": true
      },
      {
        "name": "date",
        "type": "string",
        "description": "签到日期 YYYY-MM-DD",
        "required": true
      },
      {
        "name": "checkInMethod",
        "type": "string",
        "description": "签到方式",
        "required": true,
        "enum": [
          "self",
          "qrcode",
          "manual"
        ]
      },
      {
        "name": "checkInTimeRaw",
        "type": "string",
        "description": "签到时刻 HH:MM:SS(可选)"
      },
      {
        "name": "remark",
        "type": "string",
        "description": "备注(可选)"
      }
    ]
  },
  {
    "name": "hr_attendance_check_out",
    "description": "员工签退(需登录)。",
    "method": "POST",
    "path": "/api/hr-attendance/attendance/check-out",
    "params": [
      {
        "name": "employeeId",
        "type": "string",
        "description": "员工 ID(uuid)",
        "required": true
      },
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid)",
        "required": true
      },
      {
        "name": "date",
        "type": "string",
        "description": "签退日期 YYYY-MM-DD",
        "required": true
      },
      {
        "name": "checkOutTimeRaw",
        "type": "string",
        "description": "签退时刻 HH:MM:SS",
        "required": true
      }
    ]
  },
  {
    "name": "hr_attendance_backfill",
    "description": "手动触发缺勤补录(等价于定时任务一轮,需 hr:attendance:manage)。",
    "method": "POST",
    "path": "/api/hr-attendance/attendance/backfill",
    "params": [
      {
        "name": "backfillDays",
        "type": "number",
        "description": "补录天数 1..30(可选,默认见后端)"
      }
    ]
  },
  {
    "name": "hr_attendance_records",
    "description": "查询考勤记录列表(只读),支持员工/部门/日期区间/分页筛选。",
    "method": "GET",
    "path": "/api/hr-attendance/attendance/records",
    "params": [
      {
        "name": "employeeId",
        "type": "string",
        "description": "员工 ID(uuid,可选)"
      },
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid,可选)"
      },
      {
        "name": "date",
        "type": "string",
        "description": "具体日期 YYYY-MM-DD(可选)"
      },
      {
        "name": "startDate",
        "type": "string",
        "description": "起始日期 YYYY-MM-DD(可选)"
      },
      {
        "name": "endDate",
        "type": "string",
        "description": "结束日期 YYYY-MM-DD(可选)"
      },
      {
        "name": "limit",
        "type": "number",
        "description": "每页条数(可选,默认 50)"
      },
      {
        "name": "offset",
        "type": "number",
        "description": "偏移量(可选)"
      }
    ]
  },
  {
    "name": "hr_attendance_stats",
    "description": "获取考勤统计(只读),可按部门与日期区间聚合。",
    "method": "GET",
    "path": "/api/hr-attendance/attendance/stats",
    "params": [
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid,可选)"
      },
      {
        "name": "startDate",
        "type": "string",
        "description": "起始日期 YYYY-MM-DD(可选)"
      },
      {
        "name": "endDate",
        "type": "string",
        "description": "结束日期 YYYY-MM-DD(可选)"
      }
    ]
  },
  {
    "name": "hr_leave_list",
    "description": "查询请假单列表(只读),支持员工/部门/状态/日期区间筛选。",
    "method": "GET",
    "path": "/api/hr-attendance/leave",
    "params": [
      {
        "name": "employeeId",
        "type": "string",
        "description": "员工 ID(uuid,可选)"
      },
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid,可选)"
      },
      {
        "name": "status",
        "type": "string",
        "description": "状态筛选 pending/approved/rejected/cancelled(可选)"
      },
      {
        "name": "startDate",
        "type": "string",
        "description": "起始日期 YYYY-MM-DD(可选)"
      },
      {
        "name": "endDate",
        "type": "string",
        "description": "结束日期 YYYY-MM-DD(可选)"
      }
    ]
  },
  {
    "name": "hr_leave_create",
    "description": "提交请假申请(需登录)。",
    "method": "POST",
    "path": "/api/hr-attendance/leave",
    "params": [
      {
        "name": "employeeId",
        "type": "string",
        "description": "员工 ID(uuid)",
        "required": true
      },
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid)",
        "required": true
      },
      {
        "name": "leaveType",
        "type": "string",
        "description": "请假类型",
        "required": true
      },
      {
        "name": "startDate",
        "type": "string",
        "description": "起始日期 YYYY-MM-DD",
        "required": true
      },
      {
        "name": "endDate",
        "type": "string",
        "description": "结束日期 YYYY-MM-DD",
        "required": true
      },
      {
        "name": "totalDays",
        "type": "number",
        "description": "请假总天数",
        "required": true
      },
      {
        "name": "reason",
        "type": "string",
        "description": "请假事由",
        "required": true
      },
      {
        "name": "attachment",
        "type": "string",
        "description": "附件地址(可选)"
      }
    ]
  },
  {
    "name": "hr_leave_approve",
    "description": "审批请假单(需 hr:attendance:manage):批准或驳回。",
    "method": "PUT",
    "path": "/api/hr-attendance/leave/:id/approve",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "请假单 ID(uuid)",
        "required": true
      }
    ],
    "params": [
      {
        "name": "decision",
        "type": "string",
        "description": "审批决定",
        "required": true,
        "enum": [
          "approved",
          "rejected"
        ]
      },
      {
        "name": "approveRemark",
        "type": "string",
        "description": "审批意见(可选)"
      }
    ]
  },
  {
    "name": "hr_job_list",
    "description": "列出人事定时任务清单(名字/说明/cron,只读,需 hr:attendance:manage)。",
    "method": "GET",
    "path": "/api/hr-jobs"
  },
  {
    "name": "hr_job_run",
    "description": "手动补跑指定人事定时任务(高危,需 hr:attendance:manage)。",
    "method": "POST",
    "path": "/api/hr-jobs/:name/run",
    "pathParams": [
      {
        "name": "name",
        "type": "string",
        "description": "任务名 hr.daily.absent / hr.daily.exception / hr.monthly.stats",
        "required": true
      }
    ],
    "params": [
      {
        "name": "date",
        "type": "string",
        "description": "业务日 YYYY-MM-DD(可选,缺省=当下;用于补历史某天)"
      }
    ]
  },
  {
    "name": "hr_daily_list",
    "description": "查询考勤日结列表(只读,需 hr:attendance:manage)。每员工每部门每天一行,含应出勤/实出勤/迟到早退加班分钟。",
    "method": "GET",
    "path": "/api/hr-daily/daily",
    "params": [
      {
        "name": "employeeId",
        "type": "string",
        "description": "员工 ID(uuid,可选)"
      },
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid,可选)"
      },
      {
        "name": "month",
        "type": "string",
        "description": "月份 YYYY-MM(可选)"
      },
      {
        "name": "limit",
        "type": "number",
        "description": "分页大小(可选,默认 50)"
      },
      {
        "name": "offset",
        "type": "number",
        "description": "分页偏移(可选,默认 0)"
      }
    ]
  },
  {
    "name": "hr_leave_balance_get",
    "description": "查询假期额度(只读,需 hr:attendance:manage)。按员工×假别×年度,含总额/已用/冻结/剩余天数。",
    "method": "GET",
    "path": "/api/hr-daily/leave-balance",
    "params": [
      {
        "name": "employeeId",
        "type": "string",
        "description": "员工 ID(uuid,可选)"
      },
      {
        "name": "leaveType",
        "type": "string",
        "description": "假别 sick/personal/annual/marriage/maternity/other(可选)"
      },
      {
        "name": "year",
        "type": "number",
        "description": "年度(可选)"
      }
    ]
  },
  {
    "name": "hr_punch_fix_submit",
    "description": "提交补卡申请(写操作,需 hr:attendance:manage)。员工漏打卡时发起,审批通过后回写考勤记录。",
    "method": "POST",
    "path": "/api/hr-daily/punch-fix",
    "params": [
      {
        "name": "employeeId",
        "type": "string",
        "description": "员工 ID(uuid)",
        "required": true
      },
      {
        "name": "departmentId",
        "type": "string",
        "description": "部门 ID(uuid)",
        "required": true
      },
      {
        "name": "date",
        "type": "string",
        "description": "补卡日期 YYYY-MM-DD",
        "required": true
      },
      {
        "name": "punchType",
        "type": "string",
        "description": "补卡类型 check_in(补签到)/check_out(补签退)",
        "required": true,
        "enum": [
          "check_in",
          "check_out"
        ]
      },
      {
        "name": "punchTime",
        "type": "string",
        "description": "补卡时刻 ISO8601(可选)"
      },
      {
        "name": "reason",
        "type": "string",
        "description": "补卡事由(必填)",
        "required": true
      }
    ]
  },
  {
    "name": "hr_punch_fix_approve",
    "description": "审批补卡申请(写操作,需 hr:attendance:manage)。通过则回写考勤记录的签到/签退时刻。",
    "method": "PUT",
    "path": "/api/hr-daily/punch-fix/:id/approve",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "补卡申请 ID(uuid)",
        "required": true
      }
    ],
    "params": [
      {
        "name": "approve",
        "type": "boolean",
        "description": "是否通过(true=通过回写考勤/false=驳回)",
        "required": true
      },
      {
        "name": "approveRemark",
        "type": "string",
        "description": "审批意见(可选)"
      }
    ]
  },
  {
    "name": "hr_approval_flow_list",
    "description": "列出请假审批规则(只读,需 hr:attendance:manage)。假别×天数区间→审批链,active 未软删。",
    "method": "GET",
    "path": "/api/hr-approval/flows"
  },
  {
    "name": "hr_approval_flow_upsert",
    "description": "新建/更新请假审批规则(写操作,需 hr:attendance:manage)。带 id 更新、不带新建。",
    "method": "POST",
    "path": "/api/hr-approval/flows",
    "params": [
      {
        "name": "id",
        "type": "string",
        "description": "规则 ID(uuid,可选;带则更新)"
      },
      {
        "name": "leaveType",
        "type": "string",
        "description": "假别",
        "required": true
      },
      {
        "name": "minDays",
        "type": "number",
        "description": "最少天数(含)",
        "required": true
      },
      {
        "name": "maxDays",
        "type": "number",
        "description": "最多天数(不含,可空=无上界,可选)"
      },
      {
        "name": "approverIds",
        "type": "array",
        "description": "有序审批链(审批人 user id 列表)",
        "required": true,
        "items": {
          "name": "item",
          "type": "string",
          "description": "审批人 user id(uuid)"
        }
      },
      {
        "name": "approverProxyId",
        "type": "string",
        "description": "可选代理审批人 user id(可选)"
      },
      {
        "name": "timeoutHours",
        "type": "number",
        "description": "审批时限小时(可选,默认 24)"
      },
      {
        "name": "escalationApproverId",
        "type": "string",
        "description": "超时升级目标 user id(可选)"
      },
      {
        "name": "status",
        "type": "string",
        "description": "active/disabled(可选,默认 active)",
        "enum": [
          "active",
          "disabled"
        ]
      }
    ]
  },
  {
    "name": "hr_approval_submit",
    "description": "提交请假单进审批流(写操作,需 hr:attendance:manage)。按假别×天数区间路由规则→落审批实例,通知首位审批人。",
    "method": "POST",
    "path": "/api/hr-approval/leave/:id/submit",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "请假单 ID(uuid)",
        "required": true
      }
    ]
  },
  {
    "name": "hr_approval_decide",
    "description": "审批决策(写操作,需 hr:attendance:manage)。当前步审批人通过/驳回,通过则推进到下一步或终态,通知下一审批人。",
    "method": "PUT",
    "path": "/api/hr-approval/leave/:id/decide",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "审批实例 ID(uuid)",
        "required": true
      }
    ],
    "params": [
      {
        "name": "decision",
        "type": "string",
        "description": "决策 approved(通过)/rejected(驳回)",
        "required": true,
        "enum": [
          "approved",
          "rejected"
        ]
      },
      {
        "name": "remark",
        "type": "string",
        "description": "审批意见(可选)"
      }
    ]
  },
  {
    "name": "hr_approval_pending_list",
    "description": "列出某审批人的待处理审批实例(只读,需 hr:attendance:manage)。",
    "method": "GET",
    "path": "/api/hr-approval/instances",
    "params": [
      {
        "name": "approverId",
        "type": "string",
        "description": "审批人 user id(uuid)",
        "required": true
      },
      {
        "name": "limit",
        "type": "number",
        "description": "分页大小(可选,默认 20)"
      },
      {
        "name": "offset",
        "type": "number",
        "description": "分页偏移(可选,默认 0)"
      }
    ]
  },
  {
    "name": "hr_approval_escalate",
    "description": "手动触发超时升级扫描(写操作,需 hr:attendance:manage)。把到点未决的审批节点升级给 escalation_approver_id。通常由 cron 每 30 分钟自动执行。",
    "method": "POST",
    "path": "/api/hr-approval/instances/escalate",
    "params": [
      {
        "name": "now",
        "type": "string",
        "description": "以指定时刻判定超时 ISO8601(可选,缺省=当下)"
      }
    ]
  }
]

export const HR_TOOLS = createRouteTools(HR_SPECS)
