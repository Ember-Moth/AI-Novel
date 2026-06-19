import { ProjectListRoute } from "../list/ProjectListRoute";
import { ProjectWorkbenchRoute } from "../workbench/ProjectWorkbenchRoute";

export function ProjectsPage({
  projectId = null,
  branchId = null,
}: {
  projectId?: string | null;
  branchId?: string | null;
}) {
  return projectId ? (
    <ProjectWorkbenchRoute projectId={projectId} branchId={branchId} />
  ) : (
    <ProjectListRoute />
  );
}
