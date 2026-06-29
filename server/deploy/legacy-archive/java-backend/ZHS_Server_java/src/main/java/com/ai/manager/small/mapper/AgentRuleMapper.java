package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.AgentRule;
import com.ai.manager.small.domain.AgentRuleParam;
import com.ai.manager.small.domain.Agents;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 智能体自定义筛选规则Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-09-26
 */
public interface AgentRuleMapper
{
    /**
     * 查询智能体自定义筛选规则
     * 
     * @param id 智能体自定义筛选规则主键
     * @return 智能体自定义筛选规则
     */
    public AgentRule getById(Long id);

    /**
     * 查询智能体自定义筛选规则列表
     * 
     * @param agentRule 智能体自定义筛选规则
     * @return 智能体自定义筛选规则集合
     */
    public List<AgentRule> getList(AgentRule agentRule);

    /**
     * 新增智能体自定义筛选规则
     * 
     * @param agentRule 智能体自定义筛选规则
     * @return 结果
     */
    public int addAgentRule(AgentRule agentRule);

    /**
     * 修改智能体自定义筛选规则
     * 
     * @param agentRule 智能体自定义筛选规则
     * @return 结果
     */
    public int edit(AgentRule agentRule);

    /**
     * 删除智能体自定义筛选规则
     * 
     * @param id 智能体自定义筛选规则主键
     * @return 结果
     */
    public int delById(Long id);

    /**
     * 批量删除智能体自定义筛选规则
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(Long[] ids);

    List<Agents> getAgentListByRuleId(@Param("paramList") List<AgentRuleParam> paramList, @Param("orderList") List<AgentRuleParam> orderList, @Param("agentCategory") String agentCategory, @Param("agentMainCategory") String agentMainCategory, @Param("uuid") String uuid);

    /**
     * 查询智能体自定义筛选规则列表(使用agent_rule_link表)
     *
     * @param agentRule 智能体自定义筛选规则
     * @return 智能体自定义筛选规则集合
     */
    public List<AgentRule> getListByLink(AgentRule agentRule);
    
    /**
     * 根据ID查询规则信息(使用agent_rule_link表)
     *
     * @param id 规则ID
     * @return 规则信息
     */
    public AgentRule getRuleByIdWithLink(Long id);
    
    /**
     * 根据规则ID和条件查询智能体列表(使用agent_rule_link表)
     *
     * @param ruleId  规则id列表
     * @param uuid
     * @return 智能体列表
     */
    List<Agents> getAgentsByLink(@Param("ruleId") Long ruleId, @Param("uuid") String uuid, @Param("agentCategory") String agentCategory, @Param("agentMainCategory") String agentMainCategory);

    List<Agents> useHistory(@Param("userUuid") String userUuid, @Param("useHistory") Integer useHistory);
}
