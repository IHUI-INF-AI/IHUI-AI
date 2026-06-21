import request from "@/utils/service/index.js";
import {
    getSubordinates as sharedGetSubordinates,
    getUserAndChildrenOrders as sharedGetUserAndChildrenOrders,
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

//操盘手
/**
 *获取操盘手的下家列表
 */
export function getSubordinates(open_id, page, quantity) {
    return sharedGetSubordinates(sharedRequestAdapter, { open_id, page, quantity });
}

/**
 *超盘手获取自己以及下家订单
 */
export function getUserAndChildrenOrders(id, page, quantity) {
    return sharedGetUserAndChildrenOrders(sharedRequestAdapter, { id, page, quantity });
}
