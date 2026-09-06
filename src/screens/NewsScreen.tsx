import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import * as newsApi from "@/api/news.api";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Newspaper } from "@/components/ui/icons";
import type { NewsItem } from "@/types/news.types";

const CATEGORY_TONE: Record<string, BadgeTone> = {
  finanzas: "success",
  economia: "primary",
  inversiones: "warning",
  impuestos: "destructive",
  general: "muted",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function NewsScreen() {
  const { data: news, isLoading, refetch } = useOfflineQuery<NewsItem[]>(
    {
      queryKey: ["news"],
      queryFn: () => newsApi.getNews(),
    },
    async () => [],
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 pt-6 gap-3">
        <Skeleton width={150} height={28} />
        <Skeleton height={120} />
        <Skeleton height={120} />
        <Skeleton height={120} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
    >
      <View className="px-4 pt-4 pb-4">
        <PageHeader title="Noticias" subtitle="Últimas novedades financieras" />
      </View>

      {(news ?? []).length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Sin noticias"
          description="No hay noticias disponibles en este momento"
        />
      ) : (
        <View className="px-4 pb-6 gap-3">
          {(news ?? []).map((item) => (
            <Pressable key={item.id}>
              <Card>
                <View className="flex-row justify-between items-start mb-2">
                  {item.category && (
                    <Badge tone={CATEGORY_TONE[item.category] ?? "muted"}>{item.category}</Badge>
                  )}
                  <Text className="text-xs font-sans text-muted-foreground">
                    {formatDate(item.published_at ?? item.created_at)}
                  </Text>
                </View>
                <Text className="text-base font-sans-semibold text-foreground mb-1">
                  {item.title}
                </Text>
                <Text className="text-sm font-sans text-muted-foreground" numberOfLines={3}>
                  {item.summary}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
