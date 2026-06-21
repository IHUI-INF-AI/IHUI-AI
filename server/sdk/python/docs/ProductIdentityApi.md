# zhs_api.ProductIdentityApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_product_identity_api_v1_product_identity_post**](ProductIdentityApi.md#create_product_identity_api_v1_product_identity_post) | **POST** /api/v1/product_identity | Create product identity
[**delete_product_identities_api_v1_product_identity_item_ids_delete**](ProductIdentityApi.md#delete_product_identities_api_v1_product_identity_item_ids_delete) | **DELETE** /api/v1/product_identity/{item_ids} | Delete product identities
[**get_product_identity_api_v1_product_identity_item_id_get**](ProductIdentityApi.md#get_product_identity_api_v1_product_identity_item_id_get) | **GET** /api/v1/product_identity/{item_id} | Get product identity detail
[**list_product_identities_api_v1_product_identity_list_get**](ProductIdentityApi.md#list_product_identities_api_v1_product_identity_list_get) | **GET** /api/v1/product_identity/list | List product identities
[**update_product_identity_api_v1_product_identity_put**](ProductIdentityApi.md#update_product_identity_api_v1_product_identity_put) | **PUT** /api/v1/product_identity | Update product identity


# **create_product_identity_api_v1_product_identity_post**
> object create_product_identity_api_v1_product_identity_post(product_identity_create)

Create product identity

### Example


```python
import zhs_api
from zhs_api.models.product_identity_create import ProductIdentityCreate
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
    api_instance = zhs_api.ProductIdentityApi(api_client)
    product_identity_create = zhs_api.ProductIdentityCreate() # ProductIdentityCreate | 

    try:
        # Create product identity
        api_response = api_instance.create_product_identity_api_v1_product_identity_post(product_identity_create)
        print("The response of ProductIdentityApi->create_product_identity_api_v1_product_identity_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ProductIdentityApi->create_product_identity_api_v1_product_identity_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **product_identity_create** | [**ProductIdentityCreate**](ProductIdentityCreate.md)|  | 

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

# **delete_product_identities_api_v1_product_identity_item_ids_delete**
> object delete_product_identities_api_v1_product_identity_item_ids_delete(item_ids)

Delete product identities

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
    api_instance = zhs_api.ProductIdentityApi(api_client)
    item_ids = 'item_ids_example' # str | 

    try:
        # Delete product identities
        api_response = api_instance.delete_product_identities_api_v1_product_identity_item_ids_delete(item_ids)
        print("The response of ProductIdentityApi->delete_product_identities_api_v1_product_identity_item_ids_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ProductIdentityApi->delete_product_identities_api_v1_product_identity_item_ids_delete: %s\n" % e)
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

# **get_product_identity_api_v1_product_identity_item_id_get**
> object get_product_identity_api_v1_product_identity_item_id_get(item_id)

Get product identity detail

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
    api_instance = zhs_api.ProductIdentityApi(api_client)
    item_id = 'item_id_example' # str | 

    try:
        # Get product identity detail
        api_response = api_instance.get_product_identity_api_v1_product_identity_item_id_get(item_id)
        print("The response of ProductIdentityApi->get_product_identity_api_v1_product_identity_item_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ProductIdentityApi->get_product_identity_api_v1_product_identity_item_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **item_id** | **str**|  | 

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

# **list_product_identities_api_v1_product_identity_list_get**
> object list_product_identities_api_v1_product_identity_list_get(page=page, limit=limit, name=name, identity_type=identity_type, status=status)

List product identities

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
    api_instance = zhs_api.ProductIdentityApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    name = 'name_example' # str |  (optional)
    identity_type = 'identity_type_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # List product identities
        api_response = api_instance.list_product_identities_api_v1_product_identity_list_get(page=page, limit=limit, name=name, identity_type=identity_type, status=status)
        print("The response of ProductIdentityApi->list_product_identities_api_v1_product_identity_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ProductIdentityApi->list_product_identities_api_v1_product_identity_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **name** | **str**|  | [optional] 
 **identity_type** | **str**|  | [optional] 
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

# **update_product_identity_api_v1_product_identity_put**
> object update_product_identity_api_v1_product_identity_put(product_identity_update)

Update product identity

### Example


```python
import zhs_api
from zhs_api.models.product_identity_update import ProductIdentityUpdate
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
    api_instance = zhs_api.ProductIdentityApi(api_client)
    product_identity_update = zhs_api.ProductIdentityUpdate() # ProductIdentityUpdate | 

    try:
        # Update product identity
        api_response = api_instance.update_product_identity_api_v1_product_identity_put(product_identity_update)
        print("The response of ProductIdentityApi->update_product_identity_api_v1_product_identity_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ProductIdentityApi->update_product_identity_api_v1_product_identity_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **product_identity_update** | [**ProductIdentityUpdate**](ProductIdentityUpdate.md)|  | 

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

