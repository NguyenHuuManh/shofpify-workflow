/**
 * Purpose:
 * Dashboard home — redirects to workflows.
 */

import { redirect } from 'next/navigation';

export default function DashboardHome(): never {
  redirect('/dashboard/workflows');
}
