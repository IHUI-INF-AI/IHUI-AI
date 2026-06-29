package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.AgentCategoryLink;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 智能体类型关联Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-07
 */
public interface AgentCategoryLinkMapper
{
    /**
     * 查询智能体类型关联
     * 
     * @param id 智能体类型关联主键
     * @return 智能体类型关联
     */
    public AgentCategoryLink selectAgentCategoryLinkById(Integer id);

    /**
     * 查询智能体类型关联列表
     * 
     * @param agentCategoryLink 智能体类型关联
     * @return 智能体类型关联集合
     */
    public List<AgentCategoryLink> selectAgentCategoryLinkList(AgentCategoryLink agentCategoryLink);

    /**
     * 新增智能体类型关联
     * 
     * @param agentCategoryLink 智能体类型关联
     * @return 结果
     */
    public int insertAgentCategoryLink(AgentCategoryLink agentCategoryLink);

    /**
     * 修改智能体类型关联
     * 
     * @param agentCategoryLink 智能体类型关联
     * @return 结果
     */
    public int updateAgentCategoryLink(AgentCategoryLink agentCategoryLink);

    /**
     * 删除智能体类型关联
     * 
     * @param id 智能体类型关联主键
     * @return 结果
     */
    public int deleteAgentCategoryLinkById(Integer id);

    /**
     * 批量删除智能体类型关联
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deleteAgentCategoryLinkByIds(Integer[] ids);

    void addTypeAndCategory(@Param("id") String id, @Param("types") List<String> types, @Param("categorys") List<String> categorys);

    void removeByAgentIds(@Param("ids") List<String> ids);
}
