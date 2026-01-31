import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";

interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/project/${id}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Wheel
      </Button>
      <div className="h-4 w-px bg-border" />
      <span className="font-medium text-sm">{title}</span>
    </div>
  );
}
