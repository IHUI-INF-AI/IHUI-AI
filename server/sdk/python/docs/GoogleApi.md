# zhs_api.GoogleApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**android_wx_code_api_v1_auth_google_android_wx_code_get**](GoogleApi.md#android_wx_code_api_v1_auth_google_android_wx_code_get) | **GET** /api/v1/auth/google/android/wxCode | Google Android 登录 (id_token 直接登录)
[**google_config_status_api_v1_auth_google_config_get**](GoogleApi.md#google_config_status_api_v1_auth_google_config_get) | **GET** /api/v1/auth/google/config | 返回当前 Google OAuth 配置 (脱敏)
[**pc_wx_code_api_v1_auth_google_pc_wx_code_get**](GoogleApi.md#pc_wx_code_api_v1_auth_google_pc_wx_code_get) | **GET** /api/v1/auth/google/pc/wxCode | Google PC 登录 (用 code 换 token)


# **android_wx_code_api_v1_auth_google_android_wx_code_get**
> object android_wx_code_api_v1_auth_google_android_wx_code_get(id_token)

Google Android 登录 (id_token 直接登录)

对应 Java: GET /google/android/wxCode?id_token=

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
    api_instance = zhs_api.GoogleApi(api_client)
    id_token = 'id_token_example' # str | Google id_token

    try:
        # Google Android 登录 (id_token 直接登录)
        api_response = api_instance.android_wx_code_api_v1_auth_google_android_wx_code_get(id_token)
        print("The response of GoogleApi->android_wx_code_api_v1_auth_google_android_wx_code_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling GoogleApi->android_wx_code_api_v1_auth_google_android_wx_code_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id_token** | **str**| Google id_token | 

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

# **google_config_status_api_v1_auth_google_config_get**
> object google_config_status_api_v1_auth_google_config_get()

返回当前 Google OAuth 配置 (脱敏)

运维端点, 用于确认配置是否加载.

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
    api_instance = zhs_api.GoogleApi(api_client)

    try:
        # 返回当前 Google OAuth 配置 (脱敏)
        api_response = api_instance.google_config_status_api_v1_auth_google_config_get()
        print("The response of GoogleApi->google_config_status_api_v1_auth_google_config_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling GoogleApi->google_config_status_api_v1_auth_google_config_get: %s\n" % e)
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

# **pc_wx_code_api_v1_auth_google_pc_wx_code_get**
> object pc_wx_code_api_v1_auth_google_pc_wx_code_get(code)

Google PC 登录 (用 code 换 token)

对应 Java: GET /google/pc/wxCode?code=

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
    api_instance = zhs_api.GoogleApi(api_client)
    code = 'code_example' # str | Google 授权码

    try:
        # Google PC 登录 (用 code 换 token)
        api_response = api_instance.pc_wx_code_api_v1_auth_google_pc_wx_code_get(code)
        print("The response of GoogleApi->pc_wx_code_api_v1_auth_google_pc_wx_code_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling GoogleApi->pc_wx_code_api_v1_auth_google_pc_wx_code_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**| Google 授权码 | 

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

