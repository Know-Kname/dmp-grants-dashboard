/**
 * Supabase schema types.
 *
 * GENERATED FILE — do not hand-edit. Regenerate with either:
 *
 *   supabase gen types typescript --linked > src/types/database.ts
 *
 * or, without Docker or a CLI login, the Supabase MCP `generate_typescript_types`
 * tool against project `mgpwjnxtqcnoyjgebytg`.
 *
 * These types describe the *wire* format: snake_case rows exactly as Postgres
 * stores them. The hand-written camelCase interfaces in `./index.ts` remain the
 * domain model the UI speaks, and `toCamelCaseKeys` / `toSnakeCaseKeys` are the
 * boundary between the two. Both are needed — this file keeps the schema honest,
 * `index.ts` keeps the components readable.
 *
 * Last generated: 2026-07-29 (16 tables, post grants.created_by migration).
 */

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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string | null
          due_date: string
          id: string
          invoice_number: string
          status: string
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string | null
          due_date: string
          id?: string
          invoice_number: string
          status: string
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          status?: string
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string | null
          customer_id: string
          due_date: string
          id: string
          invoice_number: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string | null
          customer_id: string
          due_date: string
          id?: string
          invoice_number: string
          status: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string | null
          customer_id?: string
          due_date?: string
          id?: string
          invoice_number?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      burials: {
        Row: {
          burial_date: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          date_of_birth: string | null
          date_of_death: string | null
          deceased_first_name: string
          deceased_last_name: string
          deceased_middle_name: string | null
          grave: string
          grave_id: string | null
          id: string
          lot: string
          memorial_published: boolean
          notes: string | null
          permit_number: string | null
          plot_location: string
          section: string
          updated_at: string | null
        }
        Insert: {
          burial_date: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          date_of_death?: string | null
          deceased_first_name: string
          deceased_last_name: string
          deceased_middle_name?: string | null
          grave: string
          grave_id?: string | null
          id?: string
          lot: string
          memorial_published?: boolean
          notes?: string | null
          permit_number?: string | null
          plot_location: string
          section: string
          updated_at?: string | null
        }
        Update: {
          burial_date?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          date_of_death?: string | null
          deceased_first_name?: string
          deceased_last_name?: string
          deceased_middle_name?: string | null
          grave?: string
          grave_id?: string | null
          id?: string
          lot?: string
          memorial_published?: boolean
          notes?: string | null
          permit_number?: string | null
          plot_location?: string
          section?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "burials_grave_id_fkey"
            columns: ["grave_id"]
            isOneToOne: false
            referencedRelation: "graves"
            referencedColumns: ["id"]
          },
        ]
      }
      cemeteries: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      contract_items: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string | null
          description: string
          id: string
          inventory_id: string | null
          quantity: number
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          inventory_id?: string | null
          quantity?: number
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          inventory_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount_paid: number
          contract_number: string
          created_at: string | null
          customer_id: string
          id: string
          payment_plan: Json | null
          signed_date: string
          status: string
          total_amount: number
          type: string
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number
          contract_number: string
          created_at?: string | null
          customer_id: string
          id?: string
          payment_plan?: Json | null
          signed_date: string
          status: string
          total_amount: number
          type: string
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number
          contract_number?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          payment_plan?: Json | null
          signed_date?: string
          status?: string
          total_amount?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          date: string
          id: string
          method: string
          notes: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          date: string
          id?: string
          method: string
          notes?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          method?: string
          notes?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      grants: {
        Row: {
          amount: number | null
          application_date: string | null
          created_at: string | null
          created_by: string | null
          deadline: string | null
          description: string | null
          id: string
          notes: string | null
          source: string
          status: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          application_date?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          source: string
          status: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          application_date?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          source?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      graves: {
        Row: {
          created_at: string | null
          grave_number: string
          id: string
          lat: number | null
          lng: number | null
          lot_id: string
          notes: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          grave_number: string
          id?: string
          lat?: number | null
          lng?: number | null
          lot_id: string
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          grave_number?: string
          id?: string
          lat?: number | null
          lng?: number | null
          lot_id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "graves_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          category: string
          created_at: string | null
          id: string
          location: string | null
          name: string
          quantity: number
          reorder_point: number
          sku: string | null
          unit_price: number
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          location?: string | null
          name: string
          quantity?: number
          reorder_point?: number
          sku?: string | null
          unit_price?: number
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string
          quantity?: number
          reorder_point?: number
          sku?: string | null
          unit_price?: number
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          lot_number: string
          section_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          lot_number: string
          section_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          lot_number?: string
          section_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedule: {
        Row: {
          amount: number
          contract_id: string
          created_at: string | null
          due_date: string
          id: string
          notes: string | null
          paid_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string | null
          due_date: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedule_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          capacity: number | null
          cemetery_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          cemetery_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          cemetery_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_cemetery_id_fkey"
            columns: ["cemetery_id"]
            isOneToOne: false
            referencedRelation: "cemeteries"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          assigned_to: string | null
          completed_date: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority: string
          status: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
