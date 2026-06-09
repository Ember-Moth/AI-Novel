import { skipToken } from "@codehz/rpc";
import { useEffect, useMemo, useState } from "react";

import { rpc } from "@/server/rpc/client";

type ResolvedModel = NonNullable<
  ReturnType<typeof rpc.useQuery<"ai.listResolvedModels">>["data"]
>[number];

const SELECT_CLASS =
  "h-8 w-full rounded border border-border bg-editor-background px-2 text-[12px] text-foreground outline-none transition focus:border-accent-foreground disabled:cursor-not-allowed disabled:opacity-60";

function ModelSelect({
  connectionId,
  selectedModelId,
  onModelChange,
}: {
  connectionId: string | null;
  selectedModelId: string;
  onModelChange: (_modelId: string) => void;
}) {
  const modelsQuery = rpc.useQuery(
    "ai.listResolvedModels",
    connectionId ? { connectionId } : skipToken,
  );
  const models = useMemo(
    () =>
      (modelsQuery.data ?? []).filter(
        (model) => model.connectionId === connectionId && model.isEnabled,
      ),
    [connectionId, modelsQuery.data],
  );
  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null;

  useEffect(() => {
    if (!connectionId) {
      if (selectedModelId) onModelChange("");
      return;
    }

    if (modelsQuery.isLoading && models.length === 0) {
      return;
    }

    if (!models.some((model) => model.id === selectedModelId)) {
      onModelChange(models[0]?.id ?? "");
    }
  }, [connectionId, models, modelsQuery.isLoading, onModelChange, selectedModelId]);

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-foreground-muted" htmlFor="ai-model-select">
        模型
      </label>
      <select
        id="ai-model-select"
        value={selectedModelId}
        onChange={(event) => onModelChange(event.target.value)}
        disabled={!connectionId || modelsQuery.isLoading || models.length === 0}
        className={SELECT_CLASS}
      >
        {modelsQuery.isLoading && models.length === 0 ? (
          <option value="">加载模型中...</option>
        ) : models.length === 0 ? (
          <option value="">没有可用模型</option>
        ) : (
          models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))
        )}
      </select>
      <ModelMeta model={selectedModel} isLoading={modelsQuery.isLoading} />
    </div>
  );
}

function ModelMeta({ model, isLoading }: { model: ResolvedModel | null; isLoading: boolean }) {
  if (isLoading && !model) {
    return <div className="text-[11px] text-foreground-muted">正在读取当前连接的模型...</div>;
  }

  if (!model) {
    return <div className="text-[11px] text-foreground-muted">请先在设置中启用模型。</div>;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[11px] text-foreground-muted">
      <span className="min-w-0 truncate font-mono">{model.modelId}</span>
      {model.supportsReasoning ? <span>推理</span> : null}
      {model.supportsToolUse ? <span>工具</span> : null}
      {model.supportsVision ? <span>视觉</span> : null}
    </div>
  );
}

export function AiSidebar() {
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [draft, setDraft] = useState("");
  const connectionsQuery = rpc.useQuery("ai.listConnections");
  const enabledConnections = useMemo(
    () => (connectionsQuery.data ?? []).filter((connection) => connection.isEnabled),
    [connectionsQuery.data],
  );
  const effectiveConnectionId = enabledConnections.some(
    (connection) => connection.id === selectedConnectionId,
  )
    ? selectedConnectionId
    : (enabledConnections[0]?.id ?? "");
  const selectedConnection =
    enabledConnections.find((connection) => connection.id === effectiveConnectionId) ?? null;
  const canType = Boolean(selectedConnection && selectedModelId);

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
              <span>还没有对话内容</span>
            </div>
            <p className="text-[12px] leading-5 text-foreground-muted">
              选择模型后可以先输入提示词草稿，发送功能稍后接入。
            </p>
          </div>
        </div>

        <form className="shrink-0" aria-label="AI 对话输入">
          <div className="space-y-2">
            <div className="space-y-1.5">
              <label className="text-[11px] text-foreground-muted" htmlFor="ai-connection-select">
                连接
              </label>
              <select
                id="ai-connection-select"
                value={effectiveConnectionId}
                onChange={(event) => {
                  setSelectedConnectionId(event.target.value);
                  setSelectedModelId("");
                }}
                disabled={connectionsQuery.isLoading || enabledConnections.length === 0}
                className={SELECT_CLASS}
              >
                {connectionsQuery.isLoading && enabledConnections.length === 0 ? (
                  <option value="">加载连接中...</option>
                ) : enabledConnections.length === 0 ? (
                  <option value="">没有可用连接</option>
                ) : (
                  enabledConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <ModelSelect
              connectionId={selectedConnection?.id ?? null}
              selectedModelId={selectedModelId}
              onModelChange={setSelectedModelId}
            />

            <div className="flex items-end gap-2 rounded-md border border-border bg-editor-background p-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={!canType}
                rows={3}
                className="min-h-16 flex-1 resize-none border-none bg-transparent text-[13px] leading-5 text-editor-foreground outline-none placeholder:text-foreground-muted/70 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder={canType ? "输入消息..." : "选择可用模型后输入..."}
              />
              <button
                type="button"
                disabled
                title="发送功能尚未接入"
                aria-label="发送"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-foreground-muted transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="icon-[material-symbols--send] text-lg" />
              </button>
            </div>

            <div
              className={`flex items-center gap-1.5 text-[11px] ${
                canType ? "text-foreground-muted" : "text-accent-foreground"
              }`}
            >
              <span
                className={
                  canType ? "icon-[material-symbols--edit-note]" : "icon-[material-symbols--info]"
                }
              />
              <span>{canType ? "草稿仅保存在当前页面。" : "需要可用连接和模型才能输入。"}</span>
            </div>
          </div>
        </form>
      </div>
    </aside>
  );
}
