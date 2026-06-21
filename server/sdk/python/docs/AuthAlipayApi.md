# zhs_api.AuthAlipayApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ali_pc_wx_code_api_v1_auth_login_ali_pc_wx_code_get**](AuthAlipayApi.md#ali_pc_wx_code_api_v1_auth_login_ali_pc_wx_code_get) | **GET** /api/v1/auth/login/ali/pc/wxCode | Ali Pc Wx Code
[**ali_web_wx_code_api_v1_auth_login_ali_web_wx_code_get**](AuthAlipayApi.md#ali_web_wx_code_api_v1_auth_login_ali_web_wx_code_get) | **GET** /api/v1/auth/login/ali/web/wxCode | Ali Web Wx Code


# **ali_pc_wx_code_api_v1_auth_login_ali_pc_wx_code_get**
> object ali_pc_wx_code_api_v1_auth_login_ali_pc_wx_code_get(code)

Ali Pc Wx Code

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
    api_instance = zhs_api.AuthAlipayApi(api_client)
    code = 'code_example' # str | Alipay auth code

    try:
        # Ali Pc Wx Code
        api_response = api_instance.ali_pc_wx_code_api_v1_auth_login_ali_pc_wx_code_get(code)
        print("The response of AuthAlipayApi->ali_pc_wx_code_api_v1_auth_login_ali_pc_wx_code_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthAlipayApi->ali_pc_wx_code_api_v1_auth_login_ali_pc_wx_code_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**| Alipay auth code | 

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

# **ali_web_wx_code_api_v1_auth_login_ali_web_wx_code_get**
> object ali_web_wx_code_api_v1_auth_login_ali_web_wx_code_get(auth_code)

Ali Web Wx Code

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
    api_instance = zhs_api.AuthAlipayApi(api_client)
    auth_code = 'auth_code_example' # str | Alipay web auth code

    try:
        # Ali Web Wx Code
        api_response = api_instance.ali_web_wx_code_api_v1_auth_login_ali_web_wx_code_get(auth_code)
        print("The response of AuthAlipayApi->ali_web_wx_code_api_v1_auth_login_ali_web_wx_code_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthAlipayApi->ali_web_wx_code_api_v1_auth_login_ali_web_wx_code_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **auth_code** | **str**| Alipay web auth code | 

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

