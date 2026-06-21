import request from "@/utils/service/index.js";
// /index.php/api/Resource/selectsGoods

export function selectsGoods(type) {
  return request({
    url: `/resource/selectsGoods?type=${type}`,
    method: "GET",
    // params: { id },
  });
}
//获取充值活动   /zhs_activity/get
export function getactivity() {
  return request({
    url: `/zhs_activity/get`,
    method: "GET",
  });
}