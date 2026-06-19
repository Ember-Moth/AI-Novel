import { useCallback } from "react";

import { rpc } from "@/rpc/client";

import { updateProjectOptimistically } from "../../shared/projectCache";
import type { ProjectList } from "../../shared/projectTypes";
import { useProjectWorkbenchViewModel } from "../core/useProjectWorkbench";
import { useProjectWorkbenchStoreApi } from "../state/projectWorkbenchStore";

type ProjectMutationContext = {
  previousProjects?: ProjectList;
};

export function useProjectMetadataFeature() {
  const model = useProjectWorkbenchViewModel();
  const workbenchStore = useProjectWorkbenchStoreApi();
  const updateProject = rpc.useMutation<"projects.update", ProjectMutationContext>(
    "projects.update",
    {
      onMutate: (input) => {
        const previousProjects = rpc.getQueryData("projects.list", undefined);
        if (previousProjects) {
          rpc.setQueryData(
            "projects.list",
            undefined,
            updateProjectOptimistically(previousProjects, {
              id: input.id,
              name: input.name,
              description: input.description ?? null,
            }),
          );
        }
        return { previousProjects };
      },
      onError: (_, __, context) => {
        if (context?.previousProjects) {
          rpc.setQueryData("projects.list", undefined, context.previousProjects);
        }
      },
    },
  );

  const commit = useCallback(async () => {
    const project = model.project;
    if (!project) {
      return;
    }

    const { detailName, detailDescription, setDetailError, setDetailName, setDetailDescription } =
      workbenchStore.getState();
    const trimmedName = detailName.trim();
    const trimmedDescription = detailDescription.trim();
    const currentDescription = project.description ?? "";

    if (!trimmedName) {
      setDetailError("项目名不能为空。");
      setDetailName(project.name);
      setDetailDescription(currentDescription);
      return;
    }

    if (trimmedName === project.name && trimmedDescription === currentDescription) {
      setDetailError(null);
      if (detailName !== trimmedName) {
        setDetailName(trimmedName);
      }
      if (detailDescription !== trimmedDescription) {
        setDetailDescription(trimmedDescription);
      }
      return;
    }

    try {
      setDetailError(null);
      await updateProject.mutate({
        id: project.id,
        name: trimmedName,
        description: trimmedDescription || null,
      });
      setDetailName(trimmedName);
      setDetailDescription(trimmedDescription);
    } catch (mutationError) {
      setDetailError(
        mutationError instanceof Error ? mutationError.message : "更新项目失败，请稍后重试。",
      );
      setDetailName(project.name);
      setDetailDescription(currentDescription);
    }
  }, [model.project, updateProject, workbenchStore]);

  return {
    commit,
    errorMessage: updateProject.error?.message ?? null,
    isPending: updateProject.isPending,
  };
}
