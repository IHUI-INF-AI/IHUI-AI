package com.ai.manager.small.mapper;


import com.ai.manager.small.domain.AgentRuleParam;

import java.util.List;

/**
 * 智能体自定义检索规则字段Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-09-26
 */
public interface AgentRuleParamMapper
{
    /**
     * 查询智能体自定义检索规则字段
     * 
     * @param id 智能体自定义检索规则字段主键
     * @return 智能体自定义检索规则字段
     */
    public AgentRuleParam getById(Long id);

    /**
     * 查询智能体自定义检索规则字段列表
     * 
     * @param agentRuleParam 智能体自定义检索规则字段
     * @return 智能体自定义检索规则字段集合
     */
    public List<AgentRuleParam> getList(AgentRuleParam agentRuleParam);

    /**
     * 新增智能体自定义检索规则字段
     * 
     * @param agentRuleParam 智能体自定义检索规则字段
     * @return 结果
     */
    public int addAgentRuleParam(AgentRuleParam agentRuleParam);

    /**
     * 修改智能体自定义检索规则字段
     * 
     * @param agentRuleParam 智能体自定义检索规则字段
     * @return 结果
     */
    public int edit(AgentRuleParam agentRuleParam);

    /**
     * 删除智能体自定义检索规则字段
     * 
     * @param id 智能体自定义检索规则字段主键
     * @return 结果
     */
    public int delById(Long id);

    /**
     * 批量删除智能体自定义检索规则字段
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(Long[] ids);
}
