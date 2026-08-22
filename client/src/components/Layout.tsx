import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMemo } from "react";
import {
  LayoutDashboard,
  Layers,
  ListTodo,
  ClipboardList,
  Bug,
  UserSquare2,
  Gamepad2,
  ChevronsRight,
  GanttChart,
  TriangleAlert,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { UserDisplay } from '@/components/business-ui/user-display/user-display';
import { GlobalSearch } from '@/components/GlobalSearch';
import { ThemeSelector } from '@/components/ThemeSelector';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { path: "/", label: "项目总览", icon: LayoutDashboard },
  { path: "/versions", label: "版本管理", icon: Layers },
  { path: "/requirements", label: "需求管理", icon: ListTodo },
  { path: "/test-plans", label: "测试计划", icon: ClipboardList },
  { path: "/defects", label: "缺陷管理", icon: Bug },
  { path: "/schedules", label: "排期管理", icon: GanttChart },
  { path: "/exception-items", label: "异常事项", icon: TriangleAlert },
  { path: "/workbench", label: "个人工作台", icon: UserSquare2},
];

const LayoutContent = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const projectBasePath = `/projects/${projectId}`;

  const activeTitle = useMemo(() => {
    const matched = navItems.find((item: NavItem) => {
      const targetPath = item.path === "/" ? `${projectBasePath}/dashboard` : `${projectBasePath}${item.path}`;
      return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
    });
    return matched?.label || "项目管理";
  }, [pathname]);

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                    <Gamepad2 className="size-4" />
                  </div>
                  <div className="flex-1 font-heading text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                    项目管理中心
                  </div>
                  <ChevronsRight className="ml-auto size-4 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden" />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item: NavItem) => {
                  const Icon = item.icon;
                  const isActive =
                    item.path === "/"
                      ? pathname === `${projectBasePath}/dashboard`
                      : pathname === `${projectBasePath}${item.path}`
                        || pathname.startsWith(`${projectBasePath}${item.path}/`);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link to={item.path === "/" ? "dashboard" : item.path.slice(1)}>
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <div className="w-full">
                  <UserDisplay showLabel />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 flex flex-col overflow-hidden p-4">
        <header className="flex items-center gap-2 mb-6 h-10 shrink-0">
          <SidebarTrigger className="size-8" />
          <Breadcrumb className="self-center">
            <BreadcrumbList>
              <BreadcrumbItem className="text-foreground font-medium font-heading">
                {activeTitle}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <GlobalSearch />
          <ThemeSelector />
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem('current-project-id');
              navigate('/projects');
            }}
            className="inline-flex h-8 items-center gap-1 border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="退出当前项目并返回项目入口"
          >
            <span className="font-mono text-primary">{projectId}</span>
            <LogOut className="size-3.5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-h-0">
          <Outlet />
        </div>
      </main>
    </>
  );
};

const Layout = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default Layout;
