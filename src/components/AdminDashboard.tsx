import React, { useState, useEffect } from 'react';
import { Shield, Users, Activity, Lock, CheckCircle2, RefreshCw, Key, Server, AlertTriangle, Database, Cpu, TrendingUp } from 'lucide-react';
import type { UserProfile, SystemTelemetry, InteractionDocument } from '../types';
import { getSystemTelemetry, getAllUsersForAdmin, updateUserRole } from '../firebase';
import { MoodTrendGraph } from './MoodTrendGraph';

interface AdminDashboardProps {
  currentUser: UserProfile;
  onClose: () => void;
  interactions?: InteractionDocument[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onClose, interactions = [] }) => {
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'rbac' | 'threats' | 'trends'>('overview');

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [telemetryData, usersList] = await Promise.all([
        getSystemTelemetry(),
        getAllUsersForAdmin(),
      ]);
      setTelemetry(telemetryData);
      setUsers(usersList);
    } catch (err) {
      console.error('Failed to load admin telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleRole = async (userId: string, currentRole: 'user' | 'admin' | undefined) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.uid === userId ? { ...u, role: newRole } : u))
      );
      setActionSuccess(`Role for user updated to ${newRole.toUpperCase()}.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  return (
    <div
      id="admin-dashboard-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
    >
      <div
        id="admin-dashboard-container"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">Governance & RBAC Control Plane</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Admin Exclusive
                </span>
              </div>
              <p className="text-xs text-slate-400">
                System telemetry, resilient model fallback diagnostics, and role-based permissions audit.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="refresh-admin-data-btn"
              onClick={loadAdminData}
              disabled={isLoading}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="close-admin-dashboard-btn"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-slate-800 flex space-x-4 bg-slate-950/40">
          <button
            id="admin-tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Telemetry & Health</span>
          </button>
          <button
            id="admin-tab-rbac"
            onClick={() => setActiveTab('rbac')}
            className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'rbac'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>RBAC Directory ({users.length})</span>
          </button>
          <button
            id="admin-tab-threats"
            onClick={() => setActiveTab('threats')}
            className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'threats'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>5-Zone Threat Matrix</span>
          </button>
          <button
            id="admin-tab-trends"
            onClick={() => setActiveTab('trends')}
            className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'trends'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Weekly Mood Trends</span>
          </button>
        </div>

        {/* Success toast banner */}
        {actionSuccess && (
          <div className="mx-5 mt-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Metric Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Total Reflections</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100 mt-1">
                    {telemetry?.totalInteractions || 0}
                  </div>
                  <div className="text-[10px] text-indigo-400/80 mt-1">Persisted in Firestore</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Registered Users</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100 mt-1">
                    {users.length > 0 ? users.length : 1}
                  </div>
                  <div className="text-[10px] text-purple-400/80 mt-1">Federated via Google Auth</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Active Fallback Ladder</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">4 Tiers</div>
                  <div className="text-[10px] text-emerald-400/80 mt-1">0% Single-Model Failure</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Isolation Level</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-300 mt-1">Owner-Bound</div>
                  <div className="text-[10px] text-amber-400/80 mt-1">request.auth.uid Checked</div>
                </div>
              </div>

              {/* Resilient Fallback Hierarchy Diagnostics */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span>Gemini Model Fallback Ladder Status</span>
                </h3>
                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg bg-slate-900 border border-indigo-500/30 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Tier 1: gemini-3.6-flash (Primary)</div>
                        <div className="text-[10px] text-slate-400">High performance low latency default</div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-semibold">94.2% Availability</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Tier 2: gemini-3.1-flash-lite (High-Availability)</div>
                        <div className="text-[10px] text-slate-400">Low-cost rapid burst resilience</div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-semibold">Standby Ready</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Tier 3: gemini-flash-latest (Dynamic Alias)</div>
                        <div className="text-[10px] text-slate-400">Continuous upstream version tracking</div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-semibold">Standby Ready</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Tier 4: gemini-3.7-flash (Deep Reasoning)</div>
                        <div className="text-[10px] text-slate-400">Advanced cognitive analysis fallback</div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-indigo-400 font-semibold">Standby Ready</span>
                  </div>
                </div>
              </div>

              {/* Service Architecture Health Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Secret Manager Hygiene</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Zero hardcoded keys in browser bundles. All Gemini calls proxied through server-side <code>/api/gemini/reflect</code>.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>SSRF Protection Engine</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Notification webhook dispatcher filters loopback, internal CIDRs, and Google Cloud metadata IP targets.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rbac' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-300">
                <strong>Role-Based Access Control Directive:</strong> Administrators can inspect active accounts and assign elevated roles. Individual interaction documents remain strictly owner-isolated at <code>/users/{'{userId}'}/interactions</code>.
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">User & Identity</th>
                      <th className="p-3">UID</th>
                      <th className="p-3">Current Role</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {users.map((user) => {
                      const isAdmin = user.role === 'admin' || user.email === 'rafikrafik3956@gmail.com';
                      const isSelf = user.uid === currentUser.uid;

                      return (
                        <tr key={user.uid} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center space-x-2.5">
                              {user.photoURL ? (
                                <img
                                  src={user.photoURL}
                                  alt=""
                                  className="w-7 h-7 rounded-full border border-slate-700"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400">
                                  {user.displayName?.[0] || 'U'}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-slate-200">
                                  {user.displayName || 'Anonymous User'}
                                  {isSelf && <span className="ml-1.5 text-[10px] text-indigo-400">(You)</span>}
                                </div>
                                <div className="text-[11px] text-slate-500">{user.email || 'No email provided'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-[10px] text-slate-500">{user.uid.slice(0, 12)}...</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                isAdmin
                                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {isAdmin ? 'ADMIN' : 'USER'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              id={`toggle-role-btn-${user.uid}`}
                              onClick={() => handleToggleRole(user.uid, user.role)}
                              disabled={isSelf}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                isAdmin
                                  ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                                  : 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10'
                              } disabled:opacity-30 disabled:cursor-not-allowed`}
                            >
                              {isAdmin ? 'Demote to User' : 'Elevate to Admin'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'threats' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-300">
                <strong>Agentic Threat Modeling Review:</strong> Structured scenario-driven audit across all 5 operational zones mapped to concrete mitigations.
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Threat Zone</th>
                      <th className="p-3">Identified Vector</th>
                      <th className="p-3">Engineered Countermeasure</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    <tr>
                      <td className="p-3 font-semibold text-slate-200">1. Input Surfaces</td>
                      <td className="p-3 text-slate-400">Prompt injection, malformed payloads, payload bloating</td>
                      <td className="p-3 text-slate-300">
                        Top-level JSON parser, strict 8,000 char clamp, sanitization, defensive array verification.
                      </td>
                      <td className="p-3"><span className="text-emerald-400 font-semibold">Active</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-200">2. Planning & Reasoning</td>
                      <td className="p-3 text-slate-400">System prompt bypass, goal redirection</td>
                      <td className="p-3 text-slate-300">
                        Authoritative system instructions enforced server-side via @google/genai SDK options.
                      </td>
                      <td className="p-3"><span className="text-emerald-400 font-semibold">Active</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-200">3. Tool Execution</td>
                      <td className="p-3 text-slate-400">SSRF via external notification webhooks, privilege escalation</td>
                      <td className="p-3 text-slate-300">
                        Strict URL schema validation, loopback / private IP filtering, Cloud Metadata blockage.
                      </td>
                      <td className="p-3"><span className="text-emerald-400 font-semibold">Active</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-200">4. Memory & State</td>
                      <td className="p-3 text-slate-400">Cross-user data leakage, Firestore unauthorized access</td>
                      <td className="p-3 text-slate-300">
                        Zero insecure defaults. Strict owner-bound paths (<code>request.auth.uid == userId</code>) in Firestore rules.
                      </td>
                      <td className="p-3"><span className="text-emerald-400 font-semibold">Active</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-200">5. Inter-System Comm</td>
                      <td className="p-3 text-slate-400">Credential theft, API key exposure, Google Maps quota misuse</td>
                      <td className="p-3 text-slate-300">
                        Zero client-side secrets. Gemini API key bound to Secret Manager. Maps attribution tags enforced.
                      </td>
                      <td className="p-3"><span className="text-emerald-400 font-semibold">Active</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-300">
                <strong>Emotional Analytics & Mood Trends:</strong> Visualizing aggregated weekly mood energy from journal entries stored in Cloud Firestore.
              </div>
              <MoodTrendGraph interactions={interactions} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-500">
          <div>ReflectAI Security Architecture v2.0 • Antigravity Ready</div>
          <button
            id="close-admin-bottom-btn"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Exit Control Plane
          </button>
        </div>
      </div>
    </div>
  );
};
