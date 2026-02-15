import guideData from '../../../../content/guide/index.json';
import GuideSlugClient from './client';

export function generateStaticParams() {
  return guideData.items.map((item) => ({ slug: item.slug }));
}

export default function GuideSlugPage() {
  return <GuideSlugClient />;
}
