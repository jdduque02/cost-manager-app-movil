import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
  Pressable,
} from "react-native";
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import * as catalogApi from "@/api/catalog.api";
import * as localRepo from "@/database/local.repository";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tag, ChevronRight, Plus } from "@/components/ui/icons";
import { toast } from "@/utils/toast";
import type { CategoryResponse, GroupType } from "@/types/catalog.types";

const BUCKET_LABELS: Record<string, string> = {
  needs: "Necesidades",
  wants: "Deseos",
  savings: "Ahorros",
};

const TYPE_LABELS: Record<GroupType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  investment: "Inversión",
};

const TYPE_TONE: Record<GroupType, BadgeTone> = {
  income: "success",
  expense: "destructive",
  investment: "primary",
};

function ListSkeleton() {
  return (
    <View className="p-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="p-4">
          <View className="flex-row items-center gap-3">
            <Skeleton width={40} height={40} borderRadius={20} />
            <View className="flex-1">
              <Skeleton width={120} height={16} className="mb-2" />
              <Skeleton width={80} height={12} />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

function SubcategorySkeleton() {
  return (
    <View className="p-3 gap-2">
      {[1, 2, 3].map((i) => (
        <View key={i} className="flex-row items-center gap-2 py-2">
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={100} height={14} />
        </View>
      ))}
    </View>
  );
}

export default function CategoriesScreen() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { resolvedScheme } = useAppTheme();

  const [selectedCategory, setSelectedCategory] = useState<CategoryResponse | null>(null);
  const [showSubcategories, setShowSubcategories] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [filterType, setFilterType] = useState<"ALL" | GroupType>("ALL");

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    icon_key: "",
    color_hex: "",
    type: "expense" as GroupType,
  });

  const [subcategoryForm, setSubcategoryForm] = useState({
    name: "",
    icon_key: "",
  });

  const {
    data: categories,
    isLoading: loadingCategories,
    refetch: refetchCategories,
  } = useOfflineQuery(
    {
      queryKey: ["categories"],
      queryFn: catalogApi.getCategories,
    },
    () => localRepo.getLocalCategories(),
  );

  const {
    data: subcategories,
    isLoading: loadingSubcategories,
    refetch: refetchSubcategories,
  } = useOfflineQuery(
    {
      queryKey: ["subcategories", selectedCategory?.id],
      queryFn: () =>
        selectedCategory && userId
          ? catalogApi.getSubcategories(userId, selectedCategory.id)
          : Promise.resolve([]),
      enabled: !!selectedCategory && !!userId,
    },
    () =>
      selectedCategory
        ? localRepo.getLocalSubcategories(selectedCategory.id)
        : Promise.resolve([]),
  );

  const isLoading = loadingCategories;

  const refetchAll = useCallback(() => {
    refetchCategories();
    refetchSubcategories();
  }, [refetchCategories, refetchSubcategories]);

  function openSubcategories(category: CategoryResponse) {
    setSelectedCategory(category);
    setShowSubcategories(true);
  }

  function handleCreateCategory() {
    if (!categoryForm.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    Alert.alert(
      "Crear categoría",
      `¿Crear "${categoryForm.name}" como ${TYPE_LABELS[categoryForm.type]}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Crear",
          onPress: async () => {
            try {
              await catalogApi.createCategory({
                name: categoryForm.name,
                group_type: categoryForm.type,
                icon_key: categoryForm.icon_key || undefined,
                color_hex: categoryForm.color_hex || undefined,
              });
              setShowCategoryModal(false);
              setCategoryForm({ name: "", icon_key: "", color_hex: "", type: "expense" });
              queryClient.invalidateQueries({ queryKey: ["categories"] });
              toast.success("Categoría creada");
            } catch {
              toast.error("No se pudo crear la categoría");
            }
          },
        },
      ],
    );
  }

  function handleCreateSubcategory() {
    if (!subcategoryForm.name.trim() || !selectedCategory || !userId) {
      toast.error("El nombre es obligatorio");
      return;
    }
    Alert.alert(
      "Crear subcategoría",
      `¿Crear "${subcategoryForm.name}" en ${selectedCategory.name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Crear",
          onPress: async () => {
            try {
              await catalogApi.createSubcategory(userId, {
                category_id: selectedCategory.id,
                name: subcategoryForm.name,
                icon_key: subcategoryForm.icon_key || undefined,
              });
              setShowSubcategoryModal(false);
              setSubcategoryForm({ name: "", icon_key: "" });
              queryClient.invalidateQueries({
                queryKey: ["subcategories", selectedCategory.id],
              });
              toast.success("Subcategoría creada");
            } catch {
              toast.error("No se pudo crear la subcategoría");
            }
          },
        },
      ],
    );
  }

  const filteredCategories = (categories ?? []).filter(
    (c) => filterType === "ALL" || c.group_type === filterType,
  );

  const incomeCount = (categories ?? []).filter((c) => c.group_type === "income").length;
  const expenseCount = (categories ?? []).filter((c) => c.group_type === "expense").length;

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <ListSkeleton />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetchAll} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View className="px-4 pt-4">
            <PageHeader title="Categorías" />

            <View className="flex-row gap-3 mt-4">
              <Card className="flex-1 items-center py-3">
                <Text className="text-xl font-num-semibold text-foreground">{incomeCount}</Text>
                <Text className="text-xs font-sans text-muted-foreground mt-1">Ingresos</Text>
              </Card>
              <Card className="flex-1 items-center py-3">
                <Text className="text-xl font-num-semibold text-foreground">{expenseCount}</Text>
                <Text className="text-xs font-sans text-muted-foreground mt-1">Gastos</Text>
              </Card>
              <Card className="flex-1 items-center py-3">
                <Text className="text-xl font-num-semibold text-foreground">
                  {(categories ?? []).length}
                </Text>
                <Text className="text-xs font-sans text-muted-foreground mt-1">Total</Text>
              </Card>
            </View>

            <View className="flex-row gap-2 mt-4">
              {(["ALL", "income", "expense", "investment"] as const).map((t) => (
                <Pressable
                  key={t}
                  className={`flex-1 rounded-md py-2.5 items-center border ${
                    filterType === t ? "bg-primary border-primary" : "bg-card border-border"
                  }`}
                  onPress={() => setFilterType(t)}
                >
                  <Text
                    className={`text-sm font-sans-medium ${
                      filterType === t ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {t === "ALL" ? "Todas" : TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row justify-between items-center mt-6 mb-3">
              <Text className="text-lg font-display text-foreground">Categorías</Text>
              <Button size="sm" onPress={() => setShowCategoryModal(true)}>
                <Plus size={16} color={PALETTE[resolvedScheme].primaryForeground} />
                <Text className="text-sm font-sans-medium text-primary-foreground">Nueva</Text>
              </Button>
            </View>

            <Card variant="outline" className="mb-4">
              <Text className="text-sm font-sans-bold text-foreground mb-2">
                Etiquetas de perfil
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {Object.entries(BUCKET_LABELS).map(([key, label]) => (
                  <Badge key={key} tone="muted">
                    {label}
                  </Badge>
                ))}
              </View>
            </Card>
          </View>
        }
        renderItem={({ item }) => (
          <View className="mx-4 mb-2">
            <Card variant="flat" className="p-2" onPress={() => openSubcategories(item)}>
              <View className="flex-row items-center gap-3 px-2 py-1">
                <IconTile icon={Tag} tone={TYPE_TONE[item.group_type]} size="sm" />
                <Text className="flex-1 text-sm font-sans-medium text-foreground">
                  {item.name}
                </Text>
                <Badge tone={TYPE_TONE[item.group_type]}>{TYPE_LABELS[item.group_type]}</Badge>
                <ChevronRight size={16} color={PALETTE[resolvedScheme].mutedForeground} />
              </View>
            </Card>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={Tag}
            title="Sin categorías"
            description="Las categorías se cargan automáticamente del servidor"
          />
        }
      />

      {/* Subcategories Bottom Sheet */}
      <Modal
        visible={showSubcategories}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSubcategories(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-card rounded-t-3xl max-h-[70%]">
            <View className="flex-row justify-between items-center p-5 border-b border-border">
              <View>
                <Text className="text-lg font-display text-foreground">
                  {selectedCategory?.name}
                </Text>
                <Text className="text-sm font-sans text-muted-foreground">
                  Subcategorías ·{" "}
                  {selectedCategory ? TYPE_LABELS[selectedCategory.group_type] : ""}
                </Text>
              </View>
              <Button size="sm" onPress={() => setShowSubcategoryModal(true)}>
                <Plus size={16} color={PALETTE[resolvedScheme].primaryForeground} />
                <Text className="text-sm font-sans-medium text-primary-foreground">Nueva</Text>
              </Button>
            </View>

            {loadingSubcategories ? (
              <SubcategorySkeleton />
            ) : (subcategories ?? []).length === 0 ? (
              <View className="py-10">
                <EmptyState icon={Tag} title="Sin subcategorías" />
              </View>
            ) : (
              <ScrollView className="p-3">
                {(subcategories ?? []).map((sub) => (
                  <View
                    key={sub.id}
                    className="flex-row items-center gap-3 py-3 border-b border-border last:border-0 px-2"
                  >
                    <IconTile icon={Tag} tone="muted" size="sm" />
                    <Text className="text-base font-sans-medium text-foreground flex-1">
                      {sub.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <View className="p-4 border-t border-border">
              <Button variant="outline" onPress={() => setShowSubcategories(false)}>
                Cerrar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Category Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-card rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-display text-foreground mb-5">Nueva categoría</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Input
                label="Nombre"
                value={categoryForm.name}
                onChangeText={(v) => setCategoryForm((p) => ({ ...p, name: v }))}
                placeholder="Transporte"
              />
              <Input
                label="Icono (emoji)"
                value={categoryForm.icon_key}
                onChangeText={(v) => setCategoryForm((p) => ({ ...p, icon_key: v }))}
                placeholder="🚗"
              />

              <Text className="text-sm font-sans-medium text-foreground mb-2">Tipo</Text>
              <View className="flex-row gap-2 mb-5">
                {(["expense", "income", "investment"] as const).map((t) => (
                  <Pressable
                    key={t}
                    className={`flex-1 rounded-md px-3 py-2.5 border items-center ${
                      categoryForm.type === t
                        ? "bg-primary border-primary"
                        : "bg-card border-border"
                    }`}
                    onPress={() => setCategoryForm((p) => ({ ...p, type: t }))}
                  >
                    <Text
                      className={`text-sm font-sans-medium ${
                        categoryForm.type === t ? "text-primary-foreground" : "text-foreground"
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View className="flex-row gap-3 mt-2 mb-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => setShowCategoryModal(false)}
                >
                  Cancelar
                </Button>
                <Button className="flex-1" onPress={handleCreateCategory}>
                  Crear
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Subcategory Modal */}
      <Modal
        visible={showSubcategoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSubcategoryModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-card rounded-t-3xl p-6 max-h-[60%]">
            <Text className="text-lg font-display text-foreground mb-1">Nueva subcategoría</Text>
            <Text className="text-sm font-sans text-muted-foreground mb-5">
              En: {selectedCategory?.name}
            </Text>
            <Input
              label="Nombre"
              value={subcategoryForm.name}
              onChangeText={(v) => setSubcategoryForm((p) => ({ ...p, name: v }))}
              placeholder="Nombre de la subcategoría"
            />
            <Input
              label="Icono (emoji)"
              value={subcategoryForm.icon_key}
              onChangeText={(v) => setSubcategoryForm((p) => ({ ...p, icon_key: v }))}
              placeholder="•"
            />
            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setShowSubcategoryModal(false)}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onPress={handleCreateSubcategory}>
                Crear
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
