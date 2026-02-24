import { useId } from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  label,
  error,
  hint,
  className = "",
  id,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="flex items-center gap-1 text-sm font-medium text-foreground"
        >
          {label}
          {props.required && <span className="text-danger">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`
          w-full px-4 py-3 bg-card border border-input rounded-lg
          text-foreground placeholder:text-foreground-muted
          focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
          transition-all duration-150 resize-none
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? "border-danger focus:ring-danger" : ""} 
          ${className}
        `}
        rows={4}
        {...props}
      />
      {hint && !error && (
        <p className="text-sm text-foreground-muted">{hint}</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
