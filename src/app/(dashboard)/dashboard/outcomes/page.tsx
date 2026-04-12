'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ClientOutcome } from '@/types/learning';
import { Client } from '@/types/client';
import { useToast } from '@/components/ui/use-toast';

interface OutcomeFormData {
  clientId: string;
  outcomeType: 'renewed' | 'churned' | 'expanded' | 'downgraded' | 'paused';
  outcomeDate: string;
  previousRetainer: string;
  newRetainer: string;
  reason: string;
  notes: string;
}

export default function OutcomesPage() {
  const [outcomes, setOutcomes] = useState<ClientOutcome[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [form, setForm] = useState<OutcomeFormData>({
    clientId: '',
    outcomeType: 'renewed',
    outcomeDate: new Date().toISOString().split('T')[0],
    previousRetainer: '',
    newRetainer: '',
    reason: '',
    notes: '',
  });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [outcomesRes, clientsRes] = await Promise.all([
        fetch('/api/outcomes'),
        fetch('/api/clients'),
      ]);

      if (!outcomesRes.ok || !clientsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const outcomesData = await outcomesRes.json();
      const clientsData = await clientsRes.json();

      setOutcomes(outcomesData.data || []);
      setClients(clientsData.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!form.clientId || !form.outcomeType || !form.outcomeDate) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          outcomeType: form.outcomeType,
          outcomeDate: form.outcomeDate,
          previousRetainer: form.previousRetainer
            ? parseFloat(form.previousRetainer)
            : undefined,
          newRetainer: form.newRetainer
            ? parseFloat(form.newRetainer)
            : undefined,
          reason: form.reason || undefined,
          notes: form.notes || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to record outcome');
      }

      toast({
        title: 'Success',
        description: 'Outcome recorded successfully',
      });

      setForm({
        clientId: '',
        outcomeType: 'renewed',
        outcomeDate: new Date().toISOString().split('T')[0],
        previousRetainer: '',
        newRetainer: '',
        reason: '',
        notes: '',
      });
      setIsDialogOpen(false);
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record outcome';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const getOutcomeIcon = (type: string) => {
    switch (type) {
      case 'renewed':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'expanded':
        return <TrendingUp className="w-5 h-5 text-blue-400" />;
      case 'downgraded':
        return <TrendingDown className="w-5 h-5 text-yellow-500" />;
      case 'churned':
        return <AlertTriangle className="w-5 h-5 text-[#e74c3c]" />;
      case 'paused':
        return <AlertTriangle className="w-5 h-5 text-[#7a88a8]" />;
      default:
        return null;
    }
  };

  const getOutcomeColor = (type: string) => {
    switch (type) {
      case 'renewed':
        return 'bg-green-500/20 text-green-400';
      case 'expanded':
        return 'bg-blue-500/20 text-blue-400';
      case 'downgraded':
        return 'bg-yellow-500/20 text-yellow-500';
      case 'churned':
        return 'bg-[#e74c3c]/20 text-[#e74c3c]';
      case 'paused':
        return 'bg-[#7a88a8]/20 text-[#7a88a8]';
      default:
        return 'bg-[#1a1f35] text-[#7a88a8]';
    }
  };

  const getOutcomeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Calculate stats
  const stats = {
    total: outcomes.length,
    churned: outcomes.filter((o) => o.outcomeType === 'churned').length,
    renewed: outcomes.filter((o) => o.outcomeType === 'renewed').length,
    expanded: outcomes.filter((o) => o.outcomeType === 'expanded').length,
    expansionRevenue: outcomes
      .filter((o) => o.outcomeType === 'expanded')
      .reduce((sum, o) => {
        const change = (o.newRetainer || 0) - (o.previousRetainer || 0);
        return sum + Math.max(0, change);
      }, 0),
  };

  const filteredOutcomes = filterType === 'all'
    ? outcomes
    : outcomes.filter((o) => o.outcomeType === filterType);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-[#7a88a8] mb-2">Loading outcomes...</p>
          <div className="w-8 h-8 border-2 border-[#e74c3c]/30 border-t-[#e74c3c] rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white font-playfair mb-2">
            Client Outcomes
          </h2>
          <p className="text-[#7a88a8]">
            Track and analyze client outcome events
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#e74c3c] hover:bg-[#c0392b] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Record Outcome
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111827] border border-[#2a3050] max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Record Client Outcome</DialogTitle>
              <DialogDescription className="text-[#7a88a8]">
                Record when a client renews, churns, or changes service levels
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Client Select */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Client
                </label>
                <Select value={form.clientId} onValueChange={(value) =>
                  setForm({ ...form, clientId: value })
                }>
                  <SelectTrigger className="bg-[#1a1f35] border-[#2a3050] text-white">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111827] border-[#2a3050]">
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id} className="text-white">
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Outcome Type */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Outcome Type
                </label>
                <Select
                  value={form.outcomeType}
                  onValueChange={(value: any) =>
                    setForm({ ...form, outcomeType: value })
                  }
                >
                  <SelectTrigger className="bg-[#1a1f35] border-[#2a3050] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111827] border-[#2a3050]">
                    <SelectItem value="renewed" className="text-white">
                      Renewed
                    </SelectItem>
                    <SelectItem value="expanded" className="text-white">
                      Expanded
                    </SelectItem>
                    <SelectItem value="downgraded" className="text-white">
                      Downgraded
                    </SelectItem>
                    <SelectItem value="paused" className="text-white">
                      Paused
                    </SelectItem>
                    <SelectItem value="churned" className="text-white">
                      Churned
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Outcome Date */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Outcome Date
                </label>
                <Input
                  type="date"
                  value={form.outcomeDate}
                  onChange={(e) =>
                    setForm({ ...form, outcomeDate: e.target.value })
                  }
                  className="bg-[#1a1f35] border-[#2a3050] text-white"
                />
              </div>

              {/* Previous Retainer */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Previous Retainer
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.previousRetainer}
                  onChange={(e) =>
                    setForm({ ...form, previousRetainer: e.target.value })
                  }
                  className="bg-[#1a1f35] border-[#2a3050] text-white placeholder-[#7a88a8]/50"
                />
              </div>

              {/* New Retainer */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  New Retainer
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.newRetainer}
                  onChange={(e) =>
                    setForm({ ...form, newRetainer: e.target.value })
                  }
                  className="bg-[#1a1f35] border-[#2a3050] text-white placeholder-[#7a88a8]/50"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Reason
                </label>
                <Input
                  placeholder="Why did this outcome occur?"
                  value={form.reason}
                  onChange={(e) =>
                    setForm({ ...form, reason: e.target.value })
                  }
                  className="bg-[#1a1f35] border-[#2a3050] text-white placeholder-[#7a88a8]/50"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Notes
                </label>
                <textarea
                  placeholder="Additional notes..."
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  className="w-full bg-[#1a1f35] border border-[#2a3050] rounded-md text-white placeholder-[#7a88a8]/50 p-2 text-sm h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-[#2a3050] text-[#7a88a8] hover:bg-[#1a1f35]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-[#e74c3c] hover:bg-[#c0392b] text-white"
                >
                  Record Outcome
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:border-[#e74c3c]/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#7a88a8] text-sm font-medium mb-1">
                  Total Outcomes
                </p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="p-3 bg-[#e74c3c]/10 rounded-lg text-[#e74c3c]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-[#e74c3c]/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#7a88a8] text-sm font-medium mb-1">
                  Churned
                </p>
                <p className="text-2xl font-bold text-[#e74c3c]">{stats.churned}</p>
              </div>
              <div className="p-3 bg-[#e74c3c]/10 rounded-lg text-[#e74c3c]">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-[#e74c3c]/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#7a88a8] text-sm font-medium mb-1">
                  Renewed
                </p>
                <p className="text-2xl font-bold text-green-400">{stats.renewed}</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg text-green-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-[#e74c3c]/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#7a88a8] text-sm font-medium mb-1">
                  Expansion Revenue
                </p>
                <p className="text-2xl font-bold text-blue-400">
                  ${(stats.expansionRevenue / 1000).toFixed(1)}k
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <p className="text-sm text-[#7a88a8] font-medium">Filter by outcome:</p>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48 bg-[#1a1f35] border-[#2a3050] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#111827] border-[#2a3050]">
            <SelectItem value="all" className="text-white">
              All Outcomes
            </SelectItem>
            <SelectItem value="renewed" className="text-white">
              Renewed
            </SelectItem>
            <SelectItem value="expanded" className="text-white">
              Expanded
            </SelectItem>
            <SelectItem value="downgraded" className="text-white">
              Downgraded
            </SelectItem>
            <SelectItem value="paused" className="text-white">
              Paused
            </SelectItem>
            <SelectItem value="churned" className="text-white">
              Churned
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Outcomes List */}
      <div>
        {filteredOutcomes.length === 0 ? (
          <Card className="border-[#2a3050]">
            <CardContent className="p-12 text-center">
              <p className="text-[#7a88a8] mb-2">No outcomes recorded yet</p>
              <p className="text-sm text-[#7a88a8]/60">
                Start by recording your first client outcome
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOutcomes.map((outcome) => {
              const client = clients.find((c) => c.id === outcome.clientId);
              const retainerChange =
                (outcome.newRetainer || 0) - (outcome.previousRetainer || 0);

              return (
                <Card
                  key={outcome.id}
                  className="border-[#2a3050] hover:border-[#3a4060] transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="p-3 rounded-lg bg-[#1a1f35]">
                        {getOutcomeIcon(outcome.outcomeType)}
                      </div>

                      {/* Main Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-white font-medium">
                            {outcome.clientName || client?.name}
                          </p>
                          <Badge className={getOutcomeColor(outcome.outcomeType)}>
                            {getOutcomeLabel(outcome.outcomeType)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                          <div>
                            <p className="text-[#7a88a8] text-xs mb-1">Date</p>
                            <p className="text-white font-medium">
                              {new Date(outcome.outcomeDate).toLocaleDateString()}
                            </p>
                          </div>
                          {outcome.previousRetainer && (
                            <div>
                              <p className="text-[#7a88a8] text-xs mb-1">
                                Previous Retainer
                              </p>
                              <p className="text-white font-medium">
                                ${(outcome.previousRetainer / 1000).toFixed(1)}k
                              </p>
                            </div>
                          )}
                          {outcome.newRetainer && (
                            <div>
                              <p className="text-[#7a88a8] text-xs mb-1">
                                New Retainer
                              </p>
                              <p className="text-white font-medium">
                                ${(outcome.newRetainer / 1000).toFixed(1)}k
                              </p>
                            </div>
                          )}
                        </div>

                        {retainerChange !== 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-[#7a88a8] mb-1">
                              Retainer Change
                            </p>
                            <p
                              className={`font-medium ${
                                retainerChange > 0
                                  ? 'text-green-400'
                                  : 'text-[#e74c3c]'
                              }`}
                            >
                              {retainerChange > 0 ? '+' : ''}${(
                                retainerChange / 1000
                              ).toFixed(1)}k
                            </p>
                          </div>
                        )}

                        {outcome.reason && (
                          <div className="mb-2">
                            <p className="text-xs text-[#7a88a8] mb-1">Reason</p>
                            <p className="text-sm text-white">
                              {outcome.reason}
                            </p>
                          </div>
                        )}

                        {outcome.notes && (
                          <div>
                            <p className="text-xs text-[#7a88a8] mb-1">Notes</p>
                            <p className="text-sm text-[#7a88a8]">
                              {outcome.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
