import Highlighter from 'react-highlight-words';
import { getSkillVariants } from '../../lib/skillVariants';

interface SkillHighlightProps {
  text: string;
  matchedSkills: string[];
  className?: string;
}

/**
 * Highlights matched skills in text using react-highlight-words.
 * Expands skills to include their variants for comprehensive highlighting.
 */
export function SkillHighlight({ text, matchedSkills, className }: SkillHighlightProps) {
  // Expand each matched skill to include its known variants
  const searchWords = matchedSkills.flatMap(skill => {
    const variants = getSkillVariants(skill.toLowerCase());
    // Include the original skill plus any variants
    return variants.length > 0 ? variants : [skill.toLowerCase()];
  });

  // Remove duplicates
  const uniqueSearchWords = [...new Set(searchWords)];

  return (
    <Highlighter
      searchWords={uniqueSearchWords}
      autoEscape={true}
      textToHighlight={text}
      highlightClassName="bg-primary/30 text-primary font-medium px-0.5 rounded"
      className={className}
      caseSensitive={false}
    />
  );
}

/**
 * Highlights a single skill badge if it's in the matched list.
 */
export function HighlightedSkillBadge({
  skill,
  matchedSkills,
}: {
  skill: string;
  matchedSkills: string[];
}) {
  const isMatched = matchedSkills.some(matched => {
    const variants = getSkillVariants(matched.toLowerCase());
    const normalizedSkill = skill.toLowerCase();

    // Check exact match or variant match
    if (normalizedSkill === matched.toLowerCase()) return true;
    if (variants.includes(normalizedSkill)) return true;

    // Substring match
    if (normalizedSkill.includes(matched.toLowerCase()) ||
        matched.toLowerCase().includes(normalizedSkill)) {
      return true;
    }

    return false;
  });

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
        ${isMatched
          ? 'bg-primary/30 text-primary border border-primary/50'
          : 'bg-muted text-muted-foreground'
        }
      `}
    >
      {skill}
      {isMatched && (
        <span className="ml-1 text-[10px]" title="Matches JD requirement">
          *
        </span>
      )}
    </span>
  );
}
