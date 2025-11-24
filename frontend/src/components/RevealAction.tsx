import React, { forwardRef, useState } from 'react'
import { Loader, useMantineTheme } from '@mantine/core'
import { AnimatePresence, motion } from 'framer-motion'
import { useThemePreset } from '@/theme'

type RevealActionProps = {
  icon: React.ReactNode
  label: React.ReactNode
  ariaLabel: string
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  style?: React.CSSProperties
  textColor?: string
  disableReveal?: boolean
}

const RevealAction = forwardRef<HTMLButtonElement, RevealActionProps>(
  ({ icon, label, ariaLabel, onClick, disabled = false, loading = false, style, textColor, disableReveal = false }, ref) => {
    const theme = useMantineTheme()
    const { preset } = useThemePreset()
    const [hovered, setHovered] = useState(false)
    const [focused, setFocused] = useState(false)

    const reveal = !disableReveal && (hovered || focused)
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      borderRadius: theme.radius.md,
      minHeight: 36,
      border: 'none',
      background: 'transparent',
      color: textColor ?? (preset.colorScheme === 'light' ? '#0f172a' : theme.white),
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      transition: 'background 240ms cubic-bezier(0.22, 1, 0.36, 1), color 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out',
      outline: 'none',
      willChange: 'width',
      ...style
    }

    const computedStyle: React.CSSProperties = {
      ...baseStyle,
      overflow: 'hidden'
    }

    return (
      <motion.button
        layout
        transition={{ type: 'spring', stiffness: 240, damping: 24, mass: 0.6 }}
        type="button"
        ref={ref}
        aria-label={ariaLabel}
        onClick={disabled || loading ? undefined : onClick}
        disabled={disabled || loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={computedStyle}
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 18 }}>
          {loading ? <Loader size="xs" color={textColor ?? (preset.colorScheme === 'light' ? '#0f172a' : theme.white)} /> : icon}
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          {reveal && (
            <motion.span
              key="label"
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24, mass: 0.6 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                marginLeft: 8
              }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    )
  }
)

RevealAction.displayName = 'RevealAction'

export default RevealAction

