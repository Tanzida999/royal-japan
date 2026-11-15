import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { meQuery } from '@/lib/app';
import { useCurrentShop } from '@/lib/shop-context';
import { useRegister } from '@/lib/register-store';
export function RegisterScope() { const {data:me}=useQuery(meQuery);const {shopId}=useCurrentShop();const start=useRegister(s=>s.start);useEffect(()=>{start(shopId,me?.id??'');},[shopId,me?.id,start]);return null; }