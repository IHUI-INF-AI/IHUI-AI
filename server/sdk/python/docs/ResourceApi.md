# zhs_api.ResourceApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_agent_free_time_api_v1_resource_agent_free_time_post**](ResourceApi.md#add_agent_free_time_api_v1_resource_agent_free_time_post) | **POST** /api/v1/resource/agent/free-time | 添加用户 Agent 免费次数
[**create_share_api_v1_resource_share_post**](ResourceApi.md#create_share_api_v1_resource_share_post) | **POST** /api/v1/resource/share | 生成分享链接
[**developer_price_api_v1_resource_developer_price_get**](ResourceApi.md#developer_price_api_v1_resource_developer_price_get) | **GET** /api/v1/resource/developer/price | 查询 Agent 开发者价格
[**file_upload_api_v1_resource_file_upload_post**](ResourceApi.md#file_upload_api_v1_resource_file_upload_post) | **POST** /api/v1/resource/file/upload | 上传文件到 MinIO
[**get_agent_free_time_api_v1_resource_agent_free_time_get**](ResourceApi.md#get_agent_free_time_api_v1_resource_agent_free_time_get) | **GET** /api/v1/resource/agent/free-time | 获取用户 Agent 免费次数
[**get_coze_access_token_api_v1_resource_coze_access_token_get**](ResourceApi.md#get_coze_access_token_api_v1_resource_coze_access_token_get) | **GET** /api/v1/resource/coze-access-token | 获取 Coze AccessToken
[**goods_list_api_v1_resource_goods_get**](ResourceApi.md#goods_list_api_v1_resource_goods_get) | **GET** /api/v1/resource/goods | 商品及汇率列表
[**home_resources_api_v1_resource_home_get**](ResourceApi.md#home_resources_api_v1_resource_home_get) | **GET** /api/v1/resource/home | 首页资源聚合
[**planets_course_api_v1_resource_planets_course_get**](ResourceApi.md#planets_course_api_v1_resource_planets_course_get) | **GET** /api/v1/resource/planets/course | 课程星球列表
[**planets_knowledge_api_v1_resource_planets_knowledge_get**](ResourceApi.md#planets_knowledge_api_v1_resource_planets_knowledge_get) | **GET** /api/v1/resource/planets/knowledge | 知识星球列表
[**recharge_check_api_v1_resource_recharge_get**](ResourceApi.md#recharge_check_api_v1_resource_recharge_get) | **GET** /api/v1/resource/recharge | 判断是否为会员
[**token_count_api_v1_resource_token_count_get**](ResourceApi.md#token_count_api_v1_resource_token_count_get) | **GET** /api/v1/resource/token/count | 获取用户 token 余量


# **add_agent_free_time_api_v1_resource_agent_free_time_post**
> object add_agent_free_time_api_v1_resource_agent_free_time_post(agent_id, free_count)

添加用户 Agent 免费次数

为指定用户增加 Agent 免费使用次数。

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
    api_instance = zhs_api.ResourceApi(api_client)
    agent_id = 'agent_id_example' # str | Agent ID
    free_count = 56 # int | 免费次数

    try:
        # 添加用户 Agent 免费次数
        api_response = api_instance.add_agent_free_time_api_v1_resource_agent_free_time_post(agent_id, free_count)
        print("The response of ResourceApi->add_agent_free_time_api_v1_resource_agent_free_time_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->add_agent_free_time_api_v1_resource_agent_free_time_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**| Agent ID | 
 **free_count** | **int**| 免费次数 | 

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

# **create_share_api_v1_resource_share_post**
> object create_share_api_v1_resource_share_post(target_type, target_id)

生成分享链接

生成一次性分享 token 短链。

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
    api_instance = zhs_api.ResourceApi(api_client)
    target_type = 'target_type_example' # str | agent/course/chat
    target_id = 'target_id_example' # str | 

    try:
        # 生成分享链接
        api_response = api_instance.create_share_api_v1_resource_share_post(target_type, target_id)
        print("The response of ResourceApi->create_share_api_v1_resource_share_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->create_share_api_v1_resource_share_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **target_type** | **str**| agent/course/chat | 
 **target_id** | **str**|  | 

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

# **developer_price_api_v1_resource_developer_price_get**
> object developer_price_api_v1_resource_developer_price_get(agent_id)

查询 Agent 开发者价格

返回该 Agent 的开发者列表及价格档位。

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.ResourceApi(api_client)
    agent_id = 'agent_id_example' # str | 

    try:
        # 查询 Agent 开发者价格
        api_response = api_instance.developer_price_api_v1_resource_developer_price_get(agent_id)
        print("The response of ResourceApi->developer_price_api_v1_resource_developer_price_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->developer_price_api_v1_resource_developer_price_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **file_upload_api_v1_resource_file_upload_post**
> object file_upload_api_v1_resource_file_upload_post(file, bucket=bucket)

上传文件到 MinIO

上传文件，返回可访问的 URL。

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
    api_instance = zhs_api.ResourceApi(api_client)
    file = None # bytes | 
    bucket = 'bucket_example' # str | 存储桶，不传则用默认 (optional)

    try:
        # 上传文件到 MinIO
        api_response = api_instance.file_upload_api_v1_resource_file_upload_post(file, bucket=bucket)
        print("The response of ResourceApi->file_upload_api_v1_resource_file_upload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->file_upload_api_v1_resource_file_upload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | **bytes**|  | 
 **bucket** | **str**| 存储桶，不传则用默认 | [optional] 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_agent_free_time_api_v1_resource_agent_free_time_get**
> object get_agent_free_time_api_v1_resource_agent_free_time_get(agent_id)

获取用户 Agent 免费次数

查询指定用户在指定 Agent 上剩余的免费次数。

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
    api_instance = zhs_api.ResourceApi(api_client)
    agent_id = 'agent_id_example' # str | Agent ID

    try:
        # 获取用户 Agent 免费次数
        api_response = api_instance.get_agent_free_time_api_v1_resource_agent_free_time_get(agent_id)
        print("The response of ResourceApi->get_agent_free_time_api_v1_resource_agent_free_time_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->get_agent_free_time_api_v1_resource_agent_free_time_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**| Agent ID | 

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

# **get_coze_access_token_api_v1_resource_coze_access_token_get**
> object get_coze_access_token_api_v1_resource_coze_access_token_get()

获取 Coze AccessToken

通过 Coze OAuth2 JWT 方式获取 access_token。

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
    api_instance = zhs_api.ResourceApi(api_client)

    try:
        # 获取 Coze AccessToken
        api_response = api_instance.get_coze_access_token_api_v1_resource_coze_access_token_get()
        print("The response of ResourceApi->get_coze_access_token_api_v1_resource_coze_access_token_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->get_coze_access_token_api_v1_resource_coze_access_token_get: %s\n" % e)
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

# **goods_list_api_v1_resource_goods_get**
> object goods_list_api_v1_resource_goods_get()

商品及汇率列表

查询 zhs_product 表全部商品以及 exchange_rate 汇率表。

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
    api_instance = zhs_api.ResourceApi(api_client)

    try:
        # 商品及汇率列表
        api_response = api_instance.goods_list_api_v1_resource_goods_get()
        print("The response of ResourceApi->goods_list_api_v1_resource_goods_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->goods_list_api_v1_resource_goods_get: %s\n" % e)
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

# **home_resources_api_v1_resource_home_get**
> object home_resources_api_v1_resource_home_get()

首页资源聚合

返回首页所需的全部资源：banner、推荐 Agent、热门课程、公告。

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
    api_instance = zhs_api.ResourceApi(api_client)

    try:
        # 首页资源聚合
        api_response = api_instance.home_resources_api_v1_resource_home_get()
        print("The response of ResourceApi->home_resources_api_v1_resource_home_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->home_resources_api_v1_resource_home_get: %s\n" % e)
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

# **planets_course_api_v1_resource_planets_course_get**
> object planets_course_api_v1_resource_planets_course_get()

课程星球列表

返回 type=course 的知识星球列表。

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
    api_instance = zhs_api.ResourceApi(api_client)

    try:
        # 课程星球列表
        api_response = api_instance.planets_course_api_v1_resource_planets_course_get()
        print("The response of ResourceApi->planets_course_api_v1_resource_planets_course_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->planets_course_api_v1_resource_planets_course_get: %s\n" % e)
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

# **planets_knowledge_api_v1_resource_planets_knowledge_get**
> object planets_knowledge_api_v1_resource_planets_knowledge_get()

知识星球列表

返回 type=knowledge 的知识星球列表。

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
    api_instance = zhs_api.ResourceApi(api_client)

    try:
        # 知识星球列表
        api_response = api_instance.planets_knowledge_api_v1_resource_planets_knowledge_get()
        print("The response of ResourceApi->planets_knowledge_api_v1_resource_planets_knowledge_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->planets_knowledge_api_v1_resource_planets_knowledge_get: %s\n" % e)
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

# **recharge_check_api_v1_resource_recharge_get**
> object recharge_check_api_v1_resource_recharge_get()

判断是否为会员

查询 user_vip 表判断当前用户是否为会员。

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
    api_instance = zhs_api.ResourceApi(api_client)

    try:
        # 判断是否为会员
        api_response = api_instance.recharge_check_api_v1_resource_recharge_get()
        print("The response of ResourceApi->recharge_check_api_v1_resource_recharge_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->recharge_check_api_v1_resource_recharge_get: %s\n" % e)
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

# **token_count_api_v1_resource_token_count_get**
> object token_count_api_v1_resource_token_count_get()

获取用户 token 余量

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
    api_instance = zhs_api.ResourceApi(api_client)

    try:
        # 获取用户 token 余量
        api_response = api_instance.token_count_api_v1_resource_token_count_get()
        print("The response of ResourceApi->token_count_api_v1_resource_token_count_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceApi->token_count_api_v1_resource_token_count_get: %s\n" % e)
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

