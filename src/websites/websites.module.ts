import { Module } from '@nestjs/common';
import { WebsitesController } from './websites.controller';
import { WebsitesService } from './websites.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WebsiteProvisioningService } from './provisioning/website-provisioning.service';
import { WebsiteHostnameResolverService } from './provisioning/website-hostname-resolver.service';
import { CustomDomainService } from './custom-domain/custom-domain.service';
import { CustomDomainController } from './custom-domain/custom-domain.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WebsitesController, CustomDomainController],
  providers: [
    WebsitesService,
    WebsiteProvisioningService,
    WebsiteHostnameResolverService,
    CustomDomainService,
  ],
  exports: [
    WebsitesService,
    WebsiteProvisioningService,
    WebsiteHostnameResolverService,
    CustomDomainService,
  ],
})
export class WebsitesModule {}
