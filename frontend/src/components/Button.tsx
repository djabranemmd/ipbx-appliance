import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sky-600 text-white hover:bg-sky-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
}

export default function Button({ variant = 'primary', small = false, className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-md font-medium disabled:opacity-60 ${small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}