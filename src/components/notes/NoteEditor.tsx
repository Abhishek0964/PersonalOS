import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Heading1, Heading2,
  List, ListOrdered, Quote, Link2, Save, Loader2, CheckSquare, Minus, Table as TableIcon,
  Download, Upload,
} from 'lucide-react';
import type { Note, NoteUpdate } from '../../types/domain';
import { useUpdateNote } from '../../hooks/useNotes';
import { useToastStore } from '../../stores/toastStore';

interface Props {
  note: Note;
  workspaceId: string;
}

export function NoteEditor({ note, workspaceId }: Props) {
  const updateNote = useUpdateNote();
  const showToast = useToastStore((s) => s.showToast);
  const [title, setTitle] = useState(note.title);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef({ title: note.title, content: note.content ?? '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'code-block' } },
      }),
      Underline,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { class: 'text-primary-400 underline' },
      }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: note.content ?? '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor prose-invert max-w-none focus:outline-none text-sm text-gray-200 px-5 py-4 min-h-[200px]',
      },
    },
  });

  // Sync when switching notes
  useEffect(() => {
    setTitle(note.title);
    lastSavedRef.current = { title: note.title, content: note.content ?? '' };
    if (editor) {
      editor.commands.setContent(note.content ?? '', false);
    }
  }, [note.id, note.title, note.content, editor]);

  const save = useCallback(async (updates: NoteUpdate) => {
    setIsSaving(true);
    try {
      await updateNote.mutateAsync({ id: note.id, updates });
      setSavedAt(new Date());
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [note.id, updateNote, showToast]);

  const scheduleAutosave = useCallback((newTitle: string, newContent: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (newTitle !== lastSavedRef.current.title || newContent !== lastSavedRef.current.content) {
        save({ title: newTitle, content: newContent });
        lastSavedRef.current = { title: newTitle, content: newContent };
      }
    }, 1500);
  }, [save]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    scheduleAutosave(value, editor?.getHTML() ?? '');
  };

  const handleEditorUpdate = useCallback(() => {
    const html = editor?.getHTML() ?? '';
    scheduleAutosave(title, html);
  }, [editor, title, scheduleAutosave]);

  useEffect(() => {
    if (editor) {
      editor.on('update', handleEditorUpdate);
      return () => { editor.off('update', handleEditorUpdate); };
    }
  }, [editor, handleEditorUpdate]);

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  const handleManualSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const html = editor?.getHTML() ?? '';
    save({ title, content: html });
    lastSavedRef.current = { title, content: html };
  };

  // Markdown export
  const handleExportMarkdown = () => {
    const html = editor?.getHTML() ?? '';
    const md = htmlToMarkdown(html);
    const blob = new Blob([`# ${title}\n\n${md}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Note exported as Markdown');
  };

  // Markdown import
  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const md = ev.target?.result as string;
      const html = markdownToHtml(md);
      editor?.commands.setContent(html, true);
      scheduleAutosave(title, html);
      showToast('success', 'Markdown imported');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const ToolbarButton = ({ icon: Icon, onClick, isActive, title, disabled }: {
    icon: React.ElementType; onClick: () => void; isActive?: boolean; title: string; disabled?: boolean;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      className={`p-1.5 rounded transition-colors ${isActive ? 'bg-primary-600/20 text-primary-300' : 'text-gray-400 hover:bg-surface-300 hover:text-gray-100'} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
      title={title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full">
      <input
        type="file"
        ref={fileInputRef}
        accept=".md,text/markdown"
        onChange={handleImportMarkdown}
        className="hidden"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-surface-400/30 bg-surface-100 rounded-t-xl flex-wrap">
        <ToolbarButton icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold" />
        <ToolbarButton icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic" />
        <ToolbarButton icon={UnderlineIcon} onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline" />
        <ToolbarButton icon={Strikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough" />
        <ToolbarButton icon={Code} onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Inline Code" />
        <div className="w-px h-5 bg-surface-400/40 mx-1" />
        <ToolbarButton icon={Heading1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1" />
        <ToolbarButton icon={Heading2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2" />
        <div className="w-px h-5 bg-surface-400/40 mx-1" />
        <ToolbarButton icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List" />
        <ToolbarButton icon={ListOrdered} onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List" />
        <ToolbarButton icon={CheckSquare} onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="Checklist" />
        <div className="w-px h-5 bg-surface-400/40 mx-1" />
        <ToolbarButton icon={Quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Quote" />
        <ToolbarButton icon={Code} onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code Block" />
        <ToolbarButton icon={Minus} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule" />
        <ToolbarButton icon={TableIcon} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table" />
        <div className="w-px h-5 bg-surface-400/40 mx-1" />
        <ToolbarButton
          icon={Link2}
          onClick={() => {
            const url = window.prompt('Enter URL:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          isActive={editor.isActive('link')}
          title="Insert Link"
        />

        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton icon={Upload} onClick={() => fileInputRef.current?.click()} title="Import Markdown" />
          <ToolbarButton icon={Download} onClick={handleExportMarkdown} title="Export Markdown" />
          <div className="w-px h-5 bg-surface-400/40 mx-1" />
          {isSaving ? (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          ) : savedAt ? (
            <span className="text-xs text-gray-600">Saved {savedAt.toLocaleTimeString()}</span>
          ) : null}
          <button onClick={handleManualSave} className="btn-ghost py-1 px-2 text-xs">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Untitled note"
        className="px-5 py-3 text-lg font-semibold text-white bg-transparent border-b border-surface-400/20 focus:outline-none placeholder-gray-600"
      />

      {/* Editor */}
      <div className="flex-1 overflow-y-auto tiptap-container">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// Simple HTML to Markdown converter
function htmlToMarkdown(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  function convertNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const content = Array.from(el.childNodes).map(convertNode).join('');

    switch (tag) {
      case 'h1': return `\n# ${content}\n`;
      case 'h2': return `\n## ${content}\n`;
      case 'h3': return `\n### ${content}\n`;
      case 'p': return `\n${content}\n`;
      case 'strong': case 'b': return `**${content}**`;
      case 'em': case 'i': return `*${content}*`;
      case 'u': return `<u>${content}</u>`;
      case 's': case 'del': return `~~${content}~~`;
      case 'code': return `\`${content}\``;
      case 'pre': return `\n\`\`\`\n${el.textContent}\n\`\`\`\n`;
      case 'blockquote': return `\n> ${content}\n`;
      case 'ul': return Array.from(el.children).map(li => `- ${convertNode(li)}`).join('\n') + '\n';
      case 'ol': return Array.from(el.children).map((li, i) => `${i + 1}. ${convertNode(li)}`).join('\n') + '\n';
      case 'li': return content;
      case 'a': return `[${content}](${el.getAttribute('href') ?? ''})`;
      case 'hr': return '\n---\n';
      case 'br': return '\n';
      case 'input': return el.getAttribute('type') === 'checkbox' ? (el.checked ? '[x] ' : '[ ] ') : '';
      case 'table': return `\n${content}\n`;
      case 'th': return `| ${content} `;
      case 'td': return `| ${content} `;
      case 'tr': return `${content}|\n`;
      case 'thead': return content + `|${'---|'.repeat((el as HTMLElement).children.length)}\n`;
      case 'tbody': return content;
      default: return content;
    }
  }

  return convertNode(tmp).trim();
}

// Simple Markdown to HTML converter
function markdownToHtml(md: string): string {
  let html = md;

  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');
  // Blockquote
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  // Inline code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  // Checklists
  html = html.replace(/^\s*- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-checked="true"><p>$1</p></li></ul>');
  html = html.replace(/^\s*- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-checked="false"><p>$1</p></li></ul>');
  // Unordered lists
  html = html.replace(/^\s*- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');
  // Ordered lists
  html = html.replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>');
  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');

  return html;
}
