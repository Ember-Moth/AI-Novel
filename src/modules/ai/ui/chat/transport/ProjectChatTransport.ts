import { DefaultChatTransport } from "ai";

import type {
  ProjectAssistantContextSnapshot,
  ProjectAssistantToolName,
} from "@/modules/ai/domain/types";

import type { ProjectChatMessage } from "../types";

export class ProjectChatTransport extends DefaultChatTransport<ProjectChatMessage> {
  private projectId: string;
  private chatId: string;

  constructor({
    projectId,
    chatId,
    getContext,
    getActiveTools,
  }: {
    projectId: string;
    chatId: string;
    getContext: () => ProjectAssistantContextSnapshot | null | undefined;
    getActiveTools: () => ProjectAssistantToolName[] | null | undefined;
  }) {
    super({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, trigger, messageId }) => ({
        body: {
          projectId,
          chatId,
          messages,
          trigger,
          messageId,
          context: getContext() ?? null,
          activeTools: getActiveTools() ?? null,
        },
      }),
      prepareReconnectToStreamRequest: () => ({
        api: "/api/chat",
      }),
    });
    this.projectId = projectId;
    this.chatId = chatId;
  }

  async abortStream(): Promise<boolean> {
    try {
      const response = await fetch(`/api/chats/${this.chatId}/abort?projectId=${this.projectId}`, {
        method: "POST",
      });
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error("Failed to abort stream:", error);
      return false;
    }
  }
}
