package com.ai.manager.small.mapper;

import com.ai.manager.mcp.domain.TBoxAgentContentBean;
import com.ai.manager.small.domain.ZhsAgentExamine;
import com.ai.manager.small.domain.vo.ZhsAgentExamineVO;
import com.baomidou.dynamic.datasource.annotation.Slave;

import java.util.List;

/**
 * 开发者智能体审核Mapper接口
 *
 * @author Raindrop_L
 * @date 2025-08-12
 */
@Slave
public interface ZhsAgentExamineMapper
{
    /**
     * 查询开发者智能体审核
     *
     * @param id 开发者智能体审核主键
     * @return 开发者智能体审核
     */
    public ZhsAgentExamineVO getById(String id);

    /**
     * 查询开发者智能体审核列表
     *
     * @param zhsAgentExamine 开发者智能体审核
     * @return 开发者智能体审核集合
     */
    public List<ZhsAgentExamineVO> getList(ZhsAgentExamine zhsAgentExamine);

    /**
     * 新增开发者智能体审核
     *
     * @param zhsAgentExamine 开发者智能体审核
     * @return 结果
     */
    public int addZhsAgentExamine(ZhsAgentExamine zhsAgentExamine);

    /**
     * 修改开发者智能体审核
     *
     * @param zhsAgentExamine 开发者智能体审核
     * @return 结果
     */
    public int edit(ZhsAgentExamine zhsAgentExamine);

    /**
     * 删除开发者智能体审核
     *
     * @param id 开发者智能体审核主键
     * @return 结果
     */
    public int delById(String id);

    /**
     * 批量删除开发者智能体审核
     *
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    void addTBox(TBoxAgentContentBean eventContent);

    void addTBoxExamine(TBoxAgentContentBean eventContent);

    void delistTBox(TBoxAgentContentBean eventContent);

    void delistTBoxExamine(TBoxAgentContentBean eventContent);
}
