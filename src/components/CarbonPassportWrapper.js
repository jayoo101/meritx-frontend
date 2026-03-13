'use client';
import dynamic from 'next/dynamic';

const CarbonPassportModal = dynamic(
  () => import('@/components/CarbonPassportModal'),
  { ssr: false }
);

export default function CarbonPassportWrapper() {
  return <CarbonPassportModal />;
}
