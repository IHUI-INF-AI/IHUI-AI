package com.ai.manager.small.mapper;

import com.ai.manager.mcp.domain.TBoxAgentContentBean;
import com.ai.manager.small.domain.AiModelInfo;

public interface AiModelInfoMapper {

    AiModelInfo queryById(String modelId);

    void add(TBoxAgentContentBean eventContent);

    void delist(TBoxAgentContentBean eventContent);
}
