package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.AgentNeedTask;
import com.ai.manager.small.domain.dto.AgentNeedTaskDTO;
import com.ai.manager.small.domain.vo.AgentCategoryVO;
import com.ai.manager.small.mapper.AgentCategoryLinkMapper;
import com.ai.manager.small.mapper.AgentCategoryMapper;
import com.ai.manager.small.mapper.AgentNeedTaskMapper;
import com.ai.manager.small.service.IAgentNeedTaskService;
import com.alibaba.druid.support.json.JSONUtils;
import org.apache.commons.collections.CollectionUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 智能体需求任务Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-15
 */
@Service
public class AgentNeedTaskServiceImpl implements IAgentNeedTaskService
{
    @Autowired
    private AgentNeedTaskMapper agentNeedTaskMapper;
    @Autowired
    private AgentCategoryMapper categoryMapper;
    @Autowired
    private AgentCategoryLinkMapper categoryLinkMapper;

    /**
     * 查询智能体需求任务
     * 
     * @param id 智能体需求任务主键
     * @return 智能体需求任务
     */
    @Override
    public AgentNeedTask getById(String id)
    {
        return agentNeedTaskMapper.getById(id);
    }

    /**
     * 查询智能体需求任务列表
     * 
     * @param agentNeedTask 智能体需求任务
     * @return 智能体需求任务
     */
    @Override
    public List<AgentNeedTask> getList(AgentNeedTaskDTO agentNeedTask)
    {
        if(CollectionUtils.isEmpty(agentNeedTask.getTypes())){
            agentNeedTask.setTypes(null);
        }
        if(CollectionUtils.isEmpty(agentNeedTask.getCategorys())){
            agentNeedTask.setCategorys(null);
        }

//        if(CollectionUtils.isNotEmpty(agentNeedTask.getTypes()) && CollectionUtils.isNotEmpty(agentNeedTask.getCategorys())){
//            agentNeedTask.getTypes().addAll(agentNeedTask.getCategorys());
//            agentNeedTask.setCategorys(null);
//        }

        System.out.println(JSONUtils.toJSONString(agentNeedTask));
        List<AgentNeedTask> list = agentNeedTaskMapper.getList(agentNeedTask);
        if(CollectionUtils.isNotEmpty(list)){
            List<String> ids = list.stream().map(AgentNeedTask::getId).collect(Collectors.toList());
            List<AgentCategoryVO> categories = categoryMapper.getByLinkIds(ids);
            Map<String, List<AgentCategoryVO>> collect = categories.stream().collect(Collectors.groupingBy(AgentCategoryVO::getAgentId));
            list.forEach(item -> {
                List<AgentCategoryVO> agentCategoryVOS = collect.get(item.getId());
                if(CollectionUtils.isNotEmpty(agentCategoryVOS)){
                    Map<String, List<AgentCategoryVO>> byType = agentCategoryVOS.stream().collect(Collectors.groupingBy(AgentCategoryVO::getField2));
                    item.setTypeList(byType.get("0"));
                    item.setCategoryList(byType.get("1"));
                }
            });
        }

        return list;
    }

    /**
     * 新增智能体需求任务
     * 
     * @param agentNeedTask 智能体需求任务
     * @return 结果
     */
    @Override
    public int add(AgentNeedTaskDTO agentNeedTask)
    {
        agentNeedTask.setId(UUID.randomUUID().toString());
        int i = agentNeedTaskMapper.addAgentNeedTask(agentNeedTask);
        List<String> types = agentNeedTask.getTypes().stream().distinct().collect(Collectors.toList());

        List<String> categorys = agentNeedTask.getCategorys().stream().distinct().collect(Collectors.toList());
        // 批量创建中间表字段数据
        categoryLinkMapper.addTypeAndCategory(agentNeedTask.getId(), types, categorys);

        return i;
    }

    /**
     * 修改智能体需求任务
     * 
     * @param agentNeedTask 智能体需求任务
     * @return 结果
     */
    @Override
    public int edit(AgentNeedTask agentNeedTask)
    {
        return agentNeedTaskMapper.edit(agentNeedTask);
    }

    /**
     * 批量删除智能体需求任务
     * 
     * @param ids 需要删除的智能体需求任务主键
     * @return 结果
     */
    @Override
    public int delByIds(String[] ids)
    {
        return agentNeedTaskMapper.delByIds(ids);
    }

    /**
     * 删除智能体需求任务信息
     * 
     * @param id 智能体需求任务主键
     * @return 结果
     */
    @Override
    public int delById(String id)
    {
        return agentNeedTaskMapper.delById(id);
    }

}
