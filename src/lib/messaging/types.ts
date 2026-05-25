export interface MsgProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  department: string | null;
  job_title: string | null;
}

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  type: "public" | "private" | "announcement";
  created_by: string | null;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  workspace_id: string;
  role: "admin" | "member";
  last_read_at: string;
  is_muted: boolean;
  joined_at: string;
}

export interface ChannelWithMeta extends Channel {
  unread_count: number;
  mention_count: number;
  member_count: number;
  is_member: boolean;
}

export interface DmConversation {
  id: string;
  workspace_id: string;
  type: "direct" | "group";
  name: string | null;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
}

export interface DmMember {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  is_muted: boolean;
  profile?: MsgProfile;
}

export interface DmConversationWithMeta extends DmConversation {
  unread_count: number;
  members: DmMember[];
}

export interface Message {
  id: string;
  workspace_id: string;
  channel_id: string | null;
  conversation_id: string | null;
  sender_id: string;
  body: string;
  body_html: string | null;
  parent_message_id: string | null;
  thread_reply_count: number;
  thread_last_reply_at: string | null;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  pinned: boolean;
  pinned_by: string | null;
  has_attachment: boolean;
  created_at: string;
  sender?: MsgProfile;
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
  voice_note?: VoiceNote;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  google_drive_file_id: string | null;
  google_drive_view_url: string | null;
  storage_path: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface VoiceNote {
  id: string;
  workspace_id: string;
  message_id: string;
  sender_id: string | null;
  storage_path: string;
  public_url: string;
  duration_seconds: number | null;
  waveform_data: number[] | null;
  transcription: string | null;
  transcription_status: "pending" | "processing" | "completed" | "failed";
  file_size_bytes: number | null;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profile?: MsgProfile;
}

export interface UserPresence {
  user_id: string;
  workspace_id: string;
  status: "active" | "away" | "dnd" | "offline";
  status_emoji: string | null;
  status_text: string | null;
  last_seen_at: string;
}

export type ActiveView =
  | { type: "channel"; channelId: string }
  | { type: "dm"; conversationId: string }
  | { type: "activity" }
  | null;
