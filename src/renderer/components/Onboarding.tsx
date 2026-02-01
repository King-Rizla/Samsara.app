import { FileText, Target, Palette } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

interface OnboardingProps {
  onCreateProject: () => void;
  onDismiss: () => void;
}

const DISMISS_KEY = "samsara-onboarding-dismissed";

export function isDismissed(): boolean {
  return localStorage.getItem(DISMISS_KEY) === "true";
}

export function dismissOnboarding(): void {
  localStorage.setItem(DISMISS_KEY, "true");
}

export function Onboarding({ onCreateProject, onDismiss }: OnboardingProps) {
  const handleDismiss = () => {
    dismissOnboarding();
    onDismiss();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-card border-border">
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold text-foreground">
              Welcome to Samsara
            </h1>
            <p className="text-muted-foreground">
              AI-powered resume editing for recruiters
            </p>
          </div>

          <div className="w-full space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  CV Parsing
                </p>
                <p className="text-xs text-muted-foreground">
                  Drop in resumes and extract structured data automatically
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  JD Matching
                </p>
                <p className="text-xs text-muted-foreground">
                  Match candidates to job descriptions with AI scoring
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Palette className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Branded Export
                </p>
                <p className="text-xs text-muted-foreground">
                  Export polished, branded resumes ready for clients
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 w-full">
            <Button className="w-full" size="lg" onClick={onCreateProject}>
              Create Your First Project
            </Button>
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={handleDismiss}
            >
              Dismiss
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
