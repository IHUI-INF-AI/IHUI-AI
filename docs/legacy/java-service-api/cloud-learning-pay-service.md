# cloud-learning-pay-service 支付服务

## 概述

支付服务主要负责管理平台上的各种支付方式，包括支付宝支付、微信支付、余额支付等功能。

## 支付方式接口

### 1. 获取支付方式列表

- **接口路径**: `GET /public-api/payment-method/list`
- **接口描述**: 获取支付方式列表
- **权限要求**: 无需权限
- **请求参数**: 无
- **响应参数**:
```json
[
  {
    "id": 1,                  // 支付方式ID
    "name": "支付宝",          // 支付方式名称
    "code": "alipay",         // 支付方式代码
    "icon": "支付宝图标URL",   // 支付方式图标
    "description": "支付宝支付", // 支付方式描述
    "enabled": true,          // 是否启用
    "sortOrder": 1            // 排序序号
  },
  {
    "id": 2,
    "name": "微信支付",
    "code": "wechat",
    "icon": "微信支付图标URL",
    "description": "微信支付",
    "enabled": true,
    "sortOrder": 2
  },
  {
    "id": 3,
    "name": "余额支付",
    "code": "balance",
    "icon": "余额支付图标URL",
    "description": "余额支付",
    "enabled": true,
    "sortOrder": 3
  }
]
```

### 2. 获取支付方式详情

- **接口路径**: `GET /public-api/payment-method/{code}`
- **接口描述**: 获取支付方式详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "code": "alipay"            // 必填，支付方式代码，通过路径参数传递
}
```
- **响应参数**: 同获取支付方式列表中的单个支付方式对象

### 3. 启用/禁用支付方式

- **接口路径**: `PUT /admin-api/payment-method/status`
- **接口描述**: 启用或禁用支付方式
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，支付方式ID
  "enabled": false            // 必填，是否启用
}
```
- **响应参数**:
```json
{
  "success": true             // 设置是否成功
}
```

## 支付宝支付接口

### 1. 创建支付宝支付

- **接口路径**: `POST /auth-api/alipay/create`
- **接口描述**: 创建支付宝支付
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "orderId": 1,               // 必填，订单ID
  "orderType": "course",       // 必填，订单类型：course(课程订单), card(会员卡订单)
  "subject": "订单标题",       // 必填，订单标题
  "totalAmount": 149.00,      // 必填，支付金额
  "returnUrl": "http://example.com/return", // 必填，支付成功返回地址
  "notifyUrl": "http://example.com/notify"   // 必填，支付结果通知地址
}
```
- **响应参数**:
```json
{
  "paymentId": 1,             // 支付ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "subject": "订单标题",       // 订单标题
  "totalAmount": 149.00,      // 支付金额
  "payUrl": "https://openapi.alipay.com/gateway.do?...", // 支付地址
  "qrCode": "data:image/png;base64,...", // 二维码
  "status": "created",        // 支付状态：created(已创建), paying(支付中), paid(已支付), failed(支付失败), cancelled(已取消)
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 查询支付宝支付

- **接口路径**: `GET /auth-api/alipay/query`
- **接口描述**: 查询支付宝支付状态
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "paymentId": 1              // 必填，支付ID
}
```
- **响应参数**:
```json
{
  "paymentId": 1,             // 支付ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "subject": "订单标题",       // 订单标题
  "totalAmount": 149.00,      // 支付金额
  "status": "paid",           // 支付状态
  "payTime": "2023-05-01 12:30:00", // 支付时间
  "thirdPartyNo": "2023050122001234567890123456789", // 第三方支付号
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-01 12:30:00"   // 更新时间
}
```

### 3. 取消支付宝支付

- **接口路径**: `PUT /auth-api/alipay/cancel`
- **接口描述**: 取消支付宝支付
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "paymentId": 1              // 必填，支付ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 取消是否成功
  "cancelTime": "2023-05-01 12:30:00" // 取消时间
}
```

### 4. 支付宝支付回调

- **接口路径**: `POST /public-api/alipay/notify`
- **接口描述**: 支付宝支付结果通知
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "trade_no": "2023050122001234567890123456789", // 支付宝交易号
  "out_trade_no": "PAY20230501001", // 商户订单号
  "trade_status": "TRADE_SUCCESS", // 交易状态
  "total_amount": "149.00", // 支付金额
  "buyer_id": "2088102169912345", // 买家支付宝用户ID
  "gmt_payment": "2023-05-01 12:30:00", // 交易付款时间
  "notify_time": "2023-05-01 12:31:00", // 通知时间
  "subject": "订单标题", // 订单标题
  "body": "订单描述", // 订单描述
  "sign": "sign_string" // 签名
}
```
- **响应参数**:
```json
"success"
```

## 微信支付接口

### 1. 创建微信支付

- **接口路径**: `POST /auth-api/wechat/create`
- **接口描述**: 创建微信支付
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "orderId": 1,               // 必填，订单ID
  "orderType": "course",       // 必填，订单类型：course(课程订单), card(会员卡订单)
  "subject": "订单标题",       // 必填，订单标题
  "totalAmount": 149.00,      // 必填，支付金额
  "notifyUrl": "http://example.com/notify"   // 必填，支付结果通知地址
}
```
- **响应参数**:
```json
{
  "paymentId": 1,             // 支付ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "subject": "订单标题",       // 订单标题
  "totalAmount": 149.00,      // 支付金额
  "codeUrl": "weixin://wxpay/bizpayurl?...", // 二维码链接
  "qrCode": "data:image/png;base64,...", // 二维码
  "status": "created",        // 支付状态：created(已创建), paying(支付中), paid(已支付), failed(支付失败), cancelled(已取消)
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 查询微信支付

- **接口路径**: `GET /auth-api/wechat/query`
- **接口描述**: 查询微信支付状态
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "paymentId": 1              // 必填，支付ID
}
```
- **响应参数**:
```json
{
  "paymentId": 1,             // 支付ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "subject": "订单标题",       // 订单标题
  "totalAmount": 149.00,      // 支付金额
  "status": "paid",           // 支付状态
  "payTime": "2023-05-01 12:30:00", // 支付时间
  "thirdPartyNo": "wx2023050112345678901234567890", // 第三方支付号
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-01 12:30:00"   // 更新时间
}
```

### 3. 取消微信支付

- **接口路径**: `PUT /auth-api/wechat/cancel`
- **接口描述**: 取消微信支付
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "paymentId": 1              // 必填，支付ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 取消是否成功
  "cancelTime": "2023-05-01 12:30:00" // 取消时间
}
```

### 4. 微信支付回调

- **接口路径**: `POST /public-api/wechat/notify`
- **接口描述**: 微信支付结果通知
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "return_code": "SUCCESS", // 返回状态码
  "return_msg": "OK", // 返回信息
  "appid": "wx1234567890abcdef", // 应用ID
  "mch_id": "1234567890", // 商户号
  "nonce_str": "random_string", // 随机字符串
  "sign": "sign_string", // 签名
  "result_code": "SUCCESS", // 业务结果
  "openid": "ox1234567890abcdef", // 用户标识
  "is_subscribe": "Y", // 是否关注公众账号
  "trade_type": "NATIVE", // 交易类型
  "bank_type": "CFT", // 付款银行
  "total_fee": "14900", // 订单总金额，单位为分
  "fee_type": "CNY", // 货币类型
  "transaction_id": "wx2023050112345678901234567890", // 微信支付订单号
  "out_trade_no": "PAY20230501001", // 商户订单号
  "attach": "order_type:course", // 附加数据
  "time_end": "20230501123000", // 支付完成时间
  "time_start": "20230501120000" // 支付发起时间
}
```
- **响应参数**:
```json
{
  "return_code": "SUCCESS",
  "return_msg": "OK"
}
```

## 余额支付接口

### 1. 创建余额支付

- **接口路径**: `POST /auth-api/balance/create`
- **接口描述**: 创建余额支付
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "orderId": 1,               // 必填，订单ID
  "orderType": "course",       // 必填，订单类型：course(课程订单), card(会员卡订单)
  "subject": "订单标题",       // 必填，订单标题
  "totalAmount": 149.00,      // 必填，支付金额
  "password": "123456"        // 必填，支付密码
}
```
- **响应参数**:
```json
{
  "paymentId": 1,             // 支付ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "subject": "订单标题",       // 订单标题
  "totalAmount": 149.00,      // 支付金额
  "status": "paid",           // 支付状态：created(已创建), paying(支付中), paid(已支付), failed(支付失败), cancelled(已取消)
  "payTime": "2023-05-01 12:30:00", // 支付时间
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-01 12:30:00"   // 更新时间
}
```

### 2. 查询余额支付

- **接口路径**: `GET /auth-api/balance/query`
- **接口描述**: 查询余额支付状态
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "paymentId": 1              // 必填，支付ID
}
```
- **响应参数**:
```json
{
  "paymentId": 1,             // 支付ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "subject": "订单标题",       // 订单标题
  "totalAmount": 149.00,      // 支付金额
  "status": "paid",           // 支付状态
  "payTime": "2023-05-01 12:30:00", // 支付时间
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-01 12:30:00"   // 更新时间
}
```

## 支付记录接口

### 1. 获取支付记录详情

- **接口路径**: `GET /auth-api/payment`
- **接口描述**: 获取支付记录详情
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，支付记录ID
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 支付记录ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "orderNo": "ORDER20230501001", // 订单号
  "subject": "订单标题",       // 订单标题
  "totalAmount": 149.00,      // 支付金额
  "payType": "alipay",        // 支付方式
  "status": "paid",           // 支付状态
  "payTime": "2023-05-01 12:30:00", // 支付时间
  "thirdPartyNo": "2023050122001234567890123456789", // 第三方支付号
  "memberId": 1001,           // 用户ID
  "member": {                 // 用户信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-01 12:30:00"   // 更新时间
}
```

### 2. 获取支付记录列表

- **接口路径**: `GET /auth-api/payment/list`
- **接口描述**: 获取当前登录用户的支付记录列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "orderType": "course",       // 可选，订单类型
  "payType": "alipay",        // 可选，支付方式
  "status": "paid",           // 可选，支付状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), payTime(支付时间), totalAmount(支付金额)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 支付记录列表
    {
      // 同获取支付记录详情接口的响应参数
    }
  ]
}
```

### 3. 获取所有支付记录列表

- **接口路径**: `GET /admin-api/payment/list`
- **接口描述**: 获取所有支付记录列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "orderId": 1,               // 可选，订单ID
  "orderType": "course",       // 可选，订单类型
  "payType": "alipay",        // 可选，支付方式
  "status": "paid",           // 可选，支付状态
  "memberId": 1001,           // 可选，用户ID
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), payTime(支付时间), totalAmount(支付金额)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 支付记录列表
    {
      // 同获取支付记录详情接口的响应参数
    }
  ]
}
```

## 退款接口

### 1. 创建退款

- **接口路径**: `POST /admin-api/refund/create`
- **接口描述**: 创建退款
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "paymentId": 1,             // 必填，支付记录ID
  "refundAmount": 149.00,      // 必填，退款金额
  "reason": "退款原因",         // 必填，退款原因
  "refundType": "original"     // 可选，退款路径：original(原路退回), balance(退回余额)
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 退款ID
  "refundNo": "REFUND20230501001", // 退款单号
  "paymentId": 1,             // 支付记录ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "orderNo": "ORDER20230501001", // 订单号
  "subject": "订单标题",       // 订单标题
  "totalAmount": 149.00,      // 支付金额
  "refundAmount": 149.00,      // 退款金额
  "refundType": "original",     // 退款路径
  "reason": "退款原因",         // 退款原因
  "payType": "alipay",        // 支付方式
  "status": "processing",     // 退款状态：processing(处理中), success(成功), failed(失败), cancelled(已取消)
  "memberId": 1001,           // 用户ID
  "member": {                 // 用户信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "processTime": null,         // 处理时间
  "successTime": null,         // 成功时间
  "thirdPartyNo": null,       // 第三方退款单号
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 查询退款

- **接口路径**: `GET /admin-api/refund/query`
- **接口描述**: 查询退款状态
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "refundId": 1              // 必填，退款ID
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 退款ID
  "refundNo": "REFUND20230501001", // 退款单号
  "paymentId": 1,             // 支付记录ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "orderNo": "ORDER20230501001", // 订单号
  "subject": "订单标题",       // 订单标题
  "totalAmount": 149.00,      // 支付金额
  "refundAmount": 149.00,      // 退款金额
  "refundType": "original",     // 退款路径
  "reason": "退款原因",         // 退款原因
  "payType": "alipay",        // 支付方式
  "status": "success",       // 退款状态
  "memberId": 1001,           // 用户ID
  "member": {                 // 用户信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "processTime": "2023-05-01 12:30:00", // 处理时间
  "successTime": "2023-05-01 13:00:00", // 成功时间
  "thirdPartyNo": "2023050122001234567890123456789", // 第三方退款单号
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-01 13:00:00"   // 更新时间
}
```

### 3. 取消退款

- **接口路径**: `PUT /admin-api/refund/cancel`
- **接口描述**: 取消退款
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "refundId": 1              // 必填，退款ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 取消是否成功
  "cancelTime": "2023-05-01 12:30:00" // 取消时间
}
```

### 4. 获取退款记录详情

- **接口路径**: `GET /auth-api/refund`
- **接口描述**: 获取退款记录详情
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，退款记录ID
}
```
- **响应参数**: 同创建退款接口

### 5. 获取退款记录列表

- **接口路径**: `GET /auth-api/refund/list`
- **接口描述**: 获取当前登录用户的退款记录列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "orderType": "course",       // 可选，订单类型
  "payType": "alipay",        // 可选，支付方式
  "status": "success",       // 可选，退款状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), successTime(成功时间), refundAmount(退款金额)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 退款记录列表
    {
      // 同创建退款接口的响应参数
    }
  ]
}
```

### 6. 获取所有退款记录列表

- **接口路径**: `GET /admin-api/refund/list`
- **接口描述**: 获取所有退款记录列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "orderId": 1,               // 可选，订单ID
  "orderType": "course",       // 可选，订单类型
  "payType": "alipay",        // 可选，支付方式
  "status": "success",       // 可选，退款状态
  "memberId": 1001,           // 可选，用户ID
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), successTime(成功时间), refundAmount(退款金额)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 退款记录列表
    {
      // 同创建退款接口的响应参数
    }
  ]
}
```

## 支付统计接口

### 1. 获取支付统计

- **接口路径**: `GET /admin-api/payment/statistics`
- **接口描述**: 获取支付统计数据
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01",  // 必填，开始时间
  "endTime": "2023-05-31",    // 必填，结束时间
  "payType": "alipay",        // 可选，支付方式
  "groupType": "day"         // 可选，分组类型：day(按天), week(按周), month(按月)
}
```
- **响应参数**:
```json
{
  "totalAmount": 100000.00,   // 总支付金额
  "totalNum": 1000,          // 总支付笔数
  "successAmount": 95000.00,  // 成功支付金额
  "successNum": 950,         // 成功支付笔数
  "failAmount": 5000.00,     // 失败支付金额
  "failNum": 50,            // 失败支付笔数
  "statisticsList": [         // 统计列表
    {
      "date": "2023-05-01", // 日期
      "amount": 10000.00,   // 支付金额
      "num": 100           // 支付笔数
    }
  ]
}
```

### 2. 获取退款统计

- **接口路径**: `GET /admin-api/refund/statistics`
- **接口描述**: 获取退款统计数据
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01",  // 必填，开始时间
  "endTime": "2023-05-31",    // 必填，结束时间
  "payType": "alipay",        // 可选，支付方式
  "groupType": "day"         // 可选，分组类型：day(按天), week(按周), month(按月)
}
```
- **响应参数**:
```json
{
  "totalAmount": 10000.00,    // 总退款金额
  "totalNum": 100,           // 总退款笔数
  "successAmount": 9500.00,   // 成功退款金额
  "successNum": 95,           // 成功退款笔数
  "failAmount": 500.00,      // 失败退款金额
  "failNum": 5,              // 失败退款笔数
  "statisticsList": [         // 统计列表
    {
      "date": "2023-05-01", // 日期
      "amount": 1000.00,   // 退款金额
      "num": 10            // 退款笔数
    }
  ]
}
```
