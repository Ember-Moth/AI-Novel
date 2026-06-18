import { getDefaultWorkspace } from "@/modules/workspace/domain";

import type {
  AssistantToolEnvelope,
  AssistantToolErrorContext,
  AssistantToolSuccess,
} from "./envelope";
import { failure } from "./envelope";

type MaybePromise<T> = T | Promise<T>;
type ProjectWorkspace = NonNullable<ReturnType<typeof getDefaultWorkspace>>;

export function getWorkspaceForProject(projectId: string) {
  return getDefaultWorkspace(projectId);
}

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return typeof value === "object" && value !== null && "then" in value;
}

export function withProjectWorkspace<T>(input: {
  projectId: string;
  execute: (workspace: ProjectWorkspace) => AssistantToolSuccess<T>;
  getContext?: () => AssistantToolErrorContext;
}): AssistantToolEnvelope<T>;
export function withProjectWorkspace<T>(input: {
  projectId: string;
  execute: (workspace: ProjectWorkspace) => Promise<AssistantToolSuccess<T>>;
  getContext?: () => AssistantToolErrorContext;
}): Promise<AssistantToolEnvelope<T>>;
export function withProjectWorkspace<T>(input: {
  projectId: string;
  execute: (workspace: ProjectWorkspace) => MaybePromise<AssistantToolSuccess<T>>;
  getContext?: () => AssistantToolErrorContext;
}): MaybePromise<AssistantToolEnvelope<T>> {
  try {
    const workspace = getWorkspaceForProject(input.projectId);
    if (!workspace) {
      throw new Error("当前项目没有默认工作区。");
    }
    const result = input.execute(workspace);
    if (isPromiseLike(result)) {
      return result.catch((error) => failure(error, input.getContext));
    }
    return result;
  } catch (error) {
    return failure(error, input.getContext);
  }
}
