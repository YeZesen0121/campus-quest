import { getAuthEpoch, onAuthEpochChange } from '@/lib/accessToken';
import type { components } from '@/lib/api/schema';
import { createMentor, saveMentor, confirmMentor, rejectMentor, withdrawMentor, setMentorContactState, setMentorScope, revokeMentorContact, createProjectMentorLink, actOnProjectMentorLink, type MentorAction, type MentorFields, type MentorSummary, type ProjectMentor } from './api';
import { mentorMutationError } from './presentation';
import { createRecoveryStore } from './recoveryStore';

type Schema=components['schemas'];
export type MentorRecoveryContext={draft?:{username:string;fields:MentorFields};offset?:number;invite?:{query:string;searched:string|null;selected:MentorSummary}};
export type ProfileCommand=
  |{kind:'create';body:Schema['MentorCreateCommand']}
  |{kind:'save';mentorId:string;body:Schema['MentorSaveCommand']}
  |{kind:'confirm';body:Schema['MentorConfirmCommand']}
  |{kind:'reject'|'withdraw';body:Schema['MentorVersionCommand']}
  |{kind:'contact-state';body:Schema['MentorContactStateCommand']}
  |{kind:'scope';body:Schema['MentorScopeCommand']}
  |{kind:'revoke-contact';body:Schema['MentorRevokeContactCommand']};
export type LinkCommand=
  |{kind:'invite';projectId:string;body:Schema['ProjectMentorCreateCommand']}
  |{kind:'link';linkId:string;action:'accept'|'reject'|'revoke';body:Schema['MentorVersionCommand']};

async function executeProfile(command:ProfileCommand):Promise<MentorAction>{
  switch(command.kind){
    case 'create':return createMentor(command.body);
    case 'save':return saveMentor(command.mentorId,command.body);
    case 'confirm':return confirmMentor(command.body);
    case 'reject':return rejectMentor(command.body);
    case 'withdraw':return withdrawMentor(command.body);
    case 'contact-state':return setMentorContactState(command.body);
    case 'scope':return setMentorScope(command.body);
    case 'revoke-contact':return revokeMentorContact(command.body);
  }
}
async function executeLink(command:LinkCommand):Promise<ProjectMentor>{
  return command.kind==='invite'?createProjectMentorLink(command.projectId,command.body):actOnProjectMentorLink(command.linkId,command.action,command.body);
}
const shared={getAuthEpoch,onAuthEpochChange,isUnknown:(cause:unknown)=>mentorMutationError(cause).unknown};
export const profileRecovery=createRecoveryStore<ProfileCommand,MentorRecoveryContext,MentorAction>({...shared,execute:executeProfile});
export const linkRecovery=createRecoveryStore<LinkCommand,MentorRecoveryContext,ProjectMentor>({...shared,execute:executeLink});
export const mentorWorkspace={
  create:'operations:create',profile:(id:string)=>`operations:profile:${id}`,self:'mentor:self',
  invite:(projectId:string)=>`project:${projectId}:invite`,links:(projectId?:string)=>projectId?`project:${projectId}:links`:'mentor:links',
};

// The tab owns unfinished commands even when their editor is not mounted.
// A full document unload cannot preserve memory, so warn until they resolve.
if(typeof window!=='undefined')window.addEventListener('beforeunload',event=>{
  if(profileRecovery.hasPending()||linkRecovery.hasPending())event.preventDefault();
});
