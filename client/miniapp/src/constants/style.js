// src/constants/style.js

// 判断是否在微信小程序环境
const isMpWeixin =
  typeof wx !== "undefined" && wx.getMenuButtonBoundingClientRect;

// 安全获取菜单按钮信息
const getSafeMenuButtonRect = () => {
  let menuButtonRect = { height: 0, top: 0, width: 0 };
  try {
    // #ifdef MP-WEIXIN
    menuButtonRect = wx.getMenuButtonBoundingClientRect();
    // #endif
  } catch (e) {}
  return menuButtonRect;
};

// 安全获取系统信息
const getSafeSystemInfo = () => {
  try {
    return uni.getSystemInfoSync() || {};
  } catch (e) {
    return {};
  }
};

const menuButtonBoundingClientRect = getSafeMenuButtonRect();
const systemInfo = getSafeSystemInfo();
const statusBarHeight = systemInfo.statusBarHeight || 0;

// 计算导航栏高度
const navBarHeight = isMpWeixin
  ? menuButtonBoundingClientRect.height > 0 && menuButtonBoundingClientRect.top > statusBarHeight
    ? menuButtonBoundingClientRect.height +
      (menuButtonBoundingClientRect.top - statusBarHeight) * 2
    : 44
  : 44;

// 定义样式变量
export const styleVariables = {
  "--app-status-bar-height": `${statusBarHeight}px`,
  "--app-nav-bar-height": `${navBarHeight}px`, //状态栏
  "--app-nav-bar-width": `${menuButtonBoundingClientRect.width}px`,
  "--app-top-bar-height": `${statusBarHeight + navBarHeight}px`, //整体
  "--app-brand-color-primary": "#5088fa",
  "--app-brand-color-secondary": "#d2e1fc",
  "--app-price-color-primary": "#F6260A",
  "--app-price-color-secondary": "#00000080",
};
