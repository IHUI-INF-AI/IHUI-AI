package com.ai.manager.small.service;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.small.domain.ZhsProductIdentity;

import java.util.List;

/**
 * 开通身份订单Service接口
 * 
 * @author Raindrop_L
 * @date 2025-06-07
 */
public interface IZhsProductIdentityService 
{
    /**
     * 查询开通身份订单
     * 
     * @param id 开通身份订单主键
     * @return 开通身份订单
     */
    public ZhsProductIdentity selectZhsProductIdentityById(String id);

    /**
     * 查询开通身份订单列表
     * 
     * @param zhsProductIdentity 开通身份订单
     * @return 开通身份订单集合
     */
    public List<ZhsProductIdentity> selectZhsProductIdentityList(ZhsProductIdentity zhsProductIdentity);

    /**
     * 新增开通身份订单
     * 
     * @param zhsProductIdentity 开通身份订单
     * @return 结果
     */
    public int insertZhsProductIdentity(ZhsProductIdentity zhsProductIdentity);

    /**
     * 修改开通身份订单
     * 
     * @param zhsProductIdentity 开通身份订单
     * @return 结果
     */
    public int updateZhsProductIdentity(ZhsProductIdentity zhsProductIdentity);

    /**
     * 批量删除开通身份订单
     * 
     * @param ids 需要删除的开通身份订单主键集合
     * @return 结果
     */
    public int deleteZhsProductIdentityByIds(String[] ids);

    /**
     * 删除开通身份订单信息
     * 
     * @param id 开通身份订单主键
     * @return 结果
     */
    public int deleteZhsProductIdentityById(String id);

    public ResponseResultInfo getByOpenId(String token);
}
