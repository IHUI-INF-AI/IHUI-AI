# cloud-learning-trace-service 访问跟踪服务

## 概述

访问跟踪服务主要负责记录用户访问行为、操作日志、性能监控等数据，为系统提供用户行为分析和安全审计能力。

## 访问记录接口

### 1. 获取访问记录列表

- **接口路径**: `GET /auth-api/traces`
- **接口描述**: 获取用户访问记录列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "userId": 123,              // 可选，用户ID
  "username": "user1",        // 可选，用户名
  "ip": "192.168.1.1",        // 可选，IP地址
  "startTime": "2023-05-01 00:00:00", // 可选，开始时间
  "endTime": "2023-05-31 23:59:59",   // 可选，结束时间
  "action": "login",          // 可选，操作类型
  "module": "auth",           // 可选，模块名称
  "status": "success"         // 可选，操作状态
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 1000,              // 总记录数
  "list": [                   // 访问记录列表
    {
      "id": 1,                // 记录ID
      "userId": 123,          // 用户ID
      "username": "user1",    // 用户名
      "ip": "192.168.1.1",    // IP地址
      "userAgent": "Mozilla/5.0...", // 用户代理
      "action": "login",      // 操作类型
      "module": "auth",       // 模块名称
      "description": "用户登录", // 操作描述
      "requestUrl": "/auth-api/login", // 请求URL
      "requestMethod": "POST", // 请求方法
      "requestParams": "{}",   // 请求参数
      "responseCode": 200,     // 响应码
      "responseData": "{}",    // 响应数据
      "executionTime": 150,    // 执行时间（毫秒）
      "status": "success",     // 操作状态
      "errorMessage": "",      // 错误信息
      "createTime": "2023-05-01 12:00:00" // 创建时间
    }
  ]
}
```

### 2. 获取访问记录详情

- **接口路径**: `GET /auth-api/trace/{id}`
- **接口描述**: 获取访问记录详情
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，记录ID，通过路径参数传递
}
```
- **响应参数**: 同访问记录列表中的单个记录对象

### 3. 删除访问记录

- **接口路径**: `DELETE /auth-api/trace/{id}`
- **接口描述**: 删除访问记录
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，记录ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 批量删除访问记录

- **接口路径**: `DELETE /auth-api/traces`
- **接口描述**: 批量删除访问记录
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "ids": [1, 2, 3],           // 必填，记录ID列表
  "startTime": "2023-01-01 00:00:00", // 可选，开始时间
  "endTime": "2023-01-31 23:59:59"   // 可选，结束时间
}
```
- **响应参数**:
```json
{
  "success": true,            // 删除是否成功
  "deletedCount": 3           // 删除的记录数量
}
```

## 用户行为分析接口

### 1. 获取用户活跃度统计

- **接口路径**: `GET /auth-api/traces/activity`
- **接口描述**: 获取用户活跃度统计
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01 00:00:00", // 必填，开始时间
  "endTime": "2023-05-31 23:59:59",   // 必填，结束时间
  "granularity": "day"        // 可选，统计粒度（hour/day/week/month）
}
```
- **响应参数**:
```json
{
  "totalVisits": 15000,       // 总访问量
  "uniqueUsers": 1200,        // 独立用户数
  "avgDuration": 180,         // 平均停留时间（秒）
  "bounceRate": 0.15,         // 跳出率
  "data": [                   // 统计数据
    {
      "date": "2023-05-01",   // 日期
      "visits": 500,          // 访问量
      "uniqueVisitors": 400,  // 独立访客
      "avgDuration": 200,     // 平均停留时间
      "bounceRate": 0.12      // 跳出率
    }
  ]
}
```

### 2. 获取热门页面统计

- **接口路径**: `GET /auth-api/traces/popular-pages`
- **接口描述**: 获取热门页面访问统计
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01 00:00:00", // 必填，开始时间
  "endTime": "2023-05-31 23:59:59",   // 必填，结束时间
  "limit": 10                 // 可选，返回数量，默认为10
}
```
- **响应参数**:
```json
{
  "pages": [                  // 热门页面列表
    {
      "url": "/course/123",   // 页面URL
      "title": "Java基础课程", // 页面标题
      "visits": 1500,         // 访问次数
      "uniqueVisitors": 1200, // 独立访客
      "avgDuration": 300,     // 平均停留时间（秒）
      "bounceRate": 0.08      // 跳出率
    }
  ]
}
```

### 3. 获取用户行为路径分析

- **接口路径**: `GET /auth-api/traces/user-journey`
- **接口描述**: 获取用户行为路径分析
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "userId": 123,              // 必填，用户ID
  "startTime": "2023-05-01 00:00:00", // 可选，开始时间
  "endTime": "2023-05-31 23:59:59"   // 可选，结束时间
}
```
- **响应参数**:
```json
{
  "userId": 123,              // 用户ID
  "username": "user1",        // 用户名
  "journey": [                // 行为路径
    {
      "timestamp": "2023-05-01 10:00:00", // 时间戳
      "action": "login",      // 操作类型
      "module": "auth",       // 模块名称
      "url": "/auth-api/login", // 访问URL
      "duration": 0           // 停留时间（秒）
    },
    {
      "timestamp": "2023-05-01 10:01:00",
      "action": "view",
      "module": "course",
      "url": "/course/list",
      "duration": 120
    }
  ],
  "totalActions": 15,         // 总操作数
  "totalDuration": 1800,      // 总停留时间
  "firstVisit": "2023-05-01 10:00:00", // 首次访问时间
  "lastVisit": "2023-05-01 12:00:00"   // 最后访问时间
}
```

## 性能监控接口

### 1. 获取接口性能统计

- **接口路径**: `GET /auth-api/traces/performance`
- **接口描述**: 获取接口性能统计
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01 00:00:00", // 必填，开始时间
  "endTime": "2023-05-31 23:59:59",   // 必填，结束时间
  "apiPath": "/auth-api/login" // 可选，接口路径
}
```
- **响应参数**:
```json
{
  "totalRequests": 10000,     // 总请求数
  "avgResponseTime": 150,     // 平均响应时间（毫秒）
  "maxResponseTime": 2000,    // 最大响应时间
  "minResponseTime": 50,      // 最小响应时间
  "successRate": 0.98,        // 成功率
  "errorRate": 0.02,          // 错误率
  "apis": [                   // 接口性能统计
    {
      "apiPath": "/auth-api/login", // 接口路径
      "requestCount": 500,    // 请求次数
      "avgResponseTime": 120, // 平均响应时间
      "successRate": 0.99,    // 成功率
      "errorCount": 5         // 错误次数
    }
  ]
}
```

### 2. 获取慢查询统计

- **接口路径**: `GET /auth-api/traces/slow-queries`
- **接口描述**: 获取慢查询统计
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01 00:00:00", // 必填，开始时间
  "endTime": "2023-05-31 23:59:59",   // 必填，结束时间
  "threshold": 1000           // 可选，慢查询阈值（毫秒），默认为1000
}
```
- **响应参数**:
```json
{
  "slowQueries": [            // 慢查询列表
    {
      "id": 1,                // 记录ID
      "apiPath": "/course-api/course/123", // 接口路径
      "executionTime": 1500,   // 执行时间（毫秒）
      "requestParams": "{}",   // 请求参数
      "userId": 123,          // 用户ID
      "ip": "192.168.1.1",    // IP地址
      "createTime": "2023-05-01 12:00:00" // 创建时间
    }
  ],
  "totalSlowQueries": 25,     // 总慢查询数
  "avgSlowTime": 1200,        // 平均慢查询时间
  "maxSlowTime": 5000         // 最大慢查询时间
}
```

## 安全审计接口

### 1. 获取安全事件统计

- **接口路径**: `GET /auth-api/traces/security-events`
- **接口描述**: 获取安全事件统计
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01 00:00:00", // 必填，开始时间
  "endTime": "2023-05-31 23:59:59",   // 必填，结束时间
  "eventType": "failed_login" // 可选，事件类型
}
```
- **响应参数**:
```json
{
  "totalEvents": 150,         // 总事件数
  "eventsByType": [           // 按类型统计
    {
      "eventType": "failed_login", // 事件类型
      "count": 100,           // 事件数量
      "percentage": 0.67      // 占比
    },
    {
      "eventType": "suspicious_activity",
      "count": 30,
      "percentage": 0.20
    }
  ],
  "events": [                 // 安全事件列表
    {
      "id": 1,                // 事件ID
      "eventType": "failed_login", // 事件类型
      "userId": 123,          // 用户ID
      "username": "user1",    // 用户名
      "ip": "192.168.1.1",    // IP地址
      "description": "登录失败次数过多", // 事件描述
      "severity": "high",     // 严重程度
      "createTime": "2023-05-01 12:00:00" // 创建时间
    }
  ]
}
```

### 2. 获取IP黑名单

- **接口路径**: `GET /auth-api/traces/ip-blacklist`
- **接口描述**: 获取IP黑名单
- **权限要求**: 需要管理员权限
- **请求参数**: 无
- **响应参数**:
```json
{
  "blacklist": [              // IP黑名单
    {
      "ip": "192.168.1.100",  // IP地址
      "reason": "恶意登录尝试", // 原因
      "addedTime": "2023-05-01 10:00:00", // 添加时间
      "expireTime": "2023-06-01 10:00:00" // 过期时间
    }
  ],
  "totalCount": 5             // 总数量
}
```

### 3. 添加IP到黑名单

- **接口路径**: `POST /auth-api/traces/ip-blacklist`
- **接口描述**: 添加IP到黑名单
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "ip": "192.168.1.100",      // 必填，IP地址
  "reason": "恶意登录尝试",     // 必填，原因
  "expireHours": 24           // 可选，过期时间（小时），默认24
}
```
- **响应参数**:
```json
{
  "success": true,            // 添加是否成功
  "message": "IP已添加到黑名单" // 消息
}
```

### 4. 从黑名单移除IP

- **接口路径**: `DELETE /auth-api/traces/ip-blacklist/{ip}`
- **接口描述**: 从黑名单移除IP
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "ip": "192.168.1.100"       // 必填，IP地址，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true,            // 移除是否成功
  "message": "IP已从黑名单移除" // 消息
}
```

## 数据导出接口

### 1. 导出访问记录

- **接口路径**: `GET /auth-api/traces/export`
- **接口描述**: 导出访问记录
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01 00:00:00", // 必填，开始时间
  "endTime": "2023-05-31 23:59:59",   // 必填，结束时间
  "format": "csv"            // 可选，导出格式（csv/json/excel）
}
```
- **响应参数**: 返回导出文件

### 2. 导出统计报告

- **接口路径**: `GET /auth-api/traces/export-report`
- **接口描述**: 导出统计报告
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01 00:00:00", // 必填，开始时间
  "endTime": "2023-05-31 23:59:59",   // 必填，结束时间
  "reportType": "activity"   // 可选，报告类型（activity/performance/security）
}
```
- **响应参数**: 返回PDF格式的统计报告

## 数据模型

### 操作类型枚举
- `login`: 登录
- `logout`: 登出
- `view`: 查看
- `create`: 创建
- `update`: 更新
- `delete`: 删除
- `search`: 搜索
- `download`: 下载
- `upload`: 上传
- `payment`: 支付

### 操作状态枚举
- `success`: 成功
- `failed`: 失败
- `pending`: 进行中

### 模块名称枚举
- `auth`: 认证授权
- `user`: 用户中心
- `course`: 课程服务
- `order`: 订单服务
- `payment`: 支付服务
- `content`: 内容服务
- `message`: 消息服务
- `system`: 系统管理

### 事件严重程度枚举
- `low`: 低
- `medium`: 中
- `high`: 高
- `critical`: 严重