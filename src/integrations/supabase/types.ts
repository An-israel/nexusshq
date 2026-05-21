export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          department: Database["public"]["Enums"]["department_type"] | null
          id: string
          is_pinned: boolean
          title: string
          workspace_id: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"] | null
          id?: string
          is_pinned?: boolean
          title: string
          workspace_id?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"] | null
          id?: string
          is_pinned?: boolean
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          id: string
          overtime_minutes: number
          status: Database["public"]["Enums"]["attendance_status"]
          total_minutes: number | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date: string
          id?: string
          overtime_minutes?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          total_minutes?: number | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          id?: string
          overtime_minutes?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          total_minutes?: number | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      burnout_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          detected_at: string
          id: string
          reason: string
          risk_level: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          detected_at?: string
          id?: string
          reason: string
          risk_level: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          detected_at?: string
          id?: string
          reason?: string
          risk_level?: string
          user_id?: string
        }
        Relationships: []
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean
          is_default: boolean
          name: string
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_default?: boolean
          name: string
          type?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_default?: boolean
          name?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_views: {
        Row: {
          id: string
          project_id: string
          user_agent: string | null
          viewed_at: string
          workspace_id: string | null
        }
        Insert: {
          id?: string
          project_id: string
          user_agent?: string | null
          viewed_at?: string
          workspace_id?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          user_agent?: string | null
          viewed_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_project_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          order_index: number
          project_id: string
          status: string
          title: string
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          project_id: string
          status?: string
          title: string
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          project_id?: string
          status?: string
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_project_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_projects: {
        Row: {
          access_token: string
          client_name: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          access_token?: string
          client_name: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string
          workspace_id?: string | null
        }
        Update: {
          access_token?: string
          client_name?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_scores: {
        Row: {
          comment: string | null
          created_at: string
          creativity_score: number
          deliverable_id: string
          id: string
          quality_score: number
          reviewer_id: string
          timeliness_score: number
          workspace_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          creativity_score?: number
          deliverable_id: string
          id?: string
          quality_score?: number
          reviewer_id: string
          timeliness_score?: number
          workspace_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          creativity_score?: number
          deliverable_id?: string
          id?: string
          quality_score?: number
          reviewer_id?: string
          timeliness_score?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_scores_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_scores_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_size_bytes: number
          id: string
          mime_type: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: Database["public"]["Enums"]["deliverable_status"]
          storage_path: string
          task_id: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_size_bytes?: number
          id?: string
          mime_type?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["deliverable_status"]
          storage_path: string
          task_id?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["deliverable_status"]
          storage_path?: string
          task_id?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_url: string | null
          body: string
          created_at: string
          edited_at: string | null
          from_id: string
          id: string
          is_read: boolean
          to_id: string
          workspace_id: string | null
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          body: string
          created_at?: string
          edited_at?: string | null
          from_id: string
          id?: string
          is_read?: boolean
          to_id: string
          workspace_id?: string | null
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          from_id?: string
          id?: string
          is_read?: boolean
          to_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string
          name: string | null
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string
          name?: string | null
          type?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string
          name?: string | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_members: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          file_size_bytes: number | null
          file_url: string
          id: string
          mime_type: string | null
          requires_signature: boolean
          signature_text: string | null
          signed_at: string | null
          title: string
          uploaded_by: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          requires_signature?: boolean
          signature_text?: string | null
          signed_at?: string | null
          title: string
          uploaded_by?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          requires_signature?: boolean
          signature_text?: string | null
          signed_at?: string | null
          title?: string
          uploaded_by?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      flags: {
        Row: {
          created_at: string
          flagged_by: string | null
          flagged_user_id: string
          id: string
          is_resolved: boolean
          reason: string
          resolved_at: string | null
          severity: Database["public"]["Enums"]["flag_severity"]
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          flagged_by?: string | null
          flagged_user_id: string
          id?: string
          is_resolved?: boolean
          reason: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["flag_severity"]
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          flagged_by?: string | null
          flagged_user_id?: string
          id?: string
          is_resolved?: boolean
          reason?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["flag_severity"]
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flags_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_flagged_user_id_fkey"
            columns: ["flagged_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_url: string | null
          body: string
          created_at: string
          edited_at: string | null
          from_id: string
          group_id: string
          id: string
          workspace_id: string | null
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          body: string
          created_at?: string
          edited_at?: string | null
          from_id: string
          group_id: string
          id?: string
          workspace_id?: string | null
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          from_id?: string
          group_id?: string
          id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "message_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      key_result_updates: {
        Row: {
          created_at: string | null
          id: string
          key_result_id: string
          new_value: number
          note: string | null
          previous_value: number
          updated_by: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_result_id: string
          new_value: number
          note?: string | null
          previous_value: number
          updated_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key_result_id?: string
          new_value?: number
          note?: string | null
          previous_value?: number
          updated_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_result_updates_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_result_updates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      key_results: {
        Row: {
          created_at: string | null
          current_value: number
          description: string | null
          id: string
          objective_id: string
          owner_id: string | null
          target_value: number
          title: string
          unit: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_value?: number
          description?: string | null
          id?: string
          objective_id: string
          owner_id?: string | null
          target_value?: number
          title: string
          unit?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_value?: number
          description?: string | null
          id?: string
          objective_id?: string
          owner_id?: string | null
          target_value?: number
          title?: string
          unit?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          created_at: string
          created_by: string | null
          department: Database["public"]["Enums"]["department_type"]
          description: string | null
          id: string
          period: Database["public"]["Enums"]["kpi_period"]
          target_value: number
          title: string
          unit: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department: Database["public"]["Enums"]["department_type"]
          description?: string | null
          id?: string
          period?: Database["public"]["Enums"]["kpi_period"]
          target_value?: number
          title: string
          unit?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department_type"]
          description?: string | null
          id?: string
          period?: Database["public"]["Enums"]["kpi_period"]
          target_value?: number
          title?: string
          unit?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kudos: {
        Row: {
          created_at: string
          emoji: string
          from_user_id: string
          id: string
          message: string
          to_user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          from_user_id: string
          id?: string
          message: string
          to_user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          from_user_id?: string
          id?: string
          message?: string
          to_user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kudos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          created_at: string
          days_allocated: number
          days_used: number
          id: string
          leave_type_id: string
          user_id: string
          workspace_id: string | null
          year: number
        }
        Insert: {
          created_at?: string
          days_allocated?: number
          days_used?: number
          id?: string
          leave_type_id: string
          user_id: string
          workspace_id?: string | null
          year: number
        }
        Update: {
          created_at?: string
          days_allocated?: number
          days_used?: number
          id?: string
          leave_type_id?: string
          user_id?: string
          workspace_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          days_requested: number
          end_date: string
          id: string
          leave_type_id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          start_date: string
          status: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          days_requested?: number
          end_date: string
          id?: string
          leave_type_id: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          start_date: string
          status?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          days_requested?: number
          end_date?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          start_date?: string
          status?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          color: string
          created_at: string
          days_per_year: number
          id: string
          name: string
          requires_approval: boolean
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          days_per_year?: number
          id?: string
          name: string
          requires_approval?: boolean
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          days_per_year?: number
          id?: string
          name?: string
          requires_approval?: boolean
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size_bytes: number
          file_type: string
          google_drive_file_id: string | null
          google_drive_view_url: string | null
          id: string
          message_id: string
          storage_path: string | null
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size_bytes?: number
          file_type?: string
          google_drive_file_id?: string | null
          google_drive_view_url?: string | null
          id?: string
          message_id: string
          storage_path?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size_bytes?: number
          file_type?: string
          google_drive_file_id?: string | null
          google_drive_view_url?: string | null
          id?: string
          message_id?: string
          storage_path?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_group_members: {
        Row: {
          group_id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          group_id: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          group_id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "message_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_group_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          workspace_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          workspace_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          body_html: string | null
          channel_id: string | null
          conversation_id: string | null
          created_at: string
          edited_at: string | null
          has_attachment: boolean
          id: string
          is_deleted: boolean
          is_edited: boolean
          parent_message_id: string | null
          pinned: boolean
          pinned_by: string | null
          sender_id: string | null
          thread_last_reply_at: string | null
          thread_reply_count: number
          workspace_id: string
        }
        Insert: {
          body: string
          body_html?: string | null
          channel_id?: string | null
          conversation_id?: string | null
          created_at?: string
          edited_at?: string | null
          has_attachment?: boolean
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          parent_message_id?: string | null
          pinned?: boolean
          pinned_by?: string | null
          sender_id?: string | null
          thread_last_reply_at?: string | null
          thread_reply_count?: number
          workspace_id: string
        }
        Update: {
          body?: string
          body_html?: string | null
          channel_id?: string | null
          conversation_id?: string | null
          created_at?: string
          edited_at?: string | null
          has_attachment?: boolean
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          parent_message_id?: string | null
          pinned?: boolean
          pinned_by?: string | null
          sender_id?: string | null
          thread_last_reply_at?: string | null
          thread_reply_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          mentions_enabled: boolean
          pins_enabled: boolean
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentions_enabled?: boolean
          pins_enabled?: boolean
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentions_enabled?: boolean
          pins_enabled?: boolean
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          email_sent_at: string | null
          id: string
          is_read: boolean
          message: string
          related_task_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          email_sent_at?: string | null
          id?: string
          is_read?: boolean
          message: string
          related_task_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          email_sent_at?: string | null
          id?: string
          is_read?: boolean
          message?: string
          related_task_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string | null
          department: string | null
          description: string | null
          end_date: string | null
          id: string
          owner_id: string | null
          period: string
          progress_percent: number
          start_date: string | null
          status: string
          title: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          owner_id?: string | null
          period?: string
          progress_percent?: number
          start_date?: string | null
          status?: string
          title: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          owner_id?: string | null
          period?: string
          progress_percent?: number
          start_date?: string | null
          status?: string
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objectives_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          base_salary: number
          bonus: number
          created_at: string
          currency: string
          deductions: number
          id: string
          issued_at: string
          issued_by: string | null
          net_pay: number
          notes: string | null
          period_month: number
          period_year: number
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          base_salary?: number
          bonus?: number
          created_at?: string
          currency?: string
          deductions?: number
          id?: string
          issued_at?: string
          issued_by?: string | null
          net_pay?: number
          notes?: string | null
          period_month: number
          period_year: number
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          base_salary?: number
          bonus?: number
          created_at?: string
          currency?: string
          deductions?: number
          id?: string
          issued_at?: string
          issued_by?: string | null
          net_pay?: number
          notes?: string | null
          period_month?: number
          period_year?: number
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          acknowledged_at: string | null
          areas_to_improve: string | null
          attendance_score: number
          collaboration_score: number
          created_at: string
          employee_acknowledged: boolean
          id: string
          manager_notes: string | null
          overall_rating: Database["public"]["Enums"]["review_rating"]
          period_end: string
          period_start: string
          productivity_score: number
          quality_score: number
          reviewer_id: string | null
          strengths: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          areas_to_improve?: string | null
          attendance_score?: number
          collaboration_score?: number
          created_at?: string
          employee_acknowledged?: boolean
          id?: string
          manager_notes?: string | null
          overall_rating?: Database["public"]["Enums"]["review_rating"]
          period_end: string
          period_start: string
          productivity_score?: number
          quality_score?: number
          reviewer_id?: string | null
          strengths?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          areas_to_improve?: string | null
          attendance_score?: number
          collaboration_score?: number
          created_at?: string
          employee_acknowledged?: boolean
          id?: string
          manager_notes?: string | null
          overall_rating?: Database["public"]["Enums"]["review_rating"]
          period_end?: string
          period_start?: string
          productivity_score?: number
          quality_score?: number
          reviewer_id?: string | null
          strengths?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          base_salary: number | null
          created_at: string
          department: Database["public"]["Enums"]["department_type"] | null
          email: string | null
          full_name: string | null
          hire_date: string | null
          id: string
          is_active: boolean
          job_title: string | null
          phone: string | null
          reports_to: string | null
          whatsapp_opt_in: boolean
          workspace_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          base_salary?: number | null
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"] | null
          email?: string | null
          full_name?: string | null
          hire_date?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          reports_to?: string | null
          whatsapp_opt_in?: boolean
          workspace_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          base_salary?: number | null
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"] | null
          email?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          reports_to?: string | null
          whatsapp_opt_in?: boolean
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_tasks: {
        Row: {
          assigned_to: string
          created_at: string
          created_by: string | null
          day_of_week: number | null
          description: string | null
          id: string
          is_active: boolean
          kpi_id: string | null
          last_generated_date: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence: string
          title: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          kpi_id?: string | null
          last_generated_date?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: string
          title: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          kpi_id?: string | null
          last_generated_date?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: string
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      standup_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          standup_id: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          standup_id: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          standup_id?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standup_comments_standup_id_fkey"
            columns: ["standup_id"]
            isOneToOne: false
            referencedRelation: "standups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standup_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      standups: {
        Row: {
          blockers: string | null
          date: string
          id: string
          screenshot_url: string | null
          submitted_at: string
          today: string
          user_id: string
          workspace_id: string | null
          yesterday: string
        }
        Insert: {
          blockers?: string | null
          date: string
          id?: string
          screenshot_url?: string | null
          submitted_at?: string
          today: string
          user_id: string
          workspace_id?: string | null
          yesterday: string
        }
        Update: {
          blockers?: string | null
          date?: string
          id?: string
          screenshot_url?: string | null
          submitted_at?: string
          today?: string
          user_id?: string
          workspace_id?: string | null
          yesterday?: string
        }
        Relationships: [
          {
            foreignKeyName: "standups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: Database["public"]["Enums"]["workspace_plan"]
          status: string
          trial_ends_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan: Database["public"]["Enums"]["workspace_plan"]
          status?: string
          trial_ends_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["workspace_plan"]
          status?: string
          trial_ends_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_users: {
        Row: {
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_updates: {
        Row: {
          created_at: string
          id: string
          new_progress: number | null
          new_status: Database["public"]["Enums"]["task_status"] | null
          note: string | null
          old_progress: number | null
          old_status: Database["public"]["Enums"]["task_status"] | null
          task_id: string
          updated_by: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_progress?: number | null
          new_status?: Database["public"]["Enums"]["task_status"] | null
          note?: string | null
          old_progress?: number | null
          old_status?: Database["public"]["Enums"]["task_status"] | null
          task_id: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_progress?: number | null
          new_status?: Database["public"]["Enums"]["task_status"] | null
          note?: string | null
          old_progress?: number | null
          old_status?: Database["public"]["Enums"]["task_status"] | null
          task_id?: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          has_warning: boolean
          id: string
          kpi_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          progress_percent: number
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          warning_message: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          has_warning?: boolean
          id?: string
          kpi_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress_percent?: number
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title: string
          warning_message?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          has_warning?: boolean
          id?: string
          kpi_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress_percent?: number
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          warning_message?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          last_seen_at: string
          status: string
          status_emoji: string | null
          status_text: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          last_seen_at?: string
          status?: string
          status_emoji?: string | null
          status_text?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          last_seen_at?: string
          status?: string
          status_emoji?: string | null
          status_text?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_presence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_pages: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          section_id: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          section_id?: string | null
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          section_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wiki_pages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_pages_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "wiki_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_pages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_sections: {
        Row: {
          created_at: string
          id: string
          order_index: number
          title: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          title: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wiki_sections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          created_at: string
          department: Database["public"]["Enums"]["department_type"]
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          job_title: string | null
          passcode: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          used_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"]
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by?: string | null
          job_title?: string | null
          passcode: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"]
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          job_title?: string | null
          passcode?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_member_role"]
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_member_role"]
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_member_role"]
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["workspace_member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["workspace_member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["workspace_member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          clock_in_radius_m: number
          created_at: string
          enforce_gps_clockin: boolean
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          office_lat: number | null
          office_lng: number | null
          plan: Database["public"]["Enums"]["workspace_plan"]
          plan_seats: number | null
          primary_color: string
          slug: string
          trial_ends_at: string | null
        }
        Insert: {
          clock_in_radius_m?: number
          created_at?: string
          enforce_gps_clockin?: boolean
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          office_lat?: number | null
          office_lng?: number | null
          plan?: Database["public"]["Enums"]["workspace_plan"]
          plan_seats?: number | null
          primary_color?: string
          slug: string
          trial_ends_at?: string | null
        }
        Update: {
          clock_in_radius_m?: number
          created_at?: string
          enforce_gps_clockin?: boolean
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          office_lat?: number | null
          office_lng?: number | null
          plan?: Database["public"]["Enums"]["workspace_plan"]
          plan_seats?: number | null
          primary_color?: string
          slug?: string
          trial_ends_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_dm_members: {
        Args: {
          _actor_user_id: string
          _conversation_id: string
          _target_user_id: string
        }
        Returns: boolean
      }
      create_workspace_with_owner: {
        Args: { _name: string; _slug: string }
        Returns: {
          id: string
          slug: string
        }[]
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_skryve_seed: { Args: never; Returns: string }
      get_my_workspace_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      init_leave_balances: {
        Args: { p_user_id: string; p_year: number }
        Returns: undefined
      }
      is_dm_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_workspace_invite: {
        Args: { _token: string }
        Returns: {
          slug: string
          workspace_id: string
        }[]
      }
      remove_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      super_admin_create_workspace: {
        Args: {
          _name: string
          _owner_email?: string
          _plan: Database["public"]["Enums"]["workspace_plan"]
          _slug: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      attendance_status: "present" | "late" | "absent" | "half_day"
      deliverable_status:
        | "submitted"
        | "approved"
        | "rejected"
        | "revision_requested"
      department_type:
        | "management"
        | "customer_success"
        | "growth"
        | "marketing"
        | "design"
        | "video_editing"
        | "operations"
        | "other"
      flag_severity: "low" | "medium" | "high"
      kpi_period: "weekly" | "monthly"
      notification_type:
        | "task_assigned"
        | "task_due_soon"
        | "task_overdue"
        | "warning"
        | "flag"
        | "kpi_reminder"
        | "clock_reminder"
        | "direct_message"
        | "group_message"
        | "mention"
        | "info"
      review_rating:
        | "exceeds"
        | "meets"
        | "needs_improvement"
        | "unsatisfactory"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "completed" | "overdue"
      task_type: "daily" | "weekly" | "one_time"
      workspace_member_role: "owner" | "admin" | "manager" | "employee"
      workspace_plan: "starter" | "growth" | "business" | "enterprise"
      workspace_role: "owner" | "admin" | "manager" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "employee"],
      attendance_status: ["present", "late", "absent", "half_day"],
      deliverable_status: [
        "submitted",
        "approved",
        "rejected",
        "revision_requested",
      ],
      department_type: [
        "management",
        "customer_success",
        "growth",
        "marketing",
        "design",
        "video_editing",
        "operations",
        "other",
      ],
      flag_severity: ["low", "medium", "high"],
      kpi_period: ["weekly", "monthly"],
      notification_type: [
        "task_assigned",
        "task_due_soon",
        "task_overdue",
        "warning",
        "flag",
        "kpi_reminder",
        "clock_reminder",
        "direct_message",
        "group_message",
        "mention",
        "info",
      ],
      review_rating: [
        "exceeds",
        "meets",
        "needs_improvement",
        "unsatisfactory",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "completed", "overdue"],
      task_type: ["daily", "weekly", "one_time"],
      workspace_member_role: ["owner", "admin", "manager", "employee"],
      workspace_plan: ["starter", "growth", "business", "enterprise"],
      workspace_role: ["owner", "admin", "manager", "employee"],
    },
  },
} as const
