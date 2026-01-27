import { useEffect } from 'react';
import { Button } from '../ui/button';
import { useJDStore } from '../../stores/jdStore';
import { useEditorStore } from '../../stores/editorStore';

export function JDList() {
  const { jds, activeJDId, loadJDs, selectJD, deleteJD } = useJDStore();
  const showJDDetail = useEditorStore((state) => state.showJDDetail);

  useEffect(() => {
    loadJDs();
  }, [loadJDs]);

  if (jds.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>No job descriptions yet.</p>
        <p className="text-sm mt-1">Paste a JD in the "Add JD" tab to get started.</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {jds.map((jd) => (
        <div
          key={jd.id}
          className={`
            p-3 rounded-md border cursor-pointer transition-colors
            ${activeJDId === jd.id
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-muted-foreground'
            }
          `}
          onClick={() => selectJD(jd.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate">
                {jd.title}
              </h3>
              {jd.company && (
                <p className="text-sm text-muted-foreground truncate">
                  {jd.company}
                </p>
              )}
              <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                <span>{jd.required_count} required</span>
                <span>|</span>
                <span>{jd.preferred_count} preferred</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  selectJD(jd.id);
                  showJDDetail();
                }}
              >
                View
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteJD(jd.id);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {new Date(jd.created_at).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}
