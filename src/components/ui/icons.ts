/**
 * Único punto de importación de lucide-react-native. Metro no hace
 * tree-shaking, así que se importa cada icono desde su subpath propio
 * (`lucide-react-native/icons/<kebab-case>`) en vez del barrel principal —
 * el barrel arrastraría los ~1500 iconos del paquete al bundle.
 *
 * Nota de nombres: varias versiones recientes de lucide renombraron iconos
 * respecto a los que usa la web (lucide-react más antiguo). Equivalencias
 * usadas aquí: Home→House, Unlock→LockOpen, Loader2→LoaderCircle,
 * AlertCircle→CircleAlert, Trash2→Trash, BarChart3→ChartColumn.
 */
export { default as TrendingUp } from "lucide-react-native/icons/trending-up";
export { default as TrendingDown } from "lucide-react-native/icons/trending-down";
export { default as ArrowUpRight } from "lucide-react-native/icons/arrow-up-right";
export { default as ArrowDownRight } from "lucide-react-native/icons/arrow-down-right";
export { default as ArrowLeftRight } from "lucide-react-native/icons/arrow-left-right";
export { default as ArrowLeft } from "lucide-react-native/icons/arrow-left";
export { default as Wallet } from "lucide-react-native/icons/wallet";
export { default as PiggyBank } from "lucide-react-native/icons/piggy-bank";
export { default as ReceiptText } from "lucide-react-native/icons/receipt-text";
export { default as Target } from "lucide-react-native/icons/target";
export { default as User } from "lucide-react-native/icons/user";
export { default as Users } from "lucide-react-native/icons/users";
export { default as House } from "lucide-react-native/icons/house";
export { default as Plus } from "lucide-react-native/icons/plus";
export { default as Pencil } from "lucide-react-native/icons/pencil";
export { default as Trash } from "lucide-react-native/icons/trash";
export { default as FileUp } from "lucide-react-native/icons/file-up";
export { default as Copy } from "lucide-react-native/icons/copy";
export { default as Building2 } from "lucide-react-native/icons/building-2";
export { default as ChartColumn } from "lucide-react-native/icons/chart-column";
export { default as ShoppingBag } from "lucide-react-native/icons/shopping-bag";
export { default as Coffee } from "lucide-react-native/icons/coffee";
export { default as Car } from "lucide-react-native/icons/car";
export { default as Zap } from "lucide-react-native/icons/zap";
export { default as Tag } from "lucide-react-native/icons/tag";
export { default as Sun } from "lucide-react-native/icons/sun";
export { default as Moon } from "lucide-react-native/icons/moon";
export { default as Monitor } from "lucide-react-native/icons/monitor";
export { default as Lock } from "lucide-react-native/icons/lock";
export { default as LockOpen } from "lucide-react-native/icons/lock-open";
export { default as Eye } from "lucide-react-native/icons/eye";
export { default as EyeOff } from "lucide-react-native/icons/eye-off";
export { default as Bell } from "lucide-react-native/icons/bell";
export { default as Settings } from "lucide-react-native/icons/settings";
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
export { default as X } from "lucide-react-native/icons/x";
export { default as LoaderCircle } from "lucide-react-native/icons/loader-circle";
export { default as CircleAlert } from "lucide-react-native/icons/circle-alert";
export { default as Check } from "lucide-react-native/icons/check";
export { default as Sparkles } from "lucide-react-native/icons/sparkles";
export { default as Shield } from "lucide-react-native/icons/shield";
export { default as Rocket } from "lucide-react-native/icons/rocket";
export { default as GraduationCap } from "lucide-react-native/icons/graduation-cap";
export { default as Sunset } from "lucide-react-native/icons/sunset";
export { default as Search } from "lucide-react-native/icons/search";
export { default as CloudUpload } from "lucide-react-native/icons/cloud-upload";
export { default as FileText } from "lucide-react-native/icons/file-text";
export { default as LogOut } from "lucide-react-native/icons/log-out";
export { default as Menu } from "lucide-react-native/icons/menu";
export { default as Newspaper } from "lucide-react-native/icons/newspaper";
export { default as Mail } from "lucide-react-native/icons/mail";
export { default as WifiOff } from "lucide-react-native/icons/wifi-off";
export { default as RefreshCw } from "lucide-react-native/icons/refresh-cw";
export { default as Calendar } from "lucide-react-native/icons/calendar";
export { default as Clock } from "lucide-react-native/icons/clock";
export { default as CreditCard } from "lucide-react-native/icons/credit-card";
export { default as Banknote } from "lucide-react-native/icons/banknote";
export { default as CircleDollarSign } from "lucide-react-native/icons/circle-dollar-sign";

export type { LucideIcon } from "lucide-react-native";
