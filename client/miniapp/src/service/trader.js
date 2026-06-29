import request, { baseUrl,baseUrl2 } from "@/utils/service/index.js";

// 获取 platform-type 的辅助函数
function getPlatformType() {
  const loginType = uni.getStorageSync('loginType') || 'android';
  console.log('loginType', loginType);
  if (loginType === 'android') {
    return 'android';
  } else if (loginType === 'third_wechat') {
    return 'third_wechat';
  }
  return 'android';
}

/**
 *获取操盘手个人信息卡接口
 * @param {*} user_id
 * @returns
 */
export function getOperatorDataCardData(token) {
  return request({
    url: "/flow/getStatistics",
    method: "GET",
    data: { token },
  });
}

/**
 * 获取操盘手的团队数据
 * @param {*} user_id
 * @returns
 */
export function getUserInviteeOrderStats(params) {
  return request({
    url: "/flow/getTraderTeamByCenter",
    method: "GET",
    data: {
      token: params.token,
      begin: params.begin,
      end: params.end,
      pageNum: params.pageNum,
      pageSize: params.pageSize
    },
  });
}

/**
 * 超盘手获取自己以及下家订单
 * @param {*} id
 * @param {*} page
 * @param {*} quantity
 * @returns
 */
export function getUserAndChildrenOrders(id, page, quantity) {
  return request({
    url: "/distribution/getUserAndChildrenOrders",
    method: "POST",
    data: { id, page, quantity },
  });
}

/**
 * 操盘手获取个人的推广小程序码
 * @param {*} invite_code
 * @returns
 */
export function getWxCode(invite_code, back) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts
    }
    uni.request({
      url: baseUrl + "/login/getWxCode",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : ''
      },
      method: "GET",
      data: {
        invite_code,
        back: back ? back : ''
      },
      responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        if (res.statusCode === 200) {
          // 将arraybuffer转换为base64格式的图片URL
          const base64 = uni.arrayBufferToBase64(res.data);
          const imageUrl = "data:image/png;base64," + base64;
          resolve(imageUrl);
        } else {
          uni.showToast({
            title: "获取二维码失败",
            icon: "none",
          });
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

  });
}

/**
 * 操盘手获取佣金页面信息
 * @returns
 */
export function getUserCommissionDetail(user_id) {
  return request({
    url: "/distribution/getUserCommissionDetail",
    method: "GET",
    data: { user_id },
  });
}
/**
 * 获取分销流水列表
 * @returns
 */
export function getflowList(tokenUuid) {
  return request({
    url: "/flow/list",
    method: "GET",
    data: { tokenUuid },
  });
}
//获取我的订单接口
export function getFlowOrderList(pageNum, pageSize, openId) {
  return request({
    url: "/flow/orderList",
    method: "GET",
    data: { pageNum, pageSize, openId },
  });
}
/**
 * 实名认证
 * @returns
 */
export function realAuth(username, idCard, uuid) {
  return new Promise((resolve, reject) => {
    let zhsToken = ''
    if (uni.getStorageSync('data')) {
      zhsToken = uni.getStorageSync('data').thirdPartyAccounts
    }
    uni.request({
      url: baseUrl2 + "/auth/user",
      header: {
        'Authorization': zhsToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': getPlatformType()
      },
      method: "POST",
      data: { username, idCard, uuid },
      // responseType: "arraybuffer", // 指定响应的数据类型为arraybuffer
      success: (res) => {
        if (res['data'].code === 200) {
          resolve(res);
        } else {
          uni.showToast({
            title: "实名认证失败",
            icon: "none",
          });
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
  });

  return request({
    url: baseUrl2 + "/auth/user",
    method: "POST",
    data: { username, idCard, uuid },
  });
}