package com.ai.manager.course.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ai.manager.course.mapper.ZhsOrganizationMapper;
import com.ai.manager.course.domain.ZhsOrganization;
import com.ai.manager.course.service.IZhsOrganizationService;

/**
 * 平台机构Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsOrganizationServiceImpl implements IZhsOrganizationService 
{
    @Autowired
    private ZhsOrganizationMapper zhsOrganizationMapper;

    /**
     * 查询平台机构
     * 
     * @param id 平台机构主键
     * @return 平台机构
     */
    @Override
    public ZhsOrganization getById(Integer id)
    {
        return zhsOrganizationMapper.getById(id);
    }

    /**
     * 查询平台机构列表
     * 
     * @param zhsOrganization 平台机构
     * @return 平台机构
     */
    @Override
    public List<ZhsOrganization> getList(ZhsOrganization zhsOrganization)
    {
        return zhsOrganizationMapper.getList(zhsOrganization);
    }

    /**
     * 新增平台机构
     * 
     * @param zhsOrganization 平台机构
     * @return 结果
     */
    @Override
    public int add(ZhsOrganization zhsOrganization)
    {
        return zhsOrganizationMapper.addZhsOrganization(zhsOrganization);
    }

    /**
     * 修改平台机构
     * 
     * @param zhsOrganization 平台机构
     * @return 结果
     */
    @Override
    public int edit(ZhsOrganization zhsOrganization)
    {
        return zhsOrganizationMapper.edit(zhsOrganization);
    }

    /**
     * 批量删除平台机构
     * 
     * @param ids 需要删除的平台机构主键
     * @return 结果
     */
    @Override
    public int delByIds(Integer[] ids)
    {
        return zhsOrganizationMapper.delByIds(ids);
    }

    /**
     * 删除平台机构信息
     * 
     * @param id 平台机构主键
     * @return 结果
     */
    @Override
    public int delById(Integer id)
    {
        return zhsOrganizationMapper.delById(id);
    }
}
