import { useNavigate } from 'react-router-dom';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { MoreHorizontal, Archive, Trash2, Gauge } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { Project } from '../../types/project';
import { formatTokensWithCost } from '../../stores/usageStore';

interface ProjectCardProps {
  project: Project;
  tokenUsage?: number;
  llmMode?: 'local' | 'cloud';
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, tokenUsage, llmMode = 'local', onArchive, onDelete }: ProjectCardProps) {
  const navigate = useNavigate();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `project-${project.id}`,
    data: { type: 'project', project },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleCardClick = () => {
    // Only navigate if not dragging
    if (!isDragging) {
      navigate(`/project/${project.id}`);
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="bg-card border-border hover:border-primary transition-colors"
      {...attributes}
    >
      <CardHeader
        className="flex flex-row items-start justify-between space-y-0 pb-2 cursor-grab select-none"
        {...listeners}
      >
        <div
          className="space-y-1 flex-1 cursor-pointer"
          onClick={handleCardClick}
        >
          <CardTitle className="text-lg font-medium">{project.name}</CardTitle>
          {project.client_name && (
            <CardDescription className="text-sm">{project.client_name}</CardDescription>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(project.id); }}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent
        className="cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{project.cv_count} CVs</span>
          <span className="text-muted-foreground/50">·</span>
          <span>{project.jd_count} JDs</span>
          {tokenUsage !== undefined && tokenUsage > 0 && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                {formatTokensWithCost(tokenUsage, llmMode)}
              </span>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Last activity: {formatDate(project.updated_at)}
        </p>
      </CardContent>
    </Card>
  );
}
