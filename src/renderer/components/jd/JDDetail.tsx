import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useJDStore } from '../../stores/jdStore';
import { useEditorStore } from '../../stores/editorStore';

/**
 * JDDetail displays the full job description with skills highlighted.
 * Similar to CVEditor but for job descriptions.
 */
export function JDDetail() {
  const { activeJD } = useJDStore();
  const closePanel = useEditorStore((state) => state.closePanel);

  if (!activeJD) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Select a job description to view details.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header with close button */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{activeJD.title}</h2>
          {activeJD.company && (
            <p className="text-muted-foreground">{activeJD.company}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={closePanel}>
          Close
        </Button>
      </div>

      {/* Experience & Education */}
      {(activeJD.experience_min || activeJD.education_level) && (
        <div className="flex flex-wrap gap-2">
          {activeJD.experience_min && (
            <Badge variant="outline">
              {activeJD.experience_max
                ? `${activeJD.experience_min}-${activeJD.experience_max} years`
                : `${activeJD.experience_min}+ years`}
            </Badge>
          )}
          {activeJD.education_level && (
            <Badge variant="outline">{activeJD.education_level}</Badge>
          )}
        </div>
      )}

      {/* Required Skills */}
      {activeJD.required_skills.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            Required Skills
            <Badge variant="destructive" className="text-xs">
              {activeJD.required_skills.length}
            </Badge>
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeJD.required_skills.map((skill, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30
                           rounded text-sm font-medium cursor-default
                           underline decoration-red-500/50 decoration-2 underline-offset-2"
              >
                {skill.skill}
                {skill.category && (
                  <span className="ml-1 text-xs text-red-400/60">({skill.category})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preferred Skills */}
      {activeJD.preferred_skills.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            Preferred Skills
            <Badge variant="secondary" className="text-xs">
              {activeJD.preferred_skills.length}
            </Badge>
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeJD.preferred_skills.map((skill, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30
                           rounded text-sm font-medium cursor-default
                           underline decoration-yellow-500/50 decoration-2 underline-offset-2"
              >
                {skill.skill}
                {skill.category && (
                  <span className="ml-1 text-xs text-yellow-400/60">({skill.category})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {activeJD.certifications && activeJD.certifications.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Certifications</h3>
          <div className="flex flex-wrap gap-2">
            {activeJD.certifications.map((cert, index) => (
              <Badge key={index} variant="outline">
                {cert}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Raw Text */}
      {activeJD.raw_text && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Original Text</h3>
          <div className="p-3 bg-muted rounded-md border border-border">
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
              {activeJD.raw_text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
