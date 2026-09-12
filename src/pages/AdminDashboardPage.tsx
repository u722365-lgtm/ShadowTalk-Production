import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Target, Clock, DollarSign, Activity, ArrowRight, Loader2, ArrowDownRight } from "lucide-react";
import { ActivationAnalytics } from "@/lib/telemetry/activationAnalytics";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState({
    visitors: 0,
    ctaClicked: 0,
    demoOptionSelected: 0,
    startedFirstMission: 0,
    firstValueReceived: 0,
    completedMission: 0,
    startedSecondMission: 0,
    returnedWithin7Days: 0,
  });

  const [unitEconomics, setUnitEconomics] = useState({
    ttfvAvgMs: 0,
    ttfvMedianMs: 0,
    aiCostPerMission: "$0.012", // Estimated
  });

  useEffect(() => {
    ActivationAnalytics.getFunnelMetrics().then((metrics) => {
      setFunnel({
        visitors: metrics.counts['landing_viewed'] || 0,
        ctaClicked: metrics.counts['cta_clicked'] || 0,
        demoOptionSelected: metrics.counts['demo_option_selected'] || 0,
        startedFirstMission: metrics.counts['mission_started'] || 0,
        firstValueReceived: metrics.counts['first_value_received'] || 0,
        completedMission: metrics.counts['mission_completed'] || 0,
        startedSecondMission: metrics.counts['second_mission_started'] || 0,
        returnedWithin7Days: metrics.counts['user_returned'] || 0,
      });
      setUnitEconomics(prev => ({
        ...prev,
        ttfvAvgMs: metrics.ttfv.avgMs,
        ttfvMedianMs: metrics.ttfv.medianMs,
      }));
      setLoading(false);
    });
  }, []);

  const formatMs = (ms: number) => (ms / 1000).toFixed(1) + "s";

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  const successRate = funnel.startedFirstMission > 0 
    ? ((funnel.completedMission / funnel.startedFirstMission) * 100).toFixed(1) + "%"
    : "0%";

  const FunnelStep = ({ label, count, previousCount, icon: Icon, colorClass }: { label: string, count: number, previousCount: number | null, icon: any, colorClass: string }) => {
    const conversion = previousCount && previousCount > 0 ? (count / previousCount) * 100 : (previousCount === null ? 100 : 0);
    const dropoff = 100 - conversion;

    return (
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${colorClass}`} />
            <span className="font-medium text-lg">{label}</span>
          </div>
          <span className="text-xl font-bold">{count.toLocaleString()}</span>
        </div>
        
        {previousCount !== null && (
          <div className="flex items-center justify-between pl-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <ArrowDownRight className="w-4 h-4 text-destructive" />
              <span>{dropoff.toFixed(1)}% drop-off</span>
            </div>
            <div className="bg-secondary px-2 py-1 rounded text-secondary-foreground font-medium">
              {conversion.toFixed(1)}% conversion
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-10 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ShadowTalk Growth</h1>
        <p className="text-muted-foreground mt-2">Real-time activation funnel and unit economics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Product Health</CardTitle>
            <CardDescription>Real-time performance and unit economics.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <tbody className="[&_tr:last-child]:border-0">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">Median TTFV</td>
                    <td className="p-4 align-middle text-right">{formatMs(unitEconomics.ttfvMedianMs)}</td>
                  </tr>
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">Average TTFV</td>
                    <td className="p-4 align-middle text-right">{formatMs(unitEconomics.ttfvAvgMs)}</td>
                  </tr>
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">Mission Success Rate</td>
                    <td className="p-4 align-middle text-right">{successRate}</td>
                  </tr>
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">Estimated AI Cost / Successful Mission</td>
                    <td className="p-4 align-middle text-right text-destructive font-semibold">{unitEconomics.aiCostPerMission}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activation Funnel</CardTitle>
          <CardDescription>Where the product is leaking users during onboarding.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <FunnelStep label="Visitors (Landing)" count={funnel.visitors} previousCount={null} icon={Users} colorClass="text-muted-foreground" />
            <div className="border-l-2 h-6 ml-4 border-dashed border-muted-foreground/30"></div>
            <FunnelStep label="CTA Clicked" count={funnel.ctaClicked} previousCount={funnel.visitors} icon={Target} colorClass="text-blue-500" />
            <div className="border-l-2 h-6 ml-4 border-dashed border-muted-foreground/30"></div>
            <FunnelStep label="Demo Selected" count={funnel.demoOptionSelected} previousCount={funnel.ctaClicked} icon={Target} colorClass="text-blue-500" />
            <div className="border-l-2 h-6 ml-4 border-dashed border-muted-foreground/30"></div>
            <FunnelStep label="Started Mission" count={funnel.startedFirstMission} previousCount={funnel.demoOptionSelected} icon={Activity} colorClass="text-emerald-500" />
            <div className="border-l-2 h-6 ml-4 border-dashed border-muted-foreground/30"></div>
            <FunnelStep label="First Value Received" count={funnel.firstValueReceived} previousCount={funnel.startedFirstMission} icon={Clock} colorClass="text-emerald-500" />
            <div className="border-l-2 h-6 ml-4 border-dashed border-muted-foreground/30"></div>
            <FunnelStep label="Completed Mission" count={funnel.completedMission} previousCount={funnel.firstValueReceived} icon={Target} colorClass="text-emerald-500" />
            <div className="border-l-2 h-6 ml-4 border-dashed border-muted-foreground/30"></div>
            <FunnelStep label="Started Second Mission" count={funnel.startedSecondMission} previousCount={funnel.completedMission} icon={Activity} colorClass="text-blue-500" />
            <div className="border-l-2 h-6 ml-4 border-dashed border-muted-foreground/30"></div>
            <FunnelStep label="Returned within 7 days" count={funnel.returnedWithin7Days} previousCount={funnel.startedSecondMission} icon={Users} colorClass="text-purple-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
