import { getAuthEpoch, onAuthEpochChange } from '@/lib/accessToken';
import { ApiError } from '@/lib/errors';
import { createRecoveryStore } from '../mentors/recoveryStore';
import type { components } from '@/lib/api/schema';
import * as api from './api';

type Schema = components['schemas'];
export type CommandContext = { fields?: Record<string, unknown>; label?: string };
const shared = {
  getAuthEpoch, onAuthEpochChange,
  isUnknown: (cause: unknown) => !(cause instanceof ApiError) || cause.status >= 500 || cause.status === 408,
};
const retry = { status: 'retry' as const };

export type CollaborationCommand =
  | { kind: 'invite'; projectId: string; body: api.CollaborationInvite }
  | { kind: 'act'; collaborationId: string; action: 'accept'|'reject'|'revoke'; body: api.CollaborationVersion };
export const collaborationRecovery = createRecoveryStore<CollaborationCommand, CommandContext, api.Collaboration>({
  ...shared,
  execute: command => command.kind === 'invite'
    ? api.inviteCollaborator(command.projectId, command.body)
    : api.actCollaborator(command.collaborationId, command.action, command.body),
  reconcile: async command => {
    // Own history remains available after loss of project management authority.
    let offset = 0;
    do {
      const page = await api.getMyCollaborations(offset, 100);
      if (command.kind === 'act') {
        const row = page.items.find(item => item.id === command.collaborationId);
        if (row && row.status !== 'PENDING' && (command.action !== 'revoke' || row.status !== 'ACCEPTED'))
          return { status: 'resolved', value: row };
      }
      offset += page.items.length;
      if (!page.items.length || offset >= page.total) return retry;
    } while (true);
  },
});

export type TransferRecoveryCommand =
  | { kind: 'create'; projectId: string; body: api.TransferCreate }
  | { kind: 'act'; transferId: string; action: 'accept'|'reject'|'cancel'; body: api.TransferCommand };
export const transferRecovery = createRecoveryStore<TransferRecoveryCommand, CommandContext, api.Transfer>({
  ...shared,
  execute: command => command.kind === 'create'
    ? api.createTransfer(command.projectId, command.body)
    : api.actTransfer(command.transferId, command.action, command.body),
  reconcile: async command => {
    if (command.kind === 'act') {
      const row = await api.getTransfer(command.transferId);
      if (row.status !== 'PENDING') return { status: 'resolved', value: row };
    } else await api.getMyTransfers();
    return retry;
  },
});

export type ProjectRecoveryCommand = { projectId: string; body: api.ProjectSave };
export const projectRecovery = createRecoveryStore<ProjectRecoveryCommand, CommandContext, api.ProjectWorkspace>({
  ...shared,
  execute: command => api.saveWorkspace(command.projectId, command.body),
  reconcile: async command => { await api.getWorkspace(command.projectId); return retry; },
});

export type AchievementRecoveryCommand =
  | { kind: 'create'; projectId: string; body: Schema['AchievementDraftCreate'] }
  | { kind: 'save'; projectId: string; achievementId: string; body: api.AchievementSave };
export const achievementRecovery = createRecoveryStore<AchievementRecoveryCommand, CommandContext, api.TextAchievement | api.AchievementSaveResult>({
  ...shared,
  execute: command => command.kind === 'create'
    ? api.createWorkspaceAchievement(command.projectId, command.body)
    : api.saveWorkspaceAchievement(command.projectId, command.achievementId, command.body),
  reconcile: async command => {
    if (command.kind === 'create') await api.getWorkspaceAchievements(command.projectId);
    else await api.getWorkspaceAchievement(command.projectId, command.achievementId);
    return retry;
  },
});

export type RecruitmentRecoveryCommand =
  | { kind: 'create'; projectId: string; body: Schema['RecruitmentDraftCreate'] }
  | { kind: 'save'; projectId: string; recruitmentId: string; body: Schema['RecruitmentDraftUpdate'] }
  | { kind: 'act'; projectId: string; recruitmentId: string; action: 'publish'|'close'|'reopen'|'confirm-active'; body: Schema['RecruitmentVersionCommand'] }
  | { kind: 'revoke-contact'; projectId: string; recruitmentId: string; body: Schema['RevokeRecruitmentContactCommand'] };
export const recruitmentRecovery = createRecoveryStore<RecruitmentRecoveryCommand, CommandContext, Schema['RecruitmentDraftResponse'] | Schema['RecruitmentActionResult']>({
  ...shared,
  execute: command => {
    switch (command.kind) {
      case 'create': return api.createWorkspaceRecruitment(command.projectId, command.body);
      case 'save': return api.saveWorkspaceRecruitment(command.projectId, command.recruitmentId, command.body);
      case 'act': return api.actWorkspaceRecruitment(command.projectId, command.recruitmentId, command.action, command.body);
      case 'revoke-contact': return api.revokeWorkspaceContact(command.projectId, command.recruitmentId, command.body);
    }
  },
  reconcile: async command => {
    if (command.kind === 'create') await api.getWorkspaceRecruitments(command.projectId);
    else await api.getWorkspaceRecruitment(command.projectId, command.recruitmentId);
    return retry;
  },
});

export type LifecycleRecoveryCommand =
  | { kind: 'act'; projectId: string; action: 'complete'|'resume'; body: api.LifecycleCommand }
  | { kind: 'publish'; projectId: string; body: api.IntroductionPublish };
export const lifecycleRecovery = createRecoveryStore<LifecycleRecoveryCommand, CommandContext, api.LifecycleResult>({
  ...shared,
  execute: command => command.kind === 'act'
    ? api.actLifecycle(command.projectId, command.action, command.body)
    : api.publishIntroduction(command.projectId, command.body),
  reconcile: async command => { await api.getLifecycle(command.projectId); return retry; },
});
