export function share(type, title, summary, imageUrl) {
  uni.share({
    provider: "weixin",
    type: type,
    title: title,
    summary: summary,
    imageUrl: imageUrl,
    success() {
      // 分享成功
    },
    fail(err) {
      // 分享失败
    },
  });
}