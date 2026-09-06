export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  is_read: boolean;
  is_active: boolean;
  scheduled_at: string | null;
  reference: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface NotificationQuery {
  is_read?: boolean;
  is_active?: boolean;
}
