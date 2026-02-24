interface BadgeProps {
  children: React.ReactNode;
  variant?:
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "secondary"
  | "outline";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
}

export function Badge({
  children,
  variant = "primary",
  size = "md",
  dot = false,
}: BadgeProps) {
  const variants = {
    primary:
      "bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-400",
    success:
      "bg-success-100 text-success-700 dark:bg-success-950 dark:text-success-400",
    warning:
      "bg-warning-100 text-warning-700 dark:bg-warning-950 dark:text-warning-400",
    danger:
      "bg-danger-100 text-danger-700 dark:bg-danger-950 dark:text-danger-400",
    info: "bg-info-100 text-info-700 dark:bg-info-950 dark:text-info-400",
    secondary: "bg-secondary text-secondary-foreground",
    outline: "bg-transparent border border-border text-foreground",
  };

  const dotColors = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    secondary: "bg-foreground-muted",
    outline: "bg-foreground-muted",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-0.5 text-sm",
    lg: "px-3 py-1 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${variants[variant]} ${sizes[size]}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
