import { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  message?: string;
  heading?: string;
  action?: ReactNode;
}

/** Config passed to SuperTable / CarouselList via the `emptyState` prop */
export interface EmptyStateConfig {
  icon?: ReactNode;
  message: string;
  action?: () => ReactNode;
}
