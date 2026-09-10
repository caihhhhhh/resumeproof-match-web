export type ResumeTemplate = 'balanced' | 'compact' | 'minimal';

export type ReviewBlock = {
  kind: 'name' | 'headline' | 'contact' | 'section' | 'entry' | 'bullet' | 'body';
  text: string;
  fields?: { organization: string; role: string; date: string };
};

type ResumeDocumentProps = {
  blocks: ReviewBlock[];
  template?: ResumeTemplate;
  className?: string;
};

export function ResumeDocument({ blocks, template = 'balanced', className = '' }: ResumeDocumentProps) {
  return (
    <article className={`resume-paper template-${template} ${className}`.trim()}>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        const normalizedText = block.kind === 'bullet' ? block.text.replace(/^(?:[•·▪◦]|[-*]\s)\s*/, '').trim() : block.text.trim();
        if (!normalizedText) return null;
        if (block.kind === 'name') return <h1 key={key}>{block.text}</h1>;
        if (block.kind === 'section') return <h2 key={key}>{block.text.replace(/[:：]$/, '')}</h2>;
        if (block.kind === 'entry') {
          const entry = resumeEntry(block);
          return <div className="resume-entry" key={key}><h3>{entry.title}</h3>{entry.date && <span>{entry.date}</span>}</div>;
        }
        return <p key={key} className={`resume-${block.kind}`}>{normalizedText}</p>;
      })}
    </article>
  );
}

export function resumeEntry(block: ReviewBlock) {
  return block.fields ? { title: [block.fields.organization, block.fields.role].filter(Boolean).join(' | '), date: block.fields.date } : splitResumeEntry(block.text);
}

export function splitResumeEntry(value: string) {
  const datePattern = /((?:19|20)\d{2}[./]\d{1,2}\s*[-–—]\s*(?:至今|present|(?:19|20)\d{2}[./]\d{1,2})(?:\s*[|｜]\s*[^|｜]+)?)$/i;
  const match = value.match(datePattern);
  if (!match || match.index === undefined) return { title: value, date: '' };
  return { title: value.slice(0, match.index).trim().replace(/[|｜]\s*$/, ''), date: match[1].trim() };
}
