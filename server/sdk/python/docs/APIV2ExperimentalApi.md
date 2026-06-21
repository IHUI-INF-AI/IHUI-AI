# zhs_api.APIV2ExperimentalApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**v2_info_api_v2_info_get**](APIV2ExperimentalApi.md#v2_info_api_v2_info_get) | **GET** /api/v2/info | v2 API 元数据
[**v2_login_api_v2_auth_login_post**](APIV2ExperimentalApi.md#v2_login_api_v2_auth_login_post) | **POST** /api/v2/auth/login | [v2] 用户名+密码登录 - 增强返回 refresh_token + expires_in + scope
[**v2_ping_api_v2_ping_get**](APIV2ExperimentalApi.md#v2_ping_api_v2_ping_get) | **GET** /api/v2/ping | v2 API ping


# **v2_info_api_v2_info_get**
> object v2_info_api_v2_info_get()

v2 API 元数据

返回 v2 API 元信息 (供客户端探测).

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
    api_instance = zhs_api.APIV2ExperimentalApi(api_client)

    try:
        # v2 API 元数据
        api_response = api_instance.v2_info_api_v2_info_get()
        print("The response of APIV2ExperimentalApi->v2_info_api_v2_info_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling APIV2ExperimentalApi->v2_info_api_v2_info_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **v2_login_api_v2_auth_login_post**
> object v2_login_api_v2_auth_login_post()

[v2] 用户名+密码登录 - 增强返回 refresh_token + expires_in + scope

v2 登录 - 完整版.

请求体: {"username": "xxx", "password": "xxx"} 或 query 参数
响应体: {"code": "0", "msg": "success", "data": {access_token, refresh_token, expires_in, scope, user}}

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
    api_instance = zhs_api.APIV2ExperimentalApi(api_client)

    try:
        # [v2] 用户名+密码登录 - 增强返回 refresh_token + expires_in + scope
        api_response = api_instance.v2_login_api_v2_auth_login_post()
        print("The response of APIV2ExperimentalApi->v2_login_api_v2_auth_login_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling APIV2ExperimentalApi->v2_login_api_v2_auth_login_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **v2_ping_api_v2_ping_get**
> object v2_ping_api_v2_ping_get()

v2 API ping

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
    api_instance = zhs_api.APIV2ExperimentalApi(api_client)

    try:
        # v2 API ping
        api_response = api_instance.v2_ping_api_v2_ping_get()
        print("The response of APIV2ExperimentalApi->v2_ping_api_v2_ping_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling APIV2ExperimentalApi->v2_ping_api_v2_ping_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

