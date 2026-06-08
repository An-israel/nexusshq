import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * Records a "who did what" entry in the workspace's audit log via the
 * log_audit_event RPC (validates the caller is an active workspace member).
 * Best-effort: failures are logged, never thrown — auditing must never block
 * the action it's recording.
 */
export async function logAuditEvent({
  workspaceId,
  action,
  targetType,
  targetId,
  metadata,
}: {
  workspaceId: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, Json>;
}): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_audit_event", {
      _workspace_id: workspaceId,
      _action: action,
      _target_type: targetType ?? undefined,
      _target_id: targetId ?? undefined,
      _metadata: metadata ?? {},
    });
    if (error) throw error;
  } catch (err) {
    console.error("logAuditEvent failed", err);
  }
}
