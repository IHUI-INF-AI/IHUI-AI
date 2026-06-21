# zhs_api.CozeAppsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**list_api_apps_api_v1_coze_apps_apps_list_api_apps_get**](CozeAppsApi.md#list_api_apps_api_v1_coze_apps_apps_list_api_apps_get) | **GET** /api/v1/coze/apps/apps/list_api_apps | List Api Apps
[**list_app_events_api_v1_coze_apps_apps_events_get**](CozeAppsApi.md#list_app_events_api_v1_coze_apps_apps_events_get) | **GET** /api/v1/coze/apps/apps/events | List App Events
[**list_apps_api_v1_coze_apps_apps_list_get**](CozeAppsApi.md#list_apps_api_v1_coze_apps_apps_list_get) | **GET** /api/v1/coze/apps/apps/list | List Apps


# **list_api_apps_api_v1_coze_apps_apps_list_api_apps_get**
> object list_api_apps_api_v1_coze_apps_apps_list_api_apps_get(page=page, size=size)

List Api Apps

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
    api_instance = zhs_api.CozeAppsApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List Api Apps
        api_response = api_instance.list_api_apps_api_v1_coze_apps_apps_list_api_apps_get(page=page, size=size)
        print("The response of CozeAppsApi->list_api_apps_api_v1_coze_apps_apps_list_api_apps_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeAppsApi->list_api_apps_api_v1_coze_apps_apps_list_api_apps_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **list_app_events_api_v1_coze_apps_apps_events_get**
> object list_app_events_api_v1_coze_apps_apps_events_get(app_id, page=page, size=size)

List App Events

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
    api_instance = zhs_api.CozeAppsApi(api_client)
    app_id = 'app_id_example' # str | 
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List App Events
        api_response = api_instance.list_app_events_api_v1_coze_apps_apps_events_get(app_id, page=page, size=size)
        print("The response of CozeAppsApi->list_app_events_api_v1_coze_apps_apps_events_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeAppsApi->list_app_events_api_v1_coze_apps_apps_events_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **app_id** | **str**|  | 
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **list_apps_api_v1_coze_apps_apps_list_get**
> object list_apps_api_v1_coze_apps_apps_list_get(page=page, size=size)

List Apps

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
    api_instance = zhs_api.CozeAppsApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List Apps
        api_response = api_instance.list_apps_api_v1_coze_apps_apps_list_get(page=page, size=size)
        print("The response of CozeAppsApi->list_apps_api_v1_coze_apps_apps_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeAppsApi->list_apps_api_v1_coze_apps_apps_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

