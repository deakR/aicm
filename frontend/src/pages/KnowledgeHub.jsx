import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ResizablePanels from '../components/ResizablePanels';
import { groupArticles, stripHtml } from '../utils/contentHelpers';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8900';

const TOOLBAR_ITEMS = [
  { title: 'Bold', icon: <strong>B</strong>, cmd: 'bold' },
  { title: 'Italic', icon: <em>I</em>, cmd: 'italic' },
  { title: 'Underline', icon: <u>U</u>, cmd: 'underline' },
  { title: 'Strike', icon: <s>S</s>, cmd: 'strikeThrough' },
  null,
  { title: 'H2', icon: 'H2', cmd: 'formatBlock', val: 'h2' },
  { title: 'H3', icon: 'H3', cmd: 'formatBlock', val: 'h3' },
  { title: 'Normal', icon: 'P', cmd: 'formatBlock', val: 'p' },
  null,
  { title: 'Bullet list', icon: 'UL', cmd: 'insertUnorderedList' },
  { title: 'Ordered list', icon: '1.', cmd: 'insertOrderedList' },
  null,
  { title: 'Quote', icon: '"', cmd: 'formatBlock', val: 'blockquote' },
  { title: 'Code', icon: '<>', cmd: 'formatBlock', val: 'pre' },
  null,
  { title: 'Link', icon: 'LK', action: 'insertLink' },
  { title: 'Remove link', icon: 'ULK', cmd: 'unlink' },
  null,
  { title: 'Undo', icon: '<-', cmd: 'undo' },
  { title: 'Redo', icon: '->', cmd: 'redo' },
];

// Minimal WYSIWYG toolbar button
function ToolbarBtn({ title, icon, onMouseDown, active }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onMouseDown(); }}
      className={`knowledge-editor-button ${active ? 'active' : ''}`}
    >
      {icon}
    </button>
  );
}

// The rich text editor component
function RichEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const lastHtml = useRef(value);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
      lastHtml.current = value;
    }
  }, [value]);

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || '';
    if (html !== lastHtml.current) {
      lastHtml.current = html;
      onChange(html);
    }
  };

  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    handleInput();
  };

  const insertHTML = (html) => {
    exec('insertHTML', html);
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) exec('createLink', url);
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:');
    if (!url?.trim()) return;

    const alt = prompt('Optional image description:') || 'Article image';
    insertHTML(`<figure><img src="${url.trim()}" alt="${alt.replace(/"/g, '&quot;')}" /></figure><p><br></p>`);
  };

  const toEmbedURL = (url) => {
    const trimmed = url.trim();
    if (!trimmed) return '';

    const youtubeMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/i);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    if (trimmed.includes('/embed/')) {
      return trimmed;
    }

    return '';
  };

  const insertVideo = () => {
    const url = prompt('Enter YouTube, Vimeo, or direct embed URL:');
    if (!url?.trim()) return;

    const embedURL = toEmbedURL(url);
    if (!embedURL) {
      alert('Please use a YouTube, Vimeo, or direct embed URL.');
      return;
    }

    insertHTML(`<div class="aicm-embed"><iframe src="${embedURL}" title="Embedded video" loading="lazy" allowfullscreen></iframe></div><p><br></p>`);
  };

  return (
    <div className="knowledge-editor-shell flex flex-1 min-h-0 flex-col focus-within:border-transparent focus-within:ring-2 focus-within:ring-blue-500">
      {/* Toolbar */}
      <div className="knowledge-editor-toolbar">
        {TOOLBAR_ITEMS.map((item, i) =>
          item === null ? (
            <div key={i} className="knowledge-editor-divider" />
          ) : (
            <ToolbarBtn
              key={item.title}
              title={item.title}
              icon={item.icon}
              onMouseDown={
                item.action === 'insertLink'
                  ? insertLink
                  : () => exec(item.cmd, item.val || null)
              }
            />
          )
        )}
        <div className="knowledge-editor-divider" />
        <ToolbarBtn title="Image" icon="IMG" onMouseDown={insertImage} />
        <ToolbarBtn title="Video" icon="VID" onMouseDown={insertVideo} />
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        className="knowledge-editor-body prose prose-sm"
        style={{
          '--tw-prose-headings': 'var(--app-text)',
          '--tw-prose-body': 'var(--app-text-muted)',
        }}
      />
    </div>
  );
}

export default function KnowledgeHub() {
  const [articles, setArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [title, setTitle] = useState('');
  const [collection, setCollection] = useState('General');
  const [section, setSection] = useState('General');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('published');
  const [search, setSearch] = useState('');
  const [activeCollection, setActiveCollection] = useState('All');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await fetch(`${API_URL}/api/protected/articles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setArticles(data);
          if (data.length > 0) setSelectedArticle(data[0]);
        } else if (res.status === 401) {
          localStorage.removeItem('token');
          navigate('/workspace/login');
        }
      } catch (err) {
        console.error('Failed to fetch articles', err);
      }
    };
    fetchArticles();
  }, [token, navigate]);

  const collectionOptions = ['All', ...new Set(articles.map((article) => article.collection || 'General'))];
  const filteredArticles = articles.filter((article) => {
    const matchesCollection = activeCollection === 'All' || (article.collection || 'General') === activeCollection;
    if (!matchesCollection) return false;

    const term = search.trim().toLowerCase();
    if (!term) return true;

    const haystack = [
      article.title,
      article.collection,
      article.section,
      stripHtml(article.content),
    ].join(' ').toLowerCase();

    return haystack.includes(term);
  });
  const groupedArticles = groupArticles(filteredArticles);

  const handleCreateOrUpdateArticle = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Title and content are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEditing = !!editingArticleId;
      const url = `${API_URL}/api/protected/articles${isEditing ? `/${editingArticleId}` : ''}`;
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, collection, section, content, status }),
      });

      if (res.ok) {
        const savedArticle = await res.json();
        if (isEditing) {
          setArticles((prev) => prev.map((a) => (a.id === savedArticle.id ? savedArticle : a)));
        } else {
          setArticles((prev) => [savedArticle, ...prev]);
        }
        setSelectedArticle(savedArticle);
        setIsDrafting(false);
        setTitle('');
        setCollection('General');
        setSection('General');
        setContent('');
        setStatus('published');
        setEditingArticleId(null);
      }
    } catch (err) {
      console.error('Failed to save article', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteArticle = async () => {
    if (!selectedArticle || !window.confirm('Delete this article?')) return;
    const res = await fetch(`${API_URL}/api/protected/articles/${selectedArticle.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setArticles((prev) => prev.filter((a) => a.id !== selectedArticle.id));
      setSelectedArticle(null);
    }
  };

  const fetchArticleDetails = async (articleId) => {
    const existing = articles.find((a) => a.id === articleId);
    if (existing) setSelectedArticle(existing);
    const res = await fetch(`${API_URL}/api/protected/articles/${articleId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const full = await res.json();
      setSelectedArticle(full);
      setArticles((prev) => prev.map((a) => (a.id === full.id ? full : a)));
    }
  };

  const startEdit = () => {
    setTitle(selectedArticle.title);
    setCollection(selectedArticle.collection || 'General');
    setSection(selectedArticle.section || 'General');
    setContent(selectedArticle.content);
    setStatus(selectedArticle.status || 'published');
    setEditingArticleId(selectedArticle.id);
    setIsDrafting(true);
  };

  return (
    <div className="app-main-surface h-full w-full overflow-hidden">
      <ResizablePanels
        storageKey="aicm:knowledge-panels"
        initialSizes={[26, 74]}
        minSizes={[280, 560]}
        className="h-full w-full"
        stackBelow={1120}
      >
        {/* Left: Article list */}
        <div className="flex h-full min-h-0 min-w-0 flex-col border-r app-surface-divider">
          <div className="app-page-header p-5">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Knowledge Hub</h2>
          </div>

          <div className="p-4">
            <button
              onClick={() => {
                setTitle(''); setCollection('General'); setSection('General'); setContent(''); setStatus('published');
                setEditingArticleId(null); setIsDrafting(true); setSelectedArticle(null);
              }}
              className="app-primary-button w-full py-2"
            >
              + New Article
            </button>
          </div>

          <div className="space-y-3 p-4">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search articles, collections, or sections"
              className="app-input w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-wrap gap-2">
              {collectionOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setActiveCollection(option)}
                  className={`knowledge-filter-pill ${activeCollection === option ? 'active' : ''}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredArticles.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">No articles yet.</div>
            ) : (
              Object.entries(groupedArticles).map(([collectionName, sections]) => (
                <div key={collectionName}>
                  <div className="knowledge-collection-header sticky top-0 z-[1] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] backdrop-blur">
                    {collectionName}
                  </div>
                  {Object.entries(sections).map(([sectionName, sectionArticles]) => (
                    <div key={`${collectionName}-${sectionName}`}>
                      <div className="knowledge-section-header app-section-kicker text-[11px]">
                        {sectionName}
                      </div>
                      {sectionArticles.map((article) => (
                        <button
                          key={article.id}
                          type="button"
                          onClick={() => { fetchArticleDetails(article.id); setIsDrafting(false); }}
                          className={`w-full p-4 text-left transition ${selectedArticle?.id === article.id ? 'inbox-thread-card active' : 'inbox-thread-card'}`}
                        >
                          <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">{article.title}</h3>
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{stripHtml(article.content)}</p>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="app-chip app-chip-accent px-2 py-0.5 text-[11px]">
                              {article.collection || 'General'}
                            </span>
                            <span className="app-chip px-2 py-0.5 text-[11px]">
                              {article.section || 'General'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`app-status-pill text-xs px-2 py-0.5 rounded-full font-medium tracking-wide uppercase ${article.status === 'published' ? 'app-status-pill-open' : article.status === 'draft' ? 'app-status-pill-pending' : 'app-status-pill-default'}`}>
                              {article.status}
                            </span>
                            <span className="text-xs text-gray-400">{new Date(article.created_at).toLocaleDateString()}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Editor or viewer */}
        <div className="flex h-full min-h-0 min-w-0 flex-col app-main-surface">
          {isDrafting ? (
            <div className="p-8 max-w-3xl mx-auto w-full flex-1 flex flex-col overflow-y-auto min-h-0">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{editingArticleId ? 'Edit Article' : 'New Article'}</h2>
                <button onClick={() => setIsDrafting(false)} className="app-link-action">
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdateArticle} className="flex flex-col flex-1 space-y-4 min-h-0">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Article Title</label>
                    <input
                      type="text" required
                      placeholder="e.g., How to reset your password"
                      className="app-input w-full rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={title} onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Billing"
                      className="app-input w-full rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={collection}
                      onChange={(e) => setCollection(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Refunds"
                      className="app-input w-full rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      className="app-input w-full rounded-lg bg-white p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                      value={status} onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col flex-1 min-h-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <p className="text-xs text-gray-400 mb-2">
                    The AI Agent uses this content to answer customer questions. You can also embed image URLs and YouTube or Vimeo videos from the editor toolbar.
                  </p>
                  <RichEditor value={content} onChange={setContent} />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit" disabled={isSubmitting}
                    className="app-primary-button px-6 py-2"
                  >
                    {isSubmitting ? 'Saving...' : editingArticleId ? 'Save Changes' : 'Publish Article'}
                  </button>
                </div>
              </form>
            </div>

          ) : selectedArticle ? (
            <div className="p-8 max-w-4xl mx-auto w-full flex-1 overflow-y-auto">
              <div className="mb-6 flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedArticle.title}</h2>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="app-chip app-chip-accent px-3 py-1 text-xs uppercase tracking-[0.18em]">
                      {selectedArticle.collection || 'General'}
                    </span>
                    <span className="app-chip px-3 py-1 text-xs uppercase tracking-[0.18em]">
                      {selectedArticle.section || 'General'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className={`app-status-pill px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${selectedArticle.status === 'published' ? 'app-status-pill-open' : selectedArticle.status === 'draft' ? 'app-status-pill-pending' : 'app-status-pill-default'}`}>
                      {selectedArticle.status}
                    </span>
                    <span>Created {new Date(selectedArticle.created_at).toLocaleString()}</span>
                    <span>Views: {selectedArticle.view_count ?? 0}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-none">
                  <button onClick={startEdit} className="app-secondary-button square px-3 py-1.5 text-sm">
                    Edit
                  </button>
                  <button onClick={handleDeleteArticle} className="app-danger-button px-3 py-1.5 text-sm">
                    Delete
                  </button>
                </div>
              </div>

              {/* Render HTML content safely */}
              <div
                className="app-panel-card rounded-xl p-6 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
              />
            </div>

          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-gray-500">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 6v6h6" />
              </svg>
              <div className="app-empty-state px-8 py-6 text-center">
                <p className="text-lg">Select an article or draft a new one.</p>
                <p className="mt-2 text-sm text-gray-400">Articles published here will power your AI Agent.</p>
              </div>
            </div>
          )}
        </div>
      </ResizablePanels>
    </div>
  );
}
