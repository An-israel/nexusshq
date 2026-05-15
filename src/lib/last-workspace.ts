// Persist the user's last selected workspace slug across sessions.
// Stored in localStorage so it survives refresh and works on mobile/desktop/web.

const KEY = "nexus:lastWorkspaceSlug";

export function getLastWorkspaceSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastWorkspaceSlug(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, slug);
  } catch {
    /* ignore quota / private mode errors */
  }
}

export function clearLastWorkspaceSlug(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
