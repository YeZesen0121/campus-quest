'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DividedSections } from '@/components/ui/dividedSections';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState, SectionError, SectionSkeleton } from '@/components/ui/sectionStates';
import { AuthField } from '@/features/auth/AuthField';

const LONG_NOTE = '模拟说明：长内容应自然换行，独立分区的中线跟随较高的一列，不依赖另一列的内容长度。示例文字仅用于检查界面，不代表真实用户资料。'.repeat(12);

export function UiMigrationGallery() {
  const [result, setResult] = useState('尚未操作示例');
  return (
    <section className="section" aria-label="共享视觉基础">
      <h2 className="section-title">共享视觉基础</h2>
      <div role="group" aria-label="独立分区示例">
        <DividedSections>
          <section className="section" aria-label="基础填写区">
            <h3 className="section-title">基础填写区</h3>
            <AuthField name="ui-migration-name" label="示例姓名" inputProps={{ defaultValue: '模拟新同学' }} />
            <AuthField name="ui-migration-email" label="示例邮箱" hint="模拟字段，仅用于布局与关联检查。" error="示例：请检查邮箱格式。" inputProps={{ type: 'email', defaultValue: 'example@' }} />
          </section>
          <section className="section" aria-label="补充说明区">
            <h3 className="section-title">补充说明区</h3>
            <p className="page-subtitle">{LONG_NOTE}</p>
          </section>
        </DividedSections>
      </div>
      <div className="form-grid" role="group" aria-label="普通字段对">
        <AuthField name="ui-migration-class" label="示例班级" inputProps={{ defaultValue: '模拟班级' }} />
        <AuthField name="ui-migration-direction" label="示例方向" inputProps={{ defaultValue: '模拟协作方向' }} />
      </div>
      <div className="row-actions" role="group" aria-label="相邻操作示例">
        <Button onClick={() => setResult('示例已保存')}>保存示例</Button>
        <Button variant="secondary" onClick={() => setResult('示例已返回')}>返回示例</Button>
        <Button variant="ghost" onClick={() => setResult('示例说明已查看')}>查看说明</Button>
      </div>
      <Button variant="secondary">保存这份包含很长中文名称的模拟资料并继续检查换行与触控区域</Button>
      <p role="status" aria-label="共享示例结果" className="field-hint">{result}</p>
      <Dialog>
        <DialogTrigger asChild><Button variant="secondary">打开共享弹窗</Button></DialogTrigger>
        <DialogContent>
          <DialogTitle>共享弹窗示例</DialogTitle>
          <DialogDescription>模拟对话框，用于检查键盘关闭与焦点返回。</DialogDescription>
          <AuthField name="ui-migration-dialog-name" label="弹窗示例姓名" inputProps={{ defaultValue: '模拟新同学' }} />
          <DialogFooter><DialogClose asChild><Button variant="secondary">关闭示例弹窗</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="table-scroll">
        <table className="staff-table">
          <caption>状态列示例</caption>
          <thead><tr><th scope="col">名称</th><th scope="col" className="cq-status-cell">状态</th></tr></thead>
          <tbody><tr><td>模拟资料</td><td className="cq-status-cell">待完善</td></tr></tbody>
        </table>
      </div>
      <section className="section" aria-label="共享状态示例">
        <h3 className="section-title">共享状态示例</h3>
        <SectionSkeleton lines={2} />
        <EmptyState title="示例暂无内容" hint="模拟空状态；实际页面继续使用各自的业务动作。" />
        <SectionError error={new Error('模拟加载失败')} retryLabel="重试共享示例" onRetry={() => setResult('示例已重试')} />
      </section>
    </section>
  );
}
