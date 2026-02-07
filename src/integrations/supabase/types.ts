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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string | null
          date: string
          id: string
          recorded_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          time: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          time?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          shift: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          shift?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          shift?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mapping_class_subjects: {
        Row: {
          class_id: string | null
          created_at: string | null
          id: string
          subject_name: string
          teacher_id: string | null
          weekly_classes: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          subject_name: string
          teacher_id?: string | null
          weekly_classes?: number
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          subject_name?: string
          teacher_id?: string | null
          weekly_classes?: number
        }
        Relationships: [
          {
            foreignKeyName: "mapping_class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "mapping_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_class_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "mapping_teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      mapping_classes: {
        Row: {
          created_at: string | null
          id: string
          name: string
          shift: string
          student_count: number | null
          updated_at: string | null
          weekly_hours: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          shift?: string
          student_count?: number | null
          updated_at?: string | null
          weekly_hours?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          shift?: string
          student_count?: number | null
          updated_at?: string | null
          weekly_hours?: number
        }
        Relationships: []
      }
      mapping_global_subjects: {
        Row: {
          created_at: string | null
          default_weekly_classes: number
          id: string
          name: string
          shift: string
        }
        Insert: {
          created_at?: string | null
          default_weekly_classes?: number
          id?: string
          name: string
          shift?: string
        }
        Update: {
          created_at?: string | null
          default_weekly_classes?: number
          id?: string
          name?: string
          shift?: string
        }
        Relationships: []
      }
      mapping_teachers: {
        Row: {
          availability: string[] | null
          color: string
          created_at: string | null
          current_hours: number
          email: string | null
          id: string
          max_weekly_hours: number
          name: string
          notes: string | null
          phone: string | null
          subjects: string[] | null
          updated_at: string | null
        }
        Insert: {
          availability?: string[] | null
          color: string
          created_at?: string | null
          current_hours?: number
          email?: string | null
          id?: string
          max_weekly_hours?: number
          name: string
          notes?: string | null
          phone?: string | null
          subjects?: string[] | null
          updated_at?: string | null
        }
        Update: {
          availability?: string[] | null
          color?: string
          created_at?: string | null
          current_hours?: number
          email?: string | null
          id?: string
          max_weekly_hours?: number
          name?: string
          notes?: string | null
          phone?: string | null
          subjects?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          created_at: string | null
          date: string
          guardian_phone: string | null
          id: string
          message: string | null
          message_status: string | null
          student_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          guardian_phone?: string | null
          id?: string
          message?: string | null
          message_status?: string | null
          student_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          guardian_phone?: string | null
          id?: string
          message?: string | null
          message_status?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrences: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          end_date: string | null
          id: string
          student_id: string
          teacher_name: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          end_date?: string | null
          id?: string
          student_id: string
          teacher_name?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          end_date?: string | null
          id?: string
          student_id?: string
          teacher_name?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      students: {
        Row: {
          aee_adaptation_suggestions: string | null
          aee_adapted_activities: boolean | null
          aee_cid_code: string | null
          aee_cid_description: string | null
          aee_laudo_attachment_url: string | null
          aee_literacy_status: string | null
          aee_medication_name: string | null
          aee_uses_medication: boolean | null
          birth_date: string | null
          class: string
          created_at: string | null
          created_by: string | null
          full_name: string
          guardian_name: string
          guardian_phone: string
          has_medical_report: boolean
          id: string
          medical_report_details: string | null
          photo_url: string | null
          qr_code: string | null
          shift: Database["public"]["Enums"]["student_shift"]
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          aee_adaptation_suggestions?: string | null
          aee_adapted_activities?: boolean | null
          aee_cid_code?: string | null
          aee_cid_description?: string | null
          aee_laudo_attachment_url?: string | null
          aee_literacy_status?: string | null
          aee_medication_name?: string | null
          aee_uses_medication?: boolean | null
          birth_date?: string | null
          class: string
          created_at?: string | null
          created_by?: string | null
          full_name: string
          guardian_name: string
          guardian_phone: string
          has_medical_report?: boolean
          id?: string
          medical_report_details?: string | null
          photo_url?: string | null
          qr_code?: string | null
          shift?: Database["public"]["Enums"]["student_shift"]
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          aee_adaptation_suggestions?: string | null
          aee_adapted_activities?: boolean | null
          aee_cid_code?: string | null
          aee_cid_description?: string | null
          aee_laudo_attachment_url?: string | null
          aee_literacy_status?: string | null
          aee_medication_name?: string | null
          aee_uses_medication?: boolean | null
          birth_date?: string | null
          class?: string
          created_at?: string | null
          created_by?: string | null
          full_name?: string
          guardian_name?: string
          guardian_phone?: string
          has_medical_report?: boolean
          id?: string
          medical_report_details?: string | null
          photo_url?: string | null
          qr_code?: string | null
          shift?: Database["public"]["Enums"]["student_shift"]
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      teacher_availability: {
        Row: {
          available: boolean
          created_at: string
          day_of_week: number
          id: string
          period_number: number
          teacher_id: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          day_of_week: number
          id?: string
          period_number: number
          teacher_id: string
        }
        Update: {
          available?: boolean
          created_at?: string
          day_of_week?: number
          id?: string
          period_number?: number
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "mapping_teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_entries: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          id: string
          is_locked: boolean
          period_number: number
          subject_name: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          id?: string
          is_locked?: boolean
          period_number: number
          subject_name: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_locked?: boolean
          period_number?: number
          subject_name?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "mapping_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "mapping_teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_generation_history: {
        Row: {
          conflicts_count: number | null
          created_at: string
          explanation: string | null
          generated_at: string
          generated_by: string | null
          id: string
          quality_score: number | null
          snapshot: Json | null
          status: string
        }
        Insert: {
          conflicts_count?: number | null
          created_at?: string
          explanation?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          quality_score?: number | null
          snapshot?: Json | null
          status?: string
        }
        Update: {
          conflicts_count?: number | null
          created_at?: string
          explanation?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          quality_score?: number | null
          snapshot?: Json | null
          status?: string
        }
        Relationships: []
      }
      timetable_rules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          parameters: Json | null
          priority: number
          rule_name: string
          rule_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          parameters?: Json | null
          priority?: number
          rule_name: string
          rule_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          parameters?: Json | null
          priority?: number
          rule_name?: string
          rule_type?: string
        }
        Relationships: []
      }
      timetable_settings: {
        Row: {
          break_after_period: number[] | null
          break_duration_minutes: number
          created_at: string
          days_per_week: number
          id: string
          period_duration_minutes: number
          periods_per_day: number
          school_year: string
          updated_at: string
        }
        Insert: {
          break_after_period?: number[] | null
          break_duration_minutes?: number
          created_at?: string
          days_per_week?: number
          id?: string
          period_duration_minutes?: number
          periods_per_day?: number
          school_year?: string
          updated_at?: string
        }
        Update: {
          break_after_period?: number[] | null
          break_duration_minutes?: number
          created_at?: string
          days_per_week?: number
          id?: string
          period_duration_minutes?: number
          periods_per_day?: number
          school_year?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "staff" | "user" | "direction"
      attendance_status: "present" | "absent" | "justified"
      student_shift: "morning" | "afternoon" | "evening"
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
      app_role: ["admin", "teacher", "staff", "user", "direction"],
      attendance_status: ["present", "absent", "justified"],
      student_shift: ["morning", "afternoon", "evening"],
    },
  },
} as const
