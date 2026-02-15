import procedureData from '../../../../content/procedures/index.json';
import ProcedureSlugClient from './client';

export function generateStaticParams() {
  return procedureData.items.map((item) => ({ slug: item.slug }));
}

export default function ProcedureSlugPage() {
  return <ProcedureSlugClient />;
}
