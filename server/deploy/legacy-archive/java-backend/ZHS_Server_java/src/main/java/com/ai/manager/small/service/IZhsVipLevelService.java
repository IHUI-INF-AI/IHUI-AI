package com.ai.manager.small.service;


import com.ai.manager.small.domain.ZhsUserVip;
import com.ai.manager.small.domain.ZhsVipLevel;

import java.util.List;

/**
 * vip等级Service接口
 * 
 * @author Raindrop_L
 * @date 2025-06-09
 */
public interface IZhsVipLevelService 
{
    /**
     * 查询vip等级
     * 
     * @param id vip等级主键
     * @return vip等级
     */
    public ZhsVipLevel selectZhsVipLevelById(String id);

    /**
     * 查询vip等级列表
     * 
     * @param zhsVipLevel vip等级
     * @return vip等级集合
     */
    public List<ZhsVipLevel> selectZhsVipLevelList(ZhsVipLevel zhsVipLevel);

    /**
     * 新增vip等级
     * 
     * @param zhsVipLevel vip等级
     * @return 结果
     */
    public int insertZhsVipLevel(ZhsVipLevel zhsVipLevel);

    /**
     * 修改vip等级
     * 
     * @param zhsVipLevel vip等级
     * @return 结果
     */
    public int updateZhsVipLevel(ZhsVipLevel zhsVipLevel);

    /**
     * 批量删除vip等级
     * 
     * @param ids 需要删除的vip等级主键集合
     * @return 结果
     */
    public int deleteZhsVipLevelByIds(String[] ids);

    /**
     * 删除vip等级信息
     * 
     * @param id vip等级主键
     * @return 结果
     */
    public int deleteZhsVipLevelById(String id);

    ZhsUserVip getUserProgeress(String openId);

    int setUserProgress(String openId, String vipId, Integer progress);

}
