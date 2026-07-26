// Tipos minimos para el cliente Supabase (no generados automaticamente).
// Suficiente para tipar las tablas principales del CRM.

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          role: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string;
          last_name?: string;
          email: string;
          role?: string;
          active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      loans: {
        Row: {
          id: string;
          loan_number: string;
          first_name: string;
          last_name: string;
          dni: string;
          phone: string;
          email: string;
          province: string;
          amount: number;
          installments: number;
          status: string;
          assigned_user: string | null;
          scheduled_call_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          loan_number?: string;
          first_name?: string;
          last_name?: string;
          dni?: string;
          phone?: string;
          email?: string;
          province?: string;
          amount?: number;
          installments?: number;
          status?: string;
          assigned_user?: string | null;
          scheduled_call_at?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['loans']['Insert']>;
      };
      calls: {
        Row: {
          id: string;
          loan_id: string;
          operator_id: string | null;
          started_at: string;
          ended_at: string | null;
          duration: number;
          result: string;
          notes: string;
          created_at: string;
          provider: string;
          provider_call_id: string | null;
          status: string;
          destination: string | null;
          extension: string | null;
          answered_at: string | null;
          recording_url: string | null;
          provider_payload: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          loan_id: string;
          operator_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          duration?: number;
          result?: string;
          notes?: string;
          created_at?: string;
          provider?: string;
          provider_call_id?: string | null;
          status?: string;
          destination?: string | null;
          extension?: string | null;
          answered_at?: string | null;
          recording_url?: string | null;
          provider_payload?: Record<string, unknown> | null;
        };
        Update: Partial<Database['public']['Tables']['calls']['Insert']>;
      };
      call_logs: {
        Row: {
          id: string;
          loan_id: string;
          event_type: string;
          description: string;
          previous_status: string | null;
          new_status: string | null;
          operator_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
          provider_event_id: string | null;
        };
        Insert: {
          id?: string;
          loan_id: string;
          event_type: string;
          description?: string;
          previous_status?: string | null;
          new_status?: string | null;
          operator_id?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
          provider_event_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['call_logs']['Insert']>;
      };
    };
    Functions: {
      is_first_user: { Args: Record<string, never>; Returns: boolean };
    };
  };
}
