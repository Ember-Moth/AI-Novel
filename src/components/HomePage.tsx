import { type FormEvent, useRef, useState } from "react";
import { useLocation } from "wouter";

import { rpc } from "@/api/client";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function HomePage() {
  const [, navigate] = useLocation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: projects, error, isLoading } = rpc.useQuery("projects.list");
  const createProject = rpc.useMutation("projects.create");
  const deleteProject = rpc.useMutation("projects.delete");

  const projectList = [...(projects ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);

  const openCreateDialog = () => {
    setFormError(null);
    if (!dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  };

  const closeCreateDialog = () => {
    dialogRef.current?.close();
    setName("");
    setDescription("");
    setFormError(null);
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setFormError("项目名不能为空。");
      return;
    }

    try {
      const id = crypto.randomUUID();
      await createProject.mutate({
        id,
        name: trimmedName,
        description: trimmedDescription || null,
      });
      closeCreateDialog();
      navigate(`/project/${id}`);
    } catch (mutationError) {
      setFormError(
        mutationError instanceof Error ? mutationError.message : "创建项目失败，请稍后重试。",
      );
    }
  };

  const handleDeleteProject = async (id: string, projectName: string) => {
    if (!confirm(`确认删除项目“${projectName}”吗？`)) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteProject.mutate({ id });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-stone-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">项目</h1>
            <p className="mt-0.5 text-sm text-stone-500">{projectList.length} 个项目</p>
          </div>
          <button
            type="button"
            onClick={openCreateDialog}
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            新建
          </button>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
            加载中...
          </div>
        ) : null}

        {!isLoading && projectList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
            还没有项目，点击「新建」创建一个。
          </div>
        ) : null}

        {!isLoading ? (
          <div className="flex flex-col gap-1">
            {projectList.map((project) => (
              <div
                key={project.id}
                className="group -mx-2 flex items-start gap-2 rounded-lg px-2 py-2 transition hover:bg-stone-100"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-stone-900">{project.name}</span>
                    <span className="shrink-0 text-xs text-stone-400">
                      {dateFormatter.format(project.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-stone-500">
                    {project.description?.trim() || "暂无描述"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProject(project.id, project.name)}
                  disabled={deleteProject.isPending && deletingId === project.id}
                  className="shrink-0 rounded px-2 py-1 text-xs text-stone-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {deleteProject.isPending && deletingId === project.id ? "..." : "删除"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-stone-200 bg-white p-0 text-stone-900 shadow-lg backdrop:bg-stone-900/30"
      >
        <form onSubmit={handleCreateProject} className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold">新建项目</h2>
            <p className="mt-0.5 text-sm text-stone-500">创建一个新的故事项目。</p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-stone-700">项目名</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：雾港编年史"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-stone-500"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-stone-700">描述</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="可选"
              className="w-full resize-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-stone-500"
            />
          </label>

          {formError || createProject.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError ?? createProject.error?.message}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeCreateDialog}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createProject.isPending}
              className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createProject.isPending ? "创建中" : "创建"}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
