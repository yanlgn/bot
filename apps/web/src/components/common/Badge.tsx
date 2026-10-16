import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'red' | 'purple' | 'amber' | 'gray';
  colorHex?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gray',
  colorHex,
  className = ''
}) => {
  if (colorHex) {
    return (
      <span
        style={{ backgroundColor: `${colorHex}22`, color: colorHex, borderColor: `${colorHex}44` }}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}
      >
        <span
          className="w-1.5 h-1.5 mr-1.5 rounded-full"
          style={{ backgroundColor: colorHex }}
        />
        {children}
      </span>
    );
  }

  const variants = {
    blue: 'bg-blue-900/30 text-blue-400 border-blue-800/50',
    green: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50',
    red: 'bg-rose-900/30 text-rose-400 border-rose-800/50',
    purple: 'bg-purple-900/30 text-purple-400 border-purple-800/50',
    amber: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
    gray: 'bg-gray-800 text-gray-300 border-gray-700'
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
