import { EditableField } from './EditableField';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { EducationEntry } from '../../types/cv';

interface EducationSectionProps {
  cvId: string;
  education: EducationEntry[];
}

export function EducationSection({ cvId, education }: EducationSectionProps) {
  if (!education || education.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary border-b border-border pb-2">
          Education
        </h2>
        <p className="text-muted-foreground italic">No education extracted</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-primary border-b border-border pb-2">
        Education
      </h2>
      <div className="space-y-6">
        {education.map((entry, index) => (
          <div
            key={index}
            className="p-4 bg-card rounded border border-border space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Institution
                    </label>
                    <EditableField
                      value={entry.institution}
                      cvId={cvId}
                      fieldPath={`education.[${index}].institution`}
                      confidence={entry.confidence}
                      placeholder="Add institution"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Degree
                    </label>
                    <EditableField
                      value={entry.degree}
                      cvId={cvId}
                      fieldPath={`education.[${index}].degree`}
                      confidence={entry.confidence}
                      placeholder="Add degree"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Field of Study
                    </label>
                    <EditableField
                      value={entry.field_of_study || ''}
                      cvId={cvId}
                      fieldPath={`education.[${index}].field_of_study`}
                      placeholder="Add field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Grade
                    </label>
                    <EditableField
                      value={entry.grade || ''}
                      cvId={cvId}
                      fieldPath={`education.[${index}].grade`}
                      placeholder="Add grade"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Start Date
                    </label>
                    <EditableField
                      value={entry.start_date || ''}
                      cvId={cvId}
                      fieldPath={`education.[${index}].start_date`}
                      placeholder="Add start date"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      End Date
                    </label>
                    <EditableField
                      value={entry.end_date || ''}
                      cvId={cvId}
                      fieldPath={`education.[${index}].end_date`}
                      placeholder="Add end date"
                    />
                  </div>
                </div>
              </div>
              <ConfidenceBadge value={entry.confidence} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
