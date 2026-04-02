import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Shield, Users, Clock, CheckCircle2, XCircle,
  Trash2, ChevronDown, Loader2, Crown, UserCheck,
} from 'lucide-react';
import { listUsers, updateUser, deleteUser, type AdminUser } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { ConfirmModal } from '../ui/ConfirmModal';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-100  dark:bg-amber-500/20  text-amber-700  dark:text-amber-300',
  approved: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-red-100    dark:bg-red-500/20    text-red-700    dark:text-red-300',
};

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300',
  user:  'bg-slate-100  dark:bg-slate-700      text-slate-600  dark:text-slate-300',
};

interface Props { onClose: () => void; }

export function OwnerDashboard({ onClose }: Props) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<FilterTab>('all');
  const [confirm, setConfirm] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: listUsers,
    refetchInterval: 30_000,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  function ask(title: string, message: string, action: () => void) {
    setConfirm({ open: true, title, message, onConfirm: () => { setConfirm(c => ({ ...c, open: false })); action(); } });
  }

  const filtered = tab === 'all' ? users : users.filter(u => u.status === tab);
  const pendingCount = users.filter(u => u.status === 'pending').length;

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all',      label: `All (${users.length})` },
    { key: 'pending',  label: `Pending (${pendingCount})` },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <>
      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel="Confirm"
        danger
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm(c => ({ ...c, open: false }))}
      />

      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white dark:bg-[#1E293B] border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/20">
            <Shield className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Platform Owner Dashboard</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Manage users and access requests</p>
          </div>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">
              <Clock className="w-3 h-3" />
              {pendingCount} pending
            </span>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'bg-slate-900 dark:bg-white/10 text-white dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No users in this category</p>
            </div>
          )}

          {filtered.map(user => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUser?.id}
              onApprove={() =>
                patchMutation.mutate({ id: user.id, patch: { status: 'approved' } })
              }
              onReject={() =>
                ask(
                  `Reject ${user.name}?`,
                  `${user.name} (${user.email}) will be denied access to the platform.`,
                  () => patchMutation.mutate({ id: user.id, patch: { status: 'rejected' } }),
                )
              }
              onPromote={() =>
                ask(
                  `Promote ${user.name} to Platform Owner?`,
                  'They will gain full administrative access.',
                  () => patchMutation.mutate({ id: user.id, patch: { role: 'owner' } }),
                )
              }
              onDemote={() =>
                ask(
                  `Remove Platform Owner from ${user.name}?`,
                  'They will revert to a standard user.',
                  () => patchMutation.mutate({ id: user.id, patch: { role: 'user' } }),
                )
              }
              onDelete={() =>
                ask(
                  `Delete ${user.name}?`,
                  `This will permanently remove ${user.email} from the platform.`,
                  () => deleteMutation.mutate(user.id),
                )
              }
              isMutating={patchMutation.isPending || deleteMutation.isPending}
            />
          ))}
        </div>
      </div>
    </>
  );
}

interface RowProps {
  user: AdminUser;
  isSelf: boolean;
  onApprove: () => void;
  onReject: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onDelete: () => void;
  isMutating: boolean;
}

function UserRow({ user, isSelf, onApprove, onReject, onPromote, onDemote, onDelete, isMutating }: RowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl">
      {/* Avatar */}
      {user.avatar ? (
        <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full shrink-0 object-cover" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center shrink-0 text-white text-sm font-bold">
          {user.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</span>
          {isSelf && <span className="text-[10px] text-slate-400 dark:text-slate-500">(you)</span>}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
          Joined {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[user.status]}`}>
          {user.status}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_STYLES[user.role]}`}>
          {user.role === 'owner' ? '★ owner' : 'user'}
        </span>
      </div>

      {/* Quick-action buttons for pending users */}
      {user.status === 'pending' && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onApprove}
            disabled={isMutating}
            title="Approve"
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3 h-3" />
            Approve
          </button>
          <button
            onClick={onReject}
            disabled={isMutating}
            title="Reject"
            className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
          >
            <XCircle className="w-3 h-3" />
            Reject
          </button>
        </div>
      )}

      {/* More actions menu */}
      {!isSelf && (
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                {user.status === 'approved' && (
                  <button
                    onClick={() => { setMenuOpen(false); onReject(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Revoke access
                  </button>
                )}
                {user.status === 'rejected' && (
                  <button
                    onClick={() => { setMenuOpen(false); onApprove(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Re-approve
                  </button>
                )}
                {user.role === 'user' ? (
                  <button
                    onClick={() => { setMenuOpen(false); onPromote(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Crown className="w-3.5 h-3.5" /> Make Platform Owner
                  </button>
                ) : (
                  <button
                    onClick={() => { setMenuOpen(false); onDemote(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Crown className="w-3.5 h-3.5" /> Remove Owner role
                  </button>
                )}
                <div className="border-t border-slate-200 dark:border-slate-700" />
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete user
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
