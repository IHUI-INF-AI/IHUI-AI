package com.ai.manager.mcp.service;

import com.ai.manager.core.config.ResponseResultInfo;

import java.util.Map;

public interface JianYiAIService {
    ResponseResultInfo generateVideoBySora2(Map<String, Object> param);

    ResponseResultInfo videoInfoBySora2(String id, String uuid);
}
