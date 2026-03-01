import { Link } from 'react-router-dom';
import { Card, CardBody, Button } from '../components/ui';
import { ArrowLeft, Construction } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  description: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-foreground-muted mt-1">{description}</p>
      </div>
      <Card>
        <CardBody>
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-950 text-primary mb-4">
              <Construction size={32} />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Under Development</h3>
            <p className="text-foreground-muted mb-6 max-w-md mx-auto leading-relaxed">
              This module is being built. Check back soon for full functionality including data management, search, and reporting.
            </p>
            <Link to="/">
              <Button variant="outline" icon={<ArrowLeft size={18} />}>
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
