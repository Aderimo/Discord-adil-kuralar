import PenaltyCategoryClient from './client';

export function generateStaticParams() {
  return [
    { category: 'yazili' },
    { category: 'sesli' },
    { category: 'ekstra' },
    { category: 'marked' },
    { category: 'blacklist' },
  ];
}

export default function PenaltyCategoryPage() {
  return <PenaltyCategoryClient />;
}
