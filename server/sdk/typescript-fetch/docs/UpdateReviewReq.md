
# UpdateReviewReq


## Properties

Name | Type
------------ | -------------
`botId` | string
`connectorId` | string
`auditStatus` | number
`reason` | string

## Example

```typescript
import type { UpdateReviewReq } from ''

// TODO: Update the object below with actual values
const example = {
  "botId": null,
  "connectorId": null,
  "auditStatus": null,
  "reason": null,
} satisfies UpdateReviewReq

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateReviewReq
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


