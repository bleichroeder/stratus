"use client";

interface LogoProps {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 24, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Minimal cloud */}
      <path
        d="M8 22C5.79 22 4 20.21 4 18C4 16.14 5.28 14.59 7.01 14.14C7 14.09 7 14.05 7 14C7 11.24 9.24 9 12 9C14.05 9 15.82 10.24 16.65 12.02C17.08 11.72 17.59 11.54 18.15 11.52C18.26 11.51 18.38 11.51 18.5 11.52C20.16 11.66 21.5 13.01 21.5 14.75C21.5 14.83 21.5 14.92 21.49 15H22C24.76 15 27 17.24 27 20C27 22.07 25.7 23.84 23.85 24.6C23.35 24.82 22.74 24.96 22.21 25H9.5H8Z"
        className="fill-stone-800 dark:fill-stone-200"
      />
      {/* Horizontal stratus lines */}
      <line x1="9" y1="17" x2="23" y2="17" className="stroke-white dark:stroke-stone-900" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="20" x2="21" y2="20" className="stroke-white dark:stroke-stone-900" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="23" x2="19" y2="23" className="stroke-white dark:stroke-stone-900" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LogoFull({ size = 24, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoIcon size={size} />
      <span
        className="font-mono font-semibold tracking-tight text-stone-900 dark:text-stone-100 lowercase"
        style={{ fontSize: size * 0.65 }}
      >
        stratus
      </span>
    </div>
  );
}
