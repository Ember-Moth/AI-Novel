export function PanelPlaceholder({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 p-3 text-sm text-foreground-muted">
      <span className={`${icon} shrink-0 text-base`} />
      <span>{label}</span>
    </div>
  );
}
