import { AnimatePresence } from "motion/react";

import { useAssistantState } from "../runtime/assistantStore";
import { useAssistantDerivedState } from "../runtime/assistantStateModel";
import { useAssistantRuntime } from "../runtime/useAiAssistantRuntime";
import { ArchivedSectionToggleRow, AnimatedHeadRow } from "./SessionRow";
import { SessionStatusOverlay } from "./SessionStatusOverlay";

export function SessionPane({ onActivate }: { onActivate?: (_threadId: string) => void }) {
  const runtime = useAssistantRuntime();
  const derived = useAssistantDerivedState();
  const setShowArchivedThreads = useAssistantState((state) => state.setShowArchivedThreads);

  return (
    <>
      <div className="flex min-h-full flex-col">
        <AnimatePresence initial={false} mode="popLayout">
          {derived.sessionRows.map((row) =>
            row.type === "archived-toggle" ? (
              <ArchivedSectionToggleRow
                key={row.key}
                count={row.count}
                expanded={derived.showArchivedThreads}
                onToggle={() => setShowArchivedThreads((current) => !current)}
              />
            ) : (
              <AnimatedHeadRow
                key={row.key}
                thread={row.thread}
                isActive={row.thread.id === derived.activeThreadId}
                isEditing={derived.editingThread?.threadId === row.thread.id}
                editingName={
                  derived.editingThread?.threadId === row.thread.id
                    ? derived.editingThread.title
                    : ""
                }
                isBusy={derived.isThreadMutating}
                className={row.className}
                onActivate={() => {
                  onActivate?.(row.thread.id);
                  void runtime.actions.handleActivateThread(row.thread.id);
                }}
                onEditingNameChange={(value) =>
                  runtime.actions.handleEditingThreadTitleChange(row.thread.id, value)
                }
                onRenameStart={() => runtime.actions.handleRenameStart(row.thread)}
                onRenameCancel={runtime.actions.handleRenameCancel}
                onRenameSubmit={() => void runtime.actions.handleRenameSubmit()}
                onArchive={() => void runtime.actions.handleArchiveToggle(row.thread, true)}
                onRestore={() => void runtime.actions.handleArchiveToggle(row.thread, false)}
              />
            ),
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {derived.sessionOverlayState ? (
          <SessionStatusOverlay
            key={derived.sessionOverlayState}
            state={derived.sessionOverlayState}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
