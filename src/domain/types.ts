import type { InferSelectModel } from "drizzle-orm";

import type { schema } from "@/db";
import type { ORIGIN_TIMELINE_POINT_ID } from "@/shared/constants";

type AuxNodeRow = InferSelectModel<typeof schema.auxNodes>;

export type AiProviderRow = InferSelectModel<typeof schema.aiProviders>;
export type AiModelRow = InferSelectModel<typeof schema.aiModels>;

export interface AiProviderView {
  id: string;
  name: string;
  providerType: string;
  baseUrl: string | null;
  apiKeyEncrpted: boolean;
  isEnabled: boolean;
  models: AiModelView[];
}

export interface AiModelView {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  supportsVision: boolean;
  supportsToolUse: boolean;
  inputPricePer1m: number | null;
  outputPricePer1m: number | null;
  isDefault: boolean;
  isEnabled: boolean;
}

export type TimelinePointRef = string | null | undefined | typeof ORIGIN_TIMELINE_POINT_ID;
export type AuxNodeType = AuxNodeRow["nodeType"];

export interface TimelinePointView {
  id: string | typeof ORIGIN_TIMELINE_POINT_ID;
  key: string;
  label: string;
  description: string | null;
  prevPointId: string | typeof ORIGIN_TIMELINE_POINT_ID | null;
  isImplicitOrigin: boolean;
}

export interface ExportedContentNode {
  id: string;
  anchorTimelinePointId: string | typeof ORIGIN_TIMELINE_POINT_ID;
  kind: string | null;
  title: string | null;
  body: string | null;
  children: ExportedContentNode[];
}

export interface ExportedContentSubtree {
  rootNodeId: string;
  isWorkspaceRoot: boolean;
  nodes: ExportedContentNode[];
}

export interface ExportedAuxNode {
  id: string;
  nodeType: AuxNodeType;
  parentAuxNodeId: string | null;
  name: string | null;
  content: string | null;
  symlinkTargetAuxNodeId: string | null;
  symlinkTargetPath: string | null;
  timelinePointId: string | typeof ORIGIN_TIMELINE_POINT_ID;
  path: string;
  children: ExportedAuxNode[];
}

export interface ExportedAuxSnapshotTree {
  rootNodeId: string;
  timelinePointId: string | typeof ORIGIN_TIMELINE_POINT_ID;
  nodes: ExportedAuxNode[];
}

export interface AuxLayerChangeView {
  path: string;
  isDeleted: boolean;
}

export interface ResolvedAuxNode {
  id: string;
  nodeType: AuxNodeType;
  parentAuxNodeId: string | null;
  name: string | null;
  content: string | null;
  symlinkTargetAuxNodeId: string | null;
  timelinePointId: string | typeof ORIGIN_TIMELINE_POINT_ID;
  path: string;
}

export interface WritingContext {
  contentNode: ExportedContentNode;
  timelinePointId: string | typeof ORIGIN_TIMELINE_POINT_ID;
  auxSnapshot: ResolvedAuxNode[];
}

export interface ResolvedAuxSnapshotNode extends ResolvedAuxNode {
  reachable: boolean;
}
