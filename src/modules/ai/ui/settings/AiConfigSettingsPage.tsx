import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

import { AppShell } from "@/app/shell/AppShell";
import {
  AI_ASSISTANT_MAX_STEPS_DEFAULT,
  AI_ASSISTANT_MAX_STEPS_MAX,
  AI_ASSISTANT_MAX_STEPS_MIN,
} from "@/modules/config/domain/ai-assistant-options";
import { rpc } from "@/rpc/client";
import { cn } from "@/shared/lib/cn";
import { LoadingBlock } from "@/shared/ui/Loading";
import { OverlayScrollbar } from "@/shared/ui/OverlayScrollbar";

import { SettingsSidebar } from "./SettingsSidebar";

type ConnectionModelGroup = NonNullable<
  ReturnType<typeof rpc.useQuery<"ai.listEnabledConnectionModels">>["data"]
>[number];
type ResolvedModel = ConnectionModelGroup["models"][number];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "保存失败。";
}

function getModelCapabilities(model: ResolvedModel) {
  const values = [
    model.family,
    model.contextWindow ? `${model.contextWindow.toLocaleString("zh-CN")} tokens` : null,
    model.supportsToolUse ? "工具" : null,
    model.supportsReasoning ? "推理" : null,
    model.supportsVision ? "视觉" : null,
  ].filter(Boolean);

  return values.length > 0 ? values.join(" · ") : null;
}

export function AiConfigSettingsPage() {
  const [, navigate] = useLocation();
  const { data: storedSelection, isInitialLoading: selectionLoading } = rpc.useQuery(
    "config.getAiAssistantModelSelection",
  );
  const { data: maxSteps, isInitialLoading: maxStepsLoading } = rpc.useQuery(
    "config.getAiAssistantMaxSteps",
  );
  const { data: connectionModelGroups, isInitialLoading: modelsLoading } = rpc.useQuery(
    "ai.listEnabledConnectionModels",
  );
  const saveSelection = rpc.useMutation("config.setAiAssistantModelSelection", {
    onSuccess: (selection) => {
      rpc.setQueryData("config.getAiAssistantModelSelection", undefined, selection);
    },
  });
  const saveMaxSteps = rpc.useMutation("config.setAiAssistantMaxSteps", {
    onSuccess: (value) => {
      rpc.setQueryData("config.getAiAssistantMaxSteps", undefined, value);
    },
  });

  const [maxStepsInput, setMaxStepsInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const groups = useMemo(
    () =>
      (connectionModelGroups ?? []).map((group) => ({
        connection: group.connection,
        models: group.models.filter((model) => model.isEnabled),
      })),
    [connectionModelGroups],
  );
  const selectableModels = groups.flatMap((group) =>
    group.models.map((model) => ({
      connection: group.connection,
      model,
    })),
  );
  const selectedOption =
    selectableModels.find(
      (option) =>
        option.connection.id === storedSelection?.connectionId &&
        option.model.id === storedSelection.modelId,
    ) ?? null;
  const isSaving = saveSelection.isPending || saveMaxSteps.isPending;

  useEffect(() => {
    if (typeof maxSteps === "number") {
      setMaxStepsInput(String(maxSteps));
    }
  }, [maxSteps]);

  const handleSelectModel = async (connectionId: string, modelId: string) => {
    setActionError(null);
    try {
      await saveSelection.mutate({ connectionId, modelId });
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleClearModel = async () => {
    setActionError(null);
    try {
      await saveSelection.mutate(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleMaxStepsChange = async (value: string) => {
    setMaxStepsInput(value);
    setActionError(null);

    if (!value.trim()) {
      try {
        await saveMaxSteps.mutate(null);
      } catch (error) {
        setActionError(getErrorMessage(error));
      }
      return;
    }

    const nextValue = Number(value);
    if (
      !Number.isFinite(nextValue) ||
      nextValue < AI_ASSISTANT_MAX_STEPS_MIN ||
      nextValue > AI_ASSISTANT_MAX_STEPS_MAX
    ) {
      return;
    }

    try {
      await saveMaxSteps.mutate(Math.trunc(nextValue));
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleResetMaxSteps = async () => {
    setActionError(null);
    setMaxStepsInput("");
    try {
      await saveMaxSteps.mutate(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  return (
    <AppShell active="settings" sidebar={<SettingsSidebar />}>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-title-bar-background px-4 py-2">
          <div className="min-w-0">
            <h1 className="text-[14px] font-semibold text-foreground">AI 配置</h1>
            <p className="text-[11px] text-foreground-muted">
              {selectedOption
                ? `默认模型：${selectedOption.connection.name} / ${selectedOption.model.displayName}`
                : "尚未选择默认模型"}{" "}
              · 最大步数：{maxSteps ?? AI_ASSISTANT_MAX_STEPS_DEFAULT}
            </p>
          </div>

          {isSaving ? (
            <div className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
              <span className="icon-[material-symbols--sync] animate-spin text-base" />
              保存中
            </div>
          ) : null}
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto bg-editor-background p-4">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
            {actionError ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {actionError}
              </div>
            ) : null}

            <SettingsSection
              title="助手默认值"
              description="这些配置会作为项目 AI 助手启动和续写时的默认行为。"
            >
              <SettingsFieldRow
                label="默认模型"
                description="选择项目 AI 助手默认使用的连接和模型。"
              >
                <AiDefaultModelSelect
                  groups={groups}
                  selectedConnectionId={storedSelection?.connectionId ?? ""}
                  selectedModelId={storedSelection?.modelId ?? ""}
                  loading={selectionLoading || modelsLoading}
                  disabled={saveSelection.isPending}
                  onSelect={handleSelectModel}
                  onClear={handleClearModel}
                  onOpenConnections={() => navigate("/settings/ai-connections")}
                />
              </SettingsFieldRow>

              <SettingsFieldRow
                label="最大步数"
                description={`限制单次助手运行可执行的最大步骤数，留空或重置会恢复默认值 ${AI_ASSISTANT_MAX_STEPS_DEFAULT}。`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={AI_ASSISTANT_MAX_STEPS_MIN}
                    max={AI_ASSISTANT_MAX_STEPS_MAX}
                    step={1}
                    value={maxStepsLoading ? "" : maxStepsInput}
                    disabled={maxStepsLoading || saveMaxSteps.isPending}
                    onChange={(event) => void handleMaxStepsChange(event.target.value)}
                    className="h-8 w-28 rounded-md border border-border bg-sidebar-background px-2 text-sm text-foreground outline-none placeholder:text-foreground-muted/50 focus:border-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder={String(AI_ASSISTANT_MAX_STEPS_DEFAULT)}
                  />
                  <button
                    type="button"
                    disabled={saveMaxSteps.isPending}
                    onClick={() => void handleResetMaxSteps()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-sidebar-background px-2.5 text-sm text-foreground transition hover:bg-list-hover-background disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="icon-[material-symbols--restart-alt] text-base" />
                    重置
                  </button>
                  <span className="text-xs text-foreground-muted">
                    范围 {AI_ASSISTANT_MAX_STEPS_MIN}-{AI_ASSISTANT_MAX_STEPS_MAX}
                  </span>
                </div>
              </SettingsFieldRow>
            </SettingsSection>
          </div>
        </main>
      </div>
    </AppShell>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-sidebar-background">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-foreground-muted">{description}</p>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function SettingsFieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(12rem,0.34fr)_minmax(0,1fr)]">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-1 text-xs leading-5 text-foreground-muted">{description}</div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AiDefaultModelSelect({
  groups,
  selectedConnectionId,
  selectedModelId,
  loading,
  disabled,
  onSelect,
  onClear,
  onOpenConnections,
}: {
  groups: Array<{
    connection: ConnectionModelGroup["connection"];
    models: ResolvedModel[];
  }>;
  selectedConnectionId: string;
  selectedModelId: string;
  loading: boolean;
  disabled: boolean;
  onSelect: (_connectionId: string, _modelId: string) => void;
  onClear: () => void;
  onOpenConnections: () => void;
}) {
  const hasModels = groups.some((group) => group.models.length > 0);

  if (loading) {
    return <LoadingBlock label="模型加载中..." />;
  }

  if (!hasModels) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-foreground-muted">
        <div className="font-medium text-foreground">没有可用连接模型</div>
        <p className="mt-1 text-xs">先创建并启用一个 AI 连接，再回到这里选择默认模型。</p>
        <button
          type="button"
          onClick={onOpenConnections}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:brightness-110"
        >
          <span className="icon-[material-symbols--smart-toy] text-base" />
          打开 AI 连接
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="h-[min(22rem,55vh)] overflow-hidden rounded-md border border-border bg-editor-background">
        <OverlayScrollbar variant="card">
          {groups.map((group) =>
            group.models.length > 0 ? (
              <div key={group.connection.id}>
                <div className="sticky top-0 z-10 border-b border-border bg-sidebar-background px-3 py-1.5 text-xs font-medium text-foreground-muted">
                  {group.connection.name}
                </div>
                <div className="divide-y divide-border">
                  {group.models.map((model) => {
                    const selected =
                      group.connection.id === selectedConnectionId && model.id === selectedModelId;
                    const capabilities = getModelCapabilities(model);

                    return (
                      <button
                        key={`${group.connection.id}:${model.id}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(group.connection.id, model.id)}
                        className={cn(
                          "flex w-full items-start gap-3 px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                          selected
                            ? "bg-list-active-background text-foreground"
                            : "text-foreground-muted hover:bg-list-hover-background hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 text-[18px]",
                            selected
                              ? "icon-[material-symbols--radio-button-checked] text-accent-foreground"
                              : "icon-[material-symbols--radio-button-unchecked] text-foreground-muted",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {model.displayName}
                          </span>
                          <span className="mt-0.5 block truncate text-xs">{model.modelId}</span>
                          {capabilities ? (
                            <span className="mt-1 block text-[11px] leading-4">{capabilities}</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null,
          )}
        </OverlayScrollbar>
      </div>

      <button
        type="button"
        disabled={disabled || (!selectedConnectionId && !selectedModelId)}
        onClick={onClear}
        className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-border bg-sidebar-background px-2.5 text-sm text-foreground transition hover:bg-list-hover-background disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="icon-[material-symbols--close] text-base" />
        清除默认模型
      </button>
    </div>
  );
}
