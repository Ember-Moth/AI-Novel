export function resolveSidebarActiveChat(input: {
  activeChatId: string | null;
  visibleChatIds: string[];
  canAutoCreateWhenEmpty: boolean;
}) {
  const { activeChatId, visibleChatIds, canAutoCreateWhenEmpty } = input;

  if (activeChatId && visibleChatIds.includes(activeChatId)) {
    return {
      nextActiveChatId: activeChatId,
      shouldAutoCreate: false,
    };
  }

  if (visibleChatIds[0]) {
    return {
      nextActiveChatId: visibleChatIds[0],
      shouldAutoCreate: false,
    };
  }

  return {
    nextActiveChatId: null,
    shouldAutoCreate: canAutoCreateWhenEmpty,
  };
}
