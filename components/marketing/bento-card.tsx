import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function BentoCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('marketing-bento', className)} {...props} />;
}
