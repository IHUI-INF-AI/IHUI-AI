# AddAgentRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**AgentName** | **string** | 智能体名称 | 
**AgentDescription** | **string** | 智能体功能描述 | 
**ConnectorUserId** | **string** | Coze连接器用户ID | 
**AgentVariables** | **map[string]interface{}** | 智能体变量配置JSON | 
**AgentModel** | **string** | 使用的AI模型名称 | 
**AgentAvatar** | Pointer to **NullableString** | 智能体头像图片URL地址 | [optional] 

## Methods

### NewAddAgentRequest

`func NewAddAgentRequest(agentName string, agentDescription string, connectorUserId string, agentVariables map[string]interface{}, agentModel string, ) *AddAgentRequest`

NewAddAgentRequest instantiates a new AddAgentRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewAddAgentRequestWithDefaults

`func NewAddAgentRequestWithDefaults() *AddAgentRequest`

NewAddAgentRequestWithDefaults instantiates a new AddAgentRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAgentName

`func (o *AddAgentRequest) GetAgentName() string`

GetAgentName returns the AgentName field if non-nil, zero value otherwise.

### GetAgentNameOk

`func (o *AddAgentRequest) GetAgentNameOk() (*string, bool)`

GetAgentNameOk returns a tuple with the AgentName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAgentName

`func (o *AddAgentRequest) SetAgentName(v string)`

SetAgentName sets AgentName field to given value.


### GetAgentDescription

`func (o *AddAgentRequest) GetAgentDescription() string`

GetAgentDescription returns the AgentDescription field if non-nil, zero value otherwise.

### GetAgentDescriptionOk

`func (o *AddAgentRequest) GetAgentDescriptionOk() (*string, bool)`

GetAgentDescriptionOk returns a tuple with the AgentDescription field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAgentDescription

`func (o *AddAgentRequest) SetAgentDescription(v string)`

SetAgentDescription sets AgentDescription field to given value.


### GetConnectorUserId

`func (o *AddAgentRequest) GetConnectorUserId() string`

GetConnectorUserId returns the ConnectorUserId field if non-nil, zero value otherwise.

### GetConnectorUserIdOk

`func (o *AddAgentRequest) GetConnectorUserIdOk() (*string, bool)`

GetConnectorUserIdOk returns a tuple with the ConnectorUserId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConnectorUserId

`func (o *AddAgentRequest) SetConnectorUserId(v string)`

SetConnectorUserId sets ConnectorUserId field to given value.


### GetAgentVariables

`func (o *AddAgentRequest) GetAgentVariables() map[string]interface{}`

GetAgentVariables returns the AgentVariables field if non-nil, zero value otherwise.

### GetAgentVariablesOk

`func (o *AddAgentRequest) GetAgentVariablesOk() (*map[string]interface{}, bool)`

GetAgentVariablesOk returns a tuple with the AgentVariables field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAgentVariables

`func (o *AddAgentRequest) SetAgentVariables(v map[string]interface{})`

SetAgentVariables sets AgentVariables field to given value.


### GetAgentModel

`func (o *AddAgentRequest) GetAgentModel() string`

GetAgentModel returns the AgentModel field if non-nil, zero value otherwise.

### GetAgentModelOk

`func (o *AddAgentRequest) GetAgentModelOk() (*string, bool)`

GetAgentModelOk returns a tuple with the AgentModel field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAgentModel

`func (o *AddAgentRequest) SetAgentModel(v string)`

SetAgentModel sets AgentModel field to given value.


### GetAgentAvatar

`func (o *AddAgentRequest) GetAgentAvatar() string`

GetAgentAvatar returns the AgentAvatar field if non-nil, zero value otherwise.

### GetAgentAvatarOk

`func (o *AddAgentRequest) GetAgentAvatarOk() (*string, bool)`

GetAgentAvatarOk returns a tuple with the AgentAvatar field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAgentAvatar

`func (o *AddAgentRequest) SetAgentAvatar(v string)`

SetAgentAvatar sets AgentAvatar field to given value.

### HasAgentAvatar

`func (o *AddAgentRequest) HasAgentAvatar() bool`

HasAgentAvatar returns a boolean if a field has been set.

### SetAgentAvatarNil

`func (o *AddAgentRequest) SetAgentAvatarNil(b bool)`

 SetAgentAvatarNil sets the value for AgentAvatar to be an explicit nil

### UnsetAgentAvatar
`func (o *AddAgentRequest) UnsetAgentAvatar()`

UnsetAgentAvatar ensures that no value is present for AgentAvatar, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


