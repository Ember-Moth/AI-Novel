import { mutation, query } from "@codehz/rpc/core";

import {
  getAiAssistantModelSelection as readAiAssistantModelSelection,
  setAiAssistantModelSelection as writeAiAssistantModelSelection,
  type AiAssistantModelSelection,
} from "@/modules/config/domain/ai-assistant-model-selection";
import { rpcTags, type RpcTagList } from "@/rpc/tags";

export const getAiAssistantModelSelection = query<
  void,
  AiAssistantModelSelection | null,
  RpcTagList
>({
  watch: () => [rpcTags.aiAssistantModelSelection()],
  handler: () => readAiAssistantModelSelection(),
});

export const setAiAssistantModelSelection = mutation<
  AiAssistantModelSelection | null | void,
  AiAssistantModelSelection | null,
  RpcTagList
>(async (input, ctx) => {
  const selection = writeAiAssistantModelSelection(input ?? null);
  ctx.invalidate(rpcTags.aiAssistantModelSelection());
  return selection;
});
