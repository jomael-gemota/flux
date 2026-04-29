import { useState, useEffect, useRef } from 'react';
import {
  X, Bell, BellOff, Plus, Trash2, Loader2, CheckCircle2,
  AlertCircle, Mail, Send, Info, ShieldAlert, CircleCheck, Lock,
  Workflow, Users, Globe,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotificationSettings,
  getNotificationSettingsForWorkflow,
  updateNotificationSettings,
  updateWorkflowNotifRecipients,
  sendTestEmail,
  type NotificationSettings,
  type WorkflowNotifOverride,
} from '../../api/client';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When provided the modal shows a per-workflow recipients section. */
  workflowId?: string;
  workflowName?: string;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/** Small pill that toggles between two labelled options. */
function SegmentControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-white/10 p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function NotificationSettingsModal({ open, onClose, workflowId, workflowName }: Props) {
  const queryClient = useQueryClient();
  const hasWorkflow = Boolean(workflowId);

  // ── Global settings query ──────────────────────────────────────────────
  const globalQuery = useQuery({
    queryKey: ['notification-settings'],
    queryFn: getNotificationSettings,
    enabled: open && !hasWorkflow,
    staleTime: 10_000,
  });

  // ── Workflow-specific query (includes workflowOverride in response) ────
  const workflowQuery = useQuery({
    queryKey: ['notification-settings', workflowId],
    queryFn: () => getNotificationSettingsForWorkflow(workflowId!),
    enabled: open && hasWorkflow,
    staleTime: 10_000,
  });

  const data: NotificationSettings | undefined = hasWorkflow ? workflowQuery.data : globalQuery.data;
  const isLoading = hasWorkflow ? workflowQuery.isLoading : globalQuery.isLoading;

  // ── Local state: global toggles + global recipients ───────────────────
  const [localSettings, setLocalSettings] = useState<NotificationSettings | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailError, setNewEmailError] = useState('');

  // ── Local state: per-workflow override ────────────────────────────────
  const [override, setOverride] = useState<WorkflowNotifOverride>({
    useCustomRecipients: false,
    recipients: [],
  });
  const [newWfEmail, setNewWfEmail] = useState('');
  const [newWfEmailError, setNewWfEmailError] = useState('');

  // ── Active tab (only relevant when a workflow is provided) ───────────
  const [activeTab, setActiveTab] = useState<'workflow' | 'global'>('workflow');

  // ── Save status for global section ───────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Save status for workflow-override section ─────────────────────────
  const [wfSaveStatus, setWfSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const wfSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Test email ────────────────────────────────────────────────────────
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Initialise local state whenever fresh server data arrives
  useEffect(() => {
    if (!data) return;
    setLocalSettings({ ...data });
    setOverride(
      data.workflowOverride ?? { useCustomRecipients: false, recipients: [] }
    );
  }, [data]);

  // Reset to workflow tab each time the modal opens for a new workflow
  useEffect(() => {
    if (open && hasWorkflow) setActiveTab('workflow');
  }, [open, workflowId]);

  // ── Global save mutation ──────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-settings'], updated);
      if (workflowId) {
        // Keep the workflow-query cache consistent
        queryClient.setQueryData(['notification-settings', workflowId], (prev: NotificationSettings | undefined) =>
          prev ? { ...updated, workflowOverride: prev.workflowOverride } : updated
        );
      }
      setLocalSettings({ ...updated, workflowOverride: localSettings?.workflowOverride });
      setSaveStatus('saved');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
    },
    onError: () => setSaveStatus('idle'),
  });

  // ── Per-workflow save mutation ────────────────────────────────────────
  const workflowMutation = useMutation({
    mutationFn: (ov: WorkflowNotifOverride) => updateWorkflowNotifRecipients(workflowId!, ov),
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-settings', workflowId], updated);
      setOverride(updated.workflowOverride ?? { useCustomRecipients: false, recipients: [] });
      setWfSaveStatus('saved');
      if (wfSaveTimerRef.current) clearTimeout(wfSaveTimerRef.current);
      wfSaveTimerRef.current = setTimeout(() => setWfSaveStatus('idle'), 2500);
    },
    onError: () => setWfSaveStatus('idle'),
  });

  // ── Save handlers ─────────────────────────────────────────────────────
  function handleSaveGlobal() {
    if (!localSettings) return;
    setSaveStatus('saving');
    updateMutation.mutate({
      enabled:         localSettings.enabled,
      notifyOnFailure: localSettings.notifyOnFailure,
      notifyOnPartial: localSettings.notifyOnPartial,
      notifyOnSuccess: localSettings.notifyOnSuccess,
      recipients:      localSettings.recipients,
    });
  }

  function handleSaveWorkflow() {
    setWfSaveStatus('saving');
    workflowMutation.mutate(override);
  }

  // ── Global recipient helpers ──────────────────────────────────────────
  function addGlobalRecipient() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@') || !email.includes('.')) {
      setNewEmailError('Please enter a valid email address.');
      return;
    }
    if (localSettings?.recipients.includes(email)) {
      setNewEmailError('This address is already in the list.');
      return;
    }
    setNewEmailError('');
    setLocalSettings((prev) => prev ? { ...prev, recipients: [...prev.recipients, email] } : prev);
    setNewEmail('');
  }

  function removeGlobalRecipient(email: string) {
    if (email === localSettings?.ownerEmail) return;
    setLocalSettings((prev) =>
      prev ? { ...prev, recipients: prev.recipients.filter((e) => e !== email) } : prev
    );
  }

  // ── Per-workflow recipient helpers ────────────────────────────────────
  function addWfRecipient() {
    const email = newWfEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@') || !email.includes('.')) {
      setNewWfEmailError('Please enter a valid email address.');
      return;
    }
    if (override.recipients.includes(email)) {
      setNewWfEmailError('This address is already in the list.');
      return;
    }
    setNewWfEmailError('');
    setOverride((prev) => ({ ...prev, recipients: [...prev.recipients, email] }));
    setNewWfEmail('');
  }

  function removeWfRecipient(email: string) {
    if (email === localSettings?.ownerEmail) return;
    setOverride((prev) => ({ ...prev, recipients: prev.recipients.filter((e) => e !== email) }));
  }

  // ── Test email ────────────────────────────────────────────────────────
  async function handleSendTest() {
    const target = testEmail.trim() || (localSettings?.ownerEmail ?? '');
    if (!target || !target.includes('@')) {
      setTestMessage('Enter a valid email address to test.');
      setTestStatus('error');
      return;
    }
    setTestStatus('sending');
    try {
      await sendTestEmail(target);
      setTestStatus('sent');
      setTestMessage(`Test email sent to ${target}`);
    } catch (err) {
      setTestStatus('error');
      setTestMessage(err instanceof Error ? err.message : 'Failed to send test email.');
    }
    setTimeout(() => { setTestStatus('idle'); setTestMessage(''); }, 5000);
  }

  if (!open) return null;

  const smtpConfigured = data?.smtpConfigured ?? false;
  const ownerEmail = localSettings?.ownerEmail ?? '';
  const additionalGlobalRecipients = (localSettings?.recipients ?? []).filter((e) => e !== ownerEmail);
  const additionalWfRecipients = override.recipients.filter((e) => e !== ownerEmail);

  // Tabs shown only when a workflow context is present
  const tabs = hasWorkflow
    ? [
        { value: 'workflow', label: workflowName ? `"${workflowName}"` : 'This workflow' },
        { value: 'global',   label: 'Default (all workflows)' },
      ]
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#1a2236] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
            <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
              Email Notifications
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {hasWorkflow
                ? 'Configure who gets notified — per workflow or globally'
                : 'Get alerted when a workflow runs or fails'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tab bar (only when workflow context is available) ────────── */}
        {tabs && (
          <div className="flex items-center gap-3 px-6 pt-4 pb-2 shrink-0">
            <SegmentControl
              value={activeTab}
              onChange={(v) => setActiveTab(v as 'workflow' | 'global')}
              options={tabs}
            />
          </div>
        )}

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {isLoading || !localSettings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (

            /* ════════════════════════════════════════════════════════════
               WORKFLOW-SPECIFIC TAB
               Shown only when a workflow is open AND activeTab === 'workflow'
               ════════════════════════════════════════════════════════════ */
            activeTab === 'workflow' && hasWorkflow ? (
              <>
                {/* Workflow context banner */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25">
                  <Workflow className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 truncate">
                      {workflowName ?? workflowId}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 leading-relaxed">
                      Recipients here override your default list for this workflow only.
                      Toggle <strong>off</strong> to fall back to your default recipients.
                    </p>
                  </div>
                </div>

                {/* Custom recipients toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">
                        Custom recipients for this workflow
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {override.useCustomRecipients
                          ? 'Sending to the list below instead of your defaults'
                          : 'Currently using your default recipient list'}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={override.useCustomRecipients}
                    onChange={(v) => setOverride((prev) => ({ ...prev, useCustomRecipients: v }))}
                  />
                </div>

                {/* Recipient list — active when custom is on */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {override.useCustomRecipients ? 'Custom recipients' : 'Inherited default recipients'}
                    </p>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {override.useCustomRecipients
                        ? `${override.recipients.length} address${override.recipients.length !== 1 ? 'es' : ''}`
                        : `${localSettings.recipients.length} address${localSettings.recipients.length !== 1 ? 'es' : ''}`}
                    </span>
                  </div>

                  {/* When custom is OFF — show inherited list (read-only) */}
                  {!override.useCustomRecipients && (
                    <ul className="space-y-1.5">
                      {localSettings.recipients.length === 0 ? (
                        <li className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/15 text-slate-400 dark:text-slate-500 text-sm">
                          <Info className="w-4 h-4 shrink-0" />
                          No default recipients configured. Go to the Default tab to add some.
                        </li>
                      ) : (
                        localSettings.recipients.map((email) => (
                          <li key={email} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 opacity-70">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 truncate">{email}</span>
                            {email === ownerEmail && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wide shrink-0">
                                <Lock className="w-2.5 h-2.5" />
                                You
                              </span>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  )}

                  {/* When custom is ON — show editable workflow-specific list */}
                  {override.useCustomRecipients && (
                    <>
                      <ul className="space-y-1.5">
                        {/* Owner — always pinned */}
                        {ownerEmail && (
                          <li className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25">
                            <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">{ownerEmail}</span>
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-semibold uppercase tracking-wide shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              You
                            </span>
                          </li>
                        )}

                        {additionalWfRecipients.length === 0 && (
                          <li className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/15 text-slate-400 dark:text-slate-500 text-sm">
                            <Info className="w-4 h-4 shrink-0" />
                            Add addresses specific to this workflow below.
                          </li>
                        )}

                        {additionalWfRecipients.map((email) => (
                          <li
                            key={email}
                            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 group"
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">{email}</span>
                            <button
                              onClick={() => removeWfRecipient(email)}
                              className="p-1 rounded text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove recipient"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>

                      {/* Add input */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            type="email"
                            value={newWfEmail}
                            onChange={(e) => { setNewWfEmail(e.target.value); setNewWfEmailError(''); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWfRecipient(); } }}
                            placeholder="colleague@company.com"
                            className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {newWfEmailError && <p className="text-xs text-red-500 mt-1">{newWfEmailError}</p>}
                        </div>
                        <button
                          onClick={addWfRecipient}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>

            ) : (
            /* ════════════════════════════════════════════════════════════
               GLOBAL / DEFAULT TAB  (also the only view when no workflow)
               ════════════════════════════════════════════════════════════ */
            <>
              {/* SMTP banners */}
              {!smtpConfigured && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">SMTP not configured</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                      Set <code className="bg-amber-100 dark:bg-amber-500/20 px-1 py-0.5 rounded text-[11px]">SMTP_HOST</code>,{' '}
                      <code className="bg-amber-100 dark:bg-amber-500/20 px-1 py-0.5 rounded text-[11px]">SMTP_USER</code>,{' '}
                      <code className="bg-amber-100 dark:bg-amber-500/20 px-1 py-0.5 rounded text-[11px]">SMTP_PASS</code>, and{' '}
                      <code className="bg-amber-100 dark:bg-amber-500/20 px-1 py-0.5 rounded text-[11px]">SMTP_FROM_ADDRESS</code>{' '}
                      in your <code className="bg-amber-100 dark:bg-amber-500/20 px-1 py-0.5 rounded text-[11px]">.env</code>.
                    </p>
                  </div>
                </div>
              )}

              {smtpConfigured && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                    SMTP service account configured and ready
                  </p>
                </div>
              )}

              {/* Default-recipients context note */}
              {hasWorkflow && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    These settings apply to <strong className="text-slate-700 dark:text-slate-300">all your workflows</strong> that don't have a custom recipient list.
                    Switch to the <em>{workflowName ?? 'workflow'}</em> tab to configure recipients for this workflow specifically.
                  </p>
                </div>
              )}

              {/* Master toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                  {localSettings.enabled
                    ? <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    : <BellOff className="w-4 h-4 text-slate-400" />
                  }
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      {localSettings.enabled ? 'Notifications enabled' : 'Notifications disabled'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Master switch for all email alerts
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={localSettings.enabled}
                  onChange={(v) => setLocalSettings((p) => p ? { ...p, enabled: v } : p)}
                />
              </div>

              {/* Alert conditions */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Alert conditions
                </p>

                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">Full failure</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">All nodes or the runner crashed</p>
                    </div>
                  </div>
                  <Toggle
                    checked={localSettings.notifyOnFailure}
                    onChange={(v) => setLocalSettings((p) => p ? { ...p, notifyOnFailure: v } : p)}
                    disabled={!localSettings.enabled}
                  />
                </div>

                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">Partial failure</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Some nodes failed, others succeeded</p>
                    </div>
                  </div>
                  <Toggle
                    checked={localSettings.notifyOnPartial}
                    onChange={(v) => setLocalSettings((p) => p ? { ...p, notifyOnPartial: v } : p)}
                    disabled={!localSettings.enabled}
                  />
                </div>

                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <CircleCheck className="w-4 h-4 text-emerald-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">Successful run</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Every node completed without errors</p>
                    </div>
                  </div>
                  <Toggle
                    checked={localSettings.notifyOnSuccess}
                    onChange={(v) => setLocalSettings((p) => p ? { ...p, notifyOnSuccess: v } : p)}
                    disabled={!localSettings.enabled}
                  />
                </div>
              </div>

              {/* Global recipients */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Default recipients
                  </p>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {localSettings.recipients.length} address{localSettings.recipients.length !== 1 ? 'es' : ''}
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {ownerEmail && (
                    <li className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25">
                      <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">{ownerEmail}</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-semibold uppercase tracking-wide shrink-0">
                        <Lock className="w-2.5 h-2.5" />
                        You
                      </span>
                    </li>
                  )}

                  {additionalGlobalRecipients.length === 0 && (
                    <li className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/15 text-slate-400 dark:text-slate-500 text-sm">
                      <Info className="w-4 h-4 shrink-0" />
                      Add teammates, managers, or on-call addresses below.
                    </li>
                  )}

                  {additionalGlobalRecipients.map((email) => (
                    <li
                      key={email}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 group"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">{email}</span>
                      <button
                        onClick={() => removeGlobalRecipient(email)}
                        className="p-1 rounded text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove recipient"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => { setNewEmail(e.target.value); setNewEmailError(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGlobalRecipient(); } }}
                      placeholder="colleague@company.com"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {newEmailError && <p className="text-xs text-red-500 mt-1">{newEmailError}</p>}
                  </div>
                  <button
                    onClick={addGlobalRecipient}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>

              {/* Test delivery */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Test delivery
                </p>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Send a test email to verify your SMTP settings are working. Leave blank to use your address.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder={ownerEmail || 'test@example.com'}
                      className="flex-1 px-3 py-2 text-sm rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSendTest}
                      disabled={!smtpConfigured || testStatus === 'sending'}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 dark:bg-slate-600 hover:bg-slate-800 dark:hover:bg-slate-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testStatus === 'sending'
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Send className="w-3.5 h-3.5" />
                      }
                      Test
                    </button>
                  </div>
                  {testMessage && (
                    <div className={`flex items-center gap-2 text-xs ${
                      testStatus === 'sent'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500 dark:text-red-400'
                    }`}>
                      {testStatus === 'sent'
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        : <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      }
                      {testMessage}
                    </div>
                  )}
                </div>
              </div>
            </>
            )
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-700/60 shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>

          {/* Workflow tab — save workflow override */}
          {activeTab === 'workflow' && hasWorkflow ? (
            <button
              onClick={handleSaveWorkflow}
              disabled={!localSettings || wfSaveStatus === 'saving'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {wfSaveStatus === 'saving' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
              ) : wfSaveStatus === 'saved' ? (
                <><CheckCircle2 className="w-3.5 h-3.5" />Saved</>
              ) : (
                'Save for this workflow'
              )}
            </button>
          ) : (
            /* Global tab — save global settings */
            <button
              onClick={handleSaveGlobal}
              disabled={!localSettings || saveStatus === 'saving'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {saveStatus === 'saving' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
              ) : saveStatus === 'saved' ? (
                <><CheckCircle2 className="w-3.5 h-3.5" />Saved</>
              ) : (
                'Save settings'
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
