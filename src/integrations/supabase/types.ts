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
      products: {
        Row: {
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
        }
        Insert: {
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
        }
        Update: {
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
        ]
      }
      profiles: {
        Row: {
          id: string
          name: string
          shop_id: string | null
          staff_code: string
        }
        Insert: {
          id: string
          name: string
          shop_id?: string | null
          staff_code?: string
        }
        Update: {
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
          created_at: string
          customer_name: string
          customer_phone: string
          discount: number
          id: string
          items: Json
          paid: number
          payment: string
          receipt_no: string
          shop_id: string
          shop_snapshot: Json
          sold_by: string
          staff_code: string
          staff_name: string
          subtotal: number
          total: number
        }
        Insert: {
          change_due?: number
          created_at?: string
          customer_name?: string
          customer_phone?: string
          discount?: number
          id?: string
          items: Json
          paid: number
          payment: string
          receipt_no?: string
          shop_id: string
          shop_snapshot: Json
          sold_by: string
          staff_code: string
          staff_name: string
          subtotal: number
          total: number
        }
        Update: {
          change_due?: number
          created_at?: string
          customer_name?: string
          customer_phone?: string
          discount?: number
          id?: string
          items?: Json
          paid?: number
          payment?: string
          receipt_no?: string
          shop_id?: string
          shop_snapshot?: Json
          sold_by?: string
          staff_code?: string
          staff_name?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipts_shop_id_fkey"
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
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
          created_at: string
          customer_name: string
          customer_phone: string
          discount: number
          id: string
          items: Json
          paid: number
          payment: string
          receipt_no: string
          shop_id: string
          shop_snapshot: Json
          sold_by: string
          staff_code: string
          staff_name: string
          subtotal: number
          total: number
        }
        SetofOptions: {
          from: "*"
          to: "receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_sale: {
        Args: {
          _customer_name: string
          _payment: string
          _product_id: string
          _sale_price: number
          _staff_code: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "sales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_transfer_requests: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_shop_id: { Args: never; Returns: string }
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
      request_transfer: {
        Args: { _product_id: string }
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
      save_transit_limit: { Args: { _hours: number }; Returns: undefined }
    }
    Enums: {
      app_role: "owner" | "staff"
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
      app_role: ["owner", "staff"],
    },
  },
} as const
