# zhs_api.UsernameLoginApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**login_by_username_api_v1_login_username_post**](UsernameLoginApi.md#login_by_username_api_v1_login_username_post) | **POST** /api/v1/login/username | 用户名密码登录 (内置 admin/ry)


# **login_by_username_api_v1_login_username_post**
> object login_by_username_api_v1_login_username_post(username, password)

用户名密码登录 (内置 admin/ry)

前端演示登录: 用户名 + 密码, 返回 JWT + 用户信息.

对应 Java: AdminLoginController.login (若依版).

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
    api_instance = zhs_api.UsernameLoginApi(api_client)
    username = 'username_example' # str | 用户名 (admin / ry)
    password = 'password_example' # str | 明文密码

    try:
        # 用户名密码登录 (内置 admin/ry)
        api_response = api_instance.login_by_username_api_v1_login_username_post(username, password)
        print("The response of UsernameLoginApi->login_by_username_api_v1_login_username_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UsernameLoginApi->login_by_username_api_v1_login_username_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **username** | **str**| 用户名 (admin / ry) | 
 **password** | **str**| 明文密码 | 

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

