import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildBrandPalette, normalizeHexColor } from '../branding';
import ResizablePanels from '../components/ResizablePanels';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8900';

const emptySettings = {
  name: '',
  greeting: '',
  tone: 'friendly',
  brand_name: 'AICM Support',
  accent_color: '#2563EB',
};

export default function AISettings() {
  const [settings, setSettings] = useState(emptySettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const palette = buildBrandPalette(settings.accent_color);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:7200';
  const embedUrl = `${origin}/embed/widget`;
  const accentColor = normalizeHexColor(settings.accent_color);
  const embedTitle = settings.brand_name || 'AICM Support';
  const iframeSnippet = `<iframe src="${embedUrl}" title="${embedTitle}" loading="lazy" style="width:380px;height:680px;border:0;border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,0.18);background:#ffffff;"></iframe>`;
  const launcherSnippet = `<script>
(function () {
  var iframe = document.createElement('iframe');
  iframe.src = '${embedUrl}';
  iframe.title = ${JSON.stringify(embedTitle)};
  iframe.loading = 'lazy';
  iframe.style.cssText = 'position:fixed;bottom:96px;right:24px;width:min(380px,calc(100vw - 24px));height:min(680px,calc(100vh - 120px));border:0;border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,0.22);background:#ffffff;z-index:999998;display:none;';

  var button = document.createElement('button');
  button.type = 'button';
  button.ariaLabel = ${JSON.stringify(`${embedTitle} launcher`)};
  button.textContent = 'Support';
  button.style.cssText = 'position:fixed;bottom:24px;right:24px;height:56px;min-width:56px;padding:0 18px;border:0;border-radius:9999px;background:${accentColor};color:#ffffff;font:600 14px system-ui,sans-serif;box-shadow:0 18px 40px rgba(15,23,42,0.24);cursor:pointer;z-index:999999;';

  var open = false;
  button.addEventListener('click', function () {
    open = !open;
    iframe.style.display = open ? 'block' : 'none';
    button.textContent = open ? 'Close' : 'Support';
  });

  document.body.appendChild(iframe);
  document.body.appendChild(button);
})();
</script>`;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/api/protected/settings/ai`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setSettings(await res.json());
          setNotice('');
        } else if (res.status === 401) {
          localStorage.removeItem('token');
          navigate('/workspace/login');
        } else if (res.status === 403) {
          setNotice('Only admins can manage AI settings.');
        } else {
          setNotice('Failed to load AI settings.');
        }
      } catch (err) {
        console.error('Failed to fetch AI settings', err);
        setNotice('Failed to load AI settings.');
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchSettings();
    }
  }, [navigate, token]);

  const handleSave = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice('');

    try {
      const res = await fetch(`${API_URL}/api/protected/settings/ai`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setNotice('Settings saved. New AI replies and the public widget branding now use the updated configuration.');
      } else {
        const text = await res.text();
        setNotice(text || 'Failed to save AI settings.');
      }
    } catch (err) {
      console.error('Failed to save AI settings', err);
      setNotice('Failed to save AI settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySnippet = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSnippet(label);
      setTimeout(() => {
        setCopiedSnippet((current) => (current === label ? '' : current));
      }, 1800);
    } catch (error) {
      console.error('Failed to copy snippet', error);
      setNotice('Could not copy the embed snippet. You can still copy it manually.');
    }
  };

  return (
    <div className="app-page-shell">
      <div className="app-page-header px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">AI Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure the visible AI assistant persona plus the public widget brand name and accent color.
        </p>
      </div>

      <ResizablePanels
        storageKey="aicm:settings-panels"
        initialSizes={[68, 32]}
        minSizes={[560, 300]}
        className="mx-auto max-w-6xl gap-0 px-6 py-6"
        stackBelow={1180}
      >
        <form onSubmit={handleSave} className="app-panel-card p-6">
          {notice && (
            <div className="app-accent-card mb-5 px-4 py-3 text-sm">
              {notice}
            </div>
          )}

          {isLoading ? (
            <div className="py-12 text-center text-gray-500">Loading AI settings...</div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Assistant name</label>
                <input
                  type="text"
                  required
                  className="app-input w-full rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                  value={settings.name}
                  onChange={(event) => setSettings((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">First reply greeting</label>
                <textarea
                  required
                  rows="3"
                  className="app-input w-full resize-none rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                  value={settings.greeting}
                  onChange={(event) => setSettings((prev) => ({ ...prev, greeting: event.target.value }))}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Tone</label>
                <select
                  className="app-input w-full rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                  value={settings.tone}
                  onChange={(event) => setSettings((prev) => ({ ...prev, tone: event.target.value }))}
                >
                  <option value="friendly">Friendly</option>
                  <option value="balanced">Balanced</option>
                  <option value="formal">Formal</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Widget brand name</label>
                <input
                  type="text"
                  required
                  className="app-input w-full rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                  value={settings.brand_name}
                  onChange={(event) => setSettings((prev) => ({ ...prev, brand_name: event.target.value }))}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Accent color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="app-input h-12 w-16 cursor-pointer rounded-2xl bg-white p-1"
                    value={normalizeHexColor(settings.accent_color)}
                    onChange={(event) => setSettings((prev) => ({ ...prev, accent_color: event.target.value.toUpperCase() }))}
                  />
                  <input
                    type="text"
                    required
                    pattern="^#[0-9A-Fa-f]{6}$"
                    className="app-input flex-1 rounded-2xl px-4 py-3 font-mono text-sm uppercase outline-none focus:border-blue-500"
                    value={settings.accent_color}
                    onChange={(event) => setSettings((prev) => ({ ...prev, accent_color: event.target.value.toUpperCase() }))}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400">Use a full hex color like `#2563EB`.</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="app-primary-button rounded-2xl px-5 py-3 text-sm"
                >
                  {isSaving ? 'Saving...' : 'Save AI Settings'}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="space-y-6">
          <div className="app-panel-card p-6">
            <p className="app-section-kicker">Preview</p>
            <div
              className="mt-4 rounded-3xl p-5"
              style={{
                border: `1px solid ${palette.accentBorder}`,
                backgroundColor: palette.accentSoft,
              }}
            >
              <div className="mb-2 text-sm font-semibold" style={{ color: palette.accentDark }}>
                {settings.name || 'AI Agent'}
              </div>
              <p className="text-sm leading-6" style={{ color: palette.accentDark }}>
                {(settings.greeting || "Hi, I'm your AI support assistant.")} I can help with common support questions using the knowledge base.
              </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl shadow-sm" style={{ border: `1px solid ${palette.accentBorder}` }}>
              <div
                className="p-4 text-white"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${palette.accentDark}, ${palette.accent})`,
                }}
              >
                <div className="text-sm font-semibold">{settings.brand_name || 'AICM Support'}</div>
                <div className="mt-1 text-xs text-white/80">Realtime connected</div>
              </div>
              <div className="p-4" style={{ backgroundColor: palette.accentSurface }}>
                <div className="mb-3 inline-flex max-w-[85%] rounded-2xl rounded-tl-none px-3 py-2 text-sm text-white shadow-sm" style={{ backgroundColor: palette.accent }}>
                  I need help with my billing.
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tr-none border px-3 py-2 text-sm shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: palette.accentBorder, color: '#1e293b' }}>
                  {settings.name || 'AI Agent'} will reply using this brand styling in the public widget.
                </div>
              </div>
            </div>
          </div>

          <div className="app-panel-card p-6">
            <p className="app-section-kicker">How it works now</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
              <li>The configured name is used for AI-authored chat replies.</li>
              <li>The configured greeting is prepended to the first AI reply in a conversation.</li>
              <li>The selected tone is passed into the AI system prompt for future responses.</li>
              <li>The brand name and accent color apply to the public widget and help-facing pages.</li>
            </ul>
          </div>

          <div className="app-panel-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-section-kicker">Install widget</p>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Use the dedicated embed route to drop the support widget into another site.
                </p>
              </div>
              <a
                href={embedUrl}
                target="_blank"
                rel="noreferrer"
                className="app-secondary-button square px-4 py-2 text-sm"
              >
                Open embed preview
              </a>
            </div>

            <div className="app-soft-card mt-5 rounded-2xl p-4">
              <p className="app-section-kicker text-[11px]">Embed URL</p>
              <code className="app-code-block mt-2 block rounded-xl px-3 py-3 text-xs text-slate-700">
                {embedUrl}
              </code>
            </div>

            <div className="mt-5 space-y-4">
              <div className="app-table-shell rounded-2xl">
                <div className="app-table-header flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Recommended launcher snippet</p>
                    <p className="text-xs text-gray-500">Adds a floating support button and opens the widget in an iframe.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopySnippet('launcher', launcherSnippet)}
                    className="app-primary-button rounded-xl px-3 py-2 text-xs"
                  >
                    {copiedSnippet === 'launcher' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="app-code-block rounded-none border-0 px-4 py-4 text-xs leading-6 text-slate-100" style={{ backgroundColor: 'color-mix(in srgb, var(--app-card-muted) 65%, #020617)' }}>
                  <code>{launcherSnippet}</code>
                </pre>
              </div>

              <div className="app-table-shell rounded-2xl">
                <div className="app-table-header flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Simple iframe fallback</p>
                    <p className="text-xs text-gray-500">Useful when you want the support panel embedded directly into a page layout.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopySnippet('iframe', iframeSnippet)}
                    className="app-secondary-button square px-3 py-2 text-xs"
                  >
                    {copiedSnippet === 'iframe' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="app-code-block rounded-none border-0 px-4 py-4 text-xs leading-6 text-slate-700">
                  <code>{iframeSnippet}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </ResizablePanels>
    </div>
  );
}
