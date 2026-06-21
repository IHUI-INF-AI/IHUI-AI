/**
 * 手机键盘高度数据库
 * 根据设备型号和屏幕尺寸提供精确的键盘高度
 * 单位：px
 */

// iPhone 系列键盘高度
const iPhoneKeyboardHeights = {
  // iPhone SE 系列（小屏幕）
  'iPhone SE': 253,
  'iPhone SE2': 253,
  'iPhone SE3': 253,
  
  // iPhone 12/13/14/15 系列（标准版）
  'iPhone 12': 291,
  'iPhone 12 mini': 268,
  'iPhone 12 Pro': 291,
  'iPhone 12 Pro Max': 303,
  'iPhone 13': 291,
  'iPhone 13 mini': 268,
  'iPhone 13 Pro': 291,
  'iPhone 13 Pro Max': 303,
  'iPhone 14': 291,
  'iPhone 14 Plus': 303,
  'iPhone 14 Pro': 291,
  'iPhone 14 Pro Max': 303,
  'iPhone 15': 291,
  'iPhone 15 Plus': 303,
  'iPhone 15 Pro': 291,
  'iPhone 15 Pro Max': 303,
  
  // iPhone 11/X/XS/XR 系列
  'iPhone 11': 291,
  'iPhone 11 Pro': 291,
  'iPhone 11 Pro Max': 303,
  'iPhone X': 291,
  'iPhone XS': 291,
  'iPhone XS Max': 303,
  'iPhone XR': 291,
  
  // iPhone 8/7/6s/6 系列
  'iPhone 8': 253,
  'iPhone 8 Plus': 271,
  'iPhone 7': 253,
  'iPhone 7 Plus': 271,
  'iPhone 6s': 253,
  'iPhone 6s Plus': 271,
  'iPhone 6': 253,
  'iPhone 6 Plus': 271,
};

// Android 系列键盘高度（按品牌分类）
const AndroidKeyboardHeights = {
  // 华为
  'HUAWEI': {
    'Mate 60 Pro': 336,
    'Mate 60': 336,
    'Mate 50 Pro': 336,
    'Mate 50': 336,
    'P60 Pro': 336,
    'P60': 336,
    'P50 Pro': 336,
    'P50': 336,
    'Nova 11 Pro': 336,
    'Nova 11': 336,
  },
  
  // 小米
  'Xiaomi': {
    '14 Pro': 336,
    '14': 336,
    '13 Pro': 336,
    '13': 336,
    '12 Pro': 336,
    '12': 336,
    '11 Pro': 336,
    '11': 336,
  },
  'Redmi': {
    'K70 Pro': 336,
    'K70': 336,
    'K60 Pro': 336,
    'K60': 336,
    'Note 13 Pro': 336,
    'Note 13': 336,
  },
  
  // OPPO
  'OPPO': {
    'Find X7 Pro': 336,
    'Find X7': 336,
    'Find X6 Pro': 336,
    'Find X6': 336,
    'Reno 11 Pro': 336,
    'Reno 11': 336,
    'Reno 10 Pro': 336,
    'Reno 10': 336,
  },
  'OnePlus': {
    '12': 336,
    '11': 336,
    '10 Pro': 336,
    '10': 336,
    '9 Pro': 336,
    '9': 336,
  },
  
  // vivo
  'vivo': {
    'X100 Pro': 336,
    'X100': 336,
    'X90 Pro': 336,
    'X90': 336,
    'S18 Pro': 336,
    'S18': 336,
    'S17 Pro': 336,
    'S17': 336,
    'Y37': 336,
    'V2357A': 336,
  },
  'iQOO': {
    '12': 336,
    '11': 336,
    '10': 336,
    '9': 336,
  },
  
  // 三星
  'Samsung': {
    'Galaxy S24 Ultra': 336,
    'Galaxy S24+': 336,
    'Galaxy S24': 336,
    'Galaxy S23 Ultra': 336,
    'Galaxy S23+': 336,
    'Galaxy S23': 336,
    'Galaxy S22 Ultra': 336,
    'Galaxy S22+': 336,
    'Galaxy S22': 336,
  },
  
  // 荣耀
  'HONOR': {
    'Magic6 Pro': 336,
    'Magic6': 336,
    'Magic5 Pro': 336,
    'Magic5': 336,
    '90 GT': 336,
    '90': 336,
    '80 GT': 336,
    '80': 336,
  },
};

/**
 * 根据设备型号获取键盘高度
 * @param {string} model - 设备型号（如 'iPhone 14 Pro'）
 * @param {string} brand - 设备品牌（如 'Apple', 'Xiaomi'）
 * @param {number} screenHeight - 屏幕高度（px）
 * @returns {number} 键盘高度（px）
 */
function getKeyboardHeightByModel(model, brand, screenHeight) {
  console.log('📱 查询键盘高度 - 型号:', model, '品牌:', brand, '屏幕高度:', screenHeight);
  
  // 1. 优先查询 iPhone 系列
  if (brand === 'Apple' || model.includes('iPhone')) {
    for (const [key, height] of Object.entries(iPhoneKeyboardHeights)) {
      if (model.includes(key)) {
        console.log('✅ 找到 iPhone 键盘高度:', height, 'px (型号:', key, ')');
        return height;
      }
    }
  }
  
  // 2. 查询 Android 系列
  for (const [brandKey, models] of Object.entries(AndroidKeyboardHeights)) {
    // 检查品牌是否匹配
    if (brand && brand.includes(brandKey)) {
      for (const [modelKey, height] of Object.entries(models)) {
        if (model.includes(modelKey)) {
          console.log('✅ 找到 Android 键盘高度:', height, 'px (品牌:', brandKey, ', 型号:', modelKey, ')');
          return height;
        }
      }
    }
    
    // 如果品牌不匹配，尝试直接匹配型号
    for (const [modelKey, height] of Object.entries(models)) {
      if (model.includes(modelKey)) {
        console.log('✅ 找到 Android 键盘高度:', height, 'px (品牌:', brandKey, ', 型号:', modelKey, ')');
        return height;
      }
    }
  }
  
  // 3. 如果没有找到精确匹配，根据屏幕高度估算
  console.log('⚠️ 未找到精确匹配，根据屏幕高度估算键盘高度');
  return estimateKeyboardHeightByScreen(screenHeight);
}

/**
 * 根据屏幕高度估算键盘高度
 * @param {number} screenHeight - 屏幕高度（px）
 * @returns {number} 键盘高度（px）
 */
function estimateKeyboardHeightByScreen(screenHeight) {
  if (!screenHeight) {
    console.log('⚠️ 无法获取屏幕高度，使用默认键盘高度: 300px');
    return 300;
  }
  
  let estimatedHeight;
  
  // 根据屏幕高度估算
  if (screenHeight < 700) {
    // 小屏幕（如 iPhone SE）
    estimatedHeight = 253;
  } else if (screenHeight < 800) {
    // 中等屏幕（如 iPhone 12/13/14）
    estimatedHeight = 291;
  } else if (screenHeight < 900) {
    // 大屏幕（如 iPhone 12/13/14 Pro Max）
    estimatedHeight = 303;
  } else {
    // 超大屏幕（如 Android 大屏手机）
    estimatedHeight = 336;
  }
  
  console.log('✅ 估算键盘高度:', estimatedHeight, 'px (屏幕高度:', screenHeight, 'px)');
  return estimatedHeight;
}

/**
 * 获取设备信息
 * @returns {Object} 设备信息 { model, brand, screenHeight, screenWidth }
 */
function getDeviceInfo() {
  try {
    const systemInfo = uni.getSystemInfoSync();
    return {
      model: systemInfo.model || '',
      brand: systemInfo.brand || '',
      screenHeight: systemInfo.screenHeight || 0,
      screenWidth: systemInfo.screenWidth || 0,
      platform: systemInfo.platform || '',
    };
  } catch (e) {
    console.error('❌ 获取设备信息失败:', e);
    return {
      model: '',
      brand: '',
      screenHeight: 0,
      screenWidth: 0,
      platform: '',
    };
  }
}

/**
 * 获取当前设备的键盘高度
 * @returns {number} 键盘高度（px）
 */
function getCurrentDeviceKeyboardHeight() {
  const deviceInfo = getDeviceInfo();
  return getKeyboardHeightByModel(
    deviceInfo.model,
    deviceInfo.brand,
    deviceInfo.screenHeight
  );
}

export {
  iPhoneKeyboardHeights,
  AndroidKeyboardHeights,
  getKeyboardHeightByModel,
  estimateKeyboardHeightByScreen,
  getDeviceInfo,
  getCurrentDeviceKeyboardHeight,
};
