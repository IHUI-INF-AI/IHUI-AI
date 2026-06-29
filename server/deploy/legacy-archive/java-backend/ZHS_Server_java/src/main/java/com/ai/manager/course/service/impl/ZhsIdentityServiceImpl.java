package com.ai.manager.course.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ai.manager.course.mapper.ZhsIdentityMapper;
import com.ai.manager.course.domain.ZhsIdentity;
import com.ai.manager.course.service.IZhsIdentityService;

/**
 * 平台身份Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsIdentityServiceImpl implements IZhsIdentityService 
{
    @Autowired
    private ZhsIdentityMapper zhsIdentityMapper;

    /**
     * 查询平台身份
     * 
     * @param id 平台身份主键
     * @return 平台身份
     */
    @Override
    public ZhsIdentity getById(Integer id)
    {
        return zhsIdentityMapper.getById(id);
    }

    /**
     * 查询平台身份列表
     * 
     * @param zhsIdentity 平台身份
     * @return 平台身份
     */
    @Override
    public List<ZhsIdentity> getList(ZhsIdentity zhsIdentity)
    {
        return zhsIdentityMapper.getList(zhsIdentity);
    }

    /**
     * 新增平台身份
     * 
     * @param zhsIdentity 平台身份
     * @return 结果
     */
    @Override
    public int add(ZhsIdentity zhsIdentity)
    {
        return zhsIdentityMapper.addZhsIdentity(zhsIdentity);
    }

    /**
     * 修改平台身份
     * 
     * @param zhsIdentity 平台身份
     * @return 结果
     */
    @Override
    public int edit(ZhsIdentity zhsIdentity)
    {
        return zhsIdentityMapper.edit(zhsIdentity);
    }

    /**
     * 批量删除平台身份
     * 
     * @param ids 需要删除的平台身份主键
     * @return 结果
     */
    @Override
    public int delByIds(Integer[] ids)
    {
        return zhsIdentityMapper.delByIds(ids);
    }

    /**
     * 删除平台身份信息
     * 
     * @param id 平台身份主键
     * @return 结果
     */
    @Override
    public int delById(Integer id)
    {
        return zhsIdentityMapper.delById(id);
    }
}
