const PATHS = {
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6',
  logout: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z',
  board: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v13h-4z',
  key: 'M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3M7.5 10.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  flame: 'M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5C10 10 11 8 12 3z',
  zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  check: 'M5 12l5 5 9-10',
}

export default function Icon({ name, className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
