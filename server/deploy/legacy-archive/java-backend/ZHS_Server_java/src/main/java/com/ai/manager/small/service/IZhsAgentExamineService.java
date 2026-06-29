package com.ai.manager.small.service;

import com.ai.manager.mcp.domain.TBoxAgentContentBean;
import com.ai.manager.small.domain.ZhsAgentExamine;
import com.ai.manager.small.domain.vo.ZhsAgentExamineVO;

import java.util.List;

/**
 * 开发者智能体审核Service接口
 *
 * @author Raindrop_L
 * @date 2025-08-12
 */
public interface IZhsAgentExamineService
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
    public int add(ZhsAgentExamine zhsAgentExamine);

    /**
     * 修改开发者智能体审核
     *
     * @param zhsAgentExamine 开发者智能体审核
     * @return 结果
     */
    public int edit(ZhsAgentExamine zhsAgentExamine);

    /**
     * 批量删除开发者智能体审核
     *
     * @param ids 需要删除的开发者智能体审核主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    /**
     * 删除开发者智能体审核信息
     *
     * @param id 开发者智能体审核主键
     * @return 结果
     */
    public int delById(String id);

    int pass(String zhsAgentExamine, String remark);

    int reject(String id, String remark);

    void addTBox(TBoxAgentContentBean eventContent);

    void delistTBox(TBoxAgentContentBean eventContent);
}

