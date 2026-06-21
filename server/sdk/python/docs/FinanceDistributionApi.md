# zhs_api.FinanceDistributionApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**commission_detail_api_v1_finance_commission_detail_get**](FinanceDistributionApi.md#commission_detail_api_v1_finance_commission_detail_get) | **GET** /api/v1/finance/commission-detail | 佣金明细
[**invitee_order_stats_api_v1_finance_invitee_order_stats_get**](FinanceDistributionApi.md#invitee_order_stats_api_v1_finance_invitee_order_stats_get) | **GET** /api/v1/finance/invitee-order-stats | 下级用户订单统计
[**invitee_stats_api_v1_finance_invitee_stats_get**](FinanceDistributionApi.md#invitee_stats_api_v1_finance_invitee_stats_get) | **GET** /api/v1/finance/invitee-stats | 邀请统计
[**list_subordinates_api_v1_finance_subordinates_get**](FinanceDistributionApi.md#list_subordinates_api_v1_finance_subordinates_get) | **GET** /api/v1/finance/subordinates | 我的下级用户列表
[**list_team_api_v1_finance_team_get**](FinanceDistributionApi.md#list_team_api_v1_finance_team_get) | **GET** /api/v1/finance/team | 我的团队（下属列表+搜索排序）
[**operator_data_card_api_v1_finance_operator_card_get**](FinanceDistributionApi.md#operator_data_card_api_v1_finance_operator_card_get) | **GET** /api/v1/finance/operator-card | 操盘手数据卡片统计
[**team_center_api_v1_finance_team_center_get**](FinanceDistributionApi.md#team_center_api_v1_finance_team_center_get) | **GET** /api/v1/finance/team/center | 个人中心我的团队（概要）
[**user_and_children_orders_api_v1_finance_user_and_children_orders_get**](FinanceDistributionApi.md#user_and_children_orders_api_v1_finance_user_and_children_orders_get) | **GET** /api/v1/finance/user-and-children-orders | 用户及下级的订单列表


# **commission_detail_api_v1_finance_commission_detail_get**
> object commission_detail_api_v1_finance_commission_detail_get(page=page, limit=limit)

佣金明细

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
    api_instance = zhs_api.FinanceDistributionApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 佣金明细
        api_response = api_instance.commission_detail_api_v1_finance_commission_detail_get(page=page, limit=limit)
        print("The response of FinanceDistributionApi->commission_detail_api_v1_finance_commission_detail_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceDistributionApi->commission_detail_api_v1_finance_commission_detail_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **invitee_order_stats_api_v1_finance_invitee_order_stats_get**
> object invitee_order_stats_api_v1_finance_invitee_order_stats_get(page=page, limit=limit)

下级用户订单统计

Mirrors Java getUserInviteeOrderStats.

For each invitee, return their order count, total amount, and latest order time.

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
    api_instance = zhs_api.FinanceDistributionApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 下级用户订单统计
        api_response = api_instance.invitee_order_stats_api_v1_finance_invitee_order_stats_get(page=page, limit=limit)
        print("The response of FinanceDistributionApi->invitee_order_stats_api_v1_finance_invitee_order_stats_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceDistributionApi->invitee_order_stats_api_v1_finance_invitee_order_stats_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **invitee_stats_api_v1_finance_invitee_stats_get**
> object invitee_stats_api_v1_finance_invitee_stats_get()

邀请统计

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
    api_instance = zhs_api.FinanceDistributionApi(api_client)

    try:
        # 邀请统计
        api_response = api_instance.invitee_stats_api_v1_finance_invitee_stats_get()
        print("The response of FinanceDistributionApi->invitee_stats_api_v1_finance_invitee_stats_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceDistributionApi->invitee_stats_api_v1_finance_invitee_stats_get: %s\n" % e)
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

# **list_subordinates_api_v1_finance_subordinates_get**
> object list_subordinates_api_v1_finance_subordinates_get(page=page, limit=limit)

我的下级用户列表

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
    api_instance = zhs_api.FinanceDistributionApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 我的下级用户列表
        api_response = api_instance.list_subordinates_api_v1_finance_subordinates_get(page=page, limit=limit)
        print("The response of FinanceDistributionApi->list_subordinates_api_v1_finance_subordinates_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceDistributionApi->list_subordinates_api_v1_finance_subordinates_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **list_team_api_v1_finance_team_get**
> object list_team_api_v1_finance_team_get(page=page, limit=limit, keyword=keyword, sort_by=sort_by, sort_order=sort_order)

我的团队（下属列表+搜索排序）

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
    api_instance = zhs_api.FinanceDistributionApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    keyword = 'keyword_example' # str | 搜索关键词（昵称/UUID） (optional)
    sort_by = 'created_at' # str | 排序字段: created_at / is_vip (optional) (default to 'created_at')
    sort_order = 'desc' # str | 排序方向: asc / desc (optional) (default to 'desc')

    try:
        # 我的团队（下属列表+搜索排序）
        api_response = api_instance.list_team_api_v1_finance_team_get(page=page, limit=limit, keyword=keyword, sort_by=sort_by, sort_order=sort_order)
        print("The response of FinanceDistributionApi->list_team_api_v1_finance_team_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceDistributionApi->list_team_api_v1_finance_team_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **keyword** | **str**| 搜索关键词（昵称/UUID） | [optional] 
 **sort_by** | **str**| 排序字段: created_at / is_vip | [optional] [default to &#39;created_at&#39;]
 **sort_order** | **str**| 排序方向: asc / desc | [optional] [default to &#39;desc&#39;]

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

# **operator_data_card_api_v1_finance_operator_card_get**
> object operator_data_card_api_v1_finance_operator_card_get()

操盘手数据卡片统计

Mirrors Java getOperatorDataCardData.

Returns commission stats (today/month/total), order stats of invitees,
invited user counts, and withdrawal stats.

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
    api_instance = zhs_api.FinanceDistributionApi(api_client)

    try:
        # 操盘手数据卡片统计
        api_response = api_instance.operator_data_card_api_v1_finance_operator_card_get()
        print("The response of FinanceDistributionApi->operator_data_card_api_v1_finance_operator_card_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceDistributionApi->operator_data_card_api_v1_finance_operator_card_get: %s\n" % e)
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

# **team_center_api_v1_finance_team_center_get**
> object team_center_api_v1_finance_team_center_get()

个人中心我的团队（概要）

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
    api_instance = zhs_api.FinanceDistributionApi(api_client)

    try:
        # 个人中心我的团队（概要）
        api_response = api_instance.team_center_api_v1_finance_team_center_get()
        print("The response of FinanceDistributionApi->team_center_api_v1_finance_team_center_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceDistributionApi->team_center_api_v1_finance_team_center_get: %s\n" % e)
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

# **user_and_children_orders_api_v1_finance_user_and_children_orders_get**
> object user_and_children_orders_api_v1_finance_user_and_children_orders_get(page=page, limit=limit)

用户及下级的订单列表

Mirrors Java getUserAndChildrenOrders.

Returns orders from the current user AND all invitees, paginated.

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
    api_instance = zhs_api.FinanceDistributionApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 用户及下级的订单列表
        api_response = api_instance.user_and_children_orders_api_v1_finance_user_and_children_orders_get(page=page, limit=limit)
        print("The response of FinanceDistributionApi->user_and_children_orders_api_v1_finance_user_and_children_orders_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceDistributionApi->user_and_children_orders_api_v1_finance_user_and_children_orders_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

