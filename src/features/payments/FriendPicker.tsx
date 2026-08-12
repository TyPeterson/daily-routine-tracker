import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import type { Friend } from '../../db/models'
import { createFriend, updateFriend } from '../../db/repo'
import { normalizeHandle } from '../../domain/venmo'
import { friendName } from '../../domain/settlement'
import { Group } from '../../components/forms'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'

/**
 * Create/edit form for a friend. Rendered as its own sheet; sheets stack in
 * portal mount order, so opening this above the task editor works.
 */
export function AddFriendSheet({
  friend,
  onSaved,
  onClose,
}: {
  friend?: Friend
  onSaved?: (id: string) => void
  onClose: () => void
}) {
  const [firstName, setFirstName] = useState(friend?.firstName ?? '')
  const [lastName, setLastName] = useState(friend?.lastName ?? '')
  const [handle, setHandle] = useState(friend?.handle ?? '')

  const canSave = firstName.trim().length > 0 && normalizeHandle(handle).length > 0

  const save = async () => {
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      handle: normalizeHandle(handle),
    }
    // keep the write out of the optional-call argument: `onSaved?.(await x())`
    // skips evaluating the argument entirely when onSaved is undefined
    let id = friend?.id
    if (friend) await updateFriend(friend.id, payload)
    else id = await createFriend(payload)
    if (id) onSaved?.(id)
    onClose()
  }

  return (
    <Sheet title={friend ? 'edit friend' : 'new friend'} onClose={onClose}>
      <div className="space-y-5">
        <Group>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="first name"
            autoFocus={!friend}
            className="w-full bg-transparent px-4 py-3 text-[16px] font-semibold outline-none placeholder:text-ink-dim/70"
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="last name (optional)"
            className="w-full bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-ink-dim/70"
          />
          <div className="flex items-center px-4">
            <span className="text-[15px] font-semibold text-ink-dim">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="venmo-handle"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent py-3 pl-1 text-[15px] outline-none placeholder:text-ink-dim/70"
            />
          </div>
        </Group>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="key key-primary w-full py-3.5 text-[15px] font-bold"
        >
          {friend ? 'save changes' : 'add friend'}
        </button>
      </div>
    </Sheet>
  )
}

/** Single-select grid of saved friends, plus an "add new" tile. */
export function FriendPicker({
  value,
  onChange,
}: {
  value?: string
  onChange: (friendId: string | undefined) => void
}) {
  const friends = useLiveQuery(() => db.friends.orderBy('createdAt').toArray(), [])
  const [adding, setAdding] = useState(false)

  return (
    <div className="grid grid-cols-2 gap-2.5 px-4 py-3">
      {(friends ?? []).map((f) => {
        const selected = value === f.id
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={`min-w-0 rounded-[8px] border px-3 py-2 text-left ${
              selected ? 'border-accent bg-accent-soft ring-2 ring-accent' : 'border-edge/40 bg-surface2'
            }`}
          >
            <span className="block truncate text-[14px] font-semibold">{friendName(f)}</span>
            <span className="block truncate text-[11px] text-ink-dim">@{f.handle}</span>
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-edge/60 bg-surface2 text-[13px] font-semibold text-ink-dim"
      >
        <Icon name="plus" size={14} strokeWidth={2.5} />
        new friend
      </button>
      {adding && <AddFriendSheet onSaved={onChange} onClose={() => setAdding(false)} />}
    </div>
  )
}
