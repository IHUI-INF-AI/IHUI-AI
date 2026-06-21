import { API_BASE_URLS, API_ENDPOINTS, API_WHITE_LIST, ERROR_CODES, REQUEST_TIMEOUT } from '@/config/apiConfig.js';
import {
    getAccessToken,
    getRefreshToken,
    isTokenExpiredError as isSharedTokenExpiredError,
    normalizePlatformType,
} from '@/vendor/shared-auth.bundle.js';
import { refreshAuthToken } from '@/vendor/shared-services.bundle.js';
import { clearAllAuthData } from '@/utils/auth.js';

// 获取 platform-type 的辅助函数
function getPlatformType() {
    const loginType = uni.getStorageSync('loginType') || 'android';
    console.log('loginType', loginType);
    return normalizePlatformType(loginType, 'android');
}

let isRefreshing = false;
let requestQueue = [];

function refreshTokenRequest() {
    const uniAdapter = {
        request(config) {
            return new Promise((resolve, reject) => {
                const baseUrlMap = {
                    1: API_BASE_URLS.BASE_URL_1,
                    2: API_BASE_URLS.BASE_URL_2,
                    3: API_BASE_URLS.BASE_URL_3,
                    4: API_BASE_URLS.BASE_URL_4,
                    5: API_BASE_URLS.BASE_URL_5,
                };
                const isAbsoluteUrl = /^https?:\/\//i.test(config.url);
                const requestUrl = isAbsoluteUrl ? config.url : `${baseUrlMap[config.base] || ''}${config.url}`;

                uni.request({
                    url: requestUrl,
                    method: config.method || 'GET',
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
        const refreshToken = getRefreshToken(storageData);
        const uuid = storageData?.uuid;
        
        console.log('准备刷新token，storageData:', storageData);
        console.log('refreshToken:', refreshToken);
        console.log('uuid:', uuid);
        
        if (!refreshToken) {
            console.error('refreshToken不存在，无法刷新token');
            return reject("No refresh token");
        }

        console.log('发送刷新token请求到:', API_BASE_URLS.BASE_URL_2 + API_ENDPOINTS.LOGIN.REFRESH_TOKEN);
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
                    const storage = uni.getStorageSync("data") || {};
                    let newAccessToken = null;
                    let newRefreshToken = null;
                    
                    // 处理不同的响应格式
                    // 格式1: { data: "accessToken字符串" }
                    // 格式2: { data: { accessToken: "...", refreshToken: "..." } }
                    if (typeof res.data === 'string') {
                        newAccessToken = res.data;
                    } else if (res.data && typeof res.data === 'object') {
                        newAccessToken = res.data.accessToken || res.data.token;
                        newRefreshToken = res.data.refreshToken;
                    }
                    
                    // 确保 thirdPartyAccounts 对象存在
                    if (!storage.thirdPartyAccounts) {
                        storage.thirdPartyAccounts = {};
                    }
                    
                    // 保存新的 accessToken
                    if (newAccessToken) {
                        storage.thirdPartyAccounts.accessToken = newAccessToken;
                        uni.setStorageSync('token', newAccessToken);
                        console.log('token刷新成功，新token:', newAccessToken);
                    }
                    
                    // 保存新的 refreshToken（如果存在）
                    if (newRefreshToken) {
                        storage.thirdPartyAccounts.refreshToken = newRefreshToken;
                        console.log('刷新token接口 - 新的 refreshToken 已保存');
                    }
                    
                    uni.setStorageSync("data", storage);
                    
                    resolve(newAccessToken || res.data);
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

function handleRefreshTokenError() {
    clearAllAuthData({
        showToast: true,
        redirectToLogin: true,
        message: '登录已过期，请重新登录'
    });
}

function getBaseUrl(base) {
    const baseMap = {
        1: API_BASE_URLS.BASE_URL_1,
        2: API_BASE_URLS.BASE_URL_2,
        3: API_BASE_URLS.BASE_URL_3,
        4: API_BASE_URLS.BASE_URL_4,
        5: API_BASE_URLS.BASE_URL_5
    };
    return baseMap[base] || API_BASE_URLS.BASE_URL_1;
}

function isWhitelisted(url) {
    return API_WHITE_LIST.some(whiteUrl => url.includes(whiteUrl));
}

function checkAuth() {
    const storageData = uni.getStorageSync("data");
    const zhsTokenInfo = storageData?.thirdPartyAccounts;
    
    console.log('checkAuth - 开始检查认证状态');
    console.log('checkAuth - storageData:', storageData);
    console.log('checkAuth - storageData.uuid:', storageData?.uuid);
    console.log('checkAuth - zhsTokenInfo:', zhsTokenInfo);
    
    // 检查是否有用户数据（uuid存在即可）
    // accessToken 可能在某些登录方式中不存在（如微信一键登录）
    // 但在调用需要认证的接口时，会自动处理token刷新
    if (!storageData || !storageData.uuid) {
        console.log('checkAuth - 认证失败，原因：storageData 或 uuid 不存在');
        console.log('checkAuth - storageData 是否存在:', !!storageData);
        console.log('checkAuth - storageData.uuid 是否存在:', !!storageData?.uuid);
        uni.showToast({ title: "请先登录", icon: "none", duration: 2000 });
        return false;
    }
    
    console.log('checkAuth - 认证通过，storageData:', storageData);
    return true;
}

function isTokenExpired(res) {
    return isSharedTokenExpiredError(res?.data?.code);
}

function isSuccess(res) {
    return ERROR_CODES.SUCCESS.includes(res.statusCode);
}

function makeRequest(config) {
    const { url, method = "GET", data = {}, header = {}, timeout = REQUEST_TIMEOUT, base = 1 } = config;

    if (!isWhitelisted(url) && !checkAuth()) {
        return Promise.reject({ message: "未登录" });
    }

    const realBaseUrl = getBaseUrl(base);

    return new Promise((resolve, reject) => {
        const originalRequest = () => {
            const storageData = uni.getStorageSync("data");
            const accessToken = getAccessToken(storageData);
            
            // 根据登录方式动态设置 platform-type
            const loginType = uni.getStorageSync('loginType') || 'android';
            const platformType = normalizePlatformType(loginType, 'android');
            
            console.log('request - 登录类型:', loginType, '设置的platform-type:', platformType);
            
            uni.request({
                url: realBaseUrl + url,
                method,
                timeout,
                data,
                header: {
                    "content-type": "application/x-www-form-urlencoded",
                    ...header,
                    Authorization: accessToken ? `Bearer ${accessToken}` : "",
                    "platform-type": platformType,
                },
                success: (res) => {
                    console.log('请求成功，URL:', url);
                    console.log('响应状态码:', res.statusCode);
                    console.log('响应数据:', res.data);
                    console.log('响应数据结构:', JSON.stringify(res.data, null, 2));
                    
                    if (isTokenExpired(res)) {
                        console.log('检测到token过期，错误码:', res.data.code, '请求URL:', url);
                        if (!isRefreshing) {
                            console.log('开始刷新token...');
                            isRefreshing = true;
                            refreshTokenRequest()
                                .then((newAccessToken) => {
                                    console.log('token刷新成功，准备重试队列中的请求...');
                                    processQueue(null, newAccessToken);
                                })
                                .catch((err) => {
                                    console.error('token刷新失败:', err);
                                    processQueue(err, null);
                                    handleRefreshTokenError();
                                })
                                .finally(() => {
                                    isRefreshing = false;
                                });
                        } else {
                            console.log('token正在刷新中，将请求加入队列...');
                        }
                        requestQueue.push({
                            resolve: () => {
                                console.log('重试请求:', url);
                                originalRequest().then(resolve).catch(reject);
                            },
                            reject: reject,
                        });
                    } else if (isSuccess(res)) {
                        console.log('请求成功，返回 res.data:', res.data);
                        // 检查 res.data 的结构
                        // 如果 res.data 包含 code 字段，说明是业务错误
                        if (res.data && res.data.code && res.data.code !== '0' && res.data.code !== 0) {
                            console.log('业务错误，code:', res.data.code, 'msg:', res.data.msg);
                            reject(res.data);
                        } else {
                            resolve(res.data);
                        }
                    } else {
                        console.log('请求失败，状态码:', res.statusCode, '响应数据:', res.data);
                        reject(res);
                    }
                },
                fail: (err) => {
                    uni.showToast({
                        title: "请求失败",
                        icon: "none",
                    });
                    reject(err);
                },
            });
        };

        originalRequest();
    });
}

export default makeRequest;
