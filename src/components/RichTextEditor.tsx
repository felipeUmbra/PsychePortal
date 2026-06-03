import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Heading, Link, Trash2 } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  height?: number;
  className?: string;
}

export default function RichTextEditor({ value, onChange, height = 300, className = '' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync value from parent (only if different to prevent cursor jumps)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '<p><br></p>';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html === '<p><br></p>' || html === '<br>' ? '' : html);
    }
  };

  const executeCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    handleInput();
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const addLink = () => {
    const url = prompt('Enter the URL:');
    if (url) {
      executeCommand('createLink', url);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const cleanNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent || '';
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          const children = Array.from(el.childNodes).map(cleanNode).join('');

          if (['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'div'].includes(tagName)) {
            return `<${tagName}>${children}</${tagName}>`;
          }
          if (tagName === 'a') {
            const href = el.getAttribute('href');
            return `<a href="${href || '#'}" target="_blank" rel="noopener noreferrer">${children}</a>`;
          }
          return children;
        }
        return '';
      };

      const cleanHTML = Array.from(doc.body.childNodes).map(cleanNode).join('');
      document.execCommand('insertHTML', false, cleanHTML || `<p>${text}</p>`);
    } else if (text) {
      // Split by newlines to insert paragraphs or linebreaks
      const paragraphs = text.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '<p><br></p>').join('');
      document.execCommand('insertHTML', false, paragraphs);
    }
  };

  return (
    <div 
      className={`flex flex-col border border-border-custom rounded-xl overflow-hidden bg-white transition-all duration-200 ${
        isFocused ? 'ring-2 ring-primary-custom/20 border-primary-custom' : ''
      } ${className}`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-border-custom select-none">
        <button
          type="button"
          onClick={() => executeCommand('bold')}
          className="p-1.5 hover:bg-slate-200 rounded text-text-main transition-colors"
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('italic')}
          className="p-1.5 hover:bg-slate-200 rounded text-text-main transition-colors"
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('underline')}
          className="p-1.5 hover:bg-slate-200 rounded text-text-main transition-colors"
          title="Underline"
        >
          <Underline className="w-4 h-4" />
        </button>
        
        <span className="w-px h-5 bg-border-custom mx-1" />

        <button
          type="button"
          onClick={() => executeCommand('formatBlock', '<h3>')}
          className="p-1.5 hover:bg-slate-200 rounded text-text-main transition-colors"
          title="Heading"
        >
          <Heading className="w-4 h-4" />
        </button>

        <span className="w-px h-5 bg-border-custom mx-1" />

        <button
          type="button"
          onClick={() => executeCommand('insertUnorderedList')}
          className="p-1.5 hover:bg-slate-200 rounded text-text-main transition-colors"
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('insertOrderedList')}
          className="p-1.5 hover:bg-slate-200 rounded text-text-main transition-colors"
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <span className="w-px h-5 bg-border-custom mx-1" />

        <button
          type="button"
          onClick={addLink}
          className="p-1.5 hover:bg-slate-200 rounded text-text-main transition-colors"
          title="Add Link"
        >
          <Link className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => executeCommand('removeFormat')}
          className="p-1.5 hover:bg-slate-200 rounded text-text-main transition-colors"
          title="Clear Formatting"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content Area */}
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          handleInput();
        }}
        className="w-full p-4 overflow-y-auto outline-none prose prose-slate max-w-none text-[14px] leading-relaxed text-text-main"
        style={{ minHeight: `${height}px` }}
      />
    </div>
  );
}
