// 个人名片
import request, { baseUrl2 } from "@/utils/service/index.js";
import { clearAllAuthData } from "@/utils/auth.js";

// 获取 platform-type 的辅助函数
function getPlatformType() {
  const loginType = uni.getStorageSync('loginType');
  console.log('loginType', loginType);
  if (loginType === 'android') {
    return 'android';
  } else if (loginType === 'third_wechat') {
    return 'third_wechat';
  }
}

// 上传名片
// /index.php/uploadBusinessCard
export function uploadBusinessCard_bak(id, card, fileName) {
  return request({
    url: "/remote/uploadBusinessCard",
    header: {
      "content-type": "application/json",
    },
    method: "POST",
    data: {
      id,
      card,
      fileName,
    },
  });
}
export function uploadBusinessCard(id, card, fileName) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts
    }
    uni.request({
      url: baseUrl2 + "/remote/uploadBusinessCard",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType(),
        "content-type": "application/json",
      },
      method: "POST",
      data: {
        id,
        card,
        fileName,
      },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        
        // 处理token失效的情况
        if (res.statusCode === 401 || res.statusCode === 40101 || (res.data && (res.data.code === 401 || res.data.code === 40101))) {
          clearAllAuthData({
            showToast: true,
            redirectToLogin: true,
            message: "登录已过期，请重新登录"
          });
          return reject(new Error('登录已过期'));
        }
        
        // 处理其他错误状态码
        if (res.statusCode !== 200 && res.statusCode !== 201) {
          const errorMsg = res.data?.msg || res.data?.message || `请求失败(${res.statusCode})`;
          uni.showToast({
            title: errorMsg,
            icon: "none",
          });
          return reject(new Error(errorMsg));
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

  return request({
    url: baseUrl2 + "/auth/user",
    method: "POST",
    data: { username, idCard, uuid },
  });
}

export function payceshi(data) {
  return request({
    url: "/pay/initiate_pay",
    header: {
      "content-type": "application/json",
    },
    method: "POST",
    data,
  });
}
export function uploadBusinessCarda(card, fileName) {
  return request({
    url: "/resource/fileUpload",
    header: {
      "content-type": "application/json",
    },
    method: "POST",
    data: {
      file: 'base64,' + card,
      fileName,
    },
    base: 1,
  });
}

/** 从上传接口多种返回格式中解析出 URL */
function parseUploadUrl(res) {
  if (!res) return '';
  if (typeof res === 'string') return res;
  if (res.url) return res.url;
  if (res.data !== undefined && res.data !== null) {
    if (typeof res.data === 'string') return res.data;
    const d = res.data;
    if (d.url) return d.url;
    if (d.fileUrl) return d.fileUrl;
    if (d.path) return d.path;
    if (d.imageUrl) return d.imageUrl;
  }
  if (res.result && res.result.url) return res.result.url;
  return '';
}

export function uploadBybase64(card, fileName) {
  return request({
    url: "/file/uploadByBase64",
    header: {
      "content-type": "application/json",
    },
    method: "POST",
    data: {
      base64ImageContent: 'base64,' + card,
      fileName,
    },
    base: 4,
  }).then((res) => {
    const url = parseUploadUrl(res);
    if (!url) {
      console.warn('uploadBybase64 返回结构异常，未解析到 url，原始响应：', res);
    }
    return { url };
  });
}
export function uploadBybase64a(card, fileName) {
  console.log('uploadBybase64 调用，base64长度：', card.length, '文件名：', fileName);
  
  return request({
    url: "/file/uploadByBase64",
    header: {
      "content-type": "application/json",
    },
    method: "POST",
    data: {
      base64ImageContent: 'data:audio/mp3;base64,' + card,
      fileName: fileName,
    },
    base: 4,
  }).then(res => {
    console.log('uploadBybase64 原始响应：', res);
    console.log('响应类型：', typeof res);
    console.log('响应键：', res ? Object.keys(res) : 'res is null/undefined');
    
    // 如果响应是字符串（直接返回URL），则包装成标准格式
    if (typeof res === 'string') {
      console.log('响应是字符串URL：', res);
      return {
        code: 200,
        data: res
      };
    }
    
    // 如果响应已经是标准格式，直接返回
    return res;
  }).catch(err => {
    console.error('uploadBybase64 失败：', err);
    throw err;
  });
}

export function watermark(card, id) {
  let zhsToken = ''
  if (uni.getStorageSync('data')) {
    zhsToken = uni.getStorageSync('data').thirdPartyAccounts
  }
  
  return request({
    url: "/resource/download/watermark",
    header: {
      'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
      'platform-type': getPlatformType(),
      "content-type": "application/json",
    },
    method: "GET",
    data: {
      netUrl: card,
      user_uuid: id,
    },
    base: 1,
  });
}