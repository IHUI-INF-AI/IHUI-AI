# zhs_api.OrganizationApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_member_api_v1_organization_oid_member_post**](OrganizationApi.md#add_member_api_v1_organization_oid_member_post) | **POST** /api/v1/organization/{oid}/member | 添加成员
[**add_member_api_v1_organization_oid_member_post_0**](OrganizationApi.md#add_member_api_v1_organization_oid_member_post_0) | **POST** /api/v1/organization/{oid}/member | 添加成员
[**create_organization_api_v1_organization_post**](OrganizationApi.md#create_organization_api_v1_organization_post) | **POST** /api/v1/organization | 创建组织
[**create_organization_api_v1_organization_post_0**](OrganizationApi.md#create_organization_api_v1_organization_post_0) | **POST** /api/v1/organization | 创建组织
[**delete_organization_api_v1_organization_oid_delete**](OrganizationApi.md#delete_organization_api_v1_organization_oid_delete) | **DELETE** /api/v1/organization/{oid} | 删除组织
[**delete_organization_api_v1_organization_oid_delete_0**](OrganizationApi.md#delete_organization_api_v1_organization_oid_delete_0) | **DELETE** /api/v1/organization/{oid} | 删除组织
[**get_organization_api_v1_organization_oid_get**](OrganizationApi.md#get_organization_api_v1_organization_oid_get) | **GET** /api/v1/organization/{oid} | 组织详情
[**get_organization_api_v1_organization_oid_get_0**](OrganizationApi.md#get_organization_api_v1_organization_oid_get_0) | **GET** /api/v1/organization/{oid} | 组织详情
[**list_members_api_v1_organization_oid_members_get**](OrganizationApi.md#list_members_api_v1_organization_oid_members_get) | **GET** /api/v1/organization/{oid}/members | 组织成员
[**list_members_api_v1_organization_oid_members_get_0**](OrganizationApi.md#list_members_api_v1_organization_oid_members_get_0) | **GET** /api/v1/organization/{oid}/members | 组织成员
[**list_organizations_api_v1_organization_list_get**](OrganizationApi.md#list_organizations_api_v1_organization_list_get) | **GET** /api/v1/organization/list | 组织列表
[**list_organizations_api_v1_organization_list_get_0**](OrganizationApi.md#list_organizations_api_v1_organization_list_get_0) | **GET** /api/v1/organization/list | 组织列表
[**org_tree_api_v1_organization_tree_get**](OrganizationApi.md#org_tree_api_v1_organization_tree_get) | **GET** /api/v1/organization/tree | 组织树
[**org_tree_api_v1_organization_tree_get_0**](OrganizationApi.md#org_tree_api_v1_organization_tree_get_0) | **GET** /api/v1/organization/tree | 组织树
[**remove_member_api_v1_organization_oid_member_user_id_delete**](OrganizationApi.md#remove_member_api_v1_organization_oid_member_user_id_delete) | **DELETE** /api/v1/organization/{oid}/member/{user_id} | 移除成员
[**remove_member_api_v1_organization_oid_member_user_id_delete_0**](OrganizationApi.md#remove_member_api_v1_organization_oid_member_user_id_delete_0) | **DELETE** /api/v1/organization/{oid}/member/{user_id} | 移除成员
[**update_organization_api_v1_organization_oid_put**](OrganizationApi.md#update_organization_api_v1_organization_oid_put) | **PUT** /api/v1/organization/{oid} | 修改组织
[**update_organization_api_v1_organization_oid_put_0**](OrganizationApi.md#update_organization_api_v1_organization_oid_put_0) | **PUT** /api/v1/organization/{oid} | 修改组织


# **add_member_api_v1_organization_oid_member_post**
> object add_member_api_v1_organization_oid_member_post(oid, user_id, role=role, position=position)

添加成员

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 
    user_id = 'user_id_example' # str | 
    role = 'member' # str |  (optional) (default to 'member')
    position = 'position_example' # str |  (optional)

    try:
        # 添加成员
        api_response = api_instance.add_member_api_v1_organization_oid_member_post(oid, user_id, role=role, position=position)
        print("The response of OrganizationApi->add_member_api_v1_organization_oid_member_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->add_member_api_v1_organization_oid_member_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 
 **user_id** | **str**|  | 
 **role** | **str**|  | [optional] [default to &#39;member&#39;]
 **position** | **str**|  | [optional] 

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

# **add_member_api_v1_organization_oid_member_post_0**
> object add_member_api_v1_organization_oid_member_post_0(oid, user_id, role=role, position=position)

添加成员

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 
    user_id = 'user_id_example' # str | 
    role = 'member' # str |  (optional) (default to 'member')
    position = 'position_example' # str |  (optional)

    try:
        # 添加成员
        api_response = api_instance.add_member_api_v1_organization_oid_member_post_0(oid, user_id, role=role, position=position)
        print("The response of OrganizationApi->add_member_api_v1_organization_oid_member_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->add_member_api_v1_organization_oid_member_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 
 **user_id** | **str**|  | 
 **role** | **str**|  | [optional] [default to &#39;member&#39;]
 **position** | **str**|  | [optional] 

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

# **create_organization_api_v1_organization_post**
> object create_organization_api_v1_organization_post(name, pid=pid, type=type, short_name=short_name, code=code, description=description, leader=leader, leader_phone=leader_phone, logo=logo, address=address, sort_order=sort_order)

创建组织

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
    api_instance = zhs_api.OrganizationApi(api_client)
    name = 'name_example' # str | 
    pid = 0 # int |  (optional) (default to 0)
    type = 'company' # str |  (optional) (default to 'company')
    short_name = 'short_name_example' # str |  (optional)
    code = 'code_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    leader = 'leader_example' # str |  (optional)
    leader_phone = 'leader_phone_example' # str |  (optional)
    logo = 'logo_example' # str |  (optional)
    address = 'address_example' # str |  (optional)
    sort_order = 0 # int |  (optional) (default to 0)

    try:
        # 创建组织
        api_response = api_instance.create_organization_api_v1_organization_post(name, pid=pid, type=type, short_name=short_name, code=code, description=description, leader=leader, leader_phone=leader_phone, logo=logo, address=address, sort_order=sort_order)
        print("The response of OrganizationApi->create_organization_api_v1_organization_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->create_organization_api_v1_organization_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **pid** | **int**|  | [optional] [default to 0]
 **type** | **str**|  | [optional] [default to &#39;company&#39;]
 **short_name** | **str**|  | [optional] 
 **code** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **leader** | **str**|  | [optional] 
 **leader_phone** | **str**|  | [optional] 
 **logo** | **str**|  | [optional] 
 **address** | **str**|  | [optional] 
 **sort_order** | **int**|  | [optional] [default to 0]

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

# **create_organization_api_v1_organization_post_0**
> object create_organization_api_v1_organization_post_0(name, pid=pid, type=type, short_name=short_name, code=code, description=description, leader=leader, leader_phone=leader_phone, logo=logo, address=address, sort_order=sort_order)

创建组织

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
    api_instance = zhs_api.OrganizationApi(api_client)
    name = 'name_example' # str | 
    pid = 0 # int |  (optional) (default to 0)
    type = 'company' # str |  (optional) (default to 'company')
    short_name = 'short_name_example' # str |  (optional)
    code = 'code_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    leader = 'leader_example' # str |  (optional)
    leader_phone = 'leader_phone_example' # str |  (optional)
    logo = 'logo_example' # str |  (optional)
    address = 'address_example' # str |  (optional)
    sort_order = 0 # int |  (optional) (default to 0)

    try:
        # 创建组织
        api_response = api_instance.create_organization_api_v1_organization_post_0(name, pid=pid, type=type, short_name=short_name, code=code, description=description, leader=leader, leader_phone=leader_phone, logo=logo, address=address, sort_order=sort_order)
        print("The response of OrganizationApi->create_organization_api_v1_organization_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->create_organization_api_v1_organization_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **pid** | **int**|  | [optional] [default to 0]
 **type** | **str**|  | [optional] [default to &#39;company&#39;]
 **short_name** | **str**|  | [optional] 
 **code** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **leader** | **str**|  | [optional] 
 **leader_phone** | **str**|  | [optional] 
 **logo** | **str**|  | [optional] 
 **address** | **str**|  | [optional] 
 **sort_order** | **int**|  | [optional] [default to 0]

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

# **delete_organization_api_v1_organization_oid_delete**
> object delete_organization_api_v1_organization_oid_delete(oid)

删除组织

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 

    try:
        # 删除组织
        api_response = api_instance.delete_organization_api_v1_organization_oid_delete(oid)
        print("The response of OrganizationApi->delete_organization_api_v1_organization_oid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->delete_organization_api_v1_organization_oid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 

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

# **delete_organization_api_v1_organization_oid_delete_0**
> object delete_organization_api_v1_organization_oid_delete_0(oid)

删除组织

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 

    try:
        # 删除组织
        api_response = api_instance.delete_organization_api_v1_organization_oid_delete_0(oid)
        print("The response of OrganizationApi->delete_organization_api_v1_organization_oid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->delete_organization_api_v1_organization_oid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 

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

# **get_organization_api_v1_organization_oid_get**
> object get_organization_api_v1_organization_oid_get(oid)

组织详情

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 

    try:
        # 组织详情
        api_response = api_instance.get_organization_api_v1_organization_oid_get(oid)
        print("The response of OrganizationApi->get_organization_api_v1_organization_oid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->get_organization_api_v1_organization_oid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 

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

# **get_organization_api_v1_organization_oid_get_0**
> object get_organization_api_v1_organization_oid_get_0(oid)

组织详情

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 

    try:
        # 组织详情
        api_response = api_instance.get_organization_api_v1_organization_oid_get_0(oid)
        print("The response of OrganizationApi->get_organization_api_v1_organization_oid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->get_organization_api_v1_organization_oid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 

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

# **list_members_api_v1_organization_oid_members_get**
> object list_members_api_v1_organization_oid_members_get(oid, page=page, limit=limit)

组织成员

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 组织成员
        api_response = api_instance.list_members_api_v1_organization_oid_members_get(oid, page=page, limit=limit)
        print("The response of OrganizationApi->list_members_api_v1_organization_oid_members_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->list_members_api_v1_organization_oid_members_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **list_members_api_v1_organization_oid_members_get_0**
> object list_members_api_v1_organization_oid_members_get_0(oid, page=page, limit=limit)

组织成员

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 组织成员
        api_response = api_instance.list_members_api_v1_organization_oid_members_get_0(oid, page=page, limit=limit)
        print("The response of OrganizationApi->list_members_api_v1_organization_oid_members_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->list_members_api_v1_organization_oid_members_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **list_organizations_api_v1_organization_list_get**
> object list_organizations_api_v1_organization_list_get(pid=pid, status=status, keyword=keyword)

组织列表

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
    api_instance = zhs_api.OrganizationApi(api_client)
    pid = 56 # int |  (optional)
    status = 56 # int |  (optional)
    keyword = 'keyword_example' # str |  (optional)

    try:
        # 组织列表
        api_response = api_instance.list_organizations_api_v1_organization_list_get(pid=pid, status=status, keyword=keyword)
        print("The response of OrganizationApi->list_organizations_api_v1_organization_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->list_organizations_api_v1_organization_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | [optional] 
 **status** | **int**|  | [optional] 
 **keyword** | **str**|  | [optional] 

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

# **list_organizations_api_v1_organization_list_get_0**
> object list_organizations_api_v1_organization_list_get_0(pid=pid, status=status, keyword=keyword)

组织列表

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
    api_instance = zhs_api.OrganizationApi(api_client)
    pid = 56 # int |  (optional)
    status = 56 # int |  (optional)
    keyword = 'keyword_example' # str |  (optional)

    try:
        # 组织列表
        api_response = api_instance.list_organizations_api_v1_organization_list_get_0(pid=pid, status=status, keyword=keyword)
        print("The response of OrganizationApi->list_organizations_api_v1_organization_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->list_organizations_api_v1_organization_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | [optional] 
 **status** | **int**|  | [optional] 
 **keyword** | **str**|  | [optional] 

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

# **org_tree_api_v1_organization_tree_get**
> object org_tree_api_v1_organization_tree_get()

组织树

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
    api_instance = zhs_api.OrganizationApi(api_client)

    try:
        # 组织树
        api_response = api_instance.org_tree_api_v1_organization_tree_get()
        print("The response of OrganizationApi->org_tree_api_v1_organization_tree_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->org_tree_api_v1_organization_tree_get: %s\n" % e)
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

# **org_tree_api_v1_organization_tree_get_0**
> object org_tree_api_v1_organization_tree_get_0()

组织树

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
    api_instance = zhs_api.OrganizationApi(api_client)

    try:
        # 组织树
        api_response = api_instance.org_tree_api_v1_organization_tree_get_0()
        print("The response of OrganizationApi->org_tree_api_v1_organization_tree_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->org_tree_api_v1_organization_tree_get_0: %s\n" % e)
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

# **remove_member_api_v1_organization_oid_member_user_id_delete**
> object remove_member_api_v1_organization_oid_member_user_id_delete(oid, user_id)

移除成员

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 
    user_id = 'user_id_example' # str | 

    try:
        # 移除成员
        api_response = api_instance.remove_member_api_v1_organization_oid_member_user_id_delete(oid, user_id)
        print("The response of OrganizationApi->remove_member_api_v1_organization_oid_member_user_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->remove_member_api_v1_organization_oid_member_user_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 
 **user_id** | **str**|  | 

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

# **remove_member_api_v1_organization_oid_member_user_id_delete_0**
> object remove_member_api_v1_organization_oid_member_user_id_delete_0(oid, user_id)

移除成员

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 
    user_id = 'user_id_example' # str | 

    try:
        # 移除成员
        api_response = api_instance.remove_member_api_v1_organization_oid_member_user_id_delete_0(oid, user_id)
        print("The response of OrganizationApi->remove_member_api_v1_organization_oid_member_user_id_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->remove_member_api_v1_organization_oid_member_user_id_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 
 **user_id** | **str**|  | 

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

# **update_organization_api_v1_organization_oid_put**
> object update_organization_api_v1_organization_oid_put(oid, name=name, short_name=short_name, description=description, leader=leader, leader_phone=leader_phone, status=status, sort_order=sort_order)

修改组织

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 
    name = 'name_example' # str |  (optional)
    short_name = 'short_name_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    leader = 'leader_example' # str |  (optional)
    leader_phone = 'leader_phone_example' # str |  (optional)
    status = 56 # int |  (optional)
    sort_order = 56 # int |  (optional)

    try:
        # 修改组织
        api_response = api_instance.update_organization_api_v1_organization_oid_put(oid, name=name, short_name=short_name, description=description, leader=leader, leader_phone=leader_phone, status=status, sort_order=sort_order)
        print("The response of OrganizationApi->update_organization_api_v1_organization_oid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->update_organization_api_v1_organization_oid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 
 **name** | **str**|  | [optional] 
 **short_name** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **leader** | **str**|  | [optional] 
 **leader_phone** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
 **sort_order** | **int**|  | [optional] 

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

# **update_organization_api_v1_organization_oid_put_0**
> object update_organization_api_v1_organization_oid_put_0(oid, name=name, short_name=short_name, description=description, leader=leader, leader_phone=leader_phone, status=status, sort_order=sort_order)

修改组织

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
    api_instance = zhs_api.OrganizationApi(api_client)
    oid = 56 # int | 
    name = 'name_example' # str |  (optional)
    short_name = 'short_name_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    leader = 'leader_example' # str |  (optional)
    leader_phone = 'leader_phone_example' # str |  (optional)
    status = 56 # int |  (optional)
    sort_order = 56 # int |  (optional)

    try:
        # 修改组织
        api_response = api_instance.update_organization_api_v1_organization_oid_put_0(oid, name=name, short_name=short_name, description=description, leader=leader, leader_phone=leader_phone, status=status, sort_order=sort_order)
        print("The response of OrganizationApi->update_organization_api_v1_organization_oid_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OrganizationApi->update_organization_api_v1_organization_oid_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oid** | **int**|  | 
 **name** | **str**|  | [optional] 
 **short_name** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **leader** | **str**|  | [optional] 
 **leader_phone** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
 **sort_order** | **int**|  | [optional] 

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

