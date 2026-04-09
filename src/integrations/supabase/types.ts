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
      ad_campaigns: {
        Row: {
          advertiser_id: string
          budget_cents: number
          cpc_cents: number
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          spent_cents: number
          start_date: string | null
          status: string
          target_industries: string[] | null
          target_locations: string[] | null
          target_niches: string[] | null
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          budget_cents?: number
          cpc_cents?: number
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          spent_cents?: number
          start_date?: string | null
          status?: string
          target_industries?: string[] | null
          target_locations?: string[] | null
          target_niches?: string[] | null
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          budget_cents?: number
          cpc_cents?: number
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          spent_cents?: number
          start_date?: string | null
          status?: string
          target_industries?: string[] | null
          target_locations?: string[] | null
          target_niches?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertiser_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          placement_id: string
          user_id: string | null
          user_industry: string | null
          user_location: string | null
          user_niche: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          placement_id: string
          user_id?: string | null
          user_industry?: string | null
          user_location?: string | null
          user_niche?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          placement_id?: string
          user_id?: string | null
          user_industry?: string | null
          user_location?: string | null
          user_niche?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_placements: {
        Row: {
          body_text: string | null
          campaign_id: string
          clicks: number
          created_at: string
          cta_text: string | null
          cta_url: string
          headline: string
          id: string
          image_url: string | null
          impressions: number
          is_active: boolean
          placement_type: string
          updated_at: string
        }
        Insert: {
          body_text?: string | null
          campaign_id: string
          clicks?: number
          created_at?: string
          cta_text?: string | null
          cta_url: string
          headline: string
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          placement_type?: string
          updated_at?: string
        }
        Update: {
          body_text?: string | null
          campaign_id?: string
          clicks?: number
          created_at?: string
          cta_text?: string | null
          cta_url?: string
          headline?: string
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          placement_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_placements_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_log: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      advertiser_accounts: {
        Row: {
          balance_cents: number
          company_name: string
          contact_email: string
          contact_name: string | null
          created_at: string
          id: string
          industry: string
          logo_url: string | null
          status: string
          total_spent_cents: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          balance_cents?: number
          company_name: string
          contact_email: string
          contact_name?: string | null
          created_at?: string
          id?: string
          industry: string
          logo_url?: string | null
          status?: string
          total_spent_cents?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          balance_cents?: number
          company_name?: string
          contact_email?: string
          contact_name?: string | null
          created_at?: string
          id?: string
          industry?: string
          logo_url?: string | null
          status?: string
          total_spent_cents?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      affiliate_payouts: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          payout_method: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payout_method?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payout_method?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      attribution_touchpoints: {
        Row: {
          business_id: string
          created_at: string
          credit_first_touch: number | null
          credit_last_touch: number | null
          credit_linear: number | null
          credit_owner_confirmed: number | null
          credit_time_decay: number | null
          id: string
          occurred_at: string | null
          outcome_id: string | null
          position_in_journey: number | null
          touchpoint_content: string | null
          touchpoint_source: string | null
          touchpoint_type: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          credit_first_touch?: number | null
          credit_last_touch?: number | null
          credit_linear?: number | null
          credit_owner_confirmed?: number | null
          credit_time_decay?: number | null
          id?: string
          occurred_at?: string | null
          outcome_id?: string | null
          position_in_journey?: number | null
          touchpoint_content?: string | null
          touchpoint_source?: string | null
          touchpoint_type: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          credit_first_touch?: number | null
          credit_last_touch?: number | null
          credit_linear?: number | null
          credit_owner_confirmed?: number | null
          credit_time_decay?: number | null
          id?: string
          occurred_at?: string | null
          outcome_id?: string | null
          position_in_journey?: number | null
          touchpoint_content?: string | null
          touchpoint_source?: string | null
          touchpoint_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribution_touchpoints_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "campaign_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      business_media: {
        Row: {
          business_id: string
          created_at: string
          file_name: string
          file_size_bytes: number | null
          file_type: string
          id: string
          mime_type: string | null
          public_url: string
          shot_type: string
          storage_path: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          public_url: string
          shot_type?: string
          storage_path: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          public_url?: string
          shot_type?: string
          storage_path?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          brand_tone: string | null
          business_category: string | null
          business_name: string
          competitors: string | null
          content_goals: string | null
          created_at: string
          facebook_url: string | null
          funding_goals: string | null
          google_business_profile: string | null
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          niche: string | null
          owner_name: string | null
          referral_goals: string | null
          services: string | null
          target_audience: string | null
          tiktok_url: string | null
          updated_at: string
          user_id: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          brand_tone?: string | null
          business_category?: string | null
          business_name: string
          competitors?: string | null
          content_goals?: string | null
          created_at?: string
          facebook_url?: string | null
          funding_goals?: string | null
          google_business_profile?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          niche?: string | null
          owner_name?: string | null
          referral_goals?: string | null
          services?: string | null
          target_audience?: string | null
          tiktok_url?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          brand_tone?: string | null
          business_category?: string | null
          business_name?: string
          competitors?: string | null
          content_goals?: string | null
          created_at?: string
          facebook_url?: string | null
          funding_goals?: string | null
          google_business_profile?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          niche?: string | null
          owner_name?: string | null
          referral_goals?: string | null
          services?: string | null
          target_audience?: string | null
          tiktok_url?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      campaign_outcomes: {
        Row: {
          appointment_requests: number | null
          attribution_model: string | null
          attribution_score: number | null
          bookings: number | null
          business_id: string
          calls_received: number | null
          campaign_goal: string | null
          campaign_name: string
          campaign_type: string
          clicks: number | null
          content_format: string | null
          content_post_id: string | null
          created_at: string
          cta_used: string | null
          customer_feedback: string | null
          felt_successful: boolean | null
          form_submissions: number | null
          id: string
          launched_at: string | null
          lead_captures: number | null
          location_id: string | null
          manual_notes: string | null
          offer: string | null
          optimization_signals: Json | null
          platform: string | null
          purchases: number | null
          repeat_purchases: number | null
          replies: number | null
          revenue_cents: number | null
          status: string
          strategy_output_id: string | null
          target_audience: string | null
          updated_at: string
          user_id: string
          video_job_id: string | null
          views: number | null
          what_customers_mentioned: string | null
          what_failed: Json | null
          what_worked: Json | null
        }
        Insert: {
          appointment_requests?: number | null
          attribution_model?: string | null
          attribution_score?: number | null
          bookings?: number | null
          business_id: string
          calls_received?: number | null
          campaign_goal?: string | null
          campaign_name: string
          campaign_type?: string
          clicks?: number | null
          content_format?: string | null
          content_post_id?: string | null
          created_at?: string
          cta_used?: string | null
          customer_feedback?: string | null
          felt_successful?: boolean | null
          form_submissions?: number | null
          id?: string
          launched_at?: string | null
          lead_captures?: number | null
          location_id?: string | null
          manual_notes?: string | null
          offer?: string | null
          optimization_signals?: Json | null
          platform?: string | null
          purchases?: number | null
          repeat_purchases?: number | null
          replies?: number | null
          revenue_cents?: number | null
          status?: string
          strategy_output_id?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id: string
          video_job_id?: string | null
          views?: number | null
          what_customers_mentioned?: string | null
          what_failed?: Json | null
          what_worked?: Json | null
        }
        Update: {
          appointment_requests?: number | null
          attribution_model?: string | null
          attribution_score?: number | null
          bookings?: number | null
          business_id?: string
          calls_received?: number | null
          campaign_goal?: string | null
          campaign_name?: string
          campaign_type?: string
          clicks?: number | null
          content_format?: string | null
          content_post_id?: string | null
          created_at?: string
          cta_used?: string | null
          customer_feedback?: string | null
          felt_successful?: boolean | null
          form_submissions?: number | null
          id?: string
          launched_at?: string | null
          lead_captures?: number | null
          location_id?: string | null
          manual_notes?: string | null
          offer?: string | null
          optimization_signals?: Json | null
          platform?: string | null
          purchases?: number | null
          repeat_purchases?: number | null
          replies?: number | null
          revenue_cents?: number | null
          status?: string
          strategy_output_id?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id?: string
          video_job_id?: string | null
          views?: number | null
          what_customers_mentioned?: string | null
          what_failed?: Json | null
          what_worked?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_outcomes_content_post_id_fkey"
            columns: ["content_post_id"]
            isOneToOne: false
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_outcomes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_outcomes_strategy_output_id_fkey"
            columns: ["strategy_output_id"]
            isOneToOne: false
            referencedRelation: "strategy_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_outcomes_video_job_id_fkey"
            columns: ["video_job_id"]
            isOneToOne: false
            referencedRelation: "video_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_flags: {
        Row: {
          content_id: string | null
          content_type: string
          created_at: string
          id: string
          reason: string
          reported_by: string | null
          reported_user_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          content_id?: string | null
          content_type: string
          created_at?: string
          id?: string
          reason: string
          reported_by?: string | null
          reported_user_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          reason?: string
          reported_by?: string | null
          reported_user_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      content_posts: {
        Row: {
          business_id: string
          caption: string | null
          created_at: string
          cta: string | null
          hashtags: string[] | null
          id: string
          location_id: string | null
          media_type: string | null
          media_url: string | null
          platform: string
          platform_version: Json | null
          posted_at: string | null
          production_tool: string | null
          scheduled_at: string | null
          shot_list: Json | null
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_script: string | null
          voiceover_script: string | null
        }
        Insert: {
          business_id: string
          caption?: string | null
          created_at?: string
          cta?: string | null
          hashtags?: string[] | null
          id?: string
          location_id?: string | null
          media_type?: string | null
          media_url?: string | null
          platform?: string
          platform_version?: Json | null
          posted_at?: string | null
          production_tool?: string | null
          scheduled_at?: string | null
          shot_list?: Json | null
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_script?: string | null
          voiceover_script?: string | null
        }
        Update: {
          business_id?: string
          caption?: string | null
          created_at?: string
          cta?: string | null
          hashtags?: string[] | null
          id?: string
          location_id?: string | null
          media_type?: string | null
          media_url?: string | null
          platform?: string
          platform_version?: Json | null
          posted_at?: string | null
          production_tool?: string | null
          scheduled_at?: string | null
          shot_list?: Json | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_script?: string | null
          voiceover_script?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_posts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_pinned: boolean
          reply_count: number
          title: string
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          reply_count?: number
          title: string
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          reply_count?: number
          title?: string
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          upvotes: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          upvotes?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_upvotes: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          reply_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          reply_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          reply_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_upvotes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_upvotes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          business_id: string
          city: string
          country: string | null
          created_at: string
          id: string
          is_primary: boolean
          location_name: string
          service_area: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          city: string
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          location_name: string
          service_area?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          city?: string
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          location_name?: string
          service_area?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      point_history: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          points: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          points: number
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email_marketing_opt_in: boolean
          id: string
          onboarding_completed: boolean
          ricky_limit_reached: boolean
          ricky_question_count: number
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_marketing_opt_in?: boolean
          id?: string
          onboarding_completed?: boolean
          ricky_limit_reached?: boolean
          ricky_question_count?: number
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_marketing_opt_in?: boolean
          id?: string
          onboarding_completed?: boolean
          ricky_limit_reached?: boolean
          ricky_question_count?: number
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          clicks: number
          code: string
          commission_rate_percent: number
          conversions: number
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          clicks?: number
          code: string
          commission_rate_percent?: number
          conversions?: number
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          clicks?: number
          code?: string
          commission_rate_percent?: number
          conversions?: number
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_conversions: {
        Row: {
          commission_cents: number
          converted_at: string | null
          created_at: string
          id: string
          referral_code_id: string
          referred_user_id: string
          referrer_user_id: string
          status: string
        }
        Insert: {
          commission_cents?: number
          converted_at?: string | null
          created_at?: string
          id?: string
          referral_code_id: string
          referred_user_id: string
          referrer_user_id: string
          status?: string
        }
        Update: {
          commission_cents?: number
          converted_at?: string | null
          created_at?: string
          id?: string
          referral_code_id?: string
          referred_user_id?: string
          referrer_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_conversions_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_outputs: {
        Row: {
          business_id: string
          created_at: string
          id: string
          location_id: string | null
          output_data: Json
          step_name: string
          step_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          location_id?: string | null
          output_data?: Json
          step_name: string
          step_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          location_id?: string | null
          output_data?: Json
          step_name?: string
          step_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_outputs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_outputs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_purchases: {
        Row: {
          buyer_user_id: string
          id: string
          purchased_at: string
          strategy_id: string
        }
        Insert: {
          buyer_user_id: string
          id?: string
          purchased_at?: string
          strategy_id: string
        }
        Update: {
          buyer_user_id?: string
          id?: string
          purchased_at?: string
          strategy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_purchases_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "winning_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      tos_acceptances: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          tos_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          tos_version?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          tos_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trial_used_emails: {
        Row: {
          email: string
          id: string
          used_at: string
        }
        Insert: {
          email: string
          id?: string
          used_at?: string
        }
        Update: {
          email?: string
          id?: string
          used_at?: string
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          created_at: string
          id: string
          llm_tokens_used: number
          period_end: string
          period_start: string
          render_jobs_used: number
          seats_used: number
          storage_bytes_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          llm_tokens_used?: number
          period_end?: string
          period_start?: string
          render_jobs_used?: number
          seats_used?: number
          storage_bytes_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          llm_tokens_used?: number
          period_end?: string
          period_start?: string
          render_jobs_used?: number
          seats_used?: number
          storage_bytes_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          api_key_encrypted: string
          created_at: string
          id: string
          is_valid: boolean | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string
          id?: string
          is_valid?: boolean | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string
          id?: string
          is_valid?: boolean | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          ban_expires_at: string | null
          banned_at: string
          created_at: string
          id: string
          is_permanent: boolean
          issued_by: string | null
          notes: string | null
          offense_number: number
          reason: string
          user_id: string
        }
        Insert: {
          ban_expires_at?: string | null
          banned_at?: string
          created_at?: string
          id?: string
          is_permanent?: boolean
          issued_by?: string | null
          notes?: string | null
          offense_number?: number
          reason: string
          user_id: string
        }
        Update: {
          ban_expires_at?: string | null
          banned_at?: string
          created_at?: string
          id?: string
          is_permanent?: boolean
          issued_by?: string | null
          notes?: string | null
          offense_number?: number
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          created_at: string
          id: string
          last_activity_date: string | null
          level: number
          points: number
          streak_days: number
          total_points_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_activity_date?: string | null
          level?: number
          points?: number
          streak_days?: number
          total_points_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_activity_date?: string | null
          level?: number
          points?: number
          streak_days?: number
          total_points_earned?: number
          updated_at?: string
          user_id?: string
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
      user_tool_defaults: {
        Row: {
          created_at: string
          default_provider: string
          id: string
          tool_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_provider: string
          id?: string
          tool_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_provider?: string
          id?: string
          tool_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_generation_jobs: {
        Row: {
          business_id: string
          created_at: string
          error_message: string | null
          id: string
          location_id: string | null
          provider: string
          request_payload: Json
          result_payload: Json | null
          status: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          location_id?: string | null
          provider?: string
          request_payload?: Json
          result_payload?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          location_id?: string | null
          provider?: string
          request_payload?: Json
          result_payload?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_generation_jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_generation_jobs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          scenario_type: string
          updated_at: string
          webhook_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          scenario_type: string
          updated_at?: string
          webhook_url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          scenario_type?: string
          updated_at?: string
          webhook_url?: string
        }
        Relationships: []
      }
      winning_strategies: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          industry: string
          is_free: boolean
          location: string | null
          metrics: Json | null
          platform: string | null
          price_cents: number
          purchase_count: number
          results_summary: string
          seller_user_id: string
          strategy_data: Json
          title: string
          updated_at: string
          upvotes: number
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          industry: string
          is_free?: boolean
          location?: string | null
          metrics?: Json | null
          platform?: string | null
          price_cents?: number
          purchase_count?: number
          results_summary: string
          seller_user_id: string
          strategy_data?: Json
          title: string
          updated_at?: string
          upvotes?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          industry?: string
          is_free?: boolean
          location?: string | null
          metrics?: Json | null
          platform?: string | null
          price_cents?: number
          purchase_count?: number
          results_summary?: string
          seller_user_id?: string
          strategy_data?: Json
          title?: string
          updated_at?: string
          upvotes?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_trial_used: { Args: { check_email: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "developer"
        | "finance"
        | "marketing"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "developer",
        "finance",
        "marketing",
      ],
    },
  },
} as const
