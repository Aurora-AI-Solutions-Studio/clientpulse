'use client';

// Shared "edit one client" form used by both Add and Edit flows. The Add
// dialog still lives in add-client-dialog.tsx (kept to avoid touching its
// existing import sites + tests) — that component now wraps this one with
// mode="add". The Edit flow uses this directly with mode="edit" and an
// `initial` value.

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Client, ClientCreateInput, ClientUpdateInput } from '@/types/client';

type Mode = 'add' | 'edit';

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
}

export interface ClientFormDialogProps extends BaseProps {
  mode: Mode;
  initial?: Client;
  onSubmit: (data: ClientCreateInput | ClientUpdateInput) => Promise<void>;
}

interface FormState {
  name: string;
  company: string;
  contactEmail: string;
  monthlyRetainer: number; // cents
  serviceType: string;
  notes: string;
  status: 'active' | 'paused' | 'churned' | 'at_risk' | 'critical';
}

const SERVICE_TYPES = [
  'Content',
  'SEO',
  'Paid Media',
  'Social',
  'Design',
  'PR',
  'Full Service',
] as const;

function emptyState(): FormState {
  return {
    name: '',
    company: '',
    contactEmail: '',
    monthlyRetainer: 0,
    serviceType: 'Full Service',
    notes: '',
    status: 'active',
  };
}

function fromClient(c: Client): FormState {
  return {
    name: c.name ?? '',
    company: c.company ?? '',
    contactEmail: c.contactEmail ?? '',
    monthlyRetainer: c.monthlyRetainer ?? 0,
    serviceType: c.serviceType ?? 'Full Service',
    notes: c.notes ?? '',
    status:
      (c.status as FormState['status']) === 'paused' ||
      (c.status as FormState['status']) === 'churned' ||
      (c.status as FormState['status']) === 'at_risk' ||
      (c.status as FormState['status']) === 'critical'
        ? (c.status as FormState['status'])
        : 'active',
  };
}

export default function ClientFormDialog({
  mode,
  open,
  onOpenChange,
  initial,
  onSubmit,
  isLoading = false,
}: ClientFormDialogProps) {
  const [formData, setFormData] = useState<FormState>(
    initial ? fromClient(initial) : emptyState(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset whenever we open/close or the source client changes.
  useEffect(() => {
    if (open) {
      setFormData(initial ? fromClient(initial) : emptyState());
      setErrors({});
    }
  }, [open, initial]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.name.trim()) next.name = 'Client name is required';
    if (!formData.company.trim()) next.company = 'Company name is required';
    if (formData.monthlyRetainer < 0) {
      next.monthlyRetainer = 'Monthly retainer must be a positive number';
    }
    if (formData.contactEmail && !formData.contactEmail.includes('@')) {
      next.contactEmail = 'Enter a valid email address';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      const payload: ClientCreateInput | ClientUpdateInput = {
        name: formData.name.trim(),
        company: formData.company.trim(),
        contactEmail: formData.contactEmail.trim(),
        monthlyRetainer: formData.monthlyRetainer,
        serviceType: formData.serviceType,
        notes: formData.notes.trim(),
        ...(mode === 'edit'
          ? {
              status: formData.status === 'at_risk' || formData.status === 'critical'
                ? 'active' /* coerce — server enum subset */
                : formData.status,
            }
          : {}),
      } as ClientCreateInput | ClientUpdateInput;
      await onSubmit(payload);
      onOpenChange(false);
    } catch (err) {
      console.error('[ClientFormDialog] submit failed', err);
    }
  };

  const isEdit = mode === 'edit';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#0d1422] border-[#1a2540]">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? 'Edit Client' : 'Add New Client'}
          </DialogTitle>
          <DialogDescription className="text-[#7a88a8]">
            {isEdit
              ? 'Update this client’s details. Changes apply immediately.'
              : 'Create a new client to start tracking their health and engagement.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">
              Client Name *
            </Label>
            <Input
              id="name"
              placeholder="e.g., Acme Corporation"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-[#06090f] border-[#1a2540] text-white placeholder-[#7a88a8]"
              disabled={isLoading}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="company" className="text-white">
              Company Name *
            </Label>
            <Input
              id="company"
              placeholder="e.g., Acme Inc."
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="bg-[#06090f] border-[#1a2540] text-white placeholder-[#7a88a8]"
              disabled={isLoading}
            />
            {errors.company && <p className="text-xs text-red-500">{errors.company}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">
              Primary Contact Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="contact@acme.com"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              className="bg-[#06090f] border-[#1a2540] text-white placeholder-[#7a88a8]"
              disabled={isLoading}
            />
            {errors.contactEmail && (
              <p className="text-xs text-red-500">{errors.contactEmail}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="retainer" className="text-white">
              Monthly Value ($)
            </Label>
            <Input
              id="retainer"
              type="number"
              placeholder="5000"
              value={formData.monthlyRetainer / 100 || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  monthlyRetainer: parseFloat(e.target.value) * 100 || 0,
                })
              }
              className="bg-[#06090f] border-[#1a2540] text-white placeholder-[#7a88a8]"
              disabled={isLoading}
            />
            {errors.monthlyRetainer && (
              <p className="text-xs text-red-500">{errors.monthlyRetainer}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceType" className="text-white">
              Service Type
            </Label>
            <Select
              value={formData.serviceType}
              onValueChange={(value: string) =>
                setFormData({ ...formData, serviceType: value })
              }
              disabled={isLoading}
            >
              <SelectTrigger className="bg-[#06090f] border-[#1a2540] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0d1422] border-[#1a2540]">
                {SERVICE_TYPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label htmlFor="status" className="text-white">
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value: FormState['status']) =>
                  setFormData({ ...formData, status: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger className="bg-[#06090f] border-[#1a2540] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1422] border-[#1a2540]">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-white">
              Notes
            </Label>
            <textarea
              id="notes"
              placeholder="Add any notes about this client..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-[#06090f] border border-[#1a2540] rounded-md text-white placeholder-[#7a88a8] text-sm"
              rows={3}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-gradient-to-r from-[#38e8c8] to-[#4cc9f0] text-[#0a1f1a] font-semibold hover:opacity-95"
          >
            {isLoading ? (isEdit ? 'Saving…' : 'Adding…') : isEdit ? 'Save changes' : 'Add Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
