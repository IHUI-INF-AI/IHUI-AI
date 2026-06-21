# zhs_api.UsersApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_profile_api_v1_user_info_get**](UsersApi.md#get_profile_api_v1_user_info_get) | **GET** /api/v1/user/info | Get current user profile
[**update_profile_api_v1_user_update_put**](UsersApi.md#update_profile_api_v1_user_update_put) | **PUT** /api/v1/user/update | Update user profile


# **get_profile_api_v1_user_info_get**
> object get_profile_api_v1_user_info_get()

Get current user profile

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
    api_instance = zhs_api.UsersApi(api_client)

    try:
        # Get current user profile
        api_response = api_instance.get_profile_api_v1_user_info_get()
        print("The response of UsersApi->get_profile_api_v1_user_info_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UsersApi->get_profile_api_v1_user_info_get: %s\n" % e)
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

# **update_profile_api_v1_user_update_put**
> object update_profile_api_v1_user_update_put(nickname=nickname, avatar=avatar, gender=gender)

Update user profile

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
    api_instance = zhs_api.UsersApi(api_client)
    nickname = 'nickname_example' # str |  (optional)
    avatar = 'avatar_example' # str |  (optional)
    gender = 56 # int |  (optional)

    try:
        # Update user profile
        api_response = api_instance.update_profile_api_v1_user_update_put(nickname=nickname, avatar=avatar, gender=gender)
        print("The response of UsersApi->update_profile_api_v1_user_update_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UsersApi->update_profile_api_v1_user_update_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **nickname** | **str**|  | [optional] 
 **avatar** | **str**|  | [optional] 
 **gender** | **int**|  | [optional] 

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

