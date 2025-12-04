declare module '@tabler/icons-react/dist/esm/icons/*.mjs' {
  import { ComponentType, SVGProps } from 'react'

  type TablerIconProps = SVGProps<SVGSVGElement> & {
    size?: number | string
    stroke?: number | string
  }

  const Icon: ComponentType<TablerIconProps>
  export default Icon
}

