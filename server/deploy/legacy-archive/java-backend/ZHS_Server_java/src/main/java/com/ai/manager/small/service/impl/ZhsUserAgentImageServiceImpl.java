package com.ai.manager.small.service.impl;

import java.util.List;

import com.ai.manager.small.domain.ZhsUserAgentImage;
import com.ai.manager.small.mapper.ZhsUserAgentImageMapper;
import com.ai.manager.small.service.IZhsUserAgentImageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * 用户形象Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-09-30
 */
@Service
public class ZhsUserAgentImageServiceImpl implements IZhsUserAgentImageService
{
    @Autowired
    private ZhsUserAgentImageMapper zhsUserAgentImageMapper;

    /**
     * 查询用户形象
     * 
     * @param id 用户形象主键
     * @return 用户形象
     */
    @Override
    public ZhsUserAgentImage getById(Long id)
    {
        return zhsUserAgentImageMapper.getById(id);
    }

    /**
     * 查询用户形象列表
     * 
     * @param zhsUserAgentImage 用户形象
     * @return 用户形象
     */
    @Override
    public List<ZhsUserAgentImage> getList(ZhsUserAgentImage zhsUserAgentImage)
    {
        return zhsUserAgentImageMapper.getList(zhsUserAgentImage);
    }

    /**
     * 新增用户形象
     * 
     * @param zhsUserAgentImage 用户形象
     * @return 结果
     */
    @Override
    public int add(ZhsUserAgentImage zhsUserAgentImage)
    {
        return zhsUserAgentImageMapper.addZhsUserAgentImage(zhsUserAgentImage);
    }

    /**
     * 修改用户形象
     * 
     * @param zhsUserAgentImage 用户形象
     * @return 结果
     */
    @Override
    public int edit(ZhsUserAgentImage zhsUserAgentImage)
    {
        return zhsUserAgentImageMapper.edit(zhsUserAgentImage);
    }

    /**
     * 批量删除用户形象
     * 
     * @param ids 需要删除的用户形象主键
     * @return 结果
     */
    @Override
    public int delByIds(Long[] ids)
    {
        return zhsUserAgentImageMapper.delByIds(ids);
    }

    /**
     * 删除用户形象信息
     * 
     * @param id 用户形象主键
     * @return 结果
     */
    @Override
    public int delById(Long id)
    {
        return zhsUserAgentImageMapper.delById(id);
    }
}
