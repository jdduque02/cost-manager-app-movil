export interface NewsItem {
  id: number;
  title: string;
  summary: string;
  content: string | null;
  category: string | null;
  image_url: string | null;
  link: string | null;
  published_at: string | null;
  created_at: string;
}
