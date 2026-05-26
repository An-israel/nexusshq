/**
 * Maps a notification to the URL the user should be taken to when they click it.
 * Returns null for notification types that have no specific destination.
 */
export function getNotificationUrl(
  n: {
    type: string;
    related_task_id?: string | null;
    related_channel_id?: string | null;
    related_conversation_id?: string | null;
  },
  workspaceSlug: string,
): string | null {
  const base = `/${workspaceSlug}`;
  switch (n.type) {
    case "task_assigned":
    case "task_due_soon":
    case "task_overdue":
      return n.related_task_id ? `${base}/tasks/${n.related_task_id}` : `${base}/tasks`;

    case "mention":
    case "group_message":
      return n.related_channel_id
        ? `${base}/messages/channel/${n.related_channel_id}`
        : `${base}/messages`;

    case "direct_message":
      return n.related_conversation_id
        ? `${base}/messages/dm/${n.related_conversation_id}`
        : `${base}/messages`;

    case "clock_reminder":
      return `${base}/attendance`;

    case "kpi_reminder":
      return `${base}/kpis`;

    case "warning":
    case "flag":
      return `${base}/dashboard`;

    case "info":
      return n.related_channel_id
        ? `${base}/messages/channel/${n.related_channel_id}`
        : n.related_conversation_id
          ? `${base}/messages/dm/${n.related_conversation_id}`
          : null;

    default:
      return null;
  }
}
