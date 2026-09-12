import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Core funnel events
export type ActivationEvent = 
  | 'landing_viewed'
  | 'cta_clicked'
  | 'demo_option_selected'
  | 'session_started'
  | 'demo_started'
  | 'mission_started'
  | 'first_value_received'
  | 'mission_completed'
  | 'mission_failed'
  | 'second_mission_started'
  | 'user_returned';

interface BaseEventPayload {
  sessionId: string;
  userId?: string;
  userAgent?: string;
}

interface MissionPayload extends BaseEventPayload {
  missionId: string;
  demoType?: string;
  provider?: string;
  durationMs?: number; // Used for TTFV
  success?: boolean;
}

export interface DailyMetrics {
  date: string;
  counts: Record<string, number>;
  ttfv: {
    medianMs: number;
    avgMs: number;
  };
  totalTtfvEvents: number;
}

export class ActivationAnalytics {
  private static getCollection() {
    return collection(db, 'analytics_events');
  }

  static async logEvent(
    eventName: ActivationEvent, 
    payload: Partial<MissionPayload> = {}
  ) {
    try {
      // CRITICAL: Ensure no sensitive user data/prompts/files are sent
      const safePayload = {
        eventName,
        timestamp: serverTimestamp(),
        sessionId: payload.sessionId || 'anonymous',
        userId: payload.userId,
        missionId: payload.missionId,
        demoType: payload.demoType,
        provider: payload.provider,
        durationMs: payload.durationMs,
        success: payload.success
      };

      // Clean undefined fields
      Object.keys(safePayload).forEach(key => 
        (safePayload as any)[key] === undefined && delete (safePayload as any)[key]
      );

      await addDoc(this.getCollection(), safePayload);
    } catch (e) {
      console.warn("Analytics tracking failed (safe to ignore offline):", e);
    }
  }

  static async getFunnelMetrics() {
    // 1. Try to fetch pre-aggregated metrics first (Scalability Abstraction)
    try {
      const dailyRef = collection(db, 'analytics_daily');
      const qDaily = query(dailyRef, orderBy('date', 'desc'), limit(7));
      const dailySnap = await getDocs(qDaily);
      
      if (!dailySnap.empty) {
        const aggregatedCounts: Record<string, number> = {};
        let totalMedian = 0;
        let totalAvg = 0;
        let totalEvents = 0;

        dailySnap.docs.forEach(doc => {
          const data = doc.data() as DailyMetrics;
          Object.entries(data.counts || {}).forEach(([k, v]) => {
            aggregatedCounts[k] = (aggregatedCounts[k] || 0) + v;
          });
          
          if (data.ttfv && data.totalTtfvEvents) {
            totalMedian += data.ttfv.medianMs * data.totalTtfvEvents;
            totalAvg += data.ttfv.avgMs * data.totalTtfvEvents;
            totalEvents += data.totalTtfvEvents;
          }
        });

        return {
          counts: aggregatedCounts,
          ttfv: { 
            medianMs: totalEvents > 0 ? totalMedian / totalEvents : 0, 
            avgMs: totalEvents > 0 ? totalAvg / totalEvents : 0 
          }
        };
      }
    } catch (e) {
      console.warn("No daily aggregations found, falling back to raw events sampling");
    }

    // 2. Fallback: For early prototyping, sample the raw events
    const q = query(this.getCollection(), orderBy('timestamp', 'desc'), limit(1000));
    const snapshot = await getDocs(q);
    
    const events = snapshot.docs.map(d => d.data() as any);
    
    const counts: Record<string, number> = {};
    const ttfvs: number[] = [];
    
    events.forEach(ev => {
      counts[ev.eventName] = (counts[ev.eventName] || 0) + 1;
      
      if (ev.eventName === 'first_value_received' && ev.durationMs) {
        ttfvs.push(ev.durationMs);
      }
    });
    
    let medianTtfv = 0;
    let avgTtfv = 0;
    if (ttfvs.length > 0) {
      ttfvs.sort((a, b) => a - b);
      medianTtfv = ttfvs[Math.floor(ttfvs.length / 2)];
      avgTtfv = ttfvs.reduce((a, b) => a + b, 0) / ttfvs.length;
    }

    return {
      counts,
      ttfv: {
        medianMs: medianTtfv,
        avgMs: avgTtfv
      }
    };
  }
}
