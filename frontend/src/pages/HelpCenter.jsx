import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Widget from "../components/Widget";
import ThemeToggle from "../components/ThemeToggle";
import { buildBrandPalette } from "../branding";
import { useThemePreference } from "../theme";
import useBranding from "../context/useBranding";
import { groupArticles, stripHtml } from "../utils/contentHelpers";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8900";

export default function HelpCenter() {
  const [articles, setArticles] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCollection, setActiveCollection] = useState("All");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isArticleLoading, setIsArticleLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);
  const { branding } = useBranding();
  const { resolvedTheme } = useThemePreference();
  const palette = buildBrandPalette(branding.accent_color);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await fetch(`${API_URL}/api/articles`);
        if (res.ok) {
          setArticles(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch articles", err);
      }
    };

    fetchArticles();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const collectionOptions = [
    "All",
    ...new Set(articles.map((article) => article.collection || "General")),
  ];

  const filteredArticles = articles.filter((article) => {
    const matchesCollection =
      activeCollection === "All" ||
      (article.collection || "General") === activeCollection;
    if (!matchesCollection) return false;

    const term = search.trim().toLowerCase();
    if (!term) return true;

    const haystack = [
      article.title,
      article.collection,
      article.section,
      stripHtml(article.content),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });

  const groupedArticles = groupArticles(filteredArticles);

  const suggestions =
    search.trim().length >= 1
      ? articles
          .filter((article) =>
            article.title.toLowerCase().includes(search.trim().toLowerCase()),
          )
          .slice(0, 6)
      : [];

  const sectionCount = new Set(
    articles.map(
      (article) =>
        `${article.collection || "General"}::${article.section || "General"}`,
    ),
  ).size;

  const openArticle = async (articleId) => {
    setIsArticleLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/articles/${articleId}`);
      if (res.ok) {
        const fullArticle = await res.json();
        setSelectedArticle(fullArticle);
        setArticles((prev) =>
          prev.map((article) =>
            article.id === fullArticle.id ? fullArticle : article,
          ),
        );
      }
    } catch (err) {
      console.error("Failed to fetch article details", err);
    } finally {
      setIsArticleLoading(false);
    }
  };

  return (
    <div className="app-shell min-h-screen font-sans">
      <div className="px-6 py-6 md:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p
              className="text-xs font-semibold uppercase tracking-[0.3em]"
              style={{ color: isDark ? palette.accentSoft : palette.accentDark }}
            >
              {branding.brand_name}
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--app-text-muted)" }}>
              Public help articles, clear answers, and secure customer support.
            </p>
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
            <Link to="/" className="app-secondary-button">
              Home
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-7xl">
          <div className="app-panel-card rounded-[2rem] px-6 py-8 md:px-8 md:py-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_22rem] lg:items-end">
              <div>
                <p className="app-section-kicker">Help Center</p>
                <h1
                  className="mt-4 text-4xl font-bold tracking-tight md:text-5xl"
                  style={{ color: "var(--app-text)" }}
                >
                  Find answers without digging through clutter.
                </h1>
                <p
                  className="mt-5 max-w-3xl text-base leading-8"
                  style={{ color: "var(--app-text-muted)" }}
                >
                  Search help articles by topic, browse collections, or open the support widget when you want guided help. Everything here is written for customers first.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="app-soft-card rounded-[1.4rem] px-4 py-4">
                  <p className="app-section-kicker">Articles</p>
                  <p
                    className="mt-3 text-3xl font-bold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {articles.length}
                  </p>
                  <p
                    className="mt-2 text-sm leading-6"
                    style={{ color: "var(--app-text-muted)" }}
                  >
                    Public answers across account, billing, and order support.
                  </p>
                </div>
                <div className="app-soft-card rounded-[1.4rem] px-4 py-4">
                  <p className="app-section-kicker">Coverage</p>
                  <p
                    className="mt-3 text-3xl font-bold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {collectionOptions.length - 1} / {sectionCount}
                  </p>
                  <p
                    className="mt-2 text-sm leading-6"
                    style={{ color: "var(--app-text-muted)" }}
                  >
                    Collections and sections organized for self-serve browsing.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mt-8 max-w-3xl" ref={searchRef}>
              <input
                type="text"
                placeholder="Search by topic, article title, or question"
                className="app-field-control w-full rounded-[1.4rem] px-5 py-4 pr-12 shadow-none"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setShowSuggestions(false);
                }}
                autoComplete="off"
              />

              {showSuggestions && suggestions.length > 0 && (
                <div className="app-dialog-panel absolute left-0 right-0 top-full z-50 mt-3 overflow-hidden rounded-[1.4rem]">
                  {suggestions.map((article, index) => (
                    <button
                      key={article.id}
                      type="button"
                      className="flex w-full items-start gap-3 px-5 py-4 text-left transition"
                      style={{
                        borderBottom:
                          index === suggestions.length - 1
                            ? "none"
                            : "1px solid var(--app-border)",
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setShowSuggestions(false);
                        setSearch("");
                        openArticle(article.id);
                      }}
                    >
                      <span
                        className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                        style={{
                          background:
                            "color-mix(in srgb, var(--brand-accent-soft) 72%, var(--app-card))",
                          color: palette.accentDark,
                        }}
                      >
                        ?
                      </span>
                      <div>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--app-text)" }}
                        >
                          {article.title}
                        </p>
                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--app-text-soft)" }}
                        >
                          {article.collection || "General"} →{" "}
                          {article.section || "General"}
                        </p>
                      </div>
                    </button>
                  ))}
                  <div
                    className="px-5 py-3 text-xs"
                    style={{ color: "var(--app-text-soft)" }}
                  >
                    Keep typing to narrow results, or open any suggested article directly.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12 md:px-8 lg:px-10 lg:py-14">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--app-text)" }}
            >
              Knowledge Base
            </h2>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--app-text-muted)" }}
            >
              Published articles that also power the {branding.assistant_name} support assistant.
            </p>
          </div>
          <div className="app-chip app-chip-accent">
            {filteredArticles.length} matching article
            {filteredArticles.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mb-10 flex flex-wrap gap-3">
          {collectionOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setActiveCollection(option)}
              className={`knowledge-filter-pill ${
                activeCollection === option ? "active" : ""
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {filteredArticles.length === 0 ? (
          <div className="app-empty-state px-8 py-16 text-center">
            No articles found matching your search.
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(groupedArticles).map(([collectionName, sections]) => (
              <section key={collectionName} className="space-y-5">
                <div
                  className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <div className="min-w-0">
                    <p
                      className="text-xs font-semibold uppercase tracking-[0.24em]"
                      style={{ color: palette.accentDark }}
                    >
                      Collection
                    </p>
                    <h3
                      className="mt-2 break-words text-2xl font-bold"
                      style={{ color: "var(--app-text)" }}
                    >
                      {collectionName}
                    </h3>
                  </div>
                  <p className="text-sm" style={{ color: "var(--app-text-soft)" }}>
                    {Object.values(sections).flat().length} article
                    {Object.values(sections).flat().length === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="space-y-8">
                  {Object.entries(sections).map(([sectionName, sectionArticles]) => (
                    <div key={`${collectionName}-${sectionName}`} className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className="max-w-full break-words rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                          style={{
                            backgroundColor:
                              "color-mix(in srgb, var(--brand-accent-soft) 70%, var(--app-card))",
                            color: palette.accentDark,
                          }}
                        >
                          {sectionName}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "var(--app-text-soft)" }}
                        >
                          {sectionArticles.length} article
                          {sectionArticles.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        {sectionArticles.map((article) => (
                          <button
                            key={article.id}
                            type="button"
                            onClick={() => openArticle(article.id)}
                            className="help-article-card text-left"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="help-article-meta">
                                  {article.section || "General"}
                                </p>
                                <h4 className="help-article-title">
                                  {article.title}
                                </h4>
                              </div>
                              <span className="help-article-views">
                                {article.view_count ?? 0} views
                              </span>
                            </div>
                            <p className="help-article-summary">
                              {stripHtml(article.content)}
                            </p>
                            <div className="help-article-footer">
                              <span className="help-article-link">
                                Read article
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {selectedArticle && (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/50 px-4 py-8"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="app-dialog-panel mx-auto max-w-3xl rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-dialog-header p-6">
              <div>
                <h3
                  className="text-2xl font-bold"
                  style={{ color: "var(--app-text)" }}
                >
                  {selectedArticle.title}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--brand-accent-soft) 70%, var(--app-card))",
                      color: palette.accentDark,
                    }}
                  >
                    {selectedArticle.collection || "General"}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{
                      background: "var(--app-card-muted)",
                      color: "var(--app-text-muted)",
                    }}
                  >
                    {selectedArticle.section || "General"}
                  </span>
                </div>
                <p
                  className="mt-2 text-sm"
                  style={{ color: "var(--app-text-muted)" }}
                >
                  Published{" "}
                  {new Date(selectedArticle.created_at).toLocaleDateString()} |{" "}
                  {selectedArticle.view_count ?? 0} views
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="app-secondary-button px-3 py-2"
                aria-label="Close article"
              >
                ×
              </button>
            </div>
            <div
              className="p-6 prose prose-sm max-w-none"
              style={{ color: "var(--app-text)" }}
            >
              {isArticleLoading ? (
                "Loading article..."
              ) : (
                <div
                  dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <Widget />
    </div>
  );
}
