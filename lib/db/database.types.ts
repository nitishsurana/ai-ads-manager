
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "briefs": {
                  Row: {
                    "cause": string,"content": NonNullable<Json>,"created_at": string,"id": string,"user_id": string,"version": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cause": string,"content": NonNullable<Json>,"created_at"?: string,"id"?: string,"user_id": string,"version": number,"workspace_id": string
                  }
                  Update: {
                    "cause"?: string,"content"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"user_id"?: string,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"costs": {
                  Row: {
                    "created_at": string,"id": string,"intake_id": string | null,"meta": NonNullable<Json>,"model": string | null,"provider": string,"round_id": string | null,"usd": number | null,"user_id": string,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"intake_id"?: string | null,"meta"?: NonNullable<Json>,"model"?: string | null,"provider": string,"round_id"?: string | null,"usd"?: number | null,"user_id": string,"workspace_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"intake_id"?: string | null,"meta"?: NonNullable<Json>,"model"?: string | null,"provider"?: string,"round_id"?: string | null,"usd"?: number | null,"user_id"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "costs_intake_id_fkey"
      columns: ["intake_id"]
isOneToOne: false
      referencedRelation: "intakes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "costs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "testers"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "costs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"creatives": {
                  Row: {
                    "angle": string,"background": NonNullable<Json>,"background_path": string | null,"copy": NonNullable<Json>,"created_at": string,"edits": NonNullable<Json>,"id": string,"judge": Json | null,"layout": Json | null,"n": number,"note": string | null,"photo_id": string | null,"preview_path": string,"rating": string | null,"round_id": string,"supporting_element": string | null,"tags": string[],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "angle": string,"background": NonNullable<Json>,"background_path"?: string | null,"copy": NonNullable<Json>,"created_at"?: string,"edits"?: NonNullable<Json>,"id"?: string,"judge"?: Json | null,"layout"?: Json | null,"n": number,"note"?: string | null,"photo_id"?: string | null,"preview_path": string,"rating"?: string | null,"round_id": string,"supporting_element"?: string | null,"tags"?: string[],"user_id": string
                  }
                  Update: {
                    "angle"?: string,"background"?: NonNullable<Json>,"background_path"?: string | null,"copy"?: NonNullable<Json>,"created_at"?: string,"edits"?: NonNullable<Json>,"id"?: string,"judge"?: Json | null,"layout"?: Json | null,"n"?: number,"note"?: string | null,"photo_id"?: string | null,"preview_path"?: string,"rating"?: string | null,"round_id"?: string,"supporting_element"?: string | null,"tags"?: string[],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"facts": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"status": string,"text": string,"thread_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"status"?: string,"text": string,"thread_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"status"?: string,"text"?: string,"thread_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "facts_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "threads"
      referencedColumns: ["id"]
    }
                  ]
                },"intakes": {
                  Row: {
                    "created_at": string,"failure_code": string | null,"finished_at": string | null,"id": string,"product_key": string | null,"progress": Json | null,"progress_at": string,"status": string,"thread_id": string,"url": string,"user_id": string,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"failure_code"?: string | null,"finished_at"?: string | null,"id"?: string,"product_key"?: string | null,"progress"?: Json | null,"progress_at"?: string,"status"?: string,"thread_id": string,"url": string,"user_id": string,"workspace_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"failure_code"?: string | null,"finished_at"?: string | null,"id"?: string,"product_key"?: string | null,"progress"?: Json | null,"progress_at"?: string,"status"?: string,"thread_id"?: string,"url"?: string,"user_id"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "intakes_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "threads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "intakes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "testers"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "intakes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"parts": NonNullable<Json>,"role": string,"thread_id": string,"ui_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"parts": NonNullable<Json>,"role": string,"thread_id": string,"ui_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"parts"?: NonNullable<Json>,"role"?: string,"thread_id"?: string,"ui_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "threads"
      referencedColumns: ["id"]
    }
                  ]
                },"photos": {
                  Row: {
                    "checks": NonNullable<Json>,"created_at": string,"cutout_path": string | null,"drop_reason": string | null,"dropped": boolean,"id": string,"intake_id": string,"mask_path": string | null,"orig_height": number,"orig_width": number,"phash": string,"position": number,"product_bbox": Json | null,"selected": boolean,"sha256": string,"source_url": string,"thumb_path": string,"tier": string,"work_path": string,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "checks": NonNullable<Json>,"created_at"?: string,"cutout_path"?: string | null,"drop_reason"?: string | null,"dropped"?: boolean,"id"?: string,"intake_id": string,"mask_path"?: string | null,"orig_height": number,"orig_width": number,"phash": string,"position": number,"product_bbox"?: Json | null,"selected"?: boolean,"sha256": string,"source_url": string,"thumb_path": string,"tier": string,"work_path": string,"workspace_id"?: string | null
                  }
                  Update: {
                    "checks"?: NonNullable<Json>,"created_at"?: string,"cutout_path"?: string | null,"drop_reason"?: string | null,"dropped"?: boolean,"id"?: string,"intake_id"?: string,"mask_path"?: string | null,"orig_height"?: number,"orig_width"?: number,"phash"?: string,"position"?: number,"product_bbox"?: Json | null,"selected"?: boolean,"sha256"?: string,"source_url"?: string,"thumb_path"?: string,"tier"?: string,"work_path"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "photos_intake_id_fkey"
      columns: ["intake_id"]
isOneToOne: false
      referencedRelation: "intakes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "photos_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"rounds": {
                  Row: {
                    "attempt": number,"brief_version": number,"deadline_at": string | null,"error": string | null,"finished_at": string | null,"id": string,"inputs": NonNullable<Json>,"n": number,"progress": NonNullable<Json>,"running_at": string | null,"stage": string | null,"started_at": string,"status": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt": number,"brief_version": number,"deadline_at"?: string | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"inputs": NonNullable<Json>,"n": number,"progress"?: NonNullable<Json>,"running_at"?: string | null,"stage"?: string | null,"started_at": string,"status"?: string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "attempt"?: number,"brief_version"?: number,"deadline_at"?: string | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"inputs"?: NonNullable<Json>,"n"?: number,"progress"?: NonNullable<Json>,"running_at"?: string | null,"stage"?: string | null,"started_at"?: string,"status"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"testers": {
                  Row: {
                    "created_at": string,"is_golden": boolean,"name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"is_golden"?: boolean,"name": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"is_golden"?: boolean,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"threads": {
                  Row: {
                    "campaign": NonNullable<Json>,"created_at": string,"id": string,"user_id": string,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"user_id": string,"workspace_id"?: string | null
                  }
                  Update: {
                    "campaign"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"user_id"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "threads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "testers"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "threads_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "brand_kit": NonNullable<Json>,"brand_kit_scraped": NonNullable<Json>,"campaign": NonNullable<Json>,"confirmed": Json | null,"created_at": string,"deleted_at": string | null,"id": string,"logo": Json | null,"phase": string,"product": NonNullable<Json>,"product_key": string,"source_url": string,"thread_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_kit": NonNullable<Json>,"brand_kit_scraped": NonNullable<Json>,"campaign"?: NonNullable<Json>,"confirmed"?: Json | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"logo"?: Json | null,"phase"?: string,"product": NonNullable<Json>,"product_key": string,"source_url": string,"thread_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "brand_kit"?: NonNullable<Json>,"brand_kit_scraped"?: NonNullable<Json>,"campaign"?: NonNullable<Json>,"confirmed"?: Json | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"logo"?: Json | null,"phase"?: string,"product"?: NonNullable<Json>,"product_key"?: string,"source_url"?: string,"thread_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "threads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspaces_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "testers"
      referencedColumns: ["user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_brief_version":
{ Args: { "p_base_version": number,"p_cause": string,"p_content": Json,"p_user_id": string,"p_workspace_id": string }; Returns: number
                           },"complete_intake":
{ Args: { "p_intake_id": string,"p_photos": Json,"p_summary": Json,"p_user_id": string,"p_workspace": Json }; Returns: Json
                           },"finish_round":
{ Args: { "p_creatives": Json,"p_error": string,"p_now": string,"p_round_id": string,"p_status": string,"p_user_id": string }; Returns: string
                           },"housekeep_rounds":
{ Args: { "p_now": string,"p_rewrite_s": number,"p_stale_queued_s": number,"p_user_id": string }; Returns: string[]
                           },"start_round":
{ Args: { "p_attempt": number,"p_brief_version": number,"p_inputs": Json,"p_n": number,"p_now": string,"p_updated_at": string,"p_user_id": string,"p_workspace_id": string }; Returns: string
                           }
            "spend_today_usd":
{ Args: never; Returns: number
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
