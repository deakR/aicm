export function stripHtml(html) {
  return (
    html
      ?.replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || ''
  );
}

export function groupArticles(items) {
  return items.reduce((acc, article) => {
    const collection = article.collection || 'General';
    const section = article.section || 'General';

    if (!acc[collection]) {
      acc[collection] = {};
    }
    if (!acc[collection][section]) {
      acc[collection][section] = [];
    }

    acc[collection][section].push(article);
    return acc;
  }, {});
}
