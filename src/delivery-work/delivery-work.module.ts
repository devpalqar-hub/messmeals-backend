import { Module } from '@nestjs/common';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { DeliveriesService } from 'src/deliveries/deliveries.service';
import { DeliveryWorkController } from './delivery-work.controller';
import { DeliveryWorkService } from './delivery-work.service';
import { DeliveryRouteService } from './delivery-route.service';
import { RouteOptimizerService } from './route-optimizer.service';
import { RouteSyncService } from './route-sync.service';

/**
 * Delivery partner work module: Google-optimised two-wheeler routes per partner /
 * variation / day, partner work sessions (start → next stop → complete), delivery
 * details and status updates.
 *
 * Self-contained by design — no other module is modified. DeliveriesService is
 * provided here (not imported from DeliveriesModule, which doesn't export it) so stop
 * status updates reuse its existing auto-complete + billing-ledger logic.
 */
@Module({
  imports: [TransactionsModule],
  controllers: [DeliveryWorkController],
  providers: [
    DeliveriesService,
    DeliveryWorkService,
    DeliveryRouteService,
    RouteOptimizerService,
    RouteSyncService,
  ],
})
export class DeliveryWorkModule {}
