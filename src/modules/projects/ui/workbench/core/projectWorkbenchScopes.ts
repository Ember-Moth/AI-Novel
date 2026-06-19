import { createScope } from "bunshi/react";

export const ProjectWorkbenchProjectScope = createScope<string>("");
export const ProjectWorkbenchBranchRouteScope = createScope<string | null>(null);
