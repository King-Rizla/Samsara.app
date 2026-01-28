import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Edit2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import type { BooleanStrings, SearchHints } from '../../types/jd';
import { transformBooleanSyntax } from '../../lib/booleanSyntax';
import { useUsageStore } from '../../stores/usageStore';

interface SearchToolsProps {
  booleanStrings: BooleanStrings;
  searchHints: SearchHints;
}

const TIER_LABELS: Record<keyof BooleanStrings, { label: string; description: string }> = {
  wide: { label: 'Wide Search', description: 'Broad coverage, many candidates' },
  midline: { label: 'Midline Search', description: 'Balanced precision and recall' },
  narrow: { label: 'Narrow Search', description: 'Strict match, fewer candidates' },
};

export function SearchTools({ booleanStrings, searchHints }: SearchToolsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<keyof BooleanStrings | null>(null);
  const [editedStrings, setEditedStrings] = useState<BooleanStrings>(booleanStrings);
  const { booleanSyntax } = useUsageStore();

  const handleCopy = (key: keyof BooleanStrings) => {
    const transformed = transformBooleanSyntax(editedStrings[key], booleanSyntax);
    navigator.clipboard.writeText(transformed);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleEdit = (key: keyof BooleanStrings) => {
    setEditingKey(editingKey === key ? null : key);
  };

  const handleEditChange = (key: keyof BooleanStrings, value: string) => {
    setEditedStrings({ ...editedStrings, [key]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Search Tools
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-2">
        {(['wide', 'midline', 'narrow'] as const).map((tier) => (
          <div key={tier} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">{TIER_LABELS[tier].label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{TIER_LABELS[tier].description}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEdit(tier)} title={editingKey === tier ? 'Done editing' : 'Edit'}>
                  {editingKey === tier ? <X className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCopy(tier)} title="Copy to clipboard">
                  {copiedKey === tier ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            {editingKey === tier ? (
              <textarea
                className="w-full p-2 text-xs bg-muted rounded border border-border font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                value={editedStrings[tier]}
                onChange={(e) => handleEditChange(tier, e.target.value)}
                rows={3}
              />
            ) : (
              <div className="p-2 text-xs bg-muted rounded font-mono text-muted-foreground break-all">
                {transformBooleanSyntax(editedStrings[tier], booleanSyntax)}
              </div>
            )}
          </div>
        ))}

        {searchHints.suggested_titles.length > 0 && (
          <div className="pt-2 border-t border-border">
            <span className="text-sm font-medium text-foreground">Suggested Titles</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {searchHints.suggested_titles.map((title) => (
                <span key={title} className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">{title}</span>
              ))}
            </div>
          </div>
        )}

        {searchHints.negative_keywords.length > 0 && (
          <div>
            <span className="text-sm font-medium text-foreground">Exclude Terms</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {searchHints.negative_keywords.map((keyword) => (
                <span key={keyword} className="px-2 py-0.5 text-xs bg-red-500/10 text-red-400 rounded">{keyword}</span>
              ))}
            </div>
          </div>
        )}

        {searchHints.industries && searchHints.industries.length > 0 && (
          <div>
            <span className="text-sm font-medium text-foreground">Industries</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {searchHints.industries.map((industry) => (
                <span key={industry} className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded">{industry}</span>
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
