import React from 'react';

export function formatNovaMessage(text: string): React.ReactNode {
  let cleaned = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/^\*{3,}$/gm, '')
    .replace(/^[-*]\s/gm, '')
    .replace(/^[•●◦▪▸►]\s?/gm, '');

  const lines = cleaned.split('\n');
  const result: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      result.push(<br key={`br-${lineIndex}`} />);
    }

    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    parts.forEach((part, partIndex) => {
      const boldMatch = part.match(/^\*\*(.+)\*\*$/);
      if (boldMatch) {
        result.push(
          <span key={`${lineIndex}-${partIndex}`} className="font-semibold text-white">
            {boldMatch[1]}
          </span>
        );
      } else {
        result.push(<React.Fragment key={`${lineIndex}-${partIndex}`}>{part}</React.Fragment>);
      }
    });
  });

  return <>{result}</>;
}
