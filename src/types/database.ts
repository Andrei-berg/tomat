export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: { id: string; name: string; sort_order: number }
        Insert: { id?: string; name: string; sort_order: number }
        Update: { id?: string; name?: string; sort_order?: number }
        Relationships: []
      }
      prices: {
        Row: { id: string; product_id: string; date: string; price_per_kg: number }
        Insert: { id?: string; product_id: string; date: string; price_per_kg: number }
        Update: { id?: string; product_id?: string; date?: string; price_per_kg?: number }
        Relationships: []
      }
      clients: {
        Row: { id: string; name: string; phone: string | null; notes: string | null; is_regular: boolean; created_at: string }
        Insert: { id?: string; name: string; phone?: string | null; notes?: string | null; is_regular?: boolean; created_at?: string }
        Update: { id?: string; name?: string; phone?: string | null; notes?: string | null; is_regular?: boolean; created_at?: string }
        Relationships: []
      }
      orders: {
        Row: { id: string; created_at: string; client_id: string | null; client_name_raw: string | null; payment_type: 'cash' | 'card' | 'debt'; calculated_total: number | null; discount_percent: number | null; manual_total: number | null; status: 'paid' | 'debt' | 'partial'; notes: string | null }
        Insert: { id?: string; created_at?: string; client_id?: string | null; client_name_raw?: string | null; payment_type: 'cash' | 'card' | 'debt'; calculated_total?: number | null; discount_percent?: number | null; manual_total?: number | null; status?: 'paid' | 'debt' | 'partial'; notes?: string | null }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
        Relationships: []
      }
      order_items: {
        Row: { id: string; order_id: string; product_id: string; boxes_count: number; weight_kg: number; price_per_kg: number; line_total: number }
        Insert: { id?: string; order_id: string; product_id: string; boxes_count: number; weight_kg: number; price_per_kg: number }
        Update: { id?: string; order_id?: string; product_id?: string; boxes_count?: number; weight_kg?: number; price_per_kg?: number }
        Relationships: []
      }
      debt_payments: {
        Row: { id: string; order_id: string; amount: number; paid_at: string; payment_type: 'cash' | 'card'; notes: string | null }
        Insert: { id?: string; order_id: string; amount: number; paid_at?: string; payment_type: 'cash' | 'card'; notes?: string | null }
        Update: { id?: string; order_id?: string; amount?: number; paid_at?: string; payment_type?: 'cash' | 'card'; notes?: string | null }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
