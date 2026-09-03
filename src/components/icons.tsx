import {
  Archive,
  BarChart3,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  LayoutGrid,
  Plus,
  ScanBarcode,
  Search,
  Settings,
  ShoppingBasket,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'

interface IconProps {
  className?: string
  strokeWidth?: number
}

const defaults = (p: IconProps) => ({
  className: p.className ?? 'h-6 w-6',
  strokeWidth: p.strokeWidth ?? 1.8,
  'aria-hidden': true as const,
})

export const IconArchive = (p: IconProps) => <Archive {...defaults(p)} />
export const IconBack = (p: IconProps) => <ChevronLeft {...defaults(p)} />
export const IconCamera = (p: IconProps) => <Camera {...defaults(p)} />
export const IconCheck = (p: IconProps) => <Check {...defaults(p)} />
export const IconChevronDown = (p: IconProps) => <ChevronDown {...defaults(p)} />
export const IconGrid = (p: IconProps) => <LayoutGrid {...defaults(p)} />
export const IconPlus = (p: IconProps) => <Plus {...defaults(p)} />
export const IconScan = (p: IconProps) => <ScanBarcode {...defaults(p)} />
export const IconSearch = (p: IconProps) => <Search {...defaults(p)} />
export const IconSettings = (p: IconProps) => <Settings {...defaults(p)} />
export const IconSparkle = (p: IconProps) => <Sparkles {...defaults(p)} />
export const IconStar = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Star {...defaults(p)} fill={filled ? 'currentColor' : 'none'} />
)
export const IconTrash = (p: IconProps) => <Trash2 {...defaults(p)} />
export const IconX = (p: IconProps) => <X {...defaults(p)} />
export const IconBasket = (p: IconProps) => <ShoppingBasket {...defaults(p)} />
export const IconChart = (p: IconProps) => <BarChart3 {...defaults(p)} />
