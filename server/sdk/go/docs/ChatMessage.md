# ChatMessage

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Role** | **string** | 角色: user / model | 
**Parts** | **[]map[string]interface{}** | 消息内容部件 | 

## Methods

### NewChatMessage

`func NewChatMessage(role string, parts []map[string]interface{}, ) *ChatMessage`

NewChatMessage instantiates a new ChatMessage object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewChatMessageWithDefaults

`func NewChatMessageWithDefaults() *ChatMessage`

NewChatMessageWithDefaults instantiates a new ChatMessage object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetRole

`func (o *ChatMessage) GetRole() string`

GetRole returns the Role field if non-nil, zero value otherwise.

### GetRoleOk

`func (o *ChatMessage) GetRoleOk() (*string, bool)`

GetRoleOk returns a tuple with the Role field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRole

`func (o *ChatMessage) SetRole(v string)`

SetRole sets Role field to given value.


### GetParts

`func (o *ChatMessage) GetParts() []map[string]interface{}`

GetParts returns the Parts field if non-nil, zero value otherwise.

### GetPartsOk

`func (o *ChatMessage) GetPartsOk() (*[]map[string]interface{}, bool)`

GetPartsOk returns a tuple with the Parts field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetParts

`func (o *ChatMessage) SetParts(v []map[string]interface{})`

SetParts sets Parts field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


