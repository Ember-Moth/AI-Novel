import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { rpc } from "@/rpc/client";

type AssistantModelSelectionValue = {
  selectedConnectionId: string;
  selectedModelId: string;
  selectionHydrated: boolean;
  isLoadingSelection: boolean;
  handleSelectionChange: (_connectionId: string, _modelId: string) => void;
  handleSelectionCommit: (_connectionId: string, _modelId: string) => void;
};

const AssistantModelSelectionContext = createContext<AssistantModelSelectionValue | null>(null);

export function AssistantModelSelectionProvider({ children }: { children: ReactNode }) {
  const value = useCreateAssistantModelSelection();

  return (
    <AssistantModelSelectionContext.Provider value={value}>
      {children}
    </AssistantModelSelectionContext.Provider>
  );
}

export function useAssistantModelSelection() {
  const value = useContext(AssistantModelSelectionContext);
  if (value == null) {
    throw new Error(
      "useAssistantModelSelection must be used within AssistantModelSelectionProvider",
    );
  }
  return value;
}

function useCreateAssistantModelSelection(): AssistantModelSelectionValue {
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectionHydrated, setSelectionHydrated] = useState(false);

  const storedSelectionQuery = rpc.useQuery("config.getAiAssistantModelSelection");
  const saveSelection = rpc.useMutation("config.setAiAssistantModelSelection", {
    onSuccess: (selection) => {
      rpc.setQueryData("config.getAiAssistantModelSelection", undefined, selection);
    },
  });

  useEffect(() => {
    if (selectionHydrated) {
      return;
    }

    const hasResolvedStoredSelection =
      storedSelectionQuery.data !== undefined || storedSelectionQuery.error !== null;
    if (!hasResolvedStoredSelection) {
      return;
    }

    setSelectedConnectionId(storedSelectionQuery.data?.connectionId ?? "");
    setSelectedModelId(storedSelectionQuery.data?.modelId ?? "");
    setSelectionHydrated(true);
  }, [selectionHydrated, storedSelectionQuery.data, storedSelectionQuery.error]);

  const handleSelectionChange = useCallback((connectionId: string, modelId: string) => {
    setSelectedConnectionId(connectionId);
    setSelectedModelId(modelId);
  }, []);

  const handleSelectionCommit = useCallback(
    (connectionId: string, modelId: string) => {
      handleSelectionChange(connectionId, modelId);
      void saveSelection.mutate(
        connectionId && modelId
          ? {
              connectionId,
              modelId,
            }
          : null,
      );
    },
    [handleSelectionChange, saveSelection],
  );

  return useMemo(
    () => ({
      selectedConnectionId,
      selectedModelId,
      selectionHydrated,
      isLoadingSelection: !selectionHydrated,
      handleSelectionChange,
      handleSelectionCommit,
    }),
    [
      handleSelectionChange,
      handleSelectionCommit,
      selectedConnectionId,
      selectedModelId,
      selectionHydrated,
    ],
  );
}
