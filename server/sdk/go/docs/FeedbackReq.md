# FeedbackReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**MessageId** | **string** |  | 
**ConversationId** | **string** |  | 
**FeedbackType** | **string** |  | 
**Content** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewFeedbackReq

`func NewFeedbackReq(messageId string, conversationId string, feedbackType string, ) *FeedbackReq`

NewFeedbackReq instantiates a new FeedbackReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewFeedbackReqWithDefaults

`func NewFeedbackReqWithDefaults() *FeedbackReq`

NewFeedbackReqWithDefaults instantiates a new FeedbackReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetMessageId

`func (o *FeedbackReq) GetMessageId() string`

GetMessageId returns the MessageId field if non-nil, zero value otherwise.

### GetMessageIdOk

`func (o *FeedbackReq) GetMessageIdOk() (*string, bool)`

GetMessageIdOk returns a tuple with the MessageId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMessageId

`func (o *FeedbackReq) SetMessageId(v string)`

SetMessageId sets MessageId field to given value.


### GetConversationId

`func (o *FeedbackReq) GetConversationId() string`

GetConversationId returns the ConversationId field if non-nil, zero value otherwise.

### GetConversationIdOk

`func (o *FeedbackReq) GetConversationIdOk() (*string, bool)`

GetConversationIdOk returns a tuple with the ConversationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConversationId

`func (o *FeedbackReq) SetConversationId(v string)`

SetConversationId sets ConversationId field to given value.


### GetFeedbackType

`func (o *FeedbackReq) GetFeedbackType() string`

GetFeedbackType returns the FeedbackType field if non-nil, zero value otherwise.

### GetFeedbackTypeOk

`func (o *FeedbackReq) GetFeedbackTypeOk() (*string, bool)`

GetFeedbackTypeOk returns a tuple with the FeedbackType field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFeedbackType

`func (o *FeedbackReq) SetFeedbackType(v string)`

SetFeedbackType sets FeedbackType field to given value.


### GetContent

`func (o *FeedbackReq) GetContent() string`

GetContent returns the Content field if non-nil, zero value otherwise.

### GetContentOk

`func (o *FeedbackReq) GetContentOk() (*string, bool)`

GetContentOk returns a tuple with the Content field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContent

`func (o *FeedbackReq) SetContent(v string)`

SetContent sets Content field to given value.

### HasContent

`func (o *FeedbackReq) HasContent() bool`

HasContent returns a boolean if a field has been set.

### SetContentNil

`func (o *FeedbackReq) SetContentNil(b bool)`

 SetContentNil sets the value for Content to be an explicit nil

### UnsetContent
`func (o *FeedbackReq) UnsetContent()`

UnsetContent ensures that no value is present for Content, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


