# zhs_api.ContentContactApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**contact_add_api_v1_content_contact_post**](ContentContactApi.md#contact_add_api_v1_content_contact_post) | **POST** /api/v1/content/contact | Contact Add
[**contact_edit_api_v1_content_contact_put**](ContentContactApi.md#contact_edit_api_v1_content_contact_put) | **PUT** /api/v1/content/contact | Contact Edit
[**contact_get_info_api_v1_content_contact_item_id_get**](ContentContactApi.md#contact_get_info_api_v1_content_contact_item_id_get) | **GET** /api/v1/content/contact/{item_id} | Contact Get Info
[**contact_list_api_v1_content_contact_list_get**](ContentContactApi.md#contact_list_api_v1_content_contact_list_get) | **GET** /api/v1/content/contact/list | Contact List
[**contact_remove_api_v1_content_contact_item_ids_delete**](ContentContactApi.md#contact_remove_api_v1_content_contact_item_ids_delete) | **DELETE** /api/v1/content/contact/{item_ids} | Contact Remove


# **contact_add_api_v1_content_contact_post**
> object contact_add_api_v1_content_contact_post(contact_in)

Contact Add

Create new contact.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.contact_in import ContactIn
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
    api_instance = zhs_api.ContentContactApi(api_client)
    contact_in = zhs_api.ContactIn() # ContactIn | 

    try:
        # Contact Add
        api_response = api_instance.contact_add_api_v1_content_contact_post(contact_in)
        print("The response of ContentContactApi->contact_add_api_v1_content_contact_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentContactApi->contact_add_api_v1_content_contact_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **contact_in** | [**ContactIn**](ContactIn.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **contact_edit_api_v1_content_contact_put**
> object contact_edit_api_v1_content_contact_put(id, contact_in)

Contact Edit

Update contact.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.contact_in import ContactIn
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
    api_instance = zhs_api.ContentContactApi(api_client)
    id = 56 # int | 
    contact_in = zhs_api.ContactIn() # ContactIn | 

    try:
        # Contact Edit
        api_response = api_instance.contact_edit_api_v1_content_contact_put(id, contact_in)
        print("The response of ContentContactApi->contact_edit_api_v1_content_contact_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentContactApi->contact_edit_api_v1_content_contact_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int**|  | 
 **contact_in** | [**ContactIn**](ContactIn.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **contact_get_info_api_v1_content_contact_item_id_get**
> object contact_get_info_api_v1_content_contact_item_id_get(item_id)

Contact Get Info

Get contact detail by ID.

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
    api_instance = zhs_api.ContentContactApi(api_client)
    item_id = 56 # int | 

    try:
        # Contact Get Info
        api_response = api_instance.contact_get_info_api_v1_content_contact_item_id_get(item_id)
        print("The response of ContentContactApi->contact_get_info_api_v1_content_contact_item_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentContactApi->contact_get_info_api_v1_content_contact_item_id_get: %s\n" % e)
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

# **contact_list_api_v1_content_contact_list_get**
> object contact_list_api_v1_content_contact_list_get(page_num=page_num, page_size=page_size)

Contact List

List contacts with pagination.

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
    api_instance = zhs_api.ContentContactApi(api_client)
    page_num = 1 # int |  (optional) (default to 1)
    page_size = 10 # int |  (optional) (default to 10)

    try:
        # Contact List
        api_response = api_instance.contact_list_api_v1_content_contact_list_get(page_num=page_num, page_size=page_size)
        print("The response of ContentContactApi->contact_list_api_v1_content_contact_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentContactApi->contact_list_api_v1_content_contact_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page_num** | **int**|  | [optional] [default to 1]
 **page_size** | **int**|  | [optional] [default to 10]

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

# **contact_remove_api_v1_content_contact_item_ids_delete**
> object contact_remove_api_v1_content_contact_item_ids_delete(item_ids)

Contact Remove

Delete contacts by comma-separated IDs.

Fixed: Use parameterized queries to prevent SQL injection.
IDs are validated as integers before use.

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
    api_instance = zhs_api.ContentContactApi(api_client)
    item_ids = 'item_ids_example' # str | 

    try:
        # Contact Remove
        api_response = api_instance.contact_remove_api_v1_content_contact_item_ids_delete(item_ids)
        print("The response of ContentContactApi->contact_remove_api_v1_content_contact_item_ids_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentContactApi->contact_remove_api_v1_content_contact_item_ids_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **item_ids** | **str**|  | 

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

