import { miniPay, closeorder, closeorders } from "@/service/pay.js";
import { openId, login, recharge } from "@/service/login.js";
var outTradeNo = "";
var isshows = 0;

// 获取当前运行平台
function getPlatform() {
  const systemInfo = uni.getSystemInfoSync();
  console.log('系统信息:', systemInfo);
  console.log('uniPlatform:', systemInfo.uniPlatform);
  console.log('platform:', systemInfo.platform);
  console.log('app:', systemInfo.app);
  
  // UniApp 平台检测
  // #ifdef APP-PLUS
  console.log('检测到APP环境');
  return 'app';
  // #endif
  
  // #ifdef MP-WEIXIN
  console.log('检测到微信小程序环境');
  return 'mp-weixin';
  // #endif
  
  // #ifdef MP-ALIPAY
  console.log('检测到支付宝小程序环境');
  return 'mp-alipay';
  // #endif
  
  // 默认返回小程序环境
  return systemInfo.uniPlatform || 'mp-weixin';
}

export function pay(center, price, id, isshow, type, payType = 1) {
  isshows = isshow;
  const platform = getPlatform();
  const openId = uni.getStorageSync("data").thirdPartyAccounts?.openId || '';
  const uuid = uni.getStorageSync("data").uuid;
  
  console.log('支付参数:', { center, price, id, isshow, type, payType, platform });
  
  // 参数验证
  if (!uuid) {
    console.error('用户uuid为空，无法进行支付');
    uni.hideLoading();
    uni.showToast({
      title: '用户信息异常，请重新登录',
      icon: 'none'
    });
    return Promise.reject(new Error('用户uuid为空'));
  }
  
  if (!id) {
    console.error('商品ID为空，无法进行支付');
    uni.hideLoading();
    uni.showToast({
      title: '请选择充值商品',
      icon: 'none'
    });
    return Promise.reject(new Error('商品ID为空'));
  }
  
  if (!price || price <= 0) {
    console.error('充值金额无效:', price);
    uni.hideLoading();
    uni.showToast({
      title: '充值金额无效',
      icon: 'none'
    });
    return Promise.reject(new Error('充值金额无效'));
  }
  
  // 显示loading
  uni.showLoading({
    title: '正在获取支付信息...',
    mask: true
  });
  
  // 准备传递给API的参数
  const apiParams = {
    uuid: uuid,
    openId: openId,
    desc: center,
    amount: price,
    id: id,
    productType: type,
    payType: payType
  };
  
  console.log('准备调用miniPay API，参数详情:');
  console.log('- uuid:', uuid, '(类型:', typeof uuid, ')');
  console.log('- openId:', openId, '(类型:', typeof openId, ')');
  console.log('- desc:', center, '(类型:', typeof center, ')');
  console.log('- amount:', price, '(类型:', typeof price, ')');
  console.log('- id:', id, '(类型:', typeof id, ')');
  console.log('- productType:', type, '(类型:', typeof type, ')');
  console.log('- payType:', payType, '(类型:', typeof payType, ')');
  console.log('- 完整参数对象:', JSON.stringify(apiParams));
  
  return miniPay(uuid, openId, center, price, id, type, payType).then((data) => {
    console.log('miniPay API响应:', data);
    console.log('支付数据包含的字段:', Object.keys(data || {}));
    
    // miniPay 函数已经返回了处理后的数据（res.data 或 data.data），所以这里直接使用
    // 不需要再访问 data.data
    outTradeNo = data.outTradeNo;
    console.log('订单号:', outTradeNo);
    
    if (data) {
      show();
    }
    
    return new Promise((resolve, reject) => {
      // 根据平台和支付类型调用不同的支付接口
      if (payType === 2) {
        // 支付宝支付
        console.log('准备调用支付宝支付');
        handleAlipayPayment(data, resolve, reject);
      } else {
        // 微信支付
        console.log('准备调用微信支付');
        handleWechatPayment(data, platform, resolve, reject);
      }
    });
  }).catch(err => {
    console.error('miniPay API调用失败:', err);
    console.error('错误详情:', JSON.stringify(err));
    uni.hideLoading();
    uni.showToast({
      title: '获取支付信息失败',
      icon: 'none'
    });
    return Promise.reject(err);
  });
}

// 处理微信支付
function handleWechatPayment(data, platform, resolve, reject) {
  console.log('handleWechatPayment - 平台:', platform);
  console.log('handleWechatPayment - 支付数据:', JSON.stringify(data));
  
  // 参数验证
  if (platform === 'mp-weixin') {
    // 微信小程序参数验证
    const requiredFields = ['timeStamp', 'nonceStr', 'package', 'paySign'];
    const missingFields = requiredFields.filter(field => !data[field] && data[field] !== 0);
    
    if (missingFields.length > 0) {
      console.error('微信小程序支付参数缺失:', missingFields);
      uni.hideLoading();
      uni.showToast({
        title: '支付参数不完整，请重试',
        icon: 'none'
      });
      reject(new Error('支付参数不完整: ' + missingFields.join(', ')));
      return;
    }
  } else {
    // APP环境参数验证和处理
    console.log('APP支付 - 接收到的数据字段:', Object.keys(data || {}));
    console.log('APP支付 - 数据详情:', data);
    
    // APP环境：优先使用 orderInfo（如果后端直接返回了完整的orderInfo字符串）
    if (data.orderInfo) {
      console.log('APP支付 - 检测到orderInfo字段，将直接使用');
      // orderInfo 验证将在后续处理
    } else {
      // 如果没有orderInfo，需要从其他字段构造
      // 统一获取字段值（支持驼峰和小写两种格式）
      const appid = data.appid || data.appId || data.app_id;
      const partnerid = data.partnerid || data.partnerId || data.partner_id;
      const prepayid = data.prepayid || data.prepayId || data.prepay_id;
      const noncestr = data.noncestr || data.nonceStr || data.nonce_str;
      const timestamp = data.timestamp || data.timeStamp || data.timestamp;
      const sign = data.sign;
      const packageValue = data.package || data.packageValue || "Sign=WXPay";
      
      console.log('APP支付 - 字段映射结果:', {
        appid: appid ? '已获取' : '缺失',
        partnerid: partnerid ? '已获取' : '缺失',
        prepayid: prepayid ? '已获取' : '缺失',
        noncestr: noncestr ? '已获取' : '缺失',
        timestamp: timestamp ? '已获取' : '缺失',
        sign: sign ? '已获取' : '缺失',
        package: packageValue
      });
      
      // 验证必需字段（APP支付必需的字段）
      const missingFields = [];
      if (!appid) missingFields.push('appid/appId');
      if (!partnerid) missingFields.push('partnerid/partnerId');
      if (!prepayid) missingFields.push('prepayid/prepayId');
      if (!sign) missingFields.push('sign');
      
      if (missingFields.length > 0) {
        console.error('APP支付参数缺失 - 缺失字段:', missingFields);
        console.error('APP支付参数缺失 - 完整数据:', data);
        uni.hideLoading();
        uni.showToast({
          title: '支付参数不完整，请重试',
          icon: 'none'
        });
        reject(new Error('APP支付参数不完整，缺失字段: ' + missingFields.join(', ')));
        return;
      }
      
      // 将字段信息存储到data对象中，供后续构造orderInfo使用
      data._appid = appid;
      data._partnerid = partnerid;
      data._prepayid = prepayid;
      data._noncestr = noncestr;
      data._timestamp = timestamp;
      data._sign = sign;
      data._package = packageValue;
    }
  }
  
  const paymentParams = {
    success: (result) => {
      console.log('微信支付成功:', result);
      closeorder(uni.getStorageSync("data").thirdPartyAccounts?.openId, outTradeNo).then((res) => {
        setTimeout(() => {
          logins()
            .then(() => {
              const pages = getCurrentPages();
              const currentPage = pages[pages.length - 1];
              
              if (currentPage && typeof currentPage.$vm.refreshData === 'function') {
                currentPage.$vm.refreshData();
              } else {
                const route = currentPage.route;
                if (route) {
                  uni.redirectTo({
                    url: '/' + route
                  });
                }
              }
              
              uni.$emit('user-info-updated');
              resolve(result);
            })
            .catch((err) => {
              resolve(result);
            });
        }, 500);
      });
      uni.hideLoading();
    },
    fail: (err) => {
      console.error('微信支付失败:', err);
      console.error('微信支付失败详情:', JSON.stringify(err));
      console.error('错误代码:', err.code);
      console.error('错误消息:', err.errMsg);
      
      // 关闭订单
      if (data.outTradeNo) {
        closeorders(uni.getStorageSync("data").thirdPartyAccounts?.openId, data.outTradeNo).then(
          (res) => {}
        );
      }
      
      // 检查是否是用户取消支付
      if (err.errMsg && (err.errMsg.includes("cancel") || err.errMsg === "requestPayment:fail cancel")) {
        uni.hideLoading();
        uni.showToast({
          title: "您已取消支付",
          icon: "none",
        });
        reject(err);
        return;
      }
      
      // 检查是否是未安装微信（APP环境）
      if (err.code === -100 || (err.errMsg && err.errMsg.includes('62000'))) {
        uni.hideLoading();
        uni.showModal({
          title: '提示',
          content: '未检测到微信应用，请先安装微信后再进行支付',
          showCancel: false,
          confirmText: '我知道了'
        });
        reject(err);
        return;
      }
      
      // 参数错误提示
      if (err.errMsg && (err.errMsg.includes('parameter') || err.errMsg.includes('参数'))) {
        uni.hideLoading();
        uni.showToast({
          title: "支付参数错误，请重试",
          icon: "none",
          duration: 2000
        });
        reject(err);
        return;
      }
      
      // 其他支付错误
      let errorMessage = "支付失败";
      if (err.errMsg) {
        // 提取错误信息，去掉技术细节
        const errMsg = err.errMsg;
        if (errMsg.includes('fail')) {
          errorMessage = "支付失败，请重试";
        } else {
          errorMessage = errMsg.length > 20 ? "支付失败，请重试" : errMsg;
        }
      } else if (err.message) {
        errorMessage = err.message.length > 20 ? "支付失败，请重试" : err.message;
      }
      
      uni.hideLoading();
      uni.showToast({
        title: errorMessage,
        icon: "none",
        duration: 2000
      });
      reject(err);
    },
  };

  // 根据平台设置不同的支付参数
  if (platform === 'mp-weixin') {
    // 微信小程序 - 注意：小程序环境不需要 provider 参数
    console.log('设置微信小程序支付参数');
    console.log('- timeStamp:', data.timeStamp);
    console.log('- nonceStr:', data.nonceStr);
    console.log('- package:', data.package);
    console.log('- paySign:', data.paySign ? '已提供' : '缺失');
    
    // timeStamp 需要是字符串格式
    paymentParams.timeStamp = String(data.timeStamp !== undefined && data.timeStamp !== null ? data.timeStamp : '');
    paymentParams.nonceStr = String(data.nonceStr !== undefined && data.nonceStr !== null ? data.nonceStr : '');
    paymentParams.package = String(data.package !== undefined && data.package !== null ? data.package : '');
    paymentParams.signType = data.signType || "RSA"; // 使用服务端返回的 signType，如果没有则默认 RSA
    paymentParams.paySign = String(data.paySign !== undefined && data.paySign !== null ? data.paySign : '');
  } else {
    // APP环境 - 设置 orderInfo
    console.log('设置APP微信支付参数');
    paymentParams.provider = "wxpay";
    
    // APP环境 orderInfo 必须是JSON字符串格式
    if (data.orderInfo) {
      // 如果服务端已经提供了 orderInfo 字符串，直接使用
      if (typeof data.orderInfo === 'string') {
        paymentParams.orderInfo = data.orderInfo;
        console.log('使用服务端返回的 orderInfo 字符串:', data.orderInfo);
      } else if (typeof data.orderInfo === 'object') {
        // 如果是对象，转换为JSON字符串
        paymentParams.orderInfo = JSON.stringify(data.orderInfo);
        console.log('将 orderInfo 对象转换为字符串:', paymentParams.orderInfo);
      } else {
        console.error('orderInfo 格式不正确:', typeof data.orderInfo, data.orderInfo);
        uni.hideLoading();
        uni.showToast({
          title: '支付参数格式错误',
          icon: 'none'
        });
        reject(new Error('orderInfo 格式不正确'));
        return;
      }
    } else {
      // 如果没有 orderInfo，根据其他字段构造
      console.log('服务端未提供 orderInfo，根据字段构造 orderInfo');
      
      // 使用之前验证和映射的字段（存储在 _ 前缀的字段中）
      const appid = data._appid || data.appid || data.appId || data.app_id;
      const partnerid = data._partnerid || data.partnerid || data.partnerId || data.partner_id;
      const prepayid = data._prepayid || data.prepayid || data.prepayId || data.prepay_id;
      const noncestr = data._noncestr || data.noncestr || data.nonceStr || data.nonce_str || '';
      const timestamp = data._timestamp || data.timestamp || data.timeStamp || Math.floor(Date.now() / 1000).toString();
      const sign = data._sign || data.sign;
      const packageValue = data._package || data.package || "Sign=WXPay";
      
      // 构造 orderInfo 对象（注意字段名都是小写）
      const orderInfoObj = {
        appid: appid,
        partnerid: partnerid,
        prepayid: prepayid,
        package: packageValue,
        noncestr: noncestr,
        timestamp: String(timestamp), // 确保是字符串
        sign: sign
      };
      
      paymentParams.orderInfo = JSON.stringify(orderInfoObj);
      console.log('构造的 orderInfo 对象:', orderInfoObj);
      console.log('构造的 orderInfo 字符串:', paymentParams.orderInfo);
    }
  }

  console.log('最终支付参数:', JSON.stringify(paymentParams, null, 2));
  console.log('准备调用 uni.requestPayment');
  
  try {
    uni.requestPayment(paymentParams);
  } catch (error) {
    console.error('调用 uni.requestPayment 异常:', error);
    uni.hideLoading();
    uni.showToast({
      title: "支付调用失败，请重试",
      icon: "none",
    });
    reject(error);
  }
}

// 处理支付宝支付
function handleAlipayPayment(data, resolve, reject) {
  const platform = getPlatform();
  console.log('支付宝支付 - 当前平台:', platform);
  console.log('支付宝支付 - 原始数据:', JSON.stringify(data));
  
  if (platform === 'mp-weixin') {
    // 微信小程序环境不支持支付宝支付
    console.log('检测到微信小程序环境，不支持支付宝支付');
    uni.hideLoading();
    uni.showToast({
      title: "微信小程序暂不支持支付宝支付",
      icon: "none",
    });
    reject(new Error("微信小程序不支持支付宝支付"));
    return;
  }

  console.log('支付宝支付 - 准备调起支付');
  console.log('支付宝支付 - orderInfo:', data.orderInfo || data.orderStr);

  // APP环境使用支付宝支付
  uni.requestPayment({
    provider: "alipay",
    orderInfo: data.orderInfo || data.orderStr,
    success: (result) => {
      console.log('支付宝支付成功:', result);
      closeorder(uni.getStorageSync("data").thirdPartyAccounts?.openId, outTradeNo).then((res) => {
        setTimeout(() => {
          logins()
            .then(() => {
              const pages = getCurrentPages();
              const currentPage = pages[pages.length - 1];
              
              if (currentPage && typeof currentPage.$vm.refreshData === 'function') {
                currentPage.$vm.refreshData();
              } else {
                const route = currentPage.route;
                if (route) {
                  uni.redirectTo({
                    url: '/' + route
                  });
                }
              }
              
              uni.$emit('user-info-updated');
              resolve(result);
            })
            .catch((err) => {
              resolve(result);
            });
        }, 500);
      });
      uni.hideLoading();
    },
    fail: (err) => {
      console.error('支付宝支付失败:', err);
      console.error('支付宝支付失败详情:', JSON.stringify(err));
      closeorders(uni.getStorageSync("data").thirdPartyAccounts?.openId, data.outTradeNo).then(
        (res) => {}
      );
      
      // 检查是否是用户取消支付
      if (err.errMsg === "requestPayment:fail cancel") {
        uni.showToast({
          title: "您已取消支付",
          icon: "none",
        });
      } 
      // 检查是否是未安装支付宝
      else if (err.code === -100 && err.errMsg && err.errMsg.includes('62009')) {
        uni.showModal({
          title: '提示',
          content: '未检测到支付宝应用，请先安装支付宝后再进行支付',
          showCancel: false,
          confirmText: '我知道了'
        });
      }
      // 其他支付错误
      else {
        let errorMessage = "支付失败";
        if (err.errMsg) {
          errorMessage = "支付失败: " + err.errMsg;
        } else if (err.message) {
          errorMessage = "支付失败: " + err.message;
        }
        uni.showToast({
          title: errorMessage,
          icon: "none",
        });
      }
      uni.hideLoading();
      reject(err);
    },
  });
}

function show() {
  uni.showLoading({
    title: "支付中...",
    mask: true,
  });
}

export function logins() {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: "weixin", // 微信小程序登录
      success: function (res) {
        if (res.code) {
          // 拿到登录凭证 code
          openId(res.code).then((res) => {
            const data = res.data;
            
            // 保存原始用户信息，以便比较更新
            const oldData = uni.getStorageSync("data");
            
            // 更新新的用户信息
            uni.setStorageSync("data", data);
            
            // 检查会员状态是否更新
            const memberStatusChanged = 
              !oldData || 
              oldData.isVIP !== data.isVIP || 
              oldData.identityTypy !== data.identityTypy;
              
            if (isshows == 0) {
              uni.navigateTo({
                url: "/pagesA/topup-success/index",
              });
            }
            if (isshows == 1) {
              uni.showToast({
                title: "支付成功",
                icon: "success",
              });
              
              if (memberStatusChanged) {
                // 如果会员状态变化，重新加载用户页面
                uni.switchTab({
                  url: "/pages/table/aiIndex/ai_index",
                });
              } else {
                // 刷新当前页面
                const pages = getCurrentPages();
                const currentPage = pages[pages.length - 1];
                if (currentPage && currentPage.$vm && typeof currentPage.$vm.onShow === 'function') {
                  currentPage.$vm.onShow();
                }
              }
            }
            
            // 触发全局事件通知页面更新
            uni.$emit('user-info-updated', data);
            
            resolve(data);
          }).catch(err => {
            reject(err);
          });
        } else {
          reject(new Error("登录失败：没有code"));
        }
      },
      fail: function (err) {
        reject(err);
      },
    });
  });
}