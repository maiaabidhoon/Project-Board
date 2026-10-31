import { useStore } from '@tanstack/react-store'
import { chat } from '../lib/chat'
import { peerOf } from '../lib/utils'
import Avatar from './Avatar'
import Icon from './Icon'

// Green dot shown on someone's avatar while they are online
export function OnlineDot({ userId }) {
  const online = useStore(chat, (s) => !!s.online[userId])
  return online ? <span title="Online" className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-white bg-emerald-500" /> : null
}

// A person's avatar for direct chats, a group icon for groups
export default function ChatAvatar({ conv, meId, size = 'size-10 text-sm' }) {
  if (conv.type === 'group')
    return <span className={`grid shrink-0 place-items-center rounded-full bg-iris-soft text-iris ${size}`}><Icon name="users" className="size-1/2" /></span>
  const peer = peerOf(conv, meId)
  return (
    <span className="relative shrink-0">
      <Avatar name={peer?.name ?? '?'} size={size} />
      {peer && <OnlineDot userId={peer.id} />}
    </span>
  )
}
