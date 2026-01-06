
import React from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ 
  children, variant = 'primary', className, ...props 
}) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95',
    secondary: 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-md',
    ghost: 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
  };

  return (
    <button 
      className={`px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; className?: string; title?: string }> = ({ children, className, title, ...props }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors ${className || ''}`} {...props}>
    {title && <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 font-bold text-lg text-slate-800 dark:text-slate-100">{title}</div>}
    <div className="p-6">{children}</div>
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }> = ({ label, error, className, ...props }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">{label}</label>}
    <input 
      className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all dark:text-white ${error ? 'border-red-500 ring-red-200' : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'} ${className}`}
      {...props}
    />
    {error && <p className="text-xs text-red-500 ml-1">{error}</p>}
  </div>
);

// Added 'white' to color options to support custom background/text styling via className
export const Badge: React.FC<{ children: React.ReactNode; color?: 'blue' | 'green' | 'red' | 'yellow' | 'white'; className?: string }> = ({ children, color = 'blue', className }) => {
  const colors = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    white: ''
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${colors[color]} ${className || ''}`}>
      {children}
    </span>
  );
};
