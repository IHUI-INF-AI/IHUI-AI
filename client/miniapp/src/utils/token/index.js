import { getTokenCount } from "@/service/pay.js";
/**
 * 消耗token
 * @returns
 */
export function payToken(id, quantity) {
  return new Promise((resolve, reject) => {
    getTokenCount(id, quantity)
      .then((res) => {
        let data = uni.getStorageSync("data");
        if (data.token_quantity) {
          data.token_quantity = res.data;
          uni.setStorageSync("data", data);
        }
        resolve(res.data);
      })
      .catch((err) => {});
  });
}