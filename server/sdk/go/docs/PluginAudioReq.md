# PluginAudioReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**BotId** | **string** |  | 
**ConversationId** | Pointer to **NullableString** |  | [optional] 
**PluginId** | **string** |  | 
**AudioData** | **string** |  | 

## Methods

### NewPluginAudioReq

`func NewPluginAudioReq(botId string, pluginId string, audioData string, ) *PluginAudioReq`

NewPluginAudioReq instantiates a new PluginAudioReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPluginAudioReqWithDefaults

`func NewPluginAudioReqWithDefaults() *PluginAudioReq`

NewPluginAudioReqWithDefaults instantiates a new PluginAudioReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetBotId

`func (o *PluginAudioReq) GetBotId() string`

GetBotId returns the BotId field if non-nil, zero value otherwise.

### GetBotIdOk

`func (o *PluginAudioReq) GetBotIdOk() (*string, bool)`

GetBotIdOk returns a tuple with the BotId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBotId

`func (o *PluginAudioReq) SetBotId(v string)`

SetBotId sets BotId field to given value.


### GetConversationId

`func (o *PluginAudioReq) GetConversationId() string`

GetConversationId returns the ConversationId field if non-nil, zero value otherwise.

### GetConversationIdOk

`func (o *PluginAudioReq) GetConversationIdOk() (*string, bool)`

GetConversationIdOk returns a tuple with the ConversationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConversationId

`func (o *PluginAudioReq) SetConversationId(v string)`

SetConversationId sets ConversationId field to given value.

### HasConversationId

`func (o *PluginAudioReq) HasConversationId() bool`

HasConversationId returns a boolean if a field has been set.

### SetConversationIdNil

`func (o *PluginAudioReq) SetConversationIdNil(b bool)`

 SetConversationIdNil sets the value for ConversationId to be an explicit nil

### UnsetConversationId
`func (o *PluginAudioReq) UnsetConversationId()`

UnsetConversationId ensures that no value is present for ConversationId, not even an explicit nil
### GetPluginId

`func (o *PluginAudioReq) GetPluginId() string`

GetPluginId returns the PluginId field if non-nil, zero value otherwise.

### GetPluginIdOk

`func (o *PluginAudioReq) GetPluginIdOk() (*string, bool)`

GetPluginIdOk returns a tuple with the PluginId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPluginId

`func (o *PluginAudioReq) SetPluginId(v string)`

SetPluginId sets PluginId field to given value.


### GetAudioData

`func (o *PluginAudioReq) GetAudioData() string`

GetAudioData returns the AudioData field if non-nil, zero value otherwise.

### GetAudioDataOk

`func (o *PluginAudioReq) GetAudioDataOk() (*string, bool)`

GetAudioDataOk returns a tuple with the AudioData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioData

`func (o *PluginAudioReq) SetAudioData(v string)`

SetAudioData sets AudioData field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


