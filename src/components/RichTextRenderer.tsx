import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

interface RichTextRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function RichTextRenderer({ content, className = '', style }: RichTextRendererProps) {
  // All note content is rendered through the single sanitized Markdown pipeline.
  // Embedded HTML in stored notes passes through rehypeSanitize, which strips
  // scripts, event-handler attributes (onerror/onload/...) and dangerous URL
  // schemes, so no raw writer-supplied markup ever reaches the DOM.
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
