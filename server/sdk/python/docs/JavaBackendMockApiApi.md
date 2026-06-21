# zhs_api.JavaBackendMockApiApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mock_add_plaza_model**](JavaBackendMockApiApi.md#mock_add_plaza_model) | **POST** /api/category/addPlazaModel | Mock: 添加 Plaza 模型
[**mock_admin_login**](JavaBackendMockApiApi.md#mock_admin_login) | **POST** /api/admin/login | Mock Admin Login
[**mock_admin_menus**](JavaBackendMockApiApi.md#mock_admin_menus) | **GET** /api/admin/menus | Mock Admin Menus
[**mock_admin_roles**](JavaBackendMockApiApi.md#mock_admin_roles) | **GET** /api/admin/roles | Mock Admin Roles
[**mock_admin_users**](JavaBackendMockApiApi.md#mock_admin_users) | **GET** /api/admin/users | Mock Admin Users
[**mock_agent_bylink**](JavaBackendMockApiApi.md#mock_agent_bylink) | **GET** /api/agent/rule/search/bylink | Mock Agent Bylink
[**mock_agent_categories**](JavaBackendMockApiApi.md#mock_agent_categories) | **GET** /api/agent/categories | Mock Agent Categories
[**mock_agent_collect**](JavaBackendMockApiApi.md#mock_agent_collect) | **POST** /api/agent/collect/{agent_id} | Mock Agent Collect
[**mock_agent_like**](JavaBackendMockApiApi.md#mock_agent_like) | **POST** /api/agent/like/{agent_id} | Mock Agent Like
[**mock_agents_categories**](JavaBackendMockApiApi.md#mock_agents_categories) | **GET** /api/agents/categories | Mock Agents Categories
[**mock_ai_chat**](JavaBackendMockApiApi.md#mock_ai_chat) | **POST** /api/ai/chat | Mock Ai Chat
[**mock_ai_generate**](JavaBackendMockApiApi.md#mock_ai_generate) | **POST** /api/ai/generate | Mock Ai Generate
[**mock_ai_models**](JavaBackendMockApiApi.md#mock_ai_models) | **GET** /api/ai/models | Mock Ai Models
[**mock_ai_program_login**](JavaBackendMockApiApi.md#mock_ai_program_login) | **POST** /api/ai-program/login/pwd/login | Mock Ai Program Login
[**mock_ai_program_plaza**](JavaBackendMockApiApi.md#mock_ai_program_plaza) | **GET** /api/ai-program/plaza | Mock Ai Program Plaza
[**mock_audit_logs**](JavaBackendMockApiApi.md#mock_audit_logs) | **GET** /api/audit/logs | Mock Audit Logs
[**mock_audit_stats**](JavaBackendMockApiApi.md#mock_audit_stats) | **GET** /api/audit/stats | Mock Audit Stats
[**mock_auth_health**](JavaBackendMockApiApi.md#mock_auth_health) | **GET** /api/auth/health | Mock Auth Health
[**mock_auth_login_post**](JavaBackendMockApiApi.md#mock_auth_login_post) | **POST** /api/auth/login | Mock Auth Login Post
[**mock_auth_logout_post**](JavaBackendMockApiApi.md#mock_auth_logout_post) | **POST** /api/auth/logout | Mock Auth Logout Post
[**mock_auth_profile**](JavaBackendMockApiApi.md#mock_auth_profile) | **GET** /api/auth/profile | Mock Auth Profile
[**mock_auth_refresh_post**](JavaBackendMockApiApi.md#mock_auth_refresh_post) | **POST** /api/auth/refresh | Mock Auth Refresh Post
[**mock_auth_register_post**](JavaBackendMockApiApi.md#mock_auth_register_post) | **POST** /api/auth/register | Mock Auth Register Post
[**mock_auth_user_info**](JavaBackendMockApiApi.md#mock_auth_user_info) | **GET** /api/auth/user-info | Mock Auth User Info
[**mock_category_list**](JavaBackendMockApiApi.md#mock_category_list) | **GET** /api/category/list | Mock: 智能体分类列表
[**mock_courses_list**](JavaBackendMockApiApi.md#mock_courses_list) | **GET** /api/courses | Mock Courses List
[**mock_courses_my**](JavaBackendMockApiApi.md#mock_courses_my) | **GET** /api/courses/my | Mock Courses My
[**mock_cs_faqs**](JavaBackendMockApiApi.md#mock_cs_faqs) | **GET** /api/customer-service/faqs | Mock Cs Faqs
[**mock_cs_tickets**](JavaBackendMockApiApi.md#mock_cs_tickets) | **GET** /api/customer-service/tickets | Mock Cs Tickets
[**mock_developer_models**](JavaBackendMockApiApi.md#mock_developer_models) | **GET** /api/developer/models | Mock: 开发者模型列表
[**mock_feature_flags**](JavaBackendMockApiApi.md#mock_feature_flags) | **GET** /api/feature-flags | Mock Feature Flags
[**mock_ff_experiments**](JavaBackendMockApiApi.md#mock_ff_experiments) | **GET** /api/feature-flags/experiments | Mock Ff Experiments
[**mock_fund_ali_pay**](JavaBackendMockApiApi.md#mock_fund_ali_pay) | **POST** /api/fund/ali/pay | Mock Fund Ali Pay
[**mock_fund_wx_pay**](JavaBackendMockApiApi.md#mock_fund_wx_pay) | **POST** /api/fund/wx/pay | Mock Fund Wx Pay
[**mock_login_pwd_login**](JavaBackendMockApiApi.md#mock_login_pwd_login) | **POST** /api/login/pwd/login | Mock Login Pwd Login
[**mock_login_pwd_refresh**](JavaBackendMockApiApi.md#mock_login_pwd_refresh) | **POST** /api/login/pwd/refreshToken | Mock Login Pwd Refresh
[**mock_login_pwd_register**](JavaBackendMockApiApi.md#mock_login_pwd_register) | **POST** /api/login/pwd/registerLogin | Mock Login Pwd Register
[**mock_login_pwd_sms_verify**](JavaBackendMockApiApi.md#mock_login_pwd_sms_verify) | **POST** /api/login/pwd/smsVerify | Mock Login Pwd Sms Verify
[**mock_login_pwd_verify**](JavaBackendMockApiApi.md#mock_login_pwd_verify) | **POST** /api/login/pwd/verify | Mock Login Pwd Verify
[**mock_mobile_orders**](JavaBackendMockApiApi.md#mock_mobile_orders) | **GET** /api/mobile/orders/list | Mock Mobile Orders
[**mock_models_pricing**](JavaBackendMockApiApi.md#mock_models_pricing) | **GET** /api/models/pricing | Mock Models Pricing
[**mock_monitor_collect**](JavaBackendMockApiApi.md#mock_monitor_collect) | **POST** /api/monitor/collect | Mock: 前端监控埋点
[**mock_monitor_error**](JavaBackendMockApiApi.md#mock_monitor_error) | **POST** /api/monitor/error | Mock: 前端错误上报
[**mock_monitor_perf**](JavaBackendMockApiApi.md#mock_monitor_perf) | **POST** /api/monitor/performance | Mock: 前端性能上报
[**mock_openclaw_sessions**](JavaBackendMockApiApi.md#mock_openclaw_sessions) | **GET** /api/openclaw/sessions | Mock: OpenClaw 会话列表
[**mock_openclaw_tools**](JavaBackendMockApiApi.md#mock_openclaw_tools) | **GET** /api/openclaw/tools | Mock: OpenClaw 工具列表
[**mock_order_create**](JavaBackendMockApiApi.md#mock_order_create) | **POST** /api/order/create | Mock Order Create
[**mock_orders_list**](JavaBackendMockApiApi.md#mock_orders_list) | **GET** /api/orders | Mock Orders List
[**mock_payment_check**](JavaBackendMockApiApi.md#mock_payment_check) | **GET** /api/payment/checkOrderStatus | Mock Payment Check
[**mock_payment_create**](JavaBackendMockApiApi.md#mock_payment_create) | **POST** /api/payment/createOrder | Mock Payment Create
[**mock_plaza_demand_detail**](JavaBackendMockApiApi.md#mock_plaza_demand_detail) | **GET** /api/ai-program/plaza/demands/{demand_id} | Mock Plaza Demand Detail
[**mock_plaza_demands_list**](JavaBackendMockApiApi.md#mock_plaza_demands_list) | **GET** /api/ai-program/plaza/demands/list | Mock Plaza Demands List
[**mock_plaza_info**](JavaBackendMockApiApi.md#mock_plaza_info) | **GET** /api/category/getPlazaInfoById/{category_id} | Mock: Plaza 分类详情
[**mock_plaza_list**](JavaBackendMockApiApi.md#mock_plaza_list) | **GET** /api/category/getPlazaList | Mock: Plaza 分类列表
[**mock_recharge_config**](JavaBackendMockApiApi.md#mock_recharge_config) | **GET** /api/recharge/config | Mock Recharge Config
[**mock_recharge_create**](JavaBackendMockApiApi.md#mock_recharge_create) | **POST** /api/recharge/create | Mock Recharge Create
[**mock_sa_list**](JavaBackendMockApiApi.md#mock_sa_list) | **GET** /api/service-appointment | Mock Sa List
[**mock_skills_list**](JavaBackendMockApiApi.md#mock_skills_list) | **GET** /api/skills/list | Mock Skills List
[**mock_skills_metadata**](JavaBackendMockApiApi.md#mock_skills_metadata) | **GET** /api/skills/metadata | Mock Skills Metadata
[**mock_speech_token**](JavaBackendMockApiApi.md#mock_speech_token) | **GET** /api/speech/baidu/token | Mock Speech Token
[**mock_stats_dashboard**](JavaBackendMockApiApi.md#mock_stats_dashboard) | **GET** /api/statistics/dashboard | Mock: 仪表盘统计
[**mock_stats_overview**](JavaBackendMockApiApi.md#mock_stats_overview) | **GET** /api/statistics/overview | Mock: 总览统计
[**mock_unified_ai_caps**](JavaBackendMockApiApi.md#mock_unified_ai_caps) | **GET** /api/unified-ai/capabilities | Mock Unified Ai Caps
[**mock_unified_ai_invoke**](JavaBackendMockApiApi.md#mock_unified_ai_invoke) | **POST** /api/unified-ai/invoke | Mock Unified Ai Invoke
[**mock_upload_file_delete**](JavaBackendMockApiApi.md#mock_upload_file_delete) | **DELETE** /api/upload/file/{file_id} | Mock Upload File Delete
[**mock_upload_files**](JavaBackendMockApiApi.md#mock_upload_files) | **POST** /api/upload/files | Mock Upload Files
[**mock_upload_single**](JavaBackendMockApiApi.md#mock_upload_single) | **POST** /api/upload/single | Mock Upload Single
[**mock_user_api_balance**](JavaBackendMockApiApi.md#mock_user_api_balance) | **GET** /api/user/api-balance | Mock User Api Balance
[**mock_user_api_tokens**](JavaBackendMockApiApi.md#mock_user_api_tokens) | **GET** /api/user/api-tokens | Mock User Api Tokens
[**mock_user_api_usage_stats**](JavaBackendMockApiApi.md#mock_user_api_usage_stats) | **GET** /api/user/api-usage/stats | Mock User Api Usage Stats
[**mock_user_get_info**](JavaBackendMockApiApi.md#mock_user_get_info) | **GET** /api/user/getUserInfo | Mock User Get Info
[**mock_user_login_post**](JavaBackendMockApiApi.md#mock_user_login_post) | **POST** /api/user/login | Mock User Login Post
[**mock_user_logout_post**](JavaBackendMockApiApi.md#mock_user_logout_post) | **POST** /api/user/logout | Mock User Logout Post
[**mock_user_profile**](JavaBackendMockApiApi.md#mock_user_profile) | **GET** /api/user/profile | Mock User Profile
[**mock_user_profile_put**](JavaBackendMockApiApi.md#mock_user_profile_put) | **PUT** /api/user/profile | Mock User Profile Put
[**mock_vip_levels**](JavaBackendMockApiApi.md#mock_vip_levels) | **GET** /api/vip/levels | Mock Vip Levels
[**mock_vip_order_create**](JavaBackendMockApiApi.md#mock_vip_order_create) | **POST** /api/vip/order/create | Mock Vip Order Create
[**mock_vip_plans**](JavaBackendMockApiApi.md#mock_vip_plans) | **GET** /api/vip/plans | Mock Vip Plans
[**mock_vip_privileges**](JavaBackendMockApiApi.md#mock_vip_privileges) | **GET** /api/vip/privileges | Mock Vip Privileges
[**mock_wallet_info**](JavaBackendMockApiApi.md#mock_wallet_info) | **GET** /api/wallet/info | Mock Wallet Info
[**mock_wallet_transactions**](JavaBackendMockApiApi.md#mock_wallet_transactions) | **GET** /api/wallet/transactions | Mock Wallet Transactions


# **mock_add_plaza_model**
> object mock_add_plaza_model()

Mock: 添加 Plaza 模型

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: 添加 Plaza 模型
        api_response = api_instance.mock_add_plaza_model()
        print("The response of JavaBackendMockApiApi->mock_add_plaza_model:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_add_plaza_model: %s\n" % e)
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

# **mock_admin_login**
> object mock_admin_login()

Mock Admin Login

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Admin Login
        api_response = api_instance.mock_admin_login()
        print("The response of JavaBackendMockApiApi->mock_admin_login:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_admin_login: %s\n" % e)
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

# **mock_admin_menus**
> object mock_admin_menus()

Mock Admin Menus

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Admin Menus
        api_response = api_instance.mock_admin_menus()
        print("The response of JavaBackendMockApiApi->mock_admin_menus:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_admin_menus: %s\n" % e)
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

# **mock_admin_roles**
> object mock_admin_roles()

Mock Admin Roles

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Admin Roles
        api_response = api_instance.mock_admin_roles()
        print("The response of JavaBackendMockApiApi->mock_admin_roles:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_admin_roles: %s\n" % e)
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

# **mock_admin_users**
> object mock_admin_users()

Mock Admin Users

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Admin Users
        api_response = api_instance.mock_admin_users()
        print("The response of JavaBackendMockApiApi->mock_admin_users:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_admin_users: %s\n" % e)
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

# **mock_agent_bylink**
> object mock_agent_bylink()

Mock Agent Bylink

返回按主分类分组的智能体列表 (兼容前端 AgentsSquareList 期望格式).

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Agent Bylink
        api_response = api_instance.mock_agent_bylink()
        print("The response of JavaBackendMockApiApi->mock_agent_bylink:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_agent_bylink: %s\n" % e)
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

# **mock_agent_categories**
> object mock_agent_categories()

Mock Agent Categories

返回智能体分类 (主分类 + 子分类).

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Agent Categories
        api_response = api_instance.mock_agent_categories()
        print("The response of JavaBackendMockApiApi->mock_agent_categories:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_agent_categories: %s\n" % e)
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

# **mock_agent_collect**
> object mock_agent_collect(agent_id)

Mock Agent Collect

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)
    agent_id = 'agent_id_example' # str | 

    try:
        # Mock Agent Collect
        api_response = api_instance.mock_agent_collect(agent_id)
        print("The response of JavaBackendMockApiApi->mock_agent_collect:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_agent_collect: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 

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

# **mock_agent_like**
> object mock_agent_like(agent_id)

Mock Agent Like

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)
    agent_id = 'agent_id_example' # str | 

    try:
        # Mock Agent Like
        api_response = api_instance.mock_agent_like(agent_id)
        print("The response of JavaBackendMockApiApi->mock_agent_like:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_agent_like: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 

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

# **mock_agents_categories**
> object mock_agents_categories()

Mock Agents Categories

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Agents Categories
        api_response = api_instance.mock_agents_categories()
        print("The response of JavaBackendMockApiApi->mock_agents_categories:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_agents_categories: %s\n" % e)
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

# **mock_ai_chat**
> object mock_ai_chat()

Mock Ai Chat

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Ai Chat
        api_response = api_instance.mock_ai_chat()
        print("The response of JavaBackendMockApiApi->mock_ai_chat:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_ai_chat: %s\n" % e)
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

# **mock_ai_generate**
> object mock_ai_generate()

Mock Ai Generate

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Ai Generate
        api_response = api_instance.mock_ai_generate()
        print("The response of JavaBackendMockApiApi->mock_ai_generate:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_ai_generate: %s\n" % e)
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

# **mock_ai_models**
> object mock_ai_models()

Mock Ai Models

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Ai Models
        api_response = api_instance.mock_ai_models()
        print("The response of JavaBackendMockApiApi->mock_ai_models:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_ai_models: %s\n" % e)
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

# **mock_ai_program_login**
> object mock_ai_program_login()

Mock Ai Program Login

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Ai Program Login
        api_response = api_instance.mock_ai_program_login()
        print("The response of JavaBackendMockApiApi->mock_ai_program_login:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_ai_program_login: %s\n" % e)
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

# **mock_ai_program_plaza**
> object mock_ai_program_plaza()

Mock Ai Program Plaza

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Ai Program Plaza
        api_response = api_instance.mock_ai_program_plaza()
        print("The response of JavaBackendMockApiApi->mock_ai_program_plaza:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_ai_program_plaza: %s\n" % e)
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

# **mock_audit_logs**
> object mock_audit_logs()

Mock Audit Logs

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Audit Logs
        api_response = api_instance.mock_audit_logs()
        print("The response of JavaBackendMockApiApi->mock_audit_logs:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_audit_logs: %s\n" % e)
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

# **mock_audit_stats**
> object mock_audit_stats()

Mock Audit Stats

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Audit Stats
        api_response = api_instance.mock_audit_stats()
        print("The response of JavaBackendMockApiApi->mock_audit_stats:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_audit_stats: %s\n" % e)
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

# **mock_auth_health**
> object mock_auth_health()

Mock Auth Health

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Auth Health
        api_response = api_instance.mock_auth_health()
        print("The response of JavaBackendMockApiApi->mock_auth_health:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_auth_health: %s\n" % e)
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

# **mock_auth_login_post**
> object mock_auth_login_post()

Mock Auth Login Post

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Auth Login Post
        api_response = api_instance.mock_auth_login_post()
        print("The response of JavaBackendMockApiApi->mock_auth_login_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_auth_login_post: %s\n" % e)
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

# **mock_auth_logout_post**
> object mock_auth_logout_post()

Mock Auth Logout Post

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Auth Logout Post
        api_response = api_instance.mock_auth_logout_post()
        print("The response of JavaBackendMockApiApi->mock_auth_logout_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_auth_logout_post: %s\n" % e)
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

# **mock_auth_profile**
> object mock_auth_profile()

Mock Auth Profile

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Auth Profile
        api_response = api_instance.mock_auth_profile()
        print("The response of JavaBackendMockApiApi->mock_auth_profile:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_auth_profile: %s\n" % e)
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

# **mock_auth_refresh_post**
> object mock_auth_refresh_post()

Mock Auth Refresh Post

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Auth Refresh Post
        api_response = api_instance.mock_auth_refresh_post()
        print("The response of JavaBackendMockApiApi->mock_auth_refresh_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_auth_refresh_post: %s\n" % e)
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

# **mock_auth_register_post**
> object mock_auth_register_post()

Mock Auth Register Post

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Auth Register Post
        api_response = api_instance.mock_auth_register_post()
        print("The response of JavaBackendMockApiApi->mock_auth_register_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_auth_register_post: %s\n" % e)
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

# **mock_auth_user_info**
> object mock_auth_user_info()

Mock Auth User Info

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Auth User Info
        api_response = api_instance.mock_auth_user_info()
        print("The response of JavaBackendMockApiApi->mock_auth_user_info:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_auth_user_info: %s\n" % e)
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

# **mock_category_list**
> object mock_category_list()

Mock: 智能体分类列表

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: 智能体分类列表
        api_response = api_instance.mock_category_list()
        print("The response of JavaBackendMockApiApi->mock_category_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_category_list: %s\n" % e)
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

# **mock_courses_list**
> object mock_courses_list()

Mock Courses List

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Courses List
        api_response = api_instance.mock_courses_list()
        print("The response of JavaBackendMockApiApi->mock_courses_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_courses_list: %s\n" % e)
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

# **mock_courses_my**
> object mock_courses_my()

Mock Courses My

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Courses My
        api_response = api_instance.mock_courses_my()
        print("The response of JavaBackendMockApiApi->mock_courses_my:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_courses_my: %s\n" % e)
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

# **mock_cs_faqs**
> object mock_cs_faqs()

Mock Cs Faqs

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Cs Faqs
        api_response = api_instance.mock_cs_faqs()
        print("The response of JavaBackendMockApiApi->mock_cs_faqs:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_cs_faqs: %s\n" % e)
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

# **mock_cs_tickets**
> object mock_cs_tickets()

Mock Cs Tickets

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Cs Tickets
        api_response = api_instance.mock_cs_tickets()
        print("The response of JavaBackendMockApiApi->mock_cs_tickets:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_cs_tickets: %s\n" % e)
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

# **mock_developer_models**
> object mock_developer_models()

Mock: 开发者模型列表

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: 开发者模型列表
        api_response = api_instance.mock_developer_models()
        print("The response of JavaBackendMockApiApi->mock_developer_models:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_developer_models: %s\n" % e)
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

# **mock_feature_flags**
> object mock_feature_flags()

Mock Feature Flags

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Feature Flags
        api_response = api_instance.mock_feature_flags()
        print("The response of JavaBackendMockApiApi->mock_feature_flags:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_feature_flags: %s\n" % e)
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

# **mock_ff_experiments**
> object mock_ff_experiments()

Mock Ff Experiments

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Ff Experiments
        api_response = api_instance.mock_ff_experiments()
        print("The response of JavaBackendMockApiApi->mock_ff_experiments:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_ff_experiments: %s\n" % e)
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

# **mock_fund_ali_pay**
> object mock_fund_ali_pay()

Mock Fund Ali Pay

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Fund Ali Pay
        api_response = api_instance.mock_fund_ali_pay()
        print("The response of JavaBackendMockApiApi->mock_fund_ali_pay:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_fund_ali_pay: %s\n" % e)
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

# **mock_fund_wx_pay**
> object mock_fund_wx_pay()

Mock Fund Wx Pay

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Fund Wx Pay
        api_response = api_instance.mock_fund_wx_pay()
        print("The response of JavaBackendMockApiApi->mock_fund_wx_pay:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_fund_wx_pay: %s\n" % e)
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

# **mock_login_pwd_login**
> object mock_login_pwd_login()

Mock Login Pwd Login

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Login Pwd Login
        api_response = api_instance.mock_login_pwd_login()
        print("The response of JavaBackendMockApiApi->mock_login_pwd_login:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_login_pwd_login: %s\n" % e)
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

# **mock_login_pwd_refresh**
> object mock_login_pwd_refresh()

Mock Login Pwd Refresh

刷新 token - mock 返回真实 JWT, 让前端后续请求能通过鉴权.

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Login Pwd Refresh
        api_response = api_instance.mock_login_pwd_refresh()
        print("The response of JavaBackendMockApiApi->mock_login_pwd_refresh:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_login_pwd_refresh: %s\n" % e)
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

# **mock_login_pwd_register**
> object mock_login_pwd_register()

Mock Login Pwd Register

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Login Pwd Register
        api_response = api_instance.mock_login_pwd_register()
        print("The response of JavaBackendMockApiApi->mock_login_pwd_register:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_login_pwd_register: %s\n" % e)
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

# **mock_login_pwd_sms_verify**
> object mock_login_pwd_sms_verify()

Mock Login Pwd Sms Verify

发送手机验证码 - mock 始终返回成功, 但有 60s 限流 (Redis 持久化).

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Login Pwd Sms Verify
        api_response = api_instance.mock_login_pwd_sms_verify()
        print("The response of JavaBackendMockApiApi->mock_login_pwd_sms_verify:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_login_pwd_sms_verify: %s\n" % e)
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

# **mock_login_pwd_verify**
> object mock_login_pwd_verify()

Mock Login Pwd Verify

验证手机验证码 - mock 始终返回临时密钥.

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Login Pwd Verify
        api_response = api_instance.mock_login_pwd_verify()
        print("The response of JavaBackendMockApiApi->mock_login_pwd_verify:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_login_pwd_verify: %s\n" % e)
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

# **mock_mobile_orders**
> object mock_mobile_orders()

Mock Mobile Orders

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Mobile Orders
        api_response = api_instance.mock_mobile_orders()
        print("The response of JavaBackendMockApiApi->mock_mobile_orders:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_mobile_orders: %s\n" % e)
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

# **mock_models_pricing**
> object mock_models_pricing()

Mock Models Pricing

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Models Pricing
        api_response = api_instance.mock_models_pricing()
        print("The response of JavaBackendMockApiApi->mock_models_pricing:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_models_pricing: %s\n" % e)
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

# **mock_monitor_collect**
> object mock_monitor_collect()

Mock: 前端监控埋点

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: 前端监控埋点
        api_response = api_instance.mock_monitor_collect()
        print("The response of JavaBackendMockApiApi->mock_monitor_collect:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_monitor_collect: %s\n" % e)
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

# **mock_monitor_error**
> object mock_monitor_error()

Mock: 前端错误上报

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: 前端错误上报
        api_response = api_instance.mock_monitor_error()
        print("The response of JavaBackendMockApiApi->mock_monitor_error:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_monitor_error: %s\n" % e)
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

# **mock_monitor_perf**
> object mock_monitor_perf()

Mock: 前端性能上报

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: 前端性能上报
        api_response = api_instance.mock_monitor_perf()
        print("The response of JavaBackendMockApiApi->mock_monitor_perf:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_monitor_perf: %s\n" % e)
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

# **mock_openclaw_sessions**
> object mock_openclaw_sessions()

Mock: OpenClaw 会话列表

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: OpenClaw 会话列表
        api_response = api_instance.mock_openclaw_sessions()
        print("The response of JavaBackendMockApiApi->mock_openclaw_sessions:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_openclaw_sessions: %s\n" % e)
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

# **mock_openclaw_tools**
> object mock_openclaw_tools()

Mock: OpenClaw 工具列表

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: OpenClaw 工具列表
        api_response = api_instance.mock_openclaw_tools()
        print("The response of JavaBackendMockApiApi->mock_openclaw_tools:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_openclaw_tools: %s\n" % e)
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

# **mock_order_create**
> object mock_order_create()

Mock Order Create

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Order Create
        api_response = api_instance.mock_order_create()
        print("The response of JavaBackendMockApiApi->mock_order_create:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_order_create: %s\n" % e)
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

# **mock_orders_list**
> object mock_orders_list()

Mock Orders List

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Orders List
        api_response = api_instance.mock_orders_list()
        print("The response of JavaBackendMockApiApi->mock_orders_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_orders_list: %s\n" % e)
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

# **mock_payment_check**
> object mock_payment_check()

Mock Payment Check

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Payment Check
        api_response = api_instance.mock_payment_check()
        print("The response of JavaBackendMockApiApi->mock_payment_check:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_payment_check: %s\n" % e)
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

# **mock_payment_create**
> object mock_payment_create()

Mock Payment Create

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Payment Create
        api_response = api_instance.mock_payment_create()
        print("The response of JavaBackendMockApiApi->mock_payment_create:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_payment_create: %s\n" % e)
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

# **mock_plaza_demand_detail**
> object mock_plaza_demand_detail(demand_id)

Mock Plaza Demand Detail

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)
    demand_id = 56 # int | 

    try:
        # Mock Plaza Demand Detail
        api_response = api_instance.mock_plaza_demand_detail(demand_id)
        print("The response of JavaBackendMockApiApi->mock_plaza_demand_detail:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_plaza_demand_detail: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **demand_id** | **int**|  | 

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

# **mock_plaza_demands_list**
> object mock_plaza_demands_list()

Mock Plaza Demands List

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Plaza Demands List
        api_response = api_instance.mock_plaza_demands_list()
        print("The response of JavaBackendMockApiApi->mock_plaza_demands_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_plaza_demands_list: %s\n" % e)
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

# **mock_plaza_info**
> object mock_plaza_info(category_id)

Mock: Plaza 分类详情

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)
    category_id = 56 # int | 

    try:
        # Mock: Plaza 分类详情
        api_response = api_instance.mock_plaza_info(category_id)
        print("The response of JavaBackendMockApiApi->mock_plaza_info:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_plaza_info: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **category_id** | **int**|  | 

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

# **mock_plaza_list**
> object mock_plaza_list()

Mock: Plaza 分类列表

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: Plaza 分类列表
        api_response = api_instance.mock_plaza_list()
        print("The response of JavaBackendMockApiApi->mock_plaza_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_plaza_list: %s\n" % e)
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

# **mock_recharge_config**
> object mock_recharge_config()

Mock Recharge Config

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Recharge Config
        api_response = api_instance.mock_recharge_config()
        print("The response of JavaBackendMockApiApi->mock_recharge_config:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_recharge_config: %s\n" % e)
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

# **mock_recharge_create**
> object mock_recharge_create()

Mock Recharge Create

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Recharge Create
        api_response = api_instance.mock_recharge_create()
        print("The response of JavaBackendMockApiApi->mock_recharge_create:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_recharge_create: %s\n" % e)
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

# **mock_sa_list**
> object mock_sa_list()

Mock Sa List

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Sa List
        api_response = api_instance.mock_sa_list()
        print("The response of JavaBackendMockApiApi->mock_sa_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_sa_list: %s\n" % e)
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

# **mock_skills_list**
> object mock_skills_list()

Mock Skills List

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Skills List
        api_response = api_instance.mock_skills_list()
        print("The response of JavaBackendMockApiApi->mock_skills_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_skills_list: %s\n" % e)
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

# **mock_skills_metadata**
> object mock_skills_metadata()

Mock Skills Metadata

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Skills Metadata
        api_response = api_instance.mock_skills_metadata()
        print("The response of JavaBackendMockApiApi->mock_skills_metadata:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_skills_metadata: %s\n" % e)
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

# **mock_speech_token**
> object mock_speech_token()

Mock Speech Token

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Speech Token
        api_response = api_instance.mock_speech_token()
        print("The response of JavaBackendMockApiApi->mock_speech_token:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_speech_token: %s\n" % e)
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

# **mock_stats_dashboard**
> object mock_stats_dashboard()

Mock: 仪表盘统计

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: 仪表盘统计
        api_response = api_instance.mock_stats_dashboard()
        print("The response of JavaBackendMockApiApi->mock_stats_dashboard:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_stats_dashboard: %s\n" % e)
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

# **mock_stats_overview**
> object mock_stats_overview()

Mock: 总览统计

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock: 总览统计
        api_response = api_instance.mock_stats_overview()
        print("The response of JavaBackendMockApiApi->mock_stats_overview:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_stats_overview: %s\n" % e)
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

# **mock_unified_ai_caps**
> object mock_unified_ai_caps()

Mock Unified Ai Caps

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Unified Ai Caps
        api_response = api_instance.mock_unified_ai_caps()
        print("The response of JavaBackendMockApiApi->mock_unified_ai_caps:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_unified_ai_caps: %s\n" % e)
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

# **mock_unified_ai_invoke**
> object mock_unified_ai_invoke()

Mock Unified Ai Invoke

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Unified Ai Invoke
        api_response = api_instance.mock_unified_ai_invoke()
        print("The response of JavaBackendMockApiApi->mock_unified_ai_invoke:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_unified_ai_invoke: %s\n" % e)
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

# **mock_upload_file_delete**
> object mock_upload_file_delete(file_id)

Mock Upload File Delete

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)
    file_id = 'file_id_example' # str | 

    try:
        # Mock Upload File Delete
        api_response = api_instance.mock_upload_file_delete(file_id)
        print("The response of JavaBackendMockApiApi->mock_upload_file_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_upload_file_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file_id** | **str**|  | 

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

# **mock_upload_files**
> object mock_upload_files()

Mock Upload Files

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Upload Files
        api_response = api_instance.mock_upload_files()
        print("The response of JavaBackendMockApiApi->mock_upload_files:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_upload_files: %s\n" % e)
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

# **mock_upload_single**
> object mock_upload_single()

Mock Upload Single

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Upload Single
        api_response = api_instance.mock_upload_single()
        print("The response of JavaBackendMockApiApi->mock_upload_single:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_upload_single: %s\n" % e)
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

# **mock_user_api_balance**
> object mock_user_api_balance()

Mock User Api Balance

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock User Api Balance
        api_response = api_instance.mock_user_api_balance()
        print("The response of JavaBackendMockApiApi->mock_user_api_balance:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_user_api_balance: %s\n" % e)
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

# **mock_user_api_tokens**
> object mock_user_api_tokens()

Mock User Api Tokens

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock User Api Tokens
        api_response = api_instance.mock_user_api_tokens()
        print("The response of JavaBackendMockApiApi->mock_user_api_tokens:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_user_api_tokens: %s\n" % e)
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

# **mock_user_api_usage_stats**
> object mock_user_api_usage_stats()

Mock User Api Usage Stats

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock User Api Usage Stats
        api_response = api_instance.mock_user_api_usage_stats()
        print("The response of JavaBackendMockApiApi->mock_user_api_usage_stats:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_user_api_usage_stats: %s\n" % e)
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

# **mock_user_get_info**
> object mock_user_get_info()

Mock User Get Info

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock User Get Info
        api_response = api_instance.mock_user_get_info()
        print("The response of JavaBackendMockApiApi->mock_user_get_info:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_user_get_info: %s\n" % e)
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

# **mock_user_login_post**
> object mock_user_login_post()

Mock User Login Post

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock User Login Post
        api_response = api_instance.mock_user_login_post()
        print("The response of JavaBackendMockApiApi->mock_user_login_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_user_login_post: %s\n" % e)
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

# **mock_user_logout_post**
> object mock_user_logout_post()

Mock User Logout Post

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock User Logout Post
        api_response = api_instance.mock_user_logout_post()
        print("The response of JavaBackendMockApiApi->mock_user_logout_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_user_logout_post: %s\n" % e)
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

# **mock_user_profile**
> object mock_user_profile()

Mock User Profile

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock User Profile
        api_response = api_instance.mock_user_profile()
        print("The response of JavaBackendMockApiApi->mock_user_profile:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_user_profile: %s\n" % e)
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

# **mock_user_profile_put**
> object mock_user_profile_put()

Mock User Profile Put

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock User Profile Put
        api_response = api_instance.mock_user_profile_put()
        print("The response of JavaBackendMockApiApi->mock_user_profile_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_user_profile_put: %s\n" % e)
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

# **mock_vip_levels**
> object mock_vip_levels()

Mock Vip Levels

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Vip Levels
        api_response = api_instance.mock_vip_levels()
        print("The response of JavaBackendMockApiApi->mock_vip_levels:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_vip_levels: %s\n" % e)
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

# **mock_vip_order_create**
> object mock_vip_order_create()

Mock Vip Order Create

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Vip Order Create
        api_response = api_instance.mock_vip_order_create()
        print("The response of JavaBackendMockApiApi->mock_vip_order_create:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_vip_order_create: %s\n" % e)
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

# **mock_vip_plans**
> object mock_vip_plans()

Mock Vip Plans

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Vip Plans
        api_response = api_instance.mock_vip_plans()
        print("The response of JavaBackendMockApiApi->mock_vip_plans:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_vip_plans: %s\n" % e)
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

# **mock_vip_privileges**
> object mock_vip_privileges()

Mock Vip Privileges

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Vip Privileges
        api_response = api_instance.mock_vip_privileges()
        print("The response of JavaBackendMockApiApi->mock_vip_privileges:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_vip_privileges: %s\n" % e)
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

# **mock_wallet_info**
> object mock_wallet_info()

Mock Wallet Info

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Wallet Info
        api_response = api_instance.mock_wallet_info()
        print("The response of JavaBackendMockApiApi->mock_wallet_info:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_wallet_info: %s\n" % e)
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

# **mock_wallet_transactions**
> object mock_wallet_transactions()

Mock Wallet Transactions

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
    api_instance = zhs_api.JavaBackendMockApiApi(api_client)

    try:
        # Mock Wallet Transactions
        api_response = api_instance.mock_wallet_transactions()
        print("The response of JavaBackendMockApiApi->mock_wallet_transactions:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling JavaBackendMockApiApi->mock_wallet_transactions: %s\n" % e)
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

