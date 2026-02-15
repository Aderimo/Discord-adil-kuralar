import CommandCategoryClient from './client';

export function generateStaticParams() {
  return [
    { category: 'ceza' },
    { category: 'bilgi' },
    { category: 'sesli' },
    { category: 'gk-plus' },
  ];
}

export default function CommandCategoryPage() {
  return <CommandCategoryClient />;
}
