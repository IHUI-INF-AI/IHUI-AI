package com.ai.manager.app.server;

import java.util.Map;

/**
 * 移动端android支付
 */
public interface PayAndroidService {

    Map pay(Map<String, Object> param, String authorization);
}
