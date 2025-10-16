export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string | null;
          updated_at: string | null;
          role: 'guest' | 'member' | 'admin' | 'sys_admin';
          display_name: string | null;
        };
        Insert: {
          id: string;
          role?: 'guest' | 'member' | 'admin' | 'sys_admin';
          created_at?: string | null;
          updated_at?: string | null;
          display_name?: string | null;
        };
        Update: {
          role?: 'guest' | 'member' | 'admin' | 'sys_admin';
          display_name?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
}
