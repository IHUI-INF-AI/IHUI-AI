import request from "@/utils/service/index.js";
import {
    getCoursePlanet as sharedGetCoursePlanet,
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

export function getCoursePlanet() {
  return sharedGetCoursePlanet(sharedRequestAdapter);
}
