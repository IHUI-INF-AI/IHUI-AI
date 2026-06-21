# zhs_api.DeveloperLinkApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**assign_account_api_v1_developer_link_assign_account_put**](DeveloperLinkApi.md#assign_account_api_v1_developer_link_assign_account_put) | **PUT** /api/v1/developerLink/assignAccount | Assign Coze account to developer
[**create_developer_link_api_v1_developer_link_post**](DeveloperLinkApi.md#create_developer_link_api_v1_developer_link_post) | **POST** /api/v1/developerLink | Create developer link
[**delete_developer_links_api_v1_developer_link_item_ids_delete**](DeveloperLinkApi.md#delete_developer_links_api_v1_developer_link_item_ids_delete) | **DELETE** /api/v1/developerLink/{item_ids} | Delete developer links
[**get_developer_link_api_v1_developer_link_item_id_get**](DeveloperLinkApi.md#get_developer_link_api_v1_developer_link_item_id_get) | **GET** /api/v1/developerLink/{item_id} | Get developer link detail
[**list_developer_links_api_v1_developer_link_list_get**](DeveloperLinkApi.md#list_developer_links_api_v1_developer_link_list_get) | **GET** /api/v1/developerLink/list | List developer links
[**update_developer_link_api_v1_developer_link_put**](DeveloperLinkApi.md#update_developer_link_api_v1_developer_link_put) | **PUT** /api/v1/developerLink | Update developer link


# **assign_account_api_v1_developer_link_assign_account_put**
> object assign_account_api_v1_developer_link_assign_account_put(assign_account_request)

Assign Coze account to developer

Assign a Coze account to a developer link.

### Example


```python
import zhs_api
from zhs_api.models.assign_account_request import AssignAccountRequest
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
    api_instance = zhs_api.DeveloperLinkApi(api_client)
    assign_account_request = zhs_api.AssignAccountRequest() # AssignAccountRequest | 

    try:
        # Assign Coze account to developer
        api_response = api_instance.assign_account_api_v1_developer_link_assign_account_put(assign_account_request)
        print("The response of DeveloperLinkApi->assign_account_api_v1_developer_link_assign_account_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DeveloperLinkApi->assign_account_api_v1_developer_link_assign_account_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **assign_account_request** | [**AssignAccountRequest**](AssignAccountRequest.md)|  | 

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

# **create_developer_link_api_v1_developer_link_post**
> object create_developer_link_api_v1_developer_link_post(developer_link_create)

Create developer link

### Example


```python
import zhs_api
from zhs_api.models.developer_link_create import DeveloperLinkCreate
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
    api_instance = zhs_api.DeveloperLinkApi(api_client)
    developer_link_create = zhs_api.DeveloperLinkCreate() # DeveloperLinkCreate | 

    try:
        # Create developer link
        api_response = api_instance.create_developer_link_api_v1_developer_link_post(developer_link_create)
        print("The response of DeveloperLinkApi->create_developer_link_api_v1_developer_link_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DeveloperLinkApi->create_developer_link_api_v1_developer_link_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **developer_link_create** | [**DeveloperLinkCreate**](DeveloperLinkCreate.md)|  | 

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

# **delete_developer_links_api_v1_developer_link_item_ids_delete**
> object delete_developer_links_api_v1_developer_link_item_ids_delete(item_ids)

Delete developer links

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
    api_instance = zhs_api.DeveloperLinkApi(api_client)
    item_ids = 'item_ids_example' # str | 

    try:
        # Delete developer links
        api_response = api_instance.delete_developer_links_api_v1_developer_link_item_ids_delete(item_ids)
        print("The response of DeveloperLinkApi->delete_developer_links_api_v1_developer_link_item_ids_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DeveloperLinkApi->delete_developer_links_api_v1_developer_link_item_ids_delete: %s\n" % e)
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

# **get_developer_link_api_v1_developer_link_item_id_get**
> object get_developer_link_api_v1_developer_link_item_id_get(item_id)

Get developer link detail

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
    api_instance = zhs_api.DeveloperLinkApi(api_client)
    item_id = 56 # int | 

    try:
        # Get developer link detail
        api_response = api_instance.get_developer_link_api_v1_developer_link_item_id_get(item_id)
        print("The response of DeveloperLinkApi->get_developer_link_api_v1_developer_link_item_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DeveloperLinkApi->get_developer_link_api_v1_developer_link_item_id_get: %s\n" % e)
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

# **list_developer_links_api_v1_developer_link_list_get**
> object list_developer_links_api_v1_developer_link_list_get(page=page, limit=limit, user_id=user_id, status=status)

List developer links

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
    api_instance = zhs_api.DeveloperLinkApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_id = 'user_id_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # List developer links
        api_response = api_instance.list_developer_links_api_v1_developer_link_list_get(page=page, limit=limit, user_id=user_id, status=status)
        print("The response of DeveloperLinkApi->list_developer_links_api_v1_developer_link_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DeveloperLinkApi->list_developer_links_api_v1_developer_link_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_id** | **str**|  | [optional] 
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

# **update_developer_link_api_v1_developer_link_put**
> object update_developer_link_api_v1_developer_link_put(developer_link_update)

Update developer link

### Example


```python
import zhs_api
from zhs_api.models.developer_link_update import DeveloperLinkUpdate
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
    api_instance = zhs_api.DeveloperLinkApi(api_client)
    developer_link_update = zhs_api.DeveloperLinkUpdate() # DeveloperLinkUpdate | 

    try:
        # Update developer link
        api_response = api_instance.update_developer_link_api_v1_developer_link_put(developer_link_update)
        print("The response of DeveloperLinkApi->update_developer_link_api_v1_developer_link_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DeveloperLinkApi->update_developer_link_api_v1_developer_link_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **developer_link_update** | [**DeveloperLinkUpdate**](DeveloperLinkUpdate.md)|  | 

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

