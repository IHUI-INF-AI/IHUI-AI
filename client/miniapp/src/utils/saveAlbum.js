/**
 * 保存网络图片到相册
 * @param {string} imageUrl 网络图片地址
 */
export function saveAlbum(imageUrl) {
  const raw = typeof imageUrl === 'string' ? imageUrl : (imageUrl && (imageUrl.url || imageUrl.imgUrl || imageUrl.image));
  if (!raw || typeof raw !== 'string') {
    console.warn('[saveAlbum] 图片地址为空', imageUrl);
    uni.showToast({
      title: '图片地址为空',
      icon: 'none'
    });
    return Promise.reject(new Error('图片地址为空'));
  }

  // 清理和规范化URL
  const sanitizedUrl = String(raw).trim().replace(/^@/, '');
  const fullUrl = sanitizedUrl.startsWith('http') ? sanitizedUrl : `https://` + sanitizedUrl.replace(/^\/\//, '');
  console.log('[saveAlbum] 开始', { raw: raw.substring(0, 80), fullUrl: fullUrl.substring(0, 80) });

  return new Promise((resolve, reject) => {
    // 权限处理和后续操作
    handlePermissionsAndSave(fullUrl, resolve, reject);
  });
}

/**
 * 封装权限处理和保存逻辑
 * 小程序：未授权时先 authorize；已拒绝则引导去设置。
 * APP：仅当明确已拒绝时引导去设置，否则直接尝试下载保存（保存失败时再提示权限）。
 * H5 等无 getSetting 的环境：直接下载并保存（或触发浏览器下载）。
 */
function handlePermissionsAndSave(url, resolve, reject) {
  // H5 等环境可能没有 uni.getSetting，直接走下载保存
  if (typeof uni.getSetting !== 'function') {
    console.log('[saveAlbum] 当前环境无 getSetting，直接下载保存');
    _downloadAndSave(url, resolve, reject);
    return;
  }

  uni.getSetting({
    success: (res) => {
      const authState = res.authSetting['scope.writePhotosAlbum'];
      console.log('[saveAlbum] 相册权限状态', authState);

      if (authState === false) {
        uni.showModal({
          title: '授权提示',
          content: '您需要授权保存图片到相册才能使用该功能',
          confirmText: '去授权',
          success: (modalRes) => {
            if (modalRes.confirm) {
              uni.openSetting();
            }
          }
        });
        reject(new Error('用户已拒绝授权'));
        return;
      }

      // 已授权 / 未询问过（APP 上常为 undefined）：直接尝试下载并保存
      if (authState === true) {
        _downloadAndSave(url, resolve, reject);
        return;
      }

      // 未请求过：小程序先 authorize，APP 直接尝试保存（失败再提示）
      // #ifdef APP-PLUS
      _downloadAndSave(url, resolve, reject);
      // #endif
      // #ifndef APP-PLUS
      if (typeof uni.authorize !== 'function') {
        _downloadAndSave(url, resolve, reject);
        return;
      }
      uni.authorize({
        scope: 'scope.writePhotosAlbum',
        success: () => {
          _downloadAndSave(url, resolve, reject);
        },
        fail: () => {
          uni.showToast({ title: '您拒绝了授权', icon: 'none' });
          reject(new Error('用户拒绝授权'));
        }
      });
      // #endif
    },
    fail: () => {
      // 获取设置失败时仍尝试下载保存（如 APP 部分机型）
      _downloadAndSave(url, resolve, reject);
    }
  });
}

/**
 * 内部函数：uni.downloadFile 下载，APP 用 plus.gallery.save 保存，其它用 uni.saveImageToPhotosAlbum。
 */
function _downloadAndSave(url, resolve, reject) {
  const finalUrl = typeof url === 'string' ? url.trim() : String(url);
  console.log('[saveAlbum] 开始下载', finalUrl.substring(0, 100));
  uni.showLoading({ title: '正在保存...' });

  uni.downloadFile({
    url: finalUrl,
    success: (res) => {
      console.log('[saveAlbum] downloadFile 结果', { statusCode: res.statusCode, tempFilePath: res.tempFilePath ? '有' : '无' });
      if (res.statusCode !== 200 || !res.tempFilePath) {
        uni.hideLoading();
        uni.showToast({ title: `下载失败(${res.statusCode || '未知'})`, icon: 'none', duration: 3000 });
        reject(new Error('下载失败'));
        return;
      }
      const filePath = res.tempFilePath;
      // #ifdef APP-PLUS
      _saveToGalleryApp(filePath, resolve, reject);
      // #endif
      // #ifndef APP-PLUS
      _saveToGalleryMp(filePath, resolve, reject);
      // #endif
    },
    fail: (err) => {
      console.error('[saveAlbum] downloadFile 失败', err);
      uni.hideLoading();
      const errMsg = (err && err.errMsg) || '';
      let tip = '图片下载失败，请检查网络或链接是否有效';
      if (errMsg.includes('url') || errMsg.includes('domain') || errMsg.includes('合法')) {
        tip = '图片链接无法下载，请确认小程序已配置该下载域名';
      } else if (errMsg.includes('timeout') || errMsg.includes('fail')) {
        tip = '下载超时或失败，请重试';
      }
      uni.showToast({ title: tip, icon: 'none', duration: 3000 });
      reject(err || new Error(tip));
    }
  });
}

// #ifdef APP-PLUS
/** APP：使用 5+ plus.gallery.save 保存到相册，兼容性更好 */
function _saveToGalleryApp(filePath, resolve, reject) {
  const hasPlusGallery = typeof plus !== 'undefined' && plus.gallery && typeof plus.gallery.save === 'function';
  console.log('[saveAlbum] APP 保存', { filePath: filePath ? filePath.substring(0, 50) : '', usePlusGallery: hasPlusGallery });
  if (hasPlusGallery) {
    plus.gallery.save(
      filePath,
      () => {
        console.log('[saveAlbum] plus.gallery.save 成功');
        uni.hideLoading();
        uni.showToast({ title: '保存成功', icon: 'success', duration: 2000 });
        resolve('保存成功');
      },
      (err) => {
        console.error('[saveAlbum] plus.gallery.save 失败', err);
        uni.hideLoading();
        const msg = (err && err.message) ? err.message : String(err || '');
        const tip = msg.includes('deny') || msg.includes('auth') || msg.includes('permission')
          ? '需要相册权限，请在设置中开启'
          : '保存失败，请重试';
        uni.showToast({ title: tip, icon: 'none', duration: 3000 });
        reject(err);
      }
    );
  } else {
    console.log('[saveAlbum] 回退到 uni.saveImageToPhotosAlbum');
    _saveWithUniApi(filePath, resolve, reject);
  }
}
// #endif

// #ifndef APP-PLUS
/** 小程序 / H5：uni.saveImageToPhotosAlbum */
function _saveToGalleryMp(filePath, resolve, reject) {
  _saveWithUniApi(filePath, resolve, reject);
}
// #endif

/** 使用 uni.saveImageToPhotosAlbum 保存（APP 备用 / 小程序 H5 主用） */
function _saveWithUniApi(filePath, resolve, reject) {
  console.log('[saveAlbum] uni.saveImageToPhotosAlbum', filePath ? filePath.substring(0, 50) : '');
  uni.saveImageToPhotosAlbum({
    filePath: filePath,
    success: () => {
      console.log('[saveAlbum] saveImageToPhotosAlbum 成功');
      uni.hideLoading();
      uni.showToast({ title: '保存成功', icon: 'success', duration: 2000 });
      resolve('保存成功');
    },
    fail: (err) => {
      console.error('[saveAlbum] saveImageToPhotosAlbum 失败', err);
      uni.hideLoading();
      const errMsg = (err && err.errMsg) || '保存失败';
      const tip = errMsg.includes('auth') || errMsg.includes('authorize') || errMsg.includes('deny')
        ? '需要相册权限，请在设置中开启'
        : errMsg.length > 30 ? '保存失败，请重试' : `保存失败: ${errMsg}`;
      uni.showToast({ title: tip, icon: 'none', duration: 3000 });
      reject(err);
    }
  });
}