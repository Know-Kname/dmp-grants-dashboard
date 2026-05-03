import { EmptyState } from '../components/ui';
import { Map } from 'lucide-react';

export default function Cemeteries() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cemeteries</h1>
        <p className="text-foreground-muted mt-1">Plot and grave inventory management</p>
      </div>
      <EmptyState
        icon={<Map size={48} />}
        title="Cemetery management coming soon"
        description="Plot hierarchy, grave inventory, and availability tracking will be available here."
      />
    </div>
  );
}
