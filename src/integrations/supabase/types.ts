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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accessories: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          id: string
          name: string
          quantity: number
          selling_price: number
          shop_id: string
          sku: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          id?: string
          name: string
          quantity?: number
          selling_price: number
          shop_id: string
          sku: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          quantity?: number
          selling_price?: number
          shop_id?: string
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: boolean
          transit_limit_hours: number
        }
        Insert: {
          id?: boolean
          transit_limit_hours?: number
        }
        Update: {
          id?: boolean
          transit_limit_hours?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          device: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          shop_id: string | null
          staff_code: string | null
          table_name: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          device?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          shop_id?: string | null
          staff_code?: string | null
          table_name?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          device?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          shop_id?: string | null
          staff_code?: string | null
          table_name?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      cash_checks: {
        Row: {
          cash_sales: number
          counted: number
          created_at: string
          created_by: string
          day: string
          denominations: Json
          difference: number
          expected: number
          id: string
          kind: string
          opening_cash: number
          session_id: string | null
          shop_id: string
          summary: Json
          updated_at: string
        }
        Insert: {
          cash_sales: number
          counted: number
          created_at?: string
          created_by: string
          day: string
          denominations?: Json
          difference: number
          expected: number
          id?: string
          kind?: string
          opening_cash: number
          session_id?: string | null
          shop_id: string
          summary?: Json
          updated_at?: string
        }
        Update: {
          cash_sales?: number
          counted?: number
          created_at?: string
          created_by?: string
          day?: string
          denominations?: Json
          difference?: number
          expected?: number
          id?: string
          kind?: string
          opening_cash?: number
          session_id?: string | null
          shop_id?: string
          summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_checks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_checks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          kind: string
          reason: string
          session_id: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          kind: string
          reason: string
          session_id: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          reason?: string
          session_id?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          created_by: string
          email: string
          id: string
          name: string
          notes: string
          phone: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string
          id?: string
          name: string
          notes?: string
          phone?: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      held_sale_phones: {
        Row: {
          created_at: string
          held_id: string
          id: string
          product_id: string
          released_at: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          held_id: string
          id?: string
          product_id: string
          released_at?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          held_id?: string
          id?: string
          product_id?: string
          released_at?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "held_sale_phones_held_id_fkey"
            columns: ["held_id"]
            isOneToOne: false
            referencedRelation: "held_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sale_phones_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sale_phones_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      held_sales: {
        Row: {
          cancel_reason: string | null
          cart: Json
          created_at: string
          created_by: string
          expires_at: string
          id: string
          name: string
          note: string
          resolved_by: string | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cart: Json
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          name?: string
          note?: string
          resolved_by?: string | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cart?: Json
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          name?: string
          note?: string
          resolved_by?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "held_sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          brand: string
          id: string
          model: string
          sort: number
        }
        Insert: {
          brand: string
          id?: string
          model: string
          sort?: number
        }
        Update: {
          brand?: string
          id?: string
          model?: string
          sort?: number
        }
        Relationships: []
      }
      pos_sale_lines: {
        Row: {
          accessory_id: string | null
          created_at: string
          id: string
          item_price: number
          kind: string
          name: string
          quantity: number
          receipt_id: string
          sale_price: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          accessory_id?: string | null
          created_at?: string
          id?: string
          item_price: number
          kind: string
          name: string
          quantity: number
          receipt_id: string
          sale_price: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          accessory_id?: string | null
          created_at?: string
          id?: string
          item_price?: number
          kind?: string
          name?: string
          quantity?: number
          receipt_id?: string
          sale_price?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_lines_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_settings: {
        Row: {
          created_at: string
          custom_enabled: boolean
          shop_id: string
          staff_discount_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_enabled?: boolean
          shop_id: string
          staff_discount_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_enabled?: boolean
          shop_id?: string
          staff_discount_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          created_at: string
          created_by: string
          paid_amount: number | null
          product_id: string
          purchase_price: number
          supplier: string | null
          supplier_payment: string
        }
        Insert: {
          created_at?: string
          created_by: string
          paid_amount?: number | null
          product_id: string
          purchase_price: number
          supplier?: string | null
          supplier_payment?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          paid_amount?: number | null
          product_id?: string
          purchase_price?: number
          supplier?: string | null
          supplier_payment?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_photos: {
        Row: {
          created_at: string
          id: string
          product_id: string
          uploaded_by: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          uploaded_by: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_photos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          carrier: string | null
          color: string
          condition: string
          created_at: string
          created_by: string
          current_shop_id: string | null
          id: string
          imei: string
          model_id: string
          product_code: string
          selling_price: number
          shop_id: string
          staff_code: string | null
          status: string
          storage: string
          supplier_id: string | null
          tracking_number: string | null
        }
        Insert: {
          carrier?: string | null
          color: string
          condition: string
          created_at?: string
          created_by: string
          current_shop_id?: string | null
          id?: string
          imei: string
          model_id: string
          product_code: string
          selling_price: number
          shop_id: string
          staff_code?: string | null
          status?: string
          storage: string
          supplier_id?: string | null
          tracking_number?: string | null
        }
        Update: {
          carrier?: string | null
          color?: string
          condition?: string
          created_at?: string
          created_by?: string
          current_shop_id?: string | null
          id?: string
          imei?: string
          model_id?: string
          product_code?: string
          selling_price?: number
          shop_id?: string
          staff_code?: string | null
          status?: string
          storage?: string
          supplier_id?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_current_shop_id_fkey"
            columns: ["current_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          disabled: boolean
          email: string | null
          id: string
          name: string
          shop_id: string | null
          staff_code: string
        }
        Insert: {
          disabled?: boolean
          email?: string | null
          id: string
          name: string
          shop_id?: string | null
          staff_code?: string
        }
        Update: {
          disabled?: boolean
          email?: string | null
          id?: string
          name?: string
          shop_id?: string | null
          staff_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          change_due: number
          checkout_key: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          discount: number
          id: string
          items: Json
          paid: number
          payment: string
          payment_breakdown: Json
          receipt_no: string
          share_token: string
          shop_id: string
          shop_snapshot: Json
          sold_by: string
          staff_code: string
          staff_name: string
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          change_due?: number
          checkout_key?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          discount?: number
          id?: string
          items: Json
          paid: number
          payment: string
          payment_breakdown?: Json
          receipt_no?: string
          share_token?: string
          shop_id: string
          shop_snapshot: Json
          sold_by: string
          staff_code: string
          staff_name: string
          subtotal: number
          tax?: number
          total: number
        }
        Update: {
          change_due?: number
          checkout_key?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          discount?: number
          id?: string
          items?: Json
          paid?: number
          payment?: string
          payment_breakdown?: Json
          receipt_no?: string
          share_token?: string
          shop_id?: string
          shop_snapshot?: Json
          sold_by?: string
          staff_code?: string
          staff_name?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      register_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          day: string
          id: string
          opened_by: string
          opening_cash: number
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          day: string
          id?: string
          opened_by: string
          opening_cash: number
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          day?: string
          id?: string
          opened_by?: string
          opening_cash?: number
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "register_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          item_price: number | null
          payment: string
          product_id: string
          receipt_id: string | null
          receipt_no: string
          sale_price: number
          shop_id: string
          sold_by: string
          staff_code: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          item_price?: number | null
          payment: string
          product_id: string
          receipt_id?: string | null
          receipt_no?: string
          sale_price: number
          shop_id: string
          sold_by: string
          staff_code?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          item_price?: number | null
          payment?: string
          product_id?: string
          receipt_id?: string | null
          receipt_no?: string
          sale_price?: number
          shop_id?: string
          sold_by?: string
          staff_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string
          email: string
          id: string
          logo: string | null
          name: string
          phone: string
          postal_code: string
          receipt_footer: string
        }
        Insert: {
          address?: string
          email?: string
          id?: string
          logo?: string | null
          name: string
          phone?: string
          postal_code?: string
          receipt_footer?: string
        }
        Update: {
          address?: string
          email?: string
          id?: string
          logo?: string | null
          name?: string
          phone?: string
          postal_code?: string
          receipt_footer?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string
          company_name: string
          contact_person: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          notes: string
          payment_terms: string
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string
          company_name?: string
          contact_person?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name: string
          notes?: string
          payment_terms?: string
          phone?: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          company_name?: string
          contact_person?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string
          payment_terms?: string
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          from_shop_id: string
          id: string
          product_id: string
          received_at: string | null
          received_by: string | null
          reject_reason: string | null
          requested_by: string
          status: string
          to_shop_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          from_shop_id: string
          id?: string
          product_id: string
          received_at?: string | null
          received_by?: string | null
          reject_reason?: string | null
          requested_by: string
          status?: string
          to_shop_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          from_shop_id?: string
          id?: string
          product_id?: string
          received_at?: string | null
          received_by?: string | null
          reject_reason?: string | null
          requested_by?: string
          status?: string
          to_shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_shop_id_fkey"
            columns: ["from_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_shop_id_fkey"
            columns: ["to_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      active_suppliers: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      add_product: {
        Args: {
          _color: string
          _condition: string
          _imei: string
          _model_id: string
          _paid_amount: number
          _purchase_price: number
          _selling_price: number
          _shop_id: string
          _staff_code: string
          _storage: string
          _supplier: string
          _supplier_payment: string
        }
        Returns: {
          carrier: string | null
          color: string
          condition: string
          created_at: string
          created_by: string
          current_shop_id: string | null
          id: string
          imei: string
          model_id: string
          product_code: string
          selling_price: number
          shop_id: string
          staff_code: string | null
          status: string
          storage: string
          supplier_id: string | null
          tracking_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_product_photos: {
        Args: { _paths: string[]; _product_id: string }
        Returns: {
          created_at: string
          id: string
          product_id: string
          uploaded_by: string
          url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "product_photos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      add_product_with_supplier: {
        Args: {
          _color: string
          _condition: string
          _imei: string
          _model_id: string
          _paid_amount: number
          _purchase_price: number
          _selling_price: number
          _shop_id: string
          _staff_code: string
          _storage: string
          _supplier_id: string
          _supplier_payment: string
        }
        Returns: {
          carrier: string | null
          color: string
          condition: string
          created_at: string
          created_by: string
          current_shop_id: string | null
          id: string
          imei: string
          model_id: string
          product_code: string
          selling_price: number
          shop_id: string
          staff_code: string | null
          status: string
          storage: string
          supplier_id: string | null
          tracking_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_products_bulk: {
        Args: {
          _items: Json
          _paid_amount: number
          _shop_id: string
          _staff_code: string
          _supplier: string
          _supplier_payment: string
        }
        Returns: {
          carrier: string | null
          color: string
          condition: string
          created_at: string
          created_by: string
          current_shop_id: string | null
          id: string
          imei: string
          model_id: string
          product_code: string
          selling_price: number
          shop_id: string
          staff_code: string | null
          status: string
          storage: string
          supplier_id: string | null
          tracking_number: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      add_products_bulk_with_supplier: {
        Args: {
          _items: Json
          _paid_amount: number
          _shop_id: string
          _staff_code: string
          _supplier_id: string
          _supplier_payment: string
        }
        Returns: {
          carrier: string | null
          color: string
          condition: string
          created_at: string
          created_by: string
          current_shop_id: string | null
          id: string
          imei: string
          model_id: string
          product_code: string
          selling_price: number
          shop_id: string
          staff_code: string | null
          status: string
          storage: string
          supplier_id: string | null
          tracking_number: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      can_edit_product: { Args: { _product_id: string }; Returns: boolean }
      cancel_overdue_transfer: {
        Args: { _reason: string; _transfer_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          from_shop_id: string
          id: string
          product_id: string
          received_at: string | null
          received_by: string | null
          reject_reason: string | null
          requested_by: string
          status: string
          to_shop_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_transfer: {
        Args: { _transfer_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          from_shop_id: string
          id: string
          product_id: string
          received_at: string | null
          received_by: string | null
          reject_reason: string | null
          requested_by: string
          status: string
          to_shop_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_staff_code: { Args: { _code: string }; Returns: string }
      complete_cart_sale: {
        Args: {
          _customer_name: string
          _customer_phone: string
          _discount: number
          _items: Json
          _paid: number
          _payment: string
          _shop_id: string
          _staff_code: string
        }
        Returns: {
          change_due: number
          checkout_key: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          discount: number
          id: string
          items: Json
          paid: number
          payment: string
          payment_breakdown: Json
          receipt_no: string
          share_token: string
          shop_id: string
          shop_snapshot: Json
          sold_by: string
          staff_code: string
          staff_name: string
          subtotal: number
          tax: number
          total: number
        }
        SetofOptions: {
          from: "*"
          to: "receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_pos_sale: {
        Args: {
          _customer: string
          _customer_name: string
          _customer_phone: string
          _discount: number
          _items: Json
          _key: string
          _payments: Json
          _shop: string
          _staff_code: string
        }
        Returns: {
          change_due: number
          checkout_key: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          discount: number
          id: string
          items: Json
          paid: number
          payment: string
          payment_breakdown: Json
          receipt_no: string
          share_token: string
          shop_id: string
          shop_snapshot: Json
          sold_by: string
          staff_code: string
          staff_name: string
          subtotal: number
          tax: number
          total: number
        }
        SetofOptions: {
          from: "*"
          to: "receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_supplier: { Args: { _id: string }; Returns: Json }
      expire_held_sales: { Args: never; Returns: number }
      expire_transfer_requests: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_admin_event: {
        Args: {
          _action: string
          _actor: string
          _details: Json
          _device: string
          _email: string
          _record_id: string
        }
        Returns: undefined
      }
      log_cash_report_print: { Args: { _id: string }; Returns: undefined }
      log_event: {
        Args: {
          _action: string
          _details: Json
          _record_id: string
          _table: string
        }
        Returns: undefined
      }
      my_shop_id: { Args: never; Returns: string }
      phone_reserved: { Args: { _product: string }; Returns: boolean }
      pos_shop_access: { Args: { _shop: string }; Returns: boolean }
      receive_transfer: {
        Args: { _code: string; _transfer_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          from_shop_id: string
          id: string
          product_id: string
          received_at: string | null
          received_by: string | null
          reject_reason: string | null
          requested_by: string
          status: string
          to_shop_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_action: {
        Args: { _action: string; _data: Json; _day: string; _shop: string }
        Returns: Json
      }
      register_summary: { Args: { _day: string; _shop: string }; Returns: Json }
      request_device: { Args: never; Returns: string }
      request_transfer_to_shop: {
        Args: { _product_id: string; _to_shop_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          from_shop_id: string
          id: string
          product_id: string
          received_at: string | null
          received_by: string | null
          reject_reason: string | null
          requested_by: string
          status: string
          to_shop_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_held_sale: {
        Args: { _cancel: boolean; _id: string; _reason: string }
        Returns: Json
      }
      respond_transfer: {
        Args: { _accept: boolean; _reason: string; _transfer_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          from_shop_id: string
          id: string
          product_id: string
          received_at: string | null
          received_by: string | null
          reject_reason: string | null
          requested_by: string
          status: string
          to_shop_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_pos_record: {
        Args: { _data: Json; _id: string; _kind: string; _shop: string }
        Returns: Json
      }
      save_shop_profile: {
        Args: {
          _address: string
          _email: string
          _id: string
          _logo: string
          _name: string
          _phone: string
          _postal_code: string
          _receipt_footer: string
        }
        Returns: undefined
      }
      save_supplier: {
        Args: { _details: Json; _id: string }
        Returns: {
          address: string
          company_name: string
          contact_person: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          notes: string
          payment_terms: string
          phone: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "suppliers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_transit_limit: { Args: { _hours: number }; Returns: undefined }
      set_product_tracking: {
        Args: {
          _carrier: string
          _product_id: string
          _tracking_number: string
        }
        Returns: {
          carrier: string | null
          color: string
          condition: string
          created_at: string
          created_by: string
          current_shop_id: string | null
          id: string
          imei: string
          model_id: string
          product_code: string
          selling_price: number
          shop_id: string
          staff_code: string | null
          status: string
          storage: string
          supplier_id: string | null
          tracking_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shared_pos_receipt: { Args: { _token: string }; Returns: Json }
      supplier_link_count: { Args: { _id: string }; Returns: number }
      supplier_purchases: {
        Args: never
        Returns: {
          color: string
          created_at: string
          imei: string
          model_name: string
          paid_amount: number
          product_code: string
          product_id: string
          purchase_price: number
          shop_id: string
          storage: string
          supplier_id: string
          supplier_payment: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "staff" | "manager"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["owner", "staff", "manager"],
    },
  },
} as const
