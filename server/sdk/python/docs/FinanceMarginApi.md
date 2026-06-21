# zhs_api.FinanceMarginApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**admin_adjust_balance_api_v1_finance_target_user_uuid_put**](FinanceMarginApi.md#admin_adjust_balance_api_v1_finance_target_user_uuid_put) | **PUT** /api/v1/finance/{target_user_uuid} | 管理员直接调整用户 Token 余额
[**check_balance_api_v1_finance_check_get**](FinanceMarginApi.md#check_balance_api_v1_finance_check_get) | **GET** /api/v1/finance/check | 检查余额是否充足
[**deduct_api_v1_finance_deduct_post**](FinanceMarginApi.md#deduct_api_v1_finance_deduct_post) | **POST** /api/v1/finance/deduct | 扣减用户 token（内部调用）
[**expire_api_v1_finance_expire_post**](FinanceMarginApi.md#expire_api_v1_finance_expire_post) | **POST** /api/v1/finance/expire | 过期清零（管理员/定时任务）
[**get_balance_api_v1_finance_balance_get**](FinanceMarginApi.md#get_balance_api_v1_finance_balance_get) | **GET** /api/v1/finance/balance | 查询用户 token 余额（Redis 缓存 5 分钟）
[**grant_commission_api_v1_finance_commission_post**](FinanceMarginApi.md#grant_commission_api_v1_finance_commission_post) | **POST** /api/v1/finance/commission | 佣金入账（邀请分成）
[**list_flows_api_v1_finance_flows_get**](FinanceMarginApi.md#list_flows_api_v1_finance_flows_get) | **GET** /api/v1/finance/flows | 用户 token 流水（支持按类型过滤）
[**list_token_flow_admin_api_v1_finance_flow_list_get**](FinanceMarginApi.md#list_token_flow_admin_api_v1_finance_flow_list_get) | **GET** /api/v1/finance/flow/list | Token 操作流水列表（管理员）
[**recharge_api_v1_finance_recharge_post**](FinanceMarginApi.md#recharge_api_v1_finance_recharge_post) | **POST** /api/v1/finance/recharge | 充值 token（与支付订单配合使用）
[**refund_token_api_v1_finance_refund_post**](FinanceMarginApi.md#refund_token_api_v1_finance_refund_post) | **POST** /api/v1/finance/refund | Token 回退（退还指定数量 token 到用户余额）


# **admin_adjust_balance_api_v1_finance_target_user_uuid_put**
> object admin_adjust_balance_api_v1_finance_target_user_uuid_put(target_user_uuid, quantity, reason=reason)

管理员直接调整用户 Token 余额

P15-C2 改造: 改用 require_login + 内部 role 断言, 避免 FastAPI 0.116 + Python 3.13
对 Depends(require_role("admin")) 嵌套闭包的签名解析报错 (no signature for builtin str).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.FinanceMarginApi(api_client)
    target_user_uuid = 'target_user_uuid_example' # str | 
    quantity = 56 # int | 调整数量（正数增加/负数扣减）
    reason = '管理员调整' # str | 操作原因 (optional) (default to '管理员调整')

    try:
        # 管理员直接调整用户 Token 余额
        api_response = api_instance.admin_adjust_balance_api_v1_finance_target_user_uuid_put(target_user_uuid, quantity, reason=reason)
        print("The response of FinanceMarginApi->admin_adjust_balance_api_v1_finance_target_user_uuid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceMarginApi->admin_adjust_balance_api_v1_finance_target_user_uuid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **target_user_uuid** | **str**|  | 
 **quantity** | **int**| 调整数量（正数增加/负数扣减） | 
 **reason** | **str**| 操作原因 | [optional] [default to &#39;管理员调整&#39;]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **check_balance_api_v1_finance_check_get**
> object check_balance_api_v1_finance_check_get(min_tokens)

检查余额是否充足

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.FinanceMarginApi(api_client)
    min_tokens = 56 # int | 所需 token 数

    try:
        # 检查余额是否充足
        api_response = api_instance.check_balance_api_v1_finance_check_get(min_tokens)
        print("The response of FinanceMarginApi->check_balance_api_v1_finance_check_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceMarginApi->check_balance_api_v1_finance_check_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **min_tokens** | **int**| 所需 token 数 | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deduct_api_v1_finance_deduct_post**
> object deduct_api_v1_finance_deduct_post(quantity, remark=remark)

扣减用户 token（内部调用）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.FinanceMarginApi(api_client)
    quantity = 56 # int | 扣减数量
    remark = '' # str | 操作描述 (optional) (default to '')

    try:
        # 扣减用户 token（内部调用）
        api_response = api_instance.deduct_api_v1_finance_deduct_post(quantity, remark=remark)
        print("The response of FinanceMarginApi->deduct_api_v1_finance_deduct_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceMarginApi->deduct_api_v1_finance_deduct_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **quantity** | **int**| 扣减数量 | 
 **remark** | **str**| 操作描述 | [optional] [default to &#39;&#39;]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **expire_api_v1_finance_expire_post**
> object expire_api_v1_finance_expire_post(quantity, source=source)

过期清零（管理员/定时任务）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.FinanceMarginApi(api_client)
    quantity = 56 # int | 过期数量
    source = '到期清零' # str |  (optional) (default to '到期清零')

    try:
        # 过期清零（管理员/定时任务）
        api_response = api_instance.expire_api_v1_finance_expire_post(quantity, source=source)
        print("The response of FinanceMarginApi->expire_api_v1_finance_expire_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceMarginApi->expire_api_v1_finance_expire_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **quantity** | **int**| 过期数量 | 
 **source** | **str**|  | [optional] [default to &#39;到期清零&#39;]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_balance_api_v1_finance_balance_get**
> object get_balance_api_v1_finance_balance_get()

查询用户 token 余额（Redis 缓存 5 分钟）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.FinanceMarginApi(api_client)

    try:
        # 查询用户 token 余额（Redis 缓存 5 分钟）
        api_response = api_instance.get_balance_api_v1_finance_balance_get()
        print("The response of FinanceMarginApi->get_balance_api_v1_finance_balance_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceMarginApi->get_balance_api_v1_finance_balance_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **grant_commission_api_v1_finance_commission_post**
> object grant_commission_api_v1_finance_commission_post(quantity, invited_user_id=invited_user_id, source=source)

佣金入账（邀请分成）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.FinanceMarginApi(api_client)
    quantity = 56 # int | 佣金数量
    invited_user_id = '' # str | 被邀请人 uuid (optional) (default to '')
    source = 'invite' # str | 来源 (optional) (default to 'invite')

    try:
        # 佣金入账（邀请分成）
        api_response = api_instance.grant_commission_api_v1_finance_commission_post(quantity, invited_user_id=invited_user_id, source=source)
        print("The response of FinanceMarginApi->grant_commission_api_v1_finance_commission_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceMarginApi->grant_commission_api_v1_finance_commission_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **quantity** | **int**| 佣金数量 | 
 **invited_user_id** | **str**| 被邀请人 uuid | [optional] [default to &#39;&#39;]
 **source** | **str**| 来源 | [optional] [default to &#39;invite&#39;]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_flows_api_v1_finance_flows_get**
> object list_flows_api_v1_finance_flows_get(page=page, limit=limit, op_type=op_type)

用户 token 流水（支持按类型过滤）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.FinanceMarginApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    op_type = 56 # int | 0=充值 1=扣减 2=过期 3=退款 4=佣金 (optional)

    try:
        # 用户 token 流水（支持按类型过滤）
        api_response = api_instance.list_flows_api_v1_finance_flows_get(page=page, limit=limit, op_type=op_type)
        print("The response of FinanceMarginApi->list_flows_api_v1_finance_flows_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceMarginApi->list_flows_api_v1_finance_flows_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **op_type** | **int**| 0&#x3D;充值 1&#x3D;扣减 2&#x3D;过期 3&#x3D;退款 4&#x3D;佣金 | [optional] 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_token_flow_admin_api_v1_finance_flow_list_get**
> object list_token_flow_admin_api_v1_finance_flow_list_get(page=page, limit=limit, user_id=user_id, op_type=op_type)

Token 操作流水列表（管理员）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.FinanceMarginApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_id = 'user_id_example' # str | 按用户 UUID 过滤 (optional)
    op_type = 56 # int | 操作类型过滤 (optional)

    try:
        # Token 操作流水列表（管理员）
        api_response = api_instance.list_token_flow_admin_api_v1_finance_flow_list_get(page=page, limit=limit, user_id=user_id, op_type=op_type)
        print("The response of FinanceMarginApi->list_token_flow_admin_api_v1_finance_flow_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceMarginApi->list_token_flow_admin_api_v1_finance_flow_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_id** | **str**| 按用户 UUID 过滤 | [optional] 
 **op_type** | **int**| 操作类型过滤 | [optional] 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **recharge_api_v1_finance_recharge_post**
> object recharge_api_v1_finance_recharge_post(quantity, out_trade_no)

充值 token（与支付订单配合使用）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.FinanceMarginApi(api_client)
    quantity = 56 # int | 充值数量
    out_trade_no = 'out_trade_no_example' # str | 支付订单号

    try:
        # 充值 token（与支付订单配合使用）
        api_response = api_instance.recharge_api_v1_finance_recharge_post(quantity, out_trade_no)
        print("The response of FinanceMarginApi->recharge_api_v1_finance_recharge_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceMarginApi->recharge_api_v1_finance_recharge_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **quantity** | **int**| 充值数量 | 
 **out_trade_no** | **str**| 支付订单号 | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **refund_token_api_v1_finance_refund_post**
> object refund_token_api_v1_finance_refund_post(quantity, remark=remark)

Token 回退（退还指定数量 token 到用户余额）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.FinanceMarginApi(api_client)
    quantity = 56 # int | 回退数量
    remark = '' # str | 操作说明 (optional) (default to '')

    try:
        # Token 回退（退还指定数量 token 到用户余额）
        api_response = api_instance.refund_token_api_v1_finance_refund_post(quantity, remark=remark)
        print("The response of FinanceMarginApi->refund_token_api_v1_finance_refund_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceMarginApi->refund_token_api_v1_finance_refund_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **quantity** | **int**| 回退数量 | 
 **remark** | **str**| 操作说明 | [optional] [default to &#39;&#39;]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

