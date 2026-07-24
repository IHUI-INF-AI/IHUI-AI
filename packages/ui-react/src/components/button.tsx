import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',

        primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        'hero-cta':
          'bg-gradient-to-r from-primary to-primary/70 text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all px-8 py-3 text-base font-semibold rounded-lg',
        login:
          'w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md font-medium',
        send: 'bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2',
        'card-action':
          'text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-2 py-1',
        'mobile-login':
          'w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-lg text-base font-semibold',
        'btn-luxe':
          'bg-gradient-to-r from-vip-gold-start to-vip-gold-end text-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all px-6 py-2.5 rounded-md font-semibold',
        'agreement-agree':
          'w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-md font-medium',
        'switch-project':
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-1.5 text-sm',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    if (process.env.NODE_ENV !== 'production' && 'title' in props) {
      console.warn(
        '[Button] 不要使用 title 属性作为 hover 提示,请改用 <Tooltip content="..."><Button>...</Button></Tooltip> 包裹。详见 AGENTS.md 第 4 节前端 UI 约束 + pre-commit 第 18 项守门。',
      );
    }
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
