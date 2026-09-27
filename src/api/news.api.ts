import { apiClient, unwrapList } from "./client";
import type { NewsItem } from "@/types/news.types";

export async function getNews(limit?: number): Promise<NewsItem[]> {
  const { data } = await apiClient.get<NewsItem[] | { data: NewsItem[]; total?: number }>(
    "/news",
    { params: limit ? { limit } : undefined },
  );
  return unwrapList(data);
}
