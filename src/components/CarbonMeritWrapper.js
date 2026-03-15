'use client';
import dynamic from 'next/dynamic';

const CarbonMeritModal = dynamic(
  () => import('@/components/CarbonMeritModal'),
  { ssr: false }
);

export default function CarbonMeritWrapper() {
  return <CarbonMeritModal />;
}
