# zhs_api.SystemAdminApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_config_api_v1_system_admin_config_create_post**](SystemAdminApi.md#create_config_api_v1_system_admin_config_create_post) | **POST** /api/v1/system/admin/config/create | 新增配置
[**create_dept_api_v1_system_admin_dept_create_post**](SystemAdminApi.md#create_dept_api_v1_system_admin_dept_create_post) | **POST** /api/v1/system/admin/dept/create | 创建部门
[**create_dict_data_api_v1_system_admin_dict_data_create_post**](SystemAdminApi.md#create_dict_data_api_v1_system_admin_dict_data_create_post) | **POST** /api/v1/system/admin/dict/data/create | 新增字典数据
[**create_dict_type_api_v1_system_admin_dict_type_create_post**](SystemAdminApi.md#create_dict_type_api_v1_system_admin_dict_type_create_post) | **POST** /api/v1/system/admin/dict/type/create | 新增字典类型
[**create_menu_api_v1_system_admin_menu_create_post**](SystemAdminApi.md#create_menu_api_v1_system_admin_menu_create_post) | **POST** /api/v1/system/admin/menu/create | 创建菜单
[**create_post_api_v1_system_admin_post_create_post**](SystemAdminApi.md#create_post_api_v1_system_admin_post_create_post) | **POST** /api/v1/system/admin/post/create | 创建岗位
[**create_role_api_v1_system_admin_role_create_post**](SystemAdminApi.md#create_role_api_v1_system_admin_role_create_post) | **POST** /api/v1/system/admin/role/create | 创建角色
[**delete_dept_api_v1_system_admin_dept_delete_post**](SystemAdminApi.md#delete_dept_api_v1_system_admin_dept_delete_post) | **POST** /api/v1/system/admin/dept/delete | 删除部门
[**delete_menu_api_v1_system_admin_menu_delete_post**](SystemAdminApi.md#delete_menu_api_v1_system_admin_menu_delete_post) | **POST** /api/v1/system/admin/menu/delete | 删除菜单
[**delete_role_api_v1_system_admin_role_delete_post**](SystemAdminApi.md#delete_role_api_v1_system_admin_role_delete_post) | **POST** /api/v1/system/admin/role/delete | 删除角色
[**export_configs_api_v1_system_admin_config_export_get**](SystemAdminApi.md#export_configs_api_v1_system_admin_config_export_get) | **GET** /api/v1/system/admin/config/export | 导出参数配置到Excel
[**export_depts_api_v1_system_admin_dept_export_get**](SystemAdminApi.md#export_depts_api_v1_system_admin_dept_export_get) | **GET** /api/v1/system/admin/dept/export | 导出部门列表到Excel
[**export_dict_types_api_v1_system_admin_dict_type_export_get**](SystemAdminApi.md#export_dict_types_api_v1_system_admin_dict_type_export_get) | **GET** /api/v1/system/admin/dict/type/export | 导出字典类型到Excel
[**export_menus_api_v1_system_admin_menu_export_get**](SystemAdminApi.md#export_menus_api_v1_system_admin_menu_export_get) | **GET** /api/v1/system/admin/menu/export | 导出菜单列表到Excel
[**export_posts_api_v1_system_admin_post_export_get**](SystemAdminApi.md#export_posts_api_v1_system_admin_post_export_get) | **GET** /api/v1/system/admin/post/export | 导出岗位列表到Excel
[**export_roles_api_v1_system_admin_role_export_get**](SystemAdminApi.md#export_roles_api_v1_system_admin_role_export_get) | **GET** /api/v1/system/admin/role/export | 导出角色列表到Excel
[**get_config_by_key_api_v1_system_admin_config_key_config_key_get**](SystemAdminApi.md#get_config_by_key_api_v1_system_admin_config_key_config_key_get) | **GET** /api/v1/system/admin/config/key/{config_key} | 按 key 查配置
[**get_dict_data_by_type_api_v1_system_admin_dict_data_type_dict_type_get**](SystemAdminApi.md#get_dict_data_by_type_api_v1_system_admin_dict_data_type_dict_type_get) | **GET** /api/v1/system/admin/dict/data/type/{dict_type} | 按字典类型获取数据 (RuoYi 兼容)
[**get_routers_api_v1_system_admin_menu_get_routers_get**](SystemAdminApi.md#get_routers_api_v1_system_admin_menu_get_routers_get) | **GET** /api/v1/system/admin/menu/getRouters | 获取路由菜单树 (RuoYi 兼容)
[**list_configs_api_v1_system_admin_config_list_get**](SystemAdminApi.md#list_configs_api_v1_system_admin_config_list_get) | **GET** /api/v1/system/admin/config/list | 参数配置列表
[**list_depts_api_v1_system_admin_dept_list_get**](SystemAdminApi.md#list_depts_api_v1_system_admin_dept_list_get) | **GET** /api/v1/system/admin/dept/list | 部门列表
[**list_dict_data_api_v1_system_admin_dict_data_list_get**](SystemAdminApi.md#list_dict_data_api_v1_system_admin_dict_data_list_get) | **GET** /api/v1/system/admin/dict/data/list | 字典数据列表
[**list_dict_types_api_v1_system_admin_dict_type_list_get**](SystemAdminApi.md#list_dict_types_api_v1_system_admin_dict_type_list_get) | **GET** /api/v1/system/admin/dict/type/list | 字典类型列表
[**list_menus_api_v1_system_admin_menu_list_get**](SystemAdminApi.md#list_menus_api_v1_system_admin_menu_list_get) | **GET** /api/v1/system/admin/menu/list | 菜单列表
[**list_posts_api_v1_system_admin_post_list_get**](SystemAdminApi.md#list_posts_api_v1_system_admin_post_list_get) | **GET** /api/v1/system/admin/post/list | 岗位列表
[**list_roles_api_v1_system_admin_role_list_get**](SystemAdminApi.md#list_roles_api_v1_system_admin_role_list_get) | **GET** /api/v1/system/admin/role/list | 角色列表
[**menu_treeselect_api_v1_system_admin_menu_treeselect_get**](SystemAdminApi.md#menu_treeselect_api_v1_system_admin_menu_treeselect_get) | **GET** /api/v1/system/admin/menu/treeselect | 菜单树选择 (RuoYi 兼容)
[**role_menu_treeselect_api_v1_system_admin_menu_role_menu_treeselect_role_id_get**](SystemAdminApi.md#role_menu_treeselect_api_v1_system_admin_menu_role_menu_treeselect_role_id_get) | **GET** /api/v1/system/admin/menu/roleMenuTreeselect/{role_id} | 角色菜单树
[**update_config_api_v1_system_admin_config_update_post**](SystemAdminApi.md#update_config_api_v1_system_admin_config_update_post) | **POST** /api/v1/system/admin/config/update | 更新配置值
[**update_role_api_v1_system_admin_role_update_post**](SystemAdminApi.md#update_role_api_v1_system_admin_role_update_post) | **POST** /api/v1/system/admin/role/update | 更新角色


# **create_config_api_v1_system_admin_config_create_post**
> object create_config_api_v1_system_admin_config_create_post(config_name, config_key, config_value=config_value, config_type=config_type)

新增配置

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    config_name = 'config_name_example' # str | 
    config_key = 'config_key_example' # str | 
    config_value = '' # str |  (optional) (default to '')
    config_type = 'N' # str |  (optional) (default to 'N')

    try:
        # 新增配置
        api_response = api_instance.create_config_api_v1_system_admin_config_create_post(config_name, config_key, config_value=config_value, config_type=config_type)
        print("The response of SystemAdminApi->create_config_api_v1_system_admin_config_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->create_config_api_v1_system_admin_config_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **config_name** | **str**|  | 
 **config_key** | **str**|  | 
 **config_value** | **str**|  | [optional] [default to &#39;&#39;]
 **config_type** | **str**|  | [optional] [default to &#39;N&#39;]

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

# **create_dept_api_v1_system_admin_dept_create_post**
> object create_dept_api_v1_system_admin_dept_create_post(dept_name, parent_id=parent_id, leader=leader, order_num=order_num)

创建部门

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    dept_name = 'dept_name_example' # str | 
    parent_id = 0 # int |  (optional) (default to 0)
    leader = '' # str |  (optional) (default to '')
    order_num = 0 # int |  (optional) (default to 0)

    try:
        # 创建部门
        api_response = api_instance.create_dept_api_v1_system_admin_dept_create_post(dept_name, parent_id=parent_id, leader=leader, order_num=order_num)
        print("The response of SystemAdminApi->create_dept_api_v1_system_admin_dept_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->create_dept_api_v1_system_admin_dept_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dept_name** | **str**|  | 
 **parent_id** | **int**|  | [optional] [default to 0]
 **leader** | **str**|  | [optional] [default to &#39;&#39;]
 **order_num** | **int**|  | [optional] [default to 0]

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

# **create_dict_data_api_v1_system_admin_dict_data_create_post**
> object create_dict_data_api_v1_system_admin_dict_data_create_post(dict_type, dict_label, dict_value, dict_sort=dict_sort)

新增字典数据

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    dict_type = 'dict_type_example' # str | 
    dict_label = 'dict_label_example' # str | 
    dict_value = 'dict_value_example' # str | 
    dict_sort = 0 # int |  (optional) (default to 0)

    try:
        # 新增字典数据
        api_response = api_instance.create_dict_data_api_v1_system_admin_dict_data_create_post(dict_type, dict_label, dict_value, dict_sort=dict_sort)
        print("The response of SystemAdminApi->create_dict_data_api_v1_system_admin_dict_data_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->create_dict_data_api_v1_system_admin_dict_data_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dict_type** | **str**|  | 
 **dict_label** | **str**|  | 
 **dict_value** | **str**|  | 
 **dict_sort** | **int**|  | [optional] [default to 0]

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

# **create_dict_type_api_v1_system_admin_dict_type_create_post**
> object create_dict_type_api_v1_system_admin_dict_type_create_post(dict_name, dict_type)

新增字典类型

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    dict_name = 'dict_name_example' # str | 
    dict_type = 'dict_type_example' # str | 字典编码，如 sys_user_sex

    try:
        # 新增字典类型
        api_response = api_instance.create_dict_type_api_v1_system_admin_dict_type_create_post(dict_name, dict_type)
        print("The response of SystemAdminApi->create_dict_type_api_v1_system_admin_dict_type_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->create_dict_type_api_v1_system_admin_dict_type_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dict_name** | **str**|  | 
 **dict_type** | **str**| 字典编码，如 sys_user_sex | 

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

# **create_menu_api_v1_system_admin_menu_create_post**
> object create_menu_api_v1_system_admin_menu_create_post(menu_name, parent_id=parent_id, path=path, icon=icon, menu_type=menu_type)

创建菜单

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    menu_name = 'menu_name_example' # str | 
    parent_id = 0 # int |  (optional) (default to 0)
    path = '' # str |  (optional) (default to '')
    icon = '#' # str |  (optional) (default to '#')
    menu_type = 'M' # str |  (optional) (default to 'M')

    try:
        # 创建菜单
        api_response = api_instance.create_menu_api_v1_system_admin_menu_create_post(menu_name, parent_id=parent_id, path=path, icon=icon, menu_type=menu_type)
        print("The response of SystemAdminApi->create_menu_api_v1_system_admin_menu_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->create_menu_api_v1_system_admin_menu_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **menu_name** | **str**|  | 
 **parent_id** | **int**|  | [optional] [default to 0]
 **path** | **str**|  | [optional] [default to &#39;&#39;]
 **icon** | **str**|  | [optional] [default to &#39;#&#39;]
 **menu_type** | **str**|  | [optional] [default to &#39;M&#39;]

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

# **create_post_api_v1_system_admin_post_create_post**
> object create_post_api_v1_system_admin_post_create_post(post_code, post_name, post_sort=post_sort)

创建岗位

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    post_code = 'post_code_example' # str | 
    post_name = 'post_name_example' # str | 
    post_sort = 0 # int |  (optional) (default to 0)

    try:
        # 创建岗位
        api_response = api_instance.create_post_api_v1_system_admin_post_create_post(post_code, post_name, post_sort=post_sort)
        print("The response of SystemAdminApi->create_post_api_v1_system_admin_post_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->create_post_api_v1_system_admin_post_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **post_code** | **str**|  | 
 **post_name** | **str**|  | 
 **post_sort** | **int**|  | [optional] [default to 0]

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

# **create_role_api_v1_system_admin_role_create_post**
> object create_role_api_v1_system_admin_role_create_post(role_name, role_key, role_sort=role_sort)

创建角色

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    role_name = 'role_name_example' # str | 
    role_key = 'role_key_example' # str | 
    role_sort = 0 # int |  (optional) (default to 0)

    try:
        # 创建角色
        api_response = api_instance.create_role_api_v1_system_admin_role_create_post(role_name, role_key, role_sort=role_sort)
        print("The response of SystemAdminApi->create_role_api_v1_system_admin_role_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->create_role_api_v1_system_admin_role_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **role_name** | **str**|  | 
 **role_key** | **str**|  | 
 **role_sort** | **int**|  | [optional] [default to 0]

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

# **delete_dept_api_v1_system_admin_dept_delete_post**
> object delete_dept_api_v1_system_admin_dept_delete_post(dept_id)

删除部门

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    dept_id = 56 # int | 

    try:
        # 删除部门
        api_response = api_instance.delete_dept_api_v1_system_admin_dept_delete_post(dept_id)
        print("The response of SystemAdminApi->delete_dept_api_v1_system_admin_dept_delete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->delete_dept_api_v1_system_admin_dept_delete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dept_id** | **int**|  | 

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

# **delete_menu_api_v1_system_admin_menu_delete_post**
> object delete_menu_api_v1_system_admin_menu_delete_post(menu_id)

删除菜单

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    menu_id = 56 # int | 

    try:
        # 删除菜单
        api_response = api_instance.delete_menu_api_v1_system_admin_menu_delete_post(menu_id)
        print("The response of SystemAdminApi->delete_menu_api_v1_system_admin_menu_delete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->delete_menu_api_v1_system_admin_menu_delete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **menu_id** | **int**|  | 

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

# **delete_role_api_v1_system_admin_role_delete_post**
> object delete_role_api_v1_system_admin_role_delete_post(role_id)

删除角色

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    role_id = 56 # int | 

    try:
        # 删除角色
        api_response = api_instance.delete_role_api_v1_system_admin_role_delete_post(role_id)
        print("The response of SystemAdminApi->delete_role_api_v1_system_admin_role_delete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->delete_role_api_v1_system_admin_role_delete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **role_id** | **int**|  | 

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

# **export_configs_api_v1_system_admin_config_export_get**
> object export_configs_api_v1_system_admin_config_export_get()

导出参数配置到Excel

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
    api_instance = zhs_api.SystemAdminApi(api_client)

    try:
        # 导出参数配置到Excel
        api_response = api_instance.export_configs_api_v1_system_admin_config_export_get()
        print("The response of SystemAdminApi->export_configs_api_v1_system_admin_config_export_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->export_configs_api_v1_system_admin_config_export_get: %s\n" % e)
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

# **export_depts_api_v1_system_admin_dept_export_get**
> object export_depts_api_v1_system_admin_dept_export_get()

导出部门列表到Excel

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
    api_instance = zhs_api.SystemAdminApi(api_client)

    try:
        # 导出部门列表到Excel
        api_response = api_instance.export_depts_api_v1_system_admin_dept_export_get()
        print("The response of SystemAdminApi->export_depts_api_v1_system_admin_dept_export_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->export_depts_api_v1_system_admin_dept_export_get: %s\n" % e)
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

# **export_dict_types_api_v1_system_admin_dict_type_export_get**
> object export_dict_types_api_v1_system_admin_dict_type_export_get()

导出字典类型到Excel

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
    api_instance = zhs_api.SystemAdminApi(api_client)

    try:
        # 导出字典类型到Excel
        api_response = api_instance.export_dict_types_api_v1_system_admin_dict_type_export_get()
        print("The response of SystemAdminApi->export_dict_types_api_v1_system_admin_dict_type_export_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->export_dict_types_api_v1_system_admin_dict_type_export_get: %s\n" % e)
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

# **export_menus_api_v1_system_admin_menu_export_get**
> object export_menus_api_v1_system_admin_menu_export_get()

导出菜单列表到Excel

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
    api_instance = zhs_api.SystemAdminApi(api_client)

    try:
        # 导出菜单列表到Excel
        api_response = api_instance.export_menus_api_v1_system_admin_menu_export_get()
        print("The response of SystemAdminApi->export_menus_api_v1_system_admin_menu_export_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->export_menus_api_v1_system_admin_menu_export_get: %s\n" % e)
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

# **export_posts_api_v1_system_admin_post_export_get**
> object export_posts_api_v1_system_admin_post_export_get()

导出岗位列表到Excel

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
    api_instance = zhs_api.SystemAdminApi(api_client)

    try:
        # 导出岗位列表到Excel
        api_response = api_instance.export_posts_api_v1_system_admin_post_export_get()
        print("The response of SystemAdminApi->export_posts_api_v1_system_admin_post_export_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->export_posts_api_v1_system_admin_post_export_get: %s\n" % e)
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

# **export_roles_api_v1_system_admin_role_export_get**
> object export_roles_api_v1_system_admin_role_export_get()

导出角色列表到Excel

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
    api_instance = zhs_api.SystemAdminApi(api_client)

    try:
        # 导出角色列表到Excel
        api_response = api_instance.export_roles_api_v1_system_admin_role_export_get()
        print("The response of SystemAdminApi->export_roles_api_v1_system_admin_role_export_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->export_roles_api_v1_system_admin_role_export_get: %s\n" % e)
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

# **get_config_by_key_api_v1_system_admin_config_key_config_key_get**
> object get_config_by_key_api_v1_system_admin_config_key_config_key_get(config_key)

按 key 查配置

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    config_key = 'config_key_example' # str | 

    try:
        # 按 key 查配置
        api_response = api_instance.get_config_by_key_api_v1_system_admin_config_key_config_key_get(config_key)
        print("The response of SystemAdminApi->get_config_by_key_api_v1_system_admin_config_key_config_key_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->get_config_by_key_api_v1_system_admin_config_key_config_key_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **config_key** | **str**|  | 

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

# **get_dict_data_by_type_api_v1_system_admin_dict_data_type_dict_type_get**
> object get_dict_data_by_type_api_v1_system_admin_dict_data_type_dict_type_get(dict_type)

按字典类型获取数据 (RuoYi 兼容)

前端 /system/dict/data/type/{dict_type} 调用此端点.

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    dict_type = 'dict_type_example' # str | 

    try:
        # 按字典类型获取数据 (RuoYi 兼容)
        api_response = api_instance.get_dict_data_by_type_api_v1_system_admin_dict_data_type_dict_type_get(dict_type)
        print("The response of SystemAdminApi->get_dict_data_by_type_api_v1_system_admin_dict_data_type_dict_type_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->get_dict_data_by_type_api_v1_system_admin_dict_data_type_dict_type_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dict_type** | **str**|  | 

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

# **get_routers_api_v1_system_admin_menu_get_routers_get**
> object get_routers_api_v1_system_admin_menu_get_routers_get()

获取路由菜单树 (RuoYi 兼容)

返回前端路由所需的菜单树结构。RuoYi 前端调用 /system/menu/getRouters。

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
    api_instance = zhs_api.SystemAdminApi(api_client)

    try:
        # 获取路由菜单树 (RuoYi 兼容)
        api_response = api_instance.get_routers_api_v1_system_admin_menu_get_routers_get()
        print("The response of SystemAdminApi->get_routers_api_v1_system_admin_menu_get_routers_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->get_routers_api_v1_system_admin_menu_get_routers_get: %s\n" % e)
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

# **list_configs_api_v1_system_admin_config_list_get**
> object list_configs_api_v1_system_admin_config_list_get(page=page, limit=limit, config_key=config_key)

参数配置列表

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 50 # int |  (optional) (default to 50)
    config_key = 'config_key_example' # str |  (optional)

    try:
        # 参数配置列表
        api_response = api_instance.list_configs_api_v1_system_admin_config_list_get(page=page, limit=limit, config_key=config_key)
        print("The response of SystemAdminApi->list_configs_api_v1_system_admin_config_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->list_configs_api_v1_system_admin_config_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 50]
 **config_key** | **str**|  | [optional] 

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

# **list_depts_api_v1_system_admin_dept_list_get**
> object list_depts_api_v1_system_admin_dept_list_get(page=page, limit=limit, dept_name=dept_name)

部门列表

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 50 # int |  (optional) (default to 50)
    dept_name = 'dept_name_example' # str |  (optional)

    try:
        # 部门列表
        api_response = api_instance.list_depts_api_v1_system_admin_dept_list_get(page=page, limit=limit, dept_name=dept_name)
        print("The response of SystemAdminApi->list_depts_api_v1_system_admin_dept_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->list_depts_api_v1_system_admin_dept_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 50]
 **dept_name** | **str**|  | [optional] 

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

# **list_dict_data_api_v1_system_admin_dict_data_list_get**
> object list_dict_data_api_v1_system_admin_dict_data_list_get(dict_type, page=page, limit=limit)

字典数据列表

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    dict_type = 'dict_type_example' # str | 字典编码
    page = 1 # int |  (optional) (default to 1)
    limit = 100 # int |  (optional) (default to 100)

    try:
        # 字典数据列表
        api_response = api_instance.list_dict_data_api_v1_system_admin_dict_data_list_get(dict_type, page=page, limit=limit)
        print("The response of SystemAdminApi->list_dict_data_api_v1_system_admin_dict_data_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->list_dict_data_api_v1_system_admin_dict_data_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dict_type** | **str**| 字典编码 | 
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 100]

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

# **list_dict_types_api_v1_system_admin_dict_type_list_get**
> object list_dict_types_api_v1_system_admin_dict_type_list_get(page=page, limit=limit)

字典类型列表

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 字典类型列表
        api_response = api_instance.list_dict_types_api_v1_system_admin_dict_type_list_get(page=page, limit=limit)
        print("The response of SystemAdminApi->list_dict_types_api_v1_system_admin_dict_type_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->list_dict_types_api_v1_system_admin_dict_type_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 50]

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

# **list_menus_api_v1_system_admin_menu_list_get**
> object list_menus_api_v1_system_admin_menu_list_get(page=page, limit=limit, menu_name=menu_name)

菜单列表

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 50 # int |  (optional) (default to 50)
    menu_name = 'menu_name_example' # str |  (optional)

    try:
        # 菜单列表
        api_response = api_instance.list_menus_api_v1_system_admin_menu_list_get(page=page, limit=limit, menu_name=menu_name)
        print("The response of SystemAdminApi->list_menus_api_v1_system_admin_menu_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->list_menus_api_v1_system_admin_menu_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 50]
 **menu_name** | **str**|  | [optional] 

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

# **list_posts_api_v1_system_admin_post_list_get**
> object list_posts_api_v1_system_admin_post_list_get(page=page, limit=limit)

岗位列表

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 岗位列表
        api_response = api_instance.list_posts_api_v1_system_admin_post_list_get(page=page, limit=limit)
        print("The response of SystemAdminApi->list_posts_api_v1_system_admin_post_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->list_posts_api_v1_system_admin_post_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 50]

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

# **list_roles_api_v1_system_admin_role_list_get**
> object list_roles_api_v1_system_admin_role_list_get(page=page, limit=limit, role_name=role_name)

角色列表

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    role_name = 'role_name_example' # str |  (optional)

    try:
        # 角色列表
        api_response = api_instance.list_roles_api_v1_system_admin_role_list_get(page=page, limit=limit, role_name=role_name)
        print("The response of SystemAdminApi->list_roles_api_v1_system_admin_role_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->list_roles_api_v1_system_admin_role_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **role_name** | **str**|  | [optional] 

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

# **menu_treeselect_api_v1_system_admin_menu_treeselect_get**
> object menu_treeselect_api_v1_system_admin_menu_treeselect_get()

菜单树选择 (RuoYi 兼容)

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
    api_instance = zhs_api.SystemAdminApi(api_client)

    try:
        # 菜单树选择 (RuoYi 兼容)
        api_response = api_instance.menu_treeselect_api_v1_system_admin_menu_treeselect_get()
        print("The response of SystemAdminApi->menu_treeselect_api_v1_system_admin_menu_treeselect_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->menu_treeselect_api_v1_system_admin_menu_treeselect_get: %s\n" % e)
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

# **role_menu_treeselect_api_v1_system_admin_menu_role_menu_treeselect_role_id_get**
> object role_menu_treeselect_api_v1_system_admin_menu_role_menu_treeselect_role_id_get(role_id)

角色菜单树

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    role_id = 56 # int | 

    try:
        # 角色菜单树
        api_response = api_instance.role_menu_treeselect_api_v1_system_admin_menu_role_menu_treeselect_role_id_get(role_id)
        print("The response of SystemAdminApi->role_menu_treeselect_api_v1_system_admin_menu_role_menu_treeselect_role_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->role_menu_treeselect_api_v1_system_admin_menu_role_menu_treeselect_role_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **role_id** | **int**|  | 

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

# **update_config_api_v1_system_admin_config_update_post**
> object update_config_api_v1_system_admin_config_update_post(config_id, config_value)

更新配置值

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    config_id = 56 # int | 
    config_value = 'config_value_example' # str | 

    try:
        # 更新配置值
        api_response = api_instance.update_config_api_v1_system_admin_config_update_post(config_id, config_value)
        print("The response of SystemAdminApi->update_config_api_v1_system_admin_config_update_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->update_config_api_v1_system_admin_config_update_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **config_id** | **int**|  | 
 **config_value** | **str**|  | 

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

# **update_role_api_v1_system_admin_role_update_post**
> object update_role_api_v1_system_admin_role_update_post(role_id, role_name=role_name, role_sort=role_sort)

更新角色

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
    api_instance = zhs_api.SystemAdminApi(api_client)
    role_id = 56 # int | 
    role_name = 'role_name_example' # str |  (optional)
    role_sort = 56 # int |  (optional)

    try:
        # 更新角色
        api_response = api_instance.update_role_api_v1_system_admin_role_update_post(role_id, role_name=role_name, role_sort=role_sort)
        print("The response of SystemAdminApi->update_role_api_v1_system_admin_role_update_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAdminApi->update_role_api_v1_system_admin_role_update_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **role_id** | **int**|  | 
 **role_name** | **str**|  | [optional] 
 **role_sort** | **int**|  | [optional] 

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

