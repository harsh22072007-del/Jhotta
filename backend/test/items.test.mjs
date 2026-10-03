import assert from 'node:assert/strict'
import { BadRequest, chunk, decodeCursor, encodeCursor, parseSince, prepareBatch, toDynamoItem } from '../src/items.mjs'

const T = '2026-10-03T10:00:00.000Z'
const log = (id, u = 1) => ({ type: 'log', id, exercise_id: 'pushup', reps: 5, updated_at: u, deleted_at: null })

// keys come from the JWT sub, shaped like the plan
const it = toDynamoItem('abc-123', log('L1'), T)
assert.equal(it.PK, 'USER#abc-123'); assert.equal(it.SK, 'LOG#L1')
assert.equal(it.GSI1PK, 'USER#abc-123'); assert.equal(it.GSI1SK, `UPDATED#${T}#L1`)
assert.equal(toDynamoItem('s', { type: 'goal', id: 'goal-pushup-daily', updated_at: 1 }, T).SK, 'GOAL#goal-pushup-daily')
assert.equal(toDynamoItem('s', { type: 'weight', id: 'W1', updated_at: 1 }, T).SK, 'WEIGHT#W1')
assert.equal(toDynamoItem('s', { type: 'profile', id: 'me', updated_at: 1 }, T).SK, 'PROFILE')

// a userId smuggled into the body is ignored, never used for keys
assert.equal(toDynamoItem('real', { ...log('L2'), userId: 'attacker', PK: 'USER#attacker' }, T).PK, 'USER#real')

// validation
for (const bad of [null, 'x', { type: 'nope', id: 'a', updated_at: 1 }, { type: 'log', id: '../x', updated_at: 1 },
  { type: 'log', id: 'a#b', updated_at: 1 }, { type: 'log', id: 'a', updated_at: 'now' },
  { type: 'log', id: 'a', updated_at: 1, notes: 'x'.repeat(9000) }]) {
  assert.throws(() => toDynamoItem('s', bad, T), BadRequest)
}
assert.throws(() => prepareBatch('s', 'nope', T), BadRequest)
assert.throws(() => prepareBatch('s', Array(501).fill(log('a')), T), BadRequest)
assert.throws(() => prepareBatch('', [log('a')], T), BadRequest)

// dedupe: BatchWrite rejects duplicate keys, newest wins
const b = prepareBatch('s', [log('A', 1), log('A', 5), log('B', 2)], T)
assert.equal(b.length, 2); assert.equal(b.find((x) => x.SK === 'LOG#A').payload.updated_at, 5)

// chunks of 25
assert.deepEqual(chunk(Array.from({ length: 60 }, (_, i) => i), 25).map((c) => c.length), [25, 25, 10])

// cursors can't cross users
const c = encodeCursor({ PK: 'USER#me', SK: 'LOG#1' })
assert.deepEqual(decodeCursor('me', c), { PK: 'USER#me', SK: 'LOG#1' })
assert.throws(() => decodeCursor('someone-else', c), BadRequest)
assert.equal(decodeCursor('me', undefined), undefined)
assert.equal(encodeCursor(undefined), null)

// since
assert.equal(parseSince(''), null); assert.equal(parseSince(T), T)
assert.throws(() => parseSince('yesterday'), BadRequest)
console.log('backend tests passed')
