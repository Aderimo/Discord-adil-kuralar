import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-discord-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-discord-accent text-white shadow hover:bg-discord-accent/90",
        destructive:
          "bg-discord-red text-white shadow-sm hover:bg-discord-red/90",
        outline:
          "border border-discord-light bg-transparent shadow-sm hover:bg-discord-light hover:text-discord-text",
        secondary:
          "bg-discord-light text-discord-text shadow-sm hover:bg-discord-lighter",
        ghost: "hover:bg-discord-light hover:text-discord-text",
        link: "text-discord-accent underline-offset-4 hover:underline",
        success:
          "bg-discord-green text-white shadow-sm hover:bg-discord-green/90",
        warning:
          "bg-discord-yellow text-discord-darker shadow-sm hover:bg-discord-yellow/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
