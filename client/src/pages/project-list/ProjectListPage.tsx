import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Pencil, Plus } from 'lucide-react';

import { createProject, getProjectList, updateProject } from '@/api/project';
import type { Project } from '@shared/api.interface';
import { ProjectLogo } from '@/components/ProjectLogo';
import { ThemeSelector } from '@/components/ThemeSelector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const PROJECT_STATUS_STYLES: Record<string, string> = {
  预研: 'bg-[#5E81AC]/20 text-[#5E81AC]',
  在研: 'bg-[#474C55]/20 text-[#474C55]',
  堆量: 'bg-[#BA6E40]/20 text-[#BA6E40]',
  测试: 'bg-[#DAA556]/20 text-[#DAA556]',
  优化: 'bg-[#80977A]/20 text-[#80977A]',
  上线: 'bg-[#84353E]/20 text-[#84353E]',
  运营: 'bg-[#766591]/20 text-[#766591]',
};
const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_STYLES);

export default function ProjectListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Project | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ projectId: '', projectName: '', status: '', description: '' });

  const loadProjects = () => {
    getProjectList()
      .then((response) => setProjects(response.items))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadProjects(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ projectId: '', projectName: '', status: '', description: '' });
    setDialogOpen(true);
  };
  const openEdit = (event: React.MouseEvent, project: Project) => {
    event.stopPropagation();
    setEditing(project);
    setForm({ projectId: project.projectId, projectName: project.projectName, status: project.status, description: project.description || '' });
    setDialogOpen(true);
  };
  const saveProject = async () => {
    if (editing) await updateProject(editing.projectId, form);
    else await createProject(form);
    setDialogOpen(false);
    setLoading(true);
    loadProjects();
  };
  const selectedStatuses = form.status ? form.status.split(',').filter(Boolean) : [];
  const toggleStatus = (status: string) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((item) => item !== status)
      : [...selectedStatuses, status];
    setForm({ ...form, status: next.join(',') });
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />加载项目中...</div>;
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-8 flex items-start justify-between border-b border-border pb-5">
          <div>
            <p className="font-mono text-xs text-primary">PROJECT PORTAL</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold text-foreground">选择项目</h1>
            <p className="mt-1 text-sm text-muted-foreground">进入项目后，所有数据仅显示当前项目范围。</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSelector />
            <Button size="sm" onClick={openCreate}><Plus className="size-3.5" />新建项目</Button>
          </div>
        </div>
        {projects.length === 0 ? (
          <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">暂无可进入的项目</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <button
                key={project.projectId}
                type="button"
                onClick={() => navigate(`/projects/${project.projectId}/dashboard`)}
                className="group border border-border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="flex items-start gap-4">
                  <ProjectLogo projectId={project.projectId} className="size-[8.25rem]" />
                  <div className="flex min-w-0 flex-1 flex-col self-stretch">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 truncate font-heading text-lg font-semibold text-foreground group-hover:text-primary">{project.projectName}</h2>
                      <button type="button" onClick={(event) => openEdit(event, project)} className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-primary" title="编辑项目"><Pencil className="size-3.5" /></button>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">{project.projectId}</span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{project.description || '暂无项目说明'}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="flex flex-wrap gap-1">
                    {(project.status ? project.status.split(',') : ['未设置']).map((status) => (
                      <span key={status} className={`rounded-full px-2 py-0.5 text-[11px] ${PROJECT_STATUS_STYLES[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>
                    ))}
                  </span>
                  <span className="text-primary">进入项目 →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? '编辑项目' : '新建项目'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={form.projectId} disabled={Boolean(editing)} placeholder="项目代号，例如 R02" onChange={(e) => setForm({ ...form, projectId: e.target.value })} />
            <Input value={form.projectName} placeholder="项目名称" onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              {PROJECT_STATUSES.map((status) => (
                <button key={status} type="button" onClick={() => toggleStatus(status)} className={`rounded-full px-3 py-1 text-xs transition-opacity ${PROJECT_STATUS_STYLES[status]} ${selectedStatuses.includes(status) ? 'opacity-100 ring-2 ring-primary/40' : 'opacity-45 hover:opacity-75'}`}>{status}</button>
              ))}
            </div>
            <Textarea value={form.description} placeholder="项目详情" onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button><Button onClick={saveProject}>保存</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
