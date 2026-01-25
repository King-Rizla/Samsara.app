import type { SkillGroup } from '../../types/cv';

interface SkillsSectionProps {
  cvId: string;
  skills: SkillGroup[];
}

export function SkillsSection({ cvId, skills }: SkillsSectionProps) {
  // cvId reserved for future inline skill editing
  void cvId;

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
      <h2 className="text-lg font-semibold text-primary border-b border-border pb-2">
        Skills
      </h2>
      <div className="space-y-4">
        {skills.map((group, index) => (
          <div key={index}>
            <h3 className="text-sm font-medium text-foreground mb-2">
              {group.category}
            </h3>
            <div className="flex flex-wrap gap-2">
              {group.skills.map((skill, skillIndex) => (
                <span
                  key={skillIndex}
                  className="px-2 py-1 bg-card border border-border rounded text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
