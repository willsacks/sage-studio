// Supabase type stubs — shared Supabase project with creatorscircle.art
// Replace with: supabase gen types typescript --local

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          timezone: string;
          onboarding_done: boolean;
          role: "member" | "moderator" | "admin";
          tier_level: number;
          tier_key: string;
          tier_expires_at: string | null;
          artist_username: string | null;
          artist_bio: string | null;
          artist_website: string | null;
          site_style_key: string | null;
          site_style_pending: string | null;
          profile_links: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          timezone?: string;
          onboarding_done?: boolean;
          role?: "member" | "moderator" | "admin";
          tier_level?: number;
          tier_key?: string;
          tier_expires_at?: string | null;
          artist_username?: string | null;
          artist_bio?: string | null;
          artist_website?: string | null;
          site_style_key?: string | null;
          site_style_pending?: string | null;
          profile_links?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          timezone?: string;
          onboarding_done?: boolean;
          role?: "member" | "moderator" | "admin";
          tier_level?: number;
          tier_key?: string;
          tier_expires_at?: string | null;
          artist_username?: string | null;
          artist_bio?: string | null;
          artist_website?: string | null;
          site_style_key?: string | null;
          site_style_pending?: string | null;
          profile_links?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      artist_sites: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          description: string | null;
          logo_url: string | null;
          site_title: string | null;
          site_tagline: string | null;
          style_key: string;
          font_scale: number;
          custom_domain: string | null;
          custom_domain_verified: boolean;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          slug: string;
          description?: string | null;
          logo_url?: string | null;
          site_title?: string | null;
          site_tagline?: string | null;
          style_key?: string;
          font_scale?: number;
          custom_domain?: string | null;
          custom_domain_verified?: boolean;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          logo_url?: string | null;
          site_title?: string | null;
          site_tagline?: string | null;
          style_key?: string;
          font_scale?: number;
          custom_domain?: string | null;
          custom_domain_verified?: boolean;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_pages: {
        Row: {
          id: string;
          user_id: string;
          site_id: string;
          title: string;
          slug: string;
          page_type: string;
          page_data: Json;
          theme: Json | null;
          status: "draft" | "published";
          sort_order: number;
          meta_title: string | null;
          meta_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          site_id: string;
          title: string;
          slug: string;
          page_type?: string;
          page_data?: Json;
          theme?: Json | null;
          status?: "draft" | "published";
          sort_order?: number;
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          site_id?: string;
          title?: string;
          slug?: string;
          page_type?: string;
          page_data?: Json;
          theme?: Json | null;
          status?: "draft" | "published";
          sort_order?: number;
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          description: string;
          started_at: string;
          stopped_at: string | null;
          duration_seconds: number | null;
          category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          description?: string;
          started_at?: string;
          stopped_at?: string | null;
          duration_seconds?: number | null;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          description?: string;
          started_at?: string;
          stopped_at?: string | null;
          duration_seconds?: number | null;
          category?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      billing_customers: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          plan: string;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          plan?: string;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          plan?: string;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      offer_pages: {
        Row: {
          id: string;
          owner_id: string;
          owner_type: string;
          slug: string;
          title: string;
          program_key: string | null;
          page_data: Json;
          theme: Json | null;
          publish_mode: string;
          custom_domain: string | null;
          custom_domain_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          owner_type?: string;
          slug: string;
          title: string;
          program_key?: string | null;
          page_data?: Json;
          theme?: Json | null;
          publish_mode?: string;
          custom_domain?: string | null;
          custom_domain_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          owner_type?: string;
          slug?: string;
          title?: string;
          program_key?: string | null;
          page_data?: Json;
          theme?: Json | null;
          publish_mode?: string;
          custom_domain?: string | null;
          custom_domain_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      offer_templates: {
        Row: {
          id: string;
          owner_id: string | null;
          owner_type: string;
          title: string;
          description: string | null;
          category: string | null;
          page_data: Json;
          theme: Json | null;
          promoted: boolean;
          use_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          owner_type?: string;
          title: string;
          description?: string | null;
          category?: string | null;
          page_data?: Json;
          theme?: Json | null;
          promoted?: boolean;
          use_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          owner_type?: string;
          title?: string;
          description?: string | null;
          category?: string | null;
          page_data?: Json;
          theme?: Json | null;
          promoted?: boolean;
          use_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      todos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          completed?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
