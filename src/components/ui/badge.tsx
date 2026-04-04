import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#e74c3c] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#e74c3c] text-white hover:bg-[#d43d2d]",
        secondary: "border-transparent bg-[#1a2540] text-[#7a88a8] hover:bg-[#243552]",
        outline: "text-[#7a88a8] border-[#1a2540]",
        destructive: "border-transparent bg-red-600 text-white hover:bg-red-700",
        success: "border-transparent bg-green-600 text-white hover:bg-green-700",
        warning: "border-transparent bg-yellow-600 text-white hover:bg-yellow-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
