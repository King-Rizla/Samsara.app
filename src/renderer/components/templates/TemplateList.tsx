import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useTemplateStore } from "../../stores/templateStore";
import { useProjectStore } from "../../stores/projectStore";
import {
  Plus,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";
import type { MessageTemplate } from "../../types/communication";

type FilterType = "all" | "sms" | "email";

interface TemplateListProps {
  onEdit: (template: MessageTemplate) => void;
  onNew: () => void;
}

/**
 * List of templates with filtering and CRUD actions.
 */
export function TemplateList({ onEdit, onNew }: TemplateListProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { templates, isLoading, loadTemplates, deleteTemplate } =
    useTemplateStore();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);

  // Load templates on mount and when project changes
  useEffect(() => {
    if (activeProjectId) {
      loadTemplates(activeProjectId);
    }
  }, [activeProjectId, loadTemplates]);

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    if (filter === "all") return true;
    return t.type === filter;
  });

  // Count by type
  const smsCount = templates.filter((t) => t.type === "sms").length;
  const emailCount = templates.filter((t) => t.type === "email").length;

  // Handle delete with confirmation
  const handleDelete = async (id: string) => {
    if (deleteConfirmId === id) {
      await deleteTemplate(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      // Auto-clear confirmation after 3 seconds
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  // Format relative date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with filter tabs and new button */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-1 bg-muted rounded-md p-1">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
            className="h-7"
          >
            All ({templates.length})
          </Button>
          <Button
            variant={filter === "sms" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("sms")}
            className="h-7"
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            SMS ({smsCount})
          </Button>
          <Button
            variant={filter === "email" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("email")}
            className="h-7"
          >
            <Mail className="h-3 w-3 mr-1" />
            Email ({emailCount})
          </Button>
        </div>

        <Button size="sm" onClick={onNew}>
          <Plus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading templates...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              {filter === "all"
                ? "No templates yet. Create your first template."
                : `No ${filter.toUpperCase()} templates.`}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onNew}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Template
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="group flex items-center justify-between p-3 rounded-md border border-border bg-background hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => onEdit(template)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {template.type === "sms" ? (
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {template.name}
                      </span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {template.type.toUpperCase()}
                      </Badge>
                      {template.isDefault && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {template.type === "email" && template.subject
                        ? template.subject
                        : template.body.substring(0, 60) +
                          (template.body.length > 60 ? "..." : "")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden group-hover:inline">
                    {formatDate(template.updatedAt)}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(template);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deleteConfirmId === template.id
                          ? "Click again to confirm"
                          : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplateList;
