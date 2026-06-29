package com.ai.manager.mcp.service;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.small.domain.ZhsUserAgentImage;

import java.util.Map;

public interface KlingAIService {

    ResponseResultInfo generateVideo(Map<String, Object> param);

    ResponseResultInfo videoInfo(String id, String uuid);

}
