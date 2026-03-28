export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: Json | null;
          parent_id: string | null;
          is_folder: boolean;
          is_template: boolean;
          archived_at: string | null;
          shared_token: string | null;
          shared_at: string | null;
          encrypted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: Json | null;
          parent_id?: string | null;
          is_folder?: boolean;
          is_template?: boolean;
          encrypted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: Json | null;
          parent_id?: string | null;
          is_folder?: boolean;
          is_template?: boolean;
          encrypted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
        };
      };
      note_tags: {
        Row: {
          note_id: string;
          tag_id: string;
        };
        Insert: {
          note_id: string;
          tag_id: string;
        };
        Update: {
          note_id?: string;
          tag_id?: string;
        };
      };
      note_collaborators: {
        Row: {
          id: string;
          note_id: string;
          user_id: string;
          role: "editor" | "viewer";
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          note_id: string;
          user_id: string;
          role?: "editor" | "viewer";
          invited_by?: string;
        };
        Update: {
          role?: "editor" | "viewer";
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
export type NoteUpdate = Database["public"]["Tables"]["notes"]["Update"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type NoteCollaborator = Database["public"]["Tables"]["note_collaborators"]["Row"];

export interface CalendarAttendee {
  email: string;
  displayName: string | null;
  self: boolean;
  responseStatus: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  attendees: CalendarAttendee[];
  meetingLink: string | null;
  recurringEventId: string | null;
}
