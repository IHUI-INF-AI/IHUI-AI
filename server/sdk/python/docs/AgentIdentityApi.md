# zhs_api.AgentIdentityApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_identity_order_api_v1_agents_create_post**](AgentIdentityApi.md#create_identity_order_api_v1_agents_create_post) | **POST** /api/v1/agents/create | 创建身份订单
[**create_proportion_api_v1_agents_proportion_create_post**](AgentIdentityApi.md#create_proportion_api_v1_agents_proportion_create_post) | **POST** /api/v1/agents/proportion/create | 创建比例配置
[**list_identity_orders_api_v1_agents_list_get**](AgentIdentityApi.md#list_identity_orders_api_v1_agents_list_get) | **GET** /api/v1/agents/list | 身份订单列表
[**list_proportions_api_v1_agents_proportion_list_get**](AgentIdentityApi.md#list_proportions_api_v1_agents_proportion_list_get) | **GET** /api/v1/agents/proportion/list | 身份比例列表
[**update_proportion_api_v1_agents_proportion_proportion_id_put**](AgentIdentityApi.md#update_proportion_api_v1_agents_proportion_proportion_id_put) | **PUT** /api/v1/agents/proportion/{proportion_id} | 修改比例


# **create_identity_order_api_v1_agents_create_post**
> object create_identity_order_api_v1_agents_create_post(identity_id, pay_type=pay_type)

创建身份订单

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
    api_instance = zhs_api.AgentIdentityApi(api_client)
    identity_id = 'identity_id_example' # str | 产品身份ID
    pay_type = 'wechat' # str | 支付方式: wechat / alipay (optional) (default to 'wechat')

    try:
        # 创建身份订单
        api_response = api_instance.create_identity_order_api_v1_agents_create_post(identity_id, pay_type=pay_type)
        print("The response of AgentIdentityApi->create_identity_order_api_v1_agents_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentIdentityApi->create_identity_order_api_v1_agents_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **identity_id** | **str**| 产品身份ID | 
 **pay_type** | **str**| 支付方式: wechat / alipay | [optional] [default to &#39;wechat&#39;]

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

# **create_proportion_api_v1_agents_proportion_create_post**
> object create_proportion_api_v1_agents_proportion_create_post(identity_proportion_body)

创建比例配置

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.identity_proportion_body import IdentityProportionBody
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
    api_instance = zhs_api.AgentIdentityApi(api_client)
    identity_proportion_body = zhs_api.IdentityProportionBody() # IdentityProportionBody | 

    try:
        # 创建比例配置
        api_response = api_instance.create_proportion_api_v1_agents_proportion_create_post(identity_proportion_body)
        print("The response of AgentIdentityApi->create_proportion_api_v1_agents_proportion_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentIdentityApi->create_proportion_api_v1_agents_proportion_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **identity_proportion_body** | [**IdentityProportionBody**](IdentityProportionBody.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_identity_orders_api_v1_agents_list_get**
> object list_identity_orders_api_v1_agents_list_get(page=page, limit=limit, status=status, order_type=order_type)

身份订单列表

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
    api_instance = zhs_api.AgentIdentityApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int | 订单状态 0=待支付 1=已支付 2=已退款 3=已取消 (optional)
    order_type = 2 # int | 订单类型, 默认2=身份订单 (optional) (default to 2)

    try:
        # 身份订单列表
        api_response = api_instance.list_identity_orders_api_v1_agents_list_get(page=page, limit=limit, status=status, order_type=order_type)
        print("The response of AgentIdentityApi->list_identity_orders_api_v1_agents_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentIdentityApi->list_identity_orders_api_v1_agents_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**| 订单状态 0&#x3D;待支付 1&#x3D;已支付 2&#x3D;已退款 3&#x3D;已取消 | [optional] 
 **order_type** | **int**| 订单类型, 默认2&#x3D;身份订单 | [optional] [default to 2]

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

# **list_proportions_api_v1_agents_proportion_list_get**
> object list_proportions_api_v1_agents_proportion_list_get(page=page, limit=limit, status=status)

身份比例列表

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
    api_instance = zhs_api.AgentIdentityApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int | 0=stopped 1=active (optional)

    try:
        # 身份比例列表
        api_response = api_instance.list_proportions_api_v1_agents_proportion_list_get(page=page, limit=limit, status=status)
        print("The response of AgentIdentityApi->list_proportions_api_v1_agents_proportion_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentIdentityApi->list_proportions_api_v1_agents_proportion_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**| 0&#x3D;stopped 1&#x3D;active | [optional] 

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

# **update_proportion_api_v1_agents_proportion_proportion_id_put**
> object update_proportion_api_v1_agents_proportion_proportion_id_put(proportion_id, identity_proportion_body)

修改比例

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.identity_proportion_body import IdentityProportionBody
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
    api_instance = zhs_api.AgentIdentityApi(api_client)
    proportion_id = 'proportion_id_example' # str | 
    identity_proportion_body = zhs_api.IdentityProportionBody() # IdentityProportionBody | 

    try:
        # 修改比例
        api_response = api_instance.update_proportion_api_v1_agents_proportion_proportion_id_put(proportion_id, identity_proportion_body)
        print("The response of AgentIdentityApi->update_proportion_api_v1_agents_proportion_proportion_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentIdentityApi->update_proportion_api_v1_agents_proportion_proportion_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proportion_id** | **str**|  | 
 **identity_proportion_body** | [**IdentityProportionBody**](IdentityProportionBody.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

