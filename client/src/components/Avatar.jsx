import { colorFor, initials } from '../lib/utils'

export default function Avatar({ name, size = 'size-7 text-[11px]' }) {
  return (
    <span title={name} style={{ background: colorFor(name) }}
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${size}`}>
      {initials(name)}
    </span>
  )
}
