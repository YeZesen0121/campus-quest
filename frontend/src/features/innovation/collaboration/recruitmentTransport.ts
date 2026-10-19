import * as owner from '../recruitmentApi';
import * as collaboration from './api';

// Same editor contract, separately authorized routes. Proof/submission APIs are absent.
export const ownerRecruitmentTransport = {
  createRecruitment:owner.createRecruitment,listRecruitments:owner.listRecruitments,
  getRecruitment:owner.getRecruitment,updateRecruitment:owner.updateRecruitment,
  publishRecruitment:owner.publishRecruitment,closeRecruitment:owner.closeRecruitment,
  reopenRecruitment:owner.reopenRecruitment,confirmActiveRecruitment:owner.confirmActiveRecruitment,
  revokeRecruitmentContact:owner.revokeRecruitmentContact,
};
export const collaborationRecruitmentTransport:typeof ownerRecruitmentTransport = {
  createRecruitment:collaboration.createWorkspaceRecruitment,
  listRecruitments:collaboration.getWorkspaceRecruitments,
  getRecruitment:collaboration.getWorkspaceRecruitment,
  updateRecruitment:collaboration.saveWorkspaceRecruitment,
  publishRecruitment:(p,r,body)=>collaboration.actWorkspaceRecruitment(p,r,'publish',body),
  closeRecruitment:(p,r,body)=>collaboration.actWorkspaceRecruitment(p,r,'close',body),
  reopenRecruitment:(p,r,body)=>collaboration.actWorkspaceRecruitment(p,r,'reopen',body),
  confirmActiveRecruitment:(p,r,body)=>collaboration.actWorkspaceRecruitment(p,r,'confirm-active',body),
  revokeRecruitmentContact:collaboration.revokeWorkspaceContact,
};
