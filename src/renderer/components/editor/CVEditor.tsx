import { useEditorStore } from '../../stores/editorStore';
import { Button } from '../ui/button';
import { ContactSection } from './ContactSection';
import { WorkSection } from './WorkSection';
import { EducationSection } from './EducationSection';
import { SkillsSection } from './SkillsSection';
import { ConfidenceBadge } from './ConfidenceBadge';

export function CVEditor() {
  const activeCVId = useEditorStore((state) => state.activeCVId);
  const activeCV = useEditorStore((state) => state.activeCV);
  const closePanel = useEditorStore((state) => state.closePanel);

  if (!activeCVId || !activeCV) {
    return null;
  }

  const handleClose = () => {
    closePanel();
  };

  return (
    <div className="h-full flex flex-col bg-background border-l border-border">
      {/* Editor header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-foreground">CV Editor</h2>
          {activeCV.parse_confidence !== undefined && (
            <ConfidenceBadge value={activeCV.parse_confidence} />
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground"
        >
          Close
        </Button>
      </div>

      {/* Editor content - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        <ContactSection cvId={activeCVId} contact={activeCV.contact} />
        <WorkSection cvId={activeCVId} workHistory={activeCV.work_history} />
        <EducationSection cvId={activeCVId} education={activeCV.education} />
        <SkillsSection cvId={activeCVId} skills={activeCV.skills} />

        {/* Warnings section if any */}
        {activeCV.warnings && activeCV.warnings.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-warning border-b border-warning pb-2">
              Parsing Warnings
            </h2>
            <ul className="list-disc list-inside space-y-1 text-warning">
              {activeCV.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
