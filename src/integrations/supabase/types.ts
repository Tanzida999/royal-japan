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
      sales: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          payment: string
          product_id: string
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
          payment: string
          product_id: string
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
          payment?: string
          product_id?: string
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
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
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
      check_staff_code: { Args: { _code: string }; Returns: string }
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
          payment: string
          product_id: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_shop_id: { Args: never; Returns: string }
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
