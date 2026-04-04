'use client';

import { useState } from 'react';
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
import { ClientCreateInput } from '@/types/client';

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ClientCreateInput) => Promise<void>;
  isLoading?: boolean;
}

export default function AddClientDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: AddClientDialogProps) {
  const [formData, setFormData] = useState<ClientCreateInput>({
    name: '',
    company: '',
    contactEmail: '',
    monthlyRetainer: 0,
    serviceType: 'Full Service',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Client name is required';
    }
    if (!formData.company.trim()) {
      newErrors.company = 'Company name is required';
    }
    if (formData.monthlyRetainer < 0) {
      newErrors.monthlyRetainer = 'Monthly retainer must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await onSubmit(formData);
      setFormData({
        name: '',
        company: '',
        contactEmail: '',
        monthlyRetainer: 0,
        serviceType: 'Full Service',
        notes: '',
      });
      setErrors({});
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding client:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#0d1422] border-[#1a2540]">
        <DialogHeader>
          <DialogTitle className="text-white">Add New Client</DialogTitle>
          <DialogDescription className="text-[#7a88a8]">
            Create a new client to start tracking their health and engagement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">
              Client Name *
            </Label>
            <Input
              id="name"
              placeholder="e.g., Acme Corporation"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="bg-[#06090f] border-[#1a2540] text-white placeholder-[#7a88a8]"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="company" className="text-white">
              Company Name *
            </Label>
            <Input
              id="company"
              placeholder="e.g., Acme Inc."
              value={formData.company}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
              className="bg-[#06090f] border-[#1a2540] text-white placeholder-[#7a88a8]"
              disabled={isLoading}
            />
            {errors.company && (
              <p className="text-xs text-red-500">{errors.company}</p>
            )}
          </div>

          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">
              Contact Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="contact@acme.com"
              value={formData.contactEmail}
              onChange={(e) =>
                setFormData({ ...formData, contactEmail: e.target.value })
              }
              className="bg-[#06090f] border-[#1a2540] text-white placeholder-[#7a88a8]"
              disabled={isLoading}
            />
          </div>

          {/* Monthly Retainer */}
          <div className="space-y-2">
            <Label htmlFor="retainer" className="text-white">
              Monthly Retainer ($)
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

          {/* Service Type */}
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
                <SelectItem value="Content">Content</SelectItem>
                <SelectItem value="SEO">SEO</SelectItem>
                <SelectItem value="Paid Media">Paid Media</SelectItem>
                <SelectItem value="Social">Social</SelectItem>
                <SelectItem value="Design">Design</SelectItem>
                <SelectItem value="PR">PR</SelectItem>
                <SelectItem value="Full Service">Full Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-white">
              Notes
            </Label>
            <textarea
              id="notes"
              placeholder="Add any notes about this client..."
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
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
            className="bg-[#e74c3c] hover:bg-[#d43d2d]"
          >
            {isLoading ? 'Adding...' : 'Add Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
