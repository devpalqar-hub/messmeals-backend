import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeliveryRouteService, RouteScope } from './delivery-route.service';
import { nextDay, parseDay } from './geo.util';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
// How many upcoming days (starting today) to keep pre-sorted.
const LOOKAHEAD_DAYS = 2;

/**
 * Keeps routes sorted automatically when orders change elsewhere in the app — a new
 * subscription/booking (customers/payments modules), a pause (dates shift), an order
 * or subscription ending (isActive=false), or a partner change through the existing
 * /deliveries endpoints — without touching those modules.
 *
 * Every tick it looks for deliveries for today/tomorrow created or updated since the
 * last tick, and re-checks each affected route (the new partner's and the old one's).
 * DeliveryRouteService.ensureFresh is fingerprint-based, so unchanged routes cost one
 * query and no Google call. Routes are also refreshed lazily on every read, so this is
 * a warm-up, not the only path.
 *
 * DELIVERY_ROUTE_SYNC_INTERVAL_MS controls the period (default 5 min; 0 disables).
 */
@Injectable()
export class RouteSyncService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RouteSyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastRunAt = new Date(Date.now() - 15 * 60 * 1000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routes: DeliveryRouteService,
  ) {}

  onApplicationBootstrap() {
    const raw = process.env.DELIVERY_ROUTE_SYNC_INTERVAL_MS;
    const interval =
      raw === undefined || raw === '' ? DEFAULT_INTERVAL_MS : Number(raw);
    if (!Number.isFinite(interval) || interval <= 0) {
      this.logger.log('Automatic route sync disabled');
      return;
    }
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    const startedAt = new Date();
    try {
      const refreshed = await this.syncChangedSince(this.lastRunAt);
      this.lastRunAt = startedAt;
      if (refreshed > 0)
        this.logger.log(`Route sync checked ${refreshed} route(s)`);
    } catch (err) {
      this.logger.error('Route sync failed', err as Error);
    } finally {
      this.running = false;
    }
  }

  async syncChangedSince(since: Date): Promise<number> {
    const from = parseDay();
    let to = from;
    for (let i = 0; i < LOOKAHEAD_DAYS; i++) to = nextDay(to);

    const changed = await this.prisma.deliveries.findMany({
      where: {
        date: { gte: from, lt: to },
        OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }],
      },
      select: {
        id: true,
        messId: true,
        partnerId: true,
        date: true,
        deliveryVariations: {
          where: { deletedAt: null },
          select: { variationId: true },
        },
      },
    });
    if (changed.length === 0) return 0;

    const scopes = new Map<string, RouteScope>();
    const add = (s: RouteScope) =>
      scopes.set(
        `${s.messId}|${this.routes.partnerKey(s.partnerId)}|${s.variationId}|${s.date.toISOString()}`,
        s,
      );

    for (const d of changed) {
      const day = parseDay(d.date.toISOString());
      for (const dv of d.deliveryVariations) {
        add({
          messId: d.messId,
          partnerId: d.partnerId ?? null,
          variationId: dv.variationId,
          date: day,
        });
      }
    }
    // Routes these deliveries used to be on (e.g. the previous partner after a transfer).
    (
      await this.routes.scopesContainingDeliveries(changed.map((d) => d.id))
    ).forEach(add);

    for (const scope of scopes.values()) {
      try {
        await this.routes.ensureFresh(scope);
      } catch (err) {
        this.logger.warn(`Route refresh failed: ${(err as Error).message}`);
      }
    }
    return scopes.size;
  }
}
