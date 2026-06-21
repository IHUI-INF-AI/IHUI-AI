/**
 * 统一的认证和登录状态管理工具
 */
import {
  AUTH_CLEAR_STORAGE_KEYS,
  FULL_LOGOUT_STORAGE_KEYS,
  getAccessToken,
  hasValidToken,
} from '@/vendor/shared-auth.bundle.js';

// 防止重复弹窗的标志
let hasShownAuthError = false;

/**
 * 清除所有登录相关的存储和状态（增强版，确保彻底清除）
 * @param {Object} options 配置选项
 * @param {boolean} options.showToast 是否显示提示，默认true
 * @param {boolean} options.redirectToLogin 是否跳转到登录页，默认true
 * @param {string} options.message 提示消息，默认'登录已过期，请重新登录'
 */
export function clearAllAuthData(options = {}) {
  // 防止重复弹窗
  if (hasShownAuthError && options.showToast !== false) {
    console.log('已经显示过登录错误提示，跳过重复弹窗');
    return true;
  }
  const {
    showToast = true,
    redirectToLogin = true,
    message = '登录已过期，请重新登录'
  } = options;

  try {
    // 使用同步方法清除所有可能的存储项，确保立即生效
    const storageKeys = AUTH_CLEAR_STORAGE_KEYS;
    
    // 逐个清除，确保每个都成功
    storageKeys.forEach(key => {
      try {
        uni.removeStorageSync(key);
      } catch (e) {
        // 忽略清除失败
      }
    });
    
    // 使用clearStorageSync清除所有存储（作为备用）
    try {
      uni.clearStorageSync();
    } catch (e) {
      // 如果同步方法失败，使用异步方法
      uni.clearStorage({
        success: () => {
          // 异步清除成功
        },
        fail: (err) => {
          // 异步清除失败
        }
      });
    }
    
    // 清除store中的登录状态（如果store可用）
    try {
      // 尝试通过Vue实例获取store
      const pages = getCurrentPages();
      if (pages && pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        if (currentPage.$vm && currentPage.$vm.$store) {
          const store = currentPage.$vm.$store;
          // 清除user模块的登录状态
          if (store.state.user) {
            // 尝试调用LOGOUT mutation
            if (store.commit) {
              try {
                store.commit('user/LOGOUT');
              } catch (e) {
                // 如果LOGOUT不存在，手动清除
                store.commit('user/SET_LOGIN_STATE', false);
                store.commit('user/SET_TOKEN', '');
                store.commit('user/SET_USER_INFO', null);
              }
            }
          }
        }
      }
    } catch (storeError) {
      // 忽略清除store状态失败
    }

    // 显示提示
    if (showToast) {
      hasShownAuthError = true;
      uni.showToast({
        title: message,
        icon: 'none',
        duration: 2000
      });
    }

    // 跳转到登录页
    if (redirectToLogin) {
      setTimeout(() => {
        // 重置标志，允许下次显示
        hasShownAuthError = false;
        // 尝试跳转到用户页面（通常登录入口在那里）
        uni.switchTab({
          url: '/pages/table/user/index',
          fail: () => {
            // 如果switchTab失败，尝试navigateTo
            uni.navigateTo({
              url: '/pages/login/index',
              fail: () => {
                // 忽略跳转失败
              }
            });
          }
        });
      }, showToast ? 2000 : 0);
    }

    // 通知所有页面更新登录状态
    try {
      uni.$emit('userLogout');
      uni.$emit('loginStateChanged', false);
    } catch (e) {
      // 忽略发送登出事件失败
    }
    
    // 强制刷新当前页面（在某些手机上可能需要）
    try {
      const pages = getCurrentPages();
      if (pages && pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        if (currentPage.$vm && currentPage.$vm.$forceUpdate) {
          currentPage.$vm.$forceUpdate();
        }
      }
    } catch (e) {
      // 忽略强制刷新页面失败
    }

    return true;
  } catch (error) {
    // 即使出错也尝试清除
    try {
      uni.clearStorageSync();
    } catch (e) {
      // 忽略备用清除方法失败
    }
    return false;
  }
}

/**
 * 彻底清除登录信息（用于登出功能）
 * 确保在所有手机上都能及时清除
 */
export function clearLoginDataCompletely() {
  try {
    // 保存隐私政策缓存状态
    let privacyPolicyShown = false;
    try {
      privacyPolicyShown = uni.getStorageSync('privacyPolicyShown');
    } catch (e) {
      // 忽略读取失败
    }
    
    // 第一步：使用同步方法清除所有可能的存储项
    const storageKeys = FULL_LOGOUT_STORAGE_KEYS;
    
    storageKeys.forEach(key => {
      try {
        uni.removeStorageSync(key);
      } catch (e) {
        // 忽略单个清除失败
      }
    });
    
    // 第二步：清除所有存储
    try {
      uni.clearStorageSync();
    } catch (e) {
      // 如果同步失败，使用异步
      uni.clearStorage();
    }
    
    // 恢复隐私政策缓存状态
    if (privacyPolicyShown) {
      try {
        uni.setStorageSync('privacyPolicyShown', true);
      } catch (e) {
        // 忽略恢复失败
      }
    }
    
    // 第三步：清除store中的状态
    try {
      const pages = getCurrentPages();
      if (pages && pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        if (currentPage.$vm && currentPage.$vm.$store) {
          const store = currentPage.$vm.$store;
          if (store.state && store.state.user) {
            try {
              store.commit('user/LOGOUT');
            } catch (e) {
              try {
                store.commit('user/SET_LOGIN_STATE', false);
                store.commit('user/SET_TOKEN', null);
                store.commit('user/SET_USER_INFO', null);
              } catch (e2) {
                // 忽略清除store状态失败
              }
            }
          }
        }
      }
    } catch (storeError) {
      // 忽略清除store状态失败
    }
    
    // 第四步：通知所有页面
    uni.$emit('userLogout');
    uni.$emit('loginStateChanged', false);
    
    // 第五步：延迟验证清除是否成功
    setTimeout(() => {
      const remainingData = uni.getStorageSync('data');
      const remainingToken = uni.getStorageSync('token');
      const remainingUserInfo = uni.getStorageSync('userInfo');
      
      if (remainingData || remainingToken || remainingUserInfo) {
        // 再次清除
        try {
          uni.removeStorageSync('data');
          uni.removeStorageSync('token');
          uni.removeStorageSync('userInfo');
          uni.clearStorageSync();
        } catch (e) {
          // 忽略二次清除失败
        }
      }
    }, 100);
    
    return true;
  } catch (error) {
    // 最后的备用方案
    try {
      uni.clearStorageSync();
    } catch (e) {
      uni.clearStorage();
    }
    return false;
  }
}

/**
 * 检查token是否有效
 * @returns {boolean} token是否存在且有效
 */
export function isTokenValid() {
  try {
    const data = uni.getStorageSync('data');
    const token = uni.getStorageSync('token');

    return hasValidToken(data) || hasValidToken({ token });
  } catch (error) {
    return false;
  }
}

/**
 * 获取当前有效的token
 * @returns {string|null} token字符串或null
 */
export function getCurrentToken() {
  try {
    const data = uni.getStorageSync('data');
    return getAccessToken(data) || getAccessToken({ token: uni.getStorageSync('token') });
  } catch (error) {
    return null;
  }
}
