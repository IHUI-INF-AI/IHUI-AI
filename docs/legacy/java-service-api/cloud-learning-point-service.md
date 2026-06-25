# cloud-learning-point-service 积分服务

## 概述

积分服务主要负责处理用户积分相关的业务功能，包括积分获取、积分消耗、积分记录查询等。

## 积分管理接口

### 1. 获取用户积分信息

- **接口路径**: `GET /auth-api/point/info`
- **接口描述**: 获取当前登录用户的积分信息
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "memberId": 1001,           // 用户ID
  "totalPoints": 500,        // 总积分
  "availablePoints": 450,    // 可用积分
  "frozenPoints": 50,        // 冻结积分
  "level": "VIP1",           // 积分等级
  "nextLevelPoints": 1000,   // 下一等级所需积分
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取积分记录列表

- **接口路径**: `GET /auth-api/point/records`
- **接口描述**: 获取当前登录用户的积分记录列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "type": "earn",            // 可选，记录类型：earn(获取), consume(消耗)
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31"     // 可选，结束时间
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 积分记录列表
    {
      "id": 1,                // 记录ID
      "memberId": 1001,       // 用户ID
      "type": "earn",         // 记录类型
      "points": 10,           // 积分数
      "description": "完成学习任务", // 描述
      "source": "task",       // 来源
      "sourceId": 123,        // 来源ID
      "createTime": "2023-05-01 12:00:00"  // 创建时间
    }
  ]
}
```

### 3. 获取积分规则列表

- **接口路径**: `GET /public-api/point/rules`
- **接口描述**: 获取积分规则列表
- **权限要求**: 无需权限
- **请求参数**: 无
- **响应参数**:
```json
[
  {
    "id": 1,                // 规则ID
    "name": "每日签到",      // 规则名称
    "type": "earn",         // 规则类型
    "points": 5,            // 积分数
    "description": "每日签到可获得5积分", // 规则描述
    "limitType": "daily",   // 限制类型：daily(每日), weekly(每周), monthly(每月), unlimited(无限制)
    "limitCount": 1,        // 限制次数
    "status": "active",     // 状态
    "createTime": "2023-05-01 12:00:00"  // 创建时间
  }
]
```

### 4. 用户签到

- **接口路径**: `POST /auth-api/point/check-in`
- **接口描述**: 用户签到获取积分
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "success": true,            // 是否成功
  "points": 5,               // 获得的积分数
  "message": "签到成功，获得5积分", // 提示信息
  "checkInDays": 3,          // 连续签到天数
  "totalPoints": 505         // 当前总积分
}
```

### 5. 消耗积分

- **接口路径**: `POST /auth-api/point/consume`
- **接口描述**: 消耗积分
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "points": 100,             // 必填，消耗积分数
  "purpose": "兑换课程",     // 必填，用途描述
  "source": "course",       // 必填，来源类型
  "sourceId": 456           // 必填，来源ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 是否成功
  "transactionId": "T202305011200001", // 交易ID
  "points": 100,             // 消耗积分数
  "availablePoints": 350,    // 剩余可用积分
  "message": "积分消耗成功"   // 提示信息
}
```

### 6. 积分等级列表

- **接口路径**: `GET /public-api/point/levels`
- **接口描述**: 获取积分等级列表
- **权限要求**: 无需权限
- **请求参数**: 无
- **响应参数**:
```json
[
  {
    "level": "VIP1",         // 等级名称
    "minPoints": 0,          // 最低积分要求
    "maxPoints": 1000,       // 最高积分要求
    "privileges": [          // 特权列表
      "专属课程折扣",
      "优先客服服务"
    ],
    "icon": "vip1-icon"      // 等级图标
  }
]
```

## 数据模型

### 积分记录类型枚举
- `earn`: 获取积分
- `consume`: 消耗积分

### 积分来源枚举
- `signin`: 签到
- `task`: 任务
- `course`: 课程
- `exam`: 考试
- `share`: 分享
- `register`: 注册

### 限制类型枚举
- `daily`: 每日
- `weekly`: 每周
- `monthly`: 每月
- `unlimited`: 无限制