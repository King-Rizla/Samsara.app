import { SectionHeader } from "./SectionHeader";

interface PlaceholderSectionProps {
  name: string;
  accentColor?: string;
}

export function PlaceholderSection({
  name,
  accentColor,
}: PlaceholderSectionProps) {
  return (
    <div className="flex flex-col h-full">
      <SectionHeader title={name} />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground mb-3"
            style={
              accentColor
                ? { borderColor: accentColor, borderWidth: 1 }
                : undefined
            }
          >
            Coming Soon
          </span>
          <p className="text-muted-foreground text-sm">{name}</p>
        </div>
      </div>
    </div>
  );
}
