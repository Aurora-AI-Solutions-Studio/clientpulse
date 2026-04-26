'use client';

// Clients list — real data only. Drops the MOCK_CLIENTS shim that was the
// root cause of the per-client 500 (clicking a fake id "1" hit the new
// real-data API, which had no row to find). Inherits the new visual
// language: layered surfaces, gradient accents on tier-style filters,
// soft hover glow on cards.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import ClientCard from '@/components/clients/client-card';
import AddClientDialog from '@/components/clients/add-client-dialog';
import { Client, ClientCreateInput } from '@/types/client';
import { useToast } from '@/components/ui/use-toast';

type HealthFilter = 'all' | 'healthy' | 'at-risk' | 'critical';

const HEALTH_FILTERS: Array<{
  id: HealthFilter;
  label: string;
  dot?: string;
  active: string;
}> = [
  {
    id: 'all',
    label: 'All',
    active:
      'text-white shadow-[0_0_18px_-4px_rgba(56,232,200,0.4)] bg-gradient-to-r from-[#38e8c8] to-[#4cc9f0]',
  },
  {
    id: 'healthy',
    label: 'Healthy',
    dot: 'bg-green-400',
    active: 'bg-green-500/20 text-green-300 border border-green-500/30',
  },
  {
    id: 'at-risk',
    label: 'At Risk',
    dot: 'bg-amber-400',
    active: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  },
  {
    id: 'critical',
    label: 'Critical',
    dot: 'bg-red-400',
    active: 'bg-[#e74c3c]/20 text-[#e74c3c] border border-[#e74c3c]/30',
  },
];

export default function ClientsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load + reload after add
  const reload = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clients', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load clients (${res.status})`);
      const data: Client[] = await res.json();
      setClients(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    let out = clients;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      out = out.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q),
      );
    }
    if (healthFilter !== 'all') {
      out = out.filter((c) => c.healthScore?.status === healthFilter);
    }
    return out;
  }, [clients, searchTerm, healthFilter]);

  const handleAddClient = async (data: ClientCreateInput) => {
    setIsAdding(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add client');
      const newClient = await res.json();
      setClients((prev) => [newClient, ...prev]);
      toast({ title: 'Client added', description: `${newClient.name} is now tracked.` });
    } catch (err) {
      console.error('Error adding client:', err);
      toast({
        title: 'Could not add client',
        description: 'Try again. If it keeps failing, check your tier limit.',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-playfair font-bold text-white tracking-tight">
            Clients
          </h1>
          <p className="text-base text-[#c8d0e0] mt-2 max-w-2xl">
            Your portfolio. Click any client to see signals, actions, health, and alerts.
          </p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-gradient-to-r from-[#38e8c8] to-[#4cc9f0] text-[#0a1f1a] font-semibold hover:opacity-95 shadow-[0_4px_18px_-4px_rgba(56,232,200,0.4)]"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add client
        </Button>
      </div>

      {/* Search + filter */}
      <Card className="p-4 bg-gradient-to-b from-[#0c1220] to-[#0a0f1a] border border-[#141e33]">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6580]" />
            <Input
              placeholder="Search by client name or company…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#06090f] border-[#141e33] text-white placeholder-[#5a6580] focus:border-[#38e8c8]/50 focus:ring-1 focus:ring-[#38e8c8]/20"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {HEALTH_FILTERS.map((f) => {
              const active = healthFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setHealthFilter(f.id)}
                  className={`px-3.5 py-2 rounded-md text-xs font-medium transition-all inline-flex items-center gap-2 ${
                    active
                      ? f.active
                      : 'bg-[#0a0f1a] text-[#a0adc4] border border-[#141e33] hover:text-white hover:border-[#1a2540]'
                  }`}
                >
                  {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Body */}
      {loading ? (
        <Card className="p-12 text-center bg-[#0c1220] border-[#141e33]">
          <p className="text-[#a0adc4]">Loading clients…</p>
        </Card>
      ) : error ? (
        <Card className="p-12 text-center bg-red-500/5 border border-red-500/30">
          <p className="text-red-300 mb-4">{error}</p>
          <Button onClick={reload} variant="outline" className="border-[#1a2540]">
            Try again
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-to-b from-[#0c1220] to-[#0a0f1a] border border-[#141e33]">
          <div className="space-y-4 max-w-md mx-auto">
            <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#38e8c8]/20 to-[#b388eb]/20 border border-[#1a2540]">
              <Users className="w-6 h-6 text-[#38e8c8]" />
            </div>
            {clients.length === 0 ? (
              <>
                <h3 className="text-lg font-semibold text-white">No clients yet</h3>
                <p className="text-sm text-[#a0adc4]">
                  Add your first client to start tracking health signals, brief recommendations,
                  and action items.
                </p>
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  className="bg-gradient-to-r from-[#38e8c8] to-[#4cc9f0] text-[#0a1f1a] font-semibold hover:opacity-95"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add your first client
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white">No matches</h3>
                <p className="text-sm text-[#a0adc4]">
                  Adjust the search or health filter to see more clients.
                </p>
              </>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={() => router.push(`/dashboard/clients/${client.id}`)}
            />
          ))}
        </div>
      )}

      <AddClientDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleAddClient}
        isLoading={isAdding}
      />
    </div>
  );
}
