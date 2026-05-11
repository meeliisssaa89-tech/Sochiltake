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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          created_at: string
          id: string
          message: string
          meta: Json | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          meta?: Json | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          meta?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ad_watches: {
        Row: {
          created_at: string
          id: string
          reward_amount: number
          reward_currency_id: string | null
          slot_index: number
          user_id: string
          watch_date: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          id?: string
          reward_amount?: number
          reward_currency_id?: string | null
          slot_index: number
          user_id: string
          watch_date?: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          id?: string
          reward_amount?: number
          reward_currency_id?: string | null
          slot_index?: number
          user_id?: string
          watch_date?: string
          xp_reward?: number
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      balances: {
        Row: {
          amount: number
          currency_id: string
          id: string
          user_id: string
        }
        Insert: {
          amount?: number
          currency_id: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          currency_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balances_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          buttons: Json | null
          created_at: string
          failed_count: number
          finished_at: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message: string
          parse_mode: string | null
          sent_count: number
          status: string
        }
        Insert: {
          buttons?: Json | null
          created_at?: string
          failed_count?: number
          finished_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message: string
          parse_mode?: string | null
          sent_count?: number
          status?: string
        }
        Update: {
          buttons?: Json | null
          created_at?: string
          failed_count?: number
          finished_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message?: string
          parse_mode?: string | null
          sent_count?: number
          status?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          created_at: string
          decimals: number
          exchange_rate: number
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          symbol: string
        }
        Insert: {
          created_at?: string
          decimals?: number
          exchange_rate?: number
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          symbol: string
        }
        Update: {
          created_at?: string
          decimals?: number
          exchange_rate?: number
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          symbol?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          check_in_date: string
          created_at: string
          id: string
          reward_amount: number
          reward_currency_id: string | null
          streak_count: number
          user_id: string
        }
        Insert: {
          check_in_date?: string
          created_at?: string
          id?: string
          reward_amount?: number
          reward_currency_id?: string | null
          streak_count?: number
          user_id: string
        }
        Update: {
          check_in_date?: string
          created_at?: string
          id?: string
          reward_amount?: number
          reward_currency_id?: string | null
          streak_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_reward_currency_id_fkey"
            columns: ["reward_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          reward_granted: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          reward_granted?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          reward_granted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "referrals_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
          {
            foreignKeyName: "referrals_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      social_links: {
        Row: {
          account_id: string
          id: string
          linked_at: string
          platform: string
          user_id: string
          verified: boolean
        }
        Insert: {
          account_id: string
          id?: string
          linked_at?: string
          platform: string
          user_id: string
          verified?: boolean
        }
        Update: {
          account_id?: string
          id?: string
          linked_at?: string
          platform?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "social_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      spin_history: {
        Row: {
          amount: number
          created_at: string
          currency_id: string | null
          id: string
          prize_id: string | null
          spin_date: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency_id?: string | null
          id?: string
          prize_id?: string | null
          spin_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency_id?: string | null
          id?: string
          prize_id?: string | null
          spin_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spin_history_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "spin_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      spin_prizes: {
        Row: {
          amount: number
          created_at: string
          currency_id: string | null
          id: string
          image_url: string | null
          is_active: boolean
          label: string
          sort_order: number
          weight: number
          xp_reward: number
        }
        Insert: {
          amount?: number
          created_at?: string
          currency_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          label: string
          sort_order?: number
          weight?: number
          xp_reward?: number
        }
        Update: {
          amount?: number
          created_at?: string
          currency_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          label?: string
          sort_order?: number
          weight?: number
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "spin_prizes_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          is_active: boolean
          is_required: boolean
          metadata: Json | null
          reward_amount: number
          reward_currency_id: string | null
          sort_order: number
          title_ar: string | null
          title_en: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          metadata?: Json | null
          reward_amount?: number
          reward_currency_id?: string | null
          sort_order?: number
          title_ar?: string | null
          title_en: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          metadata?: Json | null
          reward_amount?: number
          reward_currency_id?: string | null
          sort_order?: number
          title_ar?: string | null
          title_en?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_reward_currency_id_fkey"
            columns: ["reward_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      user_tasks: {
        Row: {
          completed_at: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          exp: number
          first_name: string | null
          is_banned: boolean
          language: string
          last_name: string | null
          level: number
          photo_url: string | null
          referred_by: string | null
          telegram_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          exp?: number
          first_name?: string | null
          is_banned?: boolean
          language?: string
          last_name?: string | null
          level?: number
          photo_url?: string | null
          referred_by?: string | null
          telegram_id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          exp?: number
          first_name?: string | null
          is_banned?: boolean
          language?: string
          last_name?: string | null
          level?: number
          photo_url?: string | null
          referred_by?: string | null
          telegram_id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      wallet_tokens: {
        Row: {
          chain: string | null
          contract_address: string | null
          created_at: string
          decimals: number
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          price_api_url: string | null
          price_usd: number
          sort_order: number
          symbol: string
          updated_at: string
        }
        Insert: {
          chain?: string | null
          contract_address?: string | null
          created_at?: string
          decimals?: number
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_api_url?: string | null
          price_usd?: number
          sort_order?: number
          symbol: string
          updated_at?: string
        }
        Update: {
          chain?: string | null
          contract_address?: string | null
          created_at?: string
          decimals?: number
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_api_url?: string | null
          price_usd?: number
          sort_order?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          currency_id: string
          id: string
          processed_at: string | null
          status: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency_id: string
          id?: string
          processed_at?: string | null
          status?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency_id?: string
          id?: string
          processed_at?: string | null
          status?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      task_status: "pending" | "completed"
      task_type: "telegram_join" | "watch_ad" | "social_link" | "code_api" | "submission"
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
      app_role: ["admin", "user"],
      task_status: ["pending", "completed"],
      task_type: ["telegram_join", "watch_ad", "social_link", "code_api", "submission"],
    },
  },
} as const
