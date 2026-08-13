import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  variant?: 'default' | 'gradient';
  action?: ReactNode;
  footer?: ReactNode;
}

export default function Card({
  children,
  title,
  className = '',
  variant = 'default',
  action,
  footer,
}: CardProps) {
  const variantClasses = {
    default: 'card',
    gradient: 'card-gradient',
  };
  
  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-dark-100 drag-handle cursor-move">
          {title && <h3 className="font-medium text-lg text-white pl-2">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      
      <div>{children}</div>
      
      {footer && (
        <div className="mt-4 pt-3 border-t border-dark-100">
          {footer}
        </div>
      )}
    </div>
  );
}