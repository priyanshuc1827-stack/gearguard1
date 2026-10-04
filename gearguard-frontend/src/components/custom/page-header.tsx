// Shared PageHeader component — used on every page for visual consistency
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  icon,
  accentColor = "#10b981",
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="p-2.5 rounded-xl shrink-0"
            style={{
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}30`,
            }}
          >
            <span style={{ color: accentColor }}>{icon}</span>
          </div>
        )}
        <div>
          <h1
            className="text-2xl font-extrabold tracking-tight leading-tight"
            style={{ color: "#e8eaf2" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
