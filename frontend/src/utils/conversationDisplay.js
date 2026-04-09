const sourceLabelsBySurface = {
  default: {
    email: 'Email',
    web: 'Web chat',
  },
  support: {
    email: 'Email simulation',
    web: 'Web widget',
  },
};

export function getSourceLabel(source, surface = 'default') {
  const normalizedSource = source === 'email' ? 'email' : 'web';
  const labels = sourceLabelsBySurface[surface] || sourceLabelsBySurface.default;
  return labels[normalizedSource] || sourceLabelsBySurface.default[normalizedSource];
}

export function getSourceBadgeClasses(source) {
  return source === 'email'
    ? 'app-status-pill app-source-pill-email'
    : 'app-status-pill app-source-pill-web';
}

export function getStatusClasses(status) {
  switch (status) {
    case 'open':
      return 'app-status-pill-open';
    case 'pending':
      return 'app-status-pill-pending';
    case 'resolved':
    case 'closed':
      return 'app-status-pill-resolved';
    default:
      return 'app-status-pill-default';
  }
}

export function getSenderLabel(message, customerId) {
  if (message.sender_id === customerId || message.sender_role === 'customer') {
    return message.sender_name || 'You';
  }
  if (message.is_ai_generated) {
    return message.sender_name || 'AI assistant';
  }
  return message.sender_name || 'Support Team';
}
