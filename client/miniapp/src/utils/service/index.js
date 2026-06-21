import { API_BASE_URLS } from "@/config/apiConfig.js";
import {
  getRefreshToken,
  normalizePlatformType,
} from "@/vendor/shared-auth.bundle.js";
import { refreshAuthToken } from "@/vendor/shared-services.bundle.js";

let baseUrl = API_BASE_URLS.BASE_URL_1;
let baseUrl2 = API_BASE_URLS.BASE_URL_2;
let baseUrl3 = API_BASE_URLS.BASE_URL_3;
let baseUrl4 = API_BASE_URLS.BASE_URL_4;
let baseUrl5 = API_BASE_URLS.BASE_URL_5;


// 获取 platform-type 的辅助函数
function getPlatformType() {
  const loginType = uni.getStorageSync('loginType') || 'android';
  console.log('loginType', loginType);
  return normalizePlatformType(loginType, 'android');
}

let isRefreshing = false; // 是否正在刷新token的标志
let requestQueue = []; // 因为token过期而失败的请求队列
let hasShownLoginError = false; // 是否已经显示过登录错误提示，防止重复弹窗
let refreshTokenRetryCount = 0; // token刷新重试次数
const MAX_REFRESH_RETRY = 1; // 最大刷新重试次数

// 刷新token的请求
function refreshTokenRequest() {
  const uniAdapter = {
    request(config) {
      return new Promise((resolve, reject) => {
        const baseUrlMap = {
          1: baseUrl,
          2: baseUrl2,
          3: baseUrl3,
          4: baseUrl4,
          5: baseUrl5,
        };
        const isAbsoluteUrl = /^https?:\/\//i.test(config.url);
        const requestUrl = isAbsoluteUrl ? config.url : `${baseUrlMap[config.base] || ''}${config.url}`;

        uni.request({
          url: requestUrl,
          method: config.method || "GET",
          timeout: config.timeout,
          data: config.data,
          header: config.headers || {},
          success: resolve,
          fail: reject,
        });
      });
    },
  };

  return new Promise((resolve, reject) => {
    const storageData = uni.getStorageSync("data");
    const uuid = storageData?.uuid;
    const refreshToken = getRefreshToken(storageData);
    
    console.log('准备刷新token');
    console.log('storageData:', storageData);
    console.log('refreshToken (从单独缓存):', uni.getStorageSync('refreshToken'));
    console.log('refreshToken (从thirdPartyAccounts):', storageData?.thirdPartyAccounts?.refreshToken);
    console.log('最终使用的refreshToken:', refreshToken);
    console.log('uuid:', uuid);
    console.log('thirdPartyAccounts:', storageData?.thirdPartyAccounts);
    
    if (!refreshToken) {
      console.error('refreshToken不存在，无法刷新token');
      console.error('storageData结构:', storageData);
      console.error('thirdPartyAccounts结构:', storageData?.thirdPartyAccounts);
      return reject("No refresh token");
    }

    console.log('发送共享刷新token请求');
    console.log('请求数据:', { refreshToken, uuid });
    refreshAuthToken(uniAdapter, {
      storageData,
      refreshToken,
      uuid,
      platformType: getPlatformType(),
    })
      .then((res) => {
        console.log('刷新token响应:', res);
        if ((res.code === 200 || res.code === '200') && res.data) {
          // 获取现有的用户数据，保留所有原有信息
          const storage = uni.getStorageSync("data") || {};
          let newAccessToken = null;
          let newRefreshToken = null;
          
          // 处理不同的响应格式
          // 格式1: { data: "accessToken字符串" }
          // 格式2: { data: { accessToken: "...", refreshToken: "..." } }
          if (typeof res.data === 'string') {
            newAccessToken = res.data;
          } else if (res.data && typeof res.data === 'object') {
            // 只提取 token 相关字段，忽略其他可能的用户信息字段
            newAccessToken = res.data.accessToken || res.data.token;
            newRefreshToken = res.data.refreshToken;
          }
          
          // 确保 thirdPartyAccounts 对象存在，但保留原有的其他字段
          if (!storage.thirdPartyAccounts) {
            storage.thirdPartyAccounts = {};
          }
          
          // 只更新 token 相关字段，不覆盖其他用户信息
          if (newAccessToken) {
            storage.thirdPartyAccounts.accessToken = newAccessToken;
            uni.setStorageSync('token', newAccessToken);
            console.log('token刷新成功，新token:', newAccessToken);
          }
          
          // 保存新的 refreshToken（如果存在）
          if (newRefreshToken) {
            // 同时保存到单独缓存和 thirdPartyAccounts（兼容性）
            uni.setStorageSync('refreshToken', newRefreshToken);
            storage.thirdPartyAccounts.refreshToken = newRefreshToken;
            console.log('刷新token接口 - 新的 refreshToken 已保存到单独缓存和 thirdPartyAccounts');
          }
          
          // 只保存更新后的 storage，保留所有原有的用户信息
          uni.setStorageSync("data", storage);
          
          resolve(newAccessToken);
        } else {
          console.error('刷新token失败，响应状态:', res.code, '响应数据:', res.data);
          reject(res);
        }
      })
      .catch((err) => {
        console.error('刷新token请求失败:', err);
        reject(err);
      });
  });
}

// 重新执行队列中的所有请求
function processQueue(error, token = null) {
  requestQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      // 不传递token参数，直接调用resolve函数来重新发送请求
      promise.resolve();
    }
  });
  requestQueue = [];
}

// 处理token刷新失败的情况
function handleRefreshTokenError() {
  // 防止重复弹窗
  if (hasShownLoginError) {
    console.log('已经显示过登录错误提示，跳过重复弹窗');
    return;
  }
  
  hasShownLoginError = true;
  // 重置刷新相关状态
  isRefreshing = false;
  refreshTokenRetryCount = 0;
  requestQueue = [];
  
  uni.removeStorageSync("data");
  uni.removeStorageSync("token");
  uni.showToast({ title: "登录已过期，请重新登录", icon: "none", duration: 2000 });
  setTimeout(() => {
    hasShownLoginError = false; // 重置标志，允许下次显示
    uni.reLaunch({ url: "/pages/login-app/login" });
  }, 2000);
}

function request({
  url,
  method = "GET",
  data = {},
  header = {},
  timeout = 500000,
  base = 1, // 新增参数，1=baseUrl，2=baseUrl2
}) {
  return new Promise((resolve, reject) => {
    // 检查用户是否已同意隐私政策（网络请求会收集IP地址）
    const privacyPolicyShown = uni.getStorageSync('privacyPolicyShown');
    
    // 白名单接口列表（这些接口可以在用户同意隐私政策前调用，但不会收集敏感信息）
    const whiteList = [
      '/login/wechat/getOpenId',
      '/login/wechat/getPhoneNumber',
      '/login/pwd/refreshToken' // 刷新token接口本身不应该触发token刷新
    ];
    
    // 检查当前请求是否在白名单中
    const isWhitelisted = whiteList.some(whiteUrl => url.includes(whiteUrl));
    
    // 如果不在白名单中，且用户未同意隐私政策，则拒绝请求（避免收集IP地址）
    if (!isWhitelisted && !privacyPolicyShown) {
      console.warn('⚠️ 用户未同意隐私政策，拒绝网络请求（避免收集IP地址）:', url);
      return reject({
        message: '请先同意隐私政策',
        code: 'PRIVACY_POLICY_NOT_ACCEPTED'
      });
    }
    
    // 白名单接口列表（用于token验证等）
    const whiteListForAuth = [
      '/resource/getHomePageResources',
      '/general/remote/third/group/list',
      '/information/list',
      '/coze/agents',
      '/remote/get/true',
      '/cozeZhsApi/agents/list',
      '/agent/rule/search/bylink',
      '/ali/audio/sys',
      '/cozeZhsApi/ai-model-info/list',
      '/resource/first/share/show',
      '/remote/agent/task/need/task',
      '/agent/use/history',
      '/cozeZhsApi/cache/agent-category-dict/categories',
      '/remote/agent/category',
      '/information/dictionary',
      '/resource/getUserContext',
      '/cozeZhsApi/file/upload/base64'
    ];
    
    // 不触发token刷新的接口列表（这些接口在token过期时直接失败，不触发刷新）
    // 分享接口 /agent/creation/share/code 已移除：40101 时需要刷新 token 并重试分享
    const noRefreshTokenList = [
      '/agent/creation/share/detail'
    ];
    
    // 检查当前请求是否在白名单中（用于认证检查）
    const isWhitelistedForAuth = whiteListForAuth.some(whiteUrl => url.includes(whiteUrl)) || isWhitelisted;
    
    // 如果不在白名单中，才检查用户是否已登录
    const storageData = uni.getStorageSync("data");
    const zhsTokenInfo = storageData?.thirdPartyAccounts;
    
    console.log('request - 检查认证状态');
    console.log('request - storageData:', storageData);
    console.log('request - storageData.uuid:', storageData?.uuid);
    console.log('request - zhsTokenInfo:', zhsTokenInfo);
    console.log('request - isWhitelistedForAuth:', isWhitelistedForAuth);
    
    // 检查是否有用户数据（uuid存在即可）
    // accessToken 可能在某些登录方式中不存在（如微信一键登录）
    // 但在调用需要认证的接口时，会自动处理token刷新
    if (!isWhitelistedForAuth && (!storageData || !storageData.uuid)) {
      console.log('request - 认证失败，原因：storageData 或 uuid 不存在');
      uni.showToast({ title: "请先登录", icon: "none", duration: 2000 });
      return reject({ message: "未登录" });
    }
    
    const originalRequest = () => {
      return new Promise((innerResolve, innerReject) => {
        const realBaseUrl = base === 2 ? baseUrl2 : base === 3 ? baseUrl3 : base === 4 ? baseUrl4 : base === 5 ? baseUrl5 : baseUrl;
        
        const platformType = getPlatformType();
        
        // 重新获取最新的 token（可能在刷新后已更新）
        const currentStorageData = uni.getStorageSync("data");
        const currentZhsTokenInfo = currentStorageData?.thirdPartyAccounts;
        
        console.log('request - 登录类型:', uni.getStorageSync('loginType') || 'android', '设置的platform-type:', platformType);
        
        uni.request({
          url: realBaseUrl + url,
          method,
          timeout,
          data,
          header: {
            "content-type": "application/x-www-form-urlencoded", // 默认格式
            ...header,
            Authorization: currentZhsTokenInfo
              ? `Bearer ${currentZhsTokenInfo.accessToken}`
              : "",
            "platform-type": platformType,
          },
          success: (res) => {
            // 根据您的要求，token过期的业务码是 40101 或 statusCode 为 499 或 401
            // 支持字符串和数字两种格式的 code
            const code = res.data?.code;
            const codeStr = String(code);
            const isTokenExpired = codeStr === '40101' || codeStr === '499' || codeStr === '401' || 
                                   code === 40101 || code === 499 || code === 401;
            
            if (isTokenExpired) {
              console.log('检测到token过期，错误码:', code, '请求URL:', realBaseUrl + url);
              
              // 检查当前请求是否在不触发刷新的列表中
              const shouldNotRefresh = noRefreshTokenList.some(noRefreshUrl => url.includes(noRefreshUrl));
              
              if (shouldNotRefresh) {
                // 对于不触发刷新的接口，直接失败，不触发token刷新
                console.log('该接口不触发token刷新，直接返回错误');
                innerReject(res);
                return;
              }
              
              // 如果用户未同意隐私政策，不进行token刷新（避免网络请求收集IP）
              const currentPrivacyPolicyShown = uni.getStorageSync('privacyPolicyShown');
              if (!currentPrivacyPolicyShown) {
                console.warn('⚠️ 用户未同意隐私政策，跳过token刷新（避免收集IP地址）');
                innerReject(res);
                return;
              }
              
              // 检查是否超过最大重试次数
              if (refreshTokenRetryCount >= MAX_REFRESH_RETRY) {
                console.error('token刷新重试次数已达上限，停止刷新');
                refreshTokenRetryCount = 0; // 重置计数器
                handleRefreshTokenError();
                innerReject(res);
                return;
              }
              
              if (!isRefreshing) {
                console.log('开始刷新token...');
                isRefreshing = true;
                refreshTokenRetryCount++; // 增加重试次数
                refreshTokenRequest()
                  .then((newAccessToken) => {
                    console.log('token刷新成功，准备重试队列中的请求...');
                    refreshTokenRetryCount = 0; // 刷新成功，重置计数器
                    processQueue(null, newAccessToken);
                  })
                  .catch((err) => {
                    console.error('token刷新失败:', err);
                    // 如果刷新失败，检查是否达到最大重试次数
                    if (refreshTokenRetryCount >= MAX_REFRESH_RETRY) {
                      refreshTokenRetryCount = 0; // 重置计数器
                      handleRefreshTokenError();
                    }
                    processQueue(err, null);
                  })
                  .finally(() => {
                    isRefreshing = false;
                  });
              } else {
                console.log('token正在刷新中，将请求加入队列...');
              }
              // 将请求的 resolve 和 reject 方法存入队列，等待刷新成功后执行
              requestQueue.push({
                resolve: () => {
                  // 用新的token重新请求，如果再次返回401，会再次触发刷新（但有限制）
                  originalRequest().then(innerResolve).catch(innerReject);
                },
                reject: innerReject,
              });
            } else if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 0) {
              // 即使 statusCode 是 200，也要检查业务码
              // 如果业务码是 200、0 或成功，才 resolve
              const businessCode = res.data?.code;
              const businessCodeStr = String(businessCode);
              // code 为 200 或 0 都视为成功，undefined 也视为成功（某些接口可能没有 code 字段）
              if (businessCodeStr === '200' || businessCode === 200 || 
                  businessCodeStr === '0' || businessCode === 0 || 
                  businessCode === undefined) {
                innerResolve(res.data);
              } else {
                // 业务码不是 200 或 0，可能是其他错误
                console.warn('请求返回非成功业务码:', businessCode, '响应数据:', res.data);
                innerReject(res);
              }
            } else {
              // uni.showToast({
              //   title: "服务器错误",
              //   icon: "none",
              // });
              innerReject(res);
            }
          },
          fail: (err) => {
            console.error('请求失败，URL：', realBaseUrl + url);
            console.error('请求失败，错误详情：', err);
            console.error('请求失败，错误码：', err.errMsg);
            
            uni.showToast({
              title: "请求失败",
              icon: "none",
            });
            innerReject(err);
          },
        });
      });
    };
    originalRequest().then(resolve).catch(reject);
  });
}

export { baseUrl, baseUrl2, baseUrl3 };
export default request;
