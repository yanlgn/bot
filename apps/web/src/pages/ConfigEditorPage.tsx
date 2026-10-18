import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { FileCode, Save, CheckCircle, RotateCcw, AlertCircle, History, RefreshCw } from 'lucide-react';

export const ConfigEditorPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [jsonText, setJsonText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedBackupId, setSelectedBackupId] = useState('');

  // Fetch Config
  const { data: configData, isLoading } = useQuery({
    queryKey: ['config', guildId],
    queryFn: () => apiFetch<any>(`/guilds/${guildId}/config`),
    enabled: !!guildId
  });

  // Fetch Backups
  const { data: backups = [] } = useQuery<Array<{ id: string; filename: string; createdAt: string; createdBy: string }>>({
    queryKey: ['backups', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/config/backups`),
    enabled: !!guildId
  });

  useEffect(() => {
    if (configData) {
      setJsonText(JSON.stringify(configData, null, 2));
    }
  }, [configData]);

  // Validate Mutation
  const validateMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch(`/guilds/${guildId}/config/validate`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setValidationError(null);
      setSuccessMessage('Schéma Zod validé avec succès ! La configuration est saine.');
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      setSuccessMessage(null);
      setValidationError(`Erreur de validation : ${err.message}`);
    }
  });

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch(`/guilds/${guildId}/config`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['config', guildId] });
      queryClient.invalidateQueries({ queryKey: ['backups', guildId] });
      setValidationError(null);
      setSuccessMessage(`Configuration sauvegardée ! Sauvegarde créée : ${data.backupCreated || 'OK'}`);
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setSuccessMessage(null);
      setValidationError(`Erreur d'enregistrement : ${err.message}`);
    }
  });

  // Restore Mutation
  const restoreMutation = useMutation({
    mutationFn: (backupId: string) =>
      apiFetch(`/guilds/${guildId}/config/restore`, { method: 'POST', body: JSON.stringify({ backupId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', guildId] });
      setSuccessMessage('Configuration restaurée avec succès depuis la sauvegarde !');
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      setValidationError(`Erreur de restauration : ${err.message}`);
    }
  });

  // Apply to Discord Mutation
  const applyMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/guilds/${guildId}/config/apply`, { method: 'POST' }),
    onSuccess: (data: any) => {
      setValidationError(null);
      setSuccessMessage(`🚀 ${data.message} (${data.logs?.length || 0} élément(s) traités)`);
      setTimeout(() => setSuccessMessage(null), 6000);
    },
    onError: (err: any) => {
      setSuccessMessage(null);
      setValidationError(`Erreur d'application sur Discord : ${err.message}`);
    }
  });

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(jsonText);
      validateMutation.mutate(parsed);
    } catch (e: any) {
      setValidationError(`Erreur de syntaxe JSON : ${e.message}`);
    }
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      saveMutation.mutate(parsed);
    } catch (e: any) {
      setValidationError(`Erreur de syntaxe JSON : ${e.message}`);
    }
  };

  const handleRestore = () => {
    if (!selectedBackupId) return;
    restoreMutation.mutate(selectedBackupId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center">
            <FileCode className="w-6 h-6 mr-3 text-blue-400" />
            Éditeur Déclaratif JSON & Sauvegardes
          </h1>
          <p className="text-sm text-gray-400">
            Fichier <code>/config/guilds/{guildId}.json</code> validé par Zod avec sauvegardes horodatées automatiques.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleValidate}
            className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-lg transition border border-gray-700"
          >
            <CheckCircle className="w-4 h-4 mr-2 text-emerald-400" />
            Valider le Schéma
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 text-white text-sm font-semibold rounded-lg transition border border-gray-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder JSON'}
          </button>
          <button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            className="flex items-center px-5 py-2 bg-[#E5092E] hover:bg-[#c00725] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition shadow-md shadow-[#E5092E]/20"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${applyMutation.isPending ? 'animate-spin' : ''}`} />
            {applyMutation.isPending ? 'Application...' : 'Appliquer sur Discord'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {validationError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="whitespace-pre-wrap">{validationError}</div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-sm flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          <div>{successMessage}</div>
        </div>
      )}

      {/* Backup and Restore Bar */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <History className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-semibold text-gray-200">Restaurer une sauvegarde :</span>
          <select
            value={selectedBackupId}
            onChange={e => setSelectedBackupId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Sélectionner une sauvegarde...</option>
            {backups.map(b => (
              <option key={b.id} value={b.id}>
                {b.filename} ({new Date(b.createdAt).toLocaleString('fr-FR')} par {b.createdBy})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleRestore}
          disabled={!selectedBackupId || restoreMutation.isPending}
          className="flex items-center px-4 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-amber-400 text-xs font-semibold rounded-lg transition border border-gray-700"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-2" />
          Restaurer cette version
        </button>
      </div>

      {/* JSON Editor Box */}
      <div className="bg-[#0F172A] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-4 py-2.5 bg-[#1E293B]/60 border-b border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span className="font-mono">{guildId}.json</span>
          <span>Format JSON strict • indentation 2 espaces</span>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 font-mono text-sm">
            Lecture du fichier de configuration...
          </div>
        ) : (
          <textarea
            value={jsonText}
            onChange={e => {
              setJsonText(e.target.value);
              setValidationError(null);
            }}
            spellCheck={false}
            rows={24}
            className="w-full bg-[#0B0F19] p-6 text-gray-200 font-mono text-xs leading-relaxed focus:outline-none resize-y selection:bg-blue-600"
          />
        )}
      </div>
    </div>
  );
};
