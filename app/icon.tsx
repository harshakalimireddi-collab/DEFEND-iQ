import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050811',
          borderRadius: '8px',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Shield */}
          <path
            d="M24 4L8 10V22C8 32.5 14.8 42.2 24 45C33.2 42.2 40 32.5 40 22V10L24 4Z"
            stroke="#38bdf8"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="#080e1e"
          />
          {/* Inner Chevron */}
          <path
            d="M20 16L28 24L20 32"
            stroke="#818cf8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Pixel accents */}
          <rect x="34" y="6" width="3.5" height="3.5" rx="1" fill="#38bdf8" />
          <rect x="39" y="10" width="3" height="3" rx="1" fill="#818cf8" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
