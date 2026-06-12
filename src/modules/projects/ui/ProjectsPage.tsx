import { ProjectListRoute } from "./ProjectListRoute";
import { ProjectWorkbenchRoute } from "./ProjectWorkbenchRoute";

export function ProjectsPage({ projectId = null }: { projectId?: string | null }) {
  return projectId ? <ProjectWorkbenchRoute projectId={projectId} /> : <ProjectListRoute />;
}
