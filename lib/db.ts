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
          ai_assistant_enabled: boolean;
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
          ai_assistant_enabled?: boolean;
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
          ai_assistant_enabled?: boolean;
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
          custom_style: Json | null;
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
          custom_style?: Json | null;
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
          custom_style?: Json | null;
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
          html_content: string | null;
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
          html_content?: string | null;
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
          html_content?: string | null;
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
          todo_id: string | null;
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
          todo_id?: string | null;
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
          todo_id?: string | null;
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
      site_collaborators: {
        Row: {
          id: string;
          site_id: string;
          email: string;
          user_id: string | null;
          role: "viewer" | "editor" | "manager";
          invite_token: string;
          status: "pending" | "accepted";
          invited_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          email: string;
          user_id?: string | null;
          role: "viewer" | "editor" | "manager";
          invite_token?: string;
          status?: "pending" | "accepted";
          invited_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          email?: string;
          user_id?: string | null;
          role?: "viewer" | "editor" | "manager";
          invite_token?: string;
          status?: "pending" | "accepted";
          invited_by?: string;
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
          due_date: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          completed?: boolean;
          due_date?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          completed?: boolean;
          due_date?: string | null;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      finance_entities: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          entity_type: "personal" | "business";
          currency: string;
          fiscal_year_start_month: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          entity_type: "personal" | "business";
          currency?: string;
          fiscal_year_start_month?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          entity_type?: "personal" | "business";
          currency?: string;
          fiscal_year_start_month?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      finance_entity_members: {
        Row: {
          id: string;
          entity_id: string;
          user_id: string | null;
          email: string | null;
          invite_token: string | null;
          invited_by: string | null;
          role: "viewer" | "editor" | "manager" | "owner";
          status: "pending" | "accepted";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          user_id?: string | null;
          email?: string | null;
          invite_token?: string;
          invited_by?: string | null;
          role: "viewer" | "editor" | "manager" | "owner";
          status?: "pending" | "accepted";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          user_id?: string | null;
          email?: string | null;
          invite_token?: string;
          invited_by?: string | null;
          role?: "viewer" | "editor" | "manager" | "owner";
          status?: "pending" | "accepted";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chart_of_accounts: {
        Row: {
          id: string;
          entity_id: string;
          name: string;
          account_type: "asset" | "liability" | "equity" | "income" | "expense";
          account_subtype: string;
          normal_balance: "debit" | "credit";
          is_default: boolean;
          is_active: boolean;
          parent_account_id: string | null;
          display_order: number;
          external_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          name: string;
          account_type: "asset" | "liability" | "equity" | "income" | "expense";
          account_subtype: string;
          normal_balance: "debit" | "credit";
          is_default?: boolean;
          is_active?: boolean;
          parent_account_id?: string | null;
          display_order?: number;
          external_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          name?: string;
          account_type?: "asset" | "liability" | "equity" | "income" | "expense";
          account_subtype?: string;
          normal_balance?: "debit" | "credit";
          is_default?: boolean;
          is_active?: boolean;
          parent_account_id?: string | null;
          display_order?: number;
          external_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          id: string;
          entity_id: string;
          entry_date: string;
          description: string | null;
          source_type: "manual" | "bank_transaction" | "opening_balance" | "invoice_payment" | "reconciliation_adjustment" | "import";
          source_transaction_id: string | null;
          created_by: string;
          is_locked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          entry_date: string;
          description?: string | null;
          source_type: "manual" | "bank_transaction" | "opening_balance" | "invoice_payment" | "reconciliation_adjustment" | "import";
          source_transaction_id?: string | null;
          created_by: string;
          is_locked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          entry_date?: string;
          description?: string | null;
          source_type?: "manual" | "bank_transaction" | "opening_balance" | "invoice_payment" | "reconciliation_adjustment" | "import";
          source_transaction_id?: string | null;
          created_by?: string;
          is_locked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      journal_entry_lines: {
        Row: {
          id: string;
          journal_entry_id: string;
          account_id: string;
          debit: number;
          credit: number;
          memo: string | null;
        };
        Insert: {
          id?: string;
          journal_entry_id: string;
          account_id: string;
          debit?: number;
          credit?: number;
          memo?: string | null;
        };
        Update: {
          id?: string;
          journal_entry_id?: string;
          account_id?: string;
          debit?: number;
          credit?: number;
          memo?: string | null;
        };
        Relationships: [];
      };
      finance_projects: {
        Row: {
          id: string;
          entity_id: string;
          name: string;
          project_type: string | null;
          status: "active" | "completed" | "archived";
          start_date: string | null;
          end_date: string | null;
          budget: number | null;
          description: string | null;
          client_name: string | null;
          customer_id: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          name: string;
          project_type?: string | null;
          status?: "active" | "completed" | "archived";
          start_date?: string | null;
          end_date?: string | null;
          budget?: number | null;
          description?: string | null;
          client_name?: string | null;
          customer_id?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          name?: string;
          project_type?: string | null;
          status?: "active" | "completed" | "archived";
          start_date?: string | null;
          end_date?: string | null;
          budget?: number | null;
          description?: string | null;
          client_name?: string | null;
          customer_id?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bank_connections: {
        Row: {
          id: string;
          owner_id: string;
          plaid_item_id: string;
          plaid_access_token_encrypted: string;
          institution_name: string | null;
          institution_logo_url: string | null;
          plaid_cursor: string | null;
          status: "active" | "error" | "revoked";
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          plaid_item_id: string;
          plaid_access_token_encrypted: string;
          institution_name?: string | null;
          institution_logo_url?: string | null;
          plaid_cursor?: string | null;
          status?: "active" | "error" | "revoked";
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          plaid_item_id?: string;
          plaid_access_token_encrypted?: string;
          institution_name?: string | null;
          institution_logo_url?: string | null;
          plaid_cursor?: string | null;
          status?: "active" | "error" | "revoked";
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          id: string;
          bank_connection_id: string;
          entity_id: string;
          chart_account_id: string | null;
          plaid_account_id: string;
          name: string;
          mask: string | null;
          account_type: string | null;
          current_balance: number | null;
          available_balance: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bank_connection_id: string;
          entity_id: string;
          chart_account_id?: string | null;
          plaid_account_id: string;
          name: string;
          mask?: string | null;
          account_type?: string | null;
          current_balance?: number | null;
          available_balance?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bank_connection_id?: string;
          entity_id?: string;
          chart_account_id?: string | null;
          plaid_account_id?: string;
          name?: string;
          mask?: string | null;
          account_type?: string | null;
          current_balance?: number | null;
          available_balance?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          entity_id: string;
          bank_account_id: string | null;
          plaid_transaction_id: string | null;
          date: string;
          payee_name: string;
          amount: number;
          status: "uncategorized" | "categorized" | "excluded";
          journal_entry_id: string | null;
          is_split: boolean;
          reconciliation_id: string | null;
          cleared_at: string | null;
          notes: string | null;
          needs_review: boolean;
          review_note: string | null;
          flagged_by: string | null;
          flagged_at: string | null;
          money_account_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          bank_account_id?: string | null;
          plaid_transaction_id?: string | null;
          date: string;
          payee_name: string;
          amount: number;
          status?: "uncategorized" | "categorized" | "excluded";
          journal_entry_id?: string | null;
          is_split?: boolean;
          reconciliation_id?: string | null;
          cleared_at?: string | null;
          notes?: string | null;
          needs_review?: boolean;
          review_note?: string | null;
          flagged_by?: string | null;
          flagged_at?: string | null;
          money_account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          bank_account_id?: string | null;
          plaid_transaction_id?: string | null;
          date?: string;
          payee_name?: string;
          amount?: number;
          status?: "uncategorized" | "categorized" | "excluded";
          journal_entry_id?: string | null;
          is_split?: boolean;
          reconciliation_id?: string | null;
          cleared_at?: string | null;
          notes?: string | null;
          needs_review?: boolean;
          review_note?: string | null;
          flagged_by?: string | null;
          flagged_at?: string | null;
          money_account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transaction_splits: {
        Row: {
          id: string;
          transaction_id: string;
          chart_account_id: string;
          project_id: string | null;
          amount: number;
          memo: string | null;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          chart_account_id: string;
          project_id?: string | null;
          amount: number;
          memo?: string | null;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          chart_account_id?: string;
          project_id?: string | null;
          amount?: number;
          memo?: string | null;
        };
        Relationships: [];
      };
      categorization_rules: {
        Row: {
          id: string;
          entity_id: string;
          match_type: "contains" | "exact" | "starts_with";
          match_value: string;
          chart_account_id: string;
          default_project_id: string | null;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          match_type: "contains" | "exact" | "starts_with";
          match_value: string;
          chart_account_id: string;
          default_project_id?: string | null;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          match_type?: "contains" | "exact" | "starts_with";
          match_value?: string;
          chart_account_id?: string;
          default_project_id?: string | null;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reconciliations: {
        Row: {
          id: string;
          bank_account_id: string;
          statement_start_date: string;
          statement_end_date: string;
          statement_ending_balance: number;
          beginning_balance: number;
          status: "in_progress" | "completed";
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bank_account_id: string;
          statement_start_date: string;
          statement_end_date: string;
          statement_ending_balance: number;
          beginning_balance?: number;
          status?: "in_progress" | "completed";
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bank_account_id?: string;
          statement_start_date?: string;
          statement_end_date?: string;
          statement_ending_balance?: number;
          beginning_balance?: number;
          status?: "in_progress" | "completed";
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          entity_id: string;
          project_id: string | null;
          customer_id: string | null;
          external_id: string | null;
          client_name: string;
          client_email: string | null;
          invoice_number: string;
          issue_date: string;
          due_date: string | null;
          status: "draft" | "sent" | "partial" | "paid" | "overdue" | "void";
          subtotal: number;
          tax_amount: number;
          total: number;
          notes: string | null;
          pdf_storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          project_id?: string | null;
          customer_id?: string | null;
          external_id?: string | null;
          client_name: string;
          client_email?: string | null;
          invoice_number: string;
          issue_date: string;
          due_date?: string | null;
          status?: "draft" | "sent" | "partial" | "paid" | "overdue" | "void";
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          notes?: string | null;
          pdf_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          project_id?: string | null;
          customer_id?: string | null;
          external_id?: string | null;
          client_name?: string;
          client_email?: string | null;
          invoice_number?: string;
          issue_date?: string;
          due_date?: string | null;
          status?: "draft" | "sent" | "partial" | "paid" | "overdue" | "void";
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          notes?: string | null;
          pdf_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          amount: number;
          display_order: number;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
          display_order?: number;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          description?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
          display_order?: number;
        };
        Relationships: [];
      };
      finance_customers: {
        Row: {
          id: string;
          entity_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          external_id: string | null;
          source: "manual" | "quickbooks" | "wave";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          external_id?: string | null;
          source?: "manual" | "quickbooks" | "wave";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          external_id?: string | null;
          source?: "manual" | "quickbooks" | "wave";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      qbo_connections: {
        Row: {
          id: string;
          entity_id: string;
          owner_id: string;
          qbo_realm_id: string;
          access_token_encrypted: string;
          refresh_token_encrypted: string;
          access_token_expires_at: string;
          refresh_token_expires_at: string;
          environment: "sandbox" | "production";
          status: "active" | "error" | "revoked";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          owner_id: string;
          qbo_realm_id: string;
          access_token_encrypted: string;
          refresh_token_encrypted: string;
          access_token_expires_at: string;
          refresh_token_expires_at: string;
          environment?: "sandbox" | "production";
          status?: "active" | "error" | "revoked";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          owner_id?: string;
          qbo_realm_id?: string;
          access_token_encrypted?: string;
          refresh_token_encrypted?: string;
          access_token_expires_at?: string;
          refresh_token_expires_at?: string;
          environment?: "sandbox" | "production";
          status?: "active" | "error" | "revoked";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_jobs: {
        Row: {
          id: string;
          owner_id: string;
          entity_id: string | null;
          source: "quickbooks" | "wave";
          status: "pending" | "running" | "completed" | "failed";
          phase: string;
          progress_current: number;
          progress_total: number;
          cursor_state: Record<string, unknown>;
          staged_data_path: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          entity_id?: string | null;
          source: "quickbooks" | "wave";
          status?: "pending" | "running" | "completed" | "failed";
          phase?: string;
          progress_current?: number;
          progress_total?: number;
          cursor_state?: Record<string, unknown>;
          staged_data_path?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          entity_id?: string | null;
          source?: "quickbooks" | "wave";
          status?: "pending" | "running" | "completed" | "failed";
          phase?: string;
          progress_current?: number;
          progress_total?: number;
          cursor_state?: Record<string, unknown>;
          staged_data_path?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoice_payments: {
        Row: {
          id: string;
          invoice_id: string;
          amount: number;
          paid_date: string;
          method: string | null;
          matched_transaction_id: string | null;
          journal_entry_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          amount: number;
          paid_date: string;
          method?: string | null;
          matched_transaction_id?: string | null;
          journal_entry_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          amount?: number;
          paid_date?: string;
          method?: string | null;
          matched_transaction_id?: string | null;
          journal_entry_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      finance_tax_settings: {
        Row: {
          entity_id: string;
          reserve_percentage: number;
          tax_year_start_month: number;
          updated_at: string;
        };
        Insert: {
          entity_id: string;
          reserve_percentage?: number;
          tax_year_start_month?: number;
          updated_at?: string;
        };
        Update: {
          entity_id?: string;
          reserve_percentage?: number;
          tax_year_start_month?: number;
          updated_at?: string;
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
