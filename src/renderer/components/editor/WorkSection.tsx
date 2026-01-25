import { EditableField } from './EditableField';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { WorkEntry } from '../../types/cv';

interface WorkSectionProps {
  cvId: string;
  workHistory: WorkEntry[];
}

export function WorkSection({ cvId, workHistory }: WorkSectionProps) {
  if (!workHistory || workHistory.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary border-b border-border pb-2">
          Work History
        </h2>
        <p className="text-muted-foreground italic">No work history extracted</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-primary border-b border-border pb-2">
        Work History
      </h2>
      <div className="space-y-6">
        {workHistory.map((entry, index) => (
          <div
            key={index}
            className="p-4 bg-card rounded border border-border space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Position
                    </label>
                    <EditableField
                      value={entry.position}
                      cvId={cvId}
                      fieldPath={`work_history.[${index}].position`}
                      confidence={entry.confidence}
                      placeholder="Add position"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Company
                    </label>
                    <EditableField
                      value={entry.company}
                      cvId={cvId}
                      fieldPath={`work_history.[${index}].company`}
                      confidence={entry.confidence}
                      placeholder="Add company"
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
                      fieldPath={`work_history.[${index}].start_date`}
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
                      fieldPath={`work_history.[${index}].end_date`}
                      placeholder="Present"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Description
                  </label>
                  <EditableField
                    value={entry.description}
                    cvId={cvId}
                    fieldPath={`work_history.[${index}].description`}
                    placeholder="Add description"
                    multiline
                  />
                </div>
                {entry.highlights && entry.highlights.length > 0 && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Highlights
                    </label>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {entry.highlights.map((highlight, hIndex) => (
                        <li key={hIndex} className="text-foreground">
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <ConfidenceBadge value={entry.confidence} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
