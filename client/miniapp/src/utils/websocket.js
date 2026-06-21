/**
 * WebSocket 工具类
 * 用于连接服务端 WebSocket，监听推送消息
 */

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.url = null;
    this.userUuid = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000; // 3秒
    this.heartbeatTimer = null;
    this.heartbeatInterval = 30000; // 30秒心跳
    this.isManualClose = false; // 是否手动关闭
    this.onMessageCallback = null; // 消息回调
    this.onErrorCallback = null; // 错误回调
    this.onOpenCallback = null; // 连接成功回调
    this.onCloseCallback = null; // 连接关闭回调
  }

  /**
   * 连接 WebSocket
   * @param {string} url WebSocket 地址
   * @param {string} userUuid 用户UUID
   * @param {Object} callbacks 回调函数对象
   */
  connect(url, userUuid, callbacks = {}) {
    if (!url || !userUuid) {
      console.error('WebSocket连接失败：缺少必要参数');
      return;
    }

    this.url = url;
    this.userUuid = userUuid;
    this.isManualClose = false;
    this.reconnectAttempts = 0;

    if (callbacks.onMessage) this.onMessageCallback = callbacks.onMessage;
    if (callbacks.onError) this.onErrorCallback = callbacks.onError;
    if (callbacks.onOpen) this.onOpenCallback = callbacks.onOpen;
    if (callbacks.onClose) this.onCloseCallback = callbacks.onClose;

    this._connect();
  }

  /**
   * 内部连接方法
   */
  _connect() {
    try {
      console.log('正在连接 WebSocket:', this.url);
      
      // 如果是已存在的连接，先关闭
      if (this.ws && this.ws.readyState === 1) {
        console.log('WebSocket 已连接，无需重复连接');
        return;
      }

      // 创建 WebSocket 连接
      this.ws = uni.connectSocket({
        url: this.url,
        success: () => {
          console.log('WebSocket 连接请求已发送');
        },
        fail: (err) => {
          console.error('WebSocket 连接请求失败:', err);
          this._handleError(err);
        }
      });

      // 监听连接打开
      this.ws.onOpen(() => {
        console.log('WebSocket 连接已打开');
        this.reconnectAttempts = 0;
        this._onOpen();
      });

      // 监听消息
      this.ws.onMessage((res) => {
        console.log('收到 WebSocket 消息:', res);
        this._onMessage(res);
      });

      // 监听错误
      this.ws.onError((err) => {
        console.error('WebSocket 错误:', err);
        this._handleError(err);
      });

      // 监听连接关闭
      this.ws.onClose((res) => {
        console.log('WebSocket 连接已关闭:', res);
        this._onClose(res);
      });

    } catch (error) {
      console.error('WebSocket 连接异常:', error);
      this._handleError(error);
    }
  }

  /**
   * 连接打开处理
   */
  _onOpen() {
    // 发送加入系统房间消息
    this.sendJoinSystemRoom();
    
    // 启动心跳
    this._startHeartbeat();
    
    // 触发连接成功回调
    if (this.onOpenCallback) {
      this.onOpenCallback();
    }
  }

  /**
   * 发送加入系统房间消息
   */
  sendJoinSystemRoom() {
    if (!this.ws || this.ws.readyState !== 1) {
      console.warn('WebSocket 未连接，无法发送加入房间消息');
      return;
    }

    const message = {
      event: 'join_system_room',
      user_uuid: this.userUuid
    };

    try {
      this.ws.send({
        data: JSON.stringify(message),
        success: () => {
          console.log('已发送加入系统房间消息:', message);
        },
        fail: (err) => {
          console.error('发送加入系统房间消息失败:', err);
        }
      });
    } catch (error) {
      console.error('发送加入系统房间消息异常:', error);
    }
  }

  /**
   * 消息处理
   */
  _onMessage(res) {
    try {
      let data = res.data;
      
      // 如果是字符串，尝试解析为 JSON
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }

      console.log('解析后的消息数据:', data);

      // 处理不同类型的消息
      if (data.event === 'room_message') {
        // 房间消息 - 先触发全局事件
        this._handleRoomMessage(data);
      } else if (data.event === 'pong') {
        // 心跳响应
        console.log('收到心跳响应');
      } else {
        // 其他类型消息
        console.log('收到其他类型消息:', data);
      }

      // 触发消息回调（让 App.vue 的 handleWebSocketMessage 处理）
      // 注意：对于 room_message，事件已经在 _handleRoomMessage 中触发
      // 这里只负责调用回调，让 App.vue 可以显示弹窗等
      if (this.onMessageCallback) {
        console.log('准备调用 onMessageCallback，传递数据:', data);
        this.onMessageCallback(data);
        console.log('✅ onMessageCallback 调用完成');
      } else {
        console.warn('⚠️ onMessageCallback 未设置');
      }

    } catch (error) {
      console.error('处理 WebSocket 消息失败:', error);
    }
  }

  /**
   * 处理房间消息
   */
  _handleRoomMessage(message) {
    console.log('=== _handleRoomMessage 处理房间消息 ===');
    console.log('消息内容:', JSON.stringify(message, null, 2));
    
    // 触发全局事件，让其他页面可以监听
    console.log('准备在 websocket.js 中触发 uni.$emit("websocketRoomMessage", message)');
    uni.$emit('websocketRoomMessage', message);
    console.log('✅ 已在 websocket.js 中触发 websocketRoomMessage 事件');
  }

  /**
   * 错误处理
   */
  _handleError(err) {
    // 触发错误回调
    if (this.onErrorCallback) {
      this.onErrorCallback(err);
    }

    // 如果不是手动关闭，尝试重连
    if (!this.isManualClose) {
      this._scheduleReconnect();
    }
  }

  /**
   * 连接关闭处理
   */
  _onClose(res) {
    // 停止心跳
    this._stopHeartbeat();

    // 触发关闭回调
    if (this.onCloseCallback) {
      this.onCloseCallback(res);
    }

    // 如果不是手动关闭，尝试重连
    if (!this.isManualClose) {
      this._scheduleReconnect();
    }
  }

  /**
   * 安排重连
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('WebSocket 重连次数已达上限，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * this.reconnectAttempts;

    console.log(`将在 ${delay / 1000} 秒后尝试第 ${this.reconnectAttempts} 次重连`);

    this.reconnectTimer = setTimeout(() => {
      if (!this.isManualClose) {
        console.log('尝试重连 WebSocket...');
        this._connect();
      }
    }, delay);
  }

  /**
   * 启动心跳
   */
  _startHeartbeat() {
    this._stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        try {
          this.ws.send({
            data: JSON.stringify({ event: 'ping' }),
            success: () => {
              console.log('发送心跳');
            },
            fail: (err) => {
              console.error('发送心跳失败:', err);
            }
          });
        } catch (error) {
          console.error('发送心跳异常:', error);
        }
      }
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 发送消息
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== 1) {
      console.warn('WebSocket 未连接，无法发送消息');
      return false;
    }

    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send({
        data: data,
        success: () => {
          console.log('消息发送成功:', message);
        },
        fail: (err) => {
          console.error('消息发送失败:', err);
        }
      });
      return true;
    } catch (error) {
      console.error('发送消息异常:', error);
      return false;
    }
  }

  /**
   * 关闭连接
   */
  close() {
    this.isManualClose = true;
    this._stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.close({
          success: () => {
            console.log('WebSocket 连接已关闭');
          },
          fail: (err) => {
            console.error('关闭 WebSocket 连接失败:', err);
          }
        });
      } catch (error) {
        console.error('关闭 WebSocket 连接异常:', error);
      }
      this.ws = null;
    }
  }

  /**
   * 获取连接状态
   */
  getReadyState() {
    if (!this.ws) return 3; // CLOSED
    return this.ws.readyState; // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
  }

  /**
   * 是否已连接
   */
  isConnected() {
    return this.getReadyState() === 1;
  }
}

// 创建单例
const websocketManager = new WebSocketManager();

export default websocketManager;
