'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Briefcase,
  AlertTriangle,
  TrendingUp,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TeamMemberSummary } from '@/types/team';
import { Client } from '@/types/client';
import { useToast } from '@/components/ui/use-toast';

interface ClientWithAssignment extends Client {
  assignedTo?: string;
  assignedToName?: string;
}

export default function TeamDashboardPage() {
  const [members, setMembers] = useState<TeamMemberSummary[]>([]);
  const [clients, setClients] = useState<ClientWithAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithAssignment | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, clientsRes] = await Promise.all([
        fetch('/api/team'),
        fetch('/api/clients'),
      ]);

      if (!membersRes.ok || !clientsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const membersData = await membersRes.json();
      const clientsData = await clientsRes.json();

      setMembers(membersData.data || []);
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

  const handleAssignClient = async () => {
    if (!selectedClient || !selectedMemberId) {
      toast({
        title: 'Error',
        description: 'Please select a member',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(`/api/clients/${selectedClient.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedMemberId }),
      });

      if (!res.ok) {
        throw new Error('Failed to assign client');
      }

      toast({
        title: 'Success',
        description: `${selectedClient.name} assigned to team member`,
      });

      setIsAssignDialogOpen(false);
      setSelectedClient(null);
      setSelectedMemberId('');
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign client';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const getHealthStatus = (score: number) => {
    if (score >= 70) return { status: 'healthy', color: 'text-green-400' };
    if (score >= 50) return { status: 'at-risk', color: 'text-yellow-500' };
    return { status: 'critical', color: 'text-[#e74c3c]' };
  };

  const getHealthBgColor = (score: number) => {
    if (score >= 70) return 'bg-green-500/20';
    if (score >= 50) return 'bg-yellow-500/20';
    return 'bg-[#e74c3c]/20';
  };

  const unassignedClients = clients.filter((c) => !c.assignedTo);
  const totalTeamClients = clients.length;
  const totalMembers = members.length;
  const avgTeamHealth = members.length > 0
    ? Math.round(members.reduce((sum, m) => sum + m.avgHealthScore, 0) / members.length)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-[#7a88a8] mb-2">Loading team dashboard...</p>
          <div className="w-8 h-8 border-2 border-[#e74c3c]/30 border-t-[#e74c3c] rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white font-playfair mb-2">
          Team Performance
        </h2>
        <p className="text-[#7a88a8]">
          Overview of team members and client assignments
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:border-[#e74c3c]/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#7a88a8] text-sm font-medium mb-1">
                  Total Team
                </p>
                <p className="text-2xl font-bold text-white">{totalMembers}</p>
              </div>
              <div className="p-3 bg-[#e74c3c]/10 rounded-lg text-[#e74c3c]">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-[#e74c3c]/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#7a88a8] text-sm font-medium mb-1">
                  Total Clients
                </p>
                <p className="text-2xl font-bold text-white">{totalTeamClients}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-[#e74c3c]/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#7a88a8] text-sm font-medium mb-1">
                  Unassigned
                </p>
                <p className="text-2xl font-bold text-white">
                  {unassignedClients.length}
                </p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-500">
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
                  Avg Health
                </p>
                <p className="text-2xl font-bold text-white">{avgTeamHealth}%</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg text-green-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members Performance Cards */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          Team Member Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.length === 0 ? (
            <Card className="border-[#2a3050]">
              <CardContent className="p-12 text-center">
                <p className="text-[#7a88a8]">No team members</p>
              </CardContent>
            </Card>
          ) : (
            members.map((member) => {
              const health = getHealthStatus(member.avgHealthScore);
              return (
                <Card
                  key={member.userId}
                  className="border-[#2a3050] hover:border-[#3a4060] transition-colors"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-[#e74c3c]/20 text-[#e74c3c]">
                            {member.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">
                            {member.fullName}
                          </CardTitle>
                          <CardDescription className="text-[#7a88a8] text-xs">
                            {member.email}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className={health.color.replace('text-', 'bg-') + '/20 ' + health.color}>
                        {health.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Client Count */}
                    <div className="flex items-center justify-between p-3 bg-[#1a1f35] rounded-lg">
                      <span className="text-sm text-[#7a88a8]">Assigned Clients</span>
                      <span className="text-lg font-bold text-white">
                        {member.assignedClients}
                      </span>
                    </div>

                    {/* Health Breakdown */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#7a88a8]">Healthy</span>
                        <span className="text-green-400 font-medium">
                          {member.healthyClients}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#7a88a8]">At-Risk</span>
                        <span className="text-yellow-500 font-medium">
                          {member.atRiskClients}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#7a88a8]">Critical</span>
                        <span className="text-[#e74c3c] font-medium">
                          {member.criticalClients}
                        </span>
                      </div>
                    </div>

                    {/* Health Score Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#7a88a8]">Avg Health Score</span>
                        <span className={`font-bold ${health.color}`}>
                          {member.avgHealthScore}%
                        </span>
                      </div>
                      <div className="w-full bg-[#0a0e1a] rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${
                            member.avgHealthScore >= 70
                              ? 'bg-green-400'
                              : member.avgHealthScore >= 50
                              ? 'bg-yellow-500'
                              : 'bg-[#e74c3c]'
                          } transition-all`}
                          style={{
                            width: `${member.avgHealthScore}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Client Assignment Section */}
      {unassignedClients.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">
            Unassigned Clients
          </h3>
          <div className="space-y-3">
            {unassignedClients.map((client) => (
              <Card
                key={client.id}
                className="border-[#2a3050] hover:border-[#3a4060] transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-medium">{client.name}</p>
                        {client.healthScore && (
                          <Badge
                            className={
                              getHealthBgColor(client.healthScore.overall) +
                              ' ' +
                              getHealthStatus(client.healthScore.overall).color
                            }
                          >
                            {client.healthScore.overall}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#7a88a8]">
                        {client.company} • {client.serviceType}
                      </p>
                    </div>

                    <Dialog
                      open={
                        isAssignDialogOpen && selectedClient?.id === client.id
                      }
                      onOpenChange={(open) => {
                        if (!open) {
                          setIsAssignDialogOpen(false);
                          setSelectedClient(null);
                          setSelectedMemberId('');
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedClient(client);
                            setIsAssignDialogOpen(true);
                          }}
                          className="bg-[#e74c3c] hover:bg-[#c0392b] text-white"
                        >
                          Assign
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#111827] border border-[#2a3050]">
                        <DialogHeader>
                          <DialogTitle className="text-white">
                            Assign {client.name}
                          </DialogTitle>
                          <DialogDescription className="text-[#7a88a8]">
                            Select a team member to assign this client to
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Select
                            value={selectedMemberId}
                            onValueChange={setSelectedMemberId}
                          >
                            <SelectTrigger className="bg-[#1a1f35] border-[#2a3050] text-white">
                              <SelectValue placeholder="Select a team member" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#111827] border-[#2a3050]">
                              {members.map((member) => (
                                <SelectItem
                                  key={member.userId}
                                  value={member.userId}
                                  className="text-white"
                                >
                                  {member.fullName} ({member.assignedClients}{' '}
                                  clients)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex justify-end gap-3 pt-4">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsAssignDialogOpen(false);
                                setSelectedClient(null);
                                setSelectedMemberId('');
                              }}
                              className="border-[#2a3050] text-[#7a88a8] hover:bg-[#1a1f35]"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleAssignClient}
                              className="bg-[#e74c3c] hover:bg-[#c0392b] text-white"
                            >
                              Assign
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {unassignedClients.length === 0 && clients.length > 0 && (
        <Card className="border-[#2a3050] bg-green-500/5">
          <CardContent className="p-6 text-center">
            <p className="text-green-400 font-medium">
              All clients are assigned
            </p>
            <p className="text-sm text-[#7a88a8] mt-1">
              Great job keeping your portfolio organized
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
