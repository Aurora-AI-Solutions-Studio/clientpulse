'use client';

// Confirm-and-delete dialog for a client. Deleting a client cascades to
// signals, action items, health scores, briefs facts, etc. (see
// schema.sql) — so the confirm step here is non-negotiable.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { Client } from '@/types/client';

interface DeleteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export default function DeleteClientDialog({
  open,
  onOpenChange,
  client,
  onConfirm,
  isLoading = false,
}: DeleteClientDialogProps) {
  if (!client) return null;
  const label = client.company || client.name;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-[#0d1422] border-[#1a2540]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Delete &quot;{label}&quot;?
          </DialogTitle>
          <DialogDescription className="text-[#a0adc4] pt-2">
            This permanently removes the client and all attached signal
            history, action items, health scores, and briefs. This cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {isLoading ? 'Deleting…' : 'Delete client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
