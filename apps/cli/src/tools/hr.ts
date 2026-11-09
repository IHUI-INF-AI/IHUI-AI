// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 人事考勤(HR)工具族 —— AI 对话框可调用操作考勤/部门/员工/请假。
 *
 * 设计定位:这是「API 路由 → AI 工具」自动暴露模式的第一个落地域(模板)。
 * 每个工具对应 apps/api/src/routes/hr-attendance.ts 的一个端点;
 * 入参直接透传给后端,权限复用路由既有的 RBAC(hr:attendance:view / hr:attendance:manage)。
 *
 * 鉴权:本工具通过 HTTP 调产品 API。base URL 取 process.env.IHUI_API_BASE_URL(默认
 * http://127.0.0.1:8802),Bearer token 取 process.env.IHUI_API_TOKEN。
 * 真实部署应将当前用户会话 token 注入该 env / ctx(CLI agent 与产品前端的会话打通处),
 * 此处先留可配置出口,不写死凭证。
 */

import type { Tool, ToolParameter } from './index.js'

const HR_API_BASE = process.env.IHUI_API_BASE_URL ?? 'http://127.0.0.1:8802'

function hrToken(): string | undefined {
  return process.env.IHUI_API_TOKEN
}

async function callHrApi(
  path: string,
  opts: { method?: string; body?: unknown; query?: Record<string, unknown>; token?: string } = {},
): Promise<unknown> {
  const url = new URL(`/api/hr-attendance${path}`, HR_API_BASE)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  const headers: Record<string, string> = { accept: 'application/json' }
  const token = opts.token ?? hrToken()
  if (token) headers['authorization'] = `Bearer ${token}`
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  if (!res.ok) {
    const payload = (json as { error?: unknown; message?: unknown }) ?? {}
    const msg = payload.error ?? payload.message ?? text
    throw new Error(`hr-attendance ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`)
  }
  const data = (json as { data?: unknown })?.data
  return data !== undefined ? data : json
}

interface MkOpts {
  name: string
  description: string
  parameters: Record<string, ToolParameter>
  required?: string[]
  dangerLevel?: 'read' | 'write' | 'dangerous'
  run: (args: Record<string, unknown>) => Promise<unknown>
}

function mk(o: MkOpts): Tool {
  return {
    name: o.name,
    description: o.description,
    parameters: o.parameters,
    required: o.required ?? [],
    dangerLevel: o.dangerLevel ?? 'read',
    execute: async (args) => {
      try {
        const data = await o.run(args)
        return {
          success: true,
          output: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        }
      } catch (e) {
        return { success: false, output: '', error: e instanceof Error ? e.message : String(e) }
      }
    },
  }
}

const str = (description: string): ToolParameter => ({ type: 'string', description })
const num = (description: string): ToolParameter => ({ type: 'number', description })
const bool = (description: string): ToolParameter => ({ type: 'boolean', description })
const enumStr = (description: string, values: string[]): ToolParameter => ({
  type: 'string',
  description,
  enum: values,
})

export const HR_TOOLS: Tool[] = [
  mk({
    name: 'hr_department_list',
    description: '列出所有人事部门(只读)。无需参数。',
    parameters: {},
    required: [],
    dangerLevel: 'read',
    run: () => callHrApi('/departments', { query: {} }),
  }),
  mk({
    name: 'hr_department_create',
    description: '新建人事部门(需 hr:attendance:manage)。',
    parameters: {
      name: str('部门名称'),
      parentId: str('上级部门 ID(uuid,可选)'),
      leaderEmployeeId: str('负责人员工 ID(uuid,可选)'),
      sortOrder: num('排序序号(可选)'),
    },
    required: ['name'],
    dangerLevel: 'write',
    run: (a) => callHrApi('/departments', { method: 'POST', body: a }),
  }),
  mk({
    name: 'hr_employee_list',
    description: '查询员工列表(只读),可按部门/状态筛选。',
    parameters: {
      departmentId: str('部门 ID(uuid,可选)'),
      status: str('员工状态筛选(可选)'),
    },
    required: [],
    dangerLevel: 'read',
    run: (a) => callHrApi('/employees', { query: a }),
  }),
  mk({
    name: 'hr_employee_create',
    description: '新建员工档案(需 hr:attendance:manage)。',
    parameters: {
      userId: str('关联用户 ID(uuid,可选)'),
      employeeNo: str('工号'),
      name: str('姓名'),
      departmentId: str('所属部门 ID(uuid)'),
      position: str('岗位(可选)'),
      hireDate: str('入职日期 YYYY-MM-DD(可选)'),
      phone: str('手机号(可选)'),
      idNumber: str('证件号(可选)'),
    },
    required: ['employeeNo', 'name', 'departmentId'],
    dangerLevel: 'write',
    run: (a) => callHrApi('/employees', { method: 'POST', body: a }),
  }),
  mk({
    name: 'hr_attendance_rule_get',
    description: '读取某部门的考勤规则(只读),departmentId 必填。',
    parameters: { departmentId: str('部门 ID(uuid)') },
    required: ['departmentId'],
    dangerLevel: 'read',
    run: (a) => callHrApi('/attendance/rule', { query: { departmentId: a.departmentId } }),
  }),
  mk({
    name: 'hr_attendance_rule_upsert',
    description: '新建/更新部门考勤规则(需 hr:attendance:manage)。',
    parameters: {
      departmentId: str('部门 ID(uuid)'),
      lateAfter: str('迟到阈值 HH:MM(可选)'),
      earlyBefore: str('早退阈值 HH:MM(可选)'),
      absentAfter: str('缺勤阈值 HH:MM(可选)'),
      workdays: num('工作日掩码 1..127(可选)'),
      enabled: bool('是否启用(可选)'),
    },
    required: ['departmentId'],
    dangerLevel: 'write',
    run: (a) => callHrApi('/attendance/rule', { method: 'PUT', body: a }),
  }),
  mk({
    name: 'hr_attendance_check_in',
    description: '员工签到(需登录)。',
    parameters: {
      employeeId: str('员工 ID(uuid)'),
      departmentId: str('部门 ID(uuid)'),
      date: str('签到日期 YYYY-MM-DD'),
      checkInMethod: enumStr('签到方式', ['self', 'qrcode', 'manual']),
      checkInTimeRaw: str('签到时刻 HH:MM:SS(可选)'),
      remark: str('备注(可选)'),
    },
    required: ['employeeId', 'departmentId', 'date', 'checkInMethod'],
    dangerLevel: 'write',
    run: (a) => callHrApi('/attendance/check-in', { method: 'POST', body: a }),
  }),
  mk({
    name: 'hr_attendance_check_out',
    description: '员工签退(需登录)。',
    parameters: {
      employeeId: str('员工 ID(uuid)'),
      departmentId: str('部门 ID(uuid)'),
      date: str('签退日期 YYYY-MM-DD'),
      checkOutTimeRaw: str('签退时刻 HH:MM:SS'),
    },
    required: ['employeeId', 'departmentId', 'date', 'checkOutTimeRaw'],
    dangerLevel: 'write',
    run: (a) => callHrApi('/attendance/check-out', { method: 'POST', body: a }),
  }),
  mk({
    name: 'hr_attendance_backfill',
    description: '手动触发缺勤补录(等价于定时任务一轮,需 hr:attendance:manage)。',
    parameters: { backfillDays: num('补录天数 1..30(可选,默认见后端)') },
    required: [],
    dangerLevel: 'write',
    run: (a) => callHrApi('/attendance/backfill', { method: 'POST', body: a }),
  }),
  mk({
    name: 'hr_attendance_records',
    description: '查询考勤记录列表(只读),支持员工/部门/日期区间/分页筛选。',
    parameters: {
      employeeId: str('员工 ID(uuid,可选)'),
      departmentId: str('部门 ID(uuid,可选)'),
      date: str('具体日期 YYYY-MM-DD(可选)'),
      startDate: str('起始日期 YYYY-MM-DD(可选)'),
      endDate: str('结束日期 YYYY-MM-DD(可选)'),
      limit: num('每页条数(可选,默认 50)'),
      offset: num('偏移量(可选)'),
    },
    required: [],
    dangerLevel: 'read',
    run: (a) => callHrApi('/attendance/records', { query: a }),
  }),
  mk({
    name: 'hr_attendance_stats',
    description: '获取考勤统计(只读),可按部门与日期区间聚合。',
    parameters: {
      departmentId: str('部门 ID(uuid,可选)'),
      startDate: str('起始日期 YYYY-MM-DD(可选)'),
      endDate: str('结束日期 YYYY-MM-DD(可选)'),
    },
    required: [],
    dangerLevel: 'read',
    run: (a) => callHrApi('/attendance/stats', { query: a }),
  }),
  mk({
    name: 'hr_leave_list',
    description: '查询请假单列表(只读),支持员工/部门/状态/日期区间筛选。',
    parameters: {
      employeeId: str('员工 ID(uuid,可选)'),
      departmentId: str('部门 ID(uuid,可选)'),
      status: str('状态筛选 pending/approved/rejected/cancelled(可选)'),
      startDate: str('起始日期 YYYY-MM-DD(可选)'),
      endDate: str('结束日期 YYYY-MM-DD(可选)'),
    },
    required: [],
    dangerLevel: 'read',
    run: (a) => callHrApi('/leave', { query: a }),
  }),
  mk({
    name: 'hr_leave_create',
    description: '提交请假申请(需登录)。',
    parameters: {
      employeeId: str('员工 ID(uuid)'),
      departmentId: str('部门 ID(uuid)'),
      leaveType: str('请假类型'),
      startDate: str('起始日期 YYYY-MM-DD'),
      endDate: str('结束日期 YYYY-MM-DD'),
      totalDays: num('请假总天数'),
      reason: str('请假事由'),
      attachment: str('附件地址(可选)'),
    },
    required: ['employeeId', 'departmentId', 'leaveType', 'startDate', 'endDate', 'totalDays', 'reason'],
    dangerLevel: 'write',
    run: (a) => callHrApi('/leave', { method: 'POST', body: a }),
  }),
  mk({
    name: 'hr_leave_approve',
    description: '审批请假单(需 hr:attendance:manage):批准或驳回。',
    parameters: {
      id: str('请假单 ID(uuid)'),
      decision: enumStr('审批决定', ['approved', 'rejected']),
      approveRemark: str('审批意见(可选)'),
    },
    required: ['id', 'decision'],
    dangerLevel: 'write',
    run: (a) =>
      callHrApi(`/leave/${a.id}/approve`, {
        method: 'PUT',
        body: { decision: a.decision, approveRemark: a.approveRemark },
      }),
  }),
]
