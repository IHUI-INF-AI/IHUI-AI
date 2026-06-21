# zhs_api.FinanceCommissionApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**list_orders_api_v1_finance_orders_get**](FinanceCommissionApi.md#list_orders_api_v1_finance_orders_get) | **GET** /api/v1/finance/orders | 我的订单列表（分页+筛选）
[**settle_commission_api_v1_finance_settle_commission_id_post**](FinanceCommissionApi.md#settle_commission_api_v1_finance_settle_commission_id_post) | **POST** /api/v1/finance/settle/{commission_id} | 手动结算佣金流水


# **list_orders_api_v1_finance_orders_get**
> object list_orders_api_v1_finance_orders_get(page=page, limit=limit, order_type=order_type, status=status)

我的订单列表（分页+筛选）

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
    api_instance = zhs_api.FinanceCommissionApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    order_type = 56 # int | 订单类型：0=token 1=activity 2=identity 3=agent (optional)
    status = 56 # int | 订单状态：0=待支付 1=已支付 2=已退款 3=已取消 (optional)

    try:
        # 我的订单列表（分页+筛选）
        api_response = api_instance.list_orders_api_v1_finance_orders_get(page=page, limit=limit, order_type=order_type, status=status)
        print("The response of FinanceCommissionApi->list_orders_api_v1_finance_orders_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceCommissionApi->list_orders_api_v1_finance_orders_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **order_type** | **int**| 订单类型：0&#x3D;token 1&#x3D;activity 2&#x3D;identity 3&#x3D;agent | [optional] 
 **status** | **int**| 订单状态：0&#x3D;待支付 1&#x3D;已支付 2&#x3D;已退款 3&#x3D;已取消 | [optional] 

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

# **settle_commission_api_v1_finance_settle_commission_id_post**
> object settle_commission_api_v1_finance_settle_commission_id_post(commission_id)

手动结算佣金流水

Mirrors Java updateByIdToSettle: manually mark a commission flow as settled (type=1).

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
    api_instance = zhs_api.FinanceCommissionApi(api_client)
    commission_id = 56 # int | 

    try:
        # 手动结算佣金流水
        api_response = api_instance.settle_commission_api_v1_finance_settle_commission_id_post(commission_id)
        print("The response of FinanceCommissionApi->settle_commission_api_v1_finance_settle_commission_id_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceCommissionApi->settle_commission_api_v1_finance_settle_commission_id_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commission_id** | **int**|  | 

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

