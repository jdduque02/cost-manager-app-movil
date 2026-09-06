import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import * as statementApi from "@/api/statement-imports.api";
import type { StatementImportRecord } from "@/types/statement-import.types";
import { ArrowLeft, CloudUpload, FileText, CircleAlert, X, Trash } from "@/components/ui/icons";

type FileToUpload = { uri: string; name: string; mimeType: string };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completado",
  partial: "Parcial",
  failed: "Fallido",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "muted",
  processing: "warning",
  completed: "success",
  partial: "warning",
  failed: "destructive",
};

export default function StatementImportScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  const queryClient = useQueryClient();

  const [selectedFiles, setSelectedFiles] = useState<FileToUpload[]>([]);
  const [password, setPassword] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [, setProgress] = useState<{ processed: number; total: number } | null>(null);

  const { data: imports, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["statement-imports", userId],
    queryFn: () => statementApi.getStatementImports(userId!),
    enabled: !!userId,
  });

  const uploadMutation = useMutation({
    mutationFn: () =>
      statementApi.uploadStatementImport(userId!, selectedFiles, {
        password: password || undefined,
        skipDuplicates: true,
        defaultType: "expense",
      }),
    onSuccess: (record) => {
      setSelectedFiles([]);
      setPassword("");
      setShowUploadModal(false);
      setProgress({ processed: 0, total: record.total_records_parsed });
      queryClient.invalidateQueries({ queryKey: ["statement-imports", userId] });
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message || "Error al subir extractos");
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => statementApi.retryStatementImport(userId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statement-imports", userId] });
    },
  });

  const pickFiles = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets) {
      const files = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || "application/pdf",
      }));
      setSelectedFiles((prev) => [...prev, ...files]);
      setShowUploadModal(true);
    }
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderImport = (item: StatementImportRecord) => {
    const title =
      item.files?.length === 1
        ? item.files[0].filename
        : `${item.total_files} archivo${item.total_files !== 1 ? "s" : ""}`;
    const failedFiles = item.files?.filter((f) => f.error_message) ?? [];

    return (
      <Card key={item.id} className="mb-3">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3">
            <Text className="text-foreground font-sans-semibold text-sm" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-muted-foreground font-sans text-xs mt-0.5">
              {formatDate(item.created_at)}
            </Text>
          </View>
          <Badge tone={STATUS_TONE[item.status] ?? "muted"}>{STATUS_LABELS[item.status]}</Badge>
        </View>

        <View className="flex-row items-center gap-4 mb-2">
          <View className="flex-row items-center gap-1">
            <FileText size={14} color={c.mutedForeground} />
            <Text className="text-muted-foreground font-sans text-xs">
              {item.total_records_created}/{item.total_records_parsed} registros
            </Text>
          </View>
          {item.total_records_failed > 0 && (
            <View className="flex-row items-center gap-1">
              <CircleAlert size={14} color={c.destructive} />
              <Text className="text-destructive font-sans text-xs">
                {item.total_records_failed} fallidos
              </Text>
            </View>
          )}
        </View>

        {item.status === "processing" && (
          <View className="h-1.5 bg-muted rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{
                width: `${item.total_records_parsed > 0 ? (item.total_records_created / item.total_records_parsed) * 100 : 0}%`,
              }}
            />
          </View>
        )}

        {item.status === "failed" && (
          <Pressable
            className="mt-2 py-1.5 px-3 bg-primary/10 rounded-md self-start"
            onPress={() => retryMutation.mutate(item.id)}
            disabled={retryMutation.isPending}
          >
            <Text className="text-primary text-xs font-sans-semibold">Reintentar</Text>
          </Pressable>
        )}

        {failedFiles.length > 0 && (
          <View className="mt-2 bg-destructive/5 rounded-md p-2">
            {failedFiles.slice(0, 3).map((f) => (
              <Text key={f.id} className="text-destructive font-sans text-xs">
                {f.filename}: {f.error_message}
              </Text>
            ))}
            {failedFiles.length > 3 && (
              <Text className="text-muted-foreground font-sans text-xs">
                +{failedFiles.length - 3} más
              </Text>
            )}
          </View>
        )}
      </Card>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={20} color={c.foreground} />
        </Pressable>
        <Text className="text-lg font-display text-foreground">Importar Extractos</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />
        }
      >
        <Text className="text-muted-foreground font-sans text-sm mb-6">
          Sube extractos bancarios en PDF para crear transacciones automáticamente
        </Text>

        <Button onPress={pickFiles} className="mb-6">
          <CloudUpload size={18} color={c.primaryForeground} />
          <Text className="font-sans-medium text-sm text-primary-foreground">
            Seleccionar PDFs
          </Text>
        </Button>

        {isLoading ? (
          <View>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={100} className="mb-3" />
            ))}
          </View>
        ) : imports?.data && imports.data.length > 0 ? (
          imports.data.map(renderImport)
        ) : (
          <Card>
            <EmptyState
              icon={FileText}
              title="Sin importaciones"
              description="Sube tu primer extracto bancario para comenzar"
            />
          </Card>
        )}
      </ScrollView>

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-card rounded-t-3xl p-6"
            style={{ maxHeight: Dimensions.get("window").height * 0.8 }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-display text-foreground">Subir Extractos</Text>
              <Pressable onPress={() => setShowUploadModal(false)}>
                <X size={22} color={c.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView className="mb-4">
              {selectedFiles.map((file, index) => (
                <View
                  key={index}
                  className="flex-row items-center justify-between bg-surface rounded-xl p-3 mb-2"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-foreground font-sans text-sm" numberOfLines={1}>
                      {file.name}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeFile(index)}>
                    <Trash size={18} color={c.destructive} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            <Input
              placeholder="Contraseña del extracto (opcional)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Button
              onPress={() => uploadMutation.mutate()}
              loading={uploadMutation.isPending}
              disabled={selectedFiles.length === 0}
            >
              Subir {selectedFiles.length} archivo{selectedFiles.length !== 1 ? "s" : ""}
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}
