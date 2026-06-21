// 全局分享配置
export const shareConfig = {
  // 默认分享标题
  defaultTitle: 'AI智汇社',
  
  // 默认分享图片
  defaultImageUrl: 'https://file.aizhs.top/sys-mini/default/shar.jpg',
  
  // 默认分享路径（当无法获取当前页面路径时使用）
  fallbackPath: '/pages/table/aiIndex/ai_index',
  
  // 分享来源参数名
  sourceParam: 'source',
  
  // 分享来源值
  sourceValue: 'share',
  
  // 邀请码参数名
  inviteCodeParam: 'inviteCode',
  
  // 获取分享信息的方法
  getShareInfo(pageInstance = null) {
    const userData = uni.getStorageSync('data') || {};
    const inviteCode = userData.inviteCode || '';
    
    // 尝试获取当前页面路径
    let path = this.fallbackPath;
    if (pageInstance && pageInstance.$route && pageInstance.$route.path) {
      path = pageInstance.$route.path;
    }
    
    // 构建分享路径
    const sharePath = path.includes('?') 
      ? `${path}&${this.sourceParam}=${this.sourceValue}&${this.inviteCodeParam}=${inviteCode}` 
      : `${path}?${this.sourceParam}=${this.sourceValue}&${this.inviteCodeParam}=${inviteCode}`;
    
    return {
      title: this.defaultTitle,
      path: sharePath,
      imageUrl: this.defaultImageUrl
    };
  },
  
  // 获取分享到朋友圈的信息
  getTimelineShareInfo(pageInstance = null) {
    const userData = uni.getStorageSync('data') || {};
    const inviteCode = userData.inviteCode || '';
    
    return {
      title: this.defaultTitle,
      query: `${this.sourceParam}=${this.sourceValue}&${this.inviteCodeParam}=${inviteCode}`,
      imageUrl: this.defaultImageUrl
    };
  },
  
  // 分享成功回调
  onShareSuccess() {
    uni.showToast({
      title: '分享成功',
      icon: 'success',
      duration: 2000
    });
  },
  
  // 分享失败回调
  onShareFail(err) {
    // 分享失败处理
  }
};

export default shareConfig;