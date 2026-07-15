import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  FileText,
  File,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatFileSize } from '../../services/fileService';
import { useToastStore } from '../../stores/toastStore';
import type { FileItem } from '../../types/domain';

const BUCKET_NAME = 'files';

export interface FileViewerProps {
  file: FileItem;
  workspaceId: string;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function isPreviewable(mimeType: string | null): boolean {
  if (!mimeType) return false;
  const lower = mimeType.toLowerCase();
  if (lower.startsWith('image/')) return true;
  if (lower.startsWith('video/')) return true;
  if (lower.startsWith('audio/')) return true;
  if (lower === 'application/pdf') return true;
  if (lower.startsWith('text/')) return true;
  if (lower.includes('markdown')) return true;
  if (lower === 'application/json') return true;
  // Common markdown extensions served with odd mime types
  if (lower === 'text/markdown' || lower === 'text/x-markdown') return true;
  return false;
}

function getFileKind(mimeType: string | null): 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'unknown' {
  if (!mimeType) return 'unknown';
  const lower = mimeType.toLowerCase();
  if (lower.startsWith('image/')) return 'image';
  if (lower.startsWith('video/')) return 'video';
  if (lower.startsWith('audio/')) return 'audio';
  if (lower === 'application/pdf') return 'pdf';
  if (lower.startsWith('text/') || lower.includes('markdown') || lower === 'application/json') {
    return 'text';
  }
  return 'unknown';
}

function isMarkdown(mimeType: string | null, fileName: string): boolean {
  if (mimeType && mimeType.toLowerCase().includes('markdown')) return true;
  return /\.(md|markdown|mdown|mkd)$/i.test(fileName);
}

function isJson(mimeType: string | null, fileName: string): boolean {
  if (mimeType && mimeType.toLowerCase() === 'application/json') return true;
  return /\.json$/i.test(fileName);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Minimal, dependency-free markdown -> HTML converter.
 * Supports: headings (h1-h6), bold, italic, inline code, code blocks,
 * unordered/ordered lists, links, blockquotes, and horizontal rules.
 * Not a full CommonMark implementation — intentionally simple & safe.
 */
function renderMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';
  let inList: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  };

  const inline = (text: string): string => {
    let out = escapeHtml(text);
    // inline code (do first so its content isn't further formatted)
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    // links [text](url)
    out = out.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    // bold
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // italic
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    out = out.replace(/_([^_]+)_/g, '<em>$1</em>');
    return out;
  };

  for (const raw of lines) {
    // fenced code block
    const fence = raw.match(/^```(\w*)/);
    if (fence) {
      if (inCodeBlock) {
        html.push(
          `<pre><code${codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ''}>${escapeHtml(
            codeBuffer.join('\n')
          )}</code></pre>`
        );
        codeBuffer = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
        codeLang = fence[1] ?? '';
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(raw);
      continue;
    }

    // blank line
    if (raw.trim() === '') {
      closeList();
      continue;
    }

    // headings
    const heading = raw.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(raw)) {
      closeList();
      html.push('<hr />');
      continue;
    }

    // blockquote
    const quote = raw.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      html.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    // unordered list item
    const ul = raw.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      if (inList !== 'ul') {
        closeList();
        html.push('<ul>');
        inList = 'ul';
      }
      html.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    // ordered list item
    const ol = raw.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (inList !== 'ol') {
        closeList();
        html.push('<ol>');
        inList = 'ol';
      }
      html.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    // paragraph
    closeList();
    html.push(`<p>${inline(raw)}</p>`);
  }

  // flush open code block
  if (inCodeBlock) {
    html.push(
      `<pre><code${codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ''}>${escapeHtml(
        codeBuffer.join('\n')
      )}</code></pre>`
    );
  }
  closeList();
  return html.join('\n');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function typeBadgeLabel(mimeType: string | null, name: string): string {
  if (!mimeType) return 'FILE';
  const lower = mimeType.toLowerCase();
  if (lower.startsWith('image/')) return 'IMAGE';
  if (lower.startsWith('video/')) return 'VIDEO';
  if (lower.startsWith('audio/')) return 'AUDIO';
  if (lower === 'application/pdf') return 'PDF';
  if (lower.includes('markdown') || /\.(md|markdown)$/i.test(name)) return 'MARKDOWN';
  if (lower === 'application/json' || /\.json$/i.test(name)) return 'JSON';
  if (lower.startsWith('text/')) return 'TEXT';
  return mimeType.split('/')[1]?.toUpperCase() ?? 'FILE';
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FileViewer({ file, onClose }: FileViewerProps) {
  const showToast = useToastStore((s) => s.showToast);
  const kind = getFileKind(file.mime_type);

  const [state, setState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [signedUrl, setSignedUrl] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');

  // image viewer state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // pdf zoom
  const [pdfZoom, setPdfZoom] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isMd = isMarkdown(file.mime_type, file.name);
  const isJsonContent = isJson(file.mime_type, file.name);

  /* ----- fetch signed URL or text content ----- */
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setErrorMsg('');
    setSignedUrl('');
    setTextContent('');
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setPdfZoom(1);

    (async () => {
      try {
        if (kind === 'text') {
          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(file.storage_path);
          if (error) throw error;
          const blob = data as Blob;
          const text = await blob.text();
          if (cancelled) return;
          setTextContent(text);
        } else {
          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(file.storage_path, 3600);
          if (error) throw error;
          if (cancelled) return;
          if (!data?.signedUrl) throw new Error('Failed to generate file URL');
          setSignedUrl(data.signedUrl);
        }
        if (!cancelled) setState('ready');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load file';
        setErrorMsg(msg);
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file.id, file.storage_path, kind]);

  /* ----- esc to close ----- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  /* ----- download handler ----- */
  const handleDownload = useCallback(async () => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET_NAME).download(file.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('success', 'Download started');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      showToast('error', msg);
    }
  }, [file.storage_path, file.name, showToast]);

  /* ----- image pan handlers ----- */
  const onImageMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

  const onImageWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    setZoom((z) => {
      const next = Math.min(3, Math.max(1, +(z + delta).toFixed(1)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const zoomIn = () => setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)));
  const zoomOut = () =>
    setZoom((z) => {
      const next = Math.max(1, +(z - 0.5).toFixed(1));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  const rotate = () => setRotation((r) => (r + 90) % 360);

  /* ----- pdf zoom ----- */
  const pdfZoomIn = () => setPdfZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const pdfZoomOut = () => setPdfZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));

  /* ----- video fullscreen ----- */
  const videoFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
    else if ((v as HTMLVideoElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
      (v as HTMLVideoElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.();
    }
  };

  const badgeLabel = typeBadgeLabel(file.mime_type, file.name);

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-surface-0/90 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`File viewer: ${file.name}`}
    >
      {/* ---------- Top bar ---------- */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-400/30 bg-surface-100/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <File className="w-5 h-5 text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-100 truncate" title={file.name}>
            {file.name}
          </span>
          <span className="badge bg-surface-300 text-gray-400 shrink-0">{badgeLabel}</span>
          {file.size_bytes != null && (
            <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">
              {formatFileSize(file.size_bytes)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* per-type controls */}
          {kind === 'image' && state === 'ready' && (
            <>
              <IconBtn onClick={zoomOut} disabled={zoom <= 1} title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </IconBtn>
              <span className="text-xs text-gray-400 px-1 tabular-nums w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <IconBtn onClick={zoomIn} disabled={zoom >= 3} title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </IconBtn>
              <IconBtn onClick={rotate} title="Rotate">
                <RotateCw className="w-4 h-4" />
              </IconBtn>
            </>
          )}
          {kind === 'pdf' && state === 'ready' && (
            <>
              <IconBtn onClick={pdfZoomOut} disabled={pdfZoom <= 0.5} title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </IconBtn>
              <span className="text-xs text-gray-400 px-1 tabular-nums w-10 text-center">
                {Math.round(pdfZoom * 100)}%
              </span>
              <IconBtn onClick={pdfZoomIn} disabled={pdfZoom >= 3} title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </IconBtn>
            </>
          )}

          <IconBtn onClick={handleDownload} title="Download">
            <Download className="w-4 h-4" />
          </IconBtn>
          <IconBtn onClick={onClose} title="Close">
            <X className="w-4 h-4" />
          </IconBtn>
        </div>
      </div>

      {/* ---------- Content area ---------- */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-6">
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
            <p className="text-sm">Loading file…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-3 text-gray-400 max-w-sm text-center">
            <AlertCircle className="w-10 h-10 text-error-400" />
            <p className="text-sm font-medium text-gray-200">Unable to load file</p>
            <p className="text-xs text-gray-500">{errorMsg}</p>
            <button onClick={handleDownload} className="btn-secondary mt-2">
              <Download className="w-4 h-4" />
              Download instead
            </button>
          </div>
        )}

        {state === 'ready' && kind === 'image' && (
          <div
            className="relative w-full h-full flex items-center justify-center overflow-hidden"
            onWheel={onImageWheel}
          >
            <img
              src={signedUrl}
              alt={file.name}
              draggable={false}
              onMouseDown={onImageMouseDown}
              className="max-w-full max-h-full object-contain select-none transition-transform duration-150"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
              }}
            />
          </div>
        )}

        {state === 'ready' && kind === 'pdf' && (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 overflow-auto rounded-lg border border-surface-400/40 bg-surface-100">
              <iframe
                ref={iframeRef}
                title={file.name}
                src={signedUrl}
                className="w-full h-full bg-surface-0"
                style={{
                  width: `${pdfZoom * 100}%`,
                  height: `${pdfZoom * 100}%`,
                  transformOrigin: 'top left',
                }}
              />
            </div>
          </div>
        )}

        {state === 'ready' && kind === 'video' && (
          <div className="w-full max-w-4xl flex flex-col gap-3">
            <video
              ref={videoRef}
              src={signedUrl}
              controls
              className="w-full rounded-lg bg-black max-h-[70vh]"
            />
            <div className="flex justify-end">
              <button onClick={videoFullscreen} className="btn-secondary">
                <Maximize2 className="w-4 h-4" />
                Fullscreen
              </button>
            </div>
          </div>
        )}

        {state === 'ready' && kind === 'audio' && (
          <div className="w-full max-w-xl flex flex-col items-center gap-6">
            <div className="w-32 h-32 rounded-2xl bg-surface-200 border border-surface-400/40 flex items-center justify-center">
              <FileText className="w-12 h-12 text-gray-500" />
            </div>
            <div className="w-full">
              <p className="text-sm text-gray-200 text-center mb-3 truncate">{file.name}</p>
              <audio src={signedUrl} controls className="w-full" />
            </div>
          </div>
        )}

        {state === 'ready' && kind === 'text' && (
          <div className="w-full max-w-4xl h-full flex flex-col">
            {isMd ? (
              <div
                className="tiptap-editor w-full overflow-auto rounded-xl border border-surface-400/40 bg-surface-100 p-6 shadow-card"
                dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(textContent) }}
              />
            ) : isJsonContent ? (
              <pre className="w-full overflow-auto rounded-xl border border-surface-400/40 bg-surface-100 p-5 shadow-card text-sm leading-relaxed">
                <code className="font-mono text-gray-300">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(textContent), null, 2);
                    } catch {
                      return textContent;
                    }
                  })()}
                </code>
              </pre>
            ) : (
              <pre className="w-full overflow-auto rounded-xl border border-surface-400/40 bg-surface-100 p-5 shadow-card text-sm leading-relaxed">
                <code className="font-mono text-gray-300 whitespace-pre-wrap break-words">
                  {textContent}
                </code>
              </pre>
            )}
          </div>
        )}

        {state === 'ready' && kind === 'unknown' && (
          <div className="card w-full max-w-md">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-xl bg-surface-200 border border-surface-400/40 flex items-center justify-center shrink-0">
                <File className="w-8 h-8 text-gray-500" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-white truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {file.mime_type ?? 'Unknown type'}
                </p>
              </div>
            </div>

            <dl className="space-y-2.5 text-sm">
              <MetaRow label="File name" value={file.name} />
              <MetaRow label="Size" value={formatFileSize(file.size_bytes)} />
              <MetaRow label="Type" value={file.mime_type ?? 'Unknown'} />
              <MetaRow label="Created" value={formatDate(file.created_at)} />
            </dl>

            <button onClick={handleDownload} className="btn-primary w-full mt-5">
              <Download className="w-4 h-4" />
              Download file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small internal subcomponents                                        */
/* ------------------------------------------------------------------ */

function IconBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-surface-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="text-gray-200 text-right truncate" title={value}>
        {value}
      </dd>
    </div>
  );
}

export default FileViewer;
