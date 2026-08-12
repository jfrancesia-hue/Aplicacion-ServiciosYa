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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      AgentConfig: {
        Row: {
          businessHoursEnd: number
          businessHoursStart: number
          companyId: string
          createdAt: string
          escalationMessage: string | null
          id: string
          isActive: boolean
          maxTurns: number
          name: string
          outsideHoursMessage: string | null
          respectBusinessHours: boolean
          systemPrompt: string | null
          tone: Database["public"]["Enums"]["AgentTone"]
          toolConsultarDeuda: boolean
          toolEscalar: boolean
          toolGenerarLinkPago: boolean
          toolPlanCuotas: boolean
          toolRegistrarPago: boolean
          updatedAt: string
          welcomeMessage: string | null
        }
        Insert: {
          businessHoursEnd?: number
          businessHoursStart?: number
          companyId: string
          createdAt?: string
          escalationMessage?: string | null
          id: string
          isActive?: boolean
          maxTurns?: number
          name?: string
          outsideHoursMessage?: string | null
          respectBusinessHours?: boolean
          systemPrompt?: string | null
          tone?: Database["public"]["Enums"]["AgentTone"]
          toolConsultarDeuda?: boolean
          toolEscalar?: boolean
          toolGenerarLinkPago?: boolean
          toolPlanCuotas?: boolean
          toolRegistrarPago?: boolean
          updatedAt?: string
          welcomeMessage?: string | null
        }
        Update: {
          businessHoursEnd?: number
          businessHoursStart?: number
          companyId?: string
          createdAt?: string
          escalationMessage?: string | null
          id?: string
          isActive?: boolean
          maxTurns?: number
          name?: string
          outsideHoursMessage?: string | null
          respectBusinessHours?: boolean
          systemPrompt?: string | null
          tone?: Database["public"]["Enums"]["AgentTone"]
          toolConsultarDeuda?: boolean
          toolEscalar?: boolean
          toolGenerarLinkPago?: boolean
          toolPlanCuotas?: boolean
          toolRegistrarPago?: boolean
          updatedAt?: string
          welcomeMessage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "AgentConfig_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "Company"
            referencedColumns: ["id"]
          },
        ]
      }
      AgentConversation: {
        Row: {
          channel: Database["public"]["Enums"]["StepChannel"]
          companyId: string
          createdAt: string
          debtorId: string
          escalated: boolean
          escalationReason: string | null
          id: string
          resolvedAt: string | null
          status: Database["public"]["Enums"]["ConversationStatus"]
          turnCount: number
          updatedAt: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["StepChannel"]
          companyId: string
          createdAt?: string
          debtorId: string
          escalated?: boolean
          escalationReason?: string | null
          id?: string
          resolvedAt?: string | null
          status?: Database["public"]["Enums"]["ConversationStatus"]
          turnCount?: number
          updatedAt?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["StepChannel"]
          companyId?: string
          createdAt?: string
          debtorId?: string
          escalated?: boolean
          escalationReason?: string | null
          id?: string
          resolvedAt?: string | null
          status?: Database["public"]["Enums"]["ConversationStatus"]
          turnCount?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "AgentConversation_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "Company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AgentConversation_debtorId_fkey"
            columns: ["debtorId"]
            isOneToOne: false
            referencedRelation: "Debtor"
            referencedColumns: ["id"]
          },
        ]
      }
      AgentMessage: {
        Row: {
          content: string
          conversationId: string
          createdAt: string
          id: string
          role: Database["public"]["Enums"]["AgentRole"]
          toolCalls: Json | null
        }
        Insert: {
          content: string
          conversationId: string
          createdAt?: string
          id?: string
          role: Database["public"]["Enums"]["AgentRole"]
          toolCalls?: Json | null
        }
        Update: {
          content?: string
          conversationId?: string
          createdAt?: string
          id?: string
          role?: Database["public"]["Enums"]["AgentRole"]
          toolCalls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "AgentMessage_conversationId_fkey"
            columns: ["conversationId"]
            isOneToOne: false
            referencedRelation: "AgentConversation"
            referencedColumns: ["id"]
          },
        ]
      }
      app_contact_visibility_rules: {
        Row: {
          allow_without_commission: boolean
          city: string | null
          created_at: string
          enabled: boolean
          ends_at: string | null
          id: string
          metadata: Json
          province: string
          reason: string | null
          scope: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          allow_without_commission?: boolean
          city?: string | null
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          id?: string
          metadata?: Json
          province: string
          reason?: string | null
          scope?: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          allow_without_commission?: boolean
          city?: string | null
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          id?: string
          metadata?: Json
          province?: string
          reason?: string | null
          scope?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      Asset: {
        Row: {
          brand: string | null
          createdAt: string
          id: string
          installDate: string | null
          model: string | null
          name: string
          notes: string | null
          propertyId: string | null
          status: Database["public"]["Enums"]["AssetStatus"]
          type: string
          unitId: string | null
          updatedAt: string
          warrantyEnd: string | null
        }
        Insert: {
          brand?: string | null
          createdAt?: string
          id: string
          installDate?: string | null
          model?: string | null
          name: string
          notes?: string | null
          propertyId?: string | null
          status?: Database["public"]["Enums"]["AssetStatus"]
          type: string
          unitId?: string | null
          updatedAt: string
          warrantyEnd?: string | null
        }
        Update: {
          brand?: string | null
          createdAt?: string
          id?: string
          installDate?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          propertyId?: string | null
          status?: Database["public"]["Enums"]["AssetStatus"]
          type?: string
          unitId?: string | null
          updatedAt?: string
          warrantyEnd?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Asset_propertyId_fkey"
            columns: ["propertyId"]
            isOneToOne: false
            referencedRelation: "Property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Asset_unitId_fkey"
            columns: ["unitId"]
            isOneToOne: false
            referencedRelation: "Unit"
            referencedColumns: ["id"]
          },
        ]
      }
      Attachment: {
        Row: {
          category: Database["public"]["Enums"]["AttachmentCategory"]
          createdAt: string
          eventId: string | null
          fileName: string
          fileSize: number
          fileType: string
          fileUrl: string
          id: string
          ticketId: string
          uploadedBy: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["AttachmentCategory"]
          createdAt?: string
          eventId?: string | null
          fileName: string
          fileSize: number
          fileType: string
          fileUrl: string
          id: string
          ticketId: string
          uploadedBy: string
        }
        Update: {
          category?: Database["public"]["Enums"]["AttachmentCategory"]
          createdAt?: string
          eventId?: string | null
          fileName?: string
          fileSize?: number
          fileType?: string
          fileUrl?: string
          id?: string
          ticketId?: string
          uploadedBy?: string
        }
        Relationships: [
          {
            foreignKeyName: "Attachment_eventId_fkey"
            columns: ["eventId"]
            isOneToOne: false
            referencedRelation: "TicketEvent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Attachment_ticketId_fkey"
            columns: ["ticketId"]
            isOneToOne: false
            referencedRelation: "Ticket"
            referencedColumns: ["id"]
          },
        ]
      }
      Campaign: {
        Row: {
          amountRecovered: number
          channel: Database["public"]["Enums"]["StepChannel"]
          companyId: string
          createdAt: string
          executedAt: string | null
          filters: Json
          id: string
          messageTemplate: string
          name: string
          status: Database["public"]["Enums"]["CampaignStatus"]
          totalDelivered: number
          totalPaid: number
          totalSent: number
          totalTargeted: number
          updatedAt: string
          useAI: boolean
        }
        Insert: {
          amountRecovered?: number
          channel: Database["public"]["Enums"]["StepChannel"]
          companyId: string
          createdAt?: string
          executedAt?: string | null
          filters: Json
          id?: string
          messageTemplate: string
          name: string
          status?: Database["public"]["Enums"]["CampaignStatus"]
          totalDelivered?: number
          totalPaid?: number
          totalSent?: number
          totalTargeted?: number
          updatedAt?: string
          useAI?: boolean
        }
        Update: {
          amountRecovered?: number
          channel?: Database["public"]["Enums"]["StepChannel"]
          companyId?: string
          createdAt?: string
          executedAt?: string | null
          filters?: Json
          id?: string
          messageTemplate?: string
          name?: string
          status?: Database["public"]["Enums"]["CampaignStatus"]
          totalDelivered?: number
          totalPaid?: number
          totalSent?: number
          totalTargeted?: number
          updatedAt?: string
          useAI?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "Campaign_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "Company"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          icono_url: string | null
          id: string
          nombre: string
        }
        Insert: {
          icono_url?: string | null
          id?: string
          nombre: string
        }
        Update: {
          icono_url?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      Category: {
        Row: {
          createdAt: string
          icon: string | null
          id: string
          name: string
          parentId: string | null
          tenantId: string
        }
        Insert: {
          createdAt?: string
          icon?: string | null
          id: string
          name: string
          parentId?: string | null
          tenantId: string
        }
        Update: {
          createdAt?: string
          icon?: string | null
          id?: string
          name?: string
          parentId?: string | null
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Category_parentId_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "Category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Category_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_presupuestos: {
        Row: {
          approved_at: string | null
          chat_id: string
          client_id: string
          created_at: string
          estado: string
          id: string
          monto_senia: number
          monto_total: number
          payment_id: string | null
          payment_link: string | null
          payment_preference_id: string | null
          updated_at: string
          visit_date: string
          visit_time: string
          worker_id: string
        }
        Insert: {
          approved_at?: string | null
          chat_id: string
          client_id: string
          created_at?: string
          estado?: string
          id?: string
          monto_senia: number
          monto_total: number
          payment_id?: string | null
          payment_link?: string | null
          payment_preference_id?: string | null
          updated_at?: string
          visit_date: string
          visit_time: string
          worker_id: string
        }
        Update: {
          approved_at?: string | null
          chat_id?: string
          client_id?: string
          created_at?: string
          estado?: string
          id?: string
          monto_senia?: number
          monto_total?: number
          payment_id?: string | null
          payment_link?: string | null
          payment_preference_id?: string | null
          updated_at?: string
          visit_date?: string
          visit_time?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_presupuestos_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          id: string
          participant_a: string
          participant_b: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_a: string
          participant_b: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_a?: string
          participant_b?: string
          updated_at?: string
        }
        Relationships: []
      }
      Checklist: {
        Row: {
          completedAt: string | null
          completedBy: string | null
          createdAt: string
          id: string
          items: Json
          name: string
          ticketId: string
          updatedAt: string
        }
        Insert: {
          completedAt?: string | null
          completedBy?: string | null
          createdAt?: string
          id: string
          items: Json
          name: string
          ticketId: string
          updatedAt: string
        }
        Update: {
          completedAt?: string | null
          completedBy?: string | null
          createdAt?: string
          id?: string
          items?: Json
          name?: string
          ticketId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Checklist_ticketId_fkey"
            columns: ["ticketId"]
            isOneToOne: false
            referencedRelation: "Ticket"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country_code: string
          country_id: number
          created_at: string
          flag: number
          id: number
          latitude: number
          longitude: number
          name: string
          state_code: string
          state_id: number
          updated_at: string
          wikiDataId: string | null
        }
        Insert: {
          country_code: string
          country_id: number
          created_at?: string
          flag?: number
          id?: number
          latitude: number
          longitude: number
          name: string
          state_code: string
          state_id: number
          updated_at?: string
          wikiDataId?: string | null
        }
        Update: {
          country_code?: string
          country_id?: number
          created_at?: string
          flag?: number
          id?: number
          latitude?: number
          longitude?: number
          name?: string
          state_code?: string
          state_id?: number
          updated_at?: string
          wikiDataId?: string | null
        }
        Relationships: []
      }
      clics_categorias: {
        Row: {
          categoria: string | null
          id: string
          origen: string | null
        }
        Insert: {
          categoria?: string | null
          id?: string
          origen?: string | null
        }
        Update: {
          categoria?: string | null
          id?: string
          origen?: string | null
        }
        Relationships: []
      }
      client_job_reviews: {
        Row: {
          chat_id: string
          client_id: string
          comment: string | null
          created_at: string
          id: string
          payment_record_id: string
          rating: number
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          payment_record_id: string
          rating: number
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          payment_record_id?: string
          rating?: number
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_job_reviews_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_job_reviews_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: true
            referencedRelation: "service_confirmation_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      CollectionAnalytics: {
        Row: {
          companyId: string
          createdAt: string
          id: string
          metadata: Json | null
          type: string
        }
        Insert: {
          companyId: string
          createdAt?: string
          id?: string
          metadata?: Json | null
          type: string
        }
        Update: {
          companyId?: string
          createdAt?: string
          id?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "CollectionAnalytics_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "Company"
            referencedColumns: ["id"]
          },
        ]
      }
      CollectionMessage: {
        Row: {
          aiPersonalized: boolean
          channel: Database["public"]["Enums"]["StepChannel"]
          companyId: string
          content: string
          createdAt: string
          debtId: string | null
          debtorId: string
          deliveredAt: string | null
          error: string | null
          id: string
          originalTemplate: string | null
          readAt: string | null
          sentAt: string | null
          status: Database["public"]["Enums"]["MessageStatus"]
          stepId: string | null
          subject: string | null
        }
        Insert: {
          aiPersonalized?: boolean
          channel: Database["public"]["Enums"]["StepChannel"]
          companyId: string
          content: string
          createdAt?: string
          debtId?: string | null
          debtorId: string
          deliveredAt?: string | null
          error?: string | null
          id?: string
          originalTemplate?: string | null
          readAt?: string | null
          sentAt?: string | null
          status?: Database["public"]["Enums"]["MessageStatus"]
          stepId?: string | null
          subject?: string | null
        }
        Update: {
          aiPersonalized?: boolean
          channel?: Database["public"]["Enums"]["StepChannel"]
          companyId?: string
          content?: string
          createdAt?: string
          debtId?: string | null
          debtorId?: string
          deliveredAt?: string | null
          error?: string | null
          id?: string
          originalTemplate?: string | null
          readAt?: string | null
          sentAt?: string | null
          status?: Database["public"]["Enums"]["MessageStatus"]
          stepId?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "CollectionMessage_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "Company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CollectionMessage_debtId_fkey"
            columns: ["debtId"]
            isOneToOne: false
            referencedRelation: "Debt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CollectionMessage_debtorId_fkey"
            columns: ["debtorId"]
            isOneToOne: false
            referencedRelation: "Debtor"
            referencedColumns: ["id"]
          },
        ]
      }
      CollectionSequence: {
        Row: {
          companyId: string
          createdAt: string
          id: string
          isActive: boolean
          isDefault: boolean
          name: string
          updatedAt: string
        }
        Insert: {
          companyId: string
          createdAt?: string
          id?: string
          isActive?: boolean
          isDefault?: boolean
          name: string
          updatedAt?: string
        }
        Update: {
          companyId?: string
          createdAt?: string
          id?: string
          isActive?: boolean
          isDefault?: boolean
          name?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "CollectionSequence_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "Company"
            referencedColumns: ["id"]
          },
        ]
      }
      CollectionStep: {
        Row: {
          aiTone: string | null
          channel: Database["public"]["Enums"]["StepChannel"]
          id: string
          messageTemplate: string
          onlyIfUnpaid: boolean
          sequenceId: string
          skipIfContacted: boolean
          sortOrder: number
          subject: string | null
          triggerDays: number
          useAI: boolean
        }
        Insert: {
          aiTone?: string | null
          channel: Database["public"]["Enums"]["StepChannel"]
          id?: string
          messageTemplate: string
          onlyIfUnpaid?: boolean
          sequenceId: string
          skipIfContacted?: boolean
          sortOrder: number
          subject?: string | null
          triggerDays: number
          useAI?: boolean
        }
        Update: {
          aiTone?: string | null
          channel?: Database["public"]["Enums"]["StepChannel"]
          id?: string
          messageTemplate?: string
          onlyIfUnpaid?: boolean
          sequenceId?: string
          skipIfContacted?: boolean
          sortOrder?: number
          subject?: string | null
          triggerDays?: number
          useAI?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "CollectionStep_sequenceId_fkey"
            columns: ["sequenceId"]
            isOneToOne: false
            referencedRelation: "CollectionSequence"
            referencedColumns: ["id"]
          },
        ]
      }
      Company: {
        Row: {
          commissionRate: number
          createdAt: string
          currency: string
          defaultGraceDays: number
          defaultLateFeePercent: number | null
          email: string | null
          id: string
          industry: string | null
          logo: string | null
          mpAccessToken: string | null
          mpPublicKey: string | null
          name: string
          phone: string | null
          plan: Database["public"]["Enums"]["PlanType"]
          planExpiresAt: string | null
          slug: string
          timezone: string
          updatedAt: string
          userId: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          commissionRate?: number
          createdAt?: string
          currency?: string
          defaultGraceDays?: number
          defaultLateFeePercent?: number | null
          email?: string | null
          id?: string
          industry?: string | null
          logo?: string | null
          mpAccessToken?: string | null
          mpPublicKey?: string | null
          name: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["PlanType"]
          planExpiresAt?: string | null
          slug: string
          timezone?: string
          updatedAt?: string
          userId: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          commissionRate?: number
          createdAt?: string
          currency?: string
          defaultGraceDays?: number
          defaultLateFeePercent?: number | null
          email?: string | null
          id?: string
          industry?: string | null
          logo?: string | null
          mpAccessToken?: string | null
          mpPublicKey?: string | null
          name?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["PlanType"]
          planExpiresAt?: string | null
          slug?: string
          timezone?: string
          updatedAt?: string
          userId?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      consumer_right_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          email: string
          id: string
          operation_reference: string | null
          request_code: string
          request_type: string
          resolved_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          email: string
          id?: string
          operation_reference?: string | null
          request_code: string
          request_type: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          email?: string
          id?: string
          operation_reference?: string | null
          request_code?: string
          request_type?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contact_unlocks: {
        Row: {
          amount_total: number | null
          chat_id: string | null
          ciudad: string | null
          cliente_id: string
          commission_amount: number | null
          created_at: string
          id: string
          metadata: Json
          oferta_id: string | null
          payment_id: string | null
          payment_provider: string | null
          presupuesto_id: number | null
          provincia: string | null
          reason: string
          status: string
          trabajador_id: string | null
          unlocked_at: string | null
        }
        Insert: {
          amount_total?: number | null
          chat_id?: string | null
          ciudad?: string | null
          cliente_id: string
          commission_amount?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          oferta_id?: string | null
          payment_id?: string | null
          payment_provider?: string | null
          presupuesto_id?: number | null
          provincia?: string | null
          reason?: string
          status?: string
          trabajador_id?: string | null
          unlocked_at?: string | null
        }
        Update: {
          amount_total?: number | null
          chat_id?: string | null
          ciudad?: string | null
          cliente_id?: string
          commission_amount?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          oferta_id?: string | null
          payment_id?: string | null
          payment_provider?: string | null
          presupuesto_id?: number | null
          provincia?: string | null
          reason?: string
          status?: string
          trabajador_id?: string | null
          unlocked_at?: string | null
        }
        Relationships: []
      }
      contrataciones: {
        Row: {
          cliente_id: string | null
          created_at: string
          estado: string | null
          servicio_id: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          estado?: string | null
          servicio_id?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          estado?: string | null
          servicio_id?: number | null
        }
        Relationships: []
      }
      Debt: {
        Row: {
          amount: number
          companyId: string
          concept: string
          createdAt: string
          debtorId: string
          discount: number
          dueDate: string
          externalId: string | null
          id: string
          lateFee: number
          metadata: Json | null
          mpPaymentId: string | null
          mpPaymentLink: string | null
          mpPreferenceId: string | null
          originalAmount: number
          paidAmount: number
          paidAt: string | null
          paymentMethod: string | null
          status: Database["public"]["Enums"]["DebtStatus"]
          updatedAt: string
        }
        Insert: {
          amount: number
          companyId: string
          concept: string
          createdAt?: string
          debtorId: string
          discount?: number
          dueDate: string
          externalId?: string | null
          id?: string
          lateFee?: number
          metadata?: Json | null
          mpPaymentId?: string | null
          mpPaymentLink?: string | null
          mpPreferenceId?: string | null
          originalAmount: number
          paidAmount?: number
          paidAt?: string | null
          paymentMethod?: string | null
          status?: Database["public"]["Enums"]["DebtStatus"]
          updatedAt?: string
        }
        Update: {
          amount?: number
          companyId?: string
          concept?: string
          createdAt?: string
          debtorId?: string
          discount?: number
          dueDate?: string
          externalId?: string | null
          id?: string
          lateFee?: number
          metadata?: Json | null
          mpPaymentId?: string | null
          mpPaymentLink?: string | null
          mpPreferenceId?: string | null
          originalAmount?: number
          paidAmount?: number
          paidAt?: string | null
          paymentMethod?: string | null
          status?: Database["public"]["Enums"]["DebtStatus"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Debt_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "Company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Debt_debtorId_fkey"
            columns: ["debtorId"]
            isOneToOne: false
            referencedRelation: "Debtor"
            referencedColumns: ["id"]
          },
        ]
      }
      Debtor: {
        Row: {
          avgPaymentDelay: number
          bestContactChannel: string | null
          bestContactTime: string | null
          companyId: string
          createdAt: string
          customFields: Json | null
          email: string | null
          externalId: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          responseRate: number
          riskScore: number
          tags: string[] | null
          totalDebt: number
          totalPaid: number
          updatedAt: string
          whatsapp: string | null
        }
        Insert: {
          avgPaymentDelay?: number
          bestContactChannel?: string | null
          bestContactTime?: string | null
          companyId: string
          createdAt?: string
          customFields?: Json | null
          email?: string | null
          externalId?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          responseRate?: number
          riskScore?: number
          tags?: string[] | null
          totalDebt?: number
          totalPaid?: number
          updatedAt?: string
          whatsapp?: string | null
        }
        Update: {
          avgPaymentDelay?: number
          bestContactChannel?: string | null
          bestContactTime?: string | null
          companyId?: string
          createdAt?: string
          customFields?: Json | null
          email?: string | null
          externalId?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          responseRate?: number
          riskScore?: number
          tags?: string[] | null
          totalDebt?: number
          totalPaid?: number
          updatedAt?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Debtor_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "Company"
            referencedColumns: ["id"]
          },
        ]
      }
      Expense: {
        Row: {
          aiCategory: string | null
          aiDeductible: boolean | null
          amount: number
          categoryId: string | null
          createdAt: string
          date: string
          description: string
          id: string
          isDeductible: boolean
          ivaAmount: number | null
          provider: string | null
          receiptUrl: string | null
          taxpayerId: string
        }
        Insert: {
          aiCategory?: string | null
          aiDeductible?: boolean | null
          amount: number
          categoryId?: string | null
          createdAt?: string
          date: string
          description: string
          id: string
          isDeductible?: boolean
          ivaAmount?: number | null
          provider?: string | null
          receiptUrl?: string | null
          taxpayerId: string
        }
        Update: {
          aiCategory?: string | null
          aiDeductible?: boolean | null
          amount?: number
          categoryId?: string | null
          createdAt?: string
          date?: string
          description?: string
          id?: string
          isDeductible?: boolean
          ivaAmount?: number | null
          provider?: string | null
          receiptUrl?: string | null
          taxpayerId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Expense_categoryId_fkey"
            columns: ["categoryId"]
            isOneToOne: false
            referencedRelation: "ExpenseCategory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_taxpayerId_fkey"
            columns: ["taxpayerId"]
            isOneToOne: false
            referencedRelation: "Taxpayer"
            referencedColumns: ["id"]
          },
        ]
      }
      ExpenseCategory: {
        Row: {
          color: string | null
          icon: string | null
          id: string
          isDeductible: boolean
          name: string
          taxpayerId: string
        }
        Insert: {
          color?: string | null
          icon?: string | null
          id: string
          isDeductible?: boolean
          name: string
          taxpayerId: string
        }
        Update: {
          color?: string | null
          icon?: string | null
          id?: string
          isDeductible?: boolean
          name?: string
          taxpayerId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ExpenseCategory_taxpayerId_fkey"
            columns: ["taxpayerId"]
            isOneToOne: false
            referencedRelation: "Taxpayer"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_mensajes: {
        Row: {
          content: string
          id: number
          oferta_id: string
          role: string
          timestamp: string | null
        }
        Insert: {
          content: string
          id?: number
          oferta_id: string
          role: string
          timestamp?: string | null
        }
        Update: {
          content?: string
          id?: number
          oferta_id?: string
          role?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      Invoice: {
        Row: {
          afipErrors: Json | null
          afipResult: string | null
          cae: string | null
          caeExpiry: string | null
          clientId: string
          concepto: number
          createdAt: string
          currency: string
          dueDate: string | null
          exchangeRate: number
          exemptAmount: number
          id: string
          invoiceDate: string
          invoiceNumber: number
          invoiceType: Database["public"]["Enums"]["InvoiceType"]
          ivaAmount: number
          netAmount: number
          notes: string | null
          otherTaxes: number
          paidAt: string | null
          paidStatus: Database["public"]["Enums"]["PaidStatus"]
          paymentDueDate: string | null
          pdfUrl: string | null
          pointOfSale: number
          pointOfSaleId: string | null
          relatedInvoiceId: string | null
          sentAt: string | null
          sentByEmail: boolean
          sentByWhatsapp: boolean
          serviceFrom: string | null
          serviceTo: string | null
          status: Database["public"]["Enums"]["InvoiceStatus"]
          taxpayerId: string
          totalAmount: number
          updatedAt: string
        }
        Insert: {
          afipErrors?: Json | null
          afipResult?: string | null
          cae?: string | null
          caeExpiry?: string | null
          clientId: string
          concepto?: number
          createdAt?: string
          currency?: string
          dueDate?: string | null
          exchangeRate?: number
          exemptAmount?: number
          id: string
          invoiceDate: string
          invoiceNumber: number
          invoiceType: Database["public"]["Enums"]["InvoiceType"]
          ivaAmount: number
          netAmount: number
          notes?: string | null
          otherTaxes?: number
          paidAt?: string | null
          paidStatus?: Database["public"]["Enums"]["PaidStatus"]
          paymentDueDate?: string | null
          pdfUrl?: string | null
          pointOfSale: number
          pointOfSaleId?: string | null
          relatedInvoiceId?: string | null
          sentAt?: string | null
          sentByEmail?: boolean
          sentByWhatsapp?: boolean
          serviceFrom?: string | null
          serviceTo?: string | null
          status?: Database["public"]["Enums"]["InvoiceStatus"]
          taxpayerId: string
          totalAmount: number
          updatedAt?: string
        }
        Update: {
          afipErrors?: Json | null
          afipResult?: string | null
          cae?: string | null
          caeExpiry?: string | null
          clientId?: string
          concepto?: number
          createdAt?: string
          currency?: string
          dueDate?: string | null
          exchangeRate?: number
          exemptAmount?: number
          id?: string
          invoiceDate?: string
          invoiceNumber?: number
          invoiceType?: Database["public"]["Enums"]["InvoiceType"]
          ivaAmount?: number
          netAmount?: number
          notes?: string | null
          otherTaxes?: number
          paidAt?: string | null
          paidStatus?: Database["public"]["Enums"]["PaidStatus"]
          paymentDueDate?: string | null
          pdfUrl?: string | null
          pointOfSale?: number
          pointOfSaleId?: string | null
          relatedInvoiceId?: string | null
          sentAt?: string | null
          sentByEmail?: boolean
          sentByWhatsapp?: boolean
          serviceFrom?: string | null
          serviceTo?: string | null
          status?: Database["public"]["Enums"]["InvoiceStatus"]
          taxpayerId?: string
          totalAmount?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Invoice_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "TaxClient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Invoice_pointOfSaleId_fkey"
            columns: ["pointOfSaleId"]
            isOneToOne: false
            referencedRelation: "PointOfSale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Invoice_relatedInvoiceId_fkey"
            columns: ["relatedInvoiceId"]
            isOneToOne: false
            referencedRelation: "Invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Invoice_taxpayerId_fkey"
            columns: ["taxpayerId"]
            isOneToOne: false
            referencedRelation: "Taxpayer"
            referencedColumns: ["id"]
          },
        ]
      }
      InvoiceItem: {
        Row: {
          description: string
          id: string
          invoiceId: string
          ivaAmount: number
          ivaRate: number
          productId: string | null
          quantity: number
          subtotal: number
          total: number
          unitPrice: number
        }
        Insert: {
          description: string
          id: string
          invoiceId: string
          ivaAmount: number
          ivaRate: number
          productId?: string | null
          quantity: number
          subtotal: number
          total: number
          unitPrice: number
        }
        Update: {
          description?: string
          id?: string
          invoiceId?: string
          ivaAmount?: number
          ivaRate?: number
          productId?: string | null
          quantity?: number
          subtotal?: number
          total?: number
          unitPrice?: number
        }
        Relationships: [
          {
            foreignKeyName: "InvoiceItem_invoiceId_fkey"
            columns: ["invoiceId"]
            isOneToOne: false
            referencedRelation: "Invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "InvoiceItem_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "Product"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_notifications_log: {
        Row: {
          campaign_id: string | null
          id: string
          message_id: number
          notification_type: string
          sent_at: string
          status: string | null
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          id?: string
          message_id: number
          notification_type?: string
          sent_at?: string
          status?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          id?: string
          message_id?: number
          notification_type?: string
          sent_at?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      marketplace_events: {
        Row: {
          category: string | null
          city: string | null
          context: Json
          created_at: string
          event_name: string
          id: number
          province: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          city?: string | null
          context?: Json
          created_at?: string
          event_name: string
          id?: number
          province?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          city?: string | null
          context?: Json
          created_at?: string
          event_name?: string
          id?: number
          province?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mensajes: {
        Row: {
          chat_id: string
          contenido: string
          created_at: string
          id: string
          leido: boolean
          remitente_id: string
        }
        Insert: {
          chat_id: string
          contenido: string
          created_at?: string
          id?: string
          leido?: boolean
          remitente_id: string
        }
        Update: {
          chat_id?: string
          contenido?: string
          created_at?: string
          id?: string
          leido?: boolean
          remitente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          created_at: string
          emisor_id: string | null
          estado: string | null
          fecha: string | null
          id: string
          leido: boolean | null
          mensaje: string | null
          receptor_id: string
          servicio_id: string | null
          transactional_outbox_id: string | null
          urgent_response_deadline: string | null
          urgent_work_alert_id: string | null
        }
        Insert: {
          created_at?: string
          emisor_id?: string | null
          estado?: string | null
          fecha?: string | null
          id?: string
          leido?: boolean | null
          mensaje?: string | null
          receptor_id: string
          servicio_id?: string | null
          transactional_outbox_id?: string | null
          urgent_response_deadline?: string | null
          urgent_work_alert_id?: string | null
        }
        Update: {
          created_at?: string
          emisor_id?: string | null
          estado?: string | null
          fecha?: string | null
          id?: string
          leido?: boolean | null
          mensaje?: string | null
          receptor_id?: string
          servicio_id?: string | null
          transactional_outbox_id?: string | null
          urgent_response_deadline?: string | null
          urgent_work_alert_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_transactional_outbox_id_fkey"
            columns: ["transactional_outbox_id"]
            isOneToOne: false
            referencedRelation: "transactional_notification_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_urgent_work_alert_id_fkey"
            columns: ["urgent_work_alert_id"]
            isOneToOne: false
            referencedRelation: "urgent_work_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      Notification: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["NotificationChannel"]
          createdAt: string
          data: Json
          id: string
          sentAt: string | null
          status: Database["public"]["Enums"]["NotificationStatus"]
          tenantId: string
          ticketId: string | null
          title: string
          type: string
          userId: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["NotificationChannel"]
          createdAt?: string
          data?: Json
          id: string
          sentAt?: string | null
          status?: Database["public"]["Enums"]["NotificationStatus"]
          tenantId: string
          ticketId?: string | null
          title: string
          type: string
          userId: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["NotificationChannel"]
          createdAt?: string
          data?: Json
          id?: string
          sentAt?: string | null
          status?: Database["public"]["Enums"]["NotificationStatus"]
          tenantId?: string
          ticketId?: string | null
          title?: string
          type?: string
          userId?: string
        }
        Relationships: []
      }
      nuevaOferta: {
        Row: {
          app_chat_id: string | null
          app_cliente_id: string | null
          categoria: string | null
          ciudad: string | null
          cliente_frustrado: boolean | null
          cliente_telefono: string | null
          comision: number | null
          created_at: string | null
          desbloquear_enviado_at: string | null
          descripcion: string | null
          disponibilidad: string | null
          domicilio: string | null
          es_inquilino: boolean | null
          estado: string | null
          fecha_hora_acordada: string | null
          fecha_pago: string | null
          finalizado: boolean | null
          historial_conversacion: string | null
          id: number
          media_descripcion: string | null
          media_url: string | null
          metadata: Json
          modo_agente: boolean | null
          monto_final: number | null
          motivo_humano: string | null
          nombre_cliente: string | null
          pagado: boolean | null
          paso: number | null
          presupuesto_estimado: number | null
          presupuesto_seleccionado_id: number | null
          property_id: string | null
          provincia: string | null
          responsable_pago: Database["public"]["Enums"]["responsable_pago"]
          source: string
          trabajador_seleccionado_id: number | null
          unit_id: string | null
          updated_at: string | null
          video_urls: string | null
          workers_notificados: Json | null
          zona: string | null
        }
        Insert: {
          app_chat_id?: string | null
          app_cliente_id?: string | null
          categoria?: string | null
          ciudad?: string | null
          cliente_frustrado?: boolean | null
          cliente_telefono?: string | null
          comision?: number | null
          created_at?: string | null
          desbloquear_enviado_at?: string | null
          descripcion?: string | null
          disponibilidad?: string | null
          domicilio?: string | null
          es_inquilino?: boolean | null
          estado?: string | null
          fecha_hora_acordada?: string | null
          fecha_pago?: string | null
          finalizado?: boolean | null
          historial_conversacion?: string | null
          id?: number
          media_descripcion?: string | null
          media_url?: string | null
          metadata?: Json
          modo_agente?: boolean | null
          monto_final?: number | null
          motivo_humano?: string | null
          nombre_cliente?: string | null
          pagado?: boolean | null
          paso?: number | null
          presupuesto_estimado?: number | null
          presupuesto_seleccionado_id?: number | null
          property_id?: string | null
          provincia?: string | null
          responsable_pago?: Database["public"]["Enums"]["responsable_pago"]
          source?: string
          trabajador_seleccionado_id?: number | null
          unit_id?: string | null
          updated_at?: string | null
          video_urls?: string | null
          workers_notificados?: Json | null
          zona?: string | null
        }
        Update: {
          app_chat_id?: string | null
          app_cliente_id?: string | null
          categoria?: string | null
          ciudad?: string | null
          cliente_frustrado?: boolean | null
          cliente_telefono?: string | null
          comision?: number | null
          created_at?: string | null
          desbloquear_enviado_at?: string | null
          descripcion?: string | null
          disponibilidad?: string | null
          domicilio?: string | null
          es_inquilino?: boolean | null
          estado?: string | null
          fecha_hora_acordada?: string | null
          fecha_pago?: string | null
          finalizado?: boolean | null
          historial_conversacion?: string | null
          id?: number
          media_descripcion?: string | null
          media_url?: string | null
          metadata?: Json
          modo_agente?: boolean | null
          monto_final?: number | null
          motivo_humano?: string | null
          nombre_cliente?: string | null
          pagado?: boolean | null
          paso?: number | null
          presupuesto_estimado?: number | null
          presupuesto_seleccionado_id?: number | null
          property_id?: string | null
          provincia?: string | null
          responsable_pago?: Database["public"]["Enums"]["responsable_pago"]
          source?: string
          trabajador_seleccionado_id?: number | null
          unit_id?: string | null
          updated_at?: string | null
          video_urls?: string | null
          workers_notificados?: Json | null
          zona?: string | null
        }
        Relationships: []
      }
      pagos_procesados: {
        Row: {
          creado_en: string | null
          email: string | null
          id: string
          libelula_id_transaccion: string | null
          payment_id: number | null
          title: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          creado_en?: string | null
          email?: string | null
          id?: string
          libelula_id_transaccion?: string | null
          payment_id?: number | null
          title?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          creado_en?: string | null
          email?: string | null
          id?: string
          libelula_id_transaccion?: string | null
          payment_id?: number | null
          title?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      Payment: {
        Row: {
          amount: number
          companyId: string
          createdAt: string
          debtId: string
          id: string
          method: Database["public"]["Enums"]["PaymentMethod"]
          mpPaymentId: string | null
          mpStatus: string | null
          notes: string | null
          receiptUrl: string | null
          status: Database["public"]["Enums"]["PaymentStatus"]
        }
        Insert: {
          amount: number
          companyId: string
          createdAt?: string
          debtId: string
          id?: string
          method: Database["public"]["Enums"]["PaymentMethod"]
          mpPaymentId?: string | null
          mpStatus?: string | null
          notes?: string | null
          receiptUrl?: string | null
          status?: Database["public"]["Enums"]["PaymentStatus"]
        }
        Update: {
          amount?: number
          companyId?: string
          createdAt?: string
          debtId?: string
          id?: string
          method?: Database["public"]["Enums"]["PaymentMethod"]
          mpPaymentId?: string | null
          mpStatus?: string | null
          notes?: string | null
          receiptUrl?: string | null
          status?: Database["public"]["Enums"]["PaymentStatus"]
        }
        Relationships: [
          {
            foreignKeyName: "Payment_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "Company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Payment_debtId_fkey"
            columns: ["debtId"]
            isOneToOne: false
            referencedRelation: "Debt"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          created_at: string | null
          edad: number | null
          foto_perfil: string | null
          id: string
          nombre: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          edad?: number | null
          foto_perfil?: string | null
          id?: string
          nombre?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          edad?: number | null
          foto_perfil?: string | null
          id?: string
          nombre?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      PointOfSale: {
        Row: {
          createdAt: string
          id: string
          isDefault: boolean
          name: string | null
          number: number
          taxpayerId: string
          type: string
        }
        Insert: {
          createdAt?: string
          id: string
          isDefault?: boolean
          name?: string | null
          number: number
          taxpayerId: string
          type?: string
        }
        Update: {
          createdAt?: string
          id?: string
          isDefault?: boolean
          name?: string | null
          number?: number
          taxpayerId?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "PointOfSale_taxpayerId_fkey"
            columns: ["taxpayerId"]
            isOneToOne: false
            referencedRelation: "Taxpayer"
            referencedColumns: ["id"]
          },
        ]
      }
      post: {
        Row: {
          created_at: string
          descripcion: string | null
          id: number
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: number
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: number
        }
        Relationships: []
      }
      presupuestopagado: {
        Row: {
          comision: number | null
          created_at: string | null
          id: number
          monto_total: number | null
          payment_id: string | null
          presupuesto_id: number | null
        }
        Insert: {
          comision?: number | null
          created_at?: string | null
          id?: number
          monto_total?: number | null
          payment_id?: string | null
          presupuesto_id?: number | null
        }
        Update: {
          comision?: number | null
          created_at?: string | null
          id?: number
          monto_total?: number | null
          payment_id?: string | null
          presupuesto_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuestopagado_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos: {
        Row: {
          app_chat_id: string | null
          cliente_id: string | null
          comision_pagada: boolean
          commission_amount: number | null
          contacto_habilitado: boolean
          created_at: string | null
          descripcion: string | null
          estado: string | null
          estado_confirmacion: string
          estimated_units: number | null
          horarios_disponibles: string | null
          id: number
          metadata: Json
          monto: number | null
          oferta_id: number | null
          paid_at: string | null
          payment_id: string | null
          payment_link: string | null
          payment_preference_id: string | null
          payment_provider: string | null
          pricing_mode: string
          property_id: string | null
          reference_total_type: string
          score: number | null
          senia: number | null
          tiempo_entrega: number | null
          trabajador_id: number | null
          trabajador_uuid: string | null
          unit_id: string | null
          unit_rate: number | null
        }
        Insert: {
          app_chat_id?: string | null
          cliente_id?: string | null
          comision_pagada?: boolean
          commission_amount?: number | null
          contacto_habilitado?: boolean
          created_at?: string | null
          descripcion?: string | null
          estado?: string | null
          estado_confirmacion?: string
          estimated_units?: number | null
          horarios_disponibles?: string | null
          id?: number
          metadata?: Json
          monto?: number | null
          oferta_id?: number | null
          paid_at?: string | null
          payment_id?: string | null
          payment_link?: string | null
          payment_preference_id?: string | null
          payment_provider?: string | null
          pricing_mode?: string
          property_id?: string | null
          reference_total_type?: string
          score?: number | null
          senia?: number | null
          tiempo_entrega?: number | null
          trabajador_id?: number | null
          trabajador_uuid?: string | null
          unit_id?: string | null
          unit_rate?: number | null
        }
        Update: {
          app_chat_id?: string | null
          cliente_id?: string | null
          comision_pagada?: boolean
          commission_amount?: number | null
          contacto_habilitado?: boolean
          created_at?: string | null
          descripcion?: string | null
          estado?: string | null
          estado_confirmacion?: string
          estimated_units?: number | null
          horarios_disponibles?: string | null
          id?: number
          metadata?: Json
          monto?: number | null
          oferta_id?: number | null
          paid_at?: string | null
          payment_id?: string | null
          payment_link?: string | null
          payment_preference_id?: string | null
          payment_provider?: string | null
          pricing_mode?: string
          property_id?: string | null
          reference_total_type?: string
          score?: number | null
          senia?: number | null
          tiempo_entrega?: number | null
          trabajador_id?: number | null
          trabajador_uuid?: string | null
          unit_id?: string | null
          unit_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "nuevaOferta"
            referencedColumns: ["id"]
          },
        ]
      }
      Product: {
        Row: {
          code: string | null
          createdAt: string
          description: string | null
          id: string
          isActive: boolean
          ivaRate: number
          name: string
          taxpayerId: string
          unit: string
          unitPrice: number
          updatedAt: string
        }
        Insert: {
          code?: string | null
          createdAt?: string
          description?: string | null
          id: string
          isActive?: boolean
          ivaRate?: number
          name: string
          taxpayerId: string
          unit?: string
          unitPrice: number
          updatedAt?: string
        }
        Update: {
          code?: string | null
          createdAt?: string
          description?: string | null
          id?: string
          isActive?: boolean
          ivaRate?: number
          name?: string
          taxpayerId?: string
          unit?: string
          unitPrice?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Product_taxpayerId_fkey"
            columns: ["taxpayerId"]
            isOneToOne: false
            referencedRelation: "Taxpayer"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          provider_id: string
          reason_category: string
          reporter_id: string
          service_id: number | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          provider_id: string
          reason_category: string
          reporter_id: string
          service_id?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          provider_id?: string
          reason_category?: string
          reporter_id?: string
          service_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_reports_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_reports_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "servicios_with_coords"
            referencedColumns: ["id"]
          },
        ]
      }
      Property: {
        Row: {
          address: string
          createdAt: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          parentId: string | null
          photoUrl: string | null
          tenantId: string
          type: Database["public"]["Enums"]["PropertyType"]
          updatedAt: string
        }
        Insert: {
          address: string
          createdAt?: string
          id: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          parentId?: string | null
          photoUrl?: string | null
          tenantId: string
          type: Database["public"]["Enums"]["PropertyType"]
          updatedAt: string
        }
        Update: {
          address?: string
          createdAt?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          parentId?: string | null
          photoUrl?: string | null
          tenantId?: string
          type?: Database["public"]["Enums"]["PropertyType"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Property_parentId_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "Property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Property_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      Provider: {
        Row: {
          address: string | null
          avgRating: number
          avgResponseTime: number | null
          businessName: string
          contactName: string
          createdAt: string
          cuit: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string
          status: Database["public"]["Enums"]["ProviderStatus"]
          tenantId: string
          totalJobs: number
          updatedAt: string
        }
        Insert: {
          address?: string | null
          avgRating?: number
          avgResponseTime?: number | null
          businessName: string
          contactName: string
          createdAt?: string
          cuit?: string | null
          email?: string | null
          id: string
          notes?: string | null
          phone: string
          status?: Database["public"]["Enums"]["ProviderStatus"]
          tenantId: string
          totalJobs?: number
          updatedAt: string
        }
        Update: {
          address?: string | null
          avgRating?: number
          avgResponseTime?: number | null
          businessName?: string
          contactName?: string
          createdAt?: string
          cuit?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["ProviderStatus"]
          tenantId?: string
          totalJobs?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Provider_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_chat_response_times: {
        Row: {
          chat_id: string
          created_at: string
          first_request_at: string
          first_response_at: string
          id: number
          provider_id: string
          requester_id: string
          response_minutes: number
        }
        Insert: {
          chat_id: string
          created_at?: string
          first_request_at: string
          first_response_at: string
          id?: number
          provider_id: string
          requester_id: string
          response_minutes: number
        }
        Update: {
          chat_id?: string
          created_at?: string
          first_request_at?: string
          first_response_at?: string
          id?: number
          provider_id?: string
          requester_id?: string
          response_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_chat_response_times_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      ProviderTrade: {
        Row: {
          availableHours: Json
          coverageZones: Json
          createdAt: string
          hourlyRate: number | null
          id: string
          providerId: string
          tradeId: string
        }
        Insert: {
          availableHours?: Json
          coverageZones?: Json
          createdAt?: string
          hourlyRate?: number | null
          id: string
          providerId: string
          tradeId: string
        }
        Update: {
          availableHours?: Json
          coverageZones?: Json
          createdAt?: string
          hourlyRate?: number | null
          id?: string
          providerId?: string
          tradeId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ProviderTrade_providerId_fkey"
            columns: ["providerId"]
            isOneToOne: false
            referencedRelation: "Provider"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ProviderTrade_tradeId_fkey"
            columns: ["tradeId"]
            isOneToOne: false
            referencedRelation: "Trade"
            referencedColumns: ["id"]
          },
        ]
      }
      Quote: {
        Row: {
          amount: number
          approvedAt: string | null
          approvedBy: string | null
          conditions: string | null
          createdAt: string
          currency: string
          description: string
          estimatedDays: number | null
          id: string
          providerId: string
          rejectionReason: string | null
          status: Database["public"]["Enums"]["QuoteStatus"]
          ticketId: string
          updatedAt: string
        }
        Insert: {
          amount: number
          approvedAt?: string | null
          approvedBy?: string | null
          conditions?: string | null
          createdAt?: string
          currency?: string
          description: string
          estimatedDays?: number | null
          id: string
          providerId: string
          rejectionReason?: string | null
          status?: Database["public"]["Enums"]["QuoteStatus"]
          ticketId: string
          updatedAt: string
        }
        Update: {
          amount?: number
          approvedAt?: string | null
          approvedBy?: string | null
          conditions?: string | null
          createdAt?: string
          currency?: string
          description?: string
          estimatedDays?: number | null
          id?: string
          providerId?: string
          rejectionReason?: string | null
          status?: Database["public"]["Enums"]["QuoteStatus"]
          ticketId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Quote_providerId_fkey"
            columns: ["providerId"]
            isOneToOne: false
            referencedRelation: "Provider"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Quote_ticketId_fkey"
            columns: ["ticketId"]
            isOneToOne: false
            referencedRelation: "Ticket"
            referencedColumns: ["id"]
          },
        ]
      }
      Rating: {
        Row: {
          comment: string | null
          createdAt: string
          id: string
          providerId: string
          ratedBy: string
          score: number
          ticketId: string
        }
        Insert: {
          comment?: string | null
          createdAt?: string
          id: string
          providerId: string
          ratedBy: string
          score: number
          ticketId: string
        }
        Update: {
          comment?: string | null
          createdAt?: string
          id?: string
          providerId?: string
          ratedBy?: string
          score?: number
          ticketId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Rating_providerId_fkey"
            columns: ["providerId"]
            isOneToOne: false
            referencedRelation: "Provider"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Rating_ratedBy_fkey"
            columns: ["ratedBy"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Rating_ticketId_fkey"
            columns: ["ticketId"]
            isOneToOne: false
            referencedRelation: "Ticket"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          reason_category: string
          reporter_user_id: string | null
          service_id: number
          status: string
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason_category: string
          reporter_user_id?: string | null
          service_id: number
          status?: string
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason_category?: string
          reporter_user_id?: string | null
          service_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "servicios_with_coords"
            referencedColumns: ["id"]
          },
        ]
      }
      service_confirmation_payments: {
        Row: {
          amount_total: number
          approved_at: string | null
          budget_id: number | null
          chat_id: string | null
          checkout_url: string | null
          commission_amount: number
          completed_at: string | null
          confirmation_message_id: string | null
          created_at: string
          currency: string
          estimated_units: number | null
          id: string
          job_status: string
          offer_id: number | null
          operational_notice_accepted_at: string | null
          operational_notice_version: string | null
          origin: string
          payer_id: string
          payment_id: string | null
          preference_id: string | null
          pricing_mode: string | null
          provider_id: string
          provider_status: string | null
          quote_message_id: string | null
          reference_total_type: string | null
          schedule_proposed_by: string | null
          schedule_round: number
          schedule_status: string
          scheduled_at: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          scheduled_timezone: string | null
          status: string
          unit_rate: number | null
          updated_at: string
        }
        Insert: {
          amount_total: number
          approved_at?: string | null
          budget_id?: number | null
          chat_id?: string | null
          checkout_url?: string | null
          commission_amount: number
          completed_at?: string | null
          confirmation_message_id?: string | null
          created_at?: string
          currency?: string
          estimated_units?: number | null
          id?: string
          job_status?: string
          offer_id?: number | null
          operational_notice_accepted_at?: string | null
          operational_notice_version?: string | null
          origin?: string
          payer_id: string
          payment_id?: string | null
          preference_id?: string | null
          pricing_mode?: string | null
          provider_id: string
          provider_status?: string | null
          quote_message_id?: string | null
          reference_total_type?: string | null
          schedule_proposed_by?: string | null
          schedule_round?: number
          schedule_status?: string
          scheduled_at?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          scheduled_timezone?: string | null
          status?: string
          unit_rate?: number | null
          updated_at?: string
        }
        Update: {
          amount_total?: number
          approved_at?: string | null
          budget_id?: number | null
          chat_id?: string | null
          checkout_url?: string | null
          commission_amount?: number
          completed_at?: string | null
          confirmation_message_id?: string | null
          created_at?: string
          currency?: string
          estimated_units?: number | null
          id?: string
          job_status?: string
          offer_id?: number | null
          operational_notice_accepted_at?: string | null
          operational_notice_version?: string | null
          origin?: string
          payer_id?: string
          payment_id?: string | null
          preference_id?: string | null
          pricing_mode?: string | null
          provider_id?: string
          provider_status?: string | null
          quote_message_id?: string | null
          reference_total_type?: string | null
          schedule_proposed_by?: string | null
          schedule_round?: number
          schedule_status?: string
          scheduled_at?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          scheduled_timezone?: string | null
          status?: string
          unit_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_confirmation_payments_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_confirmation_payments_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_confirmation_payments_confirmation_message_id_fkey"
            columns: ["confirmation_message_id"]
            isOneToOne: false
            referencedRelation: "mensajes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_confirmation_payments_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "nuevaOferta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_confirmation_payments_quote_message_id_fkey"
            columns: ["quote_message_id"]
            isOneToOne: false
            referencedRelation: "mensajes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_job_incidents: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          case_number: string
          category: string
          chat_id: string
          created_at: string
          details: string | null
          id: string
          intake: Json
          intake_completed_at: string | null
          mica_summary: string | null
          payment_record_id: string
          provider_id: string
          reporter_id: string
          requested_resolution: string | null
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          case_number: string
          category: string
          chat_id: string
          created_at?: string
          details?: string | null
          id?: string
          intake?: Json
          intake_completed_at?: string | null
          mica_summary?: string | null
          payment_record_id: string
          provider_id: string
          reporter_id: string
          requested_resolution?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          case_number?: string
          category?: string
          chat_id?: string
          created_at?: string
          details?: string | null
          id?: string
          intake?: Json
          intake_completed_at?: string | null
          mica_summary?: string | null
          payment_record_id?: string
          provider_id?: string
          reporter_id?: string
          requested_resolution?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_job_incidents_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_job_incidents_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: true
            referencedRelation: "service_confirmation_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_job_reviews: {
        Row: {
          chat_id: string
          comment: string | null
          created_at: string
          id: string
          payment_record_id: string
          provider_id: string
          rating: number
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          comment?: string | null
          created_at?: string
          id?: string
          payment_record_id: string
          provider_id: string
          rating: number
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          payment_record_id?: string
          provider_id?: string
          rating?: number
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_job_reviews_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_job_reviews_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: true
            referencedRelation: "service_confirmation_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_schedule_proposals: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          payment_record_id: string
          proposed_by: string
          reason: string
          round: number
          selected_at: string | null
          selected_slot_id: string | null
          status: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          payment_record_id: string
          proposed_by: string
          reason: string
          round: number
          selected_at?: string | null
          selected_slot_id?: string | null
          status?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          payment_record_id?: string
          proposed_by?: string
          reason?: string
          round?: number
          selected_at?: string | null
          selected_slot_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_schedule_proposals_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_schedule_proposals_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: false
            referencedRelation: "service_confirmation_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_schedule_proposals_selected_slot_id_fkey"
            columns: ["selected_slot_id"]
            isOneToOne: false
            referencedRelation: "service_schedule_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      service_schedule_slots: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          position: number
          proposal_id: string
          selected: boolean
          starts_at: string
          timezone: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          position: number
          proposal_id: string
          selected?: boolean
          starts_at: string
          timezone?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          position?: number
          proposal_id?: string
          selected?: boolean
          starts_at?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_schedule_slots_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "service_schedule_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      servicion: {
        Row: {
          detalles: string | null
          fotos: string | null
          horarios: string | null
          id: number
          precio: number | null
          tipo_servicio: string | null
          user_id: string
        }
        Insert: {
          detalles?: string | null
          fotos?: string | null
          horarios?: string | null
          id?: number
          precio?: number | null
          tipo_servicio?: string | null
          user_id?: string
        }
        Update: {
          detalles?: string | null
          fotos?: string | null
          horarios?: string | null
          id?: number
          precio?: number | null
          tipo_servicio?: string | null
          user_id?: string
        }
        Relationships: []
      }
      servicios: {
        Row: {
          aceptado: boolean | null
          barrio: string | null
          calificacion_promedio: number | null
          categoria: string | null
          categoria_id: string | null
          ciudad: string | null
          country: string | null
          descripcion: string | null
          estado: string | null
          foto_perfil: string | null
          horario: string | null
          id: number
          latitud: number | null
          location: unknown
          longitud: number | null
          postal_code: string | null
          precio: number | null
          titulo: string
          user_id: string | null
          usuario_id: string | null
          veces_contratado: number | null
        }
        Insert: {
          aceptado?: boolean | null
          barrio?: string | null
          calificacion_promedio?: number | null
          categoria?: string | null
          categoria_id?: string | null
          ciudad?: string | null
          country?: string | null
          descripcion?: string | null
          estado?: string | null
          foto_perfil?: string | null
          horario?: string | null
          id?: number
          latitud?: number | null
          location?: unknown
          longitud?: number | null
          postal_code?: string | null
          precio?: number | null
          titulo: string
          user_id?: string | null
          usuario_id?: string | null
          veces_contratado?: number | null
        }
        Update: {
          aceptado?: boolean | null
          barrio?: string | null
          calificacion_promedio?: number | null
          categoria?: string | null
          categoria_id?: string | null
          ciudad?: string | null
          country?: string | null
          descripcion?: string | null
          estado?: string | null
          foto_perfil?: string | null
          horario?: string | null
          id?: number
          latitud?: number | null
          location?: unknown
          longitud?: number | null
          postal_code?: string | null
          precio?: number | null
          titulo?: string
          user_id?: string | null
          usuario_id?: string | null
          veces_contratado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_servicios_categoria"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_usuario_id"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios_contratados: {
        Row: {
          aceptado: boolean | null
          contratado_id: string | null
          contratante_id: string | null
          creado_en: string | null
          id: string
          servicio_id: number | null
        }
        Insert: {
          aceptado?: boolean | null
          contratado_id?: string | null
          contratante_id?: string | null
          creado_en?: string | null
          id?: string
          servicio_id?: number | null
        }
        Update: {
          aceptado?: boolean | null
          contratado_id?: string | null
          contratante_id?: string | null
          creado_en?: string | null
          id?: string
          servicio_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "servicios_contratados_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_contratados_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios_with_coords"
            referencedColumns: ["id"]
          },
        ]
      }
      SlaConfig: {
        Row: {
          createdAt: string
          escalationRules: Json
          id: string
          priority: Database["public"]["Enums"]["Priority"]
          resolutionTimeHours: number
          responseTimeHours: number
          tenantId: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          escalationRules?: Json
          id: string
          priority: Database["public"]["Enums"]["Priority"]
          resolutionTimeHours: number
          responseTimeHours: number
          tenantId: string
          updatedAt: string
        }
        Update: {
          createdAt?: string
          escalationRules?: Json
          id?: string
          priority?: Database["public"]["Enums"]["Priority"]
          resolutionTimeHours?: number
          responseTimeHours?: number
          tenantId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "SlaConfig_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      suscriptores: {
        Row: {
          fecha_suscripcion: string | null
          id: string
          id_suscriptor: string
          plan: string | null
        }
        Insert: {
          fecha_suscripcion?: string | null
          id?: string
          id_suscriptor: string
          plan?: string | null
        }
        Update: {
          fecha_suscripcion?: string | null
          id?: string
          id_suscriptor?: string
          plan?: string | null
        }
        Relationships: []
      }
      sy_pedidos: {
        Row: {
          categoria: string
          cliente_id: string | null
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["sy_pedido_estado"]
          id: string
          prestador_id: string | null
          responsable_pago: Database["public"]["Enums"]["responsable_pago"]
          updated_at: string
          zona: string
        }
        Insert: {
          categoria: string
          cliente_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["sy_pedido_estado"]
          id?: string
          prestador_id?: string | null
          responsable_pago?: Database["public"]["Enums"]["responsable_pago"]
          updated_at?: string
          zona: string
        }
        Update: {
          categoria?: string
          cliente_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["sy_pedido_estado"]
          id?: string
          prestador_id?: string | null
          responsable_pago?: Database["public"]["Enums"]["responsable_pago"]
          updated_at?: string
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "sy_pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "sy_perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sy_pedidos_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "sy_perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sy_perfiles: {
        Row: {
          antecedentes: string | null
          antecedentes_url: string | null
          antiguedad: number | null
          created_at: string
          dni: string | null
          edad: number | null
          foto_url: string | null
          id: string
          latitud: number | null
          longitud: number | null
          matricula_url: string | null
          nombre: string
          oficios: Json | null
          rol: Database["public"]["Enums"]["sy_user_role"]
          telefono: string | null
          verificado: boolean | null
          zona_frecuente: string | null
        }
        Insert: {
          antecedentes?: string | null
          antecedentes_url?: string | null
          antiguedad?: number | null
          created_at?: string
          dni?: string | null
          edad?: number | null
          foto_url?: string | null
          id: string
          latitud?: number | null
          longitud?: number | null
          matricula_url?: string | null
          nombre: string
          oficios?: Json | null
          rol?: Database["public"]["Enums"]["sy_user_role"]
          telefono?: string | null
          verificado?: boolean | null
          zona_frecuente?: string | null
        }
        Update: {
          antecedentes?: string | null
          antecedentes_url?: string | null
          antiguedad?: number | null
          created_at?: string
          dni?: string | null
          edad?: number | null
          foto_url?: string | null
          id?: string
          latitud?: number | null
          longitud?: number | null
          matricula_url?: string | null
          nombre?: string
          oficios?: Json | null
          rol?: Database["public"]["Enums"]["sy_user_role"]
          telefono?: string | null
          verificado?: boolean | null
          zona_frecuente?: string | null
        }
        Relationships: []
      }
      TaxClient: {
        Row: {
          address: string | null
          city: string | null
          createdAt: string
          cuit: string | null
          dni: string | null
          email: string | null
          fiscalCondition: Database["public"]["Enums"]["ClientFiscalCondition"]
          id: string
          name: string
          notes: string | null
          phone: string | null
          province: string | null
          taxpayerId: string
          updatedAt: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          createdAt?: string
          cuit?: string | null
          dni?: string | null
          email?: string | null
          fiscalCondition: Database["public"]["Enums"]["ClientFiscalCondition"]
          id: string
          name: string
          notes?: string | null
          phone?: string | null
          province?: string | null
          taxpayerId: string
          updatedAt?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          createdAt?: string
          cuit?: string | null
          dni?: string | null
          email?: string | null
          fiscalCondition?: Database["public"]["Enums"]["ClientFiscalCondition"]
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          province?: string | null
          taxpayerId?: string
          updatedAt?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "TaxClient_taxpayerId_fkey"
            columns: ["taxpayerId"]
            isOneToOne: false
            referencedRelation: "Taxpayer"
            referencedColumns: ["id"]
          },
        ]
      }
      Taxpayer: {
        Row: {
          activityCode: string | null
          activityDescription: string | null
          address: string | null
          afipCert: string | null
          afipKey: string | null
          afipSign: string | null
          afipToken: string | null
          afipTokenExpiry: string | null
          brandColor: string | null
          businessName: string
          city: string | null
          createdAt: string
          cuit: string
          defaultCurrency: string
          emailFooter: string | null
          fantasyName: string | null
          fiscalCondition: Database["public"]["Enums"]["FiscalCondition"]
          id: string
          iibbCondition: string | null
          iibbNumber: string | null
          invoicePrefix: string
          logo: string | null
          province: string | null
          updatedAt: string
          userId: string
          whatsappMessage: string | null
        }
        Insert: {
          activityCode?: string | null
          activityDescription?: string | null
          address?: string | null
          afipCert?: string | null
          afipKey?: string | null
          afipSign?: string | null
          afipToken?: string | null
          afipTokenExpiry?: string | null
          brandColor?: string | null
          businessName: string
          city?: string | null
          createdAt?: string
          cuit: string
          defaultCurrency?: string
          emailFooter?: string | null
          fantasyName?: string | null
          fiscalCondition: Database["public"]["Enums"]["FiscalCondition"]
          id: string
          iibbCondition?: string | null
          iibbNumber?: string | null
          invoicePrefix?: string
          logo?: string | null
          province?: string | null
          updatedAt?: string
          userId: string
          whatsappMessage?: string | null
        }
        Update: {
          activityCode?: string | null
          activityDescription?: string | null
          address?: string | null
          afipCert?: string | null
          afipKey?: string | null
          afipSign?: string | null
          afipToken?: string | null
          afipTokenExpiry?: string | null
          brandColor?: string | null
          businessName?: string
          city?: string | null
          createdAt?: string
          cuit?: string
          defaultCurrency?: string
          emailFooter?: string | null
          fantasyName?: string | null
          fiscalCondition?: Database["public"]["Enums"]["FiscalCondition"]
          id?: string
          iibbCondition?: string | null
          iibbNumber?: string | null
          invoicePrefix?: string
          logo?: string | null
          province?: string | null
          updatedAt?: string
          userId?: string
          whatsappMessage?: string | null
        }
        Relationships: []
      }
      Tenant: {
        Row: {
          createdAt: string
          id: string
          logoUrl: string | null
          name: string
          onboardingCompleted: boolean
          plan: Database["public"]["Enums"]["Plan"]
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["TenantStatus"]
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id: string
          logoUrl?: string | null
          name: string
          onboardingCompleted?: boolean
          plan?: Database["public"]["Enums"]["Plan"]
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["TenantStatus"]
          updatedAt: string
        }
        Update: {
          createdAt?: string
          id?: string
          logoUrl?: string | null
          name?: string
          onboardingCompleted?: boolean
          plan?: Database["public"]["Enums"]["Plan"]
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["TenantStatus"]
          updatedAt?: string
        }
        Relationships: []
      }
      Ticket: {
        Row: {
          assetId: string | null
          assigneeId: string | null
          categoryId: string | null
          closedAt: string | null
          createdAt: string
          description: string
          id: string
          number: string
          priority: Database["public"]["Enums"]["Priority"]
          propertyId: string
          providerId: string | null
          requesterId: string
          slaAlertSent: boolean
          slaConfigId: string | null
          slaDueAt: string | null
          source: Database["public"]["Enums"]["TicketSource"]
          status: Database["public"]["Enums"]["TicketStatus"]
          tags: string[] | null
          tenantId: string
          title: string
          tradeId: string | null
          unitId: string | null
          updatedAt: string
        }
        Insert: {
          assetId?: string | null
          assigneeId?: string | null
          categoryId?: string | null
          closedAt?: string | null
          createdAt?: string
          description: string
          id: string
          number: string
          priority?: Database["public"]["Enums"]["Priority"]
          propertyId: string
          providerId?: string | null
          requesterId: string
          slaAlertSent?: boolean
          slaConfigId?: string | null
          slaDueAt?: string | null
          source?: Database["public"]["Enums"]["TicketSource"]
          status?: Database["public"]["Enums"]["TicketStatus"]
          tags?: string[] | null
          tenantId: string
          title: string
          tradeId?: string | null
          unitId?: string | null
          updatedAt: string
        }
        Update: {
          assetId?: string | null
          assigneeId?: string | null
          categoryId?: string | null
          closedAt?: string | null
          createdAt?: string
          description?: string
          id?: string
          number?: string
          priority?: Database["public"]["Enums"]["Priority"]
          propertyId?: string
          providerId?: string | null
          requesterId?: string
          slaAlertSent?: boolean
          slaConfigId?: string | null
          slaDueAt?: string | null
          source?: Database["public"]["Enums"]["TicketSource"]
          status?: Database["public"]["Enums"]["TicketStatus"]
          tags?: string[] | null
          tenantId?: string
          title?: string
          tradeId?: string | null
          unitId?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Ticket_assetId_fkey"
            columns: ["assetId"]
            isOneToOne: false
            referencedRelation: "Asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Ticket_assigneeId_fkey"
            columns: ["assigneeId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Ticket_categoryId_fkey"
            columns: ["categoryId"]
            isOneToOne: false
            referencedRelation: "Category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Ticket_propertyId_fkey"
            columns: ["propertyId"]
            isOneToOne: false
            referencedRelation: "Property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Ticket_providerId_fkey"
            columns: ["providerId"]
            isOneToOne: false
            referencedRelation: "Provider"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Ticket_requesterId_fkey"
            columns: ["requesterId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Ticket_slaConfigId_fkey"
            columns: ["slaConfigId"]
            isOneToOne: false
            referencedRelation: "SlaConfig"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Ticket_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Ticket_tradeId_fkey"
            columns: ["tradeId"]
            isOneToOne: false
            referencedRelation: "Trade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Ticket_unitId_fkey"
            columns: ["unitId"]
            isOneToOne: false
            referencedRelation: "Unit"
            referencedColumns: ["id"]
          },
        ]
      }
      TicketEvent: {
        Row: {
          createdAt: string
          data: Json
          eventType: Database["public"]["Enums"]["EventType"]
          id: string
          ticketId: string
          userId: string | null
          visibility: Database["public"]["Enums"]["Visibility"]
        }
        Insert: {
          createdAt?: string
          data?: Json
          eventType: Database["public"]["Enums"]["EventType"]
          id: string
          ticketId: string
          userId?: string | null
          visibility?: Database["public"]["Enums"]["Visibility"]
        }
        Update: {
          createdAt?: string
          data?: Json
          eventType?: Database["public"]["Enums"]["EventType"]
          id?: string
          ticketId?: string
          userId?: string | null
          visibility?: Database["public"]["Enums"]["Visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "TicketEvent_ticketId_fkey"
            columns: ["ticketId"]
            isOneToOne: false
            referencedRelation: "Ticket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TicketEvent_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      TicketSequence: {
        Row: {
          id: string
          sequence: number
          tenantId: string
          yearMonth: string
        }
        Insert: {
          id: string
          sequence?: number
          tenantId: string
          yearMonth: string
        }
        Update: {
          id?: string
          sequence?: number
          tenantId?: string
          yearMonth?: string
        }
        Relationships: []
      }
      Trade: {
        Row: {
          createdAt: string
          icon: string | null
          id: string
          name: string
          parentId: string | null
          tenantId: string
        }
        Insert: {
          createdAt?: string
          icon?: string | null
          id: string
          name: string
          parentId?: string | null
          tenantId: string
        }
        Update: {
          createdAt?: string
          icon?: string | null
          id?: string
          name?: string
          parentId?: string | null
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Trade_parentId_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "Trade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Trade_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      transactional_notification_outbox: {
        Row: {
          action_params: Json
          action_screen: string | null
          attempts: number
          body: string
          created_at: string
          email_sent_at: string | null
          email_status: string
          event_key: string
          event_type: string
          id: string
          in_app_sent_at: string | null
          in_app_status: string
          last_error: string | null
          metadata: Json
          next_attempt_at: string
          processing_at: string | null
          push_sent_at: string | null
          push_status: string
          scheduled_for: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_params?: Json
          action_screen?: string | null
          attempts?: number
          body: string
          created_at?: string
          email_sent_at?: string | null
          email_status?: string
          event_key: string
          event_type: string
          id?: string
          in_app_sent_at?: string | null
          in_app_status?: string
          last_error?: string | null
          metadata?: Json
          next_attempt_at?: string
          processing_at?: string | null
          push_sent_at?: string | null
          push_status?: string
          scheduled_for?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_params?: Json
          action_screen?: string | null
          attempts?: number
          body?: string
          created_at?: string
          email_sent_at?: string | null
          email_status?: string
          event_key?: string
          event_type?: string
          id?: string
          in_app_sent_at?: string | null
          in_app_status?: string
          last_error?: string | null
          metadata?: Json
          next_attempt_at?: string
          processing_at?: string | null
          push_sent_at?: string | null
          push_status?: string
          scheduled_for?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      Unit: {
        Row: {
          contactEmail: string | null
          contactName: string | null
          contactPhone: string | null
          createdAt: string
          floor: string | null
          id: string
          identifier: string
          propertyId: string
          type: Database["public"]["Enums"]["UnitType"]
          updatedAt: string
        }
        Insert: {
          contactEmail?: string | null
          contactName?: string | null
          contactPhone?: string | null
          createdAt?: string
          floor?: string | null
          id: string
          identifier: string
          propertyId: string
          type: Database["public"]["Enums"]["UnitType"]
          updatedAt: string
        }
        Update: {
          contactEmail?: string | null
          contactName?: string | null
          contactPhone?: string | null
          createdAt?: string
          floor?: string | null
          id?: string
          identifier?: string
          propertyId?: string
          type?: Database["public"]["Enums"]["UnitType"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Unit_propertyId_fkey"
            columns: ["propertyId"]
            isOneToOne: false
            referencedRelation: "Property"
            referencedColumns: ["id"]
          },
        ]
      }
      urgent_work_alerts: {
        Row: {
          assignment_round: number
          attempts_sent: number
          body: string
          category: string | null
          chat_id: string | null
          cliente_id: string | null
          created_at: string
          escalation_ready_at: string | null
          id: string
          last_sent_at: string | null
          metadata: Json
          missed_at: string | null
          next_attempt_at: string
          notificacion_id: string | null
          processing_at: string | null
          reassigned_alert_id: string | null
          reassigned_from_id: string | null
          reassignment_processed_at: string | null
          responded_at: string | null
          response_action: string | null
          response_deadline: string
          root_alert_id: string | null
          servicio_id: string | null
          source: string
          status: string
          title: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          assignment_round?: number
          attempts_sent?: number
          body: string
          category?: string | null
          chat_id?: string | null
          cliente_id?: string | null
          created_at?: string
          escalation_ready_at?: string | null
          id?: string
          last_sent_at?: string | null
          metadata?: Json
          missed_at?: string | null
          next_attempt_at?: string
          notificacion_id?: string | null
          processing_at?: string | null
          reassigned_alert_id?: string | null
          reassigned_from_id?: string | null
          reassignment_processed_at?: string | null
          responded_at?: string | null
          response_action?: string | null
          response_deadline?: string
          root_alert_id?: string | null
          servicio_id?: string | null
          source: string
          status?: string
          title?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          assignment_round?: number
          attempts_sent?: number
          body?: string
          category?: string | null
          chat_id?: string | null
          cliente_id?: string | null
          created_at?: string
          escalation_ready_at?: string | null
          id?: string
          last_sent_at?: string | null
          metadata?: Json
          missed_at?: string | null
          next_attempt_at?: string
          notificacion_id?: string | null
          processing_at?: string | null
          reassigned_alert_id?: string | null
          reassigned_from_id?: string | null
          reassignment_processed_at?: string | null
          responded_at?: string | null
          response_action?: string | null
          response_deadline?: string
          root_alert_id?: string | null
          servicio_id?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "urgent_work_alerts_reassigned_alert_id_fkey"
            columns: ["reassigned_alert_id"]
            isOneToOne: false
            referencedRelation: "urgent_work_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "urgent_work_alerts_reassigned_from_id_fkey"
            columns: ["reassigned_from_id"]
            isOneToOne: false
            referencedRelation: "urgent_work_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "urgent_work_alerts_root_alert_id_fkey"
            columns: ["root_alert_id"]
            isOneToOne: false
            referencedRelation: "urgent_work_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      urgent_work_misses: {
        Row: {
          alert_id: string
          assignment_round: number
          enforcement_applied: boolean
          id: string
          metadata: Json
          occurred_at: string
          response_deadline: string
          worker_id: string
        }
        Insert: {
          alert_id: string
          assignment_round: number
          enforcement_applied?: boolean
          id?: string
          metadata?: Json
          occurred_at?: string
          response_deadline: string
          worker_id: string
        }
        Update: {
          alert_id?: string
          assignment_round?: number
          enforcement_applied?: boolean
          id?: string
          metadata?: Json
          occurred_at?: string
          response_deadline?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "urgent_work_misses_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: true
            referencedRelation: "urgent_work_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      urgent_work_policy: {
        Row: {
          enforcement_enabled: boolean
          max_reassignments: number
          missed_threshold: number
          priority_suspension_days: number
          reminder_minutes: number
          singleton: boolean
          sla_minutes: number
          updated_at: string
          updated_by: string | null
          window_days: number
        }
        Insert: {
          enforcement_enabled?: boolean
          max_reassignments?: number
          missed_threshold?: number
          priority_suspension_days?: number
          reminder_minutes?: number
          singleton?: boolean
          sla_minutes?: number
          updated_at?: string
          updated_by?: string | null
          window_days?: number
        }
        Update: {
          enforcement_enabled?: boolean
          max_reassignments?: number
          missed_threshold?: number
          priority_suspension_days?: number
          reminder_minutes?: number
          singleton?: boolean
          sla_minutes?: number
          updated_at?: string
          updated_by?: string | null
          window_days?: number
        }
        Relationships: []
      }
      urgent_work_policy_audit: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_policy: Json
          previous_policy: Json
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_policy: Json
          previous_policy: Json
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_policy?: Json
          previous_policy?: Json
        }
        Relationships: []
      }
      User: {
        Row: {
          avatarUrl: string | null
          createdAt: string
          email: string
          id: string
          lastLogin: string | null
          name: string
          notificationPrefs: Json
          passwordHash: string | null
          phone: string | null
          role: Database["public"]["Enums"]["UserRole"]
          status: Database["public"]["Enums"]["UserStatus"]
          supabaseAuthId: string | null
          tenantId: string
          unitId: string | null
          updatedAt: string
        }
        Insert: {
          avatarUrl?: string | null
          createdAt?: string
          email: string
          id: string
          lastLogin?: string | null
          name: string
          notificationPrefs?: Json
          passwordHash?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["UserRole"]
          status?: Database["public"]["Enums"]["UserStatus"]
          supabaseAuthId?: string | null
          tenantId: string
          unitId?: string | null
          updatedAt: string
        }
        Update: {
          avatarUrl?: string | null
          createdAt?: string
          email?: string
          id?: string
          lastLogin?: string | null
          name?: string
          notificationPrefs?: Json
          passwordHash?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["UserRole"]
          status?: Database["public"]["Enums"]["UserStatus"]
          supabaseAuthId?: string | null
          tenantId?: string
          unitId?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "User_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "User_unitId_fkey"
            columns: ["unitId"]
            isOneToOne: false
            referencedRelation: "Unit"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_key: string
          completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_legal_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          document_set: string
          id: string
          privacy_version: string
          source: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          document_set: string
          id?: string
          privacy_version: string
          source: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          document_set?: string
          id?: string
          privacy_version?: string
          source?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reminder_logs: {
        Row: {
          payload: Json | null
          reminder_number: number
          sent_at: string
          user_id: string
        }
        Insert: {
          payload?: Json | null
          reminder_number: number
          sent_at?: string
          user_id: string
        }
        Update: {
          payload?: Json | null
          reminder_number?: number
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          actualizado_en: string | null
          antecedentes: Json | null
          antecedentes_url: string | null
          antiguedad: number | null
          apellido: string | null
          barrio: string | null
          calle: string | null
          categoria: string[] | null
          celular: number | null
          ci: string | null
          ciudad: string | null
          codigo: string | null
          codigo_postal: string | null
          comentarios: Json | null
          creado_en: string | null
          created_at: string | null
          creditos: number | null
          descripcion: string | null
          dni: string | null
          dni_dorso: string | null
          dni_frente: string | null
          dni_verificado: boolean
          domicilio: string | null
          edad: number | null
          email: string
          experiencia: string | null
          experiencia_academica: string | null
          expo_token: string | null
          fecha_nacimiento: string | null
          foto_dni_perfil: string | null
          foto_perfil: string | null
          horarios: string | null
          huella_digital: boolean | null
          id: string
          matricula: Json | null
          matricula_url: string | null
          nombre: string | null
          pago: boolean | null
          panel_chat: Json | null
          perfil_completo: boolean
          perfilPublico: boolean
          precio: string | null
          provincia: string | null
          ranking: Json | null
          referencias: string | null
          referral_code: string | null
          referred_by: string | null
          registropagado: boolean | null
          rol: Database["public"]["Enums"]["user_role"]
          selfie: string | null
          sexo: string | null
          suscripcion_activa_hasta: string | null
          suscriptor: boolean | null
          usuario_id: string
          verificado: boolean | null
        }
        Insert: {
          actualizado_en?: string | null
          antecedentes?: Json | null
          antecedentes_url?: string | null
          antiguedad?: number | null
          apellido?: string | null
          barrio?: string | null
          calle?: string | null
          categoria?: string[] | null
          celular?: number | null
          ci?: string | null
          ciudad?: string | null
          codigo?: string | null
          codigo_postal?: string | null
          comentarios?: Json | null
          creado_en?: string | null
          created_at?: string | null
          creditos?: number | null
          descripcion?: string | null
          dni?: string | null
          dni_dorso?: string | null
          dni_frente?: string | null
          dni_verificado?: boolean
          domicilio?: string | null
          edad?: number | null
          email: string
          experiencia?: string | null
          experiencia_academica?: string | null
          expo_token?: string | null
          fecha_nacimiento?: string | null
          foto_dni_perfil?: string | null
          foto_perfil?: string | null
          horarios?: string | null
          huella_digital?: boolean | null
          id?: string
          matricula?: Json | null
          matricula_url?: string | null
          nombre?: string | null
          pago?: boolean | null
          panel_chat?: Json | null
          perfil_completo?: boolean
          perfilPublico?: boolean
          precio?: string | null
          provincia?: string | null
          ranking?: Json | null
          referencias?: string | null
          referral_code?: string | null
          referred_by?: string | null
          registropagado?: boolean | null
          rol?: Database["public"]["Enums"]["user_role"]
          selfie?: string | null
          sexo?: string | null
          suscripcion_activa_hasta?: string | null
          suscriptor?: boolean | null
          usuario_id?: string
          verificado?: boolean | null
        }
        Update: {
          actualizado_en?: string | null
          antecedentes?: Json | null
          antecedentes_url?: string | null
          antiguedad?: number | null
          apellido?: string | null
          barrio?: string | null
          calle?: string | null
          categoria?: string[] | null
          celular?: number | null
          ci?: string | null
          ciudad?: string | null
          codigo?: string | null
          codigo_postal?: string | null
          comentarios?: Json | null
          creado_en?: string | null
          created_at?: string | null
          creditos?: number | null
          descripcion?: string | null
          dni?: string | null
          dni_dorso?: string | null
          dni_frente?: string | null
          dni_verificado?: boolean
          domicilio?: string | null
          edad?: number | null
          email?: string
          experiencia?: string | null
          experiencia_academica?: string | null
          expo_token?: string | null
          fecha_nacimiento?: string | null
          foto_dni_perfil?: string | null
          foto_perfil?: string | null
          horarios?: string | null
          huella_digital?: boolean | null
          id?: string
          matricula?: Json | null
          matricula_url?: string | null
          nombre?: string | null
          pago?: boolean | null
          panel_chat?: Json | null
          perfil_completo?: boolean
          perfilPublico?: boolean
          precio?: string | null
          provincia?: string | null
          ranking?: Json | null
          referencias?: string | null
          referral_code?: string | null
          referred_by?: string | null
          registropagado?: boolean | null
          rol?: Database["public"]["Enums"]["user_role"]
          selfie?: string | null
          sexo?: string | null
          suscripcion_activa_hasta?: string | null
          suscriptor?: boolean | null
          usuario_id?: string
          verificado?: boolean | null
        }
        Relationships: []
      }
      Visit: {
        Row: {
          checkinAt: string | null
          checkinLat: number | null
          checkinLng: number | null
          checkoutAt: string | null
          createdAt: string
          id: string
          notes: string | null
          providerId: string
          rescheduleReason: string | null
          scheduledAt: string
          status: Database["public"]["Enums"]["VisitStatus"]
          ticketId: string
          updatedAt: string
          windowEnd: string | null
          windowStart: string | null
        }
        Insert: {
          checkinAt?: string | null
          checkinLat?: number | null
          checkinLng?: number | null
          checkoutAt?: string | null
          createdAt?: string
          id: string
          notes?: string | null
          providerId: string
          rescheduleReason?: string | null
          scheduledAt: string
          status?: Database["public"]["Enums"]["VisitStatus"]
          ticketId: string
          updatedAt: string
          windowEnd?: string | null
          windowStart?: string | null
        }
        Update: {
          checkinAt?: string | null
          checkinLat?: number | null
          checkinLng?: number | null
          checkoutAt?: string | null
          createdAt?: string
          id?: string
          notes?: string | null
          providerId?: string
          rescheduleReason?: string | null
          scheduledAt?: string
          status?: Database["public"]["Enums"]["VisitStatus"]
          ticketId?: string
          updatedAt?: string
          windowEnd?: string | null
          windowStart?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Visit_providerId_fkey"
            columns: ["providerId"]
            isOneToOne: false
            referencedRelation: "Provider"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Visit_ticketId_fkey"
            columns: ["ticketId"]
            isOneToOne: false
            referencedRelation: "Ticket"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_urgent_discipline: {
        Row: {
          last_missed_at: string | null
          priority_suspended_until: string | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          last_missed_at?: string | null
          priority_suspended_until?: string | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          last_missed_at?: string | null
          priority_suspended_until?: string | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          availability_duration_hours: number | null
          available_until: string | null
          last_seen_at: string | null
          location: unknown
          status: Database["public"]["Enums"]["worker_status"]
          user_id: string
        }
        Insert: {
          availability_duration_hours?: number | null
          available_until?: string | null
          last_seen_at?: string | null
          location?: unknown
          status?: Database["public"]["Enums"]["worker_status"]
          user_id: string
        }
        Update: {
          availability_duration_hours?: number | null
          available_until?: string | null
          last_seen_at?: string | null
          location?: unknown
          status?: Database["public"]["Enums"]["worker_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      client_trust_summary: {
        Row: {
          average_rating: number | null
          client_id: string | null
          completed_reviews: number | null
        }
        Relationships: []
      }
      provider_trust_summary: {
        Row: {
          average_rating: number | null
          average_response_minutes: number | null
          completed_jobs: number | null
          provider_id: string | null
          response_sample_size: number | null
          review_count: number | null
        }
        Relationships: []
      }
      servicios_with_coords: {
        Row: {
          aceptado: boolean | null
          barrio: string | null
          calificacion_promedio: number | null
          categoria: string | null
          categoria_id: string | null
          ciudad: string | null
          country: string | null
          descripcion: string | null
          estado: string | null
          foto_perfil: string | null
          horario: string | null
          id: number | null
          latitud: number | null
          latitude: number | null
          location: unknown
          longitud: number | null
          longitude: number | null
          postal_code: string | null
          precio: number | null
          titulo: string | null
          user_id: string | null
          usuario_id: string | null
          veces_contratado: number | null
        }
        Insert: {
          aceptado?: boolean | null
          barrio?: string | null
          calificacion_promedio?: number | null
          categoria?: string | null
          categoria_id?: string | null
          ciudad?: string | null
          country?: string | null
          descripcion?: string | null
          estado?: string | null
          foto_perfil?: string | null
          horario?: string | null
          id?: number | null
          latitud?: number | null
          latitude?: never
          location?: unknown
          longitud?: number | null
          longitude?: never
          postal_code?: string | null
          precio?: number | null
          titulo?: string | null
          user_id?: string | null
          usuario_id?: string | null
          veces_contratado?: number | null
        }
        Update: {
          aceptado?: boolean | null
          barrio?: string | null
          calificacion_promedio?: number | null
          categoria?: string | null
          categoria_id?: string | null
          ciudad?: string | null
          country?: string | null
          descripcion?: string | null
          estado?: string | null
          foto_perfil?: string | null
          horario?: string | null
          id?: number | null
          latitud?: number | null
          latitude?: never
          location?: unknown
          longitud?: number | null
          longitude?: never
          postal_code?: string | null
          precio?: number | null
          titulo?: string | null
          user_id?: string | null
          usuario_id?: string | null
          veces_contratado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_servicios_categoria"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_usuario_id"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_current_legal_documents: {
        Args: {
          p_document_set: string
          p_privacy_version: string
          p_source: string
          p_terms_version: string
        }
        Returns: Json
      }
      award_referred_achievement: {
        Args: { referral_code_input: string }
        Returns: Json
      }
      cancel_service_request: { Args: { p_oferta_id: string }; Returns: Json }
      check_hirer_achievements: { Args: never; Returns: Json }
      claim_due_urgent_work_alerts: {
        Args: { p_limit?: number }
        Returns: {
          assignment_round: number
          attempts_sent: number
          body: string
          category: string | null
          chat_id: string | null
          cliente_id: string | null
          created_at: string
          escalation_ready_at: string | null
          id: string
          last_sent_at: string | null
          metadata: Json
          missed_at: string | null
          next_attempt_at: string
          notificacion_id: string | null
          processing_at: string | null
          reassigned_alert_id: string | null
          reassigned_from_id: string | null
          reassignment_processed_at: string | null
          responded_at: string | null
          response_action: string | null
          response_deadline: string
          root_alert_id: string | null
          servicio_id: string | null
          source: string
          status: string
          title: string
          updated_at: string
          worker_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "urgent_work_alerts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_transactional_notifications: {
        Args: { p_limit?: number }
        Returns: {
          action_params: Json
          action_screen: string | null
          attempts: number
          body: string
          created_at: string
          email_sent_at: string | null
          email_status: string
          event_key: string
          event_type: string
          id: string
          in_app_sent_at: string | null
          in_app_status: string
          last_error: string | null
          metadata: Json
          next_attempt_at: string
          processing_at: string | null
          push_sent_at: string | null
          push_status: string
          scheduled_for: string
          title: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactional_notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      count_active_by_category: {
        Args: never
        Returns: {
          categoria: string
          count: number
        }[]
      }
      count_services_by_status_in_radius:
        | {
            Args: {
              p_categoria?: string
              search_lat?: number
              search_lon?: number
              search_radius_meters?: number
              status_filter?: string
              worker_status_filter?: string[]
            }
            Returns: {
              categoria: string
              count: number
            }[]
          }
        | {
            Args: {
              search_lat: number
              search_lon: number
              search_radius_meters: number
              status_filter?: string
            }
            Returns: {
              categoria: string
              count: number
            }[]
          }
      create_manual_service_request: {
        Args: {
          p_cantidad_personas?: number
          p_categoria: string
          p_ciudad?: string
          p_descripcion: string
          p_modalidad_preferida?: string
          p_provincia?: string
          p_responsable_herramientas?: string
          p_urgencia?: string
          p_zona: string
        }
        Returns: {
          oferta_id: string
          ok: boolean
        }[]
      }
      create_mica_app_request: {
        Args: {
          p_categoria: string
          p_ciudad?: string
          p_cliente_telefono?: string
          p_descripcion: string
          p_historial?: Json
          p_metadata?: Json
          p_nombre_cliente?: string
          p_provincia?: string
          p_zona: string
        }
        Returns: {
          oferta_id: string
          ok: boolean
        }[]
      }
      create_urgent_work_alert: {
        Args: {
          p_body?: string
          p_category?: string
          p_chat_id?: string
          p_metadata?: Json
          p_servicio_id?: string
          p_source: string
          p_title?: string
          p_worker_id: string
        }
        Returns: Json
      }
      delete_user: { Args: { uid: string }; Returns: undefined }
      enqueue_transactional_notification: {
        Args: {
          p_action_params?: Json
          p_action_screen?: string
          p_body: string
          p_event_key: string
          p_event_type: string
          p_metadata?: Json
          p_scheduled_for?: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      get_chat_job_status: { Args: { p_chat_id: string }; Returns: Json }
      get_chat_schedule: { Args: { p_chat_id: string }; Returns: Json }
      get_inactive_users_for_reminders: {
        Args: { p_page_number?: number; p_page_size?: number }
        Returns: {
          days_inactive: number
          expo_token: string
          reminder_number: number
          user_id: string
        }[]
      }
      get_marketing_candidate_users:
        | {
            Args: { limit_count: number }
            Returns: {
              actualizado_en: string | null
              antecedentes: Json | null
              antecedentes_url: string | null
              antiguedad: number | null
              apellido: string | null
              barrio: string | null
              calle: string | null
              categoria: string[] | null
              celular: number | null
              ci: string | null
              ciudad: string | null
              codigo: string | null
              codigo_postal: string | null
              comentarios: Json | null
              creado_en: string | null
              created_at: string | null
              creditos: number | null
              descripcion: string | null
              dni: string | null
              dni_dorso: string | null
              dni_frente: string | null
              dni_verificado: boolean
              domicilio: string | null
              edad: number | null
              email: string
              experiencia: string | null
              experiencia_academica: string | null
              expo_token: string | null
              fecha_nacimiento: string | null
              foto_dni_perfil: string | null
              foto_perfil: string | null
              horarios: string | null
              huella_digital: boolean | null
              id: string
              matricula: Json | null
              matricula_url: string | null
              nombre: string | null
              pago: boolean | null
              panel_chat: Json | null
              perfil_completo: boolean
              perfilPublico: boolean
              precio: string | null
              provincia: string | null
              ranking: Json | null
              referencias: string | null
              referral_code: string | null
              referred_by: string | null
              registropagado: boolean | null
              rol: Database["public"]["Enums"]["user_role"]
              selfie: string | null
              sexo: string | null
              suscripcion_activa_hasta: string | null
              suscriptor: boolean | null
              usuario_id: string
              verificado: boolean | null
            }[]
            SetofOptions: {
              from: "*"
              to: "usuarios"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: { days_ago?: number; limit_count: number }
            Returns: {
              actualizado_en: string | null
              antecedentes: Json | null
              antecedentes_url: string | null
              antiguedad: number | null
              apellido: string | null
              barrio: string | null
              calle: string | null
              categoria: string[] | null
              celular: number | null
              ci: string | null
              ciudad: string | null
              codigo: string | null
              codigo_postal: string | null
              comentarios: Json | null
              creado_en: string | null
              created_at: string | null
              creditos: number | null
              descripcion: string | null
              dni: string | null
              dni_dorso: string | null
              dni_frente: string | null
              dni_verificado: boolean
              domicilio: string | null
              edad: number | null
              email: string
              experiencia: string | null
              experiencia_academica: string | null
              expo_token: string | null
              fecha_nacimiento: string | null
              foto_dni_perfil: string | null
              foto_perfil: string | null
              horarios: string | null
              huella_digital: boolean | null
              id: string
              matricula: Json | null
              matricula_url: string | null
              nombre: string | null
              pago: boolean | null
              panel_chat: Json | null
              perfil_completo: boolean
              perfilPublico: boolean
              precio: string | null
              provincia: string | null
              ranking: Json | null
              referencias: string | null
              referral_code: string | null
              referred_by: string | null
              registropagado: boolean | null
              rol: Database["public"]["Enums"]["user_role"]
              selfie: string | null
              sexo: string | null
              suscripcion_activa_hasta: string | null
              suscriptor: boolean | null
              usuario_id: string
              verificado: boolean | null
            }[]
            SetofOptions: {
              from: "*"
              to: "usuarios"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      get_mica_app_requests_for_worker: {
        Args: {
          p_app_user_id: string
          p_ciudad?: string
          p_limit?: number
          p_oficios: string[]
          p_provincia?: string
        }
        Returns: {
          categoria: string
          created_at: string
          descripcion: string
          estado: string
          id: string
          media_url: string
          metadata: Json
          paso: number
          presupuesto_estimado: number
          source: string
          video_urls: string
          ya_respondio: boolean
          zona: string
        }[]
      }
      get_my_service_jobs: {
        Args: { p_limit?: number }
        Returns: {
          amount_total: number
          can_close: boolean
          chat_id: string
          counterpart_avatar: string
          counterpart_id: string
          counterpart_name: string
          created_at: string
          description: string
          incident_case_number: string
          incident_id: string
          incident_status: string
          is_payer: boolean
          is_provider: boolean
          job_status: string
          payer_id: string
          payment_record_id: string
          pricing_mode: string
          provider_id: string
          requires_action: boolean
          review_rating: number
          schedule_proposed_by: string
          schedule_round: number
          schedule_status: string
          scheduled_end: string
          scheduled_start: string
          title: string
        }[]
      }
      get_my_service_requests: {
        Args: { p_limit?: number }
        Returns: {
          categoria: string
          chat_id: string
          created_at: string
          descripcion: string
          estado: string
          id: string
          metadata: Json
          paso: number
          response_count: number
          selected_budget_id: string
          source: string
          zona: string
        }[]
      }
      get_provider_contact_access: {
        Args: {
          p_ciudad?: string
          p_cliente_id?: string
          p_oferta_id?: string
          p_presupuesto_id?: number
          p_provincia?: string
          p_trabajador_id?: string
        }
        Returns: {
          can_view: boolean
          reason: string
          requires_payment: boolean
          unlock_id: string
        }[]
      }
      get_services_by_category_in_radius: {
        Args: {
          categoria_filter?: string
          limit_val?: number
          offset_val?: number
          search_lat: number
          search_lon: number
          search_radius_meters: number
          status_filter?: string
        }
        Returns: {
          aceptado: boolean | null
          barrio: string | null
          calificacion_promedio: number | null
          categoria: string | null
          categoria_id: string | null
          ciudad: string | null
          country: string | null
          descripcion: string | null
          estado: string | null
          foto_perfil: string | null
          horario: string | null
          id: number
          latitud: number | null
          location: unknown
          longitud: number | null
          postal_code: string | null
          precio: number | null
          titulo: string
          user_id: string | null
          usuario_id: string | null
          veces_contratado: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "servicios"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_servicios_with_online_workers:
        | {
            Args: never
            Returns: {
              aceptado: boolean | null
              barrio: string | null
              calificacion_promedio: number | null
              categoria: string | null
              categoria_id: string | null
              ciudad: string | null
              country: string | null
              descripcion: string | null
              estado: string | null
              foto_perfil: string | null
              horario: string | null
              id: number
              latitud: number | null
              location: unknown
              longitud: number | null
              postal_code: string | null
              precio: number | null
              titulo: string
              user_id: string | null
              usuario_id: string | null
              veces_contratado: number | null
            }[]
            SetofOptions: {
              from: "*"
              to: "servicios"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              search_lat?: number
              search_lon?: number
              search_radius_meters?: number
            }
            Returns: {
              aceptado: boolean | null
              barrio: string | null
              calificacion_promedio: number | null
              categoria: string | null
              categoria_id: string | null
              ciudad: string | null
              country: string | null
              descripcion: string | null
              estado: string | null
              foto_perfil: string | null
              horario: string | null
              id: number
              latitud: number | null
              location: unknown
              longitud: number | null
              postal_code: string | null
              precio: number | null
              titulo: string
              user_id: string | null
              usuario_id: string | null
              veces_contratado: number | null
            }[]
            SetofOptions: {
              from: "*"
              to: "servicios"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      get_servicios_with_worker_status: {
        Args: {
          p_categoria?: string
          search_lat?: number
          search_lon?: number
          search_radius_meters?: number
        }
        Returns: {
          aceptado: boolean
          barrio: string
          calificacion_promedio: number
          categoria: string
          categoria_id: string
          ciudad: string
          country: string
          descripcion: string
          estado: string
          foto_perfil: string
          horario: string
          id: number
          latitud: number
          location: unknown
          longitud: number
          postal_code: string
          precio: number
          titulo: string
          user_id: string
          usuario_id: string
          veces_contratado: number
          worker_status: Database["public"]["Enums"]["worker_status"]
        }[]
      }
      incrementar_veces_contratado: {
        Args: { servicio_id_input: string }
        Returns: undefined
      }
      is_operational_admin: { Args: never; Returns: boolean }
      mark_presupuesto_contact_unlocked: {
        Args: {
          p_amount_total?: number
          p_chat_id?: string
          p_cliente_id: string
          p_commission_amount?: number
          p_metadata?: Json
          p_oferta_id?: string
          p_payment_id?: string
          p_payment_provider?: string
          p_presupuesto_id: number
          p_trabajador_id: string
        }
        Returns: string
      }
      propose_service_schedule: {
        Args: { p_payment_record_id: string; p_reason?: string; p_slots: Json }
        Returns: Json
      }
      report_service_job_incident: {
        Args: {
          p_category: string
          p_details?: string
          p_payment_record_id: string
        }
        Returns: Json
      }
      respond_to_urgent_work_alert: {
        Args: { p_alert_id: string; p_response: string }
        Returns: Json
      }
      safe_quote_scope: { Args: { p_content: string }; Returns: string }
      select_service_schedule_slot: {
        Args: { p_proposal_id: string; p_slot_id: string }
        Returns: Json
      }
      set_stale_workers_offline: { Args: never; Returns: undefined }
      set_urgent_work_policy: {
        Args: {
          p_enforcement_enabled: boolean
          p_max_reassignments: number
          p_missed_threshold: number
          p_priority_suspension_days: number
          p_updated_by: string
          p_window_days: number
        }
        Returns: Json
      }
      submit_client_job_review: {
        Args: {
          p_comment?: string
          p_payment_record_id: string
          p_rating: number
        }
        Returns: Json
      }
      submit_consumer_right_request: {
        Args: {
          p_details?: string
          p_email: string
          p_operation_reference?: string
          p_request_type: string
        }
        Returns: Json
      }
      submit_service_incident_intake: {
        Args: {
          p_category: string
          p_intake: Json
          p_payment_record_id: string
        }
        Returns: Json
      }
      submit_service_job_review: {
        Args: {
          p_comment?: string
          p_payment_record_id: string
          p_rating: number
        }
        Returns: Json
      }
      test_get_servicios_with_worker_status: {
        Args: {
          p_categoria?: string
          search_lat?: number
          search_lon?: number
          search_radius_meters?: number
        }
        Returns: {
          aceptado: boolean
          apellido: string
          barrio: string
          calificacion_promedio: number
          categoria: string
          categoria_id: string
          ciudad: string
          country: string
          descripcion: string
          estado: string
          foto_perfil: string
          horario: string
          id: number
          latitud: number
          location: unknown
          longitud: number
          nombre: string
          postal_code: string
          precio: number
          titulo: string
          user_foto_perfil: string
          user_id: string
          usuario_id: string
          veces_contratado: number
          worker_status: Database["public"]["Enums"]["worker_status"]
        }[]
      }
      track_marketplace_event: {
        Args: { p_context?: Json; p_event_name: string }
        Returns: number
      }
      verify_marketplace_cron_secret: {
        Args: { p_secret: string }
        Returns: boolean
      }
    }
    Enums: {
      AgentRole: "USER" | "ASSISTANT" | "TOOL"
      AgentTone: "AMIGABLE" | "PROFESIONAL" | "FIRME" | "FORMAL"
      AssetStatus:
        | "ACTIVE"
        | "INACTIVE"
        | "UNDER_MAINTENANCE"
        | "DECOMMISSIONED"
      AttachmentCategory:
        | "BEFORE"
        | "AFTER"
        | "QUOTE_DOC"
        | "DOCUMENT"
        | "EVIDENCE"
        | "OTHER"
      CampaignStatus:
        | "DRAFT"
        | "SCHEDULED"
        | "EXECUTING"
        | "COMPLETED"
        | "CANCELLED"
      ClientFiscalCondition:
        | "RESPONSABLE_INSCRIPTO"
        | "MONOTRIBUTO"
        | "CONSUMIDOR_FINAL"
        | "EXENTO"
      ConversationStatus: "ACTIVE" | "RESOLVED" | "ESCALATED" | "CLOSED"
      DebtStatus:
        | "PENDING"
        | "DUE"
        | "OVERDUE"
        | "PAID"
        | "PARTIAL"
        | "WRITTEN_OFF"
        | "CANCELLED"
      EventType:
        | "STATUS_CHANGE"
        | "MESSAGE"
        | "FILE_UPLOAD"
        | "QUOTE_SENT"
        | "QUOTE_APPROVED"
        | "QUOTE_REJECTED"
        | "VISIT_SCHEDULED"
        | "VISIT_CONFIRMED"
        | "VISIT_RESCHEDULED"
        | "VISIT_CANCELLED"
        | "CHECKIN"
        | "CHECKOUT"
        | "EVIDENCE_UPLOADED"
        | "ASSIGNMENT"
        | "PRIORITY_CHANGE"
        | "SLA_ALERT"
        | "NOTE"
        | "SYSTEM"
      FiscalCondition: "RESPONSABLE_INSCRIPTO" | "MONOTRIBUTO" | "EXENTO"
      InvoiceStatus:
        | "DRAFT"
        | "PENDING_CAE"
        | "AUTHORIZED"
        | "REJECTED"
        | "CANCELLED"
      InvoiceType:
        | "A"
        | "B"
        | "C"
        | "NOTA_CREDITO_A"
        | "NOTA_CREDITO_B"
        | "NOTA_CREDITO_C"
        | "NOTA_DEBITO_A"
        | "NOTA_DEBITO_B"
        | "NOTA_DEBITO_C"
        | "RECIBO_X"
      MessageStatus:
        | "PENDING"
        | "SENT"
        | "DELIVERED"
        | "READ"
        | "FAILED"
        | "BOUNCED"
      NotificationChannel: "PUSH" | "EMAIL" | "WHATSAPP" | "IN_APP"
      NotificationStatus: "PENDING" | "SENT" | "FAILED" | "READ"
      PaidStatus: "UNPAID" | "PARTIAL" | "PAID"
      PaymentMethod: "MERCADOPAGO" | "TRANSFER" | "CASH" | "DEBIT" | "OTHER"
      PaymentStatus: "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED"
      Plan: "FREE" | "STARTER" | "PRO" | "ENTERPRISE"
      PlanType: "STARTER" | "GROWTH" | "SCALE"
      Priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
      PropertyType: "BUILDING" | "HOUSE" | "COMPLEX" | "OFFICE" | "COMMERCIAL"
      ProviderStatus: "ACTIVE" | "INACTIVE" | "PENDING" | "SUSPENDED"
      QuoteStatus: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"
      responsable_pago:
        | "INQUILINO"
        | "PROPIETARIO"
        | "INMOBILIARIA"
        | "A_DEFINIR"
        | "COMPARTIDO"
      StepChannel: "WHATSAPP" | "EMAIL" | "SMS"
      sy_pedido_estado: "pendiente" | "en_proceso" | "completado" | "cancelado"
      sy_user_role: "cliente" | "prestador" | "admin"
      TenantStatus: "ACTIVE" | "SUSPENDED" | "TRIAL"
      TicketSource: "WEB" | "APP" | "WHATSAPP" | "EMAIL" | "MANUAL"
      TicketStatus:
        | "NEW"
        | "RECEIVED"
        | "IN_REVIEW"
        | "ASSIGNED"
        | "AWAITING_QUOTE"
        | "QUOTE_RECEIVED"
        | "PENDING_APPROVAL"
        | "APPROVED"
        | "SCHEDULING_VISIT"
        | "IN_PROGRESS"
        | "PAUSED"
        | "COMPLETED"
        | "VALIDATED"
        | "CLOSED"
        | "CANCELLED"
      UnitType:
        | "APARTMENT"
        | "LOCAL"
        | "COMMON_AREA"
        | "PARKING"
        | "STORAGE"
        | "OFFICE"
      user_role: "admin" | "worker" | "user" | "guest"
      UserRole:
        | "SUPER_ADMIN"
        | "ADMIN"
        | "OPERATOR"
        | "SUPERVISOR"
        | "REQUESTER"
        | "PROVIDER_USER"
        | "AUDITOR"
      UserStatus: "ACTIVE" | "INACTIVE" | "PENDING"
      Visibility: "INTERNAL" | "PROVIDER" | "CLIENT" | "ALL"
      VisitStatus:
        | "SCHEDULED"
        | "CONFIRMED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
        | "RESCHEDULED"
      worker_status: "OFFLINE" | "ONLINE" | "BUSY" | "ON_BREAK"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      AgentRole: ["USER", "ASSISTANT", "TOOL"],
      AgentTone: ["AMIGABLE", "PROFESIONAL", "FIRME", "FORMAL"],
      AssetStatus: [
        "ACTIVE",
        "INACTIVE",
        "UNDER_MAINTENANCE",
        "DECOMMISSIONED",
      ],
      AttachmentCategory: [
        "BEFORE",
        "AFTER",
        "QUOTE_DOC",
        "DOCUMENT",
        "EVIDENCE",
        "OTHER",
      ],
      CampaignStatus: [
        "DRAFT",
        "SCHEDULED",
        "EXECUTING",
        "COMPLETED",
        "CANCELLED",
      ],
      ClientFiscalCondition: [
        "RESPONSABLE_INSCRIPTO",
        "MONOTRIBUTO",
        "CONSUMIDOR_FINAL",
        "EXENTO",
      ],
      ConversationStatus: ["ACTIVE", "RESOLVED", "ESCALATED", "CLOSED"],
      DebtStatus: [
        "PENDING",
        "DUE",
        "OVERDUE",
        "PAID",
        "PARTIAL",
        "WRITTEN_OFF",
        "CANCELLED",
      ],
      EventType: [
        "STATUS_CHANGE",
        "MESSAGE",
        "FILE_UPLOAD",
        "QUOTE_SENT",
        "QUOTE_APPROVED",
        "QUOTE_REJECTED",
        "VISIT_SCHEDULED",
        "VISIT_CONFIRMED",
        "VISIT_RESCHEDULED",
        "VISIT_CANCELLED",
        "CHECKIN",
        "CHECKOUT",
        "EVIDENCE_UPLOADED",
        "ASSIGNMENT",
        "PRIORITY_CHANGE",
        "SLA_ALERT",
        "NOTE",
        "SYSTEM",
      ],
      FiscalCondition: ["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO"],
      InvoiceStatus: [
        "DRAFT",
        "PENDING_CAE",
        "AUTHORIZED",
        "REJECTED",
        "CANCELLED",
      ],
      InvoiceType: [
        "A",
        "B",
        "C",
        "NOTA_CREDITO_A",
        "NOTA_CREDITO_B",
        "NOTA_CREDITO_C",
        "NOTA_DEBITO_A",
        "NOTA_DEBITO_B",
        "NOTA_DEBITO_C",
        "RECIBO_X",
      ],
      MessageStatus: [
        "PENDING",
        "SENT",
        "DELIVERED",
        "READ",
        "FAILED",
        "BOUNCED",
      ],
      NotificationChannel: ["PUSH", "EMAIL", "WHATSAPP", "IN_APP"],
      NotificationStatus: ["PENDING", "SENT", "FAILED", "READ"],
      PaidStatus: ["UNPAID", "PARTIAL", "PAID"],
      PaymentMethod: ["MERCADOPAGO", "TRANSFER", "CASH", "DEBIT", "OTHER"],
      PaymentStatus: ["PENDING", "APPROVED", "REJECTED", "REFUNDED"],
      Plan: ["FREE", "STARTER", "PRO", "ENTERPRISE"],
      PlanType: ["STARTER", "GROWTH", "SCALE"],
      Priority: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      PropertyType: ["BUILDING", "HOUSE", "COMPLEX", "OFFICE", "COMMERCIAL"],
      ProviderStatus: ["ACTIVE", "INACTIVE", "PENDING", "SUSPENDED"],
      QuoteStatus: ["PENDING", "APPROVED", "REJECTED", "EXPIRED"],
      responsable_pago: [
        "INQUILINO",
        "PROPIETARIO",
        "INMOBILIARIA",
        "A_DEFINIR",
        "COMPARTIDO",
      ],
      StepChannel: ["WHATSAPP", "EMAIL", "SMS"],
      sy_pedido_estado: ["pendiente", "en_proceso", "completado", "cancelado"],
      sy_user_role: ["cliente", "prestador", "admin"],
      TenantStatus: ["ACTIVE", "SUSPENDED", "TRIAL"],
      TicketSource: ["WEB", "APP", "WHATSAPP", "EMAIL", "MANUAL"],
      TicketStatus: [
        "NEW",
        "RECEIVED",
        "IN_REVIEW",
        "ASSIGNED",
        "AWAITING_QUOTE",
        "QUOTE_RECEIVED",
        "PENDING_APPROVAL",
        "APPROVED",
        "SCHEDULING_VISIT",
        "IN_PROGRESS",
        "PAUSED",
        "COMPLETED",
        "VALIDATED",
        "CLOSED",
        "CANCELLED",
      ],
      UnitType: [
        "APARTMENT",
        "LOCAL",
        "COMMON_AREA",
        "PARKING",
        "STORAGE",
        "OFFICE",
      ],
      user_role: ["admin", "worker", "user", "guest"],
      UserRole: [
        "SUPER_ADMIN",
        "ADMIN",
        "OPERATOR",
        "SUPERVISOR",
        "REQUESTER",
        "PROVIDER_USER",
        "AUDITOR",
      ],
      UserStatus: ["ACTIVE", "INACTIVE", "PENDING"],
      Visibility: ["INTERNAL", "PROVIDER", "CLIENT", "ALL"],
      VisitStatus: [
        "SCHEDULED",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "RESCHEDULED",
      ],
      worker_status: ["OFFLINE", "ONLINE", "BUSY", "ON_BREAK"],
    },
  },
} as const
