import { SectionSkeleton } from '@/components/ui/sectionStates';

export function CollaborationLoading() {
  return <div role="status" aria-live="polite" aria-label="正在读取协作资料">
    <span className="sr-only">正在读取协作资料，请稍候。</span>
    <SectionSkeleton/>
  </div>;
}
