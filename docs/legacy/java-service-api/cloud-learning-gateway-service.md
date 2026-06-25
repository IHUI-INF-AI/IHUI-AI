# cloud-learning-gateway-service 网关服务

## 概述

网关服务是整个微服务架构的入口，负责请求路由、负载均衡、认证授权、限流熔断等功能，为整个系统提供统一的访问入口。

## 路由管理接口

### 1. 获取路由列表

- **接口路径**: `GET /admin-api/routes`
- **接口描述**: 获取所有路由列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字"      // 可选，搜索关键字
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 路由列表
    {
      "id": "cloud-learning-user-service",  // 路由ID
      "uri": "lb://cloud-learning-user-service",  // 目标URI
      "path": "/user/**",      // 路径模式
      "method": ["GET", "POST"], // HTTP方法
      "filters": [             // 过滤器列表
        {
          "name": "StripPrefix",  // 过滤器名称
          "args": {
            "parts": "1"      // 过滤器参数
          }
        }
      ],
      "metadata": {            // 元数据
        "description": "用户服务路由"
      },
      "order": 0,              // 排序
      "enabled": true          // 是否启用
    }
  ]
}
```

### 2. 获取路由详情

- **接口路径**: `GET /admin-api/routes/{id}`
- **接口描述**: 获取指定路由的详情
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": "cloud-learning-user-service"  // 必填，路由ID，通过路径参数传递
}
```
- **响应参数**: 同获取路由列表中的单个路由对象

### 3. 添加路由

- **接口路径**: `POST /admin-api/routes`
- **接口描述**: 添加一个新路由
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": "cloud-learning-new-service",  // 必填，路由ID
  "uri": "lb://cloud-learning-new-service",  // 必填，目标URI
  "path": "/new/**",       // 必填，路径模式
  "method": ["GET", "POST"], // 可选，HTTP方法，默认为所有方法
  "filters": [             // 可选，过滤器列表
    {
      "name": "StripPrefix",  // 过滤器名称
      "args": {
        "parts": "1"      // 过滤器参数
      }
    }
  ],
  "metadata": {            // 可选，元数据
    "description": "新服务路由"
  },
  "order": 0,              // 可选，排序，默认为0
  "enabled": true          // 可选，是否启用，默认为true
}
```
- **响应参数**: 同获取路由详情

### 4. 修改路由

- **接口路径**: `PUT /admin-api/routes/{id}`
- **接口描述**: 修改已有路由
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": "cloud-learning-new-service",  // 必填，路由ID
  "uri": "lb://cloud-learning-new-service",  // 可选，目标URI
  "path": "/new/**",       // 可选，路径模式
  "method": ["GET", "POST"], // 可选，HTTP方法
  "filters": [             // 可选，过滤器列表
    {
      "name": "StripPrefix",  // 过滤器名称
      "args": {
        "parts": "1"      // 过滤器参数
      }
    }
  ],
  "metadata": {            // 可选，元数据
    "description": "修改后的新服务路由"
  },
  "order": 0,              // 可选，排序
  "enabled": true          // 可选，是否启用
}
```
- **响应参数**: 同获取路由详情

### 5. 删除路由

- **接口路径**: `DELETE /admin-api/routes/{id}`
- **接口描述**: 删除一个路由
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": "cloud-learning-new-service"  // 必填，路由ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 6. 启用/禁用路由

- **接口路径**: `PUT /admin-api/routes/{id}/status`
- **接口描述**: 启用或禁用一个路由
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": "cloud-learning-new-service",  // 必填，路由ID，通过路径参数传递
  "enabled": false          // 必填，是否启用
}
```
- **响应参数**:
```json
{
  "success": true             // 设置是否成功
}
```

## 限流管理接口

### 1. 获取限流规则列表

- **接口路径**: `GET /admin-api/rate-limit/rules`
- **接口描述**: 获取所有限流规则列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字"      // 可选，搜索关键字
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 15,                // 总记录数
  "list": [                   // 限流规则列表
    {
      "id": 1,                // 规则ID
      "key": "/user/**",      // 限流键
      "replenishRate": 10,     // 令牌补充速率
      "burstCapacity": 20,     // 令牌桶容量
      "requestedTokens": 1,    // 每次请求消耗的令牌数
      "description": "用户服务限流规则", // 规则描述
      "enabled": true,         // 是否启用
      "createTime": "2023-05-01 12:00:00",  // 创建时间
      "updateTime": "2023-05-02 13:00:00"   // 更新时间
    }
  ]
}
```

### 2. 获取限流规则详情

- **接口路径**: `GET /admin-api/rate-limit/rules/{id}`
- **接口描述**: 获取指定限流规则的详情
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，规则ID，通过路径参数传递
}
```
- **响应参数**: 同获取限流规则列表中的单个规则对象

### 3. 添加限流规则

- **接口路径**: `POST /admin-api/rate-limit/rules`
- **接口描述**: 添加一个新的限流规则
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "key": "/new/**",          // 必填，限流键
  "replenishRate": 5,        // 必填，令牌补充速率
  "burstCapacity": 10,       // 必填，令牌桶容量
  "requestedTokens": 1,      // 必填，每次请求消耗的令牌数
  "description": "新服务限流规则", // 可选，规则描述
  "enabled": true            // 可选，是否启用，默认为true
}
```
- **响应参数**: 同获取限流规则详情

### 4. 修改限流规则

- **接口路径**: `PUT /admin-api/rate-limit/rules/{id}`
- **接口描述**: 修改已有限流规则
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，规则ID
  "key": "/new/**",          // 可选，限流键
  "replenishRate": 8,        // 可选，令牌补充速率
  "burstCapacity": 15,       // 可选，令牌桶容量
  "requestedTokens": 1,      // 可选，每次请求消耗的令牌数
  "description": "修改后的新服务限流规则", // 可选，规则描述
  "enabled": true            // 可选，是否启用
}
```
- **响应参数**: 同获取限流规则详情

### 5. 删除限流规则

- **接口路径**: `DELETE /admin-api/rate-limit/rules/{id}`
- **接口描述**: 删除一个限流规则
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，规则ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 6. 启用/禁用限流规则

- **接口路径**: `PUT /admin-api/rate-limit/rules/{id}/status`
- **接口描述**: 启用或禁用一个限流规则
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，规则ID，通过路径参数传递
  "enabled": false            // 必填，是否启用
}
```
- **响应参数**:
```json
{
  "success": true             // 设置是否成功
}
```

## 熔断管理接口

### 1. 获取熔断规则列表

- **接口路径**: `GET /admin-api/circuit-breaker/rules`
- **接口描述**: 获取所有熔断规则列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字"      // 可选，搜索关键字
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 12,                // 总记录数
  "list": [                   // 熔断规则列表
    {
      "id": 1,                // 规则ID
      "name": "user-service-cb", // 熔断器名称
      "failureRateThreshold": 50, // 失败率阈值（百分比）
      "waitDurationInOpenState": 60000, // 熔断器打开状态持续时间（毫秒）
      "slidingWindowSize": 10, // 滑动窗口大小
      "slidingWindowType": "COUNT_BASED", // 滑动窗口类型：COUNT_BASED(计数), TIME_BASED(时间)
      "minimumNumberOfCalls": 5, // 最小调用次数
      "permittedNumberOfCallsInHalfOpenState": 3, // 半开状态允许的调用次数
      "automaticTransitionFromOpenToHalfOpenEnabled": true, // 是否自动从打开状态转换到半开状态
      "description": "用户服务熔断规则", // 规则描述
      "enabled": true,         // 是否启用
      "createTime": "2023-05-01 12:00:00",  // 创建时间
      "updateTime": "2023-05-02 13:00:00"   // 更新时间
    }
  ]
}
```

### 2. 获取熔断规则详情

- **接口路径**: `GET /admin-api/circuit-breaker/rules/{id}`
- **接口描述**: 获取指定熔断规则的详情
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，规则ID，通过路径参数传递
}
```
- **响应参数**: 同获取熔断规则列表中的单个规则对象

### 3. 添加熔断规则

- **接口路径**: `POST /admin-api/circuit-breaker/rules`
- **接口描述**: 添加一个新的熔断规则
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "name": "new-service-cb",  // 必填，熔断器名称
  "failureRateThreshold": 60, // 必填，失败率阈值（百分比）
  "waitDurationInOpenState": 30000, // 必填，熔断器打开状态持续时间（毫秒）
  "slidingWindowSize": 20,   // 必填，滑动窗口大小
  "slidingWindowType": "COUNT_BASED", // 必填，滑动窗口类型：COUNT_BASED(计数), TIME_BASED(时间)
  "minimumNumberOfCalls": 10, // 必填，最小调用次数
  "permittedNumberOfCallsInHalfOpenState": 5, // 必填，半开状态允许的调用次数
  "automaticTransitionFromOpenToHalfOpenEnabled": true, // 必填，是否自动从打开状态转换到半开状态
  "description": "新服务熔断规则", // 可选，规则描述
  "enabled": true            // 可选，是否启用，默认为true
}
```
- **响应参数**: 同获取熔断规则详情

### 4. 修改熔断规则

- **接口路径**: `PUT /admin-api/circuit-breaker/rules/{id}`
- **接口描述**: 修改已有熔断规则
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，规则ID
  "name": "new-service-cb",  // 可选，熔断器名称
  "failureRateThreshold": 40, // 可选，失败率阈值（百分比）
  "waitDurationInOpenState": 45000, // 可选，熔断器打开状态持续时间（毫秒）
  "slidingWindowSize": 15,   // 可选，滑动窗口大小
  "slidingWindowType": "TIME_BASED", // 可选，滑动窗口类型
  "minimumNumberOfCalls": 8, // 可选，最小调用次数
  "permittedNumberOfCallsInHalfOpenState": 4, // 可选，半开状态允许的调用次数
  "automaticTransitionFromOpenToHalfOpenEnabled": false, // 可选，是否自动从打开状态转换到半开状态
  "description": "修改后的新服务熔断规则", // 可选，规则描述
  "enabled": true            // 可选，是否启用
}
```
- **响应参数**: 同获取熔断规则详情

### 5. 删除熔断规则

- **接口路径**: `DELETE /admin-api/circuit-breaker/rules/{id}`
- **接口描述**: 删除一个熔断规则
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，规则ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 6. 启用/禁用熔断规则

- **接口路径**: `PUT /admin-api/circuit-breaker/rules/{id}/status`
- **接口描述**: 启用或禁用一个熔断规则
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，规则ID，通过路径参数传递
  "enabled": false            // 必填，是否启用
}
```
- **响应参数**:
```json
{
  "success": true             // 设置是否成功
}
```

### 7. 获取熔断器状态

- **接口路径**: `GET /admin-api/circuit-breaker/status/{name}`
- **接口描述**: 获取指定熔断器的当前状态
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "name": "user-service-cb"   // 必填，熔断器名称，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "name": "user-service-cb",  // 熔断器名称
  "state": "CLOSED",          // 熔断器状态：CLOSED(关闭), OPEN(打开), HALF_OPEN(半开)
  "failureRate": 25.5,        // 当前失败率（百分比）
  "numberOfCalls": 15,        // 调用次数
  "numberOfFailedCalls": 4,   // 失败调用次数
  "numberOfSuccessfulCalls": 11, // 成功调用次数
  "numberOfNotPermittedCalls": 0 // 被拒绝的调用次数
}
```

## 系统监控接口

### 1. 获取系统健康状态

- **接口路径**: `GET /admin-api/health`
- **接口描述**: 获取系统健康状态
- **权限要求**: 需要管理员权限
- **请求参数**: 无
- **响应参数**:
```json
{
  "status": "UP",            // 系统状态：UP(正常), DOWN(异常)
  "components": {            // 组件状态
    "diskSpace": {
      "status": "UP",
      "details": {
        "total": 250685575168,
        "free": 125342787584,
        "threshold": 10485760,
        "path": "C:\"
      }
    },
    "ping": {
      "status": "UP"
    },
    "discoveryComposite": {
      "status": "UP",
      "details": {
        "discoveryClient": {
          "status": "UP",
          "services": [
            "cloud-learning-user-service",
            "cloud-learning-order-service",
            "cloud-learning-gateway-service"
          ]
        }
      }
    }
  }
}
```

### 2. 获取系统信息

- **接口路径**: `GET /admin-api/info`
- **接口描述**: 获取系统信息
- **权限要求**: 需要管理员权限
- **请求参数**: 无
- **响应参数**:
```json
{
  "app": {
    "name": "cloud-learning-gateway-service",
    "description": "云学习平台网关服务",
    "version": "1.0.0"
  },
  "build": {
    "time": "2023-05-01T12:00:00Z",
    "version": "1.0.0",
    "artifact": "cloud-learning-gateway-service",
    "name": "cloud-learning-gateway-service",
    "group": "com.cloud.learning"
  },
  "os": {
    "name": "Windows 10",
    "version": "10.0",
    "arch": "amd64"
  },
  "java": {
    "version": "11.0.12",
    "vendor": "Oracle Corporation",
    "runtime": {
      "name": "OpenJDK Runtime Environment",
      "version": "11.0.12+7"
    },
    "jvm": {
      "name": "OpenJDK 64-Bit Server VM",
      "version": "11.0.12+7",
      "vendor": "Oracle Corporation"
    }
  }
}
```

### 3. 获取系统指标

- **接口路径**: `GET /admin-api/metrics`
- **接口描述**: 获取系统指标
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "name": "jvm.memory.used"  // 可选，指标名称，不填则返回所有指标名称列表
}
```
- **响应参数**:
```json
{
  "name": "jvm.memory.used",  // 指标名称
  "description": "The amount of used memory", // 指标描述
  "baseUnit": "bytes",       // 基本单位
  "measurements": [          // 测量值列表
    {
      "statistic": "VALUE",  // 统计类型
      "value": 123456789     // 值
    }
  ],
  "availableTags": [         // 可用标签
    {
      "tag": "area",         // 标签名
      "values": [            // 标签值列表
        "heap",
        "nonheap"
      ]
    },
    {
      "tag": "id",           // 标签名
      "values": [            // 标签值列表
        "G1 Old Gen",
        "G1 Eden Space",
        "G1 Survivor Space"
      ]
    }
  ]
}
```

## 数据模型

### 路由HTTP方法枚举

- `GET`: GET请求
- `POST`: POST请求
- `PUT`: PUT请求
- `DELETE`: DELETE请求
- `PATCH`: PATCH请求
- `HEAD`: HEAD请求
- `OPTIONS`: OPTIONS请求

### 限流规则滑动窗口类型枚举

- `COUNT_BASED`: 基于计数的滑动窗口
- `TIME_BASED`: 基于时间的滑动窗口

### 熔断器状态枚举

- `CLOSED`: 关闭状态（正常）
- `OPEN`: 打开状态（熔断）
- `HALF_OPEN`: 半开状态（尝试恢复）

### 熔断规则滑动窗口类型枚举

- `COUNT_BASED`: 基于计数的滑动窗口
- `TIME_BASED`: 基于时间的滑动窗口

### 系统状态枚举

- `UP`: 正常
- `DOWN`: 异常
- `OUT_OF_SERVICE`: 停止服务
- `UNKNOWN`: 未知
