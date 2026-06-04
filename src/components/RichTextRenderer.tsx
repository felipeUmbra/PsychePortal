import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

interface RichTextRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function RichTextRenderer({ content, className = '', style }: RichTextRendererProps) {
  // Simple check: if content contains HTML tags, treat it as HTML. Otherwise, treat it as Markdown.
  const isHTML = /<[a-z][\s\S]*>/i.test(content || '');

  if (isHTML) {
    return (
      <div 
        className={`prose prose-slate max-w-none text-[14px] leading-relaxed text-text-main rich-text-content ${className}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Fallback to ReactMarkdown for legacy Markdown data
  return (
    <div 
      className={`prose prose-slate max-w-none text-[14px] leading-relaxed text-text-main markdown-content ${className}`}
      style={style}
    >
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
