/**
 * Authoritative TypeScript type source for the Archer Supabase schema.
 *
 * Hand-authored to mirror `supabase/migrations/0001_init_schema.sql` exactly.
 * This file — not generated output — is the source of truth consumed by all
 * later data-access code (Stories 1.3+). When the migration changes, update
 * this file in lockstep.
 *
 * Conventions (standard Supabase codegen shape):
 *   - Row:    the shape returned by a SELECT. Nullable columns are `T | null`.
 *   - Insert: the shape accepted by an INSERT. Columns with a DB default or
 *             that are nullable are optional (`?`); NOT NULL columns without a
 *             default are required.
 *   - Update: the shape accepted by an UPDATE. Every column is optional.
 */

// -----------------------------------------------------------------------------
// Enum union types (mirror the DB enum types)
// -----------------------------------------------------------------------------

export type GoalStatus =
  | 'active'
  | 'paused'
  | 'not_now'
  | 'someday'
  | 'completed'
  | 'archived';

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export type ActionStatus = 'available' | 'committed' | 'done' | 'waiting';

export type InboxProcessingStatus =
  | 'unprocessed'
  | 'processed'
  | 'trashed'
  | 'someday'
  | 'reference';

export type ReviewPhase =
  | 'snapshot_open'
  | 'get_clear'
  | 'get_current'
  | 'get_creative'
  | 'snapshot_close'
  | 'complete';

export type PlanningDepth = 'minimal' | 'full_gtd';

// -----------------------------------------------------------------------------
// Skill framework item — JSONB structure stored on goals.skill_framework.
// Mirrors the wizard input shape (see AD-11 Pattern B / AD-12).
// -----------------------------------------------------------------------------

export interface SkillFrameworkItem {
  name: string;
  required_level: number;
  description: string;
  user_rating: number;
}

// -----------------------------------------------------------------------------
// Full-GTD Natural Planning extras — JSONB structure stored on
// projects.planning_detail. NULL for minimal-depth projects.
// -----------------------------------------------------------------------------

export interface PlanningDetail {
  principles: string[];
  vision: string;
  ideas: string[];
  organizing: string[];
}

// -----------------------------------------------------------------------------
// Database shape
// -----------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      goals: {
        Row: {
          id: string;
          user_id: string;
          goal_text: string;
          target_date: string;
          status: GoalStatus;
          skill_framework: SkillFrameworkItem[] | null;
          drivers: string[] | null;
          barriers: string[] | null;
          if_then_plan: string | null;
          last_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_text: string;
          target_date: string;
          status?: GoalStatus;
          skill_framework?: SkillFrameworkItem[] | null;
          drivers?: string[] | null;
          barriers?: string[] | null;
          if_then_plan?: string | null;
          last_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_text?: string;
          target_date?: string;
          status?: GoalStatus;
          skill_framework?: SkillFrameworkItem[] | null;
          drivers?: string[] | null;
          barriers?: string[] | null;
          if_then_plan?: string | null;
          last_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          name: string;
          purpose: string | null;
          successful_outcome: string | null;
          status: ProjectStatus;
          planning_depth: PlanningDepth;
          planning_detail: PlanningDetail | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id?: string | null;
          name: string;
          purpose?: string | null;
          successful_outcome?: string | null;
          status?: ProjectStatus;
          planning_depth?: PlanningDepth;
          planning_detail?: PlanningDetail | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string | null;
          name?: string;
          purpose?: string | null;
          successful_outcome?: string | null;
          status?: ProjectStatus;
          planning_depth?: PlanningDepth;
          planning_detail?: PlanningDetail | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      actions: {
        Row: {
          id: string;
          user_id: string;
          // Nullable since 0003: NULL = standalone action (no parent project).
          project_id: string | null;
          text: string;
          status: ActionStatus;
          context_tags: string[] | null;
          // 0003: who a `waiting` action is waiting on; NULL otherwise.
          delegated_to: string | null;
          // 0003: calendar date a deferred action is tied to; NULL otherwise.
          scheduled_for: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          text: string;
          status?: ActionStatus;
          context_tags?: string[] | null;
          delegated_to?: string | null;
          scheduled_for?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          text?: string;
          status?: ActionStatus;
          context_tags?: string[] | null;
          delegated_to?: string | null;
          scheduled_for?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inbox_items: {
        Row: {
          id: string;
          user_id: string;
          raw_text: string;
          processing_status: InboxProcessingStatus;
          resolved_project_id: string | null;
          captured_at: string;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          raw_text: string;
          processing_status?: InboxProcessingStatus;
          resolved_project_id?: string | null;
          captured_at?: string;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          raw_text?: string;
          processing_status?: InboxProcessingStatus;
          resolved_project_id?: string | null;
          captured_at?: string;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      review_sessions: {
        Row: {
          id: string;
          user_id: string;
          week_number: number;
          week_year: number;
          week_start_date: string;
          week_end_date: string;
          current_phase: ReviewPhase;
          opening_retrospective: string | null;
          closing_intention: string | null;
          closing_blocker: string | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_number: number;
          week_year: number;
          week_start_date: string;
          week_end_date: string;
          current_phase?: ReviewPhase;
          opening_retrospective?: string | null;
          closing_intention?: string | null;
          closing_blocker?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_number?: number;
          week_year?: number;
          week_start_date?: string;
          week_end_date?: string;
          current_phase?: ReviewPhase;
          opening_retrospective?: string | null;
          closing_intention?: string | null;
          closing_blocker?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weekly_snapshots: {
        Row: {
          id: string;
          user_id: string;
          review_session_id: string;
          week_number: number;
          week_year: number;
          week_start_date: string;
          week_end_date: string;
          intention: string;
          blocker: string;
          opening_retrospective: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          review_session_id: string;
          week_number: number;
          week_year: number;
          week_start_date: string;
          week_end_date: string;
          intention: string;
          blocker: string;
          opening_retrospective?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          review_session_id?: string;
          week_number?: number;
          week_year?: number;
          week_start_date?: string;
          week_end_date?: string;
          intention?: string;
          blocker?: string;
          opening_retrospective?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      goal_status: GoalStatus;
      project_status: ProjectStatus;
      action_status: ActionStatus;
      inbox_processing_status: InboxProcessingStatus;
      review_phase: ReviewPhase;
      planning_depth: PlanningDepth;
    };
    CompositeTypes: Record<never, never>;
  };
}

// -----------------------------------------------------------------------------
// Convenience aliases — Row/Insert/Update per table.
// -----------------------------------------------------------------------------

type PublicTables = Database['public']['Tables'];

export type Goal = PublicTables['goals']['Row'];
export type GoalInsert = PublicTables['goals']['Insert'];
export type GoalUpdate = PublicTables['goals']['Update'];

export type Project = PublicTables['projects']['Row'];
export type ProjectInsert = PublicTables['projects']['Insert'];
export type ProjectUpdate = PublicTables['projects']['Update'];

export type Action = PublicTables['actions']['Row'];
export type ActionInsert = PublicTables['actions']['Insert'];
export type ActionUpdate = PublicTables['actions']['Update'];

export type InboxItem = PublicTables['inbox_items']['Row'];
export type InboxItemInsert = PublicTables['inbox_items']['Insert'];
export type InboxItemUpdate = PublicTables['inbox_items']['Update'];

export type ReviewSession = PublicTables['review_sessions']['Row'];
export type ReviewSessionInsert = PublicTables['review_sessions']['Insert'];
export type ReviewSessionUpdate = PublicTables['review_sessions']['Update'];

export type WeeklySnapshot = PublicTables['weekly_snapshots']['Row'];
export type WeeklySnapshotInsert = PublicTables['weekly_snapshots']['Insert'];
export type WeeklySnapshotUpdate = PublicTables['weekly_snapshots']['Update'];
