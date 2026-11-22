import type { ReactNode, SVGProps } from 'react'

/**
 * The handful of line icons the app uses, drawn in the Lucide style (24-unit grid, 2-px round
 * strokes, currentColor). Kept in-house so a library rename can never break the UI.
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

function icon(paths: ReactNode) {
  return function Icon({ size = 20, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {paths}
      </svg>
    )
  }
}

export const LogoIcon = icon(
  <>
    <rect x="8" y="8" width="13" height="13" rx="2.5" />
    <path d="M4 16a2 2 0 0 1-2-2V5a3 3 0 0 1 3-3h9a2 2 0 0 1 2 2" />
  </>
)

export const TopicsIcon = icon(<path d="M3 6h18M3 12h14M3 18h10" />)

export const SharedIcon = icon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </>
)

export const PracticeIcon = icon(
  <>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </>
)

export const PaletteIcon = icon(
  <>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z" />
    <circle cx="13.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="6.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
  </>
)

export const LogOutIcon = icon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </>
)

export const CheckIcon = icon(<path d="M20 6 9 17l-5-5" />)

export const MinimizeIcon = icon(<path d="M5 12h14" />)
export const MaximizeIcon = icon(<rect x="5" y="5" width="14" height="14" rx="1.5" />)
export const RestoreIcon = icon(
  <>
    <rect x="4" y="8" width="12" height="12" rx="1.5" />
    <path d="M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16" />
  </>
)
export const CloseIcon = icon(<path d="M18 6 6 18M6 6l12 12" />)
