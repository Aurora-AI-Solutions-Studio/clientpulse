'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import ClientCard from '@/components/clients/client-card';
import AddClientDialog from '@/components/clients/add-client-dialog';
import { Client, ClientCreateInput } from '@/types/client';
import { useToast } from '@/components/ui/use-toast';

// Mock data for demonstration
const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'Acme Corporation',
    company: 'Acme Inc.',
    contactEmail: 'contact@acme.com',
    monthlyRetainer: 500000,
    serviceType: 'Full Service',
    status: 'active',
    healthScore: {
      overall: 85,
      breakdown: {
        financial: 90,
        relationship: 82,
        delivery: 88,
        engagement: 78,
      },
      lastUpdated: new Date().toISOString(),
      status: 'healthy',
    },
    lastMeetingDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Long-term partner, excellent collaboration',
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    agencyId: 'agency-1',
  },
  {
    id: '2',
    name: 'TechStart Solutions',
    company: 'TechStart Labs',
    contactEmail: 'hello@techstart.io',
    monthlyRetainer: 350000,
    serviceType: 'SEO',
    status: 'active',
    healthScore: {
      overall: 65,
      breakdown: {
        financial: 70,
        relationship: 60,
        delivery: 68,
        engagement: 58,
      },
      lastUpdated: new Date().toISOString(),
      status: 'at-risk',
    },
    lastMeetingDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Recently requesting fewer deliverables',
    createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    agencyId: 'agency-1',
  },
  {
    id: '3',
    name: 'Design Hub',
    company: 'Creative Design Co.',
    contactEmail: 'team@designhub.com',
    monthlyRetainer: 250000,
    serviceType: 'Design',
    status: 'active',
    healthScore: {
      overall: 72,
      breakdown: {
        financial: 75,
        relationship: 70,
        delivery: 74,
        engagement: 68,
      },
      lastUpdated: new Date().toISOString(),
      status: 'healthy',
    },
    lastMeetingDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Growing partnership, expanding service scope',
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    agencyId: 'agency-1',
  },
  {
    id: '4',
    name: 'Social First Media',
    company: 'Social Media Ventures',
    contactEmail: 'contact@socialfirst.com',
    monthlyRetainer: 180000,
    serviceType: 'Social',
    status: 'active',
    healthScore: {
      overall: 45,
      breakdown: {
        financial: 50,
        relationship: 40,
        delivery: 48,
        engagement: 35,
      },
      lastUpdated: new Date().toISOString(),
      status: 'at-risk',
    },
    lastMeetingDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'No recent engagement, may be exploring alternatives',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    agencyId: 'agency-1',
  },
  {
    id: '5',
    name: 'Content Masters',
    company: 'Master Content Group',
    contactEmail: 'sales@contentmasters.io',
    monthlyRetainer: 220000,
    serviceType: 'Content',
    status: 'paused',
    healthScore: {
      overall: 35,
      breakdown: {
        financial: 40,
        relationship: 30,
        delivery: 35,
        engagement: 25,
      },
      lastUpdated: new Date().toISOString(),
      status: 'critical',
    },
    lastMeetingDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Paused due to budget constraints',
    createdAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    agencyId: 'agency-1',
  },
  {
    id: '6',
    name: 'PR Innovations',
    company: 'Innovative PR Solutions',
    contactEmail: 'hello@prinnovations.com',
    monthlyRetainer: 420000,
    serviceType: 'PR',
    status: 'active',
    healthScore: {
      overall: 92,
      breakdown: {
        financial: 95,
        relationship: 90,
        delivery: 93,
        engagement: 88,
      },
      lastUpdated: new Date().toISOString(),
      status: 'healthy',
    },
    lastMeetingDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Outstanding partnership, expanding scope',
    createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    agencyId: 'agency-1',
  },
];

export default function ClientsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [filteredClients, setFilteredClients] = useState<Client[]>(MOCK_CLIENTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filter clients based on search and health status
  useEffect(() => {
    let filtered = clients;

    if (searchTerm) {
      filtered = filtered.filter(
        (client) =>
          client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.company.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (healthFilter !== 'all') {
      filtered = filtered.filter(
        (client) => client.healthScore?.status === healthFilter
      );
    }

    setFilteredClients(filtered);
  }, [searchTerm, healthFilter, clients]);

  const handleAddClient = async (data: ClientCreateInput) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to add client');
      }

      const newClient = await response.json();
      setClients([newClient, ...clients]);
      toast({
        title: 'Success',
        description: `${newClient.name} has been added.`,
      });
    } catch (error) {
      console.error('Error adding client:', error);
      toast({
        title: 'Error',
        description: 'Failed to add client. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Clients</h1>
          <p className="text-[#7a88a8] mt-1">
            Monitor and manage your client portfolio
          </p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-[#e74c3c] hover:bg-[#d43d2d] gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className="p-4 bg-[#0d1422] border-[#1a2540]">
        <div className="flex gap-4 flex-wrap">
          {/* Search Bar */}
          <div className="flex-1 min-w-[250px] relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-[#7a88a8]" />
            <Input
              placeholder="Search by client name or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#06090f] border-[#1a2540] text-white placeholder-[#7a88a8]"
            />
          </div>

          {/* Health Status Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setHealthFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                healthFilter === 'all'
                  ? 'bg-[#e74c3c] text-white'
                  : 'bg-[#0d1422] text-[#7a88a8] border border-[#1a2540] hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setHealthFilter('healthy')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                healthFilter === 'healthy'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/20'
                  : 'bg-[#0d1422] text-[#7a88a8] border border-[#1a2540] hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              Healthy
            </button>
            <button
              onClick={() => setHealthFilter('at-risk')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                healthFilter === 'at-risk'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20'
                  : 'bg-[#0d1422] text-[#7a88a8] border border-[#1a2540] hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              At Risk
            </button>
            <button
              onClick={() => setHealthFilter('critical')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                healthFilter === 'critical'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/20'
                  : 'bg-[#0d1422] text-[#7a88a8] border border-[#1a2540] hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              Critical
            </button>
          </div>
        </div>
      </Card>

      {/* Clients Grid */}
      {filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={() => router.push(`/dashboard/clients/${client.id}`)}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center bg-[#0d1422] border-[#1a2540]">
          <div className="space-y-4">
            <div className="text-5xl">📭</div>
            <h3 className="text-lg font-semibold text-white">No clients found</h3>
            <p className="text-[#7a88a8]">
              {searchTerm || healthFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first client'}
            </p>
            {!searchTerm && healthFilter === 'all' && (
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-[#e74c3c] hover:bg-[#d43d2d] mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Client
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Add Client Dialog */}
      <AddClientDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleAddClient}
        isLoading={isLoading}
      />
    </div>
  );
}
