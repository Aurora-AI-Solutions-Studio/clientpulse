'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Mail,
  Trash2,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AgencyMember, TeamInvitation } from '@/types/team';
import { useToast } from '@/components/ui/use-toast';

interface InviteFormData {
  email: string;
  role: 'owner' | 'manager' | 'viewer';
}

export default function TeamPage() {
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<TeamInvitation | null>(null);
  const [selectedMember, setSelectedMember] = useState<AgencyMember | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    email: '',
    role: 'manager',
  });
  const [, setChangedRoles] = useState<Record<string, 'owner' | 'manager' | 'viewer'>>({});
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch('/api/team'),
        fetch('/api/team/invitations'),
      ]);

      if (!membersRes.ok || !invitationsRes.ok) {
        throw new Error('Failed to fetch team data');
      }

      const membersData = await membersRes.json();
      const invitationsData = await invitationsRes.json();

      setMembers(membersData.data || []);
      setInvitations(invitationsData.data || []);
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

  const handleInvite = async () => {
    if (!inviteForm.email) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email,
          role: inviteForm.role,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to send invitation');
      }

      toast({
        title: 'Success',
        description: `Invitation sent to ${inviteForm.email}`,
      });

      setInviteForm({ email: '', role: 'manager' });
      setIsInviteDialogOpen(false);
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleRevokeInvitation = async () => {
    if (!selectedInvitation) return;

    try {
      const res = await fetch(`/api/team/invitations/${selectedInvitation.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to revoke invitation');
      }

      toast({
        title: 'Success',
        description: 'Invitation revoked',
      });

      setIsRevokeDialogOpen(false);
      setSelectedInvitation(null);
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke invitation';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    try {
      const res = await fetch(`/api/team/${selectedMember.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to remove member');
      }

      toast({
        title: 'Success',
        description: `${selectedMember.fullName} removed from team`,
      });

      setIsRemoveDialogOpen(false);
      setSelectedMember(null);
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleChangeRole = async (memberId: string, newRole: 'owner' | 'manager' | 'viewer') => {
    setChangedRoles((prev) => ({ ...prev, [memberId]: newRole }));

    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        throw new Error('Failed to update role');
      }

      toast({
        title: 'Success',
        description: 'Role updated',
      });

      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update role';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setChangedRoles((prev) => {
        const updated = { ...prev };
        delete updated[memberId];
        return updated;
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const getRoleColor = (role: 'owner' | 'manager' | 'viewer') => {
    switch (role) {
      case 'owner':
        return 'bg-[#e74c3c]/20 text-[#e74c3c]';
      case 'manager':
        return 'bg-blue-500/20 text-blue-400';
      case 'viewer':
        return 'bg-[#7a88a8]/20 text-[#7a88a8]';
    }
  };

  const getInvitationStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'expired':
        return <XCircle className="w-4 h-4 text-[#e74c3c]" />;
      case 'revoked':
        return <XCircle className="w-4 h-4 text-[#7a88a8]" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getInvitationStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'accepted':
        return 'bg-green-500/20 text-green-400';
      case 'expired':
      case 'revoked':
        return 'bg-[#e74c3c]/20 text-[#e74c3c]';
      default:
        return 'bg-[#7a88a8]/20 text-[#7a88a8]';
    }
  };

  const membersByRole = {
    owner: members.filter((m) => m.role === 'owner'),
    manager: members.filter((m) => m.role === 'manager'),
    viewer: members.filter((m) => m.role === 'viewer'),
  };

  const totalMembers = members.length;
  const pendingInvitations = invitations.filter((i) => i.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-[#7a88a8] mb-2">Loading team data...</p>
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
          <h2 className="text-3xl text-white mb-2">
            Team Management
          </h2>
          <p className="text-[#7a88a8]">
            Manage team members and invitations
          </p>
        </div>
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#e74c3c] hover:bg-[#c0392b] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111827] border border-[#2a3050]">
            <DialogHeader>
              <DialogTitle className="text-white">Invite Team Member</DialogTitle>
              <DialogDescription className="text-[#7a88a8]">
                Send an invitation to join your team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="member@example.com"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  className="bg-[#1a1f35] border-[#2a3050] text-white placeholder-[#7a88a8]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Role
                </label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value: string) =>
                    setInviteForm({ ...inviteForm, role: value as InviteFormData['role'] })
                  }
                >
                  <SelectTrigger className="bg-[#1a1f35] border-[#2a3050] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111827] border-[#2a3050]">
                    <SelectItem value="viewer" className="text-white">
                      Viewer
                    </SelectItem>
                    <SelectItem value="manager" className="text-white">
                      Manager
                    </SelectItem>
                    <SelectItem value="owner" className="text-white">
                      Owner
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsInviteDialogOpen(false)}
                  className="border-[#2a3050] text-[#7a88a8] hover:bg-[#1a1f35]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInvite}
                  className="bg-[#e74c3c] hover:bg-[#c0392b] text-white"
                >
                  Send Invitation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:border-[#e74c3c]/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#7a88a8] text-sm font-medium mb-1">
                  Total Members
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
                  Managers
                </p>
                <p className="text-2xl font-bold text-white">
                  {membersByRole.manager.length}
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
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
                  Pending Invites
                </p>
                <p className="text-2xl font-bold text-white">
                  {pendingInvitations}
                </p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-500">
                <Mail className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-[#1a1f35] border border-[#2a3050]">
          <TabsTrigger
            value="members"
            className="data-[state=active]:bg-[#e74c3c] data-[state=active]:text-white"
          >
            Members
          </TabsTrigger>
          <TabsTrigger
            value="invitations"
            className="data-[state=active]:bg-[#e74c3c] data-[state=active]:text-white"
          >
            Invitations
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          {members.length === 0 ? (
            <Card className="border-[#2a3050]">
              <CardContent className="p-12 text-center">
                <p className="text-[#7a88a8] mb-2">No team members yet</p>
                <p className="text-sm text-[#7a88a8]/60">
                  Invite members to build your team
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {membersByRole.owner.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#7a88a8] mb-3 uppercase tracking-wide">
                    Owners
                  </h3>
                  <div className="space-y-3">
                    {membersByRole.owner.map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        onChangeRole={handleChangeRole}
                        onRemove={() => {
                          setSelectedMember(member);
                          setIsRemoveDialogOpen(true);
                        }}
                        getInitials={getInitials}
                        getRoleColor={getRoleColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {membersByRole.manager.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#7a88a8] mb-3 uppercase tracking-wide">
                    Managers
                  </h3>
                  <div className="space-y-3">
                    {membersByRole.manager.map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        onChangeRole={handleChangeRole}
                        onRemove={() => {
                          setSelectedMember(member);
                          setIsRemoveDialogOpen(true);
                        }}
                        getInitials={getInitials}
                        getRoleColor={getRoleColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {membersByRole.viewer.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#7a88a8] mb-3 uppercase tracking-wide">
                    Viewers
                  </h3>
                  <div className="space-y-3">
                    {membersByRole.viewer.map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        onChangeRole={handleChangeRole}
                        onRemove={() => {
                          setSelectedMember(member);
                          setIsRemoveDialogOpen(true);
                        }}
                        getInitials={getInitials}
                        getRoleColor={getRoleColor}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations" className="space-y-4">
          {invitations.length === 0 ? (
            <Card className="border-[#2a3050]">
              <CardContent className="p-12 text-center">
                <p className="text-[#7a88a8] mb-2">No pending invitations</p>
                <p className="text-sm text-[#7a88a8]/60">
                  All invitations have been accepted or expired
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <Card
                  key={invitation.id}
                  className="border-[#2a3050] hover:border-[#3a4060] transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-[#e74c3c]/20 text-[#e74c3c]">
                            {invitation.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="text-white font-medium">
                              {invitation.email}
                            </p>
                            <Badge className={getRoleColor(invitation.role)}>
                              {invitation.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#7a88a8]">
                            <span className="flex items-center gap-1">
                              {getInvitationStatusIcon(invitation.status)}
                              {invitation.status.charAt(0).toUpperCase() +
                                invitation.status.slice(1)}
                            </span>
                            <span>
                              Expires:{' '}
                              {new Date(invitation.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {invitation.status === 'pending' && (
                        <Dialog
                          open={
                            isRevokeDialogOpen &&
                            selectedInvitation?.id === invitation.id
                          }
                          onOpenChange={(open) => {
                            if (!open) {
                              setIsRevokeDialogOpen(false);
                              setSelectedInvitation(null);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedInvitation(invitation);
                                setIsRevokeDialogOpen(true);
                              }}
                              className="text-[#e74c3c] hover:bg-[#e74c3c]/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#111827] border border-[#2a3050]">
                            <DialogHeader>
                              <DialogTitle className="text-white">
                                Revoke Invitation
                              </DialogTitle>
                              <DialogDescription className="text-[#7a88a8]">
                                Are you sure you want to revoke the invitation sent to{' '}
                                {invitation.email}?
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-end gap-3 pt-4">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsRevokeDialogOpen(false);
                                  setSelectedInvitation(null);
                                }}
                                className="border-[#2a3050] text-[#7a88a8] hover:bg-[#1a1f35]"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleRevokeInvitation}
                                className="bg-[#e74c3c] hover:bg-[#c0392b] text-white"
                              >
                                Revoke
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <DialogContent className="bg-[#111827] border border-[#2a3050]">
          <DialogHeader>
            <DialogTitle className="text-white">Remove Member</DialogTitle>
            <DialogDescription className="text-[#7a88a8]">
              Are you sure you want to remove {selectedMember?.fullName} from the
              team? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsRemoveDialogOpen(false);
                setSelectedMember(null);
              }}
              className="border-[#2a3050] text-[#7a88a8] hover:bg-[#1a1f35]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRemoveMember}
              className="bg-[#e74c3c] hover:bg-[#c0392b] text-white"
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MemberCardProps {
  member: AgencyMember;
  onChangeRole: (id: string, role: 'owner' | 'manager' | 'viewer') => void;
  onRemove: () => void;
  getInitials: (name: string) => string;
  getRoleColor: (role: 'owner' | 'manager' | 'viewer') => string;
}

function MemberCard({
  member,
  onChangeRole,
  onRemove,
  getInitials,
  getRoleColor: _getRoleColor,
}: MemberCardProps) {
  return (
    <Card className="border-[#2a3050] hover:border-[#3a4060] transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <Avatar className="w-10 h-10">
              <AvatarImage src={member.avatarUrl} />
              <AvatarFallback className="bg-[#e74c3c]/20 text-[#e74c3c]">
                {getInitials(member.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-white font-medium">{member.fullName}</p>
              <p className="text-xs text-[#7a88a8]">{member.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={member.role}
              onValueChange={(value: string) => onChangeRole(member.id, value as 'owner' | 'manager' | 'viewer')}
            >
              <SelectTrigger className="w-32 bg-[#1a1f35] border-[#2a3050] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#111827] border-[#2a3050]">
                <SelectItem value="viewer" className="text-white">
                  Viewer
                </SelectItem>
                <SelectItem value="manager" className="text-white">
                  Manager
                </SelectItem>
                <SelectItem value="owner" className="text-white">
                  Owner
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-[#e74c3c] hover:bg-[#e74c3c]/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
