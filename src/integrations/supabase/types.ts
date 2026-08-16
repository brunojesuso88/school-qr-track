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
          location: string
          mapping_class_id: string | null
          name: string
          photo_url: string | null
          series: string | null
          shift: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string
          mapping_class_id?: string | null
          name: string
          photo_url?: string | null
          series?: string | null
          shift?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string
          mapping_class_id?: string | null
          name?: string
          photo_url?: string | null
          series?: string | null
          shift?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_mapping_class_id_fkey"
            columns: ["mapping_class_id"]
            isOneToOne: false
            referencedRelation: "mapping_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_import_jobs: {
        Row: {
          class_id: string
          completed_chunks: number
          context: Json
          created_at: string
          created_by: string | null
          current_chunk: number | null
          error_message: string | null
          failed_chunks: number
          failed_pages: Json
          file_name: string | null
          id: string
          issues_json: Json
          partials: Json
          pdf_base64: string | null
          progress: number
          result_json: Json | null
          status: string
          total_chunks: number
          total_pages: number
          updated_at: string
        }
        Insert: {
          class_id: string
          completed_chunks?: number
          context?: Json
          created_at?: string
          created_by?: string | null
          current_chunk?: number | null
          error_message?: string | null
          failed_chunks?: number
          failed_pages?: Json
          file_name?: string | null
          id?: string
          issues_json?: Json
          partials?: Json
          pdf_base64?: string | null
          progress?: number
          result_json?: Json | null
          status?: string
          total_chunks?: number
          total_pages?: number
          updated_at?: string
        }
        Update: {
          class_id?: string
          completed_chunks?: number
          context?: Json
          created_at?: string
          created_by?: string | null
          current_chunk?: number | null
          error_message?: string | null
          failed_chunks?: number
          failed_pages?: Json
          file_name?: string | null
          id?: string
          issues_json?: Json
          partials?: Json
          pdf_base64?: string | null
          progress?: number
          result_json?: Json | null
          status?: string
          total_chunks?: number
          total_pages?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_import_jobs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_import_session_pages: {
        Row: {
          confirmation_mode: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          error: string | null
          id: string
          page_number: number
          preview_json: Json | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          confirmation_mode?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          error?: string | null
          id?: string
          page_number: number
          preview_json?: Json | null
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          confirmation_mode?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          error?: string | null
          id?: string
          page_number?: number
          preview_json?: Json | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_import_session_pages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grade_import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_import_sessions: {
        Row: {
          auto_accept: boolean
          class_id: string
          confirmed_pages: number
          context: Json
          created_at: string
          created_by: string | null
          current_page: number
          current_preview: Json | null
          file_name: string | null
          id: string
          ignored_pages: number
          notes_imported: number
          pdf_base64: string | null
          status: string
          total_pages: number
          updated_at: string
        }
        Insert: {
          auto_accept?: boolean
          class_id: string
          confirmed_pages?: number
          context?: Json
          created_at?: string
          created_by?: string | null
          current_page?: number
          current_preview?: Json | null
          file_name?: string | null
          id?: string
          ignored_pages?: number
          notes_imported?: number
          pdf_base64?: string | null
          status?: string
          total_pages?: number
          updated_at?: string
        }
        Update: {
          auto_accept?: boolean
          class_id?: string
          confirmed_pages?: number
          context?: Json
          created_at?: string
          created_by?: string | null
          current_page?: number
          current_preview?: Json | null
          file_name?: string | null
          id?: string
          ignored_pages?: number
          notes_imported?: number
          pdf_base64?: string | null
          status?: string
          total_pages?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_import_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_imports: {
        Row: {
          class_id: string
          conflict_strategy: string
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          issues: Json
          school_year: number
          stats: Json
          status: string
          updated_at: string
        }
        Insert: {
          class_id: string
          conflict_strategy?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          issues?: Json
          school_year?: number
          stats?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          conflict_strategy?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          issues?: Json
          school_year?: number
          stats?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_imports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_periods: {
        Row: {
          class_id: string
          created_at: string
          id: string
          kind: string
          label: string
          normalized_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          kind?: string
          label: string
          normalized_label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          normalized_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_periods_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_subjects: {
        Row: {
          class_id: string
          created_at: string
          custom_ira_weight: number | null
          id: string
          include_in_ira: boolean
          mapping_class_subject_id: string | null
          name: string
          normalized_name: string
          sort_order: number
          updated_at: string
          weekly_classes: number | null
        }
        Insert: {
          class_id: string
          created_at?: string
          custom_ira_weight?: number | null
          id?: string
          include_in_ira?: boolean
          mapping_class_subject_id?: string | null
          name: string
          normalized_name: string
          sort_order?: number
          updated_at?: string
          weekly_classes?: number | null
        }
        Update: {
          class_id?: string
          created_at?: string
          custom_ira_weight?: number | null
          id?: string
          include_in_ira?: boolean
          mapping_class_subject_id?: string | null
          name?: string
          normalized_name?: string
          sort_order?: number
          updated_at?: string
          weekly_classes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_subjects_mapping_class_subject_id_fkey"
            columns: ["mapping_class_subject_id"]
            isOneToOne: false
            referencedRelation: "mapping_class_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      ira_settings: {
        Row: {
          class_id: string
          created_at: string
          id: string
          ira_period_id: string | null
          ira_period_ids: string[]
          scale_max: number
          updated_at: string
          updated_by: string | null
          use_final_grade: boolean
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          ira_period_id?: string | null
          ira_period_ids?: string[]
          scale_max?: number
          updated_at?: string
          updated_by?: string | null
          use_final_grade?: boolean
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          ira_period_id?: string | null
          ira_period_ids?: string[]
          scale_max?: number
          updated_at?: string
          updated_by?: string | null
          use_final_grade?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ira_settings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ira_settings_ira_period_id_fkey"
            columns: ["ira_period_id"]
            isOneToOne: false
            referencedRelation: "grade_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      management_signatures: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          role_label: string | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          role_label?: string | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          role_label?: string | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      mapping_class_subjects: {
        Row: {
          class_id: string | null
          created_at: string | null
          id: string
          sort_order: number | null
          subject_name: string
          teacher_id: string | null
          weekly_classes: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          sort_order?: number | null
          subject_name: string
          teacher_id?: string | null
          weekly_classes?: number
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          sort_order?: number | null
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
          abbreviation: string | null
          created_at: string | null
          default_weekly_classes: number
          id: string
          name: string
          shift: string
        }
        Insert: {
          abbreviation?: string | null
          created_at?: string | null
          default_weekly_classes?: number
          id?: string
          name: string
          shift?: string
        }
        Update: {
          abbreviation?: string | null
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
          abbreviation: string | null
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
          abbreviation?: string | null
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
          abbreviation?: string | null
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
      school_event_simple: {
        Row: {
          cover_image: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string | null
          id: string
          images: Json
          name: string
          updated_at: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          id?: string
          images?: Json
          name: string
          updated_at?: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          id?: string
          images?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_events: {
        Row: {
          acoes_estrategicas: Json
          avaliacao: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          cronograma: Json
          culminancia: string | null
          description: string | null
          enfoque: string | null
          event_date: string | null
          id: string
          images: Json
          is_continuous: boolean
          justificativa: string | null
          legacy_simple_id: string | null
          metas: string | null
          metodologia: string | null
          objetivo_geral: string | null
          objetivos_especificos: Json
          pdf_original: string | null
          pontos_atencao: string | null
          prazo_fim: string | null
          prazo_inicio: string | null
          procedimentos: Json
          recursos: Json
          responsaveis: Json
          resumo_ia: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          acoes_estrategicas?: Json
          avaliacao?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          cronograma?: Json
          culminancia?: string | null
          description?: string | null
          enfoque?: string | null
          event_date?: string | null
          id?: string
          images?: Json
          is_continuous?: boolean
          justificativa?: string | null
          legacy_simple_id?: string | null
          metas?: string | null
          metodologia?: string | null
          objetivo_geral?: string | null
          objetivos_especificos?: Json
          pdf_original?: string | null
          pontos_atencao?: string | null
          prazo_fim?: string | null
          prazo_inicio?: string | null
          procedimentos?: Json
          recursos?: Json
          responsaveis?: Json
          resumo_ia?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          acoes_estrategicas?: Json
          avaliacao?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          cronograma?: Json
          culminancia?: string | null
          description?: string | null
          enfoque?: string | null
          event_date?: string | null
          id?: string
          images?: Json
          is_continuous?: boolean
          justificativa?: string | null
          legacy_simple_id?: string | null
          metas?: string | null
          metodologia?: string | null
          objetivo_geral?: string | null
          objetivos_especificos?: Json
          pdf_original?: string | null
          pontos_atencao?: string | null
          prazo_fim?: string | null
          prazo_inicio?: string | null
          procedimentos?: Json
          recursos?: Json
          responsaveis?: Json
          resumo_ia?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
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
      student_grades: {
        Row: {
          confidence: number | null
          created_at: string
          flags: string[]
          grade_period_id: string
          grade_subject_id: string
          id: string
          import_id: string | null
          raw_text: string | null
          source: string
          student_id: string
          updated_at: string
          value: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          flags?: string[]
          grade_period_id: string
          grade_subject_id: string
          id?: string
          import_id?: string | null
          raw_text?: string | null
          source?: string
          student_id: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          flags?: string[]
          grade_period_id?: string
          grade_subject_id?: string
          id?: string
          import_id?: string | null
          raw_text?: string | null
          source?: string
          student_id?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_grades_grade_period_id_fkey"
            columns: ["grade_period_id"]
            isOneToOne: false
            referencedRelation: "grade_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_grade_subject_id_fkey"
            columns: ["grade_subject_id"]
            isOneToOne: false
            referencedRelation: "grade_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "grade_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_paee: {
        Row: {
          aee_teacher_signature: string | null
          age: number | null
          birth_date_snapshot: string | null
          class_snapshot: string | null
          composition: string | null
          coordinator_signature: string | null
          created_at: string
          created_by: string | null
          disability_type: string | null
          elaboration_date: string | null
          id: string
          libras_interpreter: boolean
          pedagogical_matrix: Json
          periodicity: string | null
          schedule_time: string | null
          school: string | null
          shift_snapshot: string | null
          student_id: string
          support_assistant: boolean
          updated_at: string
          weekdays: string[]
        }
        Insert: {
          aee_teacher_signature?: string | null
          age?: number | null
          birth_date_snapshot?: string | null
          class_snapshot?: string | null
          composition?: string | null
          coordinator_signature?: string | null
          created_at?: string
          created_by?: string | null
          disability_type?: string | null
          elaboration_date?: string | null
          id?: string
          libras_interpreter?: boolean
          pedagogical_matrix?: Json
          periodicity?: string | null
          schedule_time?: string | null
          school?: string | null
          shift_snapshot?: string | null
          student_id: string
          support_assistant?: boolean
          updated_at?: string
          weekdays?: string[]
        }
        Update: {
          aee_teacher_signature?: string | null
          age?: number | null
          birth_date_snapshot?: string | null
          class_snapshot?: string | null
          composition?: string | null
          coordinator_signature?: string | null
          created_at?: string
          created_by?: string | null
          disability_type?: string | null
          elaboration_date?: string | null
          id?: string
          libras_interpreter?: boolean
          pedagogical_matrix?: Json
          periodicity?: string | null
          schedule_time?: string | null
          school?: string | null
          shift_snapshot?: string | null
          student_id?: string
          support_assistant?: boolean
          updated_at?: string
          weekdays?: string[]
        }
        Relationships: []
      }
      student_pei: {
        Row: {
          aee_teacher: string | null
          birth_date_snapshot: string | null
          contact: string | null
          coordination: string | null
          created_at: string
          created_by: string | null
          discipline_adaptations: Json
          elaboration_date: string | null
          email: string | null
          enrollment_number: string | null
          evaluation_criteria: string | null
          functional_profile: string | null
          id: string
          intervention_plan: Json
          learning_barriers: string | null
          legal_guardian: string | null
          performance_levels: Json
          phone: string | null
          potentialities: string | null
          shift_snapshot: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          aee_teacher?: string | null
          birth_date_snapshot?: string | null
          contact?: string | null
          coordination?: string | null
          created_at?: string
          created_by?: string | null
          discipline_adaptations?: Json
          elaboration_date?: string | null
          email?: string | null
          enrollment_number?: string | null
          evaluation_criteria?: string | null
          functional_profile?: string | null
          id?: string
          intervention_plan?: Json
          learning_barriers?: string | null
          legal_guardian?: string | null
          performance_levels?: Json
          phone?: string | null
          potentialities?: string | null
          shift_snapshot?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          aee_teacher?: string | null
          birth_date_snapshot?: string | null
          contact?: string | null
          coordination?: string | null
          created_at?: string
          created_by?: string | null
          discipline_adaptations?: Json
          elaboration_date?: string | null
          email?: string | null
          enrollment_number?: string | null
          evaluation_criteria?: string | null
          functional_profile?: string | null
          id?: string
          intervention_plan?: Json
          learning_barriers?: string | null
          legal_guardian?: string | null
          performance_levels?: Json
          phone?: string | null
          potentialities?: string | null
          shift_snapshot?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_pei_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
          father_name: string | null
          full_name: string
          guardian_name: string | null
          guardian_phone: string | null
          has_medical_report: boolean
          id: string
          medical_report_details: string | null
          mother_name: string | null
          photo_url: string | null
          qr_code: string | null
          school_code: string | null
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
          father_name?: string | null
          full_name: string
          guardian_name?: string | null
          guardian_phone?: string | null
          has_medical_report?: boolean
          id?: string
          medical_report_details?: string | null
          mother_name?: string | null
          photo_url?: string | null
          qr_code?: string | null
          school_code?: string | null
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
          father_name?: string | null
          full_name?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          has_medical_report?: boolean
          id?: string
          medical_report_details?: string | null
          mother_name?: string | null
          photo_url?: string | null
          qr_code?: string | null
          school_code?: string | null
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
      teacher_notifications: {
        Row: {
          classes_subjects: string | null
          created_at: string
          created_by: string | null
          custom_body: string | null
          doc_number: number
          doc_year: number
          id: string
          management_guidance: string | null
          new_deadline: string
          obligations: string[]
          original_deadline: string
          other_obligation: string | null
          reason: string
          stage: string
          teacher_justification: string | null
          teacher_name: string
          updated_at: string
        }
        Insert: {
          classes_subjects?: string | null
          created_at?: string
          created_by?: string | null
          custom_body?: string | null
          doc_number: number
          doc_year: number
          id?: string
          management_guidance?: string | null
          new_deadline: string
          obligations?: string[]
          original_deadline: string
          other_obligation?: string | null
          reason: string
          stage: string
          teacher_justification?: string | null
          teacher_name: string
          updated_at?: string
        }
        Update: {
          classes_subjects?: string | null
          created_at?: string
          created_by?: string | null
          custom_body?: string | null
          doc_number?: number
          doc_year?: number
          id?: string
          management_guidance?: string | null
          new_deadline?: string
          obligations?: string[]
          original_deadline?: string
          other_obligation?: string | null
          reason?: string
          stage?: string
          teacher_justification?: string | null
          teacher_name?: string
          updated_at?: string
        }
        Relationships: []
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
      get_student_basic_by_qr: {
        Args: { _qr_code: string }
        Returns: {
          class: string
          full_name: string
          id: string
          photo_url: string
          shift: string
          status: string
          student_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_teacher_notification_number: {
        Args: { _year: number }
        Returns: number
      }
      update_student_photo: {
        Args: { _photo_url: string; _student_id: string }
        Returns: undefined
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
