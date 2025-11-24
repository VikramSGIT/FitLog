import React from 'react'

export default function UnsavedIndicator() {
  return (
    <style>{`
      @keyframes redGlow {
        0%, 100% {
          box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.3), 0 0 20px rgba(239, 68, 68, 0.2), 0 0 40px rgba(239, 68, 68, 0.1);
        }
        50% {
          box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.5), 0 0 30px rgba(239, 68, 68, 0.4), 0 0 60px rgba(239, 68, 68, 0.2);
        }
      }
    `}</style>
  )
}
