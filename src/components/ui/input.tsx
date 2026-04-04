import * as React from "react"

import { cn } from "@/lib/utils"

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-[#1a2540] bg-[#0d1422] px-3 py-2 text-sm text-white placeholder:text-[#7a88a8] focus:outline-none focus:ring-2 focus:ring-[#e74c3c] focus:ring-offset-0 focus:border-[#e74c3c] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
export type { InputProps }
