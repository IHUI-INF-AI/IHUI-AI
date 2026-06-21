# zhs_api.AIGCApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_aigc_api_v1_content_aigc_post**](AIGCApi.md#create_aigc_api_v1_content_aigc_post) | **POST** /api/v1/content/aigc | Create AIGC record
[**delete_aigc_api_v1_content_aigc_item_ids_delete**](AIGCApi.md#delete_aigc_api_v1_content_aigc_item_ids_delete) | **DELETE** /api/v1/content/aigc/{item_ids} | Delete AIGC records
[**get_aigc_api_v1_content_aigc_item_id_get**](AIGCApi.md#get_aigc_api_v1_content_aigc_item_id_get) | **GET** /api/v1/content/aigc/{item_id} | Get AIGC detail
[**list_aigc_api_v1_content_aigc_list_get**](AIGCApi.md#list_aigc_api_v1_content_aigc_list_get) | **GET** /api/v1/content/aigc/list | List AIGC records
[**update_aigc_api_v1_content_aigc_put**](AIGCApi.md#update_aigc_api_v1_content_aigc_put) | **PUT** /api/v1/content/aigc | Update AIGC record


# **create_aigc_api_v1_content_aigc_post**
> object create_aigc_api_v1_content_aigc_post(ai_gc_create)

Create AIGC record

### Example


```python
import zhs_api
from zhs_api.models.ai_gc_create import AiGcCreate
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
    api_instance = zhs_api.AIGCApi(api_client)
    ai_gc_create = zhs_api.AiGcCreate() # AiGcCreate | 

    try:
        # Create AIGC record
        api_response = api_instance.create_aigc_api_v1_content_aigc_post(ai_gc_create)
        print("The response of AIGCApi->create_aigc_api_v1_content_aigc_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIGCApi->create_aigc_api_v1_content_aigc_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ai_gc_create** | [**AiGcCreate**](AiGcCreate.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_aigc_api_v1_content_aigc_item_ids_delete**
> object delete_aigc_api_v1_content_aigc_item_ids_delete(item_ids)

Delete AIGC records

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
    api_instance = zhs_api.AIGCApi(api_client)
    item_ids = 'item_ids_example' # str | 

    try:
        # Delete AIGC records
        api_response = api_instance.delete_aigc_api_v1_content_aigc_item_ids_delete(item_ids)
        print("The response of AIGCApi->delete_aigc_api_v1_content_aigc_item_ids_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIGCApi->delete_aigc_api_v1_content_aigc_item_ids_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **item_ids** | **str**|  | 

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

# **get_aigc_api_v1_content_aigc_item_id_get**
> object get_aigc_api_v1_content_aigc_item_id_get(item_id)

Get AIGC detail

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
    api_instance = zhs_api.AIGCApi(api_client)
    item_id = 56 # int | 

    try:
        # Get AIGC detail
        api_response = api_instance.get_aigc_api_v1_content_aigc_item_id_get(item_id)
        print("The response of AIGCApi->get_aigc_api_v1_content_aigc_item_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIGCApi->get_aigc_api_v1_content_aigc_item_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **item_id** | **int**|  | 

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

# **list_aigc_api_v1_content_aigc_list_get**
> object list_aigc_api_v1_content_aigc_list_get(page=page, limit=limit, user_uuid=user_uuid, gc_type=gc_type, status=status)

List AIGC records

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
    api_instance = zhs_api.AIGCApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_uuid = 'user_uuid_example' # str |  (optional)
    gc_type = 'gc_type_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # List AIGC records
        api_response = api_instance.list_aigc_api_v1_content_aigc_list_get(page=page, limit=limit, user_uuid=user_uuid, gc_type=gc_type, status=status)
        print("The response of AIGCApi->list_aigc_api_v1_content_aigc_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIGCApi->list_aigc_api_v1_content_aigc_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_uuid** | **str**|  | [optional] 
 **gc_type** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 

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

# **update_aigc_api_v1_content_aigc_put**
> object update_aigc_api_v1_content_aigc_put(ai_gc_update)

Update AIGC record

### Example


```python
import zhs_api
from zhs_api.models.ai_gc_update import AiGcUpdate
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
    api_instance = zhs_api.AIGCApi(api_client)
    ai_gc_update = zhs_api.AiGcUpdate() # AiGcUpdate | 

    try:
        # Update AIGC record
        api_response = api_instance.update_aigc_api_v1_content_aigc_put(ai_gc_update)
        print("The response of AIGCApi->update_aigc_api_v1_content_aigc_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIGCApi->update_aigc_api_v1_content_aigc_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ai_gc_update** | [**AiGcUpdate**](AiGcUpdate.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

