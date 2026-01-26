import type { SkillGroup } from '../../types/cv';
import { useJDStore } from '../../stores/jdStore';
import { useEditorStore } from '../../stores/editorStore';
import { HighlightedSkillBadge } from '../jd/SkillHighlight';

interface SkillsSectionProps {
  cvId: string;
  skills: SkillGroup[];
}

export function SkillsSection({ cvId, skills }: SkillsSectionProps) {
  // cvId reserved for future inline skill editing
  void cvId;

  const { activeJD, matchResults } = useJDStore();
  const { activeCVId } = useEditorStore();

  // Get matched skills for the current CV if viewing in JD context
  const currentMatch = matchResults.find(r => r.cv_id === activeCVId);
  const matchedSkills = currentMatch?.matched_skills || [];

  // Determine if we should highlight (JD is active and we have match results)
  const shouldHighlight = activeJD !== null && matchedSkills.length > 0;

  if (!skills || skills.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary border-b border-border pb-2">
          Skills
        </h2>
        <p className="text-muted-foreground italic">No skills extracted</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-lg font-semibold text-primary">
          Skills
        </h2>
        {shouldHighlight && activeJD && (
          <span className="text-xs text-primary">
            Highlighting matches for: {activeJD.title}
          </span>
        )}
      </div>
      <div className="space-y-4">
        {skills.map((group, index) => (
          <div key={index}>
            <h3 className="text-sm font-medium text-foreground mb-2">
              {group.category}
            </h3>
            <div className="flex flex-wrap gap-2">
              {group.skills.map((skill, skillIndex) => (
                shouldHighlight ? (
                  <HighlightedSkillBadge
                    key={skillIndex}
                    skill={skill}
                    matchedSkills={matchedSkills}
                  />
                ) : (
                  <span
                    key={skillIndex}
                    className="px-2 py-1 bg-card border border-border rounded text-sm"
                  >
                    {skill}
                  </span>
                )
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Show missing required skills if viewing in JD context */}
      {shouldHighlight && currentMatch && currentMatch.missing_required.length > 0 && (
        <div className="mt-4 p-3 rounded-md border border-destructive/30 bg-destructive/5">
          <h4 className="text-xs font-medium text-destructive mb-2">
            Missing Required Skills
          </h4>
          <div className="flex flex-wrap gap-2">
            {currentMatch.missing_required.map((skill, index) => (
              <span
                key={index}
                className="px-2 py-1 rounded text-xs font-medium bg-destructive/20 text-destructive"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
