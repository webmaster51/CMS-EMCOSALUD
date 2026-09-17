import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

const baseControl =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-500 disabled:bg-slate-50';

function Wrapper({
  label,
  error,
  hint,
  required,
  children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      {label && (
        <span className="mb-1 block font-medium text-slate-700">
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, required, className, ...props },
  ref,
) {
  return (
    <Wrapper label={label} error={error} hint={hint} required={required}>
      <input
        ref={ref}
        className={cn(baseControl, error && 'border-danger', className)}
        {...props}
      />
    </Wrapper>
  );
});

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, required, className, ...props },
  ref,
) {
  return (
    <Wrapper label={label} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        className={cn(baseControl, 'min-h-20 resize-y', error && 'border-danger', className)}
        {...props}
      />
    </Wrapper>
  );
});

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField({ label, error, hint, required, className, children, ...props }, ref) {
    return (
      <Wrapper label={label} error={error} hint={hint} required={required}>
        <select
          ref={ref}
          className={cn(baseControl, 'bg-white', error && 'border-danger', className)}
          {...props}
        >
          {children}
        </select>
      </Wrapper>
    );
  },
);
