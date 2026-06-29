package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.AgentCategory;
import com.ai.manager.small.domain.vo.AgentCategoryVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 智能体类型Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-07
 */
public interface AgentCategoryMapper
{
    /**
     * 查询智能体类型
     * 
     * @param id 智能体类型主键
     * @return 智能体类型
     */
    public AgentCategory selectAgentCategoryById(String id);

    /**
     * 查询智能体类型列表
     * 
     * @param agentCategory 智能体类型
     * @return 智能体类型集合
     */
    public List<AgentCategory> selectAgentCategoryList(AgentCategory agentCategory);

    /**
     * 新增智能体类型
     * 
     * @param agentCategory 智能体类型
     * @return 结果
     */
    public int insertAgentCategory(AgentCategory agentCategory);

    /**
     * 修改智能体类型
     * 
     * @param agentCategory 智能体类型
     * @return 结果
     */
    public int updateAgentCategory(AgentCategory agentCategory);

    /**
     * 删除智能体类型
     * 
     * @param id 智能体类型主键
     * @return 结果
     */
    public int deleteAgentCategoryById(String id);

    /**
     * 批量删除智能体类型
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deleteAgentCategoryByIds(String[] ids);

    List<AgentCategoryVO> getByLinkIds(@Param("ids") List<String> ids);
}
