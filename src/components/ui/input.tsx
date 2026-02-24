import { useId } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  icon,
  className = "",
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="flex items-center gap-1 text-sm font-medium text-foreground"
        >
          {label}
          {props.required && <span className="text-danger">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={`
            w-full h-10 px-4 bg-card border border-input rounded-lg
            text-foreground placeholder:text-foreground-muted
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
            transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            ${icon ? "pl-10" : ""} 
            ${error ? "border-danger focus:ring-danger" : ""} 
            ${className}
          `}
          {...props}
        />
      </div>
      {hint && !error && (
        <p className="text-sm text-foreground-muted">{hint}</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
