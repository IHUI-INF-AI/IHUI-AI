// 使用Vue实例获取baseURL
const baseURL = Vue.prototype.$baseUrl

// 导入统一的认证清除函数
import { clearAllAuthData } from '@/utils/auth.js'

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

let isRefreshing = false;
let requestQueue = [];

// 刷新token的请求
function refreshTokenRequest() {
  return new Promise((resolve, reject) => {
    const storageData = uni.getStorageSync("data");
    const refreshToken = storageData?.thirdPartyAccounts?.refreshToken;
    const uuid = storageData?.uuid;
    
    if (!refreshToken) {
      return reject("No refresh token");
    }

    uni.request({
      url: baseURL + "/login/pwd/refreshToken",
      method: "POST",
      header: {
        "platform-type": getPlatformType(),
      },
      data: {
        refreshToken: refreshToken,
        uuid: uuid,
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const storage = uni.getStorageSync("data") || {};
          let newAccessToken = null;
          let newRefreshToken = null;
          
          // 处理不同的响应格式
          // 格式1: { data: "accessToken字符串" }
          // 格式2: { data: { accessToken: "...", refreshToken: "..." } }
          if (typeof res.data.data === 'string') {
            newAccessToken = res.data.data;
          } else if (res.data.data && typeof res.data.data === 'object') {
            newAccessToken = res.data.data.accessToken || res.data.data.token;
            newRefreshToken = res.data.data.refreshToken;
          }
          
          // 确保 thirdPartyAccounts 对象存在
          if (!storage.thirdPartyAccounts) {
            storage.thirdPartyAccounts = {};
          }
          
          // 保存新的 accessToken
          if (newAccessToken) {
            storage.thirdPartyAccounts.accessToken = newAccessToken;
            uni.setStorageSync('token', newAccessToken);
          }
          
          // 保存新的 refreshToken（如果存在）
          if (newRefreshToken) {
            storage.thirdPartyAccounts.refreshToken = newRefreshToken;
            console.log('刷新token接口 - 新的 refreshToken 已保存');
          }
          
          uni.setStorageSync("data", storage);
          
          resolve(newAccessToken || res.data.data);
        } else {
          reject(res);
        }
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

// 重新执行队列中的所有请求
function processQueue(error, token = null) {
  requestQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  requestQueue = [];
}

// 处理token刷新失败的情况
function handleRefreshTokenError() {
  clearAllAuthData({
    showToast: true,
    redirectToLogin: true,
    message: '登录已过期，请重新登录'
  });
}

function request(options = {}) {
	return new Promise((resolve, reject) => {
		const token = uni.getStorageSync('token')
		
		const originalRequest = () => {
			uni.request({
				url: baseURL + options.url,
				method: options.method || 'GET',
				data: options.data,
				header: {
					'content-type': 'application/json',
					'Authorization': token ? `Bearer ${token}` : ''
				},
				success: (res) => {
					if (res.statusCode === 200) {
						if (res.data.code === 0) {
							resolve(res.data)
						} else if (res.data.code === 401 || res.data.code === 40101) {
							// token过期，尝试刷新token
							if (!isRefreshing) {
								isRefreshing = true;
								refreshTokenRequest()
									.then((newAccessToken) => {
										processQueue(null, newAccessToken);
									})
									.catch((err) => {
										processQueue(err, null);
										handleRefreshTokenError();
									})
									.finally(() => {
										isRefreshing = false;
									});
							}
							// 将请求的 resolve 和 reject 方法存入队列，等待刷新成功后执行
							requestQueue.push({
								resolve: () => {
									// 用新的token重新请求
									originalRequest().then(resolve).catch(reject);
								},
								reject: reject,
							});
						} else {
							uni.showToast({
								title: res.data.msg || '请求失败',
								icon: 'none'
							})
							reject(new Error(res.data.msg || '请求失败'))
						}
					} else {
						uni.showToast({
							title: '网络错误',
							icon: 'none'
						})
						reject(new Error('网络错误'))
					}
				},
				fail: (err) => {
					uni.showToast({
						title: '网络错误',
						icon: 'none'
					})
					reject(err)
				}
			})
		};
		
		originalRequest();
	})
}

// 添加请求拦截器
request.interceptors = {
	request: (config) => {
		// 在发送请求之前做些什么
		return config
	},
	response: (response) => {
		// 对响应数据做点什么
		return response
	}
}

export default request

// 云函数调用封装
function callCloudFunction(name, data) {
	return new Promise((resolve, reject) => {
		uniCloud.callFunction({
			name,
			data
		}).then(res => {
			if (res.result.code === 0) {
				resolve(res.result)
			} else {
				uni.showToast({
					title: res.result.msg || '请求失败',
					icon: 'none'
				})
				reject(new Error(res.result.msg || '请求失败'))
			}
		}).catch(err => {
			uni.showToast({
				title: '网络错误',
				icon: 'none'
			})
			reject(err)
		})
	})
}

// 用户相关接口
export const userApi = {
	// 微信登录
	wxLogin: (data) => callCloudFunction('login', {
		action: 'wxLogin',
		params: data
	}),
	
	// 检查登录状态
	checkLoginStatus: (data) => callCloudFunction('login', {
		action: 'checkLoginStatus',
		params: data
	}),
	
	// 更新用户信息
	updateUserInfo: (data) => callCloudFunction('user', {
		action: 'updateUserInfo',
		params: data
	}),
	
	// 获取用户信息
	getUserInfo: (data) => callCloudFunction('user', {
		action: 'getUserInfo',
		params: data
	})
}

// 支付相关接口
export const paymentApi = {
	// 创建订单
	createOrder: (data) => callCloudFunction('payment', {
		action: 'createOrder',
		params: data
	}),
	
	// 查询订单状态
	queryOrder: (data) => callCloudFunction('payment', {
		action: 'queryOrder',
		params: data
	}),
	
	// 取消订单
	cancelOrder: (data) => callCloudFunction('payment', {
		action: 'cancelOrder',
		params: data
	})
}

// VIP相关接口
export const vipApi = {
	// 开通VIP
	openVip: (data) => callCloudFunction('vip', {
		action: 'openVip',
		params: data
	}),
	
	// 查询VIP状态
	queryVipStatus: (data) => callCloudFunction('vip', {
		action: 'queryVipStatus',
		params: data
	}),
	
	// 获取VIP权益
	getVipBenefits: (data) => callCloudFunction('vip', {
		action: 'getVipBenefits',
		params: data
	})
}

// AI对话相关接口
export const aiApi = {
	// 发送消息
	sendMessage: (data) => callCloudFunction('ai', {
		action: 'sendMessage',
		params: data
	}),
	
	// 获取历史记录
	getHistory: (data) => callCloudFunction('ai', {
		action: 'getHistory',
		params: data
	}),
	
	// 清空历史记录
	clearHistory: (data) => callCloudFunction('ai', {
		action: 'clearHistory',
		params: data
	})
}

// 内容相关接口
export const contentApi = {
	// 获取内容列表
	getList: (params) => callCloudFunction('content', {
		type: 'getContentList',
		...params
	}),
	// 获取内容详情
	getDetail: (id) => callCloudFunction('content', {
		type: 'getContentDetail',
		id
	}),
	// 创建内容
	create: (content) => callCloudFunction('content', {
		type: 'createContent',
		content
	}),
	// 更新内容
	update: (id, content) => callCloudFunction('content', {
		type: 'updateContent',
		id,
		content
	}),
	// 删除内容
	delete: (id) => callCloudFunction('content', {
		type: 'deleteContent',
		id
	})
}