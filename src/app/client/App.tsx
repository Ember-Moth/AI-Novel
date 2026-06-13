import { Activity } from "react";

import { useCachedProjectRoute } from "@/app/routing/useCachedProjectRoute";
import { AiConfigSettingsPage } from "@/modules/ai/ui/settings/AiConfigSettingsPage";
import { AiSettingsPage } from "@/modules/ai/ui/settings/AiSettingsPage";
import { PromptLibrarySettingsPage } from "@/modules/ai/ui/settings/PromptLibrarySettingsPage";
import { ProjectsPage } from "@/modules/projects/ui/ProjectsPage";
import { WorkspaceEditorPage } from "@/modules/workspace/ui/editor/WorkspaceEditorPage";

import "./styles.css";

export function App() {
  const {
    route,
    isProjectsPage,
    isSettings,
    isWorkspaceRoute,
    isKnownRoute,
    projectRouteId,
    cachedWorkspaceRoute,
  } = useCachedProjectRoute();

  if (!isKnownRoute) {
    return (
      <div className="flex h-dvh items-center justify-center bg-editor-background text-foreground-muted">
        404: No such page!
      </div>
    );
  }

  return (
    <>
      <Activity mode={isProjectsPage ? "visible" : "hidden"}>
        <ProjectsPage projectId={projectRouteId} />
      </Activity>

      <Activity mode={isSettings ? "visible" : "hidden"}>
        {route.kind === "settings" ? <SettingsPage section={route.section} /> : null}
      </Activity>

      {cachedWorkspaceRoute ? (
        <Activity mode={isWorkspaceRoute ? "visible" : "hidden"}>
          <WorkspaceEditorPage
            key={cachedWorkspaceRoute.workspaceId}
            projectId={cachedWorkspaceRoute.projectId}
            workspaceId={cachedWorkspaceRoute.workspaceId}
          />
        </Activity>
      ) : null}
    </>
  );
}

function SettingsPage({ section }: { section: "ai-connections" | "ai" | "prompts" }) {
  if (section === "prompts") {
    return <PromptLibrarySettingsPage />;
  }

  if (section === "ai") {
    return <AiConfigSettingsPage />;
  }

  return <AiSettingsPage />;
}
