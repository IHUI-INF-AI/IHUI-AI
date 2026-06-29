package com.ai.manager.mcp.service;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.small.domain.Order;
import com.ai.manager.small.domain.ZhsUserAgentImage;

import java.util.List;
import java.util.Map;

public interface AliAIService {

    ResponseResultInfo generateTimbre(Map<String, Object> param);

    ResponseResultInfo getAudioSys();

    Boolean checkPay(String uuid, Integer imageType, String audioId);
    Map<String, List<ZhsUserAgentImage>> getUserImageMap();
    Map<String, List<Order>> getUserImageOrderMap();

    ResponseResultInfo videoToDigital(String videoUrl, String userUuid, Integer progress, String imageName);

    ResponseResultInfo getDigital(String userUuid, Integer type);
}
