
# 公共Socket接口文档

## 概述

公共Socket接口是一个基于Socket.IO的实时通信服务，支持通过user_uuid+model_id作为唯一标识来管理连接，并提供消息推送功能。

## 功能特点

1. 支持通过user_uuid+model_id作为唯一标识管理连接
2. 提供多种消息推送方式：
   - 向特定用户和模型推送消息
   - 向特定用户的所有连接广播消息
   - 向使用特定模型的所有连接广播消息
3. 提供REST API接口，方便服务端调用
4. 提供客户端测试页面，方便调试和测试

## API接口

### 1. 连接管理

#### 连接注册
客户端连接到Socket.IO服务器后，需要发送注册信息：

```javascript
socket.emit('register', {
    user_uuid: '用户UUID',
    model_id: '模型ID',
    connection_info: {
        // 可选的连接信息
        client_type: 'web',
        version: '1.0'
    }
});
```

### 2. 消息推送

#### 向特定用户和模型推送消息
```http
POST /cozeZhsApi/public-socket/send-message/{user_uuid}/{model_id}
```

请求体：
```json
{
    "message": "要发送的消息内容",
    "event_name": "message"  // 可选，默认为"message"
}
```

#### 向特定用户的所有连接广播消息
```http
POST /cozeZhsApi/public-socket/broadcast/user/{user_uuid}
```

请求体：
```json
{
    "message": "要广播的消息内容",
    "event_name": "message"  // 可选，默认为"message"
}
```

#### 向使用特定模型的所有连接广播消息
```http
POST /cozeZhsApi/public-socket/broadcast/model/{model_id}
```

请求体：
```json
{
    "message": "要广播的消息内容",
    "event_name": "message"  // 可选，默认为"message"
}
```

### 3. 统计信息

#### 获取统计信息
```http
GET /cozeZhsApi/public-socket/stats
```

返回示例：
```json
{
    "code": 200,
    "msg": "success",
    "data": {
        "total_connections": 100,
        "current_connections": 25,
        "total_messages": 500,
        "peak_connections": 30
    }
}
```

## 客户端使用示例

### JavaScript客户端

```javascript
// 连接到Socket.IO服务器
const socket = io('/public-socket.io');

// 连接成功后注册
socket.on('connect', () => {
    socket.emit('register', {
        user_uuid: 'test-user-123',
        model_id: 'gpt-3.5-turbo',
        connection_info: {
            client_type: 'web',
            version: '1.0'
        }
    });
});

// 接收消息
socket.on('message', (data) => {
    console.log('收到消息:', data);
});

// 接收其他事件
socket.on('custom_event', (data) => {
    console.log('收到自定义事件:', data);
});
```

### Python服务端调用

```python
from coze_zhs_py.api.public_socket import send_message_to_user_model

# 向特定用户和模型发送消息
await send_message_to_user_model(
    user_uuid='test-user-123',
    model_id='gpt-3.5-turbo',
    message='你好，这是一条测试消息',
    event_name='message'
)
```

## 测试页面

项目提供了一个测试页面，可以通过以下URL访问：

```
http://localhost:8000/static/public_socket_client.html
```

测试页面提供了以下功能：
1. 连接设置：配置user_uuid、model_id和连接信息
2. 消息测试：发送和接收消息
3. API测试：通过REST API发送消息和查询连接状态

## 注意事项

1. 每个user_uuid+model_id组合只能有一个活跃连接，新的连接会自动断开旧连接
2. 连接信息会被记录，包括连接时间、最后活动时间和消息计数
3. 系统会自动清理长时间不活跃的连接（默认为10分钟）
4. 消息推送是异步的，不会阻塞调用方
