package com.ai.manager.mcp.service;

import com.ai.manager.core.config.ResponseResultInfo;

import java.util.Map;

public interface SunoService {
    ResponseResultInfo generateMusic(Map<String, Object> param, String problem);
}
