// 登录

import request, { baseUrl,baseUrl2 } from "@/utils/service/index.js";

// 获取 platform-type 的辅助函数
function getPlatformType() {
  const loginType = uni.getStorageSync('loginType') || 'android';
  if (loginType === 'android') {
    return 'android';
  } else if (loginType === 'third_wechat') {
    return 'third_wechat';
  } else if (loginType === 'third_google') {
    return 'third_google';
  }
  return 'android';
}

/**预注册登录 */
export function login(open_id, parentId) {
  return request({
    url: "/login/login",
    method: "POST",
    data: { open_id, parentId },
  });
}

export function openId(code) {
  return request({
    url: "/login/wechat/getOpenId",
    method: "POST",
    header: {
      "content-type": "application/json",
    },
    data: { code },
    base: 2,
  });
}

/**
 *用户绑定接口
 * @param {*} open_id
 * @param {*} nickname 昵称
 * @param {*} phone 手机号码
 * @param {*} avatar 头像
 * @param {*} fileName
 * @returns
 */
export function bindUser(open_id, nickname, phone, avatar, fileName) {
  return request({
    url: "/auth_accounts/bind",
    method: "POST",
    header: {
      "Content-Type": "application/json",
    },
    data: { open_id, nickname, phone, avatar, fileName },
    base: 2
  });
}

/**
 *用户绑定接口
 * @param {*} nickname 昵称
 * @param {*} phone 手机号码
 * @param {*} avatar 头像
 * @param {*} fileName
 * @returns
 */
export function bindUserNew( nickname, phone, avatar, fileName) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts
    }
    uni.request({
      url: baseUrl2 + "/auth_accounts/bind",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { nickname, phone, avatar, fileName },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        if (res.statusCode === 401 || res.statusCode === 40101 || res.data?.code === 401 || res.data?.code === 40101) {
          const refreshToken = uni.getStorageSync('data')?.thirdPartyAccounts?.refreshToken;
          const uuidStorage = uni.getStorageSync('data')?.uuid;
          
          if (refreshToken) {
            uni.request({
              url: baseUrl2 + "/login/pwd/refreshToken",
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
                  const storage = uni.getStorageSync("data") || {};
                  let newAccessToken = null;
                  let newRefreshToken = null;
                  
                  // 处理不同的响应格式
                  if (typeof refreshRes.data.data === 'string') {
                    newAccessToken = refreshRes.data.data;
                  } else if (refreshRes.data.data && typeof refreshRes.data.data === 'object') {
                    newAccessToken = refreshRes.data.data.accessToken || refreshRes.data.data.token;
                    newRefreshToken = refreshRes.data.data.refreshToken;
                  }
                  
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
                  }
                  
                  uni.setStorageSync("data", storage);
                  
                  bindUserNew(nickname, phone, avatar, fileName).then(resolve).catch(reject);
                } else {
                  reject(refreshRes);
                }
              },
              fail: (err) => {
                reject(err);
              },
            });
          } else {
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

/**
 * 判断是否是会员
 * @param {*} id
 * @returns
 */
export function recharge(id) {
  return request({
    url: "/resource/recharge",
    method: "GET",
    data: { id },
  });
}

/**
 * 登录手机号解析
 * @param {*} code
 * @param {*} openId
 * @param {*} parentId
 * @returns
 */
export function getPhoneNumberApi(unionId, code, openId, parentId) {
  return request({
    url: "/login/wechat/getPhoneNumber",
    method: "POST",
    header: {
    	'content-type': 'application/json',
    },
    data: { unionId, code, openId, parentId },
    base: 2,
  });
}
/**
 * 发送手机号验证码
 * @param {*} phone
 * @param {*} tempId
 * @param {*} tempCode
 * @returns
 */
export function sendTextMsg(phone, tempId, tempCode) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts
    }
    uni.request({
      url: baseUrl2 + "/login/pwd/smsVerify",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { phone, tempId, tempCode },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        if (res.statusCode === 401 || res.statusCode === 40101 || res.data?.code === 401 || res.data?.code === 40101) {
          const refreshToken = uni.getStorageSync('data')?.thirdPartyAccounts?.refreshToken;
          const uuidStorage = uni.getStorageSync('data')?.uuid;
          
          if (refreshToken) {
            uni.request({
              url: baseUrl2 + "/login/pwd/refreshToken",
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
                  const storage = uni.getStorageSync("data") || {};
                  let newAccessToken = null;
                  let newRefreshToken = null;
                  
                  // 处理不同的响应格式
                  if (typeof refreshRes.data.data === 'string') {
                    newAccessToken = refreshRes.data.data;
                  } else if (refreshRes.data.data && typeof refreshRes.data.data === 'object') {
                    newAccessToken = refreshRes.data.data.accessToken || refreshRes.data.data.token;
                    newRefreshToken = refreshRes.data.data.refreshToken;
                  }
                  
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
                  }
                  
                  uni.setStorageSync("data", storage);
                  
                  sendTextMsg(phone, tempId, tempCode).then(resolve).catch(reject);
                } else {
                  reject(refreshRes);
                }
              },
              fail: (err) => {
                reject(err);
              },
            });
          } else {
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

/*{
  "bot_id": "7524935428056252456",
    "user_id": "123456789",
    "conversation_id": "7528602329541656615",
    "stream": true,
    "auto_save_history":true,
    "additional_messages":[
  {
    "role":"user",
    "content":"返回今日主要资讯10条",
    "content_type":"text"
  }
]
}*/

//校验验证码后端返回一个临时密钥
//  /login/pwd/verify
/**
 * 发送手机号验证码
 * @param {*} phone
 * @param {*} code
 * @returns
 */
export function sendTextMsg_new(phone, code) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts
    }
    uni.request({
      url: baseUrl2 + "/login/pwd/verify",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { phone, code },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        if (res.statusCode === 401 || res.statusCode === 40101 || res.data?.code === 401 || res.data?.code === 40101) {
          const refreshToken = uni.getStorageSync('data')?.thirdPartyAccounts?.refreshToken;
          const uuidStorage = uni.getStorageSync('data')?.uuid;
          
          if (refreshToken) {
            uni.request({
              url: baseUrl2 + "/login/pwd/refreshToken",
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
                  const storage = uni.getStorageSync("data") || {};
                  let newAccessToken = null;
                  let newRefreshToken = null;
                  
                  // 处理不同的响应格式
                  if (typeof refreshRes.data.data === 'string') {
                    newAccessToken = refreshRes.data.data;
                  } else if (refreshRes.data.data && typeof refreshRes.data.data === 'object') {
                    newAccessToken = refreshRes.data.data.accessToken || refreshRes.data.data.token;
                    newRefreshToken = refreshRes.data.data.refreshToken;
                  }
                  
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
                  }
                  
                  uni.setStorageSync("data", storage);
                  
                  sendTextMsg_new(phone, code).then(resolve).catch(reject);
                } else {
                  reject(refreshRes);
                }
              },
              fail: (err) => {
                reject(err);
              },
            });
          } else {
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

/**
 * 发送手机号验证码
 * @param {*} phone
 * @param {*} code
 * @returns
 */
export function sendTextMsg_edit(phone, code) {
  return new Promise((resolve, reject) => {
    let zhsToken = uni.getStorageSync('regCode_new')

    uni.request({
      url: baseUrl2 + "/login/pwd/verify",
      // url: 'http://192.168.1.72:8080/ai' + "/login/pwd/verify",
      header: {
        'EditAuth': zhsToken ? `Bearer ${zhsToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { phone, code },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        // 检查并保存 refreshToken
        if (res.statusCode === 200 && res.data && res.data.data) {
          const loginData = res.data.data;
          if (loginData.thirdPartyAccounts && loginData.thirdPartyAccounts.refreshToken) {
            // 保存 refreshToken 作为独立缓存项
            const storage = uni.getStorageSync("data") || {};
            if (!storage.thirdPartyAccounts) {
              storage.thirdPartyAccounts = {};
            }
            storage.thirdPartyAccounts.refreshToken = loginData.thirdPartyAccounts.refreshToken;
            uni.setStorageSync("data", storage);
          }
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

/**
 * 注册使用这个临时密钥进行注册
 * @param {*} phone
 * @param {*} password
 * @param {*} parentId
 * @returns
 */
export function registerLogin(phone, password, parentId,editAuth) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    zhsToken = uni.getStorageSync('regCode')
    uni.request({
      url: baseUrl2 + "/login/pwd/registerLogin",
      header: {
        'Authorization': zhsToken ? zhsToken : '',
        'platform-type': getPlatformType(),
        'EditAuth': editAuth ? `${editAuth}` : ''
      },
      method: "POST",
      data: { phone, password,parentId },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        // 检查并保存 refreshToken
        if (res.statusCode === 200 && res.data && res.data.data) {
          const loginData = res.data.data;
          if (loginData.thirdPartyAccounts && loginData.thirdPartyAccounts.refreshToken) {
            // 保存 refreshToken 作为独立缓存项
            const storage = uni.getStorageSync("data") || {};
            if (!storage.thirdPartyAccounts) {
              storage.thirdPartyAccounts = {};
            }
            storage.thirdPartyAccounts.refreshToken = loginData.thirdPartyAccounts.refreshToken;
            uni.setStorageSync("data", storage);
          }
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
/**
 * 注册使用这个临时密钥进行注册
 * @param {*} phone
 * @param {*} password
 * @param {*} code
 * @returns
 */
export function userLogin(phone, password, code) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts
    }
    uni.request({
      url: baseUrl2 + "/login/pwd/login",
      // url: 'http://192.168.1.72:8080/ai' + "/login/pwd/login",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { phone,password, code },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        // 检查并保存 refreshToken
        if (res.statusCode === 200 && res.data && res.data.data) {
          const loginData = res.data.data;
          if (loginData.thirdPartyAccounts && loginData.thirdPartyAccounts.refreshToken) {
            // 保存 refreshToken 作为独立缓存项
            const storage = uni.getStorageSync("data") || {};
            if (!storage.thirdPartyAccounts) {
              storage.thirdPartyAccounts = {};
            }
            storage.thirdPartyAccounts.refreshToken = loginData.thirdPartyAccounts.refreshToken;
            uni.setStorageSync("data", storage);
          }
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

/**
 * 账号密码登录
 * @param {string} account 账号（手机号/用户名等）
 * @param {string} password 密码
 * @returns {Promise}
 */
export function pwdLogin(account, password) {
  return new Promise((resolve, reject) => {
    let zhsToken = '';
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts;
    }
    uni.request({
      url: baseUrl2 + "/login/pwd/login",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { phone: account, password, code: '' },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.data) {
          const loginData = res.data.data;
          if (loginData.thirdPartyAccounts && loginData.thirdPartyAccounts.refreshToken) {
            const storage = uni.getStorageSync("data") || {};
            if (!storage.thirdPartyAccounts) {
              storage.thirdPartyAccounts = {};
            }
            storage.thirdPartyAccounts.refreshToken = loginData.thirdPartyAccounts.refreshToken;
            uni.setStorageSync("data", storage);
          }
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

/**
 * 注册使用这个临时密钥进行注册
 * @param {*} openid
 * @param {*} unionid
 * @param {*} access_token
 * @param {*} parentId
 * @returns
 */
export function userLogin_wx(openid, unionid, access_token,parentId) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts
    }
    uni.request({
      url: baseUrl2 + "/login/pwd/third/wx/login",
      // url: 'http://192.168.1.72:8080/ai' + "/login/pwd/third/wx/login",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { openid, unionid, access_token,parentId },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        // 检查并保存 refreshToken
        if (res.statusCode === 200 && res.data && res.data.data) {
          const loginData = res.data.data;
          if (loginData.thirdPartyAccounts && loginData.thirdPartyAccounts.refreshToken) {
            // 保存 refreshToken 作为独立缓存项
            const storage = uni.getStorageSync("data") || {};
            if (!storage.thirdPartyAccounts) {
              storage.thirdPartyAccounts = {};
            }
            storage.thirdPartyAccounts.refreshToken = loginData.thirdPartyAccounts.refreshToken;
            uni.setStorageSync("data", storage);

          }
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

/**
 * Google登录
 * 参考：https://codelabs.developers.google.com/sign-in-with-google-android?hl=zh-cn
 * 
 * @param {String} idToken Google登录返回的ID Token（JWT格式）
 * @param {String} accessToken Google访问令牌（可选）
 * @param {String} parentId 父级ID（邀请人ID，可选）
 * @returns {Promise}
 */
export function userLogin_google(idToken, accessToken, parentId) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts
    }

    uni.request({
      url: baseUrl2 + "/login/google",
      method: "POST",
      header: {
        "Content-Type": "application/json",
        "platform-type": getPlatformType()
      },
      data: { 
        idToken: idToken,
        accessToken: accessToken || null,
        parentId: parentId || null
      },
      success: (res) => {
        // 检查并保存 refreshToken
        if (res.statusCode === 200 && res.data && res.data.data) {
          const loginData = res.data.data;
          if (loginData.thirdPartyAccounts && loginData.thirdPartyAccounts.refreshToken) {
            // 保存 refreshToken 作为独立缓存项
            const storage = uni.getStorageSync("data") || {};
            if (!storage.thirdPartyAccounts) {
              storage.thirdPartyAccounts = {};
            }
            storage.thirdPartyAccounts.refreshToken = loginData.thirdPartyAccounts.refreshToken;
            uni.setStorageSync("data", storage);
          }
        }
        resolve(res);
      },
      fail: (err) => {
        console.error('Google登录接口请求失败:', err);
        uni.showToast({
          title: "请求失败",
          icon: "none",
        });
        reject(err);
      },
    });
  });
}

/**
 * 修改密码
 * @param {*} phone
 * @param {*} password
 * @returns
 */
export function editPwd(phone, password) {
  return new Promise((resolve, reject) => {
    let zhsToken = uni.getStorageSync('regCode_new')

    uni.request({
      url: baseUrl2 + "/login/pwd/editPasswd",
      // url: 'http://192.168.1.72:8080/ai' + "/login/pwd/editPasswd",
      header: {
        'EditAuth': zhsToken ? `Bearer ${zhsToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { phone,password },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        // 检查并保存 refreshToken
        if (res.statusCode === 200 && res.data && res.data.data) {
          const loginData = res.data.data;
          if (loginData.thirdPartyAccounts && loginData.thirdPartyAccounts.refreshToken) {
            // 保存 refreshToken 作为独立缓存项
            const storage = uni.getStorageSync("data") || {};
            if (!storage.thirdPartyAccounts) {
              storage.thirdPartyAccounts = {};
            }
            storage.thirdPartyAccounts.refreshToken = loginData.thirdPartyAccounts.refreshToken;
            uni.setStorageSync("data", storage);

          }
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
/**
 * 修改密码
 * @param {*} file
 * @returns
 */
export function fetchAudioText(file) {
  return new Promise((resolve, reject) => {
    let zhsToken = uni.getStorageSync('data').thirdPartyAccounts
    uni.request({
      url: baseUrl2 + "/remote/get/tencent/sentence",
      // url: 'http://192.168.1.72:8080/ai' + "/remote/get/tencent/sentence",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { file },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        // 检查并保存 refreshToken
        if (res.statusCode === 200 && res.data && res.data.data) {
          const loginData = res.data.data;
          if (loginData.thirdPartyAccounts && loginData.thirdPartyAccounts.refreshToken) {
            // 保存 refreshToken 作为独立缓存项
            const storage = uni.getStorageSync("data") || {};
            if (!storage.thirdPartyAccounts) {
              storage.thirdPartyAccounts = {};
            }
            storage.thirdPartyAccounts.refreshToken = loginData.thirdPartyAccounts.refreshToken;
            uni.setStorageSync("data", storage);

          }
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
/**
 * 更换手机号：新手机号验证码校验通过后调用
 * @param {string} phone 新手机号
 * @param {string} uuid 当前用户 uuid
 * @param {string|object} data 新手机号验证码校验通过后接口返回的 data（用作 EditAuth 或请求体）
 * @returns
 */
export function editPhone(phone, uuid, data) {
  const editAuth = typeof data === 'string' ? data : (data && (data.token || data.accessToken || data.editAuth || data))
  const authValue = typeof editAuth === 'string' ? editAuth : ''
  return new Promise((resolve, reject) => {
    uni.request({
      url: baseUrl2 + "/login/pwd/replace/phone",
      header: {
        'EditAuth': authValue ? `Bearer ${authValue}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { phone, uuid, data },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => resolve(res),
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

/**
 *绑定手机号
 */
export function bindPhone(openId,unionId,phone,editAuth,platform) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    zhsToken = uni.getStorageSync('regCode')
    uni.request({
      url: baseUrl2 + "/login/pwd/registerLogin",
      header: {
        'Authorization': zhsToken ? zhsToken : '',
        'platform-type': platform,
        'EditAuth': editAuth ? `${editAuth}` : ''
      },
      method: "POST",
      data: { phone, openId, unionId },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        // 检查并保存 refreshToken
        if (res.statusCode === 200 && res.data && res.data.data) {
          const loginData = res.data.data;
          if (loginData.thirdPartyAccounts && loginData.thirdPartyAccounts.refreshToken) {
            // 保存 refreshToken 作为独立缓存项
            const storage = uni.getStorageSync("data") || {};
            if (!storage.thirdPartyAccounts) {
              storage.thirdPartyAccounts = {};
            }
            storage.thirdPartyAccounts.refreshToken = loginData.thirdPartyAccounts.refreshToken;
            uni.setStorageSync("data", storage);

          }
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

/**
 * 查询账号是否已经注册
 * @param {string} phone 手机号
 * @returns {Promise<boolean>} 是否已存在密码
 */
export function pwdExist(phone) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: baseUrl2 + `/login/pwd/exist/${encodeURIComponent(phone)}`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200) {
          const data = res.data;
          const value = typeof data === 'boolean' ? data : (data?.data ?? data);
          resolve(Boolean(value));
        } else {
          resolve(false);
        }
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

/**
 * 账号注销
 * DELETE /login/cancel
 * @returns {Promise}
 */
export function accountCancel() {
  return new Promise((resolve, reject) => {
    let zhsToken = '';
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts;
    }
    uni.request({
      url: baseUrl + '/login/cancel',
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType()
      },
      method: 'DELETE',
      success: (res) => resolve(res),
      fail: (err) => {
        uni.showToast({ title: '请求失败', icon: 'none' });
        reject(err);
      }
    });
  });
}

