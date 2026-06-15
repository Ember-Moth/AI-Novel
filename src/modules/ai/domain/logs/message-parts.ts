import type { ModelMessage } from "ai";

import { createId } from "@/shared/lib/domain";

import type {
  AgentMessagePartRow,
  AgentPartState,
  AgentThreadNodePartKind,
  AgentThreadNodePartView,
  AgentThreadRole,
  AgentVisibility,
} from "../types";
import {
  serializeOptionalJson,
  serializeRequiredJson,
  stringifyStoredArray,
  type CreateNodeExtraPartInput,
} from "./shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function withProviderOptions<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
) {
  const providerOptions =
    Reflect.get(source, "providerOptions") ?? Reflect.get(source, "providerMetadata");
  return providerOptions == null
    ? target
    : ({
        ...target,
        providerOptions,
      } satisfies Record<string, unknown>);
}

function normalizeToolResultOutput(output: unknown): Record<string, unknown> {
  if (isRecord(output)) {
    const type = Reflect.get(output, "type");
    if (type === "text") {
      return withProviderOptions(
        {
          type: "text",
          value:
            typeof Reflect.get(output, "value") === "string"
              ? (Reflect.get(output, "value") as string)
              : String(Reflect.get(output, "value") ?? ""),
        },
        output,
      );
    }
    if (type === "json") {
      return withProviderOptions(
        {
          type: "json",
          value: Reflect.get(output, "value") ?? null,
        },
        output,
      );
    }
    if (type === "execution-denied") {
      return withProviderOptions(
        {
          type: "execution-denied",
          ...(typeof Reflect.get(output, "reason") === "string"
            ? { reason: Reflect.get(output, "reason") as string }
            : {}),
        },
        output,
      );
    }
    if (type === "error-text") {
      return withProviderOptions(
        {
          type: "error-text",
          value:
            typeof Reflect.get(output, "value") === "string"
              ? (Reflect.get(output, "value") as string)
              : String(Reflect.get(output, "value") ?? ""),
        },
        output,
      );
    }
    if (type === "error-json") {
      return withProviderOptions(
        {
          type: "error-json",
          value: Reflect.get(output, "value") ?? null,
        },
        output,
      );
    }
    if (type === "content") {
      const rawValue = Reflect.get(output, "value");
      const value = Array.isArray(rawValue)
        ? rawValue.flatMap((part) => {
            if (!isRecord(part)) {
              return [];
            }
            const partType = Reflect.get(part, "type");
            if (partType === "text") {
              return [
                withProviderOptions(
                  {
                    type: "text",
                    text:
                      typeof Reflect.get(part, "text") === "string"
                        ? (Reflect.get(part, "text") as string)
                        : String(Reflect.get(part, "text") ?? ""),
                  },
                  part,
                ),
              ];
            }
            if (partType === "media") {
              const data = Reflect.get(part, "data");
              const mediaType = Reflect.get(part, "mediaType");
              if (typeof data !== "string" || typeof mediaType !== "string") {
                return [];
              }
              return [{ type: "media", data, mediaType }];
            }
            if (partType === "file-data") {
              const data = Reflect.get(part, "data");
              const mediaType = Reflect.get(part, "mediaType");
              if (typeof data !== "string" || typeof mediaType !== "string") {
                return [];
              }
              return [
                withProviderOptions(
                  {
                    type: "file-data",
                    data,
                    mediaType,
                    ...(typeof Reflect.get(part, "filename") === "string"
                      ? { filename: Reflect.get(part, "filename") as string }
                      : {}),
                  },
                  part,
                ),
              ];
            }
            if (partType === "file-url") {
              const url = Reflect.get(part, "url");
              if (typeof url !== "string") {
                return [];
              }
              return [withProviderOptions({ type: "file-url", url }, part)];
            }
            if (partType === "file-id") {
              const fileId = Reflect.get(part, "fileId");
              if (typeof fileId !== "string" && !isRecord(fileId)) {
                return [];
              }
              return [withProviderOptions({ type: "file-id", fileId }, part)];
            }
            if (partType === "image-data") {
              const data = Reflect.get(part, "data");
              const mediaType = Reflect.get(part, "mediaType");
              if (typeof data !== "string" || typeof mediaType !== "string") {
                return [];
              }
              return [withProviderOptions({ type: "image-data", data, mediaType }, part)];
            }
            if (partType === "image-url") {
              const url = Reflect.get(part, "url");
              if (typeof url !== "string") {
                return [];
              }
              return [withProviderOptions({ type: "image-url", url }, part)];
            }
            if (partType === "image-file-id") {
              const fileId = Reflect.get(part, "fileId");
              if (typeof fileId !== "string" && !isRecord(fileId)) {
                return [];
              }
              return [withProviderOptions({ type: "image-file-id", fileId }, part)];
            }
            if (partType === "custom") {
              return [withProviderOptions({ type: "custom" }, part)];
            }
            return [];
          })
        : [];
      return withProviderOptions({ type: "content", value }, output);
    }
  }

  if (typeof output === "string") {
    return { type: "text", value: output };
  }

  return {
    type: "json",
    value: output ?? null,
  };
}

function normalizeMessagePartForRole(
  role: ModelMessage["role"],
  rawPart: unknown,
): Record<string, unknown> | null {
  const part = isRecord(rawPart)
    ? rawPart
    : {
        type: "text",
        text: String(rawPart ?? ""),
      };
  const type = Reflect.get(part, "type");

  if (type === "text") {
    return withProviderOptions(
      {
        type: "text",
        text:
          typeof Reflect.get(part, "text") === "string"
            ? (Reflect.get(part, "text") as string)
            : String(Reflect.get(part, "text") ?? ""),
      },
      part,
    );
  }

  if (role === "user") {
    if (type === "image") {
      const image = Reflect.get(part, "image");
      if (image == null) {
        return null;
      }
      return withProviderOptions(
        {
          type: "image",
          image,
          ...(typeof Reflect.get(part, "mediaType") === "string"
            ? { mediaType: Reflect.get(part, "mediaType") as string }
            : {}),
        },
        part,
      );
    }
    if (type === "file") {
      const data = Reflect.get(part, "data");
      const mediaType = Reflect.get(part, "mediaType");
      if (data == null || typeof mediaType !== "string") {
        return null;
      }
      return withProviderOptions(
        {
          type: "file",
          data,
          mediaType,
          ...(typeof Reflect.get(part, "filename") === "string"
            ? { filename: Reflect.get(part, "filename") as string }
            : {}),
        },
        part,
      );
    }
    return null;
  }

  if (role === "assistant") {
    if (type === "reasoning") {
      return withProviderOptions(
        {
          type: "reasoning",
          text:
            typeof Reflect.get(part, "text") === "string"
              ? (Reflect.get(part, "text") as string)
              : String(Reflect.get(part, "text") ?? ""),
        },
        part,
      );
    }
    if (type === "file") {
      const data = Reflect.get(part, "data");
      const mediaType = Reflect.get(part, "mediaType");
      if (data == null || typeof mediaType !== "string") {
        return null;
      }
      return withProviderOptions(
        {
          type: "file",
          data,
          mediaType,
          ...(typeof Reflect.get(part, "filename") === "string"
            ? { filename: Reflect.get(part, "filename") as string }
            : {}),
        },
        part,
      );
    }
    if (type === "tool-call") {
      const toolCallId = Reflect.get(part, "toolCallId");
      const toolName = Reflect.get(part, "toolName");
      if (typeof toolCallId !== "string" || typeof toolName !== "string") {
        return null;
      }
      return {
        ...withProviderOptions(
          {
            type: "tool-call",
            toolCallId,
            toolName,
            input: Reflect.get(part, "input"),
          },
          part,
        ),
        ...(typeof Reflect.get(part, "providerExecuted") === "boolean"
          ? { providerExecuted: Reflect.get(part, "providerExecuted") as boolean }
          : {}),
      };
    }
    if (type === "tool-result") {
      const toolCallId = Reflect.get(part, "toolCallId");
      const toolName = Reflect.get(part, "toolName");
      if (typeof toolCallId !== "string" || typeof toolName !== "string") {
        return null;
      }
      return withProviderOptions(
        {
          type: "tool-result",
          toolCallId,
          toolName,
          output: normalizeToolResultOutput(Reflect.get(part, "output")),
        },
        part,
      );
    }
    if (type === "tool-approval-request") {
      const approvalId = Reflect.get(part, "approvalId");
      const toolCallId = Reflect.get(part, "toolCallId");
      if (typeof approvalId !== "string" || typeof toolCallId !== "string") {
        return null;
      }
      return {
        type: "tool-approval-request",
        approvalId,
        toolCallId,
      };
    }
    return null;
  }

  if (role === "tool") {
    if (type === "tool-result") {
      const toolCallId = Reflect.get(part, "toolCallId");
      const toolName = Reflect.get(part, "toolName");
      if (typeof toolCallId !== "string" || typeof toolName !== "string") {
        return null;
      }
      return withProviderOptions(
        {
          type: "tool-result",
          toolCallId,
          toolName,
          output: normalizeToolResultOutput(Reflect.get(part, "output")),
        },
        part,
      );
    }
    if (type === "tool-approval-response") {
      const approvalId = Reflect.get(part, "approvalId");
      const approved = Reflect.get(part, "approved");
      if (typeof approvalId !== "string" || typeof approved !== "boolean") {
        return null;
      }
      return {
        type: "tool-approval-response",
        approvalId,
        approved,
        ...(typeof Reflect.get(part, "reason") === "string"
          ? { reason: Reflect.get(part, "reason") as string }
          : {}),
      };
    }
  }

  return null;
}

export function normalizeModelMessage(message: ModelMessage): ModelMessage {
  const providerOptions = Reflect.get(message as Record<string, unknown>, "providerOptions");

  if (message.role === "system") {
    return {
      role: "system",
      content:
        typeof message.content === "string" ? message.content : (getTextishSummary(message) ?? ""),
      ...(providerOptions == null ? {} : { providerOptions }),
    } as ModelMessage;
  }

  const rawContent = (message as { content?: unknown }).content;
  const parts =
    typeof rawContent === "string"
      ? [{ type: "text", text: rawContent }]
      : Array.isArray(rawContent)
        ? rawContent
        : [];

  const normalizedContent = parts.flatMap((part) => {
    const normalizedPart = normalizeMessagePartForRole(message.role, part);
    return normalizedPart ? [normalizedPart] : [];
  });

  return {
    role: message.role,
    content:
      message.role === "tool"
        ? normalizedContent
        : typeof rawContent === "string"
          ? rawContent
          : normalizedContent,
    ...(providerOptions == null ? {} : { providerOptions }),
  } as ModelMessage;
}

function inferPartKind(rawPart: Record<string, unknown>): AgentThreadNodePartKind {
  const type = rawPart.type;
  if (type === "text") return "text";
  if (type === "reasoning") return "reasoning";
  if (type === "tool-call") return "tool-call";
  if (type === "tool-result") return "tool-result";
  if (type === "tool-approval-request") return "tool-approval-request";
  if (type === "tool-approval-response") return "tool-approval-response";
  if (type === "tool-error") return "tool-error";
  if (type === "file") return "file";
  if (type === "step-start") return "step-start";
  if (type === "source") {
    return typeof rawPart.url === "string" ? "source-url" : "source-document";
  }
  if (typeof type === "string" && type.startsWith("data-")) {
    return "data";
  }
  return "data";
}

function inferVisibility(partKind: AgentThreadNodePartKind): AgentVisibility {
  if (partKind === "reasoning") {
    return "hidden";
  }
  if (
    partKind === "tool-call" ||
    partKind === "tool-result" ||
    partKind === "tool-approval-request" ||
    partKind === "tool-approval-response" ||
    partKind === "tool-error"
  ) {
    return "internal";
  }
  return "public";
}

function normalizeMessageParts(message: ModelMessage) {
  const role = message.role;
  const rawContent = (message as { content?: unknown }).content;
  const normalized =
    typeof rawContent === "string"
      ? [{ type: "text", text: rawContent }]
      : Array.isArray(rawContent)
        ? rawContent
        : [];

  return normalized.map((part, partIndex) => {
    const rawPart =
      part && typeof part === "object"
        ? ({ ...(part as Record<string, unknown>) } satisfies Record<string, unknown>)
        : { type: "text", text: String(part ?? "") };
    const partKind =
      role === "tool" && !("type" in rawPart) ? "tool-result" : inferPartKind(rawPart);
    return {
      partIndex,
      partKind,
      visibility: inferVisibility(partKind),
      state:
        Reflect.get(rawPart, "state") === "streaming" || Reflect.get(rawPart, "state") === "done"
          ? (Reflect.get(rawPart, "state") as AgentPartState)
          : ("done" as AgentPartState),
      providerOptions: Reflect.get(rawPart, "providerOptions"),
      providerMetadata: Reflect.get(rawPart, "providerMetadata"),
      payload: rawPart,
    };
  });
}

function normalizeExtraNodeParts(parts: CreateNodeExtraPartInput[], startIndex: number) {
  return parts.map((part, offset) => ({
    partIndex: startIndex + offset,
    partKind: part.partKind,
    visibility: part.visibility ?? inferVisibility(part.partKind),
    state: part.state ?? "done",
    providerOptions: part.providerOptions,
    providerMetadata: part.providerMetadata,
    payload: part.payload,
  }));
}

function isModelMessagePart(part: AgentThreadNodePartView) {
  return part.partKind !== "data-assistant-ref";
}

export function buildModelMessageFromParts(
  role: AgentThreadRole,
  parts: AgentThreadNodePartView[],
): ModelMessage {
  const contentParts = parts
    .filter(isModelMessagePart)
    .sort((a, b) => a.partIndex - b.partIndex)
    .map((part) => projectStoredPartPayload(part.payload));

  if (role === "system") {
    return {
      role,
      content: contentParts
        .flatMap((part) => {
          if (!part || typeof part !== "object") {
            return [];
          }
          const text = Reflect.get(part as Record<string, unknown>, "text");
          return typeof text === "string" ? [text] : [];
        })
        .join("\n"),
    } as ModelMessage;
  }

  return {
    role,
    content: contentParts,
  } as ModelMessage;
}

function projectStoredPartPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const record = { ...(payload as Record<string, unknown>) };
  delete record.state;
  if (record.providerOptions == null && record.providerMetadata != null) {
    record.providerOptions = record.providerMetadata;
  }
  delete record.providerMetadata;
  return record;
}

export function getMessageContentParts(message: ModelMessage): unknown[] {
  const rawContent = (message as { content?: unknown }).content;
  return typeof rawContent === "string"
    ? [{ type: "text", text: rawContent }]
    : Array.isArray(rawContent)
      ? [...rawContent]
      : [];
}

function getTextishSummary(message: ModelMessage) {
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return null;
  }

  const texts = content.flatMap((part) => {
    if (!part || typeof part !== "object") {
      return [];
    }
    const type = Reflect.get(part as Record<string, unknown>, "type");
    if (type === "text" || type === "reasoning") {
      const text = Reflect.get(part as Record<string, unknown>, "text");
      return typeof text === "string" ? [text] : [];
    }
    return [];
  });

  return texts.length > 0 ? texts.join(" ").trim() : null;
}

export function buildMessageSummary(message: ModelMessage) {
  const textSummary = getTextishSummary(message);
  if (textSummary) {
    const normalized = textSummary.replace(/\s+/g, " ").trim();
    return normalized.length <= 80 ? normalized : `${normalized.slice(0, 80)}…`;
  }

  if (message.role === "tool") {
    const content = (message as { content?: unknown }).content;
    const first = Array.isArray(content) ? content[0] : null;
    const toolName =
      first && typeof first === "object"
        ? Reflect.get(first as Record<string, unknown>, "toolName")
        : null;
    return typeof toolName === "string" ? `工具结果：${toolName}` : "工具结果";
  }

  if (message.role === "assistant") {
    const content = (message as { content?: unknown }).content;
    const first = Array.isArray(content) ? content[0] : null;
    const toolName =
      first && typeof first === "object"
        ? Reflect.get(first as Record<string, unknown>, "toolName")
        : null;
    return typeof toolName === "string" ? `调用工具：${toolName}` : "助手回复";
  }

  return message.role === "system" ? "系统消息" : "消息";
}

export function buildStoredMessagePartRows(
  nodeId: string,
  createdAt: number,
  message: ModelMessage,
  extraParts: CreateNodeExtraPartInput[] | undefined,
) {
  const messageParts = normalizeMessageParts(message);
  const normalizedExtraParts = normalizeExtraNodeParts(extraParts ?? [], messageParts.length);
  return [...messageParts, ...normalizedExtraParts].map((part) => ({
    id: createId("agent_part"),
    nodeId,
    partIndex: part.partIndex,
    partKind: part.partKind,
    visibility: part.visibility,
    state: part.state,
    providerOptionsJson: serializeOptionalJson(part.providerOptions),
    providerMetadataJson: serializeOptionalJson(part.providerMetadata),
    payloadJson: serializeRequiredJson(part.payload, "节点 part"),
    createdAt,
  })) satisfies AgentMessagePartRow[];
}

export function stringifyStoredMessagePartRows(rows: AgentMessagePartRow[]) {
  return stringifyStoredArray(rows);
}
