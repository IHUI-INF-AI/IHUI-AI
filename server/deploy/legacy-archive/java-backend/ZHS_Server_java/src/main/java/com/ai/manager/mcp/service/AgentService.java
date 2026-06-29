package com.ai.manager.mcp.service;


import com.ai.manager.small.domain.*;
import com.ai.manager.small.domain.dto.PageBean;

import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Map;

public interface AgentService {
    Map<String,List<Agents>> searchRule(AgentRule rule);

    List<Agents> searchRuleById(AgentRule rule, Map<String, AgentCategory> categories);

    AgentRule getAgentRule(Long id);
    
    /**
     * 通过agent_rule left join agent_rule_link查询智能体
     * @param rule 规则参数
     * @return 智能体列表
     */
    Map<String,List<Agents>> searchRuleByLink(AgentRule rule);
    
    /**
     * 根据规则ID和分类查询智能体列表(使用agent_rule_link表)
     * @param rule 规则参数
     * @param categories 分类映射
     * @return 智能体列表
     */
    List<Agents> searchRuleByIdByLink(AgentRule rule, Map<String, AgentCategory> categories);
    
    /**
     * 根据ID查询规则信息(使用agent_rule_link表)
     * @param id 规则ID
     * @return 规则信息
     */
    AgentRule getRuleByIdWithLink(Long id);

    List<Agents> useHistory(String userUuid, String platfor);

    /**
     * 推送公共socket消息
     *
     * @param userUuid
     * @param modelId
     * @param chatId
     * @param role
     * @param status
     * @param message
     * @param second
     * @return
     */
    public Object sendMessageToPublic(String userUuid, String modelId, String chatId, String role, String status, String type, String message, Long second);

    List<AgentRule> getRuleList();

    List<ZhsUserAgentContext> myCreation(String userUuid, Integer type, PageBean bean);

    void shareCreation(String userUuid, String contextId, String title, String coverUrl, String subtitle);
    void shareCustomCreation(String userUuid, String title, String coverUrl, String subtitle, String problem, String answer, String fileUrl);


    void operateCreation(String userUuid, String gcId, String type);

    BufferedImage creation2Image(String userUuid, String chatId, String agentId, List<String> ids);

    List<ZhsUserAgentContext> creation2third(String userUuid, String chatId, String agentId, List<String> ids);

    AiModelInfo getModelName(String agentId);
}
