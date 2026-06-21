/**
 * 推送工具类
 * 根据 uni-app 推送文档实现：https://uniapp.dcloud.net.cn/api/plugins/push.html
 */

/**
 * 获取当前关联的 uniCloud 服务空间信息
 * @returns {Object} 服务空间信息
 */
export function getUniCloudSpaceInfo() {
  try {
    // #ifdef UNI_CLOUD
    if (typeof uniCloud !== 'undefined') {
      const spaceInfo = {
        spaceId: uniCloud.config?.spaceId || '未获取到',
        provider: uniCloud.config?.provider || '未获取到',
        spaceName: uniCloud.config?.spaceName || '未获取到'
      };
      
      console.log('当前 uniCloud 服务空间信息:', spaceInfo);
      return spaceInfo;
    } else {
      console.warn('uniCloud 对象不存在');
      return {
        spaceId: '未找到',
        provider: '未找到',
        spaceName: '未找到'
      };
    }
    // #endif
    
    // #ifndef UNI_CLOUD
    console.warn('当前环境不支持 uniCloud');
    return {
      spaceId: '不支持',
      provider: '不支持',
      spaceName: '不支持'
    };
    // #endif
  } catch (error) {
    console.error('获取 uniCloud 服务空间信息失败:', error);
    return {
      spaceId: '获取失败',
      provider: '获取失败',
      spaceName: '获取失败',
      error: error.message
    };
  }
}

/**
 * 获取推送客户端ID
 * 注意：此API可能会读取OAID等设备信息，必须在用户同意隐私政策后调用
 * @returns {Promise<string>} 返回 pushClientId
 */
export function getPushClientId() {
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    // 检查用户是否已同意隐私政策
    const privacyPolicyShown = uni.getStorageSync('privacyPolicyShown');
    if (!privacyPolicyShown) {
      console.warn('⚠️ 用户未同意隐私政策，暂不获取推送客户端ID（避免读取OAID等设备信息）');
      // 返回null而不是reject，这样应用可以继续运行
      resolve(null);
      return;
    }
    
    console.log('开始获取推送客户端ID...');
    
    uni.getPushClientId({
      success: (res) => {
        console.log('获取推送客户端ID成功:', res.cid);
        resolve(res.cid);
      },
      fail: (err) => {
        console.error('获取推送客户端ID失败:', err);
        console.error('错误详情:', JSON.stringify(err));
        
        // 如果 uni-push 未启用，不抛出错误，返回 null
        // 这样应用可以继续运行，只是没有推送功能
        if (err.errMsg && err.errMsg.includes('uniPush is not enabled')) {
          console.warn('⚠️ uni-push 未启用，推送功能将不可用');
          console.warn('📋 请检查以下配置：');
          console.warn('1. 是否在 uniCloud 控制台开通了 uni-push2.0 服务');
          console.warn('2. 是否在 DCloud 开发者中心配置了应用信息（包名、签名等）');
          console.warn('3. 是否在 HBuilderX 的 manifest.json 中正确配置了 Push 模块');
          console.warn('4. 是否已重新打包自定义基座（修改 manifest.json 后必须重新打包）');
          console.warn('5. 是否关联了正确的 uniCloud 服务空间');
          resolve(null);
        } else {
          reject(err);
        }
      }
    });
    // #endif
    
    // #ifndef APP-PLUS
    reject(new Error('推送功能仅支持APP端'));
    // #endif
  });
}

/**
 * 启动推送消息监听
 * @param {Function} callback 回调函数，接收推送消息
 * @returns {Function} 返回回调函数，可用于取消监听
 */
export function onPushMessage(callback) {
  // #ifdef APP-PLUS
  uni.onPushMessage((res) => {
    console.log('收到推送消息:', res);
    
    // res.type: "click" - 从系统推送服务点击消息启动应用事件
    //         "receive" - 应用从推送服务器接收到推送消息事件
    // res.data: 消息内容（String 或 Object）
    
    if (callback && typeof callback === 'function') {
      callback(res);
    }
  });
  
  // 返回回调函数，用于取消监听
  return callback;
  // #endif
  
  // #ifndef APP-PLUS
  console.warn('推送消息监听仅支持APP端');
  return null;
  // #endif
}

/**
 * 关闭推送消息监听
 * @param {Function} callback 要移除的回调函数，如果不传则移除所有监听
 */
export function offPushMessage(callback) {
  // #ifdef APP-PLUS
  if (callback) {
    uni.offPushMessage(callback);
  } else {
    uni.offPushMessage();
  }
  // #endif
}

/**
 * 获取通知渠道管理器（Android 8+）
 * @returns {Object} ChannelManager 对象
 */
export function getChannelManager() {
  // #ifdef APP-PLUS-ANDROID
  return uni.getChannelManager();
  // #endif
  
  // #ifndef APP-PLUS-ANDROID
  console.warn('通知渠道管理器仅支持Android平台');
  return null;
  // #endif
}

/**
 * 创建本地推送消息
 * @param {Object} options 推送消息配置
 * @param {string} options.title 消息标题
 * @param {string} options.content 消息内容
 * @param {string} options.payload 消息附加数据
 * @param {number} options.delay 延迟显示时间（秒）
 * @param {string} options.channelId 渠道ID（Android）
 * @returns {Promise}
 */
export function createPushMessage(options = {}) {
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    const {
      title = '通知',
      content = '',
      payload = '',
      delay = 0,
      channelId = ''
    } = options;
    
    const messageOptions = {
      title,
      content,
      payload,
      delay
    };
    
    // Android 8+ 支持渠道ID
    // #ifdef APP-PLUS-ANDROID
    if (channelId) {
      messageOptions.channelId = channelId;
    }
    // #endif
    
    uni.createPushMessage({
      ...messageOptions,
      success: (res) => {
        console.log('创建推送消息成功:', res);
        resolve(res);
      },
      fail: (err) => {
        console.error('创建推送消息失败:', err);
        reject(err);
      }
    });
    // #endif
    
    // #ifndef APP-PLUS
    reject(new Error('推送消息创建仅支持APP端'));
    // #endif
  });
}

/**
 * 初始化推送功能
 * 获取 pushClientId 并启动消息监听
 * @param {Object} options 配置选项
 * @param {Function} options.onMessage 消息回调函数
 * @param {Function} options.onClientId 获取到 ClientId 的回调
 * @returns {Promise<string>} 返回 pushClientId
 */
export function initPush(options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      // 获取推送客户端ID
      const pushClientId = await getPushClientId();
      
      // 如果 pushClientId 为 null，说明 uni-push 未启用
      if (pushClientId === null) {
        console.warn('uni-push 未启用，推送功能将不可用');
        // 仍然触发回调，但传入 null
        if (options.onClientId && typeof options.onClientId === 'function') {
          options.onClientId(null);
        }
        resolve(null);
        return;
      }
      
      // 保存到本地存储
      uni.setStorageSync('pushClientId', pushClientId);
      
      // 触发获取到 ClientId 的回调
      if (options.onClientId && typeof options.onClientId === 'function') {
        options.onClientId(pushClientId);
      }
      
      // 启动推送消息监听
      if (options.onMessage && typeof options.onMessage === 'function') {
        onPushMessage(options.onMessage);
      } else {
        // 默认消息处理
        onPushMessage((res) => {
          console.log('收到推送消息:', res);
          
          // 处理点击消息事件
          if (res.type === 'click') {
            console.log('用户点击了推送消息:', res.data);
            // 可以在这里处理消息点击后的跳转逻辑
            handlePushClick(res.data);
          }
          
          // 处理接收消息事件
          if (res.type === 'receive') {
            console.log('接收到推送消息:', res.data);
            // 可以在这里显示通知或更新UI
          }
        });
      }
      
      resolve(pushClientId);
    } catch (error) {
      console.error('初始化推送功能失败:', error);
      // 即使初始化失败，也不阻止应用运行
      // 返回 null 表示推送功能不可用
      if (options.onClientId && typeof options.onClientId === 'function') {
        options.onClientId(null);
      }
      resolve(null);
    }
  });
}

/**
 * 处理推送消息点击事件
 * @param {string|Object} data 推送消息数据
 */
function handlePushClick(data) {
  try {
    let messageData = data;
    
    // 如果 data 是字符串，尝试解析为 JSON
    if (typeof data === 'string') {
      try {
        messageData = JSON.parse(data);
      } catch (e) {
        // 解析失败，使用原始字符串
        messageData = { content: data };
      }
    }
    
    // 根据消息类型进行不同的处理
    if (messageData.type) {
      switch (messageData.type) {
        case 'page':
          // 跳转到指定页面
          if (messageData.url) {
            uni.navigateTo({
              url: messageData.url,
              fail: () => {
                uni.reLaunch({ url: messageData.url });
              }
            });
          }
          break;
        case 'url':
          // 打开外部链接
          if (messageData.url) {
            // #ifdef APP-PLUS
            plus.runtime.openURL(messageData.url);
            // #endif
          }
          break;
        default:
          console.log('未知的推送消息类型:', messageData.type);
      }
    }
  } catch (error) {
    console.error('处理推送消息点击失败:', error);
  }
}

/**
 * 将 pushClientId 发送到后端保存
 * @param {string} pushClientId 推送客户端ID
 * @param {string} userId 用户ID（可选）
 * @returns {Promise}
 */
export async function savePushClientIdToServer(pushClientId, userId = null) {
  try {
    // 如果使用 uniCloud，可以调用云函数保存
    // #ifdef UNI_CLOUD
    const result = await uniCloud.callFunction({
      name: 'uni-id-co',
      data: {
        action: 'setPushCid',
        params: {
          pushClientId: pushClientId
        }
      }
    });
    
    if (result.result && result.result.errCode === 0) {
      console.log('推送客户端ID保存成功');
      return result.result;
    } else {
      throw new Error(result.result?.errMsg || '保存失败');
    }
    // #endif
    
    // 如果使用自己的后端API
    // #ifndef UNI_CLOUD
    // 这里可以调用您的后端API保存 pushClientId
    // const response = await request({
    //   url: '/api/user/updatePushClientId',
    //   method: 'POST',
    //   data: {
    //     pushClientId: pushClientId,
    //     userId: userId
    //   }
    // });
    // return response;
    // #endif
  } catch (error) {
    console.error('保存推送客户端ID到服务器失败:', error);
    throw error;
  }
}
