export type StatementImportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "partial"
  | "failed";

export type StatementImportFileStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed";

export interface StatementImportFile {
  id: number;
  import_id: number;
  filename: string;
  mimetype: string;
  size_bytes: number;
  status: StatementImportFileStatus;
  records_parsed: number;
  records_created: number;
  records_skipped: number;
  records_uncategorized: number;
  error_code: string | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface StatementImportRecord {
  id: number;
  user_id: number;
  status: StatementImportStatus;
  total_files: number;
  processed_files: number;
  success_files: number;
  failed_files: number;
  total_records_parsed: number;
  total_records_created: number;
  total_records_skipped: number;
  total_records_failed: number;
  total_records_uncategorized: number;
  created_at: string;
  updated_at: string | null;
  files?: StatementImportFile[];
}
