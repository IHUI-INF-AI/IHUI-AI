# zhs_api.CozeWorkspacesApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_members_api_v1_coze_workspaces_workspaces_members_create_post**](CozeWorkspacesApi.md#create_members_api_v1_coze_workspaces_workspaces_members_create_post) | **POST** /api/v1/coze/workspaces/workspaces/members/create | Create Members
[**delete_members_api_v1_coze_workspaces_workspaces_members_delete_post**](CozeWorkspacesApi.md#delete_members_api_v1_coze_workspaces_workspaces_members_delete_post) | **POST** /api/v1/coze/workspaces/workspaces/members/delete | Delete Members
[**list_workspaces_api_v1_coze_workspaces_workspaces_list_get**](CozeWorkspacesApi.md#list_workspaces_api_v1_coze_workspaces_workspaces_list_get) | **GET** /api/v1/coze/workspaces/workspaces/list | List Workspaces


# **create_members_api_v1_coze_workspaces_workspaces_members_create_post**
> object create_members_api_v1_coze_workspaces_workspaces_members_create_post(members_req)

Create Members

### Example


```python
import zhs_api
from zhs_api.models.members_req import MembersReq
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
    api_instance = zhs_api.CozeWorkspacesApi(api_client)
    members_req = zhs_api.MembersReq() # MembersReq | 

    try:
        # Create Members
        api_response = api_instance.create_members_api_v1_coze_workspaces_workspaces_members_create_post(members_req)
        print("The response of CozeWorkspacesApi->create_members_api_v1_coze_workspaces_workspaces_members_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkspacesApi->create_members_api_v1_coze_workspaces_workspaces_members_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **members_req** | [**MembersReq**](MembersReq.md)|  | 

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

# **delete_members_api_v1_coze_workspaces_workspaces_members_delete_post**
> object delete_members_api_v1_coze_workspaces_workspaces_members_delete_post(delete_members_req)

Delete Members

### Example


```python
import zhs_api
from zhs_api.models.delete_members_req import DeleteMembersReq
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
    api_instance = zhs_api.CozeWorkspacesApi(api_client)
    delete_members_req = zhs_api.DeleteMembersReq() # DeleteMembersReq | 

    try:
        # Delete Members
        api_response = api_instance.delete_members_api_v1_coze_workspaces_workspaces_members_delete_post(delete_members_req)
        print("The response of CozeWorkspacesApi->delete_members_api_v1_coze_workspaces_workspaces_members_delete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkspacesApi->delete_members_api_v1_coze_workspaces_workspaces_members_delete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **delete_members_req** | [**DeleteMembersReq**](DeleteMembersReq.md)|  | 

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

# **list_workspaces_api_v1_coze_workspaces_workspaces_list_get**
> object list_workspaces_api_v1_coze_workspaces_workspaces_list_get(page=page, size=size)

List Workspaces

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
    api_instance = zhs_api.CozeWorkspacesApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List Workspaces
        api_response = api_instance.list_workspaces_api_v1_coze_workspaces_workspaces_list_get(page=page, size=size)
        print("The response of CozeWorkspacesApi->list_workspaces_api_v1_coze_workspaces_workspaces_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkspacesApi->list_workspaces_api_v1_coze_workspaces_workspaces_list_get: %s\n" % e)
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

