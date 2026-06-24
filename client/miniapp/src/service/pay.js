import request from "@/utils/service/index.js";
import { clearAllAuthData } from "@/utils/auth.js";
import {
  cancelPaymentOrderByTradeNo,
  closePaymentOrderStatus,
  getConsecutivePaymentProduct,
  getTokenCount as getSharedTokenCount,
  getTokenReturn as getSharedTokenReturn,
  initiateWechatPay,
} from "@/vendor/shared-services.bundle.js";

const sharedRequestAdapter = {
  request(config) {
    return request({
      url: config.url,
      method: config.method || "GET",
      data: config.params || config.data || {},
      header: config.headers || {},
      timeout: config.timeout,
      base: config.base,
    });
  },
};

// Token 过期错误码
const TOKEN_EXPIRED_CODES = [40101, 499, 401];

// 获取 platform-type 的辅助函数
function getPlatformType() {
  const loginType = uni.getStorageSync('loginType') || 'android';
  console.log('loginType', loginType);
  if (loginType === 'android') {
    return 'android';
  } else if (loginType === 'third_wechat') {
    return 'third_wechat';
  } else if (loginType === 'third_ali') {
    return 'third_ali';
  }
  return 'android';
}

// 检查 token 是否失效
function isTokenExpired(res) {
  return TOKEN_EXPIRED_CODES.includes(res.data?.code) || TOKEN_EXPIRED_CODES.includes(res.statusCode);
}

//支付
/**
 *微信支付拉起接口
 * @param {*} uuid
 * @param {*} openId
 * @param {*} desc
 * @param {*} amount
 * @param {*} id
 * @param {*} productType
 * @param {*} payType
 * @returns
 */
export function miniPay(uuid,openId, desc, amount, id, productType, payType) {
  console.log('miniPay - 开始调用支付API');
  console.log('miniPay - 请求参数:', { uuid, openId, desc, amount, id, productType, payType });
  
  return initiateWechatPay(
    sharedRequestAdapter,
    { uuid, openId, desc, amount, id, productType, payType },
    { appEndpoint: true },
  ).then(data => {
    console.log('miniPay - API响应成功:', data);
    console.log('miniPay - 响应数据类型:', typeof data);
    console.log('miniPay - 响应数据内容:', JSON.stringify(data));
    
    // request 函数在成功时返回的是 res.data，而不是包含 statusCode 的响应对象
    // 所以这里 data 就是响应数据本身
    if (!data) {
      console.error('miniPay - API返回数据为空');
      throw new Error('API返回数据为空');
    }
    
    // 检查业务错误码（后端可能返回字符串 "200" 或数字 200）
    // 只有当 code 存在且不等于 200（字符串或数字）时才认为是错误
    const code = data.code;
    if (code !== undefined) {
      // 转换为字符串进行比较，支持 "200" 和 200 两种情况
      const codeStr = String(code);
      if (codeStr !== "200") {
        console.error('miniPay - API返回业务错误:', data);
        throw new Error(data.message || data.msg || 'API返回业务错误');
      }
    }
    
    // 如果 data 有 data 字段，说明格式是 {code: 200, data: {...}}，返回 data.data
    // 否则直接返回 data
    const result = data.data || data;
    console.log('miniPay - 返回的支付数据:', result);
    return result;
  }).catch(err => {
    console.error('miniPay - API调用异常:', err);
    console.error('miniPay - 错误类型:', typeof err);
    console.error('miniPay - 错误详情:', JSON.stringify(err));
    
    // 如果是 reject(res) 的情况，err 可能包含 statusCode
    if (err && err.statusCode !== undefined) {
      console.error('miniPay - HTTP错误状态码:', err.statusCode);
      throw new Error(`请求失败，状态码: ${err.statusCode}`);
    }
    
    // 如果是错误对象但没有 statusCode，直接抛出
    throw err;
  });
}
/**
 *支付宝支付拉起接口
 * @param {*} uuid
 * @param {*} desc
 * @param {*} id
 * @param {*} type
 * @param {*} price
 * @returns
 */
export function zfb_newPay(uuid, desc, id, productType, amount) {
  return new Promise((resolve, reject) => {
    let zhsToken = uni.getStorageSync('data').thirdPartyAccounts;

    uni.request({
      url: '/prod-api/ai' + "/fund/ali/pay/create",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { uuid, desc, id, productType, amount },
      success: (res) => {
        if (isTokenExpired(res)) {
          const refreshToken = uni.getStorageSync('data')?.thirdPartyAccounts?.refreshToken;
          const uuidStorage = uni.getStorageSync('data')?.uuid;
          
          if (refreshToken) {
            uni.request({
              url: '/prod-api/ai/login/pwd/refreshToken',
              method: "POST",
              header: {
                "platform-type": getPlatformType(),
              },
              data: {
                refreshToken: refreshToken,
                uuid: uuidStorage,
              },
              success: (refreshRes) => {
                if (refreshRes.statusCode === 200 && refreshRes.data) {
                  const storage = uni.getStorageSync("data");
                  const newAccessToken = refreshRes.data.data;
                  
                  // 确保 thirdPartyAccounts 对象存在
                  if (!storage.thirdPartyAccounts) {
                    storage.thirdPartyAccounts = {};
                  }
                  storage.thirdPartyAccounts.accessToken = newAccessToken;
                  uni.setStorageSync("data", storage);
                  uni.setStorageSync('token', newAccessToken);
                  
                  zfb_newPay(uuid, desc, id, productType, amount).then(resolve).catch(reject);
                } else {
                  clearAllAuthData();
                  reject(refreshRes);
                }
              },
              fail: (err) => {
                clearAllAuthData();
                reject(err);
              },
            });
          } else {
            clearAllAuthData();
            reject(res);
          }
          return;
        }
        resolve(res);
      },
      fail: (err) => {
        uni.showToast({
          title: "请求失败",
          icon: "none",
        });
        reject(err);
      },
    });
  });
}
// outTradeNo
/**
 *根据输入的id和token值变化,整理剩余token值接口
 * @param {*} id //用户id
 * @returns
 */
export function getTokenCount(id, quantity, remarks) {
  return getSharedTokenCount(sharedRequestAdapter, { id, quantity, remarks });
}
export function getTokenReturn(userContextId) {
  return getSharedTokenReturn(sharedRequestAdapter, userContextId);
}
/**
 * 退款 接口
 * @param {*} out_trade_no //订单号
 * @param {*} reason //描述
 * @returns
 */
export function refund(out_trade_no, reason) {
  return request({
    url: "/index.php/refund",
    method: "POST",
    data: { out_trade_no, reason },
  });
}

/**
 *用户提现
 * @param {*} user_id
 * @param {*} amount
 * @returns
 */
export function withdraw(user_id, amount) {
  return request({
    url: "/index.php/withdraw",
    data: { user_id, amount },
  });
}
// 支付成功关闭订单
export function closeorder(openId, outTradeNo) {
  return closePaymentOrderStatus(sharedRequestAdapter, openId, outTradeNo);
}
// 取消关闭订单
export function closeorders(openId, outTradeNo) {
  return cancelPaymentOrderByTradeNo(sharedRequestAdapter, openId, outTradeNo);
}

// 获取智能体消耗的token值
export function getAgenttokens(id,token,problem) {
  return request({
    url: `/resource/getAgent`,
    method: "GET",
    data: { id,token,problem }
  });
}
// 智能体返回的文字传给后端
export function postContext(id,answer,agentUrl) {
  return request({
    url: `/resource/saveUserContext`,
    method: "POST",
    header: {
      "content-type": "application/json",
    },
    data: { id,answer,agentUrl }
  });
}

// 获取智能体历史对话
export function getUserContext(id, token,field1) {
  return request({
    url: `/resource/getUserContext`,
    method: "GET",
    header: {
      "content-type": "application/json",
    },
    data: { id, token,field1 }
  });
}

// 获取智能体列表
export function getAgentList(options) {
  return request({
    url: "/agent/rule/search/bylink",
    method: "GET",
    header: {
      "content-type": "application/json",
    },
    base: 1,
    data: {
      uuid: uni.getStorageSync("data").uuid,
      ...options
    }
  });
}

// 使用 base1 获取智能体列表（用于 ai_index.vue）
export function getAgentListBase1(options) {
  return request({
    url: "/agent/rule/search/bylink",
    method: "GET",
    header: {
      "content-type": "application/json",
    },
    base: 3, 
    data: {
      uuid: uni.getStorageSync("data").uuid,
      ...options
    }
  });
}
// 获取智能体列表
export function getAgentListAll(options) {
  return request({
    url: "/cozeZhsApi/agents/Alllist",
    method: "GET",
    header: {
      "content-type": "application/json",
    },
    base: 3,
    data: {
      uuid: uni.getStorageSync("data").uuid,
      ...options
    }
  });
}

export function categories(options) {
  return request({
    url: "/cozeZhsApi/cache/agent-category-dict/categories",
    method: "GET",
    header: {
      "content-type": "application/json",
    },
    base: 3
  });
}



// 智能体收藏
export function getAgentCollect(id) {
  return request({
    url: "/cozeZhsApi/agents/collect",
    method: "POST",
    header: {
      "content-type": "application/json",
    },
    base: 3,
    data: {
      uuid: uni.getStorageSync("data").uuid,
      botId: id,
    }
  });
}

// 智能体点赞
export function getAgentLike(id) {
  return request({
    url: "/cozeZhsApi/agents/thumbs",
    method: "POST",
    header: {
      "content-type": "application/json",
    },
    base: 3,
    data: {
      uuid: uni.getStorageSync("data").uuid,
      botId: id,
    }
  });
}

// 获取最近使用的智能体历史
export function getAgentUseHistory(options = {}) {
  return request({
    url: "/agent/use/history",
    method: "GET",
    header: {
      "content-type": "application/json",
    },
    data: {
      uuid: uni.getStorageSync("data").uuid,
      ...options
    }
  });
}

// 打开智能体请求接口记录使用次数
export function getAgentUse(id) {
  return request({
    url: "/cozeZhsApi/agents/use",
    method: "POST",
    header: {
      "content-type": "application/json",
    },
    base: 3,
    data: {
      uuid: uni.getStorageSync("data").uuid,
      botId: id,
    }
  });
}

// 获取智汇值
export function getAgentInfo() {
  return request({
    url: "/remote/info/" + uni.getStorageSync("data").uuid,
    method: "GET",
    base: 2,
    header: {
      "content-type": "application/json",
    },
  });
}
// 消费的智能体记录
export function getZHZ(params){
  return request({
    url: "/cozeZhsApi/agents/user/billing",
    method: "POST",
    base: 3,
    header: {
      "content-type": "application/json",
    },
    data: params

  });
}
// 智能体消耗的token值详情
export function getZHZDMX(params){
  return request({
    url: "/cozeZhsApi/user-agent-context/history",
    method: "POST",
    base: 3,
    header: {
      "content-type": "application/json",
    },
    data: params
  });
}


// 存储会话历史记录
export function saveChatHistory(id,token,problem,field1) {
  return request({
    url: `/resource/getAgent2`,
    method: "GET",
    data: { id,token,problem,field1 }
  });
}

export function getUserContextField(id, token) {
  return request({
    url: `/resource/getUserContext/field`,
    method: "GET",
    data: { id,token }
  });
}

//删除历史会话

export function removeField(data) {
  return request({
    url: `/resource/remove/context/field`,
    method: "POST",
    header: {
      "content-type": "application/json",
    },
    data:data
  });
}

export function product() {
  return getConsecutivePaymentProduct(sharedRequestAdapter);
}

// 智能体创建分享
export function agentCreationShare(contextId, title, coverUrl, subtitle, fileUrl, problem, answer) {
  return request({
    url: "/agent/creation/share",
    method: "POST",
    base: 1,
    header: {
      "content-type": "application/json",
    },
    data: {
      contextId: contextId || "",
      title: title || "",
      coverUrl: coverUrl || "",
      subtitle: subtitle || "",
      fileUrl: fileUrl || "",
      problem: problem || "",
      answer: answer || ""
    }
  });
}

export function agentCreationShareThird(chatId, agentId, ids) {
  return request({
    url: "/agent/creation/share/code",
    method: "POST",
    base: 1,
    header: {
      "content-type": "application/json",
    },
    data: {
      chat_id: chatId || "",
      agent_id: agentId || "",
      ids: ids || []
    }
  });
}

// 根据分享code获取分享内容
export function getShareContentByCode(code) {
  return request({
    url: `/agent/creation/share/detail?code=${encodeURIComponent(code || "")}`,
    method: "GET",
    base: 1,
    header: {
      "content-type": "application/json",
    },
    data: {}
  });
}
