'use client';
import { CollaborationLoading } from './CollaborationLoading';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/features/auth/session';
import { getAuthEpoch } from '@/lib/accessToken';
import { EmptyState, SectionError } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { PrivateHeader } from '../PrivateWorkspace';
import { getMyProjects, getMyTransfers, type ProjectRole } from './api';
import { ROLE_LABELS, transferStatus } from './presentation';
import { CollaborationInbox, PageControls } from './CollaborationInbox';

export function CollaborationHome({role}:{role:ProjectRole}) {
  const {state}=useSession();
  if(state.status!=='authenticated')return null;
  return <Home key={`${state.me.id}:${getAuthEpoch()}:${role}`} role={role}/>;
}
function Home({role}:{role:ProjectRole}) {
  const [offset,setOffset]=useState(0);
  return <><PrivateHeader title="协作与交接" subtitle="找回协作邀请、公开同意及项目交接结果。" current="collaboration"/>
    <nav className="tab-bar" aria-label="我的项目分类">{(Object.keys(ROLE_LABELS) as ProjectRole[]).map(value=><Link className="tab-link" key={value} aria-current={value===role?'page':undefined} href={`/profile/collaboration?role=${value}`}>{ROLE_LABELS[value]}</Link>)}</nav>
    <PersonalProjects key={offset} role={role} offset={offset} onPage={setOffset}/><CollaborationInbox/><TransferHistory/>
  </>;
}
function PersonalProjects({role,offset,onPage}:{role:ProjectRole;offset:number;onPage:(offset:number)=>void}) {
  const {state,retry}=useSection(()=>getMyProjects(role,offset));
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(offset>0&&state.status==='ready')heading.current?.focus();},[offset,state.status]);
  return <section className="section" aria-label={ROLE_LABELS[role]}><h2 ref={heading} tabIndex={-1} className="section-title">{ROLE_LABELS[role]}</h2>
    {state.status==='loading'?<CollaborationLoading/>:state.status==='error'?<SectionError error={state.error} onRetry={retry}/>:<>
      {state.data.items.length?<ul className="ie-draft-list">{state.data.items.map(item=><li className="ie-draft-row" key={item.collaboration_id??item.project_id}><div className="ie-draft-copy"><h3 className="section-title">{item.title}</h3><p className="ie-draft-excerpt">{item.summary}</p>{role==='MEMBER'?<p>{item.public_name} · {item.division}</p>:<p className="field-hint">{item.can_publish_recruitment?'当前可按资格发布招募':'可准备文字；发布还须核对资格'}</p>}
        <div className="ie-draft-actions">{item.can_edit?<Link href={`/profile/collaboration/projects/${item.project_id}`}>协作工作区</Link>:null}{item.can_open_public?<Link href={`/innovation/projects/${item.project_id}`}>查看校内公开页</Link>:null}</div>
      </div></li>)}</ul>:<EmptyState title="此分类暂无项目" hint="接受邀请后会进入对应分类；管理和公开挂名分别展示。"/>}
      <PageControls offset={offset} total={state.data.total} onPage={onPage} label="本人项目分页"/>
    </>}
  </section>;
}
function TransferHistory() {
  const [offset,setOffset]=useState(0);
  return <section className="section" aria-label="本人的项目交接"><h2 className="section-title">项目交接</h2><p className="field-hint">项目管理权结束后，仍可在这里查看双方最小结果。待接任人可从此处确认或拒绝。</p><TransferPage key={offset} offset={offset} onPage={setOffset}/></section>;
}
function TransferPage({offset,onPage}:{offset:number;onPage:(offset:number)=>void}) {
  const {state,retry}=useSection(()=>getMyTransfers(offset));
  if(state.status==='loading')return <CollaborationLoading/>;
  if(state.status==='error')return <SectionError error={state.error} onRetry={retry}/>;
  return <><ul className="ie-draft-list">{state.data.items.map(row=><li className="ie-draft-row" key={row.id}><div className="ie-draft-copy"><h3 className="section-title">{row.project_title}</h3><p>{row.is_target?'交给我':'由我发起'} · 对方：{row.counterpart_nickname}</p><p>{transferStatus(row.status)}</p><Link href={`/profile/collaboration/transfers/${row.id}`}>查看交接与结果</Link></div></li>)}</ul>{state.data.items.length?null:<EmptyState title="暂无交接记录"/>}<PageControls offset={offset} total={state.data.total} onPage={onPage} label="交接记录分页"/></>;
}
