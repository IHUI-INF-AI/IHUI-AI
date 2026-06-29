package com.ai.manager.mcp.service;

import com.ai.manager.core.config.ResponseResultInfo;

import java.util.Map;

public interface Gemini3ProPreviewService {
    ResponseResultInfo generate(Map<String, Object> param, String problem);

}
