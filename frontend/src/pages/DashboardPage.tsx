import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { api, ApiError, errorMessage } from '../lib/api';
import { contactAddress, formatDuration, formatUptime } from '../lib/format';
import type { Call, PbxChannels, PbxStatus, PbxSummary } from '../lib/types';

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canHangup = hasRole('admin', 'operator');

  // the live data is refreshed every few seconds
  const summary = useQuery({
    queryKey: ['pbx', 'summary'],
    queryFn: () => api.get<PbxSummary>('/pbx/summary'),
    refetchInterval: 3000,
  });
  const channels = useQuery({
    queryKey: ['pbx', 'channels'],
    queryFn: () => api.get<PbxChannels>('/pbx/channels'),
    refetchInterval: 3000,
  });
  const status = useQuery({
    queryKey: ['pbx', 'status'],
    queryFn: async () => (await api.get<{ status: PbxStatus }>('/pbx/status')).status,
    refetchInterval: 15000,
  });

  // ending one channel makes asterisk tear down the other legs of the call
  const hangup = useMutation({
    mutationFn: (call: Call) => api.post('/pbx/hangup', { channel: call.channels[0] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pbx'] }),
  });

  const asteriskDown =
    summary.error instanceof ApiError && (summary.error.status === 503 || summary.error.status === 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      {asteriskDown && (
        <p role="alert" className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Asterisk is not reachable right now. The live data comes back by itself as soon as it is.
        </p>
      )}
      {summary.error && !asteriskDown && (
        <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage(summary.error)}
        </p>
      )}

      {summary.isPending && <Spinner />}

      {summary.data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Counter label="Extensions" value={summary.data.counters.extensions} />
            <Counter label="Registered" value={summary.data.counters.registered} />
            <Counter label="Ringing" value={summary.data.counters.ringing} />
            <Counter label="In a call" value={summary.data.counters.busy} />
            <Counter label="Active calls" value={summary.data.counters.activeCalls} />
          </div>

          <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <h2 className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">Extensions</h2>
            {summary.data.extensions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No extension yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Number</th>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Phone address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.data.extensions.map((extension) => (
                      <tr key={extension.id}>
                        <td className="px-4 py-2 font-medium text-slate-900">{extension.number}</td>
                        <td className="px-4 py-2">{extension.displayName}</td>
                        <td className="px-4 py-2">
                          <StatusBadge extension={extension} />
                        </td>
                        <td className="px-4 py-2 text-slate-500">{contactAddress(extension.live.contacts[0])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <h2 className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">Active calls</h2>
        {channels.data && channels.data.calls.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">No call in progress.</p>
        )}
        {channels.data && channels.data.calls.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Between</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                {canHangup && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {channels.data.calls.map((call) => (
                <tr key={call.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {call.parties.length > 0 ? call.parties.join(' ↔ ') : 'Unknown parties'}
                  </td>
                  <td className="px-4 py-2">{formatDuration(call.durationSeconds)}</td>
                  {canHangup && (
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => hangup.mutate(call)}
                        disabled={hangup.isPending}
                        className="rounded-md border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Hang up
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {hangup.error && <p className="px-4 pb-3 text-sm text-rose-700">{errorMessage(hangup.error)}</p>}
      </section>

      {status.data && (
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 font-medium text-slate-900">Asterisk</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Version</dt>
              <dd className="font-medium text-slate-900">{status.data.version.split('~')[0]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Uptime</dt>
              <dd className="font-medium text-slate-900">{formatUptime(status.data.uptimeSeconds)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Configuration source</dt>
              <dd className="font-medium text-slate-900">{status.data.realtime ? 'Database (realtime)' : 'Files'}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}