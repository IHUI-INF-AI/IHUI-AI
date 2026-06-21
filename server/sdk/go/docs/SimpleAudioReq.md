# SimpleAudioReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**BotId** | **string** |  | 
**ConversationId** | Pointer to **NullableString** |  | [optional] 
**AudioData** | **string** |  | 
**VoiceId** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewSimpleAudioReq

`func NewSimpleAudioReq(botId string, audioData string, ) *SimpleAudioReq`

NewSimpleAudioReq instantiates a new SimpleAudioReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSimpleAudioReqWithDefaults

`func NewSimpleAudioReqWithDefaults() *SimpleAudioReq`

NewSimpleAudioReqWithDefaults instantiates a new SimpleAudioReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetBotId

`func (o *SimpleAudioReq) GetBotId() string`

GetBotId returns the BotId field if non-nil, zero value otherwise.

### GetBotIdOk

`func (o *SimpleAudioReq) GetBotIdOk() (*string, bool)`

GetBotIdOk returns a tuple with the BotId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBotId

`func (o *SimpleAudioReq) SetBotId(v string)`

SetBotId sets BotId field to given value.


### GetConversationId

`func (o *SimpleAudioReq) GetConversationId() string`

GetConversationId returns the ConversationId field if non-nil, zero value otherwise.

### GetConversationIdOk

`func (o *SimpleAudioReq) GetConversationIdOk() (*string, bool)`

GetConversationIdOk returns a tuple with the ConversationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConversationId

`func (o *SimpleAudioReq) SetConversationId(v string)`

SetConversationId sets ConversationId field to given value.

### HasConversationId

`func (o *SimpleAudioReq) HasConversationId() bool`

HasConversationId returns a boolean if a field has been set.

### SetConversationIdNil

`func (o *SimpleAudioReq) SetConversationIdNil(b bool)`

 SetConversationIdNil sets the value for ConversationId to be an explicit nil

### UnsetConversationId
`func (o *SimpleAudioReq) UnsetConversationId()`

UnsetConversationId ensures that no value is present for ConversationId, not even an explicit nil
### GetAudioData

`func (o *SimpleAudioReq) GetAudioData() string`

GetAudioData returns the AudioData field if non-nil, zero value otherwise.

### GetAudioDataOk

`func (o *SimpleAudioReq) GetAudioDataOk() (*string, bool)`

GetAudioDataOk returns a tuple with the AudioData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioData

`func (o *SimpleAudioReq) SetAudioData(v string)`

SetAudioData sets AudioData field to given value.


### GetVoiceId

`func (o *SimpleAudioReq) GetVoiceId() string`

GetVoiceId returns the VoiceId field if non-nil, zero value otherwise.

### GetVoiceIdOk

`func (o *SimpleAudioReq) GetVoiceIdOk() (*string, bool)`

GetVoiceIdOk returns a tuple with the VoiceId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVoiceId

`func (o *SimpleAudioReq) SetVoiceId(v string)`

SetVoiceId sets VoiceId field to given value.

### HasVoiceId

`func (o *SimpleAudioReq) HasVoiceId() bool`

HasVoiceId returns a boolean if a field has been set.

### SetVoiceIdNil

`func (o *SimpleAudioReq) SetVoiceIdNil(b bool)`

 SetVoiceIdNil sets the value for VoiceId to be an explicit nil

### UnsetVoiceId
`func (o *SimpleAudioReq) UnsetVoiceId()`

UnsetVoiceId ensures that no value is present for VoiceId, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


