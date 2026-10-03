// Pure helpers (no AWS SDK) so they can be unit-tested.
export class BadRequest extends Error {}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const PREFIX = { log: 'LOG', goal: 'GOAL', weight: 'WEIGHT' }
export const MAX_ITEMS = 500
const MAX_ITEM_BYTES = 8000

/**
 * One DynamoDB item per client row. userId ALWAYS comes from the verified JWT (sub), never the body.
 * GSI1SK uses the SERVER receive time, not the client's updated_at: a device that was offline for
 * hours would otherwise write rows "in the past" that other devices pulling with `since` never see.
 */
export function toDynamoItem(sub, raw, serverIso) {
  if (!raw || typeof raw !== 'object') throw new BadRequest('Bad item')
  const { type } = raw
  let sk
  if (type === 'profile') sk = 'PROFILE'
  else if (PREFIX[type]) {
    if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) throw new BadRequest('Bad id')
    sk = `${PREFIX[type]}#${raw.id}`
  } else throw new BadRequest('Unknown type')
  if (!Number.isFinite(raw.updated_at)) throw new BadRequest('Bad updated_at')
  if (JSON.stringify(raw).length > MAX_ITEM_BYTES) throw new BadRequest('Item too large')
  return {
    PK: `USER#${sub}`,
    SK: sk,
    GSI1PK: `USER#${sub}`,
    GSI1SK: `UPDATED#${serverIso}#${raw.id ?? 'profile'}`,
    payload: raw,
  }
}

/** Validate a push body. BatchWrite rejects duplicate keys, so keep the newest per SK. */
export function prepareBatch(sub, items, serverIso) {
  if (!sub) throw new BadRequest('No user')
  if (!Array.isArray(items) || items.length > MAX_ITEMS) throw new BadRequest('Bad items')
  const bySk = new Map()
  for (const raw of items) {
    const it = toDynamoItem(sub, raw, serverIso)
    const prev = bySk.get(it.SK)
    if (!prev || it.payload.updated_at >= prev.payload.updated_at) bySk.set(it.SK, it)
  }
  return [...bySk.values()]
}

export const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

export const encodeCursor = (key) => (key ? Buffer.from(JSON.stringify(key)).toString('base64url') : null)

export function decodeCursor(sub, cursor) {
  if (!cursor) return undefined
  try {
    const key = JSON.parse(Buffer.from(cursor, 'base64url').toString())
    if (key.PK !== `USER#${sub}`) throw new Error()
    return key
  } catch {
    throw new BadRequest('Bad cursor')
  }
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
export function parseSince(since) {
  if (!since) return null
  if (!ISO_RE.test(since)) throw new BadRequest('Bad since')
  return since
}
