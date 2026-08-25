export type ResumeTemplate = 'balanced' | 'compact' | 'minimal';

export type ReviewBlock = {
  kind: 'name' | 'contact' | 'section' | 'entry' | 'bullet' | 'body';
  text: string;
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
        if (block.kind === 'name') return <h1 key={key}>{block.text}</h1>;
        if (block.kind === 'section') return <h2 key={key}>{block.text.replace(/[:：]$/, '')}</h2>;
        if (block.kind === 'entry') return <h3 key={key}>{block.text}</h3>;
        return <p key={key} className={`resume-${block.kind}`}>{block.text}</p>;
      })}
    </article>
  );
}
