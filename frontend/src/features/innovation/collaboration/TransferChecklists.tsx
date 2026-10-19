import type { components } from '@/lib/api/schema';
import { RELATION_SCOPE_LABELS, transferJobText } from './presentation';

export function TransferChecklists({summary,label}:{summary:components['schemas']['TransferSummary'];label:string}) {
  return <section className="section" aria-label={label}><h3 className="section-title">{label}</h3>
    <p className="field-hint">已接受关系按各自范围保留；原负责人的全部管理权将移除，接任人以负责人权限为准。未确认邀请不保留。此处不含联系值、资格资料或证明内容。</p>
    <h4 className="field-label">已接受的管理、成员与导师关系</h4>
    {summary.relationships==null?<p className="field-hint">此快照未记录具体关系清单，不能据此判断为空。</p>:summary.relationships.length?<ul className="ie-draft-list">{summary.relationships.map(row=><li className="ie-draft-row" key={row.reference}><div className="ie-draft-copy"><p><strong>{row.name}</strong>{row.division?` · ${row.division}`:''}</p><p className="field-hint">{RELATION_SCOPE_LABELS[row.scope]}</p></div></li>)}</ul>:<p className="field-hint">此时暂无已接受的管理或挂名关系。</p>}
    <h4 className="field-label">本次将关闭的岗位</h4>
    {summary.closing_recruitments==null?<p className="field-hint">此快照未记录具体岗位清单，不能据此判断为空。</p>:summary.closing_recruitments.length?<ul>{summary.closing_recruitments.map(row=><li className="ie-review-prose" key={row.reference}>{transferJobText(row)}</li>)}</ul>:<p className="field-hint">此时暂无需要关闭的开放岗位。</p>}
  </section>;
}
