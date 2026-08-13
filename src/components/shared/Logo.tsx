import React from 'react';

interface LogoProps {
  className?: string;
}

export default function Logo({ className = 'h-8 w-8' }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Three vertical bars */}
      <rect x="22" y="25" width="5" height="50" fill="currentColor" rx="1" />
      <rect x="47.5" y="15" width="5" height="70" fill="currentColor" rx="1" />
      <rect x="73" y="35" width="5" height="30" fill="currentColor" rx="1" />
    </svg>
  );
}