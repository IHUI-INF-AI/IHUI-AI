package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.ZhsAgent;
import com.ai.manager.small.mapper.ZhsAgentMapper;
import com.ai.manager.small.service.IZhsAgentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Agent管理Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-06-20
 */
@Service
public class ZhsAgentServiceImpl implements IZhsAgentService
{
    @Autowired
    private ZhsAgentMapper zhsAgentMapper;

    /**
     * 查询Agent管理
     * 
     * @param id Agent管理主键
     * @return Agent管理
     */
    @Override
    public ZhsAgent selectZhsAgentById(String id)
    {
        return zhsAgentMapper.selectZhsAgentById(id);
    }

    /**
     * 查询Agent管理列表
     * 
     * @param zhsAgent Agent管理
     * @return Agent管理
     */
    @Override
    public List<ZhsAgent> selectZhsAgentList(ZhsAgent zhsAgent)
    {
        return zhsAgentMapper.selectZhsAgentList(zhsAgent);
    }

    /**
     * 新增Agent管理
     * 
     * @param zhsAgent Agent管理
     * @return 结果
     */
    @Override
    public int insertZhsAgent(ZhsAgent zhsAgent)
    {
        return zhsAgentMapper.insertZhsAgent(zhsAgent);
    }

    /**
     * 修改Agent管理
     * 
     * @param zhsAgent Agent管理
     * @return 结果
     */
    @Override
    public int updateZhsAgent(ZhsAgent zhsAgent)
    {
        return zhsAgentMapper.updateZhsAgent(zhsAgent);
    }

    /**
     * 批量删除Agent管理
     * 
     * @param ids 需要删除的Agent管理主键
     * @return 结果
     */
    @Override
    public int deleteZhsAgentByIds(String[] ids)
    {
        return zhsAgentMapper.deleteZhsAgentByIds(ids);
    }

    /**
     * 删除Agent管理信息
     * 
     * @param id Agent管理主键
     * @return 结果
     */
    @Override
    public int deleteZhsAgentById(String id)
    {
        return zhsAgentMapper.deleteZhsAgentById(id);
    }
}
