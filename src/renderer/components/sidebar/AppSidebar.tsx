import { useNavigate, useLocation } from 'react-router-dom';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LayoutDashboard, Settings, FolderOpen, Pin, X } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from '../ui/sidebar';

const navItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
];

interface PinnedProject {
  id: string;
  name: string;
}

interface AppSidebarProps {
  pinnedProjects?: PinnedProject[];
  onUnpin?: (projectId: string) => void;
}

function SortablePinnedProject({
  project,
  onUnpin,
}: {
  project: PinnedProject;
  onUnpin?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `pinned-${project.id}`,
    data: { type: 'pinned-project', project },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton
        {...attributes}
        {...listeners}
        onClick={() => navigate(`/project/${project.id}`)}
        tooltip={project.name}
        className="group"
      >
        <FolderOpen className="h-4 w-4" />
        <span className="truncate flex-1">{project.name}</span>
        {/* X to unpin - uses div to avoid button-in-button nesting */}
        <div
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onUnpin?.(project.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-opacity cursor-pointer"
          title="Unpin project"
        >
          <X className="h-3 w-3" />
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarDropZone({ isOver }: { isOver: boolean }) {
  return (
    <div
      className={`
        mx-2 my-1 p-2 rounded-md border-2 border-dashed
        text-xs text-muted-foreground text-center
        transition-colors
        ${isOver ? 'border-primary bg-primary/10' : 'border-border'}
      `}
    >
      <Pin className="h-4 w-4 mx-auto mb-1" />
      Drop to pin
    </div>
  );
}

export function AppSidebar({ pinnedProjects = [], onUnpin }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const { setNodeRef, isOver } = useDroppable({ id: 'sidebar-quick-access' });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <span className="text-lg font-bold text-primary group-data-[collapsible=icon]:hidden">
          Samsara
        </span>
        <span className="text-lg font-bold text-primary hidden group-data-[collapsible=icon]:block">
          S
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={location.pathname === item.path}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Access section for pinned projects */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground">
            Quick Access
          </SidebarGroupLabel>
          <SidebarGroupContent ref={setNodeRef}>
            <SortableContext
              items={pinnedProjects.map(p => `pinned-${p.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <SidebarMenu>
                {pinnedProjects.map((project) => (
                  <SortablePinnedProject
                    key={project.id}
                    project={project}
                    onUnpin={onUnpin}
                  />
                ))}
              </SidebarMenu>
            </SortableContext>
            <SidebarDropZone isOver={isOver} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate('/settings')}
              isActive={location.pathname === '/settings'}
              tooltip="Settings"
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
