import { EditableField } from './EditableField';
import type { ContactInfo } from '../../types/cv';

interface ContactSectionProps {
  cvId: string;
  contact: ContactInfo;
}

export function ContactSection({ cvId, contact }: ContactSectionProps) {
  const fields: { key: keyof ContactInfo; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'github', label: 'GitHub' },
    { key: 'portfolio', label: 'Portfolio' },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-primary border-b border-border pb-2">
        Contact Information
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs text-muted-foreground mb-1">
              {field.label}
            </label>
            <EditableField
              value={contact[field.key] || ''}
              cvId={cvId}
              fieldPath={`contact.${field.key}`}
              placeholder={`Add ${field.label.toLowerCase()}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
