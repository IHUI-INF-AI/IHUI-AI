# zhs_api.AuthFeishuApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**feishu_pc_test_api_v1_auth_login_feishu_pc_test_get**](AuthFeishuApi.md#feishu_pc_test_api_v1_auth_login_feishu_pc_test_get) | **GET** /api/v1/auth/login/feishu/pc/test | Feishu Pc Test
[**feishu_pc_wx_code_api_v1_auth_login_feishu_pc_wx_code_get**](AuthFeishuApi.md#feishu_pc_wx_code_api_v1_auth_login_feishu_pc_wx_code_get) | **GET** /api/v1/auth/login/feishu/pc/wxCode | Feishu Pc Wx Code


# **feishu_pc_test_api_v1_auth_login_feishu_pc_test_get**
> object feishu_pc_test_api_v1_auth_login_feishu_pc_test_get(code)

Feishu Pc Test

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
    api_instance = zhs_api.AuthFeishuApi(api_client)
    code = 'code_example' # str | test code

    try:
        # Feishu Pc Test
        api_response = api_instance.feishu_pc_test_api_v1_auth_login_feishu_pc_test_get(code)
        print("The response of AuthFeishuApi->feishu_pc_test_api_v1_auth_login_feishu_pc_test_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthFeishuApi->feishu_pc_test_api_v1_auth_login_feishu_pc_test_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**| test code | 

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

# **feishu_pc_wx_code_api_v1_auth_login_feishu_pc_wx_code_get**
> object feishu_pc_wx_code_api_v1_auth_login_feishu_pc_wx_code_get(code)

Feishu Pc Wx Code

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
    api_instance = zhs_api.AuthFeishuApi(api_client)
    code = 'code_example' # str | Feishu auth code

    try:
        # Feishu Pc Wx Code
        api_response = api_instance.feishu_pc_wx_code_api_v1_auth_login_feishu_pc_wx_code_get(code)
        print("The response of AuthFeishuApi->feishu_pc_wx_code_api_v1_auth_login_feishu_pc_wx_code_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthFeishuApi->feishu_pc_wx_code_api_v1_auth_login_feishu_pc_wx_code_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**| Feishu auth code | 

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

