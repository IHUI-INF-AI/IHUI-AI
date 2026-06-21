import { request } from "@/service/shared-request.ts";
import { getVipPrice as getSharedVipPrice } from "@/vendor/shared-services.bundle.js";

const sharedRequestAdapter = {
  request(config) {
    return request({
      url: config.url,
      method: config.method || "GET",
      data: config.params || config.data || {},
      header: config.headers || {},
      timeout: config.timeout,
      base: config.base,
    });
  },
};

//获取开通vip价格
export function getvipPrice(token) {
  return getSharedVipPrice(sharedRequestAdapter, token);
}
