import { persistSharedStudentSession, test as base } from './fixtures';
import { withCollaborationWorld } from './collaboration-world';

// Qualification and transfer journeys mutate identities. Keep those facts in
// their own graph so the original R1 qualification journey still starts fresh.
export const test=base.extend<{collaborationWorld:void}>({
  collaborationWorld:[async({page},run)=>{
    await withCollaborationWorld(page,()=>run(undefined));
  },{auto:true}],
  // Persist while the child's run key is still installed. Saving after the
  // world teardown would put the deleted child's cookies in the parent file.
  persistSession:[async({page,collaborationWorld},run)=>{
    void collaborationWorld;
    await run();
    await persistSharedStudentSession(page);
  },{auto:true}],
});
