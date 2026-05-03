'use client';

// CSV mass-upload dialog. Two phases:
//   1. Pick file (with a "download template" link).
//   2. After POST /api/clients/bulk returns, swap to the result view
//      ("12 added, 2 skipped — see why") with a list of failures.

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileDown, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface MassUploadResult {
  added: number;
  skipped: number;
  errors: Array<{ rowNumber: number; reason: string }>;
}

interface MassUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** POST the file and return the parsed summary. */
  onUpload: (file: File) => Promise<MassUploadResult>;
  /** Called once the result modal is dismissed AFTER any successful adds
   * so the parent can refetch its client list. */
  onDoneIfChanged: () => void;
}

export default function MassUploadDialog({
  open,
  onOpenChange,
  onUpload,
  onDoneIfChanged,
}: MassUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MassUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setBusy(false);
    setResult(null);
    setError(null);
  };

  const handleClose = (next: boolean) => {
    if (busy) return;
    if (!next) {
      // If we ran a successful import, tell the parent to reload before we
      // tear the modal down.
      if (result && result.added > 0) onDoneIfChanged();
      reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await onUpload(file);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] bg-[#0d1422] border-[#1a2540]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#38e8c8]" />
            Mass-upload clients
          </DialogTitle>
          <DialogDescription className="text-[#a0adc4]">
            Upload a CSV with one row per client. Required columns:{' '}
            <code className="text-[#c8d0e0]">name</code>,{' '}
            <code className="text-[#c8d0e0]">company_name</code>. Optional:{' '}
            <code className="text-[#c8d0e0]">primary_contact</code>,{' '}
            <code className="text-[#c8d0e0]">monthly_value</code>,{' '}
            <code className="text-[#c8d0e0]">service_type</code>,{' '}
            <code className="text-[#c8d0e0]">notes</code>.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-white">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <div>
                <p className="font-medium">
                  {result.added} added
                  {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}
                </p>
                {result.skipped > 0 && (
                  <p className="text-xs text-[#a0adc4]">
                    Skipped rows are listed below — fix and re-upload.
                  </p>
                )}
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-[260px] overflow-y-auto rounded-md border border-[#1a2540] bg-[#06090f]">
                <ul className="divide-y divide-[#141e33] text-sm">
                  {result.errors.map((err, idx) => (
                    <li key={idx} className="px-3 py-2 flex gap-2 items-start">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-1 shrink-0" />
                      <div>
                        <span className="text-[#9aa6c0] text-xs">
                          Row {err.rowNumber}
                        </span>
                        <p className="text-[#e0e6f0]">{err.reason}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <a
                href="/api/clients/bulk"
                download="clientpulse-client-template.csv"
                className="inline-flex items-center gap-1.5 text-sm text-[#38e8c8] hover:underline"
              >
                <FileDown className="w-4 h-4" />
                Download CSV template
              </a>
            </div>
            <label className="block">
              <span className="sr-only">Choose CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={busy}
                className="block w-full text-sm text-[#c8d0e0] file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#1a2540] file:text-white hover:file:bg-[#22304f] file:cursor-pointer"
              />
            </label>
            {file && (
              <p className="text-xs text-[#a0adc4]">
                Selected: {file.name} ({Math.ceil(file.size / 1024)} KB)
              </p>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button
              onClick={() => handleClose(false)}
              className="bg-gradient-to-r from-[#38e8c8] to-[#4cc9f0] text-[#0a1f1a] font-semibold"
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!file || busy}
                className="bg-gradient-to-r from-[#38e8c8] to-[#4cc9f0] text-[#0a1f1a] font-semibold disabled:opacity-50"
              >
                {busy ? 'Uploading…' : 'Upload'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
