export function AiSidebar() {
  return (
    <aside className="flex h-full w-80 max-w-[38vw] min-w-72 shrink-0 flex-col overflow-hidden border-l border-border bg-sidebar-background">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-title-bar-background px-3">
        <span className="icon-[material-symbols--smart-toy] text-lg text-accent-foreground" />
        <span className="min-w-0 truncate text-[13px] font-medium text-foreground">AI 助手</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden">
          <div className="rounded-md border border-border bg-editor-background px-3 py-2">
            <div className="mb-2 flex items-center gap-2 text-[12px] text-foreground-muted">
              <span className="icon-[material-symbols--auto-awesome] text-sm text-accent-foreground" />
              <span>对话功能待接入</span>
            </div>
            <div className="space-y-1.5" aria-hidden>
              <div className="h-2 w-11/12 rounded-sm bg-list-hover-background" />
              <div className="h-2 w-8/12 rounded-sm bg-list-hover-background" />
            </div>
          </div>
        </div>

        <form className="shrink-0" aria-label="AI 对话输入">
          <div className="flex items-end gap-2 rounded-md border border-border bg-editor-background p-2">
            <textarea
              disabled
              rows={2}
              className="min-h-12 flex-1 resize-none border-none bg-transparent text-[13px] leading-5 text-editor-foreground outline-none placeholder:text-foreground-muted/70 disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="输入消息..."
            />
            <button
              type="button"
              disabled
              title="发送"
              aria-label="发送"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-foreground-muted transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="icon-[material-symbols--send] text-lg" />
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
