import { useState, useCallback } from "react";
import { View, Text, ScrollView, Alert, RefreshControl, Modal } from "react-native";
import { useAuthStore } from "@/store/auth.store";
import { useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import * as empresasApi from "@/api/empresas.api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ListRow } from "@/components/ui/ListRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { Building2, Pencil, Trash, Plus } from "@/components/ui/icons";
import type { EmpresaResponse } from "@/types/empresa.types";

export default function EmpresasScreen() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { resolvedScheme } = useAppTheme();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    data: empresas,
    isLoading,
    refetch,
  } = useOfflineQuery<EmpresaResponse[]>(
    {
      queryKey: ["empresas", userId],
      queryFn: () => empresasApi.getEmpresas(userId as number),
      enabled: !!userId,
    },
    async () => [],
  );

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setShowModal(true);
  };

  const openEdit = (empresa: EmpresaResponse) => {
    setEditingId(empresa.id);
    setName(empresa.name);
    setShowModal(true);
  };

  const handleSave = useCallback(async () => {
    if (!name.trim() || !userId) {
      Alert.alert("Error", "El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await empresasApi.updateEmpresa(userId, editingId, { name: name.trim() });
      } else {
        await empresasApi.createEmpresa(userId, { name: name.trim() });
      }
      queryClient.invalidateQueries({ queryKey: ["empresas", userId] });
      setShowModal(false);
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }, [name, editingId, userId, queryClient]);

  const handleDelete = useCallback(
    (empresa: EmpresaResponse) => {
      if (!userId) return;
      Alert.alert("Eliminar empresa", `¿Estás seguro de eliminar "${empresa.name}"?`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await empresasApi.deleteEmpresa(userId, empresa.id);
              queryClient.invalidateQueries({ queryKey: ["empresas", userId] });
            } catch (err: unknown) {
              Alert.alert("Error", err instanceof Error ? err.message : "No se pudo eliminar");
            }
          },
        },
      ]);
    },
    [userId, queryClient],
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 pt-6 gap-3">
        <Skeleton width={180} height={28} />
        <Skeleton height={72} />
        <Skeleton height={72} />
        <Skeleton height={72} />
      </View>
    );
  }

  if (!userId) {
    return (
      <View className="flex-1 bg-background px-4 pt-6">
        <EmptyState
          icon={Building2}
          title="Sesión no disponible"
          description="Inicia sesión de nuevo para ver tus datos."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
      >
        <View className="px-4 pt-4 pb-4">
          <PageHeader
            title="Empresas"
            subtitle="Gestión de empresas"
            actions={
              <Button size="sm" onPress={openCreate}>
                <Plus size={16} color={PALETTE[resolvedScheme].primaryForeground} />
                <Text className="text-sm font-sans-medium text-primary-foreground">Nueva</Text>
              </Button>
            }
          />
        </View>

        {(empresas ?? []).length === 0 ? (
          <Card className="mx-4">
            <EmptyState
              icon={Building2}
              title="Sin empresas"
              description="Registra tu primera empresa para comenzar"
              action={
                <Button variant="outline" size="sm" onPress={openCreate}>
                  Crear empresa
                </Button>
              }
            />
          </Card>
        ) : (
          <View className="px-4 pb-6">
            <Card variant="flat" className="p-2">
              {(empresas ?? []).map((empresa) => (
                <ListRow
                  key={empresa.id}
                  icon={Building2}
                  tone="muted"
                  title={empresa.name}
                  meta={`Creada: ${new Date(empresa.created_at).toLocaleDateString("es-CO")}`}
                  right={
                    <View className="flex-row gap-1">
                      <Button variant="ghost" size="icon" onPress={() => openEdit(empresa)}>
                        <Pencil size={16} color={PALETTE[resolvedScheme].mutedForeground} />
                      </Button>
                      <Button variant="ghost" size="icon" onPress={() => handleDelete(empresa)}>
                        <Trash size={16} color={PALETTE[resolvedScheme].destructive} />
                      </Button>
                    </View>
                  }
                />
              ))}
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-card rounded-t-3xl p-6 pb-10">
            <Text className="text-lg font-display text-foreground mb-4">
              {editingId ? "Editar empresa" : "Nueva empresa"}
            </Text>

            <Input
              label="Nombre *"
              placeholder="Nombre de la empresa"
              value={name}
              onChangeText={setName}
            />

            <View className="flex-row gap-3 mt-2">
              <Button variant="outline" onPress={() => setShowModal(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onPress={handleSave} loading={saving} className="flex-1">
                {editingId ? "Guardar" : "Crear"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
