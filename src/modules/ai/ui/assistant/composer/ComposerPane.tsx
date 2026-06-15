import { useAssistantState } from "../runtime/assistantStore";
import { useAssistantDerivedState } from "../runtime/assistantStateModel";
import { useAssistantRuntime } from "../runtime/useAiAssistantRuntime";
import { useAssistantModelSelection } from "../runtime/useAssistantModelSelection";
import { AllowWritesToggle } from "./AllowWritesToggle";
import { AssistantComposer } from "./AssistantComposer";
import { ModelPicker } from "./ModelPicker";

export function ComposerPane() {
  const runtime = useAssistantRuntime();
  const derived = useAssistantDerivedState();
  const selection = useAssistantModelSelection();
  const setDraft = useAssistantState((state) => state.setDraft);
  const setDraftMentionCount = useAssistantState((state) => state.setDraftMentionCount);
  const setAllowWritesForNextSend = useAssistantState((state) => state.setAllowWritesForNextSend);

  return (
    <form className="shrink-0" aria-label="AI 对话输入">
      <div className="space-y-2 p-2">
        <div className="overflow-hidden rounded-lg border border-border bg-editor-background focus-within:border-accent-foreground">
          <AssistantComposer
            disabled={
              derived.isLoadingSelection ||
              !derived.selectedModelId ||
              !derived.selectedConnectionId ||
              derived.isThreadBusy
            }
            placeholder={
              derived.isWaitingForInput
                ? "等待回答，可继续编辑草稿..."
                : derived.isLoadingSelection
                  ? "加载模型选择中..."
                  : derived.selectedConnectionId && derived.selectedModelId
                    ? "输入消息..."
                    : "选择可用模型后输入..."
            }
            isBusy={derived.isBusy}
            value={derived.draft}
            onTextChange={setDraft}
            onPayloadChange={(payload) => setDraftMentionCount(payload.mentions.length)}
            onSubmit={runtime.actions.handleSubmit}
          />
          <div className="mt-1 flex min-w-0 items-center gap-2 px-1.5 pb-1.5">
            <ModelPicker
              selectedConnectionId={selection.selectedConnectionId}
              selectedModelId={selection.selectedModelId}
              selectionHydrated={selection.selectionHydrated}
              onSelectionChange={selection.handleSelectionChange}
              onSelectionCommit={selection.handleSelectionCommit}
            />
            {derived.isGenerating || derived.isWaitingForInput ? (
              <button
                type="button"
                onClick={runtime.actions.handleAbort}
                title={derived.isWaitingForInput ? "停止等待" : "终止生成"}
                aria-label={derived.isWaitingForInput ? "停止等待" : "终止生成"}
                className="bg-destructive flex size-7 shrink-0 items-center justify-center rounded-md text-white transition hover:brightness-110"
              >
                <span className="icon-[material-symbols--stop] text-base" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!derived.canSubmit}
                title={derived.canSubmit ? "发送" : "当前无法发送"}
                aria-label="发送"
                className={`flex size-7 shrink-0 items-center justify-center rounded-md transition disabled:cursor-not-allowed ${
                  derived.canSubmit
                    ? "bg-accent-foreground text-sidebar-background hover:brightness-110"
                    : "text-foreground-muted hover:bg-list-hover-background"
                }`}
              >
                <span
                  className={`text-base ${
                    derived.isBusy
                      ? "icon-[material-symbols--progress-activity] animate-spin"
                      : "icon-[material-symbols--arrow-upward]"
                  }`}
                />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
          <AllowWritesToggle
            disabled={derived.isBusy || !derived.selectedModelSupportsToolUse}
            checked={derived.allowWritesForNextSend}
            onToggle={() => setAllowWritesForNextSend((current) => !current)}
          />
        </div>
      </div>
    </form>
  );
}
