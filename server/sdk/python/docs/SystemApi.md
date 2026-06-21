# zhs_api.SystemApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**admin_login_api_v1_system_login_post**](SystemApi.md#admin_login_api_v1_system_login_post) | **POST** /api/v1/system/login | Admin login
[**change_user_status_api_v1_system_change_status_put**](SystemApi.md#change_user_status_api_v1_system_change_status_put) | **PUT** /api/v1/system/changeStatus | 启用 / 禁用用户
[**export_users_api_v1_system_user_export_get**](SystemApi.md#export_users_api_v1_system_user_export_get) | **GET** /api/v1/system/user/export | 导出用户列表到Excel
[**get_dict_api_v1_system_dict_dict_type_get**](SystemApi.md#get_dict_api_v1_system_dict_dict_type_get) | **GET** /api/v1/system/dict/{dict_type} | Get dictionary data
[**get_dict_data_by_type_api_v1_system_dict_data_type_dict_type_get**](SystemApi.md#get_dict_data_by_type_api_v1_system_dict_data_type_dict_type_get) | **GET** /api/v1/system/dict/data/type/{dict_type} | 按字典类型获取数据
[**get_login_user_info_alias_api_v1_system_user_get_info_get**](SystemApi.md#get_login_user_info_alias_api_v1_system_user_get_info_get) | **GET** /api/v1/system/user/getInfo | 获取当前登录用户信息 (别名)
[**get_login_user_info_api_v1_system_get_info_get**](SystemApi.md#get_login_user_info_api_v1_system_get_info_get) | **GET** /api/v1/system/getInfo | 获取当前登录用户信息(含角色与权限)
[**get_routers_api_v1_system_menu_get_routers_get**](SystemApi.md#get_routers_api_v1_system_menu_get_routers_get) | **GET** /api/v1/system/menu/getRouters | 获取路由菜单树 (RuoYi 兼容)
[**get_user_profile_api_v1_system_user_profile_get**](SystemApi.md#get_user_profile_api_v1_system_user_profile_get) | **GET** /api/v1/system/user/profile | 获取个人详细资料
[**list_configs_api_v1_system_config_list_get**](SystemApi.md#list_configs_api_v1_system_config_list_get) | **GET** /api/v1/system/config/list | List system configs
[**list_depts_api_v1_system_dept_list_get**](SystemApi.md#list_depts_api_v1_system_dept_list_get) | **GET** /api/v1/system/dept/list | 部门列表
[**list_dict_data_api_v1_system_dict_data_list_get**](SystemApi.md#list_dict_data_api_v1_system_dict_data_list_get) | **GET** /api/v1/system/dict/data/list | 字典数据列表
[**list_dict_types_api_v1_system_dict_type_list_get**](SystemApi.md#list_dict_types_api_v1_system_dict_type_list_get) | **GET** /api/v1/system/dict/type/list | 字典类型列表
[**list_menus_api_v1_system_menu_list_get**](SystemApi.md#list_menus_api_v1_system_menu_list_get) | **GET** /api/v1/system/menu/list | List menus
[**list_posts_api_v1_system_post_list_get**](SystemApi.md#list_posts_api_v1_system_post_list_get) | **GET** /api/v1/system/post/list | 岗位列表
[**list_roles_api_v1_system_role_list_get**](SystemApi.md#list_roles_api_v1_system_role_list_get) | **GET** /api/v1/system/role/list | List roles
[**list_sys_users_api_v1_system_user_list_get**](SystemApi.md#list_sys_users_api_v1_system_user_list_get) | **GET** /api/v1/system/user/list | List system users
[**menu_treeselect_api_v1_system_menu_treeselect_get**](SystemApi.md#menu_treeselect_api_v1_system_menu_treeselect_get) | **GET** /api/v1/system/menu/treeselect | 菜单树选择
[**reset_user_pwd_api_v1_system_reset_pwd_put**](SystemApi.md#reset_user_pwd_api_v1_system_reset_pwd_put) | **PUT** /api/v1/system/resetPwd | 管理员重置用户密码
[**update_own_password_api_v1_system_user_profile_update_pwd_put**](SystemApi.md#update_own_password_api_v1_system_user_profile_update_pwd_put) | **PUT** /api/v1/system/user/profile/updatePwd | 修改个人密码
[**update_user_profile_api_v1_system_user_profile_put**](SystemApi.md#update_user_profile_api_v1_system_user_profile_put) | **PUT** /api/v1/system/user/profile | 修改个人信息
[**upload_avatar_api_v1_system_user_profile_avatar_post**](SystemApi.md#upload_avatar_api_v1_system_user_profile_avatar_post) | **POST** /api/v1/system/user/profile/avatar | 上传头像


# **admin_login_api_v1_system_login_post**
> object admin_login_api_v1_system_login_post(username, password)

Admin login

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
    api_instance = zhs_api.SystemApi(api_client)
    username = 'username_example' # str | 
    password = 'password_example' # str | 

    try:
        # Admin login
        api_response = api_instance.admin_login_api_v1_system_login_post(username, password)
        print("The response of SystemApi->admin_login_api_v1_system_login_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->admin_login_api_v1_system_login_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **username** | **str**|  | 
 **password** | **str**|  | 

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

# **change_user_status_api_v1_system_change_status_put**
> object change_user_status_api_v1_system_change_status_put(user_id, status)

启用 / 禁用用户

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
    api_instance = zhs_api.SystemApi(api_client)
    user_id = 56 # int | 目标用户 ID
    status = 'status_example' # str | 0=正常 1=停用

    try:
        # 启用 / 禁用用户
        api_response = api_instance.change_user_status_api_v1_system_change_status_put(user_id, status)
        print("The response of SystemApi->change_user_status_api_v1_system_change_status_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->change_user_status_api_v1_system_change_status_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **user_id** | **int**| 目标用户 ID | 
 **status** | **str**| 0&#x3D;正常 1&#x3D;停用 | 

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

# **export_users_api_v1_system_user_export_get**
> object export_users_api_v1_system_user_export_get()

导出用户列表到Excel

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # 导出用户列表到Excel
        api_response = api_instance.export_users_api_v1_system_user_export_get()
        print("The response of SystemApi->export_users_api_v1_system_user_export_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->export_users_api_v1_system_user_export_get: %s\n" % e)
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

# **get_dict_api_v1_system_dict_dict_type_get**
> object get_dict_api_v1_system_dict_dict_type_get(dict_type)

Get dictionary data

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
    api_instance = zhs_api.SystemApi(api_client)
    dict_type = 'dict_type_example' # str | 

    try:
        # Get dictionary data
        api_response = api_instance.get_dict_api_v1_system_dict_dict_type_get(dict_type)
        print("The response of SystemApi->get_dict_api_v1_system_dict_dict_type_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->get_dict_api_v1_system_dict_dict_type_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dict_type** | **str**|  | 

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

# **get_dict_data_by_type_api_v1_system_dict_data_type_dict_type_get**
> object get_dict_data_by_type_api_v1_system_dict_data_type_dict_type_get(dict_type)

按字典类型获取数据

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
    api_instance = zhs_api.SystemApi(api_client)
    dict_type = 'dict_type_example' # str | 

    try:
        # 按字典类型获取数据
        api_response = api_instance.get_dict_data_by_type_api_v1_system_dict_data_type_dict_type_get(dict_type)
        print("The response of SystemApi->get_dict_data_by_type_api_v1_system_dict_data_type_dict_type_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->get_dict_data_by_type_api_v1_system_dict_data_type_dict_type_get: %s\n" % e)
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

# **get_login_user_info_alias_api_v1_system_user_get_info_get**
> object get_login_user_info_alias_api_v1_system_user_get_info_get()

获取当前登录用户信息 (别名)

前端调用 /system/user/getInfo 的别名，复用 /getInfo 逻辑。

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # 获取当前登录用户信息 (别名)
        api_response = api_instance.get_login_user_info_alias_api_v1_system_user_get_info_get()
        print("The response of SystemApi->get_login_user_info_alias_api_v1_system_user_get_info_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->get_login_user_info_alias_api_v1_system_user_get_info_get: %s\n" % e)
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

# **get_login_user_info_api_v1_system_get_info_get**
> object get_login_user_info_api_v1_system_get_info_get()

获取当前登录用户信息(含角色与权限)

替代前端 mock，从数据库实时查询当前用户的角色和权限。

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # 获取当前登录用户信息(含角色与权限)
        api_response = api_instance.get_login_user_info_api_v1_system_get_info_get()
        print("The response of SystemApi->get_login_user_info_api_v1_system_get_info_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->get_login_user_info_api_v1_system_get_info_get: %s\n" % e)
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

# **get_routers_api_v1_system_menu_get_routers_get**
> object get_routers_api_v1_system_menu_get_routers_get()

获取路由菜单树 (RuoYi 兼容)

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # 获取路由菜单树 (RuoYi 兼容)
        api_response = api_instance.get_routers_api_v1_system_menu_get_routers_get()
        print("The response of SystemApi->get_routers_api_v1_system_menu_get_routers_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->get_routers_api_v1_system_menu_get_routers_get: %s\n" % e)
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

# **get_user_profile_api_v1_system_user_profile_get**
> object get_user_profile_api_v1_system_user_profile_get()

获取个人详细资料

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # 获取个人详细资料
        api_response = api_instance.get_user_profile_api_v1_system_user_profile_get()
        print("The response of SystemApi->get_user_profile_api_v1_system_user_profile_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->get_user_profile_api_v1_system_user_profile_get: %s\n" % e)
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

# **list_configs_api_v1_system_config_list_get**
> object list_configs_api_v1_system_config_list_get()

List system configs

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # List system configs
        api_response = api_instance.list_configs_api_v1_system_config_list_get()
        print("The response of SystemApi->list_configs_api_v1_system_config_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->list_configs_api_v1_system_config_list_get: %s\n" % e)
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

# **list_depts_api_v1_system_dept_list_get**
> object list_depts_api_v1_system_dept_list_get()

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # 部门列表
        api_response = api_instance.list_depts_api_v1_system_dept_list_get()
        print("The response of SystemApi->list_depts_api_v1_system_dept_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->list_depts_api_v1_system_dept_list_get: %s\n" % e)
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

# **list_dict_data_api_v1_system_dict_data_list_get**
> object list_dict_data_api_v1_system_dict_data_list_get(dict_type)

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
    api_instance = zhs_api.SystemApi(api_client)
    dict_type = 'dict_type_example' # str | 

    try:
        # 字典数据列表
        api_response = api_instance.list_dict_data_api_v1_system_dict_data_list_get(dict_type)
        print("The response of SystemApi->list_dict_data_api_v1_system_dict_data_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->list_dict_data_api_v1_system_dict_data_list_get: %s\n" % e)
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

# **list_dict_types_api_v1_system_dict_type_list_get**
> object list_dict_types_api_v1_system_dict_type_list_get()

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # 字典类型列表
        api_response = api_instance.list_dict_types_api_v1_system_dict_type_list_get()
        print("The response of SystemApi->list_dict_types_api_v1_system_dict_type_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->list_dict_types_api_v1_system_dict_type_list_get: %s\n" % e)
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

# **list_menus_api_v1_system_menu_list_get**
> object list_menus_api_v1_system_menu_list_get()

List menus

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # List menus
        api_response = api_instance.list_menus_api_v1_system_menu_list_get()
        print("The response of SystemApi->list_menus_api_v1_system_menu_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->list_menus_api_v1_system_menu_list_get: %s\n" % e)
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

# **list_posts_api_v1_system_post_list_get**
> object list_posts_api_v1_system_post_list_get()

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # 岗位列表
        api_response = api_instance.list_posts_api_v1_system_post_list_get()
        print("The response of SystemApi->list_posts_api_v1_system_post_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->list_posts_api_v1_system_post_list_get: %s\n" % e)
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

# **list_roles_api_v1_system_role_list_get**
> object list_roles_api_v1_system_role_list_get()

List roles

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # List roles
        api_response = api_instance.list_roles_api_v1_system_role_list_get()
        print("The response of SystemApi->list_roles_api_v1_system_role_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->list_roles_api_v1_system_role_list_get: %s\n" % e)
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

# **list_sys_users_api_v1_system_user_list_get**
> object list_sys_users_api_v1_system_user_list_get(page=page, limit=limit)

List system users

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
    api_instance = zhs_api.SystemApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # List system users
        api_response = api_instance.list_sys_users_api_v1_system_user_list_get(page=page, limit=limit)
        print("The response of SystemApi->list_sys_users_api_v1_system_user_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->list_sys_users_api_v1_system_user_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **menu_treeselect_api_v1_system_menu_treeselect_get**
> object menu_treeselect_api_v1_system_menu_treeselect_get()

菜单树选择

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
    api_instance = zhs_api.SystemApi(api_client)

    try:
        # 菜单树选择
        api_response = api_instance.menu_treeselect_api_v1_system_menu_treeselect_get()
        print("The response of SystemApi->menu_treeselect_api_v1_system_menu_treeselect_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->menu_treeselect_api_v1_system_menu_treeselect_get: %s\n" % e)
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

# **reset_user_pwd_api_v1_system_reset_pwd_put**
> object reset_user_pwd_api_v1_system_reset_pwd_put(user_id, new_password)

管理员重置用户密码

管理员无需旧密码即可重置指定用户的登录密码。

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
    api_instance = zhs_api.SystemApi(api_client)
    user_id = 56 # int | 目标用户 ID
    new_password = 'new_password_example' # str | 新密码

    try:
        # 管理员重置用户密码
        api_response = api_instance.reset_user_pwd_api_v1_system_reset_pwd_put(user_id, new_password)
        print("The response of SystemApi->reset_user_pwd_api_v1_system_reset_pwd_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->reset_user_pwd_api_v1_system_reset_pwd_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **user_id** | **int**| 目标用户 ID | 
 **new_password** | **str**| 新密码 | 

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

# **update_own_password_api_v1_system_user_profile_update_pwd_put**
> object update_own_password_api_v1_system_user_profile_update_pwd_put(body_update_own_password_api_v1_system_user_profile_update_pwd_put)

修改个人密码

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.body_update_own_password_api_v1_system_user_profile_update_pwd_put import BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut
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
    api_instance = zhs_api.SystemApi(api_client)
    body_update_own_password_api_v1_system_user_profile_update_pwd_put = zhs_api.BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut() # BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut | 

    try:
        # 修改个人密码
        api_response = api_instance.update_own_password_api_v1_system_user_profile_update_pwd_put(body_update_own_password_api_v1_system_user_profile_update_pwd_put)
        print("The response of SystemApi->update_own_password_api_v1_system_user_profile_update_pwd_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->update_own_password_api_v1_system_user_profile_update_pwd_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_update_own_password_api_v1_system_user_profile_update_pwd_put** | [**BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut**](BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut.md)|  | 

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

# **update_user_profile_api_v1_system_user_profile_put**
> object update_user_profile_api_v1_system_user_profile_put(body_update_user_profile_api_v1_system_user_profile_put=body_update_user_profile_api_v1_system_user_profile_put)

修改个人信息

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.body_update_user_profile_api_v1_system_user_profile_put import BodyUpdateUserProfileApiV1SystemUserProfilePut
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
    api_instance = zhs_api.SystemApi(api_client)
    body_update_user_profile_api_v1_system_user_profile_put = zhs_api.BodyUpdateUserProfileApiV1SystemUserProfilePut() # BodyUpdateUserProfileApiV1SystemUserProfilePut |  (optional)

    try:
        # 修改个人信息
        api_response = api_instance.update_user_profile_api_v1_system_user_profile_put(body_update_user_profile_api_v1_system_user_profile_put=body_update_user_profile_api_v1_system_user_profile_put)
        print("The response of SystemApi->update_user_profile_api_v1_system_user_profile_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->update_user_profile_api_v1_system_user_profile_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_update_user_profile_api_v1_system_user_profile_put** | [**BodyUpdateUserProfileApiV1SystemUserProfilePut**](BodyUpdateUserProfileApiV1SystemUserProfilePut.md)|  | [optional] 

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

# **upload_avatar_api_v1_system_user_profile_avatar_post**
> object upload_avatar_api_v1_system_user_profile_avatar_post(file)

上传头像

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
    api_instance = zhs_api.SystemApi(api_client)
    file = None # bytes | 

    try:
        # 上传头像
        api_response = api_instance.upload_avatar_api_v1_system_user_profile_avatar_post(file)
        print("The response of SystemApi->upload_avatar_api_v1_system_user_profile_avatar_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemApi->upload_avatar_api_v1_system_user_profile_avatar_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | **bytes**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

