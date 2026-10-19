import type { Metadata } from 'next';
import { MentorSelfView } from '@/features/innovation/mentors/MentorSelfView';
export const metadata:Metadata={title:'我的导师资料 · 华师令'};
export default function MyMentorPage(){return <div className="campus-mentor-page"><div className="page-head"><h1 className="page-title">本人档案与授权</h1><p className="page-subtitle">核对本人资料，管理展示、联系与项目挂名。</p></div><MentorSelfView/><p className="field-hint campus-mentor-directory-note">演示阶段使用模拟导师账号与资料，学校统一身份认证尚未接入。</p></div>;}
