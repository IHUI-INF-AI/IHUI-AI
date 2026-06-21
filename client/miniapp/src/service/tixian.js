import request from "@/utils/service/index.js";
import {
    submitWithdrawal as sharedSubmitWithdrawal,
    getWithdrawalStatus as sharedGetWithdrawalStatus,
} from "@/vendor/shared-services.bundle.js";

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

//提现审批
export function zhsWithdrawal(token, amount, nickname, openId) {
    return sharedSubmitWithdrawal(sharedRequestAdapter, { token, amount, nickname, openId });
}

//获取提现审批状态
export function getWithdrawal(nickname, token, openId) {
    return sharedGetWithdrawalStatus(sharedRequestAdapter, { nickname, token, openId });
}
