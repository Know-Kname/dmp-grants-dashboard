interface AlertProps {
  title?: string;
  message: string;
  details?: string[];
  variant?: "error" | "warning" | "success" | "info";
  onDismiss?: () => void;
}

export function Alert({
  title,
  message,
  details,
  variant = "error",
  onDismiss,
}: AlertProps) {
  const styles = {
    error: "bg-destructive/10 border-destructive/30 text-destructive",
    warning: "bg-warning/10 border-warning/30 text-warning-700",
    success: "bg-success/10 border-success/30 text-success-700",
    info: "bg-info/10 border-info/30 text-info-700",
  };

  return (
    <div className={`border rounded-lg p-4 ${styles[variant]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {title && <p className="font-semibold">{title}</p>}
          <p className="text-sm">{message}</p>
          {details && details.length > 0 && (
            <ul className="list-disc pl-5 text-sm">
              {details.map((detail, index) => (
                <li key={`${detail}-${index}`}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-current/70 hover:text-current"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
