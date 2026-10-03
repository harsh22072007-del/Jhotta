import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { BadRequest, chunk, decodeCursor, encodeCursor, parseSince, prepareBatch } from './items.mjs'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const TABLE = process.env.TABLE_NAME

const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
// The API Gateway JWT authorizer has already verified the token; sub is the only identity we use.
const subOf = (event) => event.requestContext?.authorizer?.jwt?.claims?.sub

const fail = (e) => {
  if (e instanceof BadRequest) return reply(400, { error: e.message })
  console.error(e)
  return reply(500, { error: 'Server error' })
}

async function writeChunk(items) {
  let request = { [TABLE]: items.map((Item) => ({ PutRequest: { Item } })) }
  for (let attempt = 0; attempt < 6 && request[TABLE]?.length; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt))
    const out = await ddb.send(new BatchWriteCommand({ RequestItems: request }))
    request = out.UnprocessedItems ?? {}
  }
  if (request[TABLE]?.length) throw new Error('DynamoDB throttled: unprocessed items')
}

// POST /sync/push   body: { items: [{ type, id, updated_at, ... }] }
export const push = async (event) => {
  try {
    const sub = subOf(event)
    let body
    try {
      const text = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString() : event.body
      body = JSON.parse(text ?? '{}')
    } catch {
      throw new BadRequest('Invalid JSON')
    }
    const items = prepareBatch(sub, body.items, new Date().toISOString())
    for (const part of chunk(items, 25)) await writeChunk(part)
    return reply(200, { ok: true, count: items.length })
  } catch (e) {
    return fail(e)
  }
}

// GET /sync/pull?since=<ISO>&cursor=<opaque>
//   no since  -> first login: Query PK = USER#sub (full dump, paginated by DynamoDB's 1 MB pages)
//   with since -> Query GSI1 where GSI1SK >= UPDATED#<since>  (>= so equal timestamps are never missed)
export const pull = async (event) => {
  try {
    const sub = subOf(event)
    if (!sub) throw new BadRequest('No user')
    const q = event.queryStringParameters ?? {}
    const since = parseSince(q.since)
    // 5 s overlap: harmless (the client applies rows idempotently) and covers in-flight writes.
    const serverTime = new Date(Date.now() - 5000).toISOString()
    const params = since
      ? {
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK >= :s',
          ExpressionAttributeValues: { ':pk': `USER#${sub}`, ':s': `UPDATED#${since}` },
        }
      : {
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': `USER#${sub}` },
        }
    const out = await ddb.send(
      new QueryCommand({ TableName: TABLE, ...params, ExclusiveStartKey: decodeCursor(sub, q.cursor) }),
    )
    return reply(200, {
      items: (out.Items ?? []).map((i) => i.payload),
      cursor: encodeCursor(out.LastEvaluatedKey),
      serverTime,
    })
  } catch (e) {
    return fail(e)
  }
}
