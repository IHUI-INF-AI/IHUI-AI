# cloud-learning-schedule-service 调度服务

## 概述

调度服务主要负责处理定时任务、任务调度、任务执行监控等业务功能，为系统提供可靠的任务调度能力。

## 任务管理接口

### 1. 创建定时任务

- **接口路径**: `POST /auth-api/schedule/task`
- **接口描述**: 创建新的定时任务
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "name": "数据备份任务",     // 必填，任务名称
  "description": "每日凌晨备份数据库", // 可选，任务描述
  "cronExpression": "0 0 2 * * ?", // 必填，Cron表达式
  "targetService": "backup-service", // 必填，目标服务
  "targetMethod": "backupDatabase", // 必填，目标方法
  "parameters": "{}",        // 可选，任务参数（JSON字符串）
  "priority": 1,            // 可选，优先级（1-10，默认5）
  "maxRetryCount": 3,       // 可选，最大重试次数
  "timeout": 3600,          // 可选，超时时间（秒）
  "enabled": true           // 可选，是否启用
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 任务ID
  "name": "数据备份任务",     // 任务名称
  "description": "每日凌晨备份数据库", // 任务描述
  "cronExpression": "0 0 2 * * ?", // Cron表达式
  "targetService": "backup-service", // 目标服务
  "targetMethod": "backupDatabase", // 目标方法
  "parameters": "{}",        // 任务参数
  "priority": 1,             // 优先级
  "maxRetryCount": 3,        // 最大重试次数
  "timeout": 3600,           // 超时时间
  "enabled": true,           // 是否启用
  "status": "created",       // 任务状态
  "nextExecutionTime": "2023-05-02 02:00:00", // 下次执行时间
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取任务列表

- **接口路径**: `GET /auth-api/schedule/tasks`
- **接口描述**: 获取定时任务列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",     // 可选，搜索关键字
  "status": "running",      // 可选，任务状态
  "enabled": true            // 可选，是否启用
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 任务列表
    {
      "id": 1,                // 任务ID
      "name": "数据备份任务",  // 任务名称
      "description": "每日凌晨备份数据库", // 任务描述
      "cronExpression": "0 0 2 * * ?", // Cron表达式
      "targetService": "backup-service", // 目标服务
      "targetMethod": "backupDatabase", // 目标方法
      "priority": 1,          // 优先级
      "maxRetryCount": 3,     // 最大重试次数
      "timeout": 3600,        // 超时时间
      "enabled": true,        // 是否启用
      "status": "running",   // 任务状态
      "nextExecutionTime": "2023-05-02 02:00:00", // 下次执行时间
      "lastExecutionTime": "2023-05-01 02:00:00", // 上次执行时间
      "createTime": "2023-05-01 12:00:00"  // 创建时间
    }
  ]
}
```

### 3. 获取任务详情

- **接口路径**: `GET /auth-api/schedule/task/{id}`
- **接口描述**: 获取定时任务详情
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，任务ID，通过路径参数传递
}
```
- **响应参数**: 同创建定时任务的响应参数

### 4. 更新任务信息

- **接口路径**: `PUT /auth-api/schedule/task/{id}`
- **接口描述**: 更新定时任务信息
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，任务ID，通过路径参数传递
  "name": "新任务名称",       // 可选，新任务名称
  "description": "新任务描述", // 可选，新任务描述
  "cronExpression": "0 0 3 * * ?", // 可选，新Cron表达式
  "parameters": "{}",        // 可选，新任务参数
  "priority": 2,             // 可选，新优先级
  "maxRetryCount": 5,        // 可选，新最大重试次数
  "timeout": 7200,           // 可选，新超时时间
  "enabled": false           // 可选，新启用状态
}
```
- **响应参数**: 同创建定时任务的响应参数

### 5. 删除任务

- **接口路径**: `DELETE /auth-api/schedule/task/{id}`
- **接口描述**: 删除定时任务
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，任务ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 6. 启用/禁用任务

- **接口路径**: `PUT /auth-api/schedule/task/{id}/enable`
- **接口描述**: 启用或禁用定时任务
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，任务ID，通过路径参数传递
  "enabled": true            // 必填，启用状态
}
```
- **响应参数**:
```json
{
  "success": true,            // 操作是否成功
  "enabled": true             // 当前启用状态
}
```

### 7. 立即执行任务

- **接口路径**: `POST /auth-api/schedule/task/{id}/execute`
- **接口描述**: 立即执行定时任务
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，任务ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true,            // 执行是否成功
  "executionId": "EX202305011200001", // 执行ID
  "message": "任务已开始执行" // 提示信息
}
```

## 执行记录接口

### 1. 获取执行记录列表

- **接口路径**: `GET /auth-api/schedule/executions`
- **接口描述**: 获取任务执行记录列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "taskId": 1,               // 可选，任务ID
  "status": "success",      // 可选，执行状态
  "startTime": "2023-05-01", // 可选，开始时间
  "endTime": "2023-05-31"    // 可选，结束时间
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 执行记录列表
    {
      "id": "EX202305011200001", // 执行ID
      "taskId": 1,            // 任务ID
      "taskName": "数据备份任务", // 任务名称
      "startTime": "2023-05-01 02:00:00", // 开始时间
      "endTime": "2023-05-01 02:05:30", // 结束时间
      "status": "success",    // 执行状态
      "result": "备份成功",    // 执行结果
      "errorMessage": "",     // 错误信息
      "retryCount": 0,        // 重试次数
      "createTime": "2023-05-01 02:00:00"  // 创建时间
    }
  ]
}
```

### 2. 获取执行记录详情

- **接口路径**: `GET /auth-api/schedule/execution/{id}`
- **接口描述**: 获取任务执行记录详情
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": "EX202305011200001"  // 必填，执行ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "id": "EX202305011200001", // 执行ID
  "taskId": 1,               // 任务ID
  "taskName": "数据备份任务", // 任务名称
  "startTime": "2023-05-01 02:00:00", // 开始时间
  "endTime": "2023-05-01 02:05:30", // 结束时间
  "status": "success",       // 执行状态
  "result": "备份成功",      // 执行结果
  "errorMessage": "",        // 错误信息
  "retryCount": 0,           // 重试次数
  "parameters": "{}",        // 执行参数
  "logs": [                  // 执行日志
    {
      "timestamp": "2023-05-01 02:00:00",
      "level": "INFO",
      "message": "开始执行数据备份任务"
    }
  ],
  "createTime": "2023-05-01 02:00:00"  // 创建时间
}
```

## 系统监控接口

### 1. 获取调度器状态

- **接口路径**: `GET /auth-api/schedule/status`
- **接口描述**: 获取调度器运行状态
- **权限要求**: 需要管理员权限
- **请求参数**: 无
- **响应参数**:
```json
{
  "schedulerName": "DefaultScheduler", // 调度器名称
  "status": "running",       // 调度器状态
  "started": true,           // 是否已启动
  "shutdown": false,         // 是否已关闭
  "standby": false,          // 是否处于待机模式
  "runningSince": "2023-05-01 00:00:00", // 启动时间
  "numJobs": 15,             // 任务数量
  "numJobsExecuted": 120,    // 已执行任务数量
  "numJobsRunning": 3,       // 正在运行任务数量
  "memoryUsage": "256MB",    // 内存使用情况
  "threadPoolSize": 10       // 线程池大小
}
```

## 数据模型

### 任务状态枚举
- `created`: 已创建
- `running`: 运行中
- `paused`: 已暂停
- `completed`: 已完成
- `failed`: 已失败
- `cancelled`: 已取消

### 执行状态枚举
- `pending`: 等待中
- `running`: 执行中
- `success`: 成功
- `failed`: 失败
- `cancelled`: 已取消
- `retrying`: 重试中

### 日志级别枚举
- `DEBUG`: 调试
- `INFO`: 信息
- `WARN`: 警告
- `ERROR`: 错误
- `FATAL`: 严重错误