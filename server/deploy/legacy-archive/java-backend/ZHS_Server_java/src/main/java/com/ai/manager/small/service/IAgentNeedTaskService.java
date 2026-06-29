package com.ai.manager.small.service;

import com.ai.manager.small.domain.AgentNeedTask;
import com.ai.manager.small.domain.dto.AgentNeedTaskDTO;

import java.util.List;

/**
 * 智能体需求任务Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-15
 */
public interface IAgentNeedTaskService
{
    /**
     * 查询智能体需求任务
     * 
     * @param id 智能体需求任务主键
     * @return 智能体需求任务
     */
    public AgentNeedTask getById(String id);

    /**
     * 查询智能体需求任务列表
     * 
     * @param agentNeedTask 智能体需求任务
     * @return 智能体需求任务集合
     */
    public List<AgentNeedTask> getList(AgentNeedTaskDTO agentNeedTask);

    /**
     * 新增智能体需求任务
     * 
     * @param agentNeedTask 智能体需求任务
     * @return 结果
     */
    public int add(AgentNeedTaskDTO agentNeedTask);

    /**
     * 修改智能体需求任务
     * 
     * @param agentNeedTask 智能体需求任务
     * @return 结果
     */
    public int edit(AgentNeedTask agentNeedTask);

    /**
     * 批量删除智能体需求任务
     * 
     * @param ids 需要删除的智能体需求任务主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    /**
     * 删除智能体需求任务信息
     * 
     * @param id 智能体需求任务主键
     * @return 结果
     */
    public int delById(String id);

}
