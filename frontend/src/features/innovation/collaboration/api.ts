import { apiRequest, type ApiRequestInit } from '@/lib/api';
import { getAuthEpoch } from '@/lib/accessToken';
import type { components } from '@/lib/api/schema';

type Schema = components['schemas'];
export type ProjectRole = Schema['PersonalProjectSummary']['role'];
export type PersonalProject = Schema['PersonalProjectSummary'];
export type Collaboration = Schema['CollaborationResponse'];
export type CollaborationInvite = Schema['CollaborationInviteCommand'];
export type CollaborationVersion = Schema['CollaborationVersionCommand'];
export type ProjectWorkspace = Schema['ProjectWorkspaceResponse'];
export type ProjectSave = Schema['CollaborationProjectSaveCommand'];
export type AchievementSave = Schema['CollaborationAchievementSaveCommand'];
export type Transfer = Schema['TransferResponse'];
export type TransferCreate = Schema['TransferCreate'];
export type TransferCommand = Schema['TransferCommand'];
export type TransferProofChoice = Schema['TransferProofChoice'];
export type LifecycleState = Schema['LifecycleStateResponse'];
export type LifecycleResult = Schema['LifecycleResult'];
export type LifecycleCommand = Schema['LifecycleCommand'];
export type IntroductionFields = Schema['IntroductionFields'];
export type IntroductionPreview = Schema['IntroductionPreviewResponse'];
export type IntroductionPublish = Schema['IntroductionPublishCommand'];
export type TextAchievement = Schema['AchievementDraftResponse'];
export type AchievementSaveResult = Schema['WorkspaceAchievementSaveResult'];
export type Target = Schema['TargetResponse'];

const root = '/api/v1/ie';
const id = encodeURIComponent;
const project = (projectId: string) => `${root}/collaboration/projects/${id(projectId)}`;
const owner = (projectId: string) => `${root}/me/project-drafts/${id(projectId)}`;
const page = (offset: number, limit = 20) => new URLSearchParams({limit: String(limit), offset: String(offset)});

async function request<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const epoch = getAuthEpoch();
  const value = await apiRequest<T>(path, {signal: AbortSignal.timeout(15_000), ...init, cache: 'no-store'});
  if (epoch !== getAuthEpoch()) throw new DOMException('账号会话已改变', 'AbortError');
  return value;
}

export const resolveTarget = (body: Schema['TargetResolveCommand']) => request<Target>(`${root}/collaboration/targets/resolve`, {method: 'POST', body});
export const getMyProjects = (role: ProjectRole, offset = 0) => {
  const query = page(offset); query.set('role', role);
  return request<Schema['PersonalProjectListResponse']>(`${root}/me/collaboration-projects?${query}`);
};
export const getMyCollaborations = (offset = 0, limit = 20) => request<Schema['CollaborationListResponse']>(`${root}/me/collaborations?${page(offset, limit)}`);
export const getProjectCollaborators = (projectId: string, offset = 0) => request<Schema['CollaborationListResponse']>(`${owner(projectId)}/collaborators?${page(offset)}`);
export const inviteCollaborator = (projectId: string, body: CollaborationInvite) => request<Collaboration>(`${owner(projectId)}/collaborators`, {method: 'POST', body});
export const actCollaborator = (collaborationId: string, action: 'accept'|'reject'|'revoke', body: CollaborationVersion) => request<Collaboration>(`${root}/collaborations/${id(collaborationId)}/${action}`, {method: 'POST', body});

export const getWorkspace = (projectId: string) => request<ProjectWorkspace>(project(projectId));
export const saveWorkspace = (projectId: string, body: ProjectSave) => request<ProjectWorkspace>(project(projectId), {method: 'PATCH', body});
export const getWorkspaceAchievements = (projectId: string, offset = 0) => request<Schema['AchievementDraftListResponse']>(`${project(projectId)}/achievements?${page(offset)}`);
export const getWorkspaceAchievement = (projectId: string, achievementId: string) => request<TextAchievement>(`${project(projectId)}/achievements/${id(achievementId)}`);
export const createWorkspaceAchievement = (projectId: string, body: Schema['AchievementDraftCreate']) => request<TextAchievement>(`${project(projectId)}/achievements`, {method: 'POST', body});
export const saveWorkspaceAchievement = (projectId: string, achievementId: string, body: AchievementSave) => request<AchievementSaveResult>(`${project(projectId)}/achievements/${id(achievementId)}`, {method: 'PATCH', body});

export const getWorkspaceRecruitments = (projectId: string, offset = 0) => request<Schema['RecruitmentDraftListResponse']>(`${project(projectId)}/recruitments?${page(offset)}`);
export const getWorkspaceRecruitment = (projectId: string, recruitmentId: string) => request<Schema['RecruitmentDraftResponse']>(`${project(projectId)}/recruitments/${id(recruitmentId)}`);
export const createWorkspaceRecruitment = (projectId: string, body: Schema['RecruitmentDraftCreate']) => request<Schema['RecruitmentDraftResponse']>(`${project(projectId)}/recruitments`, {method: 'POST', body});
export const saveWorkspaceRecruitment = (projectId: string, recruitmentId: string, body: Schema['RecruitmentDraftUpdate']) => request<Schema['RecruitmentDraftResponse']>(`${project(projectId)}/recruitments/${id(recruitmentId)}`, {method: 'PATCH', body});
export const actWorkspaceRecruitment = (projectId: string, recruitmentId: string, action: 'publish'|'close'|'reopen'|'confirm-active', body: Schema['RecruitmentVersionCommand']) => request<Schema['RecruitmentActionResult']>(`${project(projectId)}/recruitments/${id(recruitmentId)}/${action}`, {method: 'POST', body});
export const revokeWorkspaceContact = (projectId: string, recruitmentId: string, body: Schema['RevokeRecruitmentContactCommand']) => request<Schema['RecruitmentActionResult']>(`${project(projectId)}/recruitments/${id(recruitmentId)}/revoke-contact`, {method: 'POST', body});

export const getMyTransfers = (offset = 0) => request<Schema['TransferListResponse']>(`${root}/me/transfers?${page(offset)}`);
export const getTransferProofChoices = (projectId: string, offset = 0) => request<Schema['TransferProofChoicesResponse']>(`${owner(projectId)}/transfer-proofs?${page(offset)}`);
export const createTransfer = (projectId: string, body: TransferCreate) => request<Transfer>(`${owner(projectId)}/transfers`, {method: 'POST', body});
export const getTransfer = (transferId: string) => request<Transfer>(`${root}/transfers/${id(transferId)}`);
export const actTransfer = (transferId: string, action: 'accept'|'reject'|'cancel', body: TransferCommand) => request<Transfer>(`${root}/transfers/${id(transferId)}/${action}`, {method: 'POST', body});
export const readTransferProof = (transferId: string, evidenceId: string, version: number) => request<Blob>(`${root}/transfers/${id(transferId)}/evidence/${id(evidenceId)}?${new URLSearchParams({version: String(version)})}`, {responseFormat: 'blob'});

export const getLifecycle = (projectId: string) => request<LifecycleState>(`${owner(projectId)}/lifecycle`);
export const actLifecycle = (projectId: string, action: 'complete'|'resume', body: LifecycleCommand) => request<LifecycleResult>(`${owner(projectId)}/${action}`, {method: 'POST', body});
export const previewIntroduction = (projectId: string, body: Schema['IntroductionPreviewCommand']) => request<IntroductionPreview>(`${owner(projectId)}/introduction/preview`, {method: 'POST', body});
export const publishIntroduction = (projectId: string, body: IntroductionPublish) => request<LifecycleResult>(`${owner(projectId)}/introduction/publish`, {method: 'POST', body});
export const getPublicProjectMembers = (projectId: string) => request<Schema['PublicProjectMembersResponse']>(`${root}/projects/${id(projectId)}/members`);
