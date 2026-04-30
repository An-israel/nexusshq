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
      attendance: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          id: string
          status: Database["public"]["Enums"]["attendance_status"]
          total_minutes: number | null
          user_id: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date: string
          id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          total_minutes?: number | null
          user_id: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          total_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "kpis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_task_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_task_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_task_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
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
        }
        Relationships: []
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
        }
        Relationships: []
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
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      review_rating:
        | "exceeds"
        | "meets"
        | "needs_improvement"
        | "unsatisfactory"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "completed" | "overdue"
      task_type: "daily" | "weekly" | "one_time"
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
    },
  },
} as const
