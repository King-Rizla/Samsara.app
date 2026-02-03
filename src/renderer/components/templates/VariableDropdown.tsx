import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import type { TemplateVariable } from "../../types/communication";

interface VariableDropdownProps {
  variables: TemplateVariable[];
  onInsert: (variableKey: string) => void;
  disabled?: boolean;
}

/**
 * Dropdown menu for inserting template variables.
 * Variables are grouped by category (candidate, role, recruiter).
 */
export function VariableDropdown({
  variables,
  onInsert,
  disabled,
}: VariableDropdownProps) {
  const candidateVars = variables.filter((v) => v.category === "candidate");
  const roleVars = variables.filter((v) => v.category === "role");
  const recruiterVars = variables.filter((v) => v.category === "recruiter");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          Insert Variable <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {candidateVars.length > 0 && (
          <>
            <DropdownMenuLabel>Candidate</DropdownMenuLabel>
            {candidateVars.map((v) => (
              <DropdownMenuItem
                key={v.key}
                onClick={() => onInsert(v.key)}
                className="flex justify-between"
              >
                <span className="font-medium">{v.label}</span>
                <span className="text-xs text-muted-foreground">
                  {v.example}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}
        {roleVars.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Role</DropdownMenuLabel>
            {roleVars.map((v) => (
              <DropdownMenuItem
                key={v.key}
                onClick={() => onInsert(v.key)}
                className="flex justify-between"
              >
                <span className="font-medium">{v.label}</span>
                <span className="text-xs text-muted-foreground">
                  {v.example}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}
        {recruiterVars.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Recruiter</DropdownMenuLabel>
            {recruiterVars.map((v) => (
              <DropdownMenuItem
                key={v.key}
                onClick={() => onInsert(v.key)}
                className="flex justify-between"
              >
                <span className="font-medium">{v.label}</span>
                <span className="text-xs text-muted-foreground">
                  {v.example}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default VariableDropdown;
