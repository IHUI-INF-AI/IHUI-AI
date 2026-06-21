# zhs_api.RemoteThirdApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**third_group_list_api_v1_remote_third_group_list_get**](RemoteThirdApi.md#third_group_list_api_v1_remote_third_group_list_get) | **GET** /api/v1/remote/third/group/list | Third Group List
[**third_group_list_api_v1_remote_third_group_list_get_0**](RemoteThirdApi.md#third_group_list_api_v1_remote_third_group_list_get_0) | **GET** /api/v1/remote/third/group/list | Third Group List


# **third_group_list_api_v1_remote_third_group_list_get**
> object third_group_list_api_v1_remote_third_group_list_get()

Third Group List

对应 Java: GET /remote/third/group/list — 不同榜单数据 (按 group 分组的排行).

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
    api_instance = zhs_api.RemoteThirdApi(api_client)

    try:
        # Third Group List
        api_response = api_instance.third_group_list_api_v1_remote_third_group_list_get()
        print("The response of RemoteThirdApi->third_group_list_api_v1_remote_third_group_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteThirdApi->third_group_list_api_v1_remote_third_group_list_get: %s\n" % e)
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

# **third_group_list_api_v1_remote_third_group_list_get_0**
> object third_group_list_api_v1_remote_third_group_list_get_0()

Third Group List

对应 Java: GET /remote/third/group/list — 不同榜单数据 (按 group 分组的排行).

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
    api_instance = zhs_api.RemoteThirdApi(api_client)

    try:
        # Third Group List
        api_response = api_instance.third_group_list_api_v1_remote_third_group_list_get_0()
        print("The response of RemoteThirdApi->third_group_list_api_v1_remote_third_group_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteThirdApi->third_group_list_api_v1_remote_third_group_list_get_0: %s\n" % e)
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

